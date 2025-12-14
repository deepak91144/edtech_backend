import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Organization from '../models/Organization';
import User from '../models/User';
import Class from '../models/Class';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';

const router = Router();

// Middleware to check if user belongs to the organization
const checkOrganizationAccess = async (req: AuthRequest, res: Response, next: Function) => {
    try {
        const orgId = req.params.id;

        // Admin has access to all organizations
        if (req.user?.role === 'admin') {
            return next();
        }

        // Check if user belongs to this organization
        if (req.user?.organizationId !== orgId) {
            res.status(403).json({ message: 'Access denied to this organization' });
            return;
        }

        next();
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};

// Get all classes in an organization
router.get('/:id/classes', requireRole('admin', 'org_admin', 'teacher'), checkOrganizationAccess, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const classes = await Class.find({ organizationId: req.params.id })
            .populate('teacherIds', 'name email')
            .populate('studentIds', 'name email')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: classes.length,
            classes
        });
    } catch (error) {
        console.error('Get classes error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Create a class
router.post('/:id/classes',
    requireRole('admin', 'org_admin'),
    checkOrganizationAccess,
    [
        body('name').notEmpty().withMessage('Class name is required')
    ],
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { name, teacherIds, studentIds } = req.body;

            // Verify organization exists
            const organization = await Organization.findById(req.params.id);
            if (!organization) {
                res.status(404).json({ message: 'Organization not found' });
                return;
            }

            const newClass = new Class({
                name,
                organizationId: req.params.id,
                teacherIds: teacherIds || [],
                studentIds: studentIds || []
            });

            await newClass.save();

            const populatedClass = await Class.findById(newClass._id)
                .populate('teacherIds', 'name email')
                .populate('studentIds', 'name email');

            res.status(201).json({
                success: true,
                message: 'Class created successfully',
                class: populatedClass
            });
        } catch (error) {
            console.error('Create class error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Update a class
router.put('/:id/classes/:classId',
    requireRole('admin', 'org_admin'),
    checkOrganizationAccess,
    [
        body('name').optional().notEmpty().withMessage('Class name cannot be empty')
    ],
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { name, teacherIds, studentIds } = req.body;
            const updateData: any = {};

            if (name) updateData.name = name;
            if (teacherIds) updateData.teacherIds = teacherIds;
            if (studentIds) updateData.studentIds = studentIds;

            const updatedClass = await Class.findOneAndUpdate(
                { _id: req.params.classId, organizationId: req.params.id },
                updateData,
                { new: true, runValidators: true }
            )
                .populate('teacherIds', 'name email')
                .populate('studentIds', 'name email');

            if (!updatedClass) {
                res.status(404).json({ message: 'Class not found' });
                return;
            }

            res.json({
                success: true,
                message: 'Class updated successfully',
                class: updatedClass
            });
        } catch (error) {
            console.error('Update class error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Delete a class
router.delete('/:id/classes/:classId', requireRole('admin', 'org_admin'), checkOrganizationAccess, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const deletedClass = await Class.findOneAndDelete({
            _id: req.params.classId,
            organizationId: req.params.id
        });

        if (!deletedClass) {
            res.status(404).json({ message: 'Class not found' });
            return;
        }

        res.json({
            success: true,
            message: 'Class deleted successfully'
        });
    } catch (error) {
        console.error('Delete class error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all users (teachers and students) in an organization
router.get('/:id/users', requireRole('admin', 'org_admin', 'teacher'), checkOrganizationAccess, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { role } = req.query;
        const filter: any = { organizationId: req.params.id };

        if (role && (role === 'teacher' || role === 'student')) {
            filter.role = role;
        }

        const users = await User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: users.length,
            users
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add a user (teacher or student) to organization
router.post('/:id/users',
    requireRole('admin', 'org_admin'),
    checkOrganizationAccess,
    [
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('name').notEmpty().withMessage('Name is required'),
        body('role').isIn(['teacher', 'student']).withMessage('Role must be teacher or student')
    ],
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { email, password, name, role } = req.body;

            // Verify organization exists
            const organization = await Organization.findById(req.params.id);
            if (!organization) {
                res.status(404).json({ message: 'Organization not found' });
                return;
            }

            // Check if user already exists
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                res.status(400).json({ message: 'User with this email already exists' });
                return;
            }

            const user = new User({
                email,
                password,
                name,
                role,
                organizationId: req.params.id
            });

            await user.save();

            const userResponse: any = user.toObject();
            delete userResponse.password;

            res.status(201).json({
                success: true,
                message: `${role} added successfully`,
                user: userResponse
            });
        } catch (error) {
            console.error('Add user error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Update a user
router.put('/:id/users/:userId',
    requireRole('admin', 'org_admin'),
    checkOrganizationAccess,
    [
        body('email').optional().isEmail().withMessage('Valid email is required'),
        body('name').optional().notEmpty().withMessage('Name cannot be empty'),
        body('role').optional().isIn(['teacher', 'student']).withMessage('Role must be teacher or student')
    ],
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { email, name, role, password } = req.body;
            const updateData: any = {};

            if (email) updateData.email = email;
            if (name) updateData.name = name;
            if (role) updateData.role = role;
            if (password) {
                // Password will be hashed by the pre-save hook
                const user = await User.findOne({ _id: req.params.userId, organizationId: req.params.id });
                if (user) {
                    user.password = password;
                    await user.save();
                    res.json({
                        success: true,
                        message: 'User updated successfully',
                        user: { ...user.toObject(), password: undefined }
                    });
                    return;
                }
            }

            const updatedUser = await User.findOneAndUpdate(
                { _id: req.params.userId, organizationId: req.params.id },
                updateData,
                { new: true, runValidators: true }
            ).select('-password');

            if (!updatedUser) {
                res.status(404).json({ message: 'User not found' });
                return;
            }

            res.json({
                success: true,
                message: 'User updated successfully',
                user: updatedUser
            });
        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({ message: 'Server error' });
        }
    }
);

// Delete a user
router.delete('/:id/users/:userId', requireRole('admin', 'org_admin'), checkOrganizationAccess, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = await User.findOneAndDelete({
            _id: req.params.userId,
            organizationId: req.params.id
        });

        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        // Remove user from all classes
        await Class.updateMany(
            { organizationId: req.params.id },
            {
                $pull: {
                    teacherIds: req.params.userId,
                    studentIds: req.params.userId
                }
            }
        );

        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
