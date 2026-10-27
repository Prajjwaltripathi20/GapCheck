import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest } from '../middleware/auth';
import { parseResumePDF, parseResumeText, extractClaims } from '../services/resumeParser';
import { db } from '../db';
import { resumes, resumeClaims } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Configure multer
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10)) * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf' || (file.mimetype && file.mimetype !== 'application/pdf')) {
      cb(new Error('Only PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
});

// Submit and parse raw resume text
router.post('/text', authenticate, async (req: AuthRequest, res: Response) => {
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

    const { parsed } = parseResumeText(text);
    const claims = extractClaims(parsed);

    // Save resume record
    const [resume] = await db.insert(resumes).values({
      userId: req.userId!,
      filename: title || 'Pasted-Resume.txt',
      filePath: 'raw_text',
      rawText: text,
      parsedData: parsed as any,
    }).returning();

    // Save claims
    if (claims.length > 0) {
      await db.insert(resumeClaims).values(
        claims.map((claim: any) => ({
          resumeId: resume.id,
          userId: req.userId!,
          claim: claim.claim,
          claimType: claim.claimType,
          category: claim.category,
          proficiencyLevel: claim.proficiencyLevel || null,
          source: claim.source,
          context: claim.context || null,
        }))
      );
    }

    res.json({
      resumeId: resume.id,
      filename: resume.filename,
      skills: parsed.skills,
      education: parsed.education,
      projects: parsed.projects,
      claims,
    });
  } catch (err: any) {
    console.error('Resume text parse error:', err);
    res.status(500).json({ error: 'Failed to process resume text.' });
  }
});

// Upload and parse resume with clean error handling
router.post('/upload', authenticate, (req: AuthRequest, res: Response, next) => {
  upload.single('resume')(req as any, res as any, (err: any) => {
    if (err) {
      if (err.message?.includes('Only PDF')) {
        return res.status(400).json({ error: 'Only PDF files are supported. Please upload a PDF document.' });
      }
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    next();
  });
}, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const { text, parsed } = await parseResumePDF(req.file.path);
    const claims = extractClaims(parsed);

    // Save resume
    const [resume] = await db.insert(resumes).values({
      userId: req.userId!,
      filename: req.file.originalname,
      filePath: req.file.path,
      rawText: text,
      parsedData: parsed as any,
    }).returning();

    // Save claims
    if (claims.length > 0) {
      await db.insert(resumeClaims).values(
        claims.map((claim: any) => ({
          resumeId: resume.id,
          userId: req.userId!,
          claim: claim.claim,
          claimType: claim.claimType,
          category: claim.category,
          proficiencyLevel: claim.proficiencyLevel || null,
          source: claim.source,
          context: claim.context || null,
        }))
      );
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
  } catch (err: any) {
    console.error('Resume upload error:', err);
    res.status(500).json({ error: err?.message || 'Failed to process resume. Please upload a text-based PDF.' });
  }
});

// Get user's resumes
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userResumes = await db.select().from(resumes).where(eq(resumes.userId, req.userId!));
    res.json({ resumes: userResumes });
  } catch (err) {
    console.error('Get resumes error:', err);
    res.status(500).json({ error: 'Failed to get resumes' });
  }
});

// Get resume by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const [resume] = await db.select().from(resumes)
      .where(eq(resumes.id as any, req.params.id))
      .limit(1);

    if (!resume) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Resume not found' });
      return;
    }

    if (resume.userId !== req.userId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this resume' });
      return;
    }

    const claims = await db.select().from(resumeClaims)
      .where(eq(resumeClaims.resumeId, resume.id));

    res.json({ resume, claims });
  } catch (err) {
    console.error('Get resume error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to get resume' });
  }
});

export default router;
