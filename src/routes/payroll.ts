import express from 'express';
import { getPayrollHistory, createPayment, getTeacherPayroll } from '../controllers/payrollController';
import { authenticateToken, authorize } from '../middleware/auth';

const router = express.Router();

// Get all payroll history for an organization
router.get('/organizations/:organizationId/payroll', authenticateToken, authorize(['org_admin']), getPayrollHistory);

// Record a new payment
router.post('/organizations/:organizationId/payroll', authenticateToken, authorize(['org_admin']), createPayment);

// Get specific teacher's payroll history
router.get('/teachers/:teacherId/payroll', authenticateToken, getTeacherPayroll);

export default router;
