import express from 'express';
import { getNotes, createNote, updateNote, deleteNote } from '../controllers/notesController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.use(authenticateToken); // All routes are protected

router.route('/')
    .get(getNotes)
    .post(createNote);

router.route('/:id')
    .put(updateNote)
    .delete(deleteNote);

export default router;
