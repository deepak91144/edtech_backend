import { Router, Response } from 'express';
import Class from '../models/Class';
import Subject from '../models/Subject';
import Organization from '../models/Organization';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { checkStudentConflicts } from '../utils/validation';

const router = Router();

// Get all classes (with optional organizationId filter)
router.get('/', requireRole('admin', 'org_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { organizationId } = req.query;
        const query: any = {};

        if (organizationId) {
            query.organizationId = organizationId;
        }

        // If org_admin, force filtering by their organization
        if (req.user?.role === 'org_admin') {
            // We should verify they are requesting their own org or just override it.
            // For simplicity, let's look up the org they belong to if possible, 
            // but relying on query param with a check is arguably okay if we validate ownership.
            // Better: find orgs owned by this admin.
            const organizations = await Organization.find({ adminId: req.user.id });
            const orgIds = organizations.map(o => o._id);

            if (organizationId) {
                if (!orgIds.some(id => id.toString() === organizationId.toString())) {
                    res.status(403).json({ message: 'Access denied to this organization' });
                    return;
                }
                query.organizationId = organizationId;
            } else {
                query.organizationId = { $in: orgIds };
            }
        }

        const classes = await Class.find(query)
            .populate('organizationId', 'name type')
            .populate('teacherIds', 'name email')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            classes
        });
    } catch (error) {
        console.error('Get classes error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get current user's classes
router.get('/my-classes', requireRole('teacher', 'student'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const query = req.user?.role === 'teacher'
            ? { teacherIds: req.user.id }
            : { studentIds: req.user?.id };

        const classes = await Class.find(query)
            .populate('organizationId', 'name type')
            .populate('teacherIds', 'name email')
            .populate('studentIds', 'name email');

        res.json({
            success: true,
            classes
        });
    } catch (error) {
        console.error('Get my classes error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});


// Get subjects for a specific teacher (Admin/Org Admin only)
router.get('/subjects/teacher/:teacherId', requireRole('admin', 'org_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const subjects = await Subject.find({ teacherId: req.params.teacherId })
            .populate('classId', 'name organizationId')
            .sort({ createdAt: -1 });

        // Check organization access for org_admin
        if (req.user?.role === 'org_admin') {
            const authorizedSubjects = [];
            for (const subject of subjects) {
                if (subject.classId && typeof subject.classId === 'object' && 'organizationId' in subject.classId) {
                    const orgId = (subject.classId as any).organizationId;
                    const organization = await Organization.findById(orgId);
                    if (organization && organization.adminId.toString() === req.user.id) {
                        authorizedSubjects.push(subject);
                    }
                }
            }
            res.json({
                success: true,
                subjects: authorizedSubjects
            });
            return;
        }

        res.json({
            success: true,
            subjects
        });
    } catch (error) {
        console.error('Get teacher subjects error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get class details
router.get('/:id', requireRole('admin', 'org_admin', 'teacher', 'student'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const classData = await Class.findById(req.params.id)
            .populate('organizationId', 'name type')
            .populate('teacherIds', 'name email')
            .populate('studentIds', 'name email');

        if (!classData) {
            res.status(404).json({ message: 'Class not found' });
            return;
        }

        // Check access permissions
        if (req.user?.role === 'org_admin') {
            const organization = await Organization.findById(classData.organizationId._id);
            if (!organization || organization.adminId.toString() !== req.user.id) {
                res.status(403).json({ message: 'Access denied to this class' });
                return;
            }
        } else if (req.user?.role === 'teacher') {
            const isTeacher = classData.teacherIds.some((teacher: any) => teacher._id.toString() === req.user?.id);
            if (!isTeacher) {
                res.status(403).json({ message: 'Access denied to this class' });
                return;
            }
        } else if (req.user?.role === 'student') {
            const isStudent = classData.studentIds.some((student: any) => student._id.toString() === req.user?.id);
            if (!isStudent) {
                res.status(403).json({ message: 'Access denied to this class' });
                return;
            }
        }

        res.json({
            success: true,
            class: classData
        });
    } catch (error) {
        console.error('Get class error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add students to class
router.post('/:id/students', requireRole('admin', 'org_admin', 'teacher'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { studentIds } = req.body;

        if (!Array.isArray(studentIds) || studentIds.length === 0) {
            res.status(400).json({ message: 'Student IDs array is required' });
            return;
        }

        const classData = await Class.findById(req.params.id);

        if (!classData) {
            res.status(404).json({ message: 'Class not found' });
            return;
        }

        // Check if teacher/org_admin has access
        if (req.user?.role === 'org_admin') {
            const organization = await Organization.findById(classData.organizationId);
            if (!organization || organization.adminId.toString() !== req.user.id) {
                res.status(403).json({ message: 'Access denied to this class' });
                return;
            }
        } else if (req.user?.role === 'teacher') {
            const isTeacher = classData.teacherIds.some((teacher: any) => teacher.toString() === req.user?.id);
            if (!isTeacher) {
                res.status(403).json({ message: 'Access denied to this class' });
                return;
            }
        }

        // Check if any student is already enrolled in another class across the platform
        const conflictError = await checkStudentConflicts(studentIds, classData._id.toString());
        if (conflictError) {
            res.status(400).json({ message: conflictError });
            return;
        }

        // Add students (avoiding duplicates)
        studentIds.forEach((studentId: string) => {
            if (!classData.studentIds.includes(studentId as any)) {
                classData.studentIds.push(studentId as any);
            }
        });

        await classData.save();

        const updatedClass = await Class.findById(classData._id)
            .populate('teacherIds', 'name email')
            .populate('studentIds', 'name email');

        res.json({
            success: true,
            message: 'Students added successfully',
            class: updatedClass
        });
    } catch (error) {
        console.error('Add students error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Remove student from class
router.delete('/:id/students/:studentId', requireRole('admin', 'org_admin', 'teacher'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const classData = await Class.findById(req.params.id);

        if (!classData) {
            res.status(404).json({ message: 'Class not found' });
            return;
        }

        // Check if teacher/org_admin has access
        if (req.user?.role === 'org_admin') {
            const organization = await Organization.findById(classData.organizationId);
            if (!organization || organization.adminId.toString() !== req.user.id) {
                res.status(403).json({ message: 'Access denied to this class' });
                return;
            }
        } else if (req.user?.role === 'teacher') {
            const isTeacher = classData.teacherIds.some((teacher: any) => teacher.toString() === req.user?.id);
            if (!isTeacher) {
                res.status(403).json({ message: 'Access denied to this class' });
                return;
            }
        }

        classData.studentIds = classData.studentIds.filter(
            (studentId: any) => studentId.toString() !== req.params.studentId
        );

        await classData.save();

        res.json({
            success: true,
            message: 'Student removed successfully'
        });
    } catch (error) {
        console.error('Remove student error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add teachers to class
router.post('/:id/teachers', requireRole('admin', 'org_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { teacherIds } = req.body;

        if (!Array.isArray(teacherIds) || teacherIds.length === 0) {
            res.status(400).json({ message: 'Teacher IDs array is required' });
            return;
        }

        const classData = await Class.findById(req.params.id);

        if (!classData) {
            res.status(404).json({ message: 'Class not found' });
            return;
        }

        // Check if org_admin has access
        if (req.user?.role === 'org_admin') {
            const organization = await Organization.findById(classData.organizationId);
            if (!organization || organization.adminId.toString() !== req.user.id) {
                res.status(403).json({ message: 'Access denied to this class' });
                return;
            }
        }

        // Add teachers (avoiding duplicates)
        teacherIds.forEach((teacherId: string) => {
            if (!classData.teacherIds.includes(teacherId as any)) {
                classData.teacherIds.push(teacherId as any);
            }
        });

        await classData.save();

        const updatedClass = await Class.findById(classData._id)
            .populate('teacherIds', 'name email')
            .populate('studentIds', 'name email');

        res.json({
            success: true,
            message: 'Teachers added successfully',
            class: updatedClass
        });
    } catch (error) {
        console.error('Add teachers error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Remove teacher from class
router.delete('/:id/teachers/:teacherId', requireRole('admin', 'org_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const classData = await Class.findById(req.params.id);

        if (!classData) {
            res.status(404).json({ message: 'Class not found' });
            return;
        }

        // Check if org_admin has access
        if (req.user?.role === 'org_admin') {
            const organization = await Organization.findById(classData.organizationId);
            if (!organization || organization.adminId.toString() !== req.user.id) {
                res.status(403).json({ message: 'Access denied to this class' });
                return;
            }
        }

        classData.teacherIds = classData.teacherIds.filter(
            (teacherId: any) => teacherId.toString() !== req.params.teacherId
        );

        await classData.save();

        res.json({
            success: true,
            message: 'Teacher removed successfully'
        });
    } catch (error) {
        console.error('Remove teacher error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get subjects for a class
router.get('/:id/subjects', requireRole('admin', 'org_admin', 'teacher', 'student'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const subjects = await Subject.find({ classId: req.params.id })
            .populate('teacherId', 'name email')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            subjects
        });
    } catch (error) {
        console.error('Get subjects error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a subject
router.post('/:id/subjects',
    requireRole('admin', 'org_admin'),
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { name, description, teacherId } = req.body;

            if (!name || !description) {
                res.status(400).json({ message: 'Name and description are required' });
                return;
            }

            const classData = await Class.findById(req.params.id);
            if (!classData) {
                res.status(404).json({ message: 'Class not found' });
                return;
            }

            // Check if org_admin has access
            if (req.user?.role === 'org_admin') {
                const organization = await Organization.findById(classData.organizationId);
                if (!organization || organization.adminId.toString() !== req.user.id) {
                    res.status(403).json({ message: 'Access denied to this class' });
                    return;
                }
            }

            // Verify teacher if provided
            if (teacherId) {
                // Ensure teacher is assigned to this class
                const isTeacher = classData.teacherIds.includes(teacherId as any);
                if (!isTeacher) {
                    res.status(400).json({ message: 'Selected teacher is not assigned to this class' });
                    return;
                }
            }

            const subject = new Subject({
                name,
                description,
                classId: req.params.id,
                teacherId: teacherId || undefined
            });

            await subject.save();

            res.status(201).json({
                success: true,
                message: 'Subject created successfully',
                subject
            });
        } catch (error) {
            console.error('Create subject error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Delete a subject
router.delete('/:id/subjects/:subjectId',
    requireRole('admin', 'org_admin'),
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const classData = await Class.findById(req.params.id);
            if (!classData) {
                res.status(404).json({ message: 'Class not found' });
                return;
            }

            // Check if org_admin has access
            if (req.user?.role === 'org_admin') {
                const organization = await Organization.findById(classData.organizationId);
                if (!organization || organization.adminId.toString() !== req.user.id) {
                    res.status(403).json({ message: 'Access denied to this class' });
                    return;
                }
            }

            const deletedSubject = await Subject.findOneAndDelete({
                _id: req.params.subjectId,
                classId: req.params.id
            });

            if (!deletedSubject) {
                res.status(404).json({ message: 'Subject not found' });
                return;
            }

            res.json({
                success: true,
                message: 'Subject deleted successfully'
            });
        } catch (error) {
            console.error('Delete subject error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Update a subject
router.put('/:id/subjects/:subjectId',
    requireRole('admin', 'org_admin'),
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const { name, description, teacherId } = req.body;
            const updateData: any = {};

            if (name) updateData.name = name;
            if (description) updateData.description = description;

            // Handle teacher unassignment (if teacherId is explicitly null or empty string)
            if (teacherId === null || teacherId === '') {
                updateData.teacherId = null;
            } else if (teacherId) {
                // Verify teacher if provided
                const classData = await Class.findById(req.params.id);
                if (!classData) {
                    res.status(404).json({ message: 'Class not found' });
                    return;
                }

                const isTeacher = classData.teacherIds.includes(teacherId as any);
                if (!isTeacher) {
                    res.status(400).json({ message: 'Selected teacher is not assigned to this class' });
                    return;
                }
                updateData.teacherId = teacherId;
            }

            const subject = await Subject.findOneAndUpdate(
                { _id: req.params.subjectId, classId: req.params.id },
                updateData,
                { new: true }
            ).populate('teacherId', 'name email');

            if (!subject) {
                res.status(404).json({ message: 'Subject not found' });
                return;
            }

            res.json({
                success: true,
                message: 'Subject updated successfully',
                subject
            });
        } catch (error) {
            console.error('Update subject error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

export default router;
