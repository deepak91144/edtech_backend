import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Admin from '../models/Admin';
import User from '../models/User';
import Organization from '../models/Organization';
import { generateToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/roleCheck';
import { sendEmail } from '../utils/mail';
import { sendWhatsAppMessage } from '../utils/whatsapp';
import { sendSMS } from '../utils/sms';
import crypto from 'crypto';

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

            // Send login notification email (asynchronous, don't await if failure shouldn't block login)
            sendEmail({
                to: user.email,
                subject: 'Login Notification',
                text: `Hello ${user.name}, you have just logged in to your account. If this wasn't you, please contact support.`,
                html: `<p>Hello <strong>${user.name}</strong>,</p><p>You have just logged in to your account. If this wasn't you, please contact support.</p>`
            }).catch(err => console.error('Failed to send login email:', err));

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

            const { email, password, name, userType, organizationId, phoneNumber } = req.body;

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

                // Send welcome email
                sendEmail({
                    to: admin.email,
                    subject: 'Welcome to EdTech Platform',
                    text: `Hello ${admin.name}, welcome to EdTech Platform as an Admin!`,
                    html: `<p>Hello <strong>${admin.name}</strong>,</p><p>Welcome to EdTech Platform as an Admin!</p>`
                }).catch(err => console.error('Failed to send welcome email:', err));

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
                    phoneNumber,
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

                // Send welcome email
                sendEmail({
                    to: user.email,
                    subject: 'Welcome to EdTech Platform',
                    text: `Hello ${user.name}, welcome to EdTech Platform! Your role is ${userType}.`,
                    html: `<p>Hello <strong>${user.name}</strong>,</p><p>Welcome to EdTech Platform!</p><p>Your role is <strong>${userType}</strong>.</p>`
                }).catch(err => console.error('Failed to send welcome email:', err));

                // Send WhatsApp and SMS Welcome Message
                if (phoneNumber) {
                    const message = `Welcome ${name}! You have been added to the EdTech Platform as a ${userType}. Your login email is ${email}.`;

                    sendWhatsAppMessage(phoneNumber, message)
                        .catch(err => console.error('Failed to send WhatsApp welcome:', err));

                    sendSMS(phoneNumber, message)
                        .catch(err => console.error('Failed to send SMS welcome:', err));
                }


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
                phoneNumber: user.phoneNumber,
                address: user.address,
                guardianName: user.guardianName,
                guardianPhone: user.guardianPhone,
                guardianRelationship: user.guardianRelationship,
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

        const { name, password, phoneNumber, address, guardianName, guardianPhone, guardianRelationship } = req.body;
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

        // Update basic fields
        if (name) user.name = name;
        if (password && password.trim().length > 0) {
            user.password = password; // Will be hashed by pre-save hook
        }

        // Update student-specific fields (only for non-admin users)
        if (req.user.role !== 'admin') {
            if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
            if (address !== undefined) user.address = address;
            if (guardianName !== undefined) user.guardianName = guardianName;
            if (guardianPhone !== undefined) user.guardianPhone = guardianPhone;
            if (guardianRelationship !== undefined) user.guardianRelationship = guardianRelationship;
        }

        await user.save();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: req.user.role,
                phoneNumber: user.phoneNumber,
                address: user.address,
                guardianName: user.guardianName,
                guardianPhone: user.guardianPhone,
                guardianRelationship: user.guardianRelationship,
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
        const user = await User.findById(req.params.id).select('-password').populate('organizationId', 'name');
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
        const { name, email, password, isActive, salary } = req.body;
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
        if (salary !== undefined && user.role === 'teacher') {
            user.salary = salary;
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

// Change password endpoint (requires current password)
router.put('/change-password', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ message: 'Not authenticated' });
            return;
        }

        const { currentPassword, newPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword) {
            res.status(400).json({ message: 'Current password and new password are required' });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({ message: 'New password must be at least 6 characters long' });
            return;
        }

        // Get user with password
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

        // Verify current password
        const isPasswordValid = await user.comparePassword(currentPassword);
        if (!isPasswordValid) {
            res.status(401).json({ message: 'Current password is incorrect' });
            return;
        }

        // Update password
        user.password = newPassword; // Will be hashed by pre-save hook
        await user.save();

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Forgot password - Request password reset
router.post('/forgot-password', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { email } = req.body;

        if (!email) {
            res.status(400).json({ message: 'Email is required' });
            return;
        }

        // Try to find user in both User and Admin collections
        let user: any = await User.findOne({ email });
        let isAdmin = false;

        if (!user) {
            user = await Admin.findOne({ email });
            isAdmin = true;
        }

        // Always return success for security (don't reveal if email exists)
        if (!user) {
            res.json({
                success: true,
                message: 'If an account with that email exists, a password reset link has been sent.'
            });
            return;
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');

        // Hash token before saving to database
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Token expires in 1 hour
        const expires = new Date(Date.now() + 60 * 60 * 1000);

        // Save hashed token to user
        user.resetPasswordToken = hashedToken;
        user.resetPasswordExpires = expires;
        await user.save();
        // Create reset URL (use frontend URL from environment or default)
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

        // Send reset email
        console.log(`[DEBUG] Sending password reset email to: ${user.email} (role: ${user.role || 'admin'})`);
        try {
            await sendEmail({
                to: user.email,
                subject: 'Password Reset Request',
                text: `You requested a password reset. Click the link below to reset your password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2>Password Reset Request</h2>
                        <p>You requested a password reset for your account.</p>
                        <p>Click the button below to reset your password:</p>
                        <div style="margin: 30px 0;">
                            <a href="${resetUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset Password</a>
                        </div>
                        <p>Or copy and paste this link into your browser:</p>
                        <p style="color: #666; word-break: break-all;">${resetUrl}</p>
                        <p style="color: #999; font-size: 14px; margin-top: 30px;">
                            <strong>This link will expire in 1 hour.</strong><br/>
                            If you didn't request this password reset, please ignore this email.
                        </p>
                    </div>
                `
            });
            console.log(`[DEBUG] Password reset email sent successfully to: ${user.email}`);
        } catch (emailError) {
            console.error(`[ERROR] Failed to send password reset email to ${user.email}:`, emailError);
            // Don't throw error to avoid revealing if email exists
        }

        res.json({
            success: true,
            message: 'If an account with that email exists, a password reset link has been sent.'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// Reset password with token
router.post('/reset-password', async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            res.status(400).json({ message: 'Token and new password are required' });
            return;
        }

        if (newPassword.length < 6) {
            res.status(400).json({ message: 'Password must be at least 6 characters long' });
            return;
        }

        // Hash the token from URL to compare with database
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Try to find user with valid token in User collection
        let user: any = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        let isAdmin = false;

        // If not found in User, try Admin collection
        if (!user) {
            user = await Admin.findOne({
                resetPasswordToken: hashedToken,
                resetPasswordExpires: { $gt: Date.now() }
            });
            isAdmin = true;
        }

        if (!user) {
            res.status(400).json({ message: 'Invalid or expired reset token' });
            return;
        }

        // Update password
        user.password = newPassword; // Will be hashed by pre-save hook
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        // Send confirmation email
        await sendEmail({
            to: user.email,
            subject: 'Password Reset Successful',
            text: `Your password has been successfully reset. You can now log in with your new password.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2>Password Reset Successful</h2>
                    <p>Your password has been successfully changed.</p>
                    <p>You can now log in with your new password.</p>
                    <p style="color: #999; font-size: 14px; margin-top: 30px;">
                        If you didn't make this change, please contact support immediately.
                    </p>
                </div>
            `
        }).catch(err => console.error('Failed to send password reset confirmation email:', err));

        res.json({
            success: true,
            message: 'Password has been reset successfully. You can now log in with your new password.'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
