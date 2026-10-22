import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate, generateToken, AuthRequest } from '../middleware/auth';

const router = Router();

// Register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters' });
      return;
    }

    // Check if user exists
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db.insert(users).values({
      email,
      passwordHash,
      name: name || null,
    }).returning({ id: users.id, email: users.email, name: users.name });

    const token = generateToken(user.id);
    res.status(201).json({ user, token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user.id);
    res.json({
      user: { id: user.id, email: user.email, name: user.name, targetRole: user.targetRole },
      token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const [user] = await db.select({
      id: users.id,
      email: users.email,
      name: users.name,
      targetRole: users.targetRole,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    }).from(users).where(eq(users.id, req.userId!)).limit(1);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update profile
router.patch('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, targetRole } = req.body;
    const [user] = await db.update(users)
      .set({ name, targetRole, updatedAt: new Date() })
      .where(eq(users.id, req.userId!))
      .returning({ id: users.id, email: users.email, name: users.name, targetRole: users.targetRole });

    res.json({ user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Demo login - creates/returns a demo user
router.post('/demo', async (_req: Request, res: Response) => {
  try {
    const demoEmail = 'demo@proofcheck.dev';
    let [user] = await db.select().from(users).where(eq(users.email, demoEmail)).limit(1);

    if (!user) {
      try {
        const passwordHash = await bcrypt.hash('demo-password-2024', 12);
        [user] = await db.insert(users).values({
          email: demoEmail,
          passwordHash,
          name: 'Arjun Sharma',
          targetRole: 'Frontend Developer Intern',
        }).returning();
      } catch {
        // Handle concurrent insert race condition
        const [existing] = await db.select().from(users).where(eq(users.email, demoEmail)).limit(1);
        if (existing) {
          user = existing;
        }
      }
    }

    const token = generateToken(user.id);
    res.json({
      user: { id: user.id, email: user.email, name: user.name, targetRole: user.targetRole },
      token,
      isDemo: true,
    });
  } catch (err) {
    console.error('Demo login error:', err);
    res.status(500).json({ error: 'Demo login failed' });
  }
});

export default router;
