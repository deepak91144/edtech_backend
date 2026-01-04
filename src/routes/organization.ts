import { Router, Response } from 'express';
import mongoose from 'mongoose';
import { body, validationResult } from 'express-validator';
import Organization from '../models/Organization';
import User from '../models/User';
import Class from '../models/Class';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { authorize } from '../middleware/auth';
import { sendEmail } from '../utils/mail';
import { checkStudentConflicts } from '../utils/validation';

const router = Router();

// Get organizations managed by the current user (admin/org_admin)
router.get('/managed', authorize(['admin', 'org_admin']), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const role = req.user?.role;

        let query: any = {};

        if (role === 'org_admin') {
            query = { adminId: userId };
        }
        // Admin sees all? Or we can just return all for now if needed, 
        // but typically 'managed' implies ownership. 
        // If system admin, maybe they want to see all to help manage.
        // For now, let's stick to returning what they "own" or are admin of.
        // If role is 'admin' (superuser), maybe return all.
        if (role === 'admin') {
            query = {};
        }

        const organizations = await Organization.find(query)
            .select('name _id type')
            .sort({ name: 1 });

        res.json({
            success: true,
            count: organizations.length,
            organizations
        });
    } catch (error) {
        console.error('Get managed organizations error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Middleware to check if user belongs to the organization
const checkOrganizationAccess = async (req: AuthRequest, res: Response, next: Function) => {
    try {
        const orgId = req.params.id;

        // Admin has access to all organizations
        if (req.user?.role === 'admin') {
            return next();
        }

        // For org_admin, check if they own this organization
        if (req.user?.role === 'org_admin') {
            const organization = await Organization.findById(orgId);
            if (!organization) {
                res.status(404).json({ message: 'Organization not found' });
                return;
            }

            // Check if the org_admin is the owner of this organization
            if (organization.adminId.toString() === req.user.id) {
                return next();
            }

            res.status(403).json({ message: 'Access denied to this organization' });
            return;
        }

        // For teachers and students, check organizationId from token
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

            // Check for student conflicts
            if (studentIds && Array.isArray(studentIds)) {
                const conflictError = await checkStudentConflicts(studentIds);
                if (conflictError) {
                    res.status(400).json({ message: conflictError });
                    return;
                }
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
            if (studentIds) {
                const conflictError = await checkStudentConflicts(studentIds, req.params.classId);
                if (conflictError) {
                    res.status(400).json({ message: conflictError });
                    return;
                }
                updateData.studentIds = studentIds;
            }

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

        // Fetch classes for this organization to add class information to students
        const classes = await Class.find({ organizationId: req.params.id });

        // Add class information to users
        const usersWithClasses = users.map(user => {
            const userObj: any = user.toObject();

            // Find classes that include this user
            if (userObj.role === 'student') {
                const userClasses = classes.filter(cls =>
                    cls.studentIds.some(studentId => studentId.toString() === user._id.toString())
                );
                userObj.classes = userClasses.map(cls => ({
                    _id: cls._id,
                    name: cls.name
                }));
            } else if (userObj.role === 'teacher') {
                const userClasses = classes.filter(cls =>
                    cls.teacherIds.some(teacherId => teacherId.toString() === user._id.toString())
                );
                userObj.classes = userClasses.map(cls => ({
                    _id: cls._id,
                    name: cls.name
                }));
            }

            return userObj;
        });

        res.json({
            success: true,
            count: usersWithClasses.length,
            users: usersWithClasses
        });
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all teachers in an organization (Dedicated endpoint for simpler frontend consumption)
router.get('/:id/teachers', requireRole('admin', 'org_admin'), checkOrganizationAccess, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const teachers = await User.find({
            organizationId: req.params.id,
            role: 'teacher'
        })
            .select('-password')
            .sort({ name: 1 });

        const teachersWithPayment = await Promise.all(teachers.map(async (teacher) => {
            const lastPayment = await mongoose.model('Payroll').findOne({
                teacherId: teacher._id,
                organizationId: req.params.id,
                status: 'Paid'
            }).sort({ paymentDate: -1 });

            return {
                ...teacher.toObject(),
                lastPaymentDate: lastPayment ? lastPayment.paymentDate : null
            };
        }));

        res.json({
            success: true,
            count: teachersWithPayment.length,
            teachers: teachersWithPayment
        });
    } catch (error) {
        console.error('Get teachers error:', error);
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

            const { email, password, name, role, phoneNumber, address, guardianName, guardianPhone, guardianRelationship, salary } = req.body;

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
                organizationId: req.params.id,
                phoneNumber,
                address,
                guardianName,
                guardianPhone,
                guardianRelationship,
                salary: role === 'teacher' ? salary : undefined
            });

            await user.save();

            // Send welcome email to the newly added user
            const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;

            sendEmail({
                to: user.email,
                subject: `Welcome to ${organization.name}`,
                text: `Hello ${user.name},\n\nYou have been added as a ${role} to ${organization.name}.\n\nYour login credentials are:\nEmail: ${user.email}\nPassword: ${password}\n\nLogin URL: ${loginUrl}\n\nPlease login and change your password as soon as possible.`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Welcome to ${organization.name}!</h2>
                        <p>Hello <strong>${user.name}</strong>,</p>
                        <p>You have been added as a <strong>${role}</strong> to <strong>${organization.name}</strong>.</p>
                        
                        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="margin-top: 0;">Your Login Credentials</h3>
                            <p style="margin: 10px 0;"><strong>Email:</strong> ${user.email}</p>
                            <p style="margin: 10px 0;"><strong>Password:</strong> ${password}</p>
                        </div>
                        
                        <div style="margin: 30px 0;">
                            <a href="${loginUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                                Login to Your Account
                            </a>
                        </div>
                        
                        <p>Or copy and paste this link into your browser:</p>
                        <p style="color: #666; word-break: break-all;">${loginUrl}</p>
                        
                        <p style="color: #999; font-size: 14px; margin-top: 30px;">
                            <strong>Important:</strong> Please login and change your password as soon as possible for security.
                        </p>
                    </div>
                `
            }).catch(err => console.error('Failed to send welcome email to added user:', err));


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

            const { email, name, role, password, phoneNumber, address, guardianName, guardianPhone, guardianRelationship } = req.body;
            const updateData: any = {};

            if (email) updateData.email = email;
            if (name) updateData.name = name;
            if (role) updateData.role = role;
            if (phoneNumber) updateData.phoneNumber = phoneNumber;
            if (address) updateData.address = address;
            if (guardianName) updateData.guardianName = guardianName;
            if (guardianPhone) updateData.guardianPhone = guardianPhone;
            if (guardianRelationship) updateData.guardianRelationship = guardianRelationship;
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
