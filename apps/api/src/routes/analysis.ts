
import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import {
  analyses, analysisFindings, recommendations as recsTable, actionItems,
  progressSnapshots, resumes, resumeClaims, githubAccounts, repositories,
  repositoryEvidence, jobDescriptions, jobRequirements as jobReqsTable, users
} from '../db/schema';
import { eq, desc } from 'drizzle-orm';
import { extractClaims, parseResumeText, ParsedResume, ResumeClaim } from '../services/resumeParser';
import {
  fetchRepositories, scanGitHubAccountWithQuality, extractEvidenceFromRepos,
  GitHubRepo, RepoEvidence, normalizeGitHubInput, GitHubScanResult, DataQuality
} from '../services/githubAnalyzer';
import {
  matchClaimsToEvidence, generateRecommendations, calculateDimensions,
  calculateOverallScore, generateActionPlan
} from '../services/evidenceEngine';
import { parseJobDescription, ParsedJobDescription } from '../services/jobParser';
import {
  DEMO_PARSED_RESUME, DEMO_CLAIMS, DEMO_REPOS, DEMO_EVIDENCE,
  DEMO_PARSED_JOB
} from '../services/demoData';
import { streamAuditReportPdf, streamAnnotatedResumePdf } from '../services/reportGenerator';
import { performRecruiterAudit } from '../services/recruiterAudit';
import { generatePreApplicationDecision, generateActionPlanFromDecision, SourceCoverage } from '../services/preApplicationDecision';
import { analysisRateLimiter } from '../middleware/rateLimiter';

const router = Router();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

// Start analysis
router.post('/start', authenticate, analysisRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const {
      resumeId,
      resumeText,
      githubUsername,
      jobDescriptionId,
      jobDescriptionText,
      targetRole,
      company,
      isDemo
    } = req.body;
    const userId = req.userId!;

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

    let cleanGithubUsername: string | null = null;
    try {
      cleanGithubUsername = normalizeGitHubInput(githubUsername);
    } catch (err: any) {
      res.status(400).json({ error: 'INVALID_INPUT', message: err.message || 'Invalid GitHub profile URL or username' });
      return;
    }

    // Create analysis record
    const [analysis] = await db.insert(analyses).values({
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
  } catch (err) {
    console.error('Start analysis error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to start analysis' });
  }
});

interface RunAnalysisParams {
  analysisId: string;
  userId: string;
  resumeId?: string | null;
  resumeText?: string | null;
  githubUsername?: string | null;
  jobDescriptionId?: string | null;
  jobDescriptionText?: string | null;
  targetRole: string;
  company?: string | null;
  isDemo: boolean;
  preFetchedRepos?: GitHubRepo[];
  preFetchedQuality?: GitHubScanResult;
}

