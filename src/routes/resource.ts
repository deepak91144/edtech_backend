import express from 'express';
import multer from 'multer';
import path from 'path';
import { createResource, getResourcesByClass, deleteResource, getResourcesByTeacher, getResourcesByStudent } from '../controllers/resourceController';
import { authorize } from '../middleware/auth';

const router = express.Router();

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage: storage });

// Routes
router.post('/', authorize(['teacher']), upload.array('files', 10), createResource);
router.get('/teacher', authorize(['teacher']), getResourcesByTeacher);
router.get('/student', authorize(['student']), getResourcesByStudent);
router.get('/class/:classId', authorize(['teacher', 'student']), getResourcesByClass);
router.delete('/:id', authorize(['teacher']), deleteResource);

export default router;
