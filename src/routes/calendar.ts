import express from 'express';
import { getStudentEvents, getTeacherEvents } from '../controllers/calendarController';
import { authorize } from '../middleware/auth';

const router = express.Router();

// Get aggregated events for a student
console.log('Registering /student route in calendar router');
router.get('/student', authorize(['student']), getStudentEvents);

// /api/calendar/teacher
router.get('/teacher', authorize(['teacher', 'admin', 'org_admin']), getTeacherEvents);

export default router;
