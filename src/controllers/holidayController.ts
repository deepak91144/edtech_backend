
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import Holiday from '../models/Holiday';
import Organization from '../models/Organization';

// Get all holidays for the logged-in admin's organizations
export const getHolidays = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const adminId = req.user?.id;

        // Find all organizations managed by this admin
        const organizations = await Organization.find({ adminId }).select('_id');
        const orgIds = organizations.map(org => org._id);

        const holidays = await Holiday.find({ organizationId: { $in: orgIds } })
            .populate('organizationId', 'name')
            .sort({ date: 1 });

        res.json({
            success: true,
            holidays
        });
    } catch (error) {
        console.error('Get holidays error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Create a new holiday
export const createHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { title, date, description, organizationId } = req.body;
        const adminId = req.user?.id;

        // Verify the user manages this organization
        const organization = await Organization.findOne({
            _id: organizationId,
            adminId: adminId
        });

        // Allow super admin to create for any org? For now assuming org_admin flow.

        if (!organization) {
            res.status(403).json({ message: 'You are not authorized to create holidays for this organization' });
            return;
        }

        const holiday = new Holiday({
            title,
            date,
            description,
            organizationId: organization._id
        });

        await holiday.save();

        res.status(201).json({
            success: true,
            message: 'Holiday created successfully',
            holiday
        });
    } catch (error) {
        console.error('Create holiday error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// Delete a holiday
export const deleteHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const adminId = req.user?.id;

        const organization = await Organization.findOne({ adminId });

        if (!organization) {
            res.status(404).json({ message: 'Organization not found' });
            return;
        }

        const holiday = await Holiday.findOneAndDelete({
            _id: id,
            organizationId: organization._id
        });

        if (!holiday) {
            res.status(404).json({ message: 'Holiday not found' });
            return;
        }

        res.json({
            success: true,
            message: 'Holiday deleted successfully'
        });
    } catch (error) {
        console.error('Delete holiday error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
