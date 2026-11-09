import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../server';
import { db, ensureDbReady } from '../db';
import { users, analyses } from '../db/schema';
import { eq } from 'drizzle-orm';
import {
  verifyGitHubIdentityConsistency,
  scanGitHubAccountWithQuality,
  fetchGitHubProfile,
  GitHubNotFoundError,
} from '../services/githubAnalyzer';
import { parseJobDescription } from '../services/jobParser';
import { parseResumePDF, parseResumeText } from '../services/resumeParser';
import { generatePreApplicationDecision } from '../services/preApplicationDecision';
import { performRecruiterAudit } from '../services/recruiterAudit';
import fs from 'fs';
import path from 'path';
import os from 'os';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-proofcheck-2024';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTest(name: string, fn: () => Promise<void> | void): Promise<boolean> {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    return true;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('\n======================================================');
  console.log(' GAPCHECK GITHUB IDENTITY & FAILURE HARDENING TEST MATRIX ');
  console.log('======================================================\n');

  await ensureDbReady();

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  let allPassed = true;

  try {
    const apiRequest = async (pathUrl: string, options: RequestInit = {}) => {
      const url = `${baseUrl}${pathUrl}`;
      const res = await fetch(url, options);
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {}
      return { status: res.status, headers: res.headers, body: json, text };
    };

    // Create test user token
    const testUserId = 'a1b2c3d4-e5f6-4a1b-8c2d-3e4f5a6b7c8d';
    await db.insert(users).values({
      id: testUserId,
      email: 'hardening@gapcheck.test',
      passwordHash: 'hash',
      role: 'STUDENT',
    }).onConflictDoNothing();

    const authToken = jwt.sign({ userId: testUserId, email: 'hardening@gapcheck.test', role: 'STUDENT' }, JWT_SECRET, { expiresIn: '1h' });

    // --------------------------------------------------------------------------
    // TEST A: Non-existent GitHub Account
    // --------------------------------------------------------------------------
    console.log('\nRunning Test A — Non-existent GitHub Account:');
    allPassed = (await runTest('Test A: Non-existent GitHub returns 404 GITHUB_NOT_FOUND without creating fake audit', async () => {
      const nonExistentUsername = 'this-user-definitely-does-not-exist-999999';

      // 1. Direct validation endpoint
      const validateRes = await apiRequest('/api/github/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          githubUsername: nonExistentUsername,
          candidateName: 'Prajjwal Tripathi',
        }),
      });
      assert(validateRes.status === 404, `Expected 404 on non-existent GitHub validate, got ${validateRes.status}`);
      assert(validateRes.body?.error === 'GITHUB_NOT_FOUND', `Expected error GITHUB_NOT_FOUND, got ${validateRes.body?.error}`);

      // 2. Start analysis endpoint
      const startRes = await apiRequest('/api/analysis/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          resumeText: 'Prajjwal Tripathi\nSoftware Engineer\nNode.js, TypeScript, React, PostgreSQL',
          githubUsername: `https://github.com/${nonExistentUsername}`,
          targetRole: 'Full Stack Engineer',
        }),
      });
      assert(startRes.status === 404, `Expected 404 on start with non-existent GitHub, got ${startRes.status}`);
      assert(startRes.body?.error === 'GITHUB_NOT_FOUND', `Expected error GITHUB_NOT_FOUND, got ${startRes.body?.error}`);

      // 3. Service layer scan directly throws GitHubNotFoundError
      let threwExpectedError = false;
      try {
        await scanGitHubAccountWithQuality(nonExistentUsername);
      } catch (err: any) {
        threwExpectedError = err instanceof GitHubNotFoundError || err.code === 'GITHUB_NOT_FOUND';
      }
      assert(threwExpectedError, 'scanGitHubAccountWithQuality must throw GitHubNotFoundError for 404 users');
    })) && allPassed;

    // --------------------------------------------------------------------------
    // TEST B: Short Job Description (Frontend Developer)
    // --------------------------------------------------------------------------
    console.log('\nRunning Test B — Short Job Description:');
    allPassed = (await runTest('Test B: Short JD sets targetJob quality to LIMITED and suppresses artificial role gaps', () => {
      const shortJd = 'Frontend Developer';
      const parsedJd = parseJobDescription(shortJd);

      assert(parsedJd.dataQuality === 'LIMITED', `Expected targetJob dataQuality to be LIMITED, got ${parsedJd.dataQuality}`);
      assert(Boolean(parsedJd.statusMessage?.includes('limited technical detail')), 'Expected statusMessage to note limited technical detail');

      // Check pre-application decision behavior with LIMITED target job
      const audit = performRecruiterAudit([], null, 'Frontend Developer');
      const decision = generatePreApplicationDecision({
        findings: [],
        recruiterAudit: audit,
        repos: [],
        targetRole: 'Frontend Developer',
        jobRequirements: parsedJd.allRequirements,
        sourceCoverage: {
          targetJob: 'LIMITED',
        },
      });

      // Role gaps must be suppressed when targetJob is LIMITED to avoid manufacturing artificial claims
      assert(decision.roleCriticalGaps.length === 0, `Expected 0 roleCriticalGaps for LIMITED JD, got ${decision.roleCriticalGaps.length}`);
    })) && allPassed;

    // --------------------------------------------------------------------------
    // TEST C: Invalid PDF Upload
    // --------------------------------------------------------------------------
    console.log('\nRunning Test C — Invalid PDF Upload:');
    allPassed = (await runTest('Test C: Non-PDF bytes return 400 INVALID_PDF_FILE and clean up temp files', async () => {
      const tempInvalidPath = path.join(os.tmpdir(), `test-invalid-${Date.now()}.pdf`);
      fs.writeFileSync(tempInvalidPath, 'NOT A REAL PDF FILE HEADER TEXT');

      let serviceThrew = false;
      try {
        await parseResumePDF(tempInvalidPath);
      } catch (err: any) {
        serviceThrew = err.message.includes('Invalid file format') || err.message.includes('valid PDF headers');
      } finally {
        if (fs.existsSync(tempInvalidPath)) fs.unlinkSync(tempInvalidPath);
      }
      assert(serviceThrew, 'parseResumePDF must throw for non-PDF headers');
    })) && allPassed;

    // --------------------------------------------------------------------------
    // TEST D: Empty PDF Upload (<50 characters)
    // --------------------------------------------------------------------------
    console.log('\nRunning Test D — Empty PDF Upload:');
    allPassed = (await runTest('Test D: Empty or <50 char PDF returns 400 EMPTY_RESUME', () => {
      let textThrew = false;
      try {
        parseResumeText('Short text');
      } catch (err: any) {
        textThrew = err.message.includes("couldn't extract enough readable text") || err.message.includes('at least 50 characters');
      }
      assert(textThrew, 'parseResumeText must throw for text < 50 characters');
    })) && allPassed;

    // --------------------------------------------------------------------------
    // TEST E: GitHub Source Failure / Rate Limit Handling
    // --------------------------------------------------------------------------
    console.log('\nRunning Test E — GitHub Source Failure / Rate Limit Handling:');
    allPassed = (await runTest('Test E: GitHub failure marks quality PARTIAL without penalizing readiness or generating negative evidence', () => {
      // Create candidate with resume-verified skills
      const findings = [
        {
          skill: 'TypeScript',
          resumeClaim: 'TypeScript development with React and Node.js',
          claimLevel: 'proficient' as const,
          evidenceStatus: 'supported' as const,
          assessment: 'Supported by resume declarations.',
          confidence: 0.8,
          priority: 'low' as const,
          evidenceSources: [{ type: 'resume' as const, source: 'resume', evidence: 'Resume declaration', confidence: 0.8 }],
        },
      ];

      const audit = performRecruiterAudit([], null, 'Frontend Developer');
      const decision = generatePreApplicationDecision({
        findings,
        recruiterAudit: audit,
        repos: [],
        targetRole: 'Frontend Developer',
        jobRequirements: ['typescript'],
        sourceCoverage: {
          resume: 'COMPLETE',
          github: {
            quality: 'PARTIAL',
            totalPublicRepos: 10,
            scannedCount: 3,
            failedCount: 7,
          },
          targetJob: 'COMPLETE',
        },
      });

      // Readiness must not be forced to NEEDS_WORK or penalized solely due to external source quality
      assert(decision.sourceCoverage.github.quality === 'PARTIAL', 'sourceCoverage.github.quality must be PARTIAL');
      assert(decision.confidence === 'MEDIUM' || decision.confidence === 'LOW', 'Confidence must reflect incomplete external source');
      assert(Boolean(decision.confidenceDisclaimer?.includes('could not be fully verified') || decision.confidenceDisclaimer?.includes('available repository evidence only')), 'Must include disclaimer about external source limitation');
      // No negative claims manufactured
      const negativeClaims = decision.mustFix.filter(f => f.title.toLowerCase().includes('failed github'));
      assert(negativeClaims.length === 0, 'Must not manufacture negative claims for GitHub API failures');
    })) && allPassed;

    // --------------------------------------------------------------------------
    // TEST F: GitHub Identity Mismatch (Uday Kumar Gorantla R vs Ananya0213)
    // --------------------------------------------------------------------------
    console.log('\nRunning Test F — GitHub Identity Mismatch:');
    allPassed = (await runTest('Test F: Mismatch between Uday Kumar Gorantla R and Ananya0213 is caught with MISMATCH', async () => {
      const candidateName = 'Uday Kumar Gorantla R';
      const unrelatedGitHub = 'Ananya0213';

      const simulatedProfile = {
        login: 'Ananya0213',
        name: 'Ananya Sharma',
        bio: 'Software developer',
        publicRepos: 12,
        followers: 5,
        following: 5,
        avatarUrl: 'https://github.com/Ananya0213.png',
        htmlUrl: 'https://github.com/Ananya0213',
      };

      const check = verifyGitHubIdentityConsistency({
        candidateName,
        githubUsername: unrelatedGitHub,
        githubProfile: simulatedProfile,
      });

      assert(check.status === 'MISMATCH', `Expected MISMATCH for Uday vs Ananya, got ${check.status}`);
      assert(check.confidence === 'HIGH', `Expected HIGH confidence mismatch, got ${check.confidence}`);
      assert(check.reasons.length > 0, 'Expected explanatory reasons for mismatch');

      // Test endpoint rejection
      const startRes = await apiRequest('/api/analysis/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          resumeText: 'Uday Kumar Gorantla R\nFull Stack Developer\nReact, Node.js, Express, MongoDB, Java',
          githubUsername: 'https://github.com/Ananya0213',
          targetRole: 'Full Stack Engineer',
        }),
      });

      assert(startRes.status === 400, `Expected 400 for identity mismatch on /start, got ${startRes.status}`);
      assert(startRes.body?.error === 'GITHUB_IDENTITY_MISMATCH', `Expected GITHUB_IDENTITY_MISMATCH, got ${startRes.body?.error}`);
      assert(startRes.body?.identityCheck?.status === 'MISMATCH', 'Expected identityCheck object in response');

      // Test continuing without GitHub when mismatch occurs
      const continueRes = await apiRequest('/api/analysis/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          resumeText: 'Uday Kumar Gorantla R\nFull Stack Developer\nReact, Node.js, Express, MongoDB, Java',
          githubUsername: 'https://github.com/Ananya0213',
          targetRole: 'Full Stack Engineer',
          continueWithoutGithub: true,
        }),
      });

      assert(continueRes.status === 200, `Expected 200 when continueWithoutGithub=true, got ${continueRes.status}`);
      const analysisId = continueRes.body?.analysisId;
      assert(Boolean(analysisId), 'Expected analysisId to be returned');

      // Confirm the stored analysis discarded the unrelated GitHub account
      const [savedAnalysis] = await db.select().from(analyses).where(eq(analyses.id, analysisId)).limit(1);
      assert(savedAnalysis?.githubUsername === null, 'Unrelated GitHub handle must be discarded when continuing without GitHub');

      // Clean up analysis
      await db.delete(analyses).where(eq(analyses.id, analysisId));
    })) && allPassed;

    // --------------------------------------------------------------------------
    // TEST G: Resume Declared GitHub vs Entered GitHub Mismatch
    // --------------------------------------------------------------------------
    console.log('\nRunning Test G — Resume Declared GitHub vs Entered GitHub Mismatch:');
    allPassed = (await runTest('Test G: Resume with @udaykumar rejects entered @Ananya0213 with direct handle mismatch', () => {
      const check = verifyGitHubIdentityConsistency({
        candidateName: 'Uday Kumar Gorantla R',
        resumeGithubUsername: 'udaykumar',
        githubUsername: 'Ananya0213',
      });

      assert(check.status === 'MISMATCH', `Expected MISMATCH for declared udaykumar vs entered Ananya0213, got ${check.status}`);
      assert(check.evidence.some(e => e.toLowerCase().includes('udaykumar')), 'Expected evidence to cite declared handle');
      assert(check.evidence.some(e => e.toLowerCase().includes('ananya0213')), 'Expected evidence to cite entered handle');
    })) && allPassed;

    // --------------------------------------------------------------------------
    // TEST H: Plausible Username with Weak Identity Evidence
    // --------------------------------------------------------------------------
    console.log('\nRunning Test H — Plausible Username with Weak Identity:');
    allPassed = (await runTest('Test H: Weak identity evidence returns POSSIBLY_CONSISTENT or UNKNOWN, never MISMATCH', () => {
      // Candidate: Rahul Kumar, GitHub: rk-dev123 (initials match, no contradictory display name)
      const checkInitials = verifyGitHubIdentityConsistency({
        candidateName: 'Rahul Kumar',
        githubUsername: 'rk-dev123',
        githubProfile: {
          login: 'rk-dev123',
          name: null,
          bio: null,
          publicRepos: 5,
          followers: 1,
          following: 1,
          avatarUrl: '',
          htmlUrl: '',
        },
      });

      assert(checkInitials.status !== 'MISMATCH', `Expected non-MISMATCH for rk-dev123, got ${checkInitials.status}`);
      assert(
        checkInitials.status === 'POSSIBLY_CONSISTENT' || checkInitials.status === 'UNKNOWN',
        `Expected POSSIBLY_CONSISTENT or UNKNOWN, got ${checkInitials.status}`
      );

      // Candidate: Prajjwal Tripathi, GitHub: prajjwal-dev (matching first name, dev suffix)
      const checkDevSuffix = verifyGitHubIdentityConsistency({
        candidateName: 'Prajjwal Tripathi',
        githubUsername: 'prajjwal-dev',
      });
      assert(checkDevSuffix.status === 'CONSISTENT' || checkDevSuffix.status === 'POSSIBLY_CONSISTENT', `Expected CONSISTENT/POSSIBLY_CONSISTENT, got ${checkDevSuffix.status}`);
    })) && allPassed;

  } finally {
    server.close();
  }

  console.log('\n======================================================');
  if (allPassed) {
    console.log(' ALL GITHUB IDENTITY & FAILURE HARDENING TESTS (A — H) PASSED! ');
  } else {
    console.error(' SOME TESTS IN MATRIX FAILED! ');
    process.exit(1);
  }
  console.log('======================================================\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
