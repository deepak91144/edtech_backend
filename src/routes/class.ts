import { Router, Response } from 'express';
import Class from '../models/Class';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';

const router = Router();

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
            if (classData.organizationId._id.toString() !== req.user.organizationId) {
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
            if (classData.organizationId.toString() !== req.user.organizationId) {
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
            if (classData.organizationId.toString() !== req.user.organizationId) {
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
            if (classData.organizationId.toString() !== req.user.organizationId) {
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
            if (classData.organizationId.toString() !== req.user.organizationId) {
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

export default router;
