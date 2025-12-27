
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import LiveClass from '../models/LiveClass';
import Assessment from '../models/Assessment';
import Class from '../models/Class';
import Holiday from '../models/Holiday';
import User from '../models/User';

export const getStudentEvents = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const studentId = req.user?.id;

        if (!studentId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        // 1. Get all classes the student is enrolled in
        const studentClasses = await Class.find({ studentIds: studentId }).select('_id name');
        const classIds = studentClasses.map(c => c._id);

        // 2. Fetch Live Classes for these classes
        // We'll fetch live classes from the last 30 days and future ones to keep the payload reasonable? 
        // Or just all future ones and recent past?
        // For now, let's fetch all relevant ones, maybe limiting by date if needed later.
        // Let's grab all for simplicity, or maybe filter by month if we passed query params?
        // The calendar usually asks for a range. Let's see if we want to support range query params.
        // For this MVP, let's just fetch "all active/recent" or just all. 
        // Let's fetch all for now, assuming the volume isn't massive yet.
        const liveClasses = await LiveClass.find({
            classId: { $in: classIds }
        })
            .populate('classId', 'name')
            .populate('teacherId', 'name')
            .lean();

        // 3. Fetch Assessments for these classes
        const assessments = await Assessment.find({
            classId: { $in: classIds },
            status: 'published'
        })
            .populate('classId', 'name')
            .populate('teacherId', 'name')
            .lean();

        // 4. Fetch Holidays
        // Strategy: Try to get organizationId from the User profile first.
        let organizationId = (req.user as any)?.organizationId;

        if (!organizationId) {
            // Fallback: fetch user from DB if not in token
            const user = await User.findById(studentId).select('organizationId');
            organizationId = user?.organizationId;
        }

        if (!organizationId) {
            // Fallback 2: Get from classes
            const classesWithOrg = await Class.find({ studentIds: studentId }).select('organizationId');
            if (classesWithOrg.length > 0) {
                organizationId = classesWithOrg[0].organizationId;
            }
        }

        let holidays: any[] = [];
        if (organizationId) {
            holidays = await Holiday.find({
                organizationId: organizationId
            }).lean();
            console.log(`[Calendar] Fetched ${holidays.length} holidays for Org ${organizationId}`);
        } else {
            console.log('[Calendar] No organization ID found for student, skipping holidays.');
        }

        // 5. Transform into a unified event format
        const events = [
            ...liveClasses.map(lc => ({
                id: lc._id,
                title: `Live Class: ${lc.title}`,
                start: lc.startTime,
                end: lc.endTime,
                type: 'live_class',
                details: {
                    link: lc.liveLink,
                    teacher: (lc.teacherId as any)?.name,
                    className: (lc.classId as any)?.name,
                    classId: (lc.classId as any)?._id
                }
            })),
            ...assessments.map(assess => ({
                id: assess._id,
                title: `Due: ${assess.title}`,
                start: assess.dueDate, // Assessments are "point in time" or deadlines. 
                end: assess.dueDate,   // We'll set end = start for point events
                type: 'assessment',
                details: {
                    teacher: (assess.teacherId as any)?.name,
                    className: (assess.classId as any)?.name,
                    classId: (assess.classId as any)?._id,
                    status: assess.status
                }
            })),
            ...holidays.map(holiday => ({
                id: holiday._id,
                title: `Holiday: ${holiday.title}`,
                start: holiday.date,
                end: holiday.date,
                type: 'holiday',
                details: {
                    description: holiday.description
                }
            }))
        ];

        res.json({
            success: true,
            events
        });

    } catch (error) {
        console.error('Get student events error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getTeacherEvents = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const teacherId = req.user?.id;

        if (!teacherId) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        // 1. Fetch Live Classes taught by the teacher
        const liveClasses = await LiveClass.find({
            teacherId: teacherId
        })
            .populate('classId', 'name')
            .lean();

        // 2. Fetch Assessments created by the teacher
        const assessments = await Assessment.find({
            teacherId: teacherId
        })
            .populate('classId', 'name')
            .lean();

        // 3. Fetch Holidays (use similar logic to student, getting org from user profile)
        let organizationId = (req.user as any)?.organizationId;

        if (!organizationId) {
            const user = await User.findById(teacherId).select('organizationId');
            organizationId = user?.organizationId;
        }

        let holidays: any[] = [];
        if (organizationId) {
            holidays = await Holiday.find({
                organizationId: organizationId
            }).lean();
        }

        // 4. Transform into a unified event format
        const events = [
            ...liveClasses.map(lc => ({
                id: lc._id,
                title: `Teaching: ${lc.title}`,
                start: lc.startTime,
                end: lc.endTime,
                type: 'live_class',
                details: {
                    link: lc.liveLink,
                    className: (lc.classId as any)?.name,
                    classId: (lc.classId as any)?._id
                }
            })),
            ...assessments.map(assess => ({
                id: assess._id,
                title: `Assessment: ${assess.title}`,
                start: assess.dueDate,
                end: assess.dueDate,
                type: 'assessment',
                details: {
                    className: (assess.classId as any)?.name,
                    classId: (assess.classId as any)?._id,
                    status: assess.status
                }
            })),
            ...holidays.map(holiday => ({
                id: holiday._id,
                title: `Holiday: ${holiday.title}`,
                start: holiday.date,
                end: holiday.date,
                type: 'holiday',
                details: {
                    description: holiday.description
                }
            }))
        ];

        res.json({
            success: true,
            events
        });

    } catch (error) {
        console.error('Get teacher events error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
