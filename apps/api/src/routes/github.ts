import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { fetchGitHubProfile, fetchRepositories, extractEvidenceFromRepos, normalizeGitHubInput } from '../services/githubAnalyzer';
import { db } from '../db';
import { githubAccounts, repositories, repositoryEvidence } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Connect GitHub (by username)
router.post('/connect', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const rawInput = req.body.username;
    if (!rawInput) {
      res.status(400).json({ error: 'GitHub username or profile URL is required' });
      return;
    }

    const username = normalizeGitHubInput(rawInput);

    // Fetch profile
    const profile = await fetchGitHubProfile(username);

    // Check if already connected
    const existing = await db.select().from(githubAccounts)
      .where(eq(githubAccounts.userId, req.userId!))
      .limit(1);

    let account;
    if (existing.length > 0) {
      [account] = await db.update(githubAccounts)
        .set({
          username,
          profileData: profile as any,
          lastSyncedAt: new Date(),
        })
        .where(eq(githubAccounts.userId, req.userId!))
        .returning();
    } else {
      [account] = await db.insert(githubAccounts).values({
        userId: req.userId!,
        username,
        profileData: profile as any,
        lastSyncedAt: new Date(),
      }).returning();
    }

    res.json({ account, profile });
  } catch (err: any) {
    console.error('GitHub connect error:', err);
    if (err.message?.includes('not found')) {
      res.status(404).json({ error: `GitHub user '${req.body.username}' not found` });
      return;
    }
    if (err.message?.includes('rate limit')) {
      res.status(429).json({ error: 'GitHub API rate limit exceeded. Please try again later.' });
      return;
    }
    res.status(500).json({ error: 'Failed to connect GitHub' });
  }
});

// Analyze repositories
router.post('/analyze', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const [account] = await db.select().from(githubAccounts)
      .where(eq(githubAccounts.userId, req.userId!))
      .limit(1);

    if (!account) {
      res.status(400).json({ error: 'Connect GitHub first' });
      return;
    }

    // Fetch and analyze repos
    const repos = await fetchRepositories(account.username);
    const evidence = extractEvidenceFromRepos(repos);

    // Clear existing repos and evidence for this account
    await db.delete(repositories).where(eq(repositories.githubAccountId, account.id));

    // Store repos
    for (const repo of repos) {
      const [savedRepo] = await db.insert(repositories).values({
        githubAccountId: account.id,
        userId: req.userId!,
        name: repo.name,
        fullName: repo.fullName,
        description: repo.description,
        language: repo.language,
        languages: repo.languages as any,
        stars: repo.stars,
        forks: repo.forks,
        topics: repo.topics as any,
        hasReadme: repo.hasReadme,
        readmeContent: repo.readmeContent,
        hasDockerfile: repo.hasDockerfile,
        hasCi: repo.hasCi,
        hasTests: repo.hasTests,
        packageJson: repo.packageJson as any,
        requirementsTxt: repo.requirementsTxt,
        fileTree: repo.fileTree as any,
        lastCommitAt: repo.lastCommitAt ? new Date(repo.lastCommitAt) : null,
        commitCount: repo.commitCount,
        analyzedData: repo as any,
      }).returning();

      // Store evidence for this repo
      const repoEvidence = evidence.filter(e => e.metadata?.repository === repo.name);
      if (repoEvidence.length > 0) {
        await db.insert(repositoryEvidence).values(
          repoEvidence.map(e => ({
            repositoryId: savedRepo.id,
            userId: req.userId!,
            skill: e.skill,
            evidenceType: e.evidenceType,
            source: e.source,
            detail: e.detail,
            confidence: e.confidence,
            metadata: e.metadata as any,
          }))
        );
      }
    }

    res.json({
      repositoriesCount: repos.length,
      evidenceCount: evidence.length,
      repositories: repos.map(r => ({
        name: r.name,
        language: r.language,
        stars: r.stars,
        hasTests: r.hasTests,
        hasDockerfile: r.hasDockerfile,
        hasCi: r.hasCi,
        commitCount: r.commitCount,
      })),
    });
  } catch (err: any) {
    console.error('GitHub analyze error:', err);
    if (err.message?.includes('rate limit')) {
      res.status(429).json({ error: 'GitHub API rate limit exceeded. Please try again later.' });
      return;
    }
    res.status(500).json({ error: 'Failed to analyze GitHub repositories' });
  }
});

// Get repos
router.get('/repos', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const repos = await db.select().from(repositories)
      .where(eq(repositories.userId, req.userId!));
    res.json({ repositories: repos });
  } catch (err) {
    console.error('Get repos error:', err);
    res.status(500).json({ error: 'Failed to get repositories' });
  }
});

// Get evidence
router.get('/evidence', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const evidence = await db.select().from(repositoryEvidence)
      .where(eq(repositoryEvidence.userId, req.userId!));
    res.json({ evidence });
  } catch (err) {
    console.error('Get evidence error:', err);
    res.status(500).json({ error: 'Failed to get evidence' });
  }
});

export default router;
