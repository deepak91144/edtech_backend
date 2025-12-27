import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import LiveClass from '../models/LiveClass';
import Class from '../models/Class';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import crypto from 'crypto';
import * as HMS from '@100mslive/server-sdk';

const router = Router();
const hms = new HMS.SDK(
    process.env.HMS_ACCESS_KEY || '',
    process.env.HMS_SECRET || ''
);

// Generate random unique link
function generateLiveLink(): string {
    return crypto.randomBytes(16).toString('hex');
}

// Create a live class (Teacher only)
router.post('/',
    requireRole('teacher'),
    [
        body('title').notEmpty().withMessage('Title is required'),
        body('classId').notEmpty().withMessage('Class ID is required'),
        body('startTime').notEmpty().withMessage('Start time is required'),
        body('endTime').notEmpty().withMessage('End time is required')
    ],
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { title, classId, startTime, endTime } = req.body;

            // Verify the class exists and teacher is assigned to it
            const classDoc = await Class.findById(classId);
            if (!classDoc) {
                res.status(404).json({ message: 'Class not found' });
                return;
            }

            // Check if teacher is assigned to this class
            const isAssigned = classDoc.teacherIds.some(
                teacherId => teacherId.toString() === req.user!.id
            );

            if (!isAssigned) {
                res.status(403).json({ message: 'You are not assigned to this class' });
                return;
            }

            // Generate unique link
            let liveLink = generateLiveLink();
            let linkExists = await LiveClass.findOne({ liveLink });

            // Ensure uniqueness
            while (linkExists) {
                liveLink = generateLiveLink();
                linkExists = await LiveClass.findOne({ liveLink });
            }

            // Create room on 100ms
            let hmsRoomId = '';
            try {
                const room = await hms.rooms.create({
                    name: `class-${classId}-${Date.now()}`,
                    description: title,
                    template_id: process.env.HMS_TEMPLATE_ID || 'default_videoconf_7e5e3e8c-8598-4b71-9257-22d86104ca87' // Fallback to a default or require env
                });
                hmsRoomId = room.id;
            } catch (hmsError: any) {
                console.error('100ms Room Creation Error:', hmsError);
                // Return error to user so they know video setup failed
                res.status(400).json({
                    message: 'Failed to create video room. Please check 100ms credentials and Template ID.',
                    details: hmsError.message
                });
                return;
            }

            const liveClass = new LiveClass({
                title,
                classId,
                teacherId: req.user!.id,
                organizationId: classDoc.organizationId,
                liveLink,
                hmsRoomId,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                isActive: true
            });

            await liveClass.save();

            // Populate class details
            await liveClass.populate('classId', 'name');

            res.status(201).json({
                success: true,
                message: 'Live class created successfully',
                liveClass
            });
        } catch (error) {
            console.error('Create live class error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Get join token
router.get('/:id/join', requireRole('teacher', 'student'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const liveClass = await LiveClass.findById(req.params.id);
        if (!liveClass) {
            res.status(404).json({ message: 'Live class not found' });
            return;
        }

        if (!liveClass.hmsRoomId) {
            res.status(400).json({ message: 'Video room not configured for this class' });
            return;
        }

        // Determine role (host for teacher, guest/student for student)
        // Note: Role names must match what's defined in the 100ms template.
        // Common defaults: 'host', 'guest', 'teacher', 'student'.
        // I will assume 'host' for teacher and 'guest' for student for now as safe defaults for most templates,
        // or strictly 'teacher'/'student' if using a custom template.
        // Let's use 'host' and 'guest' as they are standard in default templates.
        const role = req.user!.role === 'teacher' ? 'host' : 'guest';
        const userId = req.user!.id;

        const token = await hms.auth.getAuthToken({
            roomId: liveClass.hmsRoomId,
            role: role,
            userId: userId
        });

        res.json({
            success: true,
            token: token.token
        });
    } catch (error) {
        console.error('Get join token error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get recordings for a live class
router.get('/:id/recordings', requireRole('teacher', 'admin', 'org_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const liveClass = await LiveClass.findById(req.params.id);
        if (!liveClass) {
            res.status(404).json({ message: 'Live class not found' });
            return;
        }

        if (!liveClass.hmsRoomId) {
            res.status(400).json({ message: 'Video room not configured for this class' });
            return;
        }

        // Log details to help user find recordings in dashboard
        console.log(`Fetching recording assets for Room ID: ${liveClass.hmsRoomId}`);

        // Fetch recording assets directly from 100ms (more reliable for actual file links)
        const assetList = await hms.recordingAssets.list({ room_id: liveClass.hmsRoomId });

        const allRecordings = [];
        for await (const asset of assetList) {
            const a = asset as any;

            // If it's a composite recording, it's our main video
            if (a.type === 'room-composite') {
                try {
                    // Check if asset is ready and has a path (to avoid "RemotePath is missing" error)
                    if (a.status === 'completed' && (a.location || a.path)) {
                        const preSigned = await hms.recordingAssets.generatePreSignedURL(a.id, 86400);

                        allRecordings.push({
                            id: a.id,
                            session_id: a.session_id,
                            created_at: a.created_at,
                            status: 'completed',
                            duration: a.duration || 0,
                            recording_assets: [{ ...a, location: preSigned.url }],
                            location: preSigned.url
                        });
                    } else {
                        // Mark as processing/pending
                        allRecordings.push({
                            id: a.id,
                            session_id: a.session_id,
                            created_at: a.created_at,
                            status: a.status || 'processing',
                            duration: a.duration || 0,
                            recording_assets: [a],
                            location: null
                        });
                    }
                } catch (urlError) {
                    console.warn(`Failed to get pre-signed URL for asset ${a.id}:`, urlError);
                }
            }
        }

        res.json({
            success: true,
            recordings: allRecordings
        });
    } catch (error) {
        console.error('Get recordings error:', error);
        // Don't fail hard if 100ms errors, just return empty list or specific error
        res.status(500).json({ message: 'Failed to fetch recordings', error: error instanceof Error ? error.message : 'Unknown error' });
    }
});

// Join by live link (for frontend URL access)
router.post('/join-by-link', requireRole('teacher', 'student'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { liveLink } = req.body;
        if (!liveLink) {
            res.status(400).json({ message: 'Live link is required' });
            return;
        }

        const liveClass = await LiveClass.findOne({ liveLink: liveLink, isActive: true }).populate('classId', 'name');

        if (!liveClass) {
            res.status(404).json({ message: 'Live class not found or inactive' });
            return;
        }

        if (!liveClass.hmsRoomId) {
            res.status(400).json({ message: 'Video room not configured for this class' });
            return;
        }

        // Determine role
        // Use roles available in the template: broadcaster, co-broadcaster, viewer-realtime
        const role = req.user!.role === 'teacher' ? 'broadcaster' : 'co-broadcaster';
        const userId = req.user!.id;

        const token = await hms.auth.getAuthToken({
            roomId: liveClass.hmsRoomId,
            role: role,
            userId: userId
        });

        res.json({
            success: true,
            token: token.token,
            liveClass
        });
    } catch (error) {
        console.error('Join by link error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get live classes for teacher
router.get('/my-classes', requireRole('teacher'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const liveClasses = await LiveClass.find({
            teacherId: req.user!.id,
            isActive: true
        })
            .populate('classId', 'name')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: liveClasses.length,
            liveClasses
        });
    } catch (error) {
        console.error('Get teacher live classes error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get live classes for student
router.get('/student-classes', requireRole('student'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        // Find classes the student is enrolled in
        const studentClasses = await Class.find({
            studentIds: req.user!.id
        }).select('_id');

        const classIds = studentClasses.map(c => c._id);

        // Find active live classes for these classes
        const liveClasses = await LiveClass.find({
            classId: { $in: classIds },
            isActive: true
        })
            .populate('classId', 'name')
            .populate('teacherId', 'name')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: liveClasses.length,
            liveClasses
        });
    } catch (error) {
        console.error('Get student live classes error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete/deactivate a live class
router.delete('/:id', requireRole('teacher'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const liveClass = await LiveClass.findOne({
            _id: req.params.id,
            teacherId: req.user!.id
        });

        if (!liveClass) {
            res.status(404).json({ message: 'Live class not found' });
            return;
        }

        // Soft delete by setting isActive to false
        liveClass.isActive = false;
        await liveClass.save();

        res.json({
            success: true,
            message: 'Live class deleted successfully'
        });
    } catch (error) {
        console.error('Delete live class error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
