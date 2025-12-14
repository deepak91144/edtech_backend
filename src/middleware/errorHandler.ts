import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
    statusCode?: number;
}

export const errorHandler = (
    err: ApiError,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    console.error(`[ERROR] ${statusCode} - ${message}`);
    console.error(err.stack);

    res.status(statusCode).json({
        success: false,
        message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

export const notFound = (req: Request, res: Response, next: NextFunction): void => {
    const error: ApiError = new Error(`Not Found - ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
};
