"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const auth_1 = require("../middleware/auth");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Register
router.post('/register', rateLimiter_1.authRateLimiter, async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Email and password are required' });
            return;
        }
        const normalizedEmail = String(email).toLowerCase().trim();
        if (!EMAIL_REGEX.test(normalizedEmail)) {
            res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Please enter a valid email address.' });
            return;
        }
        if (password.length < 6) {
            res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Password must be at least 6 characters' });
            return;
        }
        if (password.length > 128) {
            res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Password must not exceed 128 characters' });
            return;
        }
        // Check if user exists
        const existing = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, normalizedEmail)).limit(1);
        if (existing.length > 0) {
            res.status(409).json({ error: 'ALREADY_EXISTS', message: 'An account with this email already exists.' });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const [user] = await db_1.db.insert(schema_1.users).values({
            email: normalizedEmail,
            passwordHash,
            name: name ? String(name).trim().slice(0, 100) : null,
        }).returning({ id: schema_1.users.id, email: schema_1.users.email, name: schema_1.users.name });
        const token = (0, auth_1.generateToken)(user.id);
        res.status(201).json({ user, token });
    }
    catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Registration failed. Please try again.' });
    }
});
// Login
router.post('/login', rateLimiter_1.authRateLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Email and password are required' });
            return;
        }
        const normalizedEmail = String(email).toLowerCase().trim();
        const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, normalizedEmail)).limit(1);
        if (!user) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid email or password' });
            return;
        }
        const valid = await bcryptjs_1.default.compare(password, user.passwordHash);
        if (!valid) {
            res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid email or password' });
            return;
        }
        const token = (0, auth_1.generateToken)(user.id);
        res.json({
            user: { id: user.id, email: user.email, name: user.name, targetRole: user.targetRole },
            token,
        });
    }
    catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Login failed. Please try again.' });
    }
});
// Get current user
router.get('/me', auth_1.authenticate, async (req, res) => {
    try {
        const [user] = await db_1.db.select({
            id: schema_1.users.id,
            email: schema_1.users.email,
            name: schema_1.users.name,
            targetRole: schema_1.users.targetRole,
            avatarUrl: schema_1.users.avatarUrl,
            createdAt: schema_1.users.createdAt,
        }).from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, req.userId)).limit(1);
        if (!user) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({ user });
    }
    catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: 'Failed to get user' });
    }
});
// Update profile
router.patch('/profile', auth_1.authenticate, async (req, res) => {
    try {
        const { name, targetRole } = req.body;
        const [user] = await db_1.db.update(schema_1.users)
            .set({ name, targetRole, updatedAt: new Date() })
            .where((0, drizzle_orm_1.eq)(schema_1.users.id, req.userId))
            .returning({ id: schema_1.users.id, email: schema_1.users.email, name: schema_1.users.name, targetRole: schema_1.users.targetRole });
        res.json({ user });
    }
    catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});
// Demo login - creates/returns a demo user
router.post('/demo', async (_req, res) => {
    try {
        const demoEmail = 'demo@proofcheck.dev';
        let [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, demoEmail)).limit(1);
        if (!user) {
            try {
                const passwordHash = await bcryptjs_1.default.hash('demo-password-2024', 12);
                [user] = await db_1.db.insert(schema_1.users).values({
                    email: demoEmail,
                    passwordHash,
                    name: 'Arjun Sharma',
                    targetRole: 'Frontend Developer Intern',
                }).returning();
            }
            catch {
                // Handle concurrent insert race condition
                const [existing] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.email, demoEmail)).limit(1);
                if (existing) {
                    user = existing;
                }
            }
        }
        const token = (0, auth_1.generateToken)(user.id);
        res.json({
            user: { id: user.id, email: user.email, name: user.name, targetRole: user.targetRole },
            token,
            isDemo: true,
        });
    }
    catch (err) {
        console.error('Demo login error:', err);
        res.status(500).json({ error: 'Demo login failed' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map