"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const auth_1 = require("../middleware/auth");
const resumeParser_1 = require("../services/resumeParser");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const router = (0, express_1.Router)();
// Configure multer
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        if (!fs_1.default.existsSync(uploadDir))
            fs_1.default.mkdirSync(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path_1.default.extname(file.originalname)}`;
        cb(null, uniqueName);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10)) * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        if (ext !== '.pdf' || (file.mimetype && file.mimetype !== 'application/pdf')) {
            cb(new Error('Only PDF files are allowed'));
            return;
        }
        cb(null, true);
    },
});
// Submit and parse raw resume text
router.post('/text', auth_1.authenticate, async (req, res) => {
    try {
        const { text, title } = req.body;
        if (!text || typeof text !== 'string' || text.trim().length < 50) {
            res.status(400).json({ error: 'Please provide valid resume text with at least 50 characters.' });
            return;
        }
        if (text.length > 200000) {
            res.status(400).json({ error: 'Resume text is too large. Maximum 200,000 characters allowed.' });
            return;
        }
        const { parsed } = (0, resumeParser_1.parseResumeText)(text);
        const claims = (0, resumeParser_1.extractClaims)(parsed);
        // Save resume record
        const [resume] = await db_1.db.insert(schema_1.resumes).values({
            userId: req.userId,
            filename: title || 'Pasted-Resume.txt',
            filePath: 'raw_text',
            rawText: text,
            parsedData: parsed,
        }).returning();
        // Save claims
        if (claims.length > 0) {
            await db_1.db.insert(schema_1.resumeClaims).values(claims.map((claim) => ({
                resumeId: resume.id,
                userId: req.userId,
                claim: claim.claim,
                claimType: claim.claimType,
                category: claim.category,
                proficiencyLevel: claim.proficiencyLevel || null,
                source: claim.source,
                context: claim.context || null,
            })));
        }
        res.json({
            resumeId: resume.id,
            filename: resume.filename,
            skills: parsed.skills,
            education: parsed.education,
            projects: parsed.projects,
            claims,
        });
    }
    catch (err) {
        console.error('Resume text parse error:', err);
        res.status(500).json({ error: 'Failed to process resume text.' });
    }
});
// Upload and parse resume with clean error handling
router.post('/upload', auth_1.authenticate, (req, res, next) => {
    upload.single('resume')(req, res, (err) => {
        if (err) {
            if (err.message?.includes('Only PDF')) {
                return res.status(400).json({ error: 'Only PDF files are supported. Please upload a PDF document.' });
            }
            return res.status(400).json({ error: err.message || 'File upload failed' });
        }
        next();
    });
}, async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }
        const { text, parsed } = await (0, resumeParser_1.parseResumePDF)(req.file.path);
        const claims = (0, resumeParser_1.extractClaims)(parsed);
        // Save resume
        const [resume] = await db_1.db.insert(schema_1.resumes).values({
            userId: req.userId,
            filename: req.file.originalname,
            filePath: req.file.path,
            rawText: text,
            parsedData: parsed,
        }).returning();
        // Save claims
        if (claims.length > 0) {
            await db_1.db.insert(schema_1.resumeClaims).values(claims.map((claim) => ({
                resumeId: resume.id,
                userId: req.userId,
                claim: claim.claim,
                claimType: claim.claimType,
                category: claim.category,
                proficiencyLevel: claim.proficiencyLevel || null,
                source: claim.source,
                context: claim.context || null,
            })));
        }
        res.json({
            resumeId: resume.id,
            resume: {
                id: resume.id,
                filename: resume.filename,
                parsed,
                claimsCount: claims.length,
            },
            claims,
        });
    }
    catch (err) {
        console.error('Resume upload error:', err);
        res.status(500).json({ error: err?.message || 'Failed to process resume. Please upload a text-based PDF.' });
    }
});
// Get user's resumes
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const userResumes = await db_1.db.select().from(schema_1.resumes).where((0, drizzle_orm_1.eq)(schema_1.resumes.userId, req.userId));
        res.json({ resumes: userResumes });
    }
    catch (err) {
        console.error('Get resumes error:', err);
        res.status(500).json({ error: 'Failed to get resumes' });
    }
});
// Get resume by ID
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        const [resume] = await db_1.db.select().from(schema_1.resumes)
            .where((0, drizzle_orm_1.eq)(schema_1.resumes.id, req.params.id))
            .limit(1);
        if (!resume) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Resume not found' });
            return;
        }
        if (resume.userId !== req.userId) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this resume' });
            return;
        }
        const claims = await db_1.db.select().from(schema_1.resumeClaims)
            .where((0, drizzle_orm_1.eq)(schema_1.resumeClaims.resumeId, resume.id));
        res.json({ resume, claims });
    }
    catch (err) {
        console.error('Get resume error:', err);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to get resume' });
    }
});
exports.default = router;
//# sourceMappingURL=resume.js.map