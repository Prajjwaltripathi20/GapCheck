"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const recruiterAudit_1 = require("../services/recruiterAudit");
const preApplicationDecision_1 = require("../services/preApplicationDecision");
const demoData_1 = require("../services/demoData");
const router = (0, express_1.Router)();
// Get dashboard data
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const userId = req.userId;
        // Get user
        const [user] = await db_1.db.select({
            id: schema_1.users.id,
            name: schema_1.users.name,
            email: schema_1.users.email,
            targetRole: schema_1.users.targetRole,
            avatarUrl: schema_1.users.avatarUrl,
        }).from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId)).limit(1);
        if (!user) {
            res.status(401).json({ error: 'User session expired or user not found. Please log in again.' });
            return;
        }
        const requestedAnalysisId = req.query.analysisId;
        let targetAnalysis;
        if (requestedAnalysisId) {
            const [found] = await db_1.db.select().from(schema_1.analyses)
                .where((0, drizzle_orm_1.eq)(schema_1.analyses.id, requestedAnalysisId))
                .limit(1);
            if (!found) {
                res.status(404).json({ error: 'NOT_FOUND', message: 'Audit not found' });
                return;
            }
            if (found.userId !== userId) {
                res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this audit' });
                return;
            }
            targetAnalysis = found;
        }
        if (!targetAnalysis) {
            // Get latest completed analysis
            const [latest] = await db_1.db.select().from(schema_1.analyses)
                .where((0, drizzle_orm_1.eq)(schema_1.analyses.userId, userId))
                .orderBy((0, drizzle_orm_1.desc)(schema_1.analyses.createdAt))
                .limit(1);
            targetAnalysis = latest;
        }
        if (!targetAnalysis || targetAnalysis.status !== 'completed') {
            res.json({
                user,
                hasAnalysis: false,
                latestAnalysis: targetAnalysis || null,
                findings: [],
                recommendations: [],
                actionPlan: [],
            });
            return;
        }
        const latestAnalysis = targetAnalysis;
        // Get findings
        const findings = await db_1.db.select().from(schema_1.analysisFindings)
            .where((0, drizzle_orm_1.eq)(schema_1.analysisFindings.analysisId, latestAnalysis.id));
        // Get recommendations
        const recs = await db_1.db.select().from(schema_1.recommendations)
            .where((0, drizzle_orm_1.eq)(schema_1.recommendations.analysisId, latestAnalysis.id));
        // Get action items
        const actions = await db_1.db.select().from(schema_1.actionItems)
            .where((0, drizzle_orm_1.eq)(schema_1.actionItems.analysisId, latestAnalysis.id));
        // Get progress history
        const progress = await db_1.db.select().from(schema_1.progressSnapshots)
            .where((0, drizzle_orm_1.eq)(schema_1.progressSnapshots.userId, userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.progressSnapshots.createdAt));
        // Get repos from immutable snapshot if present, else by analysisId, else fallback
        let repos = [];
        if (latestAnalysis.repositoriesSnapshot && Array.isArray(latestAnalysis.repositoriesSnapshot)) {
            repos = latestAnalysis.repositoriesSnapshot;
        }
        else {
            repos = await db_1.db.select().from(schema_1.repositories)
                .where((0, drizzle_orm_1.eq)(schema_1.repositories.analysisId, latestAnalysis.id));
            if (repos.length === 0) {
                repos = await db_1.db.select().from(schema_1.repositories)
                    .where((0, drizzle_orm_1.eq)(schema_1.repositories.userId, userId));
            }
        }
        // Stats
        const verifiedCount = findings.filter((f) => f.evidenceStatus === 'verified' || f.evidenceStatus === 'supported').length;
        const unverifiedCount = findings.filter((f) => f.evidenceStatus === 'unverified').length;
        const weakCount = findings.filter((f) => f.evidenceStatus === 'weakly_supported').length;
        // Extract or compute recruiterAudit
        let recruiterAudit = latestAnalysis.dimensions?.recruiterAudit;
        if ((!recruiterAudit || recruiterAudit.repositories?.length === 0) && repos.length > 0) {
            let parsedResume = null;
            if (latestAnalysis.resumeId) {
                const [resObj] = await db_1.db.select().from(schema_1.resumes).where((0, drizzle_orm_1.eq)(schema_1.resumes.id, latestAnalysis.resumeId)).limit(1);
                parsedResume = resObj?.parsedData;
            }
            if (!parsedResume)
                parsedResume = demoData_1.DEMO_PARSED_RESUME;
            const ghRepos = repos.map((r) => ({
                name: r.name,
                fullName: r.fullName || `${user?.name || 'user'}/${r.name}`,
                description: r.description,
                language: r.language,
                languages: r.languages || {},
                stars: r.stars || 0,
                forks: r.forks || 0,
                topics: r.topics || [],
                hasReadme: !!r.hasReadme,
                readmeContent: r.readmeContent,
                hasDockerfile: !!r.hasDockerfile,
                hasCi: !!r.hasCi,
                hasTests: !!r.hasTests,
                packageJson: r.packageJson,
                requirementsTxt: r.requirementsTxt,
                fileTree: r.fileTree || [],
                lastCommitAt: r.lastCommitAt ? new Date(r.lastCommitAt).toISOString() : null,
                commitCount: r.commitCount || 0,
                htmlUrl: `https://github.com/${user?.name || 'user'}/${r.name}`,
            }));
            recruiterAudit = (0, recruiterAudit_1.performRecruiterAudit)(ghRepos, parsedResume, latestAnalysis.targetRole || undefined);
        }
        // Sanitize any null or NaN numbers in readiness score
        if (recruiterAudit?.readiness) {
            if (recruiterAudit.readiness.score == null || isNaN(recruiterAudit.readiness.score)) {
                recruiterAudit.readiness.score = 0;
            }
            if (recruiterAudit.readiness.dimensions) {
                for (const [key, val] of Object.entries(recruiterAudit.readiness.dimensions)) {
                    if (val == null || isNaN(val)) {
                        recruiterAudit.readiness.dimensions[key] = 0;
                    }
                }
            }
        }
        // Extract or compute preApplicationDecision
        let preApplicationDecision = latestAnalysis.dimensions?.preApplicationDecision;
        if (!preApplicationDecision && recruiterAudit) {
            let parsedResume = null;
            if (latestAnalysis.resumeId) {
                const [resObj] = await db_1.db.select().from(schema_1.resumes).where((0, drizzle_orm_1.eq)(schema_1.resumes.id, latestAnalysis.resumeId)).limit(1);
                parsedResume = resObj?.parsedData;
            }
            if (!parsedResume)
                parsedResume = demoData_1.DEMO_PARSED_RESUME;
            const ghRepos = repos.map((r) => ({
                name: r.name,
                fullName: r.fullName || `${user?.name || 'user'}/${r.name}`,
                description: r.description,
                language: r.language,
                languages: r.languages || {},
                stars: r.stars || 0,
                forks: r.forks || 0,
                topics: r.topics || [],
                hasReadme: !!r.hasReadme,
                readmeContent: r.readmeContent,
                hasDockerfile: !!r.hasDockerfile,
                hasCi: !!r.hasCi,
                hasTests: !!r.hasTests,
                packageJson: r.packageJson,
                requirementsTxt: r.requirementsTxt,
                fileTree: r.fileTree || [],
                lastCommitAt: r.lastCommitAt ? new Date(r.lastCommitAt).toISOString() : null,
                commitCount: r.commitCount || 0,
                htmlUrl: `https://github.com/${user?.name || 'user'}/${r.name}`,
            }));
            preApplicationDecision = (0, preApplicationDecision_1.generatePreApplicationDecision)({
                findings: findings.map((f) => ({
                    skill: f.skill,
                    resumeClaim: f.resumeClaim,
                    claimLevel: f.claimLevel || 'proficient',
                    evidenceStatus: f.evidenceStatus,
                    assessment: f.assessment,
                    confidence: f.confidence || 0.8,
                    priority: f.priority || 'medium',
                    evidenceSources: f.evidenceSources || [],
                })),
                recruiterAudit,
                repos: ghRepos,
                parsedResume,
                targetRole: latestAnalysis.targetRole || 'Software Engineer',
            });
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
            preApplicationDecision: preApplicationDecision || null,
            repositories: repos.map((r) => ({
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
                criticalIssues: recs.filter((r) => r.priority === 'critical').length,
                highIssues: recs.filter((r) => r.priority === 'high').length,
                repositoriesAnalyzed: repos.length,
            },
        });
    }
    catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ error: 'Failed to load dashboard' });
    }
});
// Get progress comparison
router.get('/progress', auth_1.authenticate, async (req, res) => {
    try {
        const snapshots = await db_1.db.select().from(schema_1.progressSnapshots)
            .where((0, drizzle_orm_1.eq)(schema_1.progressSnapshots.userId, req.userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.progressSnapshots.createdAt));
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
    }
    catch (err) {
        console.error('Progress error:', err);
        res.status(500).json({ error: 'Failed to fetch progress' });
    }
});
// Toggle roadmap action item completed state
router.patch('/action-item/:id', auth_1.authenticate, async (req, res) => {
    try {
        const itemId = req.params.id;
        const { completed } = req.body;
        const [item] = await db_1.db.select().from(schema_1.actionItems)
            .where((0, drizzle_orm_1.eq)(schema_1.actionItems.id, itemId))
            .limit(1);
        if (!item) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Action item not found' });
            return;
        }
        if (item.userId !== req.userId) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this action item' });
            return;
        }
        const newCompleted = typeof completed === 'boolean' ? completed : !item.completed;
        const [updated] = await db_1.db.update(schema_1.actionItems)
            .set({ completed: newCompleted })
            .where((0, drizzle_orm_1.eq)(schema_1.actionItems.id, itemId))
            .returning();
        res.json({ actionItem: updated });
    }
    catch (err) {
        console.error('Update action item error:', err);
        res.status(500).json({ error: 'Failed to update action item' });
    }
});
exports.default = router;
//# sourceMappingURL=dashboard.js.map