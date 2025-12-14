import express from 'express';
import { takeAttendance, getClassAttendance, getStudentAttendance } from '../controllers/attendanceController';
import { authenticateToken, authorize } from '../middleware/auth';

const router = express.Router();

// Teacher routes
router.post('/', authenticateToken, authorize(['teacher']), takeAttendance);
router.get('/class/:classId', authenticateToken, authorize(['teacher', 'org_admin']), getClassAttendance);

// Student routes
router.get('/my-attendance', authenticateToken, authorize(['student']), getStudentAttendance);

export default router;
