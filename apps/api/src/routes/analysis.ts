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
import { fetchRepositories, extractEvidenceFromRepos, GitHubRepo, RepoEvidence, normalizeGitHubInput } from '../services/githubAnalyzer';
import {
  matchClaimsToEvidence, generateRecommendations, calculateDimensions,
  calculateOverallScore, generateActionPlan
} from '../services/evidenceEngine';
import { parseJobDescription } from '../services/jobParser';
import {
  DEMO_PARSED_RESUME, DEMO_CLAIMS, DEMO_REPOS, DEMO_EVIDENCE,
  DEMO_PARSED_JOB
} from '../services/demoData';
import { streamAuditReportPdf, streamAnnotatedResumePdf } from '../services/reportGenerator';
import { performRecruiterAudit } from '../services/recruiterAudit';

const router = Router();

// Start analysis
router.post('/start', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const {
      resumeId,
      resumeText,
      githubUsername,
      jobDescriptionId,
      jobDescriptionText,
      targetRole,
      isDemo
    } = req.body;
    const userId = req.userId!;

    let cleanGithubUsername: string | null = null;
    if (githubUsername && typeof githubUsername === 'string' && githubUsername.trim()) {
      try {
        cleanGithubUsername = normalizeGitHubInput(githubUsername);
      } catch (err: any) {
        res.status(400).json({ error: err.message || 'Invalid GitHub profile URL or username' });
        return;
      }
    }

    // Create analysis record
    const [analysis] = await db.insert(analyses).values({
      userId,
      resumeId: resumeId || null,
      targetRole: targetRole || 'Software Engineer Intern',
      status: 'pending',
      progress: 0,
      progressMessage: 'Starting GapCheck audit...',
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
    res.status(500).json({ error: 'Failed to start analysis' });
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
  isDemo: boolean;
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
    // Step 1: Parse resume
    await updateProgress('parsing_resume', 15, 'Parsing resume claims...');
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

    // Step 2: Extract skills & claims
    await updateProgress('extracting_skills', 30, `Extracted ${claims.length} technical claims from profile`);

    // Step 3: Analyze GitHub
    await updateProgress('analyzing_github', 50, 'Auditing GitHub repositories and AST...');
    let repos: GitHubRepo[] = [];
    let evidence: RepoEvidence[] = [];

    if (isDemo) {
      repos = DEMO_REPOS;
      evidence = DEMO_EVIDENCE;
    } else if (githubUsername && githubUsername.trim()) {
      try {
        repos = await fetchRepositories(githubUsername.trim());
        evidence = extractEvidenceFromRepos(repos);

        // Store repos and evidence
        for (const repo of repos) {
          const [savedRepo] = await db.insert(repositories).values({
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
      } catch (ghErr) {
        console.warn('GitHub fetch warning (continuing analysis with available evidence):', ghErr);
        // Fallback to stored repos or empty evidence
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
    } else {
      // Use existing stored evidence
      const storedRepos = await db.select().from(repositories).where(eq(repositories.userId, userId));
      repos = storedRepos.map((r: any) => r.analyzedData as unknown as GitHubRepo).filter(Boolean);
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

    if (isDemo) {
      jobRequirements = DEMO_PARSED_JOB.allRequirements;
    } else if (jobDescriptionText && jobDescriptionText.trim().length >= 20) {
      const parsedJd = parseJobDescription(jobDescriptionText);
      jobRequirements = parsedJd.allRequirements;

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
      }
    }

    // Step 5: Claim & Evidence Cross-Matching
    await updateProgress('matching_claims', 80, 'Cross-referencing claims against evidence...');
    const findings = matchClaimsToEvidence(claims, evidence, jobRequirements);

    // Step 6: Recruiter Perspective Audit & GitHub Profile Classification
    await updateProgress('recruiter_audit', 88, 'Auditing complete GitHub profile from a recruiter perspective...');
    const recruiterAudit = performRecruiterAudit(repos, parsedResume, targetRole);

    // Step 7: Recommendations & Action Plan
    await updateProgress('generating_recommendations', 92, 'Synthesizing recommendations and action plan...');
    const recs = generateRecommendations(findings, repos);
    const dimensions = calculateDimensions(findings, repos, jobRequirements, recruiterAudit.readiness.score);
    const overallScore = calculateOverallScore(dimensions);
    const actionPlan = generateActionPlan(recs, findings);

    // Attach recruiter audit to dimensions so it persists with the analysis record
    const dimensionsPayload = {
      ...dimensions,
      recruiterAudit,
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
      summary,
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(analyses.id as any, analysisId));

    console.log(`✅ Analysis ${analysisId} completed successfully: score=${overallScore}%`);
  } catch (err: any) {
    console.error(`❌ Analysis ${analysisId} failed:`, err);
    await db.update(analyses).set({
      status: 'failed',
      progressMessage: `Analysis failed: ${err.message}`,
      updatedAt: new Date(),
    }).where(eq(analyses.id as any, analysisId));
  }
}

// Get analysis status
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const [analysis] = await db.select().from(analyses)
      .where(eq(analyses.id as any, req.params.id))
      .limit(1);

    if (!analysis || analysis.userId !== req.userId) {
      res.status(404).json({ error: 'Analysis not found' });
      return;
    }

    res.json({ analysis });
  } catch (err) {
    console.error('Get analysis error:', err);
    res.status(500).json({ error: 'Failed to get analysis' });
  }
});

// Get analysis results (full)
router.get('/:id/results', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const [analysis] = await db.select().from(analyses)
      .where(eq(analyses.id as any, req.params.id))
      .limit(1);

    if (!analysis || analysis.userId !== req.userId) {
      res.status(404).json({ error: 'Analysis not found' });
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
    res.status(500).json({ error: 'Failed to get analysis results' });
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
    res.status(500).json({ error: 'Failed to get analyses' });
  }
});

// Stream downloadable PDF Audit Report
router.get(['/:id/report.pdf', '/:id/report'], authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const analysisId = req.params.id;
    const [analysis] = await db.select().from(analyses)
      .where(eq(analyses.id as any, analysisId))
      .limit(1);

    if (!analysis || analysis.userId !== req.userId) {
      res.status(404).json({ error: 'Analysis not found' });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    const findings = await db.select().from(analysisFindings).where(eq(analysisFindings.analysisId, analysis.id));
    const recs = await db.select().from(recsTable).where(eq(recsTable.analysisId, analysis.id));
    const actions = await db.select().from(actionItems).where(eq(actionItems.analysisId, analysis.id));

    let rawResumeText = '';
    if (analysis.resumeId) {
      const [resObj] = await db.select().from(resumes).where(eq(resumes.id as any, analysis.resumeId)).limit(1);
      rawResumeText = resObj?.rawText || '';
    }

    const reportData = {
      candidateName: user?.name || 'Candidate',
      candidateEmail: user?.email,
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
    };

    streamAuditReportPdf(reportData, res);
  } catch (err: any) {
    console.error('Audit report PDF generation error:', err);
    res.status(500).json({ error: 'Failed to generate PDF report' });
  }
});

// Stream downloadable Annotated Resume PDF
router.get('/:id/annotated-resume.pdf', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const analysisId = req.params.id;
    const [analysis] = await db.select().from(analyses)
      .where(eq(analyses.id as any, analysisId))
      .limit(1);

    if (!analysis || analysis.userId !== req.userId) {
      res.status(404).json({ error: 'Analysis not found' });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    const findings = await db.select().from(analysisFindings).where(eq(analysisFindings.analysisId, analysis.id));

    let rawResumeText = '';
    if (analysis.resumeId) {
      const [resObj] = await db.select().from(resumes).where(eq(resumes.id as any, analysis.resumeId)).limit(1);
      rawResumeText = resObj?.rawText || '';
    }

    if (!rawResumeText) {
      rawResumeText = `${user?.name || 'Candidate'}\nEmail: ${user?.email || 'candidate@example.com'}\n\nTECHNICAL SKILLS:\n` +
        findings.map((f: any) => `- ${f.skill}`).join('\n');
    }

    const reportData = {
      candidateName: user?.name || 'Candidate',
      candidateEmail: user?.email,
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
    res.status(500).json({ error: 'Failed to generate annotated resume' });
  }
});

export default router;
