import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import {
  analyses, analysisFindings, recommendations, actionItems,
  progressSnapshots, repositories, users
} from '../db/schema';
import { eq, desc } from 'drizzle-orm';

const router = Router();

// Get dashboard data
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    // Get user
    const [user] = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      targetRole: users.targetRole,
      avatarUrl: users.avatarUrl,
    }).from(users).where(eq(users.id, userId)).limit(1);

    const requestedAnalysisId = req.query.analysisId as string | undefined;
    let targetAnalysis;

    if (requestedAnalysisId) {
      const [found] = await db.select().from(analyses)
        .where(eq(analyses.id as any, requestedAnalysisId))
        .limit(1);
      if (found && found.userId === userId) {
        targetAnalysis = found;
      }
    }

    if (!targetAnalysis) {
      // Get latest completed analysis
      const [latest] = await db.select().from(analyses)
        .where(eq(analyses.userId, userId))
        .orderBy(desc(analyses.createdAt))
        .limit(1);
      targetAnalysis = latest;
    }

    if (!targetAnalysis || targetAnalysis.status !== 'completed') {
      res.json({
        user,
        hasAnalysis: false,
        latestAnalysis: targetAnalysis || null,
      });
      return;
    }

    const latestAnalysis = targetAnalysis;

    // Get findings
    const findings = await db.select().from(analysisFindings)
      .where(eq(analysisFindings.analysisId, latestAnalysis.id));

    // Get recommendations
    const recs = await db.select().from(recommendations)
      .where(eq(recommendations.analysisId, latestAnalysis.id));

    // Get action items
    const actions = await db.select().from(actionItems)
      .where(eq(actionItems.analysisId, latestAnalysis.id));

    // Get progress history
    const progress = await db.select().from(progressSnapshots)
      .where(eq(progressSnapshots.userId, userId))
      .orderBy(desc(progressSnapshots.createdAt));

    // Get repos
    const repos = await db.select().from(repositories)
      .where(eq(repositories.userId, userId));

    // Stats
    const verifiedCount = findings.filter((f: any) => f.evidenceStatus === 'verified' || f.evidenceStatus === 'supported').length;
    const unverifiedCount = findings.filter((f: any) => f.evidenceStatus === 'unverified').length;
    const weakCount = findings.filter((f: any) => f.evidenceStatus === 'weakly_supported').length;

    res.json({
      user,
      hasAnalysis: true,
      latestAnalysis,
      findings,
      recommendations: recs,
      actionPlan: actions,
      progressHistory: progress,
      repositories: repos.map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        language: r.language,
        stars: r.stars,
        hasTests: r.hasTests,
        hasDockerfile: r.hasDockerfile,
        hasCi: r.hasCi,
        commitCount: r.commitCount,
        languages: r.languages,
      })),
      stats: {
        totalSkills: findings.length,
        verifiedSkills: verifiedCount,
        unverifiedSkills: unverifiedCount,
        weakSkills: weakCount,
        totalRecommendations: recs.length,
        criticalIssues: recs.filter((r: any) => r.priority === 'critical').length,
        highIssues: recs.filter((r: any) => r.priority === 'high').length,
        repositoriesAnalyzed: repos.length,
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// Get progress comparison
router.get('/progress', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const snapshots = await db.select().from(progressSnapshots)
      .where(eq(progressSnapshots.userId, req.userId!))
      .orderBy(desc(progressSnapshots.createdAt));

    if (snapshots.length < 2) {
      res.json({ hasComparison: false, snapshots });
      return;
    }

    const current = snapshots[0];
    const previous = snapshots[1];

    res.json({
      hasComparison: true,
      current,
      previous,
      changes: {
        overallScore: (current.overallScore || 0) - (previous.overallScore || 0),
        claimConsistency: (current.claimConsistency || 0) - (previous.claimConsistency || 0),
        verifiedSkills: (current.verifiedSkills || 0) - (previous.verifiedSkills || 0),
        unverifiedSkills: (current.unverifiedSkills || 0) - (previous.unverifiedSkills || 0),
      },
      snapshots,
    });
  } catch (err) {
    console.error('Progress error:', err);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

// Toggle roadmap action item completed state
router.patch('/action-item/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const itemId = req.params.id;
    const { completed } = req.body;

    const [item] = await db.select().from(actionItems)
      .where(eq(actionItems.id as any, itemId))
      .limit(1);

    if (!item || item.userId !== req.userId) {
      res.status(404).json({ error: 'Action item not found' });
      return;
    }

    const newCompleted = typeof completed === 'boolean' ? completed : !item.completed;

    const [updated] = await db.update(actionItems)
      .set({ completed: newCompleted })
      .where(eq(actionItems.id as any, itemId))
      .returning();

    res.json({ actionItem: updated });
  } catch (err) {
    console.error('Update action item error:', err);
    res.status(500).json({ error: 'Failed to update action item' });
  }
});

export default router;
