
import express from 'express';
import {
    createAssessment,
    getAssessments,
    getTeacherAssessments,
    updateAssessment,
    getAssessmentById,
    submitAssessment,
    getSubmissions,
    gradeSubmission,
    getMySubmission,
    getAllMySubmissions
} from '../controllers/assessmentController';
import { authorize } from '../middleware/auth';

const router = express.Router();

// Teacher routes
router.post('/', authorize(['teacher']), createAssessment);
router.get('/teacher/my-assessments', authorize(['teacher']), getTeacherAssessments);
router.put('/:id', authorize(['teacher']), updateAssessment);
router.get('/class/:classId', getAssessments); // Both can access, filtered in controller
router.get('/:id/submissions', authorize(['teacher']), getSubmissions);
router.put('/submission/:submissionId/grade', authorize(['teacher']), gradeSubmission);

// Shared/Student routes
router.get('/:id', getAssessmentById);
router.get('/student/my-submissions', authorize(['student']), getAllMySubmissions);
router.get('/:id/my-submission', authorize(['student']), getMySubmission);
router.post('/:id/submit', authorize(['student']), submitAssessment);

export default router;
