import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Admin from '../models/Admin';
import User from '../models/User';
import Organization from '../models/Organization';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';

const router = Router();

// Login route for all user types
router.post('/login',
    [
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').notEmpty().withMessage('Password is required')
    ],
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { email, password } = req.body;

            let user: any;
            let role: 'admin' | 'teacher' | 'student' | 'org_admin' | null = null;

            // First check if it's a regular user (Teacher, Student, Org Admin)
            user = await User.findOne({ email });

            if (user) {
                role = user.role;
            } else {
                // If not found, check if it's a platform admin
                user = await Admin.findOne({ email });
                if (user) {
                    role = 'admin';
                }
            }

            if (!user || !role) {
                res.status(401).json({ message: 'Invalid credentials' });
                return;
            }

            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                res.status(401).json({ message: 'Invalid credentials' });
                return;
            }

            if (user.isActive === false) {
                res.status(403).json({ message: 'Your account has been deactivated. Please contact your administrator.' });
                return;
            }

            // Create JWT token
            const payload = {
                id: user._id.toString(),
                role,
                ...(role !== 'admin' && { organizationId: user.organizationId?.toString() })
            };

            const token = generateToken(payload);
            const refreshToken = generateRefreshToken(payload);

            res.json({
                success: true,
                token,
                refreshToken,
                user: {
                    id: user._id,
                    email: user.email,
                    name: user.name,
                    role,
                    ...(role !== 'admin' && { organizationId: user.organizationId })
                }
            });
        } catch (error: any) {
            console.error('Login error:', error);
            res.status(500).json({ message: 'Server error during login' });
        }
    }
);

// Register route (for creating initial admin or adding users)
router.post('/register',
    [
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('name').notEmpty().withMessage('Name is required'),
        body('userType').isIn(['admin', 'teacher', 'student', 'org_admin']).withMessage('Valid user type is required')
    ],
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { email, password, name, userType, organizationId } = req.body;

            // Check if user already exists
            if (userType === 'admin') {
                const existingAdmin = await Admin.findOne({ email });
                if (existingAdmin) {
                    res.status(400).json({ message: 'Admin with this email already exists' });
                    return;
                }

                const admin = new Admin({ email, password, name });
                await admin.save();

                const tokenPayload = {
                    id: admin._id.toString(),
                    role: 'admin' as const
                };

                const token = generateToken(tokenPayload);
                const refreshToken = generateRefreshToken(tokenPayload);

                res.status(201).json({
                    success: true,
                    message: 'Admin registered successfully',
                    token,
                    refreshToken,
                    user: {
                        id: admin._id,
                        email: admin.email,
                        name: admin.name,
                        role: 'admin'
                    }
                });
            } else {
                // For teachers and students, organizationId is required
                // For org_admin, organizationId is optional (they'll create it later)
                if ((userType === 'teacher' || userType === 'student') && !organizationId) {
                    res.status(400).json({ message: 'Organization ID is required for teachers and students' });
                    return;
                }

                const existingUser = await User.findOne({ email });
                if (existingUser) {
                    res.status(400).json({ message: 'User with this email already exists' });
                    return;
                }

                const user = new User({
                    email,
                    password,
                    name,
                    role: userType,
                    ...(organizationId && { organizationId })
                });
                await user.save();

                const tokenPayload = {
                    id: user._id.toString(),
                    role: userType,
                    ...(user.organizationId && { organizationId: user.organizationId.toString() })
                };

                const token = generateToken(tokenPayload);
                const refreshToken = generateRefreshToken(tokenPayload);

                res.status(201).json({
                    success: true,
                    message: `${userType} registered successfully`,
                    token,
                    refreshToken,
                    user: {
                        id: user._id,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        ...(user.organizationId && { organizationId: user.organizationId })
                    }
                });
            }
        } catch (error: any) {
            console.error('Registration error:', error);
            res.status(500).json({ message: 'Server error during registration' });
        }
    }
);

// Refresh token route
router.post('/refresh', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            res.status(400).json({ message: 'Refresh token is required' });
            return;
        }

        const decoded = verifyRefreshToken(refreshToken);
        const newToken = generateToken({
            id: decoded.id,
            role: decoded.role,
            organizationId: decoded.organizationId
        });

        res.json({
            success: true,
            token: newToken
        });
    } catch (error) {
        res.status(403).json({ message: 'Invalid refresh token' });
    }
});

// Get current user info
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }

        let user: any;
        if (req.user.role === 'admin') {
            user = await Admin.findById(req.user.id).select('-password');
        } else {
            user = await User.findById(req.user.id).select('-password').populate('organizationId', 'name type');
        }

        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        let organizationName = undefined;
        if (req.user.role !== 'admin') {
            if (user.organizationId && (user.organizationId as any).name) {
                organizationName = (user.organizationId as any).name;
            } else if (user.organizationId) {
                // Fallback: it might be an ID if populate failed or wasn't fully effective
                const org = await Organization.findById(user.organizationId);
                if (org) organizationName = org.name;
            }
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: req.user.role,
                organizationName,
                ...(req.user.role !== 'admin' && { organization: user.organizationId })
            }
        });
    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update current user profile
router.put('/profile', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }

        const { name, password } = req.body;
        let user: any;

        if (req.user.role === 'admin') {
            user = await Admin.findById(req.user.id);
        } else {
            user = await User.findById(req.user.id);
        }

        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        if (name) user.name = name;
        if (password && password.trim().length > 0) {
            user.password = password; // Will be hashed by pre-save hook
        }

        await user.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: req.user.role
            }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user details (admin/org_admin only)
router.get('/users/:id', authenticateToken, requireRole('admin', 'org_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        // Check organization access for org_admin
        if (req.user?.role === 'org_admin') {
            if (user.role === 'org_admin') {
                // Prevent org_admin from viewing other org_admins
                res.status(403).json({ message: 'Access denied' });
                return;
            }

            // Check if the org_admin owns the organization that this user belongs to
            if (user.organizationId) {
                const organization = await Organization.findById(user.organizationId);
                if (!organization || organization.adminId.toString() !== req.user.id) {
                    res.status(403).json({ message: 'Access denied' });
                    return;
                }
            }
        }

        res.json({ success: true, user });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user details (admin/org_admin only)
router.put('/users/:id', authenticateToken, requireRole('admin', 'org_admin'), async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        console.log('Update User Request Body:', req.body);
        const { name, email, password, isActive } = req.body;
        console.log('Extracted isActive:', isActive, 'Type:', typeof isActive);

        let user = await User.findById(req.params.id);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }

        // Check organization access
        if (req.user?.role === 'org_admin') {
            // Prevent modifying other org_admins
            if (user.role === 'org_admin') {
                res.status(403).json({ message: 'Cannot modify administrator accounts' });
                return;
            }

            // Check if the org_admin owns the organization that this user belongs to
            if (user.organizationId) {
                const organization = await Organization.findById(user.organizationId);
                if (!organization || organization.adminId.toString() !== req.user.id) {
                    res.status(403).json({ message: 'Access denied' });
                    return;
                }
            }
        }

        // Update fields
        if (name) user.name = name;
        if (email) user.email = email;
        if (password && password.trim().length > 0) {
            user.password = password; // Will be hashed by pre-save hook
        }

        // Handle isActive specifically
        if (isActive !== undefined) {
            console.log('Updating isActive to:', isActive);
            user.isActive = isActive;
        } else if (typeof isActive === 'boolean') {
            // Fallback for strict boolean check if undefined check passes (redundant but safe)
            user.isActive = isActive;
        }

        await user.save();

        res.json({
            success: true,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isActive: user.isActive
            }
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
