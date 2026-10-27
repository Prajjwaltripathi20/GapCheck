import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: string;
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is missing in production');
    }
    return 'dev-jwt-secret-proofcheck-2024';
  }
  return secret;
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required. Please log in.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as { userId: string };
    if (!decoded || !decoded.userId) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid token payload.' });
      return;
    }
    req.userId = decoded.userId;
    next();
  } catch (err: any) {
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: err.name === 'TokenExpiredError'
        ? 'Your session has expired. Please log in again.'
        : 'Invalid or expired token. Please log in again.',
    });
  }
}

export function generateToken(userId: string): string {
  const secret = getJwtSecret();
  return jwt.sign(
    { userId },
    secret,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any }
  );
}
