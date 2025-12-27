import { Request, Response } from 'express';
import Payroll from '../models/Payroll';
import User from '../models/User';
import { AuthRequest } from '../middleware/auth';

export const getPayrollHistory = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { organizationId } = req.params;
        const payrolls = await Payroll.find({ organizationId })
            .populate('teacherId', 'name email salary')
            .sort({ paymentDate: -1 });

        res.json({ payrolls });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching payroll history', error });
    }
};

export const createPayment = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { organizationId } = req.params;
        const { teacherId, amount, month, notes, paymentDate } = req.body;

        const existingPayment = await Payroll.findOne({
            organizationId,
            teacherId,
            month
        });

        if (existingPayment) {
            res.status(400).json({ message: `Payment already exists for ${month}` });
            return;
        }

        const payroll = new Payroll({
            organizationId,
            teacherId,
            amount,
            month,
            notes,
            status: 'Paid',
            paymentDate: paymentDate ? new Date(paymentDate) : new Date()
        });

        await payroll.save();
        res.status(201).json({ message: 'Payment recorded successfully', payroll });
    } catch (error) {
        res.status(500).json({ message: 'Error recording payment', error });
    }
};

export const getTeacherPayroll = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { teacherId } = req.params;
        const payrolls = await Payroll.find({ teacherId })
            .sort({ paymentDate: -1 });

        res.json({ payrolls });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching teacher payroll', error });
    }
};
