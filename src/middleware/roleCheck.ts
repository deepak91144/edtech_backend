import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

export const requireRole = (...allowedRoles: Array<'admin' | 'teacher' | 'student' | 'org_admin'>) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({
                message: 'Access denied. Insufficient permissions.',
                requiredRoles: allowedRoles,
                yourRole: req.user.role
            });
            return;
        }

        next();
    };
};

export const requireAdmin = requireRole('admin');
