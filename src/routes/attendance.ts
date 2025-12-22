import express from 'express';
import { takeAttendance, getClassAttendance, getStudentAttendance, getTeacherAttendanceStats } from '../controllers/attendanceController';
import { authenticateToken, authorize } from '../middleware/auth';

const router = express.Router();

// Teacher routes
router.post('/', authenticateToken, authorize(['teacher']), takeAttendance);
router.get('/teacher/stats', authenticateToken, authorize(['teacher']), getTeacherAttendanceStats); // Must be before /class/:classId if path params overlap, but here it's specific enough.
router.get('/class/:classId', authenticateToken, authorize(['teacher', 'org_admin']), getClassAttendance);

// Student routes
router.get('/my-attendance', authenticateToken, authorize(['student']), getStudentAttendance);

export default router;
