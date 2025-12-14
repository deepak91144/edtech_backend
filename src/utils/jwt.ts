import jwt from 'jsonwebtoken';

interface TokenPayload {
    id: string;
    role: 'admin' | 'teacher' | 'student' | 'org_admin';
    organizationId?: string;
}

export const generateToken = (payload: TokenPayload): string => {
    const secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
    const expiresIn = process.env.JWT_EXPIRE || '1h';

    return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
};

export const generateRefreshToken = (payload: TokenPayload): string => {
    const secret = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key';
    const expiresIn = process.env.JWT_REFRESH_EXPIRE || '7d';

    return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
};

export const verifyRefreshToken = (token: string): TokenPayload => {
    const secret = process.env.JWT_REFRESH_SECRET || 'your-super-secret-refresh-key';
    return jwt.verify(token, secret) as TokenPayload;
};