async function runAnalysis(params: RunAnalysisParams) {
  const {
    analysisId,
    userId,
    resumeId,
    resumeText,
    githubUsername,
    jobDescriptionId,
    jobDescriptionText,
    targetRole,
    isDemo,
  } = params;

  const updateProgress = async (status: string, progress: number, message: string) => {
    try {
      await db.update(analyses).set({
        status: status as any,
        progress,
        progressMessage: message,
        updatedAt: new Date(),
      }).where(eq(analyses.id as any, analysisId));
    } catch (e) {
      console.warn('Progress update warning:', e);
    }
  };

  try {
    // Stage 1: Reading resume
    await updateProgress('parsing_resume', 14, 'Reading resume');
    let claims: ResumeClaim[] = [];
    let parsedResume: ParsedResume;

    if (isDemo) {
      parsedResume = DEMO_PARSED_RESUME;
      claims = DEMO_CLAIMS;
    } else if (resumeText && resumeText.trim().length >= 20) {
      const parsedRes = parseResumeText(resumeText);
      parsedResume = parsedRes.parsed;
      claims = extractClaims(parsedResume);

      // Save to database
      const [savedResume] = await db.insert(resumes).values({
        userId,
        filename: 'Pasted-Resume.txt',
        filePath: 'raw_text',
        rawText: resumeText,
        parsedData: parsedResume as any,
      }).returning();

      if (claims.length > 0) {
        await db.insert(resumeClaims).values(
          claims.map((claim: any) => ({
            resumeId: savedResume.id,
            userId,
            claim: claim.claim,
            claimType: claim.claimType,
            category: claim.category,
            proficiencyLevel: claim.proficiencyLevel || null,
            source: claim.source,
            context: claim.context || null,
          }))
        );
      }
    } else if (resumeId) {
      const [resume] = await db.select().from(resumes).where(eq(resumes.id as any, resumeId)).limit(1);
      if (resume?.parsedData) {
        parsedResume = resume.parsedData as unknown as ParsedResume;
        claims = extractClaims(parsedResume);
      } else {
        parsedResume = DEMO_PARSED_RESUME;
        claims = DEMO_CLAIMS;
      }
    } else {
      // Check if user has an existing resume
      const [existingResume] = await db.select().from(resumes).where(eq(resumes.userId, userId)).orderBy(desc(resumes.createdAt)).limit(1);
      if (existingResume?.parsedData) {
        parsedResume = existingResume.parsedData as unknown as ParsedResume;
        claims = extractClaims(parsedResume);
      } else {
        parsedResume = DEMO_PARSED_RESUME;
        claims = DEMO_CLAIMS;
      }
    }

    // Update candidate profile name and target role from parsed resume if available
    if (parsedResume.personal?.name && parsedResume.personal.name !== 'Arjun Sharma') {
      try {
        await db.update(users).set({
          name: parsedResume.personal.name,
          targetRole,
          updatedAt: new Date(),
        }).where(eq(users.id, userId));
      } catch (err) {
        console.warn('Failed to update candidate name in user profile:', err);
      }
    }

    // Stage 2: Scanning public GitHub profile
    await updateProgress('analyzing_github', 28, 'Scanning public GitHub profile');

    // Stage 3: Analyzing repositories
    await updateProgress('analyzing_github', 42, 'Analyzing repositories');
    let repos: GitHubRepo[] = [];
    let evidence: RepoEvidence[] = [];
    let githubQuality: DataQuality = 'COMPLETE';
    let totalPublicRepos = 0;
    let scannedCount = 0;
    let failedCount = 0;
    let githubStatusMessage: string | undefined;

    if (params.preFetchedRepos) {
      repos = params.preFetchedRepos;
      evidence = extractEvidenceFromRepos(repos);
      totalPublicRepos = params.preFetchedQuality?.totalPublicRepos ?? repos.length;
      scannedCount = params.preFetchedQuality?.scannedCount ?? repos.length;
      failedCount = params.preFetchedQuality?.failedCount ?? 0;
      githubQuality = params.preFetchedQuality?.dataQuality ?? 'COMPLETE';
      githubStatusMessage = params.preFetchedQuality?.statusMessage;

      // Store repos and evidence for this specific analysis run
      for (const repo of repos) {
        const [savedRepo] = await db.insert(repositories).values({
          analysisId,
          userId,
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

        const repoEvidence = evidence.filter(e => e.metadata?.repository === repo.name);
        if (repoEvidence.length > 0) {
          await db.insert(repositoryEvidence).values(
            repoEvidence.map(e => ({
              repositoryId: savedRepo.id,
              userId,
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
    } else if (isDemo) {
      repos = DEMO_REPOS;
      evidence = DEMO_EVIDENCE;
      totalPublicRepos = DEMO_REPOS.length;
      scannedCount = DEMO_REPOS.length;
      githubQuality = 'COMPLETE';

      // Store demo repos scoped to this analysis
      for (const repo of repos) {
        const [savedRepo] = await db.insert(repositories).values({
          analysisId,
          userId,
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

        const repoEvidence = evidence.filter(e => e.metadata?.repository === repo.name);
        if (repoEvidence.length > 0) {
          await db.insert(repositoryEvidence).values(
            repoEvidence.map(e => ({
              repositoryId: savedRepo.id,
              userId,
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
    } else if (githubUsername && githubUsername.trim()) {
      try {
        const scanResult = await scanGitHubAccountWithQuality(githubUsername.trim());
        repos = scanResult.repos;
        totalPublicRepos = scanResult.totalPublicRepos;
        scannedCount = scanResult.scannedCount;
        failedCount = scanResult.failedCount;
        githubQuality = scanResult.dataQuality;
        githubStatusMessage = scanResult.statusMessage;

        evidence = extractEvidenceFromRepos(repos);

        // Store repos and evidence scoped to this analysis
        for (const repo of repos) {
          const [savedRepo] = await db.insert(repositories).values({
            analysisId,
            userId,
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

          const repoEvidence = evidence.filter(e => e.metadata?.repository === repo.name);
          if (repoEvidence.length > 0) {
            await db.insert(repositoryEvidence).values(
              repoEvidence.map(e => ({
                repositoryId: savedRepo.id,
                userId,
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
      } catch (ghErr: any) {
        console.warn('GitHub fetch warning (continuing analysis with available evidence):', ghErr);
        githubQuality = 'PARTIAL';
        githubStatusMessage = 'Some GitHub evidence could not be retrieved, so this audit may be incomplete.';
        if (isDemo || githubUsername?.toLowerCase() === 'arjunsharma') {
          repos = DEMO_REPOS;
          evidence = DEMO_EVIDENCE;
          totalPublicRepos = DEMO_REPOS.length;
          scannedCount = DEMO_REPOS.length;
        } else {
          repos = [];
          evidence = [];
        }
      }
    } else {
      // Use existing stored evidence scoped to this user
      const storedRepos = await db.select().from(repositories).where(eq(repositories.userId, userId));
      repos = storedRepos.map((r: any) => r.analyzedData as unknown as GitHubRepo).filter(Boolean);
      totalPublicRepos = repos.length;
      scannedCount = repos.length;
      githubQuality = repos.length > 0 ? 'COMPLETE' : 'LIMITED';
      const storedEvidence = await db.select().from(repositoryEvidence).where(eq(repositoryEvidence.userId, userId));
      evidence = storedEvidence.map((e: any) => ({
        skill: e.skill,
        evidenceType: e.evidenceType,
        source: e.source,
        detail: e.detail,
        confidence: e.confidence,
        metadata: e.metadata as any,
      }));
    }

    // Step 4: Process Job Description Requirements
    await updateProgress('analyzing_evidence', 65, 'Mapping job description requirements...');
    let jobRequirements: string[] = [];
    let targetJobQuality: DataQuality = 'COMPLETE';

    if (isDemo) {
      jobRequirements = DEMO_PARSED_JOB.allRequirements;
      targetJobQuality = 'COMPLETE';
    } else if (jobDescriptionText && jobDescriptionText.trim().length >= 20) {
      const parsedJd = parseJobDescription(jobDescriptionText);
      jobRequirements = parsedJd.allRequirements;
      targetJobQuality = parsedJd.dataQuality;

      await db.insert(jobDescriptions).values({
        userId,
        title: parsedJd.title || params.targetRole,
        company: parsedJd.company || 'Target Employer',
        rawText: jobDescriptionText,
        parsedData: parsedJd as any,
      });
    } else if (jobDescriptionId) {
      const [jd] = await db.select().from(jobDescriptions).where(eq(jobDescriptions.id as any, jobDescriptionId)).limit(1);
      if (jd?.parsedData) {
        const parsed = jd.parsedData as any;
        jobRequirements = parsed.allRequirements || [];
        targetJobQuality = parsed.dataQuality || (jobRequirements.length >= 2 ? 'COMPLETE' : 'LIMITED');
      }
    } else {
      targetJobQuality = 'LIMITED';
    }

    // Stage 4: Checking resume ↔ GitHub evidence
    await updateProgress('matching_claims', 57, 'Checking resume ↔ GitHub evidence');
    const findings = matchClaimsToEvidence(claims, evidence, jobRequirements);

    // Stage 5: Comparing against target role
    await updateProgress('matching_claims', 71, 'Comparing against target role');

    // Stage 6: Running recruiter perspective audit
    await updateProgress('matching_claims', 85, 'Running recruiter perspective audit');
    const recruiterAudit = performRecruiterAudit(repos, parsedResume, targetRole);

    // Stage 7: Building your application plan
    await updateProgress('generating_recommendations', 95, 'Building your application plan');

    const sourceCoverage: SourceCoverage = {
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

    const preApplicationDecision = generatePreApplicationDecision({
      findings,
      recruiterAudit,
      repos,
      parsedResume,
      targetRole,
      jobRequirements,
      sourceCoverage,
    });
    const recs = generateRecommendations(findings, repos);
    const dimensions = calculateDimensions(findings, repos, jobRequirements, recruiterAudit.readiness.score);
    const overallScore = calculateOverallScore(dimensions);
    const actionPlan = generateActionPlanFromDecision(preApplicationDecision, findings);

    // Attach recruiter audit and preApplicationDecision to dimensions so it persists with the analysis record
    const dimensionsPayload = {
      ...dimensions,
      recruiterAudit,
      preApplicationDecision,
    };

    // Clean up any old findings for this analysis
    await db.delete(analysisFindings).where(eq(analysisFindings.analysisId, analysisId));
    await db.delete(recsTable).where(eq(recsTable.analysisId, analysisId));
    await db.delete(actionItems).where(eq(actionItems.analysisId, analysisId));

    // Save findings
    if (findings.length > 0) {
      await db.insert(analysisFindings).values(
        findings.map(f => ({
          analysisId,
          userId,
          skill: f.skill,
          resumeClaim: f.resumeClaim,
          claimLevel: f.claimLevel,
          evidenceStatus: f.evidenceStatus,
          evidenceSources: f.evidenceSources as any,
          assessment: f.assessment,
          confidence: f.confidence,
          priority: f.priority,
        }))
      );
    }

    // Save recommendations
    if (recs.length > 0) {
      await db.insert(recsTable).values(
        recs.map(r => ({
          analysisId,
          userId,
          title: r.title,
          observation: r.observation,
          evidence: r.evidence as any,
          problem: r.problem,
          hiringImpact: r.hiringImpact,
          recommendation: r.recommendation,
          priority: r.priority,
          confidence: r.confidence,
          actionType: r.actionType,
          targetProject: r.targetProject || null,
        }))
      );
    }

    // Save action items
    if (actionPlan.length > 0) {
      await db.insert(actionItems).values(
        actionPlan.map(a => ({
          analysisId,
          userId,
          day: a.day,
          title: a.title,
          description: a.description,
          priority: a.priority,
        }))
      );
    }

    // Save progress snapshot
    const verifiedCount = findings.filter(f => f.evidenceStatus === 'verified' || f.evidenceStatus === 'supported').length;
    const unverifiedCount = findings.filter(f => f.evidenceStatus === 'unverified').length;
    const weakCount = findings.filter(f => f.evidenceStatus === 'weakly_supported').length;

    await db.insert(progressSnapshots).values({
      userId,
      analysisId,
      overallScore,
      dimensions: dimensionsPayload as any,
      claimConsistency: dimensions.claimConsistency,
      verifiedSkills: verifiedCount,
      unverifiedSkills: unverifiedCount,
      totalSkills: findings.length,
    });

    const summary = `Analyzed ${findings.length} skills: ${verifiedCount} verified/supported, ${weakCount} fragile, ${unverifiedCount} unverified. Recruiter audit: ${recruiterAudit.summary.strongProjectsCount} strong, ${recruiterAudit.summary.needsReviewCount} needs review.`;

    // Finalize analysis record
    await db.update(analyses).set({
      status: 'completed',
      progress: 100,
      progressMessage: 'GapCheck audit complete!',
      overallScore,
      dimensions: dimensionsPayload as any,
      repositoriesSnapshot: repos as any,
      summary,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(analyses.id as any, analysisId));

    console.log(`✅ Analysis ${analysisId} completed successfully: score=${overallScore}%`);
  } catch (err: any) {
    console.error(`❌ Analysis ${analysisId} failed:`, err);
    await db.update(analyses).set({
      status: 'failed',
      progressMessage: `Analysis failed: ${err.message}`.slice(0, 480),
      updatedAt: new Date(),
    }).where(eq(analyses.id as any, analysisId));
  }
}

// Get analysis status
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!isValidUuid(req.params.id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid audit identifier format' });
      return;
    }

    const [analysis] = await db.select().from(analyses)
      .where(eq(analyses.id as any, req.params.id))
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
  } catch (err) {
    console.error('Get analysis error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to get analysis' });
  }
});

// Get analysis results (full)
router.get('/:id/results', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!isValidUuid(req.params.id)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid audit identifier format' });
      return;
    }

    const [analysis] = await db.select().from(analyses)
      .where(eq(analyses.id as any, req.params.id))
      .limit(1);

    if (!analysis) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Audit not found' });
      return;
    }

    if (analysis.userId !== req.userId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this audit' });
      return;
    }

    const findings = await db.select().from(analysisFindings)
      .where(eq(analysisFindings.analysisId, analysis.id));

    const recs = await db.select().from(recsTable)
      .where(eq(recsTable.analysisId, analysis.id));

    const actions = await db.select().from(actionItems)
      .where(eq(actionItems.analysisId, analysis.id));

    res.json({
      analysis,
      findings,
      recommendations: recs,
      actionPlan: actions,
    });
  } catch (err) {
    console.error('Get results error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to get analysis results' });
  }
});

// Get user's analyses history
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userAnalyses = await db.select().from(analyses)
      .where(eq(analyses.userId, req.userId!))
      .orderBy(desc(analyses.createdAt));

    res.json({ analyses: userAnalyses });
  } catch (err) {
    console.error('Get analyses error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to get analyses' });
  }
});

// Rescan GitHub: creates a new immutable audit snapshot with computed delta
router.post('/:id/rescan', authenticate, analysisRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const analysisId = req.params.id;
    const userId = req.userId!;

    if (!isValidUuid(analysisId)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid audit identifier format' });
      return;
    }

    const [prevAnalysis] = await db.select().from(analyses)
      .where(eq(analyses.id as any, analysisId))
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
      const [account] = await db.select().from(githubAccounts).where(eq(githubAccounts.userId, userId)).limit(1);
      if (account?.username) {
        githubUsername = account.username;
      }
    }

    if (!githubUsername) {
      res.status(400).json({ error: 'INVALID_REQUEST', message: 'No GitHub profile is associated with this audit to rescan.' });
      return;
    }

    // Step 1: Scan GitHub (new state)
    let scanResult: GitHubScanResult;
    try {
      scanResult = await scanGitHubAccountWithQuality(githubUsername);
    } catch (ghErr: any) {
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
    let prevRepos: GitHubRepo[] = [];
    if (prevAnalysis.repositoriesSnapshot && Array.isArray(prevAnalysis.repositoriesSnapshot)) {
      prevRepos = prevAnalysis.repositoriesSnapshot as unknown as GitHubRepo[];
    } else {
      const storedPrevRepos = await db.select().from(repositories).where(eq(repositories.analysisId as any, prevAnalysis.id));
      prevRepos = storedPrevRepos.map((r: any) => r.analyzedData as unknown as GitHubRepo).filter(Boolean);
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
    const prevFindings = await db.select().from(analysisFindings).where(eq(analysisFindings.analysisId, prevAnalysis.id));
    const prevVerifiedSkills = new Set(
      prevFindings.filter((f: any) => f.evidenceStatus === 'verified' || f.evidenceStatus === 'supported').map((f: any) => f.skill.toLowerCase())
    );

    // Create the new analysis record
    const [newAnalysis] = await db.insert(analyses).values({
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
    const newFindings = await db.select().from(analysisFindings).where(eq(analysisFindings.analysisId, newAnalysis.id));
    const newVerifiedSkills = new Set(
      newFindings.filter((f: any) => f.evidenceStatus === 'verified' || f.evidenceStatus === 'supported').map((f: any) => f.skill.toLowerCase())
    );

    let claimsNewlySupported = 0;
    let claimsNoLongerSupported = 0;

    for (const skill of newVerifiedSkills) {
      if (!prevVerifiedSkills.has(skill)) claimsNewlySupported++;
    }
    for (const skill of prevVerifiedSkills) {
      if (!newVerifiedSkills.has(skill)) claimsNoLongerSupported++;
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
    await db.update(analyses).set({
      deltaFromPrevious: delta as any,
    }).where(eq(analyses.id as any, newAnalysis.id));

    res.json({
      previousAnalysisId: prevAnalysis.id,
      newAnalysisId: newAnalysis.id,
      delta,
      analysis: {
        id: newAnalysis.id,
        status: 'completed',
      },
    });
  } catch (err: any) {
    console.error('Rescan error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: `Rescan failed: ${err.message}` });
  }
});

// Retry a failed analysis using preserved configuration
router.post('/:id/retry', authenticate, analysisRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const analysisId = req.params.id;
    const userId = req.userId!;

    if (!isValidUuid(analysisId)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid audit identifier format' });
      return;
    }

    const [analysis] = await db.select().from(analyses)
      .where(eq(analyses.id as any, analysisId))
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
    await db.update(analyses).set({
      status: 'pending',
      progress: 0,
      progressMessage: 'Retrying audit...',
      updatedAt: new Date(),
    }).where(eq(analyses.id as any, analysisId));

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
  } catch (err: any) {
    console.error('Retry analysis error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to retry analysis' });
  }
});

// Stream downloadable PDF Audit Report
router.get(['/:id/report.pdf', '/:id/report'], authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const analysisId = req.params.id;
    if (!isValidUuid(analysisId)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid audit identifier format' });
      return;
    }

    const [analysis] = await db.select().from(analyses)
      .where(eq(analyses.id as any, analysisId))
      .limit(1);

    if (!analysis) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Audit not found' });
      return;
    }

    if (analysis.userId !== req.userId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this audit report' });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    const findings = await db.select().from(analysisFindings).where(eq(analysisFindings.analysisId, analysis.id));
    const recs = await db.select().from(recsTable).where(eq(recsTable.analysisId, analysis.id));
    const actions = await db.select().from(actionItems).where(eq(actionItems.analysisId, analysis.id));

    let rawResumeText = '';
    let parsedResumeData: any = null;
    if (analysis.resumeId) {
      const [resObj] = await db.select().from(resumes).where(eq(resumes.id as any, analysis.resumeId)).limit(1);
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
      dimensions: (analysis.dimensions as any) || {
        resumeQuality: 0,
        engineeringEvidence: 0,
        roleAlignment: 0,
        claimConsistency: 0,
      },
      summary: analysis.summary || 'Profile audit conducted across public code repositories and requirements.',
      findings: findings.map((f: any) => ({
        skill: f.skill,
        resumeClaim: f.resumeClaim,
        evidenceStatus: f.evidenceStatus,
        priority: f.priority,
        assessment: f.assessment,
        evidenceSources: f.evidenceSources,
      })),
      recommendations: recs.map((r: any) => ({
        title: r.title,
        problem: r.problem,
        hiringImpact: r.hiringImpact,
        recommendation: r.recommendation,
        priority: r.priority,
        targetProject: r.targetProject,
      })),
      actionPlan: actions.map((a: any) => ({
        day: a.day,
        title: a.title,
        description: a.description,
        priority: a.priority,
        completed: a.completed,
      })),
      rawResumeText,
      recruiterAudit: (analysis.dimensions as any)?.recruiterAudit,
      preApplicationDecision: (analysis.dimensions as any)?.preApplicationDecision,
    };

    streamAuditReportPdf(reportData, res);
  } catch (err: any) {
    console.error('Audit report PDF generation error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to generate PDF report' });
  }
});

// Stream downloadable Annotated Resume PDF
router.get('/:id/annotated-resume.pdf', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const analysisId = req.params.id;
    if (!isValidUuid(analysisId)) {
      res.status(400).json({ error: 'INVALID_ID', message: 'Invalid audit identifier format' });
      return;
    }

    const [analysis] = await db.select().from(analyses)
      .where(eq(analyses.id as any, analysisId))
      .limit(1);

    if (!analysis) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Audit not found' });
      return;
    }

    if (analysis.userId !== req.userId) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this annotated resume' });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    const findings = await db.select().from(analysisFindings).where(eq(analysisFindings.analysisId, analysis.id));

    let rawResumeText = '';
    let parsedResumeData: any = null;
    if (analysis.resumeId) {
      const [resObj] = await db.select().from(resumes).where(eq(resumes.id as any, analysis.resumeId)).limit(1);
      rawResumeText = resObj?.rawText || '';
      parsedResumeData = resObj?.parsedData;
    }

    const candidateName = parsedResumeData?.personal?.name || user?.name || 'Candidate';
    if (!rawResumeText) {
      rawResumeText = `${candidateName}\nEmail: ${parsedResumeData?.personal?.email || user?.email || 'candidate@example.com'}\n\nTECHNICAL SKILLS:\n` +
        findings.map((f: any) => `- ${f.skill}`).join('\n');
    }

    const reportData = {
      candidateName,
      candidateEmail: parsedResumeData?.personal?.email || user?.email,
      targetRole: analysis.targetRole || 'Software Engineer',
      analysisDate: new Date(analysis.createdAt).toLocaleDateString('en-US'),
      overallScore: analysis.overallScore || 0,
      dimensions: (analysis.dimensions as any) || {},
      summary: analysis.summary || '',
      findings: findings.map((f: any) => ({
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

    streamAnnotatedResumePdf(reportData, res);
  } catch (err: any) {
    console.error('Annotated resume PDF generation error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to generate annotated resume' });
  }
});

export default router;
