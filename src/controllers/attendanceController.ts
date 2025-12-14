import { Request, Response } from 'express';
import Attendance from '../models/Attendance';
import Class from '../models/Class';
import { AuthRequest } from '../middleware/auth';

export const takeAttendance = async (req: AuthRequest, res: Response) => {
    try {
        const { classId, date, records } = req.body;
        const teacherId = req.user?.id;
        const organizationId = req.user?.organizationId;

        // Verify class exists and belongs to teacher/org
        const classExists = await Class.findOne({
            _id: classId,
            organizationId,
            teacherIds: teacherId
        });

        if (!classExists) {
            return res.status(404).json({ message: 'Class not found or unauthorized' });
        }

        // Normalize date to start of day to avoid time conflicts
        const attendanceDate = new Date(date);
        attendanceDate.setHours(0, 0, 0, 0);

        // Check if attendance already exists for this date
        let attendance = await Attendance.findOne({
            classId,
            date: attendanceDate
        });

        if (attendance) {
            // Update existing record
            attendance.records = records;
            attendance.takenBy = teacherId as any;
            await attendance.save();
        } else {
            // Create new record
            attendance = new Attendance({
                classId,
                date: attendanceDate,
                records,
                takenBy: teacherId,
                organizationId
            });
            await attendance.save();
        }

        res.status(200).json({ message: 'Attendance saved successfully', attendance });
    } catch (error) {
        console.error('Take attendance error:', error);
        res.status(500).json({ message: 'Error saving attendance' });
    }
};

export const getClassAttendance = async (req: AuthRequest, res: Response) => {
    try {
        const { classId } = req.params;
        const { date } = req.query;

        const query: any = { classId };

        if (date) {
            const attendanceDate = new Date(date as string);
            attendanceDate.setHours(0, 0, 0, 0);
            query.date = attendanceDate;
        }

        const attendance = await Attendance.find(query)
            .populate('takenBy', 'name')
            .sort({ date: -1 });

        res.status(200).json({ attendance });
    } catch (error) {
        console.error('Get class attendance error:', error);
        res.status(500).json({ message: 'Error fetching attendance' });
    }
};

export const getStudentAttendance = async (req: AuthRequest, res: Response) => {
    try {
        const studentId = req.user?.id;

        // Find all attendance records containing this student
        const attendance = await Attendance.find({
            'records.studentId': studentId
        })
            .populate('classId', 'name subject')
            .populate('takenBy', 'name')
            .sort({ date: -1 });

        // Transform data to show only this student's status
        const studentRecords = attendance.map(record => {
            const myRecord = record.records.find(r => r.studentId.toString() === studentId);
            return {
                _id: record._id,
                classId: record.classId,
                date: record.date,
                status: myRecord?.status,
                takenBy: record.takenBy
            };
        });

        res.status(200).json({ attendance: studentRecords });
    } catch (error) {
        console.error('Get student attendance error:', error);
        res.status(500).json({ message: 'Error fetching attendance' });
    }
};
