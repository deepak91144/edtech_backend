import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Announcement from '../models/Announcement';
import Class from '../models/Class';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';

const router = Router();

// Create an announcement
router.post('/',
    requireRole('admin', 'org_admin', 'teacher'),
    [
        body('title').notEmpty().withMessage('Title is required'),
        body('content').notEmpty().withMessage('Content is required'),
        body('targetClassIds').isArray().withMessage('Target classes must be an array')
    ],
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { title, content, link, targetClassIds } = req.body;

            // If user is org_admin or teacher, ensure they belong to the organization
            // and (optional) validate they have access to the target classes.
            // For simplicity, we trust the organizationId from the user.

            const announcement = new Announcement({
                title,
                content,
                link,
                authorId: req.user!.id,
                organizationId: req.user!.organizationId,
                targetClassIds
            });

            await announcement.save();

            res.status(201).json({
                success: true,
                message: 'Announcement created successfully',
                announcement
            });
        } catch (error) {
            console.error('Create announcement error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Get announcements for the current user (Student/Teacher)
router.get('/my-announcements', requireRole('student', 'teacher'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // 1. Find classes the user is enrolled in (student) or teaches (teacher)
        const query = req.user!.role === 'teacher'
            ? { teacherIds: req.user!.id }
            : { studentIds: req.user!.id };

        const userClasses = await Class.find(query).select('_id');
        const classIds = userClasses.map(c => c._id);

        // 2. Find announcements that target these classes
        const announcements = await Announcement.find({
            organizationId: req.user!.organizationId,
            targetClassIds: { $in: classIds }
        })
            .populate('authorId', 'name role')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: announcements.length,
            announcements
        });
    } catch (error) {
        console.error('Get my announcements error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get announcements for the current user (Teacher/Admin)
router.get('/org-announcements', requireRole('admin', 'org_admin', 'teacher'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const query: any = { organizationId: req.user!.organizationId };

        // If teacher, only show announcements for classes they teach OR announcements they created
        if (req.user!.role === 'teacher') {
            // Find classes this teacher teaches
            const teacherClasses = await Class.find({ teacherIds: req.user!.id }).select('_id');
            const classIds = teacherClasses.map(c => c._id);

            query.$or = [
                { authorId: req.user!.id }, // Created by me
                { targetClassIds: { $in: classIds } } // Targeted at my classes
            ];
        }

        const announcements = await Announcement.find(query)
            .populate('authorId', 'name role')
            .populate('targetClassIds', 'name')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: announcements.length,
            announcements
        });
    } catch (error) {
        console.error('Get org announcements error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
