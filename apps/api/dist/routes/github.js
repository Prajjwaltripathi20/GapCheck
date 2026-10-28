"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const githubAnalyzer_1 = require("../services/githubAnalyzer");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const router = (0, express_1.Router)();
// Connect GitHub (by username)
router.post('/connect', auth_1.authenticate, async (req, res) => {
    try {
        const rawInput = req.body.username;
        if (!rawInput) {
            res.status(400).json({ error: 'GitHub username or profile URL is required' });
            return;
        }
        const username = (0, githubAnalyzer_1.normalizeGitHubInput)(rawInput);
        // Fetch profile
        const profile = await (0, githubAnalyzer_1.fetchGitHubProfile)(username);
        // Check if already connected
        const existing = await db_1.db.select().from(schema_1.githubAccounts)
            .where((0, drizzle_orm_1.eq)(schema_1.githubAccounts.userId, req.userId))
            .limit(1);
        let account;
        if (existing.length > 0) {
            [account] = await db_1.db.update(schema_1.githubAccounts)
                .set({
                username,
                profileData: profile,
                lastSyncedAt: new Date(),
            })
                .where((0, drizzle_orm_1.eq)(schema_1.githubAccounts.userId, req.userId))
                .returning();
        }
        else {
            [account] = await db_1.db.insert(schema_1.githubAccounts).values({
                userId: req.userId,
                username,
                profileData: profile,
                lastSyncedAt: new Date(),
            }).returning();
        }
        res.json({ account, profile });
    }
    catch (err) {
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
router.post('/analyze', auth_1.authenticate, async (req, res) => {
    try {
        const [account] = await db_1.db.select().from(schema_1.githubAccounts)
            .where((0, drizzle_orm_1.eq)(schema_1.githubAccounts.userId, req.userId))
            .limit(1);
        if (!account) {
            res.status(400).json({ error: 'Connect GitHub first' });
            return;
        }
        // Fetch and analyze repos
        const repos = await (0, githubAnalyzer_1.fetchRepositories)(account.username);
        const evidence = (0, githubAnalyzer_1.extractEvidenceFromRepos)(repos);
        // Clear existing repos and evidence for this account
        await db_1.db.delete(schema_1.repositories).where((0, drizzle_orm_1.eq)(schema_1.repositories.githubAccountId, account.id));
        // Store repos
        for (const repo of repos) {
            const [savedRepo] = await db_1.db.insert(schema_1.repositories).values({
                githubAccountId: account.id,
                userId: req.userId,
                name: repo.name,
                fullName: repo.fullName,
                description: repo.description,
                language: repo.language,
                languages: repo.languages,
                stars: repo.stars,
                forks: repo.forks,
                topics: repo.topics,
                hasReadme: repo.hasReadme,
                readmeContent: repo.readmeContent,
                hasDockerfile: repo.hasDockerfile,
                hasCi: repo.hasCi,
                hasTests: repo.hasTests,
                packageJson: repo.packageJson,
                requirementsTxt: repo.requirementsTxt,
                fileTree: repo.fileTree,
                lastCommitAt: repo.lastCommitAt ? new Date(repo.lastCommitAt) : null,
                commitCount: repo.commitCount,
                analyzedData: repo,
            }).returning();
            // Store evidence for this repo
            const repoEvidence = evidence.filter(e => e.metadata?.repository === repo.name);
            if (repoEvidence.length > 0) {
                await db_1.db.insert(schema_1.repositoryEvidence).values(repoEvidence.map(e => ({
                    repositoryId: savedRepo.id,
                    userId: req.userId,
                    skill: e.skill,
                    evidenceType: e.evidenceType,
                    source: e.source,
                    detail: e.detail,
                    confidence: e.confidence,
                    metadata: e.metadata,
                })));
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
    }
    catch (err) {
        console.error('GitHub analyze error:', err);
        if (err.message?.includes('rate limit')) {
            res.status(429).json({ error: 'GitHub API rate limit exceeded. Please try again later.' });
            return;
        }
        res.status(500).json({ error: 'Failed to analyze GitHub repositories' });
    }
});
// Get repos
router.get('/repos', auth_1.authenticate, async (req, res) => {
    try {
        const repos = await db_1.db.select().from(schema_1.repositories)
            .where((0, drizzle_orm_1.eq)(schema_1.repositories.userId, req.userId));
        res.json({ repositories: repos });
    }
    catch (err) {
        console.error('Get repos error:', err);
        res.status(500).json({ error: 'Failed to get repositories' });
    }
});
// Get evidence
router.get('/evidence', auth_1.authenticate, async (req, res) => {
    try {
        const evidence = await db_1.db.select().from(schema_1.repositoryEvidence)
            .where((0, drizzle_orm_1.eq)(schema_1.repositoryEvidence.userId, req.userId));
        res.json({ evidence });
    }
    catch (err) {
        console.error('Get evidence error:', err);
        res.status(500).json({ error: 'Failed to get evidence' });
    }
});
exports.default = router;
//# sourceMappingURL=github.js.map