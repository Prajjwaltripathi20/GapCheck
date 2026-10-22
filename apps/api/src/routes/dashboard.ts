import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import { analyses, analysisFindings, recommendations, actionItems, progressSnapshots, repositories, users, resumes } from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { performRecruiterAudit } from '../services/recruiterAudit';
import { DEMO_PARSED_RESUME } from '../services/demoData';
import { GitHubRepo } from '../services/githubAnalyzer';

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

    if (!user) {
      res.status(401).json({ error: 'User session expired or user not found. Please log in again.' });
      return;
    }

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

    // Extract or compute recruiterAudit
    let recruiterAudit = (latestAnalysis.dimensions as any)?.recruiterAudit;
    if ((!recruiterAudit || recruiterAudit.repositories?.length === 0) && repos.length > 0) {
      let parsedResume = null;
      if (latestAnalysis.resumeId) {
        const [resObj] = await db.select().from(resumes).where(eq(resumes.id as any, latestAnalysis.resumeId)).limit(1);
        parsedResume = resObj?.parsedData as any;
      }
      if (!parsedResume) parsedResume = DEMO_PARSED_RESUME;
      const ghRepos: GitHubRepo[] = repos.map((r: any) => ({
        name: r.name,
        fullName: r.fullName || `${user?.name || 'user'}/${r.name}`,
        description: r.description,
        language: r.language,
        languages: (r.languages as any) || {},
        stars: r.stars || 0,
        forks: r.forks || 0,
        topics: (r.topics as any) || [],
        hasReadme: !!r.hasReadme,
        readmeContent: r.readmeContent,
        hasDockerfile: !!r.hasDockerfile,
        hasCi: !!r.hasCi,
        hasTests: !!r.hasTests,
        packageJson: r.packageJson as any,
        requirementsTxt: r.requirementsTxt,
        fileTree: (r.fileTree as any) || [],
        lastCommitAt: r.lastCommitAt ? new Date(r.lastCommitAt).toISOString() : null,
        commitCount: r.commitCount || 0,
        htmlUrl: `https://github.com/${user?.name || 'user'}/${r.name}`,
      }));
      recruiterAudit = performRecruiterAudit(ghRepos, parsedResume, latestAnalysis.targetRole || undefined);
    }

    // Sanitize any null or NaN numbers in readiness score
    if (recruiterAudit?.readiness) {
      if (recruiterAudit.readiness.score == null || isNaN(recruiterAudit.readiness.score)) {
        recruiterAudit.readiness.score = 0;
      }
      if (recruiterAudit.readiness.dimensions) {
        for (const [key, val] of Object.entries(recruiterAudit.readiness.dimensions)) {
          if (val == null || isNaN(val as number)) {
            (recruiterAudit.readiness.dimensions as any)[key] = 0;
          }
        }
      }
    }

    res.json({
      user,
      hasAnalysis: true,
      latestAnalysis,
      findings,
      recommendations: recs,
      actionPlan: actions,
      progressHistory: progress,
      recruiterAudit: recruiterAudit || null,
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
