import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { parseJobDescription } from '../services/jobParser';
import { db } from '../db';
import { jobDescriptions, jobRequirements } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Analyze job description
router.post('/analyze', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { text, title } = req.body;
    if (!text || text.length < 20) {
      res.status(400).json({ error: 'Please paste a valid job description (at least 20 characters)' });
      return;
    }

    const parsed = parseJobDescription(text);

    // Save to DB
    const [jd] = await db.insert(jobDescriptions).values({
      userId: req.userId!,
      title: title || parsed.title,
      company: parsed.company,
      rawText: text,
      parsedData: parsed as any,
    }).returning();

    // Save requirements
    const allReqs = [
      ...parsed.required.languages.map(r => ({ requirement: r, category: 'language', importance: 'required' })),
      ...parsed.required.frameworks.map(r => ({ requirement: r, category: 'framework', importance: 'required' })),
      ...parsed.required.tools.map(r => ({ requirement: r, category: 'tool', importance: 'required' })),
      ...parsed.required.databases.map(r => ({ requirement: r, category: 'database', importance: 'required' })),
      ...parsed.required.cloud.map(r => ({ requirement: r, category: 'cloud', importance: 'required' })),
      ...parsed.preferred.technologies.map(r => ({ requirement: r, category: 'technology', importance: 'preferred' })),
      ...parsed.preferred.cloud.map(r => ({ requirement: r, category: 'cloud', importance: 'preferred' })),
      ...parsed.preferred.testing.map(r => ({ requirement: r, category: 'testing', importance: 'preferred' })),
      ...parsed.preferred.deployment.map(r => ({ requirement: r, category: 'deployment', importance: 'preferred' })),
    ];

    if (allReqs.length > 0) {
      await db.insert(jobRequirements).values(
        allReqs.map(r => ({
          jobDescriptionId: jd.id,
          userId: req.userId!,
          requirement: r.requirement,
          category: r.category,
          importance: r.importance,
        }))
      );
    }

    res.json({
      jobDescription: {
        id: jd.id,
        title: jd.title,
        company: jd.company,
        parsed,
      },
      requirementsCount: allReqs.length,
    });
  } catch (err) {
    console.error('Job analyze error:', err);
    res.status(500).json({ error: 'Failed to analyze job description' });
  }
});

// Get job descriptions
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const jds = await db.select().from(jobDescriptions)
      .where(eq(jobDescriptions.userId, req.userId!));
    res.json({ jobDescriptions: jds });
  } catch (err) {
    console.error('Get JDs error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to get job descriptions' });
  }
});

// Get job description by ID
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const [jd] = await db.select().from(jobDescriptions)
      .where(eq(jobDescriptions.id as any, req.params.id))
      .limit(1);

    if (!jd) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Job description not found' });
      return;
    }

    if (jd.userId !== req.userId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this job description' });
      return;
    }

    res.json({ jobDescription: jd });
  } catch (err) {
    console.error('Get JD error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to get job description' });
  }
});

export default router;
