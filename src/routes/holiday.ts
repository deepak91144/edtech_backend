
import express from 'express';
import { getHolidays, createHoliday, deleteHoliday } from '../controllers/holidayController';
import { authorize } from '../middleware/auth';

const router = express.Router();

// Organization Admin routes
router.get('/', authorize(['org_admin']), getHolidays);
router.post('/', authorize(['org_admin']), createHoliday);
router.delete('/:id', authorize(['org_admin']), deleteHoliday);

export default router;
