import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Organization from '../models/Organization';
import User from '../models/User';
import Class from '../models/Class';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';

const router = Router();

// All routes require admin or org_admin authentication
router.use(requireRole('admin', 'org_admin'));

// Get all organizations
router.get('/organizations', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        let query = {};
        if (req.user?.role === 'org_admin') {
            query = { _id: req.user.organizationId };
        }

        const organizations = await Organization.find(query)
            .select('name type createdAt updatedAt')
            .sort({ createdAt: -1 });

        // Get counts for each organization
        const organizationsWithCounts = await Promise.all(
            organizations.map(async (org) => {
                const teacherCount = await User.countDocuments({ organizationId: org._id, role: 'teacher' });
                const studentCount = await User.countDocuments({ organizationId: org._id, role: 'student' });
                const classCount = await Class.countDocuments({ organizationId: org._id });

                return {
                    ...org.toObject(),
                    stats: {
                        teachers: teacherCount,
                        students: studentCount,
                        classes: classCount
                    }
                };
            })
        );

        res.json({
            success: true,
            count: organizations.length,
            organizations: organizationsWithCounts
        });
    } catch (error) {
        console.error('Get organizations error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single organization
router.get('/organizations/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const organization = await Organization.findById(req.params.id);

        if (!organization) {
            res.status(404).json({ message: 'Organization not found' });
            return;
        }

        const teacherCount = await User.countDocuments({ organizationId: organization._id, role: 'teacher' });
        const studentCount = await User.countDocuments({ organizationId: organization._id, role: 'student' });
        const classCount = await Class.countDocuments({ organizationId: organization._id });

        res.json({
            success: true,
            organization: {
                ...organization.toObject(),
                stats: {
                    teachers: teacherCount,
                    students: studentCount,
                    classes: classCount
                }
            }
        });
    } catch (error) {
        console.error('Get organization error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create organization
router.post('/organizations',
    [
        body('name').notEmpty().withMessage('Organization name is required'),
        body('type').isIn(['school', 'college', 'university']).withMessage('Valid organization type is required'),
        body('adminName').notEmpty().withMessage('Admin name is required'),
        body('adminEmail').isEmail().withMessage('Valid admin email is required'),
        body('adminPassword').isLength({ min: 6 }).withMessage('Admin password must be at least 6 characters')
    ],
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { name, type, adminName, adminEmail, adminPassword } = req.body;

            // Check if user already exists
            const existingUser = await User.findOne({ email: adminEmail });
            if (existingUser) {
                res.status(400).json({ message: 'User with this email already exists' });
                return;
            }

            // 1. Create Organization (temporarily with current admin's ID or a placeholder)
            // We need a valid ID for the user creation, so we create org first
            const organization = new Organization({
                name,
                type,
                adminId: req.user!.id // Temporary, will update later
            });

            await organization.save();

            // 2. Create Organization Admin User
            const orgAdmin = new User({
                email: adminEmail,
                password: adminPassword,
                name: adminName,
                role: 'org_admin',
                organizationId: organization._id
            });

            await orgAdmin.save();

            // 3. Update Organization with the new admin's ID
            organization.adminId = orgAdmin._id as any;
            await organization.save();

            res.status(201).json({
                success: true,
                message: 'Organization and admin created successfully',
                organization
            });
        } catch (error) {
            console.error('Create organization error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Update organization
router.put('/organizations/:id',
    [
        body('name').optional().notEmpty().withMessage('Organization name cannot be empty'),
        body('type').optional().isIn(['school', 'college', 'university']).withMessage('Valid organization type is required')
    ],
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { name, type } = req.body;
            const updateData: any = {};

            if (name) updateData.name = name;
            if (type) updateData.type = type;
            updateData.updatedAt = new Date();

            const organization = await Organization.findByIdAndUpdate(
                req.params.id,
                updateData,
                { new: true, runValidators: true }
            );

            if (!organization) {
                res.status(404).json({ message: 'Organization not found' });
                return;
            }

            res.json({
                success: true,
                message: 'Organization updated successfully',
                organization
            });
        } catch (error) {
            console.error('Update organization error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Delete organization
router.delete('/organizations/:id', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const organization = await Organization.findById(req.params.id);

        if (!organization) {
            res.status(404).json({ message: 'Organization not found' });
            return;
        }

        // Delete all related data
        await User.deleteMany({ organizationId: organization._id });
        await Class.deleteMany({ organizationId: organization._id });
        await organization.deleteOne();

        res.json({
            success: true,
            message: 'Organization and all related data deleted successfully'
        });
    } catch (error) {
        console.error('Delete organization error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get dashboard statistics
router.get('/stats', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        let orgQuery = {};
        let userQuery: any = { role: 'teacher' };
        let studentQuery: any = { role: 'student' };
        let classQuery: any = {};

        if (req.user?.role === 'org_admin') {
            orgQuery = { _id: req.user.organizationId };
            userQuery.organizationId = req.user.organizationId;
            studentQuery.organizationId = req.user.organizationId;
            classQuery.organizationId = req.user.organizationId;
        }

        const totalOrganizations = await Organization.countDocuments(orgQuery);
        const totalTeachers = await User.countDocuments(userQuery);
        const totalStudents = await User.countDocuments(studentQuery);
        const totalClasses = await Class.countDocuments(classQuery);

        // Get organization breakdown (only relevant for platform admin, but safe to run with filter)
        const organizationsByType = await Organization.aggregate([
            { $match: orgQuery },
            {
                $group: {
                    _id: '$type',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            success: true,
            stats: {
                totalOrganizations,
                totalTeachers,
                totalStudents,
                totalClasses,
                organizationsByType: organizationsByType.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {} as Record<string, number>)
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
