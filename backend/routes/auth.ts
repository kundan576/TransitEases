import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../services/db.js';
import { generateToken, authMiddleware, AuthRequest } from '../services/authService.js';
import { User } from '../types.js';

const router = express.Router();

// Register (Passengers and Drivers only; Admins cannot be created via public registration)
router.post('/register', async (req, res) => {
  try {
    const { name, mobile, email, password, role, licenseNumber } = req.body;

    if (!name || !mobile || !password) {
      return res.status(400).json({ error: 'Name, mobile number, and password are required.' });
    }

    if (role === 'admin') {
      return res.status(403).json({ error: 'Administrator accounts cannot be created via public registration.' });
    }

    const cleanMobile = mobile.replace(/\D/g, '').slice(-10);
    if (cleanMobile.length !== 10) {
      return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number.' });
    }

    // Check existing
    const existing = db.getUserByMobile(cleanMobile);
    if (existing) {
      return res.status(409).json({ error: 'An account with this mobile number already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const assignedRole = role === 'driver' ? 'driver' : 'passenger';

    const newUser: User = {
      id: `user-${Date.now()}`,
      name: name.trim(),
      mobile: cleanMobile,
      email: email?.trim() || undefined,
      password: hashedPassword,
      role: assignedRole,
      driverStatus: assignedRole === 'driver' ? 'pending' : undefined,
      licenseNumber: assignedRole === 'driver' ? (licenseNumber || 'PENDING-SUBMISSION') : undefined,
      language: 'en',
      createdAt: new Date().toISOString()
    };

    await db.addUser(newUser);

    const token = generateToken(newUser);
    res.status(201).json({
      message: assignedRole === 'driver' 
        ? 'Driver account created. Verification by transit administrator is pending.' 
        : 'Passenger account registered successfully.',
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        mobile: newUser.mobile,
        email: newUser.email,
        role: newUser.role,
        driverStatus: newUser.driverStatus,
        language: newUser.language
      }
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

export function getRoleMismatchMessage(actualRole: string, expectedRole?: string): string {
  if (actualRole === 'passenger') {
    return 'This account is registered as a passenger. Please use Passenger login.';
  }
  if (actualRole === 'driver') {
    return 'This account is registered as a driver. Please use Driver login.';
  }
  if (actualRole === 'admin') {
    return 'This account is registered as an administrator. Please use Admin login.';
  }
  return `This account is registered as a ${actualRole}. Please use the appropriate login portal.`;
}

// Login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password, expectedRole } = req.body; // mobile or email, password, optional expectedRole
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please provide mobile number (or email) and password.' });
    }

    const cleanMobile = identifier.replace(/\D/g, '').slice(-10);
    let user = cleanMobile.length === 10 ? db.getUserByMobile(cleanMobile) : null;
    if (!user) {
      user = db.getUserByEmail(identifier) || null;
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. Account not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid mobile number or password.' });
    }

    // Role-specific login validation (Requirement 2, 3, 4, 5)
    // If client supplied expectedRole intent, compare it against the verified database user.role
    if (expectedRole && typeof expectedRole === 'string') {
      const validRoles = ['passenger', 'driver', 'admin'];
      const normalizedExpectedRole = expectedRole.trim().toLowerCase();
      if (validRoles.includes(normalizedExpectedRole) && user.role !== normalizedExpectedRole) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(403).json({
          error: getRoleMismatchMessage(user.role, normalizedExpectedRole),
          actualRole: user.role,
          expectedRole: normalizedExpectedRole
        });
      }
    }

    const token = generateToken(user);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        role: user.role,
        driverStatus: user.driverStatus,
        assignedBusId: user.assignedBusId,
        language: user.language
      }
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// Get current profile
router.get('/me', authMiddleware, (req: AuthRequest, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
  const user = db.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  let assignedBus = null;
  if (user.role === 'driver' && user.assignedBusId) {
    assignedBus = db.getBusById(user.assignedBusId);
  }

  res.json({
    user: {
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      email: user.email,
      role: user.role,
      driverStatus: user.driverStatus,
      assignedBus,
      language: user.language || 'en'
    }
  });
});

// Update preferred language
router.put('/language', authMiddleware, (req: AuthRequest, res) => {
  const { language } = req.body;
  if (!['en', 'hi'].includes(language)) {
    return res.status(400).json({ error: 'Language must be either en or hi.' });
  }
  if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
  db.updateUser(req.user.id, { language });
  res.json({ success: true, language });
});

export default router;
