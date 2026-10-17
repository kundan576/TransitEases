import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { db } from './db.js';
import { UserRole } from '../types.js';

import { getJwtSecret } from './envLoader.js';

export interface AuthenticatedUser {
  id: string;
  mobile: string;
  role: UserRole;
  name: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function generateToken(user: { id: string; mobile: string; role: UserRole; name: string }) {
  return jwt.sign(
    {
      id: user.id,
      mobile: user.mobile,
      role: user.role,
      name: user.name
    },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthenticatedUser | null {
  try {
    return jwt.verify(token, getJwtSecret()) as AuthenticatedUser;
  } catch {
    return null;
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }

  const user = db.getUserById(decoded.id) || (decoded.mobile ? db.getUserByMobile(decoded.mobile) : null);
  if (!user) {
    return res.status(401).json({ error: 'User account not found.' });
  }

  req.user = {
    id: user.id,
    mobile: user.mobile,
    role: user.role,
    name: user.name
  };
  next();
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden. Requires ${allowedRoles.join(' or ')} permission.` });
    }
    next();
  };
}
