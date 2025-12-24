import { Request, Response } from 'express';
import Note from '../models/Note';
import Class from '../models/Class';
import mongoose from 'mongoose';

// @desc    Get all notes for a user (Personal + Shared)
// @route   GET /api/notes
// @access  Private
export const getNotes = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const userRole = (req as any).user.role;

        let query: any = { user: userId };

        // If user is a student, also fetch notes shared with their classes
        if (userRole === 'student') {
            // Find classes where the student is enrolled
            const studentClasses = await Class.find({ studentIds: userId });
            const classIds = studentClasses.map(c => c._id);

            // Query: (User is owner) OR (Note is shared with one of student's classes)
            query = {
                $or: [
                    { user: userId },
                    { classId: { $in: classIds } }
                ]
            };
        } else if (userRole === 'teacher') {
            // For teachers, we might want to see notes they created for classes too
            // The basic { user: userId } covers both personal and shared-by-them notes
            // But if we want to be explicit or if sharedBy logic differs:
            query = { user: userId };
        }

        const notes = await Note.find(query)
            .populate('classId', 'name') // Populate class name for UI
            .populate('sharedBy', 'name') // Populate teacher name
            .sort({ isPinned: -1, updatedAt: -1 });

        res.status(200).json({ success: true, count: notes.length, data: notes });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Create a new note
// @route   POST /api/notes
// @access  Private
// Body: { title, content, color, tags, isPinned, classId }
export const createNote = async (req: Request, res: Response) => {
    try {
        const { title, content, color, tags, isPinned, classId } = req.body;
        const userId = (req as any).user.id;
        const userRole = (req as any).user.role;

        let noteData: any = {
            title,
            content,
            color,
            tags,
            isPinned,
            user: userId,
        };

        // Handle Shared Note Creation
        if (classId) {
            // Verify user is a teacher (or admin? assuming teacher for now based on req)
            if (userRole !== 'teacher' && userRole !== 'org_admin') {
                return res.status(403).json({ success: false, message: 'Only teachers can create shared class notes' });
            }

            // Verify teacher belongs to this class
            const classObj = await Class.findById(classId);
            if (!classObj) {
                return res.status(404).json({ success: false, message: 'Class not found' });
            }

            // Check if teacher is assigned to this class (optional but recommended security)
            // Assuming teacherIds is array of ObjectIds
            const isTeacherOfClass = classObj.teacherIds.some(id => id.toString() === userId);
            // logic bypass for org_admin if needed, or strict check:
            if (userRole === 'teacher' && !isTeacherOfClass) {
                return res.status(403).json({ success: false, message: 'You are not a teacher of this class' });
            }

            noteData.classId = classId;
            noteData.sharedBy = userId;
        }

        const note = await Note.create(noteData);

        res.status(201).json({ success: true, data: note });
    } catch (err: any) {
        if (err.name === 'ValidationError') {
            const messages = Object.values(err.errors).map((val: any) => val.message);
            return res.status(400).json({ success: false, error: messages });
        }
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update a note
// @route   PUT /api/notes/:id
// @access  Private
export const updateNote = async (req: Request, res: Response) => {
    try {
        let note = await Note.findById(req.params.id);

        if (!note) {
            return res.status(404).json({ success: false, message: 'Note not found' });
        }

        // Make sure user owns note
        if (note.user.toString() !== (req as any).user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized to update this note' });
        }

        note = await Note.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true,
        });

        res.status(200).json({ success: true, data: note });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Delete a note
// @route   DELETE /api/notes/:id
// @access  Private
export const deleteNote = async (req: Request, res: Response) => {
    try {
        const note = await Note.findById(req.params.id);

        if (!note) {
            return res.status(404).json({ success: false, message: 'Note not found' });
        }

        // Make sure user owns note
        if (note.user.toString() !== (req as any).user.id) {
            return res.status(401).json({ success: false, message: 'Not authorized to delete this note' });
        }

        await note.deleteOne();

        res.status(200).json({ success: true, data: {} });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};
