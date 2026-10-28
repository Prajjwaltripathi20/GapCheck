"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const db_1 = require("../db");
const schema_1 = require("../db/schema");
const drizzle_orm_1 = require("drizzle-orm");
const resumeParser_1 = require("../services/resumeParser");
const githubAnalyzer_1 = require("../services/githubAnalyzer");
const evidenceEngine_1 = require("../services/evidenceEngine");
const jobParser_1 = require("../services/jobParser");
const demoData_1 = require("../services/demoData");
const reportGenerator_1 = require("../services/reportGenerator");
const recruiterAudit_1 = require("../services/recruiterAudit");
const preApplicationDecision_1 = require("../services/preApplicationDecision");
const rateLimiter_1 = require("../middleware/rateLimiter");
const router = (0, express_1.Router)();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(id) {
    return typeof id === 'string' && UUID_REGEX.test(id);
}
// Start analysis
router.post('/start', auth_1.authenticate, rateLimiter_1.analysisRateLimiter, async (req, res) => {
    try {
        const { resumeId, resumeText, githubUsername, jobDescriptionId, jobDescriptionText, targetRole, company, isDemo } = req.body;
        const userId = req.userId;
        if (!resumeText && !resumeId) {
            res.status(400).json({ error: 'INVALID_INPUT', message: 'A resume is required to start an audit.' });
            return;
        }
        if (!githubUsername || typeof githubUsername !== 'string' || !githubUsername.trim()) {
            res.status(400).json({ error: 'INVALID_INPUT', message: 'A public GitHub username or profile URL is required.' });
            return;
        }
        if (!targetRole || typeof targetRole !== 'string' || !targetRole.trim()) {
            res.status(400).json({ error: 'INVALID_INPUT', message: 'A target role is required.' });
            return;
        }
        if (resumeText && typeof resumeText === 'string' && resumeText.length > 200000) {
            res.status(400).json({ error: 'INVALID_INPUT', message: 'Resume text exceeds maximum allowed length of 200,000 characters.' });
            return;
        }
        if (jobDescriptionText && typeof jobDescriptionText === 'string' && jobDescriptionText.length > 100000) {
            res.status(400).json({ error: 'INVALID_INPUT', message: 'Job description text exceeds maximum allowed length of 100,000 characters.' });
            return;
        }
        if (targetRole && typeof targetRole === 'string' && targetRole.length > 200) {
            res.status(400).json({ error: 'INVALID_INPUT', message: 'Target role title exceeds maximum allowed length of 200 characters.' });
            return;
        }
        if (company && typeof company === 'string' && company.length > 200) {
            res.status(400).json({ error: 'INVALID_INPUT', message: 'Company name exceeds maximum allowed length of 200 characters.' });
            return;
        }
        let cleanGithubUsername = null;
        try {
            cleanGithubUsername = (0, githubAnalyzer_1.normalizeGitHubInput)(githubUsername);
        }
        catch (err) {
            res.status(400).json({ error: 'INVALID_INPUT', message: err.message || 'Invalid GitHub profile URL or username' });
            return;
        }
        // Create analysis record
        const [analysis] = await db_1.db.insert(schema_1.analyses).values({
            userId,
            resumeId: resumeId || null,
            targetRole: targetRole || 'Software Engineer Intern',
            company: company || null,
            githubUsername: cleanGithubUsername || null,
            resumeTextSnapshot: resumeText || null,
            jobDescriptionTextSnapshot: jobDescriptionText || null,
            status: 'pending',
            progress: 0,
            progressMessage: 'Reading resume...',
        }).returning();
        // Kick off analysis
        const analysisPromise = runAnalysis({
            analysisId: analysis.id,
            userId,
            resumeId,
            resumeText,
            githubUsername: cleanGithubUsername,
            jobDescriptionId,
            jobDescriptionText,
            targetRole: targetRole || 'Software Engineer',
            company: company || null,
            isDemo: Boolean(isDemo),
        });
        // Wait up to 1.5 seconds so fast analyses return as completed immediately
        const result = await Promise.race([
            analysisPromise.then(() => 'completed'),
            new Promise(resolve => setTimeout(() => resolve('pending'), 1500)),
        ]);
        res.json({
            analysisId: analysis.id,
            analysis: {
                id: analysis.id,
                status: result,
            },
        });
    }
    catch (err) {
        console.error('Start analysis error:', err);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to start analysis' });
    }
});
async function runAnalysis(params) {
    const { analysisId, userId, resumeId, resumeText, githubUsername, jobDescriptionId, jobDescriptionText, targetRole, isDemo, } = params;
    const updateProgress = async (status, progress, message) => {
        try {
            await db_1.db.update(schema_1.analyses).set({
                status: status,
                progress,
                progressMessage: message,
                updatedAt: new Date(),
            }).where((0, drizzle_orm_1.eq)(schema_1.analyses.id, analysisId));
        }
        catch (e) {
            console.warn('Progress update warning:', e);
        }
    };
    try {
        // Stage 1: Reading resume
        await updateProgress('parsing_resume', 14, 'Reading resume');
        let claims = [];
        let parsedResume;
        if (isDemo) {
            parsedResume = demoData_1.DEMO_PARSED_RESUME;
            claims = demoData_1.DEMO_CLAIMS;
        }
        else if (resumeText && resumeText.trim().length >= 20) {
            const parsedRes = (0, resumeParser_1.parseResumeText)(resumeText);
            parsedResume = parsedRes.parsed;
            claims = (0, resumeParser_1.extractClaims)(parsedResume);
            // Save to database
            const [savedResume] = await db_1.db.insert(schema_1.resumes).values({
                userId,
                filename: 'Pasted-Resume.txt',
                filePath: 'raw_text',
                rawText: resumeText,
                parsedData: parsedResume,
            }).returning();
            if (claims.length > 0) {
                await db_1.db.insert(schema_1.resumeClaims).values(claims.map((claim) => ({
                    resumeId: savedResume.id,
                    userId,
                    claim: claim.claim,
                    claimType: claim.claimType,
                    category: claim.category,
                    proficiencyLevel: claim.proficiencyLevel || null,
                    source: claim.source,
                    context: claim.context || null,
                })));
            }
        }
        else if (resumeId) {
            const [resume] = await db_1.db.select().from(schema_1.resumes).where((0, drizzle_orm_1.eq)(schema_1.resumes.id, resumeId)).limit(1);
            if (resume?.parsedData) {
                parsedResume = resume.parsedData;
                claims = (0, resumeParser_1.extractClaims)(parsedResume);
            }
            else {
                parsedResume = demoData_1.DEMO_PARSED_RESUME;
                claims = demoData_1.DEMO_CLAIMS;
            }
        }
        else {
            // Check if user has an existing resume
            const [existingResume] = await db_1.db.select().from(schema_1.resumes).where((0, drizzle_orm_1.eq)(schema_1.resumes.userId, userId)).orderBy((0, drizzle_orm_1.desc)(schema_1.resumes.createdAt)).limit(1);
            if (existingResume?.parsedData) {
                parsedResume = existingResume.parsedData;
                claims = (0, resumeParser_1.extractClaims)(parsedResume);
            }
            else {
                parsedResume = demoData_1.DEMO_PARSED_RESUME;
                claims = demoData_1.DEMO_CLAIMS;
            }
        }
        // Update candidate profile name and target role from parsed resume if available
        if (parsedResume.personal?.name && parsedResume.personal.name !== 'Arjun Sharma') {
            try {
                await db_1.db.update(schema_1.users).set({
                    name: parsedResume.personal.name,
                    targetRole,
                    updatedAt: new Date(),
                }).where((0, drizzle_orm_1.eq)(schema_1.users.id, userId));
            }
            catch (err) {
                console.warn('Failed to update candidate name in user profile:', err);
            }
        }
        // Stage 2: Scanning public GitHub profile
        await updateProgress('analyzing_github', 28, 'Scanning public GitHub profile');
        // Stage 3: Analyzing repositories
        await updateProgress('analyzing_github', 42, 'Analyzing repositories');
        let repos = [];
        let evidence = [];
        let githubQuality = 'COMPLETE';
        let totalPublicRepos = 0;
        let scannedCount = 0;
        let failedCount = 0;
        let githubStatusMessage;
        if (params.preFetchedRepos) {
            repos = params.preFetchedRepos;
            evidence = (0, githubAnalyzer_1.extractEvidenceFromRepos)(repos);
            totalPublicRepos = params.preFetchedQuality?.totalPublicRepos ?? repos.length;
            scannedCount = params.preFetchedQuality?.scannedCount ?? repos.length;
            failedCount = params.preFetchedQuality?.failedCount ?? 0;
            githubQuality = params.preFetchedQuality?.dataQuality ?? 'COMPLETE';
            githubStatusMessage = params.preFetchedQuality?.statusMessage;
            // Store repos and evidence for this specific analysis run
            for (const repo of repos) {
                const [savedRepo] = await db_1.db.insert(schema_1.repositories).values({
                    analysisId,
                    userId,
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
                const repoEvidence = evidence.filter(e => e.metadata?.repository === repo.name);
                if (repoEvidence.length > 0) {
                    await db_1.db.insert(schema_1.repositoryEvidence).values(repoEvidence.map(e => ({
                        repositoryId: savedRepo.id,
                        userId,
                        skill: e.skill,
                        evidenceType: e.evidenceType,
                        source: e.source,
                        detail: e.detail,
                        confidence: e.confidence,
                        metadata: e.metadata,
                    })));
                }
            }
        }
        else if (isDemo) {
            repos = demoData_1.DEMO_REPOS;
            evidence = demoData_1.DEMO_EVIDENCE;
            totalPublicRepos = demoData_1.DEMO_REPOS.length;
            scannedCount = demoData_1.DEMO_REPOS.length;
            githubQuality = 'COMPLETE';
            // Store demo repos scoped to this analysis
            for (const repo of repos) {
                const [savedRepo] = await db_1.db.insert(schema_1.repositories).values({
                    analysisId,
                    userId,
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
                const repoEvidence = evidence.filter(e => e.metadata?.repository === repo.name);
                if (repoEvidence.length > 0) {
                    await db_1.db.insert(schema_1.repositoryEvidence).values(repoEvidence.map(e => ({
                        repositoryId: savedRepo.id,
                        userId,
                        skill: e.skill,
                        evidenceType: e.evidenceType,
                        source: e.source,
                        detail: e.detail,
                        confidence: e.confidence,
                        metadata: e.metadata,
                    })));
                }
            }
        }
        else if (githubUsername && githubUsername.trim()) {
            try {
                const scanResult = await (0, githubAnalyzer_1.scanGitHubAccountWithQuality)(githubUsername.trim());
                repos = scanResult.repos;
                totalPublicRepos = scanResult.totalPublicRepos;
                scannedCount = scanResult.scannedCount;
                failedCount = scanResult.failedCount;
                githubQuality = scanResult.dataQuality;
                githubStatusMessage = scanResult.statusMessage;
                evidence = (0, githubAnalyzer_1.extractEvidenceFromRepos)(repos);
                // Store repos and evidence scoped to this analysis
                for (const repo of repos) {
                    const [savedRepo] = await db_1.db.insert(schema_1.repositories).values({
                        analysisId,
                        userId,
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
                    const repoEvidence = evidence.filter(e => e.metadata?.repository === repo.name);
                    if (repoEvidence.length > 0) {
                        await db_1.db.insert(schema_1.repositoryEvidence).values(repoEvidence.map(e => ({
                            repositoryId: savedRepo.id,
                            userId,
                            skill: e.skill,
                            evidenceType: e.evidenceType,
                            source: e.source,
                            detail: e.detail,
                            confidence: e.confidence,
                            metadata: e.metadata,
                        })));
                    }
                }
            }
            catch (ghErr) {
                console.warn('GitHub fetch warning (continuing analysis with available evidence):', ghErr);
                githubQuality = 'PARTIAL';
                githubStatusMessage = 'Some GitHub evidence could not be retrieved, so this audit may be incomplete.';
                if (isDemo || githubUsername?.toLowerCase() === 'arjunsharma') {
                    repos = demoData_1.DEMO_REPOS;
                    evidence = demoData_1.DEMO_EVIDENCE;
                    totalPublicRepos = demoData_1.DEMO_REPOS.length;
                    scannedCount = demoData_1.DEMO_REPOS.length;
                }
                else {
                    repos = [];
                    evidence = [];
                }
            }
        }
        else {
            // Use existing stored evidence scoped to this user
            const storedRepos = await db_1.db.select().from(schema_1.repositories).where((0, drizzle_orm_1.eq)(schema_1.repositories.userId, userId));
            repos = storedRepos.map((r) => r.analyzedData).filter(Boolean);
            totalPublicRepos = repos.length;
            scannedCount = repos.length;
            githubQuality = repos.length > 0 ? 'COMPLETE' : 'LIMITED';
            const storedEvidence = await db_1.db.select().from(schema_1.repositoryEvidence).where((0, drizzle_orm_1.eq)(schema_1.repositoryEvidence.userId, userId));
            evidence = storedEvidence.map((e) => ({
                skill: e.skill,
                evidenceType: e.evidenceType,
                source: e.source,
                detail: e.detail,
                confidence: e.confidence,
                metadata: e.metadata,
            }));
        }
        // Step 4: Process Job Description Requirements
        await updateProgress('analyzing_evidence', 65, 'Mapping job description requirements...');
        let jobRequirements = [];
        let targetJobQuality = 'COMPLETE';
        if (isDemo) {
            jobRequirements = demoData_1.DEMO_PARSED_JOB.allRequirements;
            targetJobQuality = 'COMPLETE';
        }
        else if (jobDescriptionText && jobDescriptionText.trim().length >= 20) {
            const parsedJd = (0, jobParser_1.parseJobDescription)(jobDescriptionText);
            jobRequirements = parsedJd.allRequirements;
            targetJobQuality = parsedJd.dataQuality;
            await db_1.db.insert(schema_1.jobDescriptions).values({
                userId,
                title: parsedJd.title || params.targetRole,
                company: parsedJd.company || 'Target Employer',
                rawText: jobDescriptionText,
                parsedData: parsedJd,
            });
        }
        else if (jobDescriptionId) {
            const [jd] = await db_1.db.select().from(schema_1.jobDescriptions).where((0, drizzle_orm_1.eq)(schema_1.jobDescriptions.id, jobDescriptionId)).limit(1);
            if (jd?.parsedData) {
                const parsed = jd.parsedData;
                jobRequirements = parsed.allRequirements || [];
                targetJobQuality = parsed.dataQuality || (jobRequirements.length >= 2 ? 'COMPLETE' : 'LIMITED');
            }
        }
        else {
            targetJobQuality = 'LIMITED';
        }
        // Stage 4: Checking resume ↔ GitHub evidence
        await updateProgress('matching_claims', 57, 'Checking resume ↔ GitHub evidence');
        const findings = (0, evidenceEngine_1.matchClaimsToEvidence)(claims, evidence, jobRequirements);
        // Stage 5: Comparing against target role
        await updateProgress('matching_claims', 71, 'Comparing against target role');
        // Stage 6: Running recruiter perspective audit
        await updateProgress('matching_claims', 85, 'Running recruiter perspective audit');
        const recruiterAudit = (0, recruiterAudit_1.performRecruiterAudit)(repos, parsedResume, targetRole);
        // Stage 7: Building your application plan
        await updateProgress('generating_recommendations', 95, 'Building your application plan');
        const sourceCoverage = {
            resume: claims.length > 0 ? 'COMPLETE' : 'PARTIAL',
            github: {
                quality: githubQuality,
                totalPublicRepos,
                scannedCount,
                failedCount,
                message: githubStatusMessage,
            },
            targetJob: targetJobQuality,
        };
        const preApplicationDecision = (0, preApplicationDecision_1.generatePreApplicationDecision)({
            findings,
            recruiterAudit,
            repos,
            parsedResume,
            targetRole,
            jobRequirements,
            sourceCoverage,
        });
        const recs = (0, evidenceEngine_1.generateRecommendations)(findings, repos);
        const dimensions = (0, evidenceEngine_1.calculateDimensions)(findings, repos, jobRequirements, recruiterAudit.readiness.score);
        const overallScore = (0, evidenceEngine_1.calculateOverallScore)(dimensions);
        const actionPlan = (0, preApplicationDecision_1.generateActionPlanFromDecision)(preApplicationDecision, findings);
        // Attach recruiter audit and preApplicationDecision to dimensions so it persists with the analysis record
        const dimensionsPayload = {
            ...dimensions,
            recruiterAudit,
            preApplicationDecision,
        };
        // Clean up any old findings for this analysis
        await db_1.db.delete(schema_1.analysisFindings).where((0, drizzle_orm_1.eq)(schema_1.analysisFindings.analysisId, analysisId));
        await db_1.db.delete(schema_1.recommendations).where((0, drizzle_orm_1.eq)(schema_1.recommendations.analysisId, analysisId));
        await db_1.db.delete(schema_1.actionItems).where((0, drizzle_orm_1.eq)(schema_1.actionItems.analysisId, analysisId));
        // Save findings
        if (findings.length > 0) {
            await db_1.db.insert(schema_1.analysisFindings).values(findings.map(f => ({
                analysisId,
                userId,
                skill: f.skill,
                resumeClaim: f.resumeClaim,
                claimLevel: f.claimLevel,
                evidenceStatus: f.evidenceStatus,
                evidenceSources: f.evidenceSources,
                assessment: f.assessment,
                confidence: f.confidence,
                priority: f.priority,
            })));
        }
        // Save recommendations
        if (recs.length > 0) {
            await db_1.db.insert(schema_1.recommendations).values(recs.map(r => ({
                analysisId,
                userId,
                title: r.title,
                observation: r.observation,
                evidence: r.evidence,
                problem: r.problem,
                hiringImpact: r.hiringImpact,
                recommendation: r.recommendation,
                priority: r.priority,
                confidence: r.confidence,
                actionType: r.actionType,
                targetProject: r.targetProject || null,
            })));
        }
        // Save action items
        if (actionPlan.length > 0) {
            await db_1.db.insert(schema_1.actionItems).values(actionPlan.map(a => ({
                analysisId,
                userId,
                day: a.day,
                title: a.title,
                description: a.description,
                priority: a.priority,
            })));
        }
        // Save progress snapshot
        const verifiedCount = findings.filter(f => f.evidenceStatus === 'verified' || f.evidenceStatus === 'supported').length;
        const unverifiedCount = findings.filter(f => f.evidenceStatus === 'unverified').length;
        const weakCount = findings.filter(f => f.evidenceStatus === 'weakly_supported').length;
        await db_1.db.insert(schema_1.progressSnapshots).values({
            userId,
            analysisId,
            overallScore,
            dimensions: dimensionsPayload,
            claimConsistency: dimensions.claimConsistency,
            verifiedSkills: verifiedCount,
            unverifiedSkills: unverifiedCount,
            totalSkills: findings.length,
        });
        const summary = `Analyzed ${findings.length} skills: ${verifiedCount} verified/supported, ${weakCount} fragile, ${unverifiedCount} unverified. Recruiter audit: ${recruiterAudit.summary.strongProjectsCount} strong, ${recruiterAudit.summary.needsReviewCount} needs review.`;
        // Finalize analysis record
        await db_1.db.update(schema_1.analyses).set({
            status: 'completed',
            progress: 100,
            progressMessage: 'GapCheck audit complete!',
            overallScore,
            dimensions: dimensionsPayload,
            repositoriesSnapshot: repos,
            summary,
            completedAt: new Date(),
            updatedAt: new Date(),
        }).where((0, drizzle_orm_1.eq)(schema_1.analyses.id, analysisId));
        console.log(`✅ Analysis ${analysisId} completed successfully: score=${overallScore}%`);
    }
    catch (err) {
        console.error(`❌ Analysis ${analysisId} failed:`, err);
        await db_1.db.update(schema_1.analyses).set({
            status: 'failed',
            progressMessage: `Analysis failed: ${err.message}`.slice(0, 480),
            updatedAt: new Date(),
        }).where((0, drizzle_orm_1.eq)(schema_1.analyses.id, analysisId));
    }
}
// Get analysis status
router.get('/:id', auth_1.authenticate, async (req, res) => {
    try {
        if (!isValidUuid(req.params.id)) {
            res.status(400).json({ error: 'INVALID_ID', message: 'Invalid audit identifier format' });
            return;
        }
        const [analysis] = await db_1.db.select().from(schema_1.analyses)
            .where((0, drizzle_orm_1.eq)(schema_1.analyses.id, req.params.id))
            .limit(1);
        if (!analysis) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Audit not found' });
            return;
        }
        if (analysis.userId !== req.userId) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this audit' });
            return;
        }
        res.json({ analysis });
    }
    catch (err) {
        console.error('Get analysis error:', err);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to get analysis' });
    }
});
// Get analysis results (full)
router.get('/:id/results', auth_1.authenticate, async (req, res) => {
    try {
        if (!isValidUuid(req.params.id)) {
            res.status(400).json({ error: 'INVALID_ID', message: 'Invalid audit identifier format' });
            return;
        }
        const [analysis] = await db_1.db.select().from(schema_1.analyses)
            .where((0, drizzle_orm_1.eq)(schema_1.analyses.id, req.params.id))
            .limit(1);
        if (!analysis) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Audit not found' });
            return;
        }
        if (analysis.userId !== req.userId) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this audit' });
            return;
        }
        const findings = await db_1.db.select().from(schema_1.analysisFindings)
            .where((0, drizzle_orm_1.eq)(schema_1.analysisFindings.analysisId, analysis.id));
        const recs = await db_1.db.select().from(schema_1.recommendations)
            .where((0, drizzle_orm_1.eq)(schema_1.recommendations.analysisId, analysis.id));
        const actions = await db_1.db.select().from(schema_1.actionItems)
            .where((0, drizzle_orm_1.eq)(schema_1.actionItems.analysisId, analysis.id));
        res.json({
            analysis,
            findings,
            recommendations: recs,
            actionPlan: actions,
        });
    }
    catch (err) {
        console.error('Get results error:', err);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to get analysis results' });
    }
});
// Get user's analyses history
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const userAnalyses = await db_1.db.select().from(schema_1.analyses)
            .where((0, drizzle_orm_1.eq)(schema_1.analyses.userId, req.userId))
            .orderBy((0, drizzle_orm_1.desc)(schema_1.analyses.createdAt));
        res.json({ analyses: userAnalyses });
    }
    catch (err) {
        console.error('Get analyses error:', err);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to get analyses' });
    }
});
// Rescan GitHub: creates a new immutable audit snapshot with computed delta
router.post('/:id/rescan', auth_1.authenticate, rateLimiter_1.analysisRateLimiter, async (req, res) => {
    try {
        const analysisId = req.params.id;
        const userId = req.userId;
        if (!isValidUuid(analysisId)) {
            res.status(400).json({ error: 'INVALID_ID', message: 'Invalid audit identifier format' });
            return;
        }
        const [prevAnalysis] = await db_1.db.select().from(schema_1.analyses)
            .where((0, drizzle_orm_1.eq)(schema_1.analyses.id, analysisId))
            .limit(1);
        if (!prevAnalysis) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Audit not found' });
            return;
        }
        if (prevAnalysis.userId !== userId) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this audit' });
            return;
        }
        // Determine GitHub username
        let githubUsername = prevAnalysis.githubUsername;
        if (!githubUsername) {
            const [account] = await db_1.db.select().from(schema_1.githubAccounts).where((0, drizzle_orm_1.eq)(schema_1.githubAccounts.userId, userId)).limit(1);
            if (account?.username) {
                githubUsername = account.username;
            }
        }
        if (!githubUsername) {
            res.status(400).json({ error: 'INVALID_REQUEST', message: 'No GitHub profile is associated with this audit to rescan.' });
            return;
        }
        // Step 1: Scan GitHub (new state)
        let scanResult;
        try {
            scanResult = await (0, githubAnalyzer_1.scanGitHubAccountWithQuality)(githubUsername);
        }
        catch (ghErr) {
            res.status(502).json({
                error: 'RESCAN_FAILED',
                message: `GitHub could not be scanned: ${ghErr.message || 'API error'}. Your previous audit is unchanged.`,
            });
            return;
        }
        if (scanResult.dataQuality === 'LIMITED' && scanResult.statusMessage?.includes('could not be retrieved')) {
            res.status(502).json({
                error: 'RESCAN_FAILED',
                message: `GitHub could not be scanned: ${scanResult.statusMessage}. Your previous audit is unchanged.`,
            });
            return;
        }
        const newRepos = scanResult.repos;
        // Step 2: Retrieve previous repos snapshot
        let prevRepos = [];
        if (prevAnalysis.repositoriesSnapshot && Array.isArray(prevAnalysis.repositoriesSnapshot)) {
            prevRepos = prevAnalysis.repositoriesSnapshot;
        }
        else {
            const storedPrevRepos = await db_1.db.select().from(schema_1.repositories).where((0, drizzle_orm_1.eq)(schema_1.repositories.analysisId, prevAnalysis.id));
            prevRepos = storedPrevRepos.map((r) => r.analyzedData).filter(Boolean);
        }
        // Compute Delta:
        const prevRepoNames = new Set(prevRepos.map(r => r.name.toLowerCase()));
        const newRepoNames = new Set(newRepos.map(r => r.name.toLowerCase()));
        const repositoriesAdded = newRepos.filter(r => !prevRepoNames.has(r.name.toLowerCase())).length;
        const repositoriesRemoved = prevRepos.filter(r => !newRepoNames.has(r.name.toLowerCase())).length;
        let repositoriesChanged = 0;
        let readmesAdded = 0;
        for (const newRepo of newRepos) {
            const oldRepo = prevRepos.find(r => r.name.toLowerCase() === newRepo.name.toLowerCase());
            if (oldRepo) {
                const commitChanged = (newRepo.commitCount || 0) !== (oldRepo.commitCount || 0);
                const lastCommitChanged = newRepo.lastCommitAt !== oldRepo.lastCommitAt;
                if (commitChanged || lastCommitChanged) {
                    repositoriesChanged++;
                }
                if (!oldRepo.hasReadme && newRepo.hasReadme) {
                    readmesAdded++;
                }
            }
        }
        // Previous verified skills
        const prevFindings = await db_1.db.select().from(schema_1.analysisFindings).where((0, drizzle_orm_1.eq)(schema_1.analysisFindings.analysisId, prevAnalysis.id));
        const prevVerifiedSkills = new Set(prevFindings.filter((f) => f.evidenceStatus === 'verified' || f.evidenceStatus === 'supported').map((f) => f.skill.toLowerCase()));
        // Create the new analysis record
        const [newAnalysis] = await db_1.db.insert(schema_1.analyses).values({
            userId,
            resumeId: prevAnalysis.resumeId,
            githubAccountId: prevAnalysis.githubAccountId,
            jobDescriptionId: prevAnalysis.jobDescriptionId,
            targetRole: prevAnalysis.targetRole || 'Software Engineer',
            company: prevAnalysis.company,
            githubUsername,
            resumeTextSnapshot: prevAnalysis.resumeTextSnapshot,
            jobDescriptionTextSnapshot: prevAnalysis.jobDescriptionTextSnapshot,
            parentAnalysisId: prevAnalysis.id,
            status: 'pending',
            progress: 0,
            progressMessage: 'Starting rescan...',
        }).returning();
        // Run analysis synchronously for rescan
        await runAnalysis({
            analysisId: newAnalysis.id,
            userId,
            resumeId: prevAnalysis.resumeId,
            resumeText: prevAnalysis.resumeTextSnapshot,
            githubUsername,
            jobDescriptionId: prevAnalysis.jobDescriptionId,
            jobDescriptionText: prevAnalysis.jobDescriptionTextSnapshot,
            targetRole: prevAnalysis.targetRole || 'Software Engineer',
            company: prevAnalysis.company,
            isDemo: false,
            preFetchedRepos: newRepos,
            preFetchedQuality: scanResult,
        });
        // Check newly supported / no longer supported claims
        const newFindings = await db_1.db.select().from(schema_1.analysisFindings).where((0, drizzle_orm_1.eq)(schema_1.analysisFindings.analysisId, newAnalysis.id));
        const newVerifiedSkills = new Set(newFindings.filter((f) => f.evidenceStatus === 'verified' || f.evidenceStatus === 'supported').map((f) => f.skill.toLowerCase()));
        let claimsNewlySupported = 0;
        let claimsNoLongerSupported = 0;
        for (const skill of newVerifiedSkills) {
            if (!prevVerifiedSkills.has(skill))
                claimsNewlySupported++;
        }
        for (const skill of prevVerifiedSkills) {
            if (!newVerifiedSkills.has(skill))
                claimsNoLongerSupported++;
        }
        const delta = {
            repositoriesAdded,
            repositoriesRemoved,
            repositoriesChanged,
            readmesAdded,
            claimsNewlySupported,
            claimsNoLongerSupported,
        };
        // Store delta on new analysis
        await db_1.db.update(schema_1.analyses).set({
            deltaFromPrevious: delta,
        }).where((0, drizzle_orm_1.eq)(schema_1.analyses.id, newAnalysis.id));
        res.json({
            previousAnalysisId: prevAnalysis.id,
            newAnalysisId: newAnalysis.id,
            delta,
            analysis: {
                id: newAnalysis.id,
                status: 'completed',
            },
        });
    }
    catch (err) {
        console.error('Rescan error:', err);
        res.status(500).json({ error: 'SERVER_ERROR', message: `Rescan failed: ${err.message}` });
    }
});
// Retry a failed analysis using preserved configuration
router.post('/:id/retry', auth_1.authenticate, rateLimiter_1.analysisRateLimiter, async (req, res) => {
    try {
        const analysisId = req.params.id;
        const userId = req.userId;
        if (!isValidUuid(analysisId)) {
            res.status(400).json({ error: 'INVALID_ID', message: 'Invalid audit identifier format' });
            return;
        }
        const [analysis] = await db_1.db.select().from(schema_1.analyses)
            .where((0, drizzle_orm_1.eq)(schema_1.analyses.id, analysisId))
            .limit(1);
        if (!analysis) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Audit not found' });
            return;
        }
        if (analysis.userId !== userId) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this audit' });
            return;
        }
        if (analysis.status === 'completed') {
            res.status(400).json({
                error: 'INVALID_STATE',
                message: 'This audit is already completed. Use Rescan to run an updated audit.'
            });
            return;
        }
        // Reset status to pending
        await db_1.db.update(schema_1.analyses).set({
            status: 'pending',
            progress: 0,
            progressMessage: 'Retrying audit...',
            updatedAt: new Date(),
        }).where((0, drizzle_orm_1.eq)(schema_1.analyses.id, analysisId));
        // Run analysis with preserved configuration
        const isDemo = analysis.githubUsername?.toLowerCase() === 'arjunsharma';
        const retryPromise = runAnalysis({
            analysisId: analysis.id,
            userId,
            resumeId: analysis.resumeId,
            resumeText: analysis.resumeTextSnapshot,
            githubUsername: analysis.githubUsername,
            jobDescriptionId: analysis.jobDescriptionId,
            jobDescriptionText: analysis.jobDescriptionTextSnapshot,
            targetRole: analysis.targetRole || 'Software Engineer',
            company: analysis.company,
            isDemo,
        });
        const result = await Promise.race([
            retryPromise.then(() => 'completed'),
            new Promise(resolve => setTimeout(() => resolve('pending'), 1500)),
        ]);
        res.json({
            analysisId: analysis.id,
            status: result,
            message: 'Analysis retry initiated',
        });
    }
    catch (err) {
        console.error('Retry analysis error:', err);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to retry analysis' });
    }
});
// Stream downloadable PDF Audit Report
router.get(['/:id/report.pdf', '/:id/report'], auth_1.authenticate, async (req, res) => {
    try {
        const analysisId = req.params.id;
        if (!isValidUuid(analysisId)) {
            res.status(400).json({ error: 'INVALID_ID', message: 'Invalid audit identifier format' });
            return;
        }
        const [analysis] = await db_1.db.select().from(schema_1.analyses)
            .where((0, drizzle_orm_1.eq)(schema_1.analyses.id, analysisId))
            .limit(1);
        if (!analysis) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Audit not found' });
            return;
        }
        if (analysis.userId !== req.userId) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this audit report' });
            return;
        }
        const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, req.userId)).limit(1);
        const findings = await db_1.db.select().from(schema_1.analysisFindings).where((0, drizzle_orm_1.eq)(schema_1.analysisFindings.analysisId, analysis.id));
        const recs = await db_1.db.select().from(schema_1.recommendations).where((0, drizzle_orm_1.eq)(schema_1.recommendations.analysisId, analysis.id));
        const actions = await db_1.db.select().from(schema_1.actionItems).where((0, drizzle_orm_1.eq)(schema_1.actionItems.analysisId, analysis.id));
        let rawResumeText = '';
        let parsedResumeData = null;
        if (analysis.resumeId) {
            const [resObj] = await db_1.db.select().from(schema_1.resumes).where((0, drizzle_orm_1.eq)(schema_1.resumes.id, analysis.resumeId)).limit(1);
            rawResumeText = resObj?.rawText || '';
            parsedResumeData = resObj?.parsedData;
        }
        const candidateName = parsedResumeData?.personal?.name || user?.name || 'Candidate';
        const reportData = {
            candidateName,
            candidateEmail: parsedResumeData?.personal?.email || user?.email,
            targetRole: analysis.targetRole || 'Software Engineer',
            analysisDate: new Date(analysis.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            }),
            overallScore: analysis.overallScore || 0,
            dimensions: analysis.dimensions || {
                resumeQuality: 0,
                engineeringEvidence: 0,
                roleAlignment: 0,
                claimConsistency: 0,
            },
            summary: analysis.summary || 'Profile audit conducted across public code repositories and requirements.',
            findings: findings.map((f) => ({
                skill: f.skill,
                resumeClaim: f.resumeClaim,
                evidenceStatus: f.evidenceStatus,
                priority: f.priority,
                assessment: f.assessment,
                evidenceSources: f.evidenceSources,
            })),
            recommendations: recs.map((r) => ({
                title: r.title,
                problem: r.problem,
                hiringImpact: r.hiringImpact,
                recommendation: r.recommendation,
                priority: r.priority,
                targetProject: r.targetProject,
            })),
            actionPlan: actions.map((a) => ({
                day: a.day,
                title: a.title,
                description: a.description,
                priority: a.priority,
                completed: a.completed,
            })),
            rawResumeText,
            recruiterAudit: analysis.dimensions?.recruiterAudit,
            preApplicationDecision: analysis.dimensions?.preApplicationDecision,
        };
        (0, reportGenerator_1.streamAuditReportPdf)(reportData, res);
    }
    catch (err) {
        console.error('Audit report PDF generation error:', err);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to generate PDF report' });
    }
});
// Stream downloadable Annotated Resume PDF
router.get('/:id/annotated-resume.pdf', auth_1.authenticate, async (req, res) => {
    try {
        const analysisId = req.params.id;
        if (!isValidUuid(analysisId)) {
            res.status(400).json({ error: 'INVALID_ID', message: 'Invalid audit identifier format' });
            return;
        }
        const [analysis] = await db_1.db.select().from(schema_1.analyses)
            .where((0, drizzle_orm_1.eq)(schema_1.analyses.id, analysisId))
            .limit(1);
        if (!analysis) {
            res.status(404).json({ error: 'NOT_FOUND', message: 'Audit not found' });
            return;
        }
        if (analysis.userId !== req.userId) {
            res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this annotated resume' });
            return;
        }
        const [user] = await db_1.db.select().from(schema_1.users).where((0, drizzle_orm_1.eq)(schema_1.users.id, req.userId)).limit(1);
        const findings = await db_1.db.select().from(schema_1.analysisFindings).where((0, drizzle_orm_1.eq)(schema_1.analysisFindings.analysisId, analysis.id));
        let rawResumeText = '';
        let parsedResumeData = null;
        if (analysis.resumeId) {
            const [resObj] = await db_1.db.select().from(schema_1.resumes).where((0, drizzle_orm_1.eq)(schema_1.resumes.id, analysis.resumeId)).limit(1);
            rawResumeText = resObj?.rawText || '';
            parsedResumeData = resObj?.parsedData;
        }
        const candidateName = parsedResumeData?.personal?.name || user?.name || 'Candidate';
        if (!rawResumeText) {
            rawResumeText = `${candidateName}\nEmail: ${parsedResumeData?.personal?.email || user?.email || 'candidate@example.com'}\n\nTECHNICAL SKILLS:\n` +
                findings.map((f) => `- ${f.skill}`).join('\n');
        }
        const reportData = {
            candidateName,
            candidateEmail: parsedResumeData?.personal?.email || user?.email,
            targetRole: analysis.targetRole || 'Software Engineer',
            analysisDate: new Date(analysis.createdAt).toLocaleDateString('en-US'),
            overallScore: analysis.overallScore || 0,
            dimensions: analysis.dimensions || {},
            summary: analysis.summary || '',
            findings: findings.map((f) => ({
                skill: f.skill,
                resumeClaim: f.resumeClaim,
                evidenceStatus: f.evidenceStatus,
                priority: f.priority,
                assessment: f.assessment,
                evidenceSources: f.evidenceSources,
            })),
            recommendations: [],
            actionPlan: [],
            rawResumeText,
        };
        (0, reportGenerator_1.streamAnnotatedResumePdf)(reportData, res);
    }
    catch (err) {
        console.error('Annotated resume PDF generation error:', err);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to generate annotated resume' });
    }
});
exports.default = router;
//# sourceMappingURL=analysis.js.map