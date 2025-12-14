import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Admin from '../models/Admin';
import User from '../models/User';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Login route for all user types
router.post('/login',
    [
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').notEmpty().withMessage('Password is required'),
        body('userType').isIn(['admin', 'teacher', 'student', 'org_admin']).withMessage('Valid user type is required')
    ],
    async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                res.status(400).json({ errors: errors.array() });
                return;
            }

            const { email, password, userType } = req.body;

            let user: any;
            let role: 'admin' | 'teacher' | 'student' | 'org_admin';

            if (userType === 'admin') {
                user = await Admin.findOne({ email });
                role = 'admin';
            } else {
                user = await User.findOne({ email, role: userType });
                role = userType;
            }

            if (!user) {
                res.status(401).json({ message: 'Invalid credentials' });
                return;
            }

            const isPasswordValid = await user.comparePassword(password);
            if (!isPasswordValid) {
                res.status(401).json({ message: 'Invalid credentials' });
                return;
            }

            const tokenPayload = {
                id: user._id.toString(),
                role,
                ...(role !== 'admin' && { organizationId: user.organizationId?.toString() })
            };

            const token = generateToken(tokenPayload);
            const refreshToken = generateRefreshToken(tokenPayload);

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

                res.status(201).json({
                    success: true,
                    message: 'Admin registered successfully',
                    user: {
                        id: admin._id,
                        email: admin.email,
                        name: admin.name,
                        role: 'admin'
                    }
                });
            } else {
                if (!organizationId) {
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
                    organizationId
                });
                await user.save();

                res.status(201).json({
                    success: true,
                    message: `${userType} registered successfully`,
                    user: {
                        id: user._id,
                        email: user.email,
                        name: user.name,
                        role: user.role,
                        organizationId: user.organizationId
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
router.get('/me', async (req: AuthRequest, res: Response): Promise<void> => {
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

        res.json({
            success: true,
            user: {
                id: user._id,
                email: user.email,
                name: user.name,
                role: req.user.role,
                ...(req.user.role !== 'admin' && { organization: user.organizationId })
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
