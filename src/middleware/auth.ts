import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
    user?: {
        id: string;
        role: 'admin' | 'teacher' | 'student' | 'org_admin';
        organizationId?: string;
    };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        res.status(401).json({ message: 'Access token required' });
        return;
    }

    try {
        const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
        const decoded = jwt.verify(token, secret) as any;

        req.user = {
            id: decoded.id,
            role: decoded.role,
            organizationId: decoded.organizationId
        };

        next();
    } catch (error) {
        res.status(403).json({ message: 'Invalid or expired token' });
        return;
    }
};

export const authorize = (roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        if (!roles.includes(req.user.role)) {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }

        next();
    };
};
