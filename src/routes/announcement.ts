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
        body('organizationId').notEmpty().withMessage('Organization ID is required'),
        body('targetClassIds').isArray().withMessage('Target classes must be an array'),
        body('severity').optional().isIn(['info', 'warning', 'urgent']).withMessage('Severity must be info, warning, or urgent'),
        body('targetAudience').optional().isIn(['students', 'teachers', 'both']).withMessage('Target audience must be students, teachers, or both')
    ],
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { title, content, link, severity, targetAudience, organizationId, targetClassIds } = req.body;

            // For org_admin, validate they own the organization
            if (req.user!.role === 'org_admin') {
                const Organization = require('../models/Organization').default;
                const org = await Organization.findOne({
                    _id: organizationId,
                    adminId: req.user!.id
                });

                if (!org) {
                    res.status(403).json({ message: 'You do not have access to this organization' });
                    return;
                }
            }

            // Validate that target classes belong to the specified organization
            if (targetClassIds && targetClassIds.length > 0) {
                const classes = await Class.find({
                    _id: { $in: targetClassIds },
                    organizationId: organizationId
                });

                if (classes.length !== targetClassIds.length) {
                    res.status(400).json({ message: 'Some classes do not belong to the specified organization' });
                    return;
                }
            }

            const announcement = new Announcement({
                title,
                content,
                link,
                severity,
                targetAudience: targetAudience || 'students',
                authorId: req.user!.id,
                organizationId,
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

        // 2. Find announcements that target these classes and appropriate audience
        const audienceFilter = req.user!.role === 'teacher'
            ? { $in: ['teachers', 'both'] }
            : { $in: ['students', 'both'] };

        const announcements = await Announcement.find({
            organizationId: req.user!.organizationId,
            targetClassIds: { $in: classIds },
            targetAudience: audienceFilter
        })
            .populate('authorId', 'name role')
            .populate('organizationId', 'name')
            .populate('targetClassIds', 'name')
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
                { authorId: req.user!.id }, // Created by me (regardless of targetAudience)
                {
                    targetClassIds: { $in: classIds },
                    targetAudience: { $in: ['teachers', 'both'] } // Only show announcements for teachers
                }
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

// Get unread announcement count for current user
router.get('/unread-count', requireRole('student', 'teacher'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // 1. Find classes the user is enrolled in (student) or teaches (teacher)
        const query = req.user!.role === 'teacher'
            ? { teacherIds: req.user!.id }
            : { studentIds: req.user!.id };

        const userClasses = await Class.find(query).select('_id');
        const classIds = userClasses.map(c => c._id);

        // 2. Find announcements that target these classes and appropriate audience
        const audienceFilter = req.user!.role === 'teacher'
            ? { $in: ['teachers', 'both'] }
            : { $in: ['students', 'both'] };

        const unreadCount = await Announcement.countDocuments({
            organizationId: req.user!.organizationId,
            targetClassIds: { $in: classIds },
            targetAudience: audienceFilter,
            readBy: { $ne: req.user!.id } // Not read by current user
        });

        res.json({
            success: true,
            count: unreadCount
        });
    } catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Mark announcement as read
router.post('/:id/mark-read', requireRole('student', 'teacher'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const announcement = await Announcement.findById(req.params.id);

        if (!announcement) {
            res.status(404).json({ message: 'Announcement not found' });
            return;
        }

        // Check if already read
        if (announcement.readBy.includes(req.user!.id as any)) {
            res.json({
                success: true,
                message: 'Already marked as read'
            });
            return;
        }

        // Add user to readBy array
        announcement.readBy.push(req.user!.id as any);
        await announcement.save();

        res.json({
            success: true,
            message: 'Marked as read'
        });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
