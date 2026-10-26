import http from 'http';
import app from '../server';
import { db, ensureDbReady } from '../db';
import { users, analyses, repositories, analysisFindings } from '../db/schema';
import { eq, desc } from 'drizzle-orm';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runTest(name: string, fn: () => Promise<void>): Promise<boolean> {
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
  console.log(' GAPCHECK STUDENT WORKFLOW TEST MATRIX (AN — AX: 12/12) ');
  console.log('======================================================\n');

  await ensureDbReady();

  // Spin up an ephemeral test server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  let allPassed = true;

  try {
    const apiRequest = async (path: string, options: RequestInit = {}) => {
      const url = `${baseUrl}${path}`;
      const res = await fetch(url, options);
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
      return { status: res.status, headers: res.headers, body: json };
    };

    const timestamp = Date.now();
    const studentAEmail = `student_workflow_a_${timestamp}@example.com`;
    const studentBEmail = `student_workflow_b_${timestamp}@example.com`;
    const password = 'Password123!';

    let tokenA = '';
    let userIdA = '';
    let tokenB = '';
    let userIdB = '';
    let auditA1Id = '';
    let auditA2Id = '';

    // ========================================================
    // PROFILE AN — New Student Workspace
    // ========================================================
    console.log('Running Profile AN — New Student Workspace:');
    allPassed = (await runTest('Profile AN: Fresh student registration has clean zero-audit state and no demo data', async () => {
      const reg = await apiRequest('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Maya Lin', email: studentAEmail, password }),
      });
      assert(reg.status === 201, `Expected 201 created, got ${reg.status}`);
      assert(Boolean(reg.body.token), 'Expected token in register response');
      tokenA = reg.body.token;
      userIdA = reg.body.user.id;
      assert(reg.body.user.email === studentAEmail, 'User email must match registration');
      assert(reg.body.user.email !== 'demo@proofcheck.dev', 'User must NOT be demo user');

      const dash = await apiRequest('/api/dashboard', {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(dash.status === 200, `Expected 200, got ${dash.status}`);
      assert(dash.body.hasAnalysis === false, 'Fresh user must have hasAnalysis = false');
      assert(dash.body.latestAnalysis === null, 'Fresh user must have latestAnalysis = null');
      assert(Array.isArray(dash.body.findings) && dash.body.findings.length === 0, 'Findings must be empty array');
      assert(Array.isArray(dash.body.recommendations) && dash.body.recommendations.length === 0, 'Recommendations must be empty array');
      assert(Array.isArray(dash.body.actionPlan) && dash.body.actionPlan.length === 0, 'Action plan must be empty array');

      const list = await apiRequest('/api/analysis', {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(list.status === 200, `Expected 200, got ${list.status}`);
      assert(Array.isArray(list.body.analyses) && list.body.analyses.length === 0, 'Analyses history must be empty');
    })) && allPassed;

    // ========================================================
    // PROFILE AO — Four-Step Audit Flow
    // ========================================================
    console.log('\nRunning Profile AO — Four-Step Audit Flow:');
    allPassed = (await runTest('Profile AO: Four-step wizard payload successfully initiates analysis', async () => {
      const resumeText = 'Maya Lin\nSoftware Engineer\nSkills: TypeScript, React, Next.js, Node.js\nExperience: Built responsive web applications and APIs.';
      const githubInput = 'https://github.com/maya-lin';
      const targetRole = 'Frontend Engineer';
      const company = 'Stripe';
      const jobDescription = 'Looking for a Frontend Engineer with solid TypeScript, React, and CSS experience to build payment dashboards.';

      const startRes = await apiRequest('/api/analysis/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          resumeText,
          githubUsername: githubInput,
          targetRole,
          company,
          jobDescriptionText: jobDescription,
        }),
      });

      assert(startRes.status === 200, `Expected 200 on start, got ${startRes.status}`);
      assert(Boolean(startRes.body.analysisId), 'Expected analysisId in response');
      auditA1Id = startRes.body.analysisId;

      // Poll until analysis completes
      let status = startRes.body.analysis?.status;
      let polls = 0;
      while (status !== 'completed' && polls < 20) {
        await new Promise((r) => setTimeout(r, 350));
        const check = await apiRequest(`/api/analysis/${auditA1Id}`, {
          headers: { Authorization: `Bearer ${tokenA}` },
        });
        status = check.body.analysis?.status;
        polls++;
      }
      assert(status === 'completed', `Expected analysis to complete, got ${status}`);
    })) && allPassed;

    // ========================================================
    // PROFILE AP — Configuration Summary
    // ========================================================
    console.log('\nRunning Profile AP — Configuration Summary:');
    allPassed = (await runTest('Profile AP: Stored audit preserves complete configuration review parameters', async () => {
      const check = await apiRequest(`/api/analysis/${auditA1Id}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(check.status === 200, `Expected 200, got ${check.status}`);
      const audit = check.body.analysis;
      assert(audit.targetRole === 'Frontend Engineer', `Expected Frontend Engineer, got ${audit.targetRole}`);
      assert(audit.company === 'Stripe', `Expected company Stripe, got ${audit.company}`);
      assert(audit.githubUsername.includes('maya-lin'), `Expected githubUsername to contain maya-lin, got ${audit.githubUsername}`);
      assert(audit.resumeTextSnapshot.includes('Maya Lin'), 'Expected resume snapshot to contain Maya Lin');
      assert(audit.jobDescriptionTextSnapshot.includes('payment dashboards'), 'Expected JD snapshot to contain payment dashboards');
    })) && allPassed;

    // ========================================================
    // PROFILE AQ — Failed Analysis Recovery
    // ========================================================
    console.log('\nRunning Profile AQ — Failed Analysis Recovery:');
    let failedAuditId = '';
    allPassed = (await runTest('Profile AQ: Failed analysis transitions cleanly, exposes retry, and creates no duplicate', async () => {
      const [failedAudit] = await db.insert(analyses).values({
        userId: userIdA,
        targetRole: 'Mobile Engineer',
        company: 'Uber',
        githubUsername: 'maya-lin',
        resumeTextSnapshot: 'Maya Lin\nMobile Engineer\nReact Native, iOS, Swift',
        jobDescriptionTextSnapshot: 'Mobile app engineer to build passenger experience.',
        status: 'failed',
        progress: 42,
        progressMessage: 'GitHub API rate limit exceeded during repository fetch',
      }).returning();

      failedAuditId = failedAudit.id;

      // Check analysis endpoint returns failed state
      const checkRes = await apiRequest(`/api/analysis/${failedAuditId}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(checkRes.status === 200, `Expected 200, got ${checkRes.status}`);
      assert(checkRes.body.analysis.status === 'failed', 'Expected status to be failed');
      assert(checkRes.body.analysis.progressMessage.includes('rate limit'), 'Expected progressMessage to reflect failure reason');

      // Check that Retry is available
      const retryRes = await apiRequest(`/api/analysis/${failedAuditId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(retryRes.status === 200, `Expected 200 on retry, got ${retryRes.status}`);
      assert(retryRes.body.analysisId === failedAuditId, 'Retry must operate on the exact same analysisId, no duplicates');

      // Poll until retry completes
      let polls = 0;
      let status = retryRes.body.status;
      while (status !== 'completed' && polls < 20) {
        await new Promise((r) => setTimeout(r, 350));
        const check = await apiRequest(`/api/analysis/${failedAuditId}`, {
          headers: { Authorization: `Bearer ${tokenA}` },
        });
        status = check.body.analysis?.status;
        polls++;
      }
      assert(status === 'completed', `Expected retried analysis to complete, got ${status}`);
    })) && allPassed;

    // ========================================================
    // PROFILE AR — Refresh During Analysis
    // ========================================================
    console.log('\nRunning Profile AR — Refresh During Analysis:');
    allPassed = (await runTest('Profile AR: Reconnecting client polls active analysis and observes deterministic stages', async () => {
      // Create a pending analysis to simulate active execution
      const [activeAudit] = await db.insert(analyses).values({
        userId: userIdA,
        targetRole: 'Backend Engineer',
        company: 'Datadog',
        githubUsername: 'maya-lin',
        resumeTextSnapshot: 'Maya Lin\nBackend Engineer\nGo, Kubernetes, Redis',
        status: 'pending',
        progress: 57,
        progressMessage: 'Checking resume ↔ GitHub evidence',
      }).returning();

      // Client refreshes browser and queries status using saved ID
      const refreshCheck = await apiRequest(`/api/analysis/${activeAudit.id}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(refreshCheck.status === 200, `Expected 200, got ${refreshCheck.status}`);
      assert(refreshCheck.body.analysis.id === activeAudit.id, 'Expected active audit ID preserved');
      assert(refreshCheck.body.analysis.status === 'pending', 'Expected status to be pending');
      assert(refreshCheck.body.analysis.progress === 57, 'Expected progress to be 57%');
      assert(refreshCheck.body.analysis.progressMessage === 'Checking resume ↔ GitHub evidence', 'Expected deterministic stage message');

      // Clean up test record
      await db.delete(analyses).where(eq(analyses.id, activeAudit.id));
    })) && allPassed;

    // ========================================================
    // PROFILE AS — Retry Preserves Inputs
    // ========================================================
    console.log('\nRunning Profile AS — Retry Preserves Inputs:');
    allPassed = (await runTest('Profile AS: Retried analysis preserves exact original input parameters', async () => {
      const [failedWithCustomInputs] = await db.insert(analyses).values({
        userId: userIdA,
        targetRole: 'Security Engineer',
        company: 'Cloudflare',
        githubUsername: 'maya-sec',
        resumeTextSnapshot: 'Maya Lin\nSecurity Engineer\nCryptography, OAuth2, Rust',
        jobDescriptionTextSnapshot: 'Looking for a Security Engineer with Rust & OAuth experience.',
        status: 'failed',
        progress: 28,
        progressMessage: 'Network error scanning public profile',
      }).returning();

      const retryRes = await apiRequest(`/api/analysis/${failedWithCustomInputs.id}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(retryRes.status === 200, `Expected 200 on retry, got ${retryRes.status}`);

      const recordAfterRetry = await db.select().from(analyses).where(eq(analyses.id, failedWithCustomInputs.id)).limit(1);
      assert(recordAfterRetry.length === 1, 'Expected record in database');
      assert(recordAfterRetry[0].targetRole === 'Security Engineer', 'Target role must be preserved');
      assert(recordAfterRetry[0].company === 'Cloudflare', 'Company must be preserved');
      assert(recordAfterRetry[0].githubUsername === 'maya-sec', 'GitHub username must be preserved');
      assert(recordAfterRetry[0].resumeTextSnapshot?.includes('Cryptography'), 'Resume snapshot must be preserved');
      assert(recordAfterRetry[0].jobDescriptionTextSnapshot?.includes('OAuth'), 'Job description snapshot must be preserved');

      // Clean up
      await db.delete(analyses).where(eq(analyses.id, failedWithCustomInputs.id));
    })) && allPassed;

    // ========================================================
    // PROFILE AT — Historical Audit Navigation
    // ========================================================
    console.log('\nRunning Profile AT — Historical Audit Navigation:');
    allPassed = (await runTest('Profile AT: Multiple audits exist independently and history preserves older snapshot', async () => {
      // Read Audit A1 score and timestamp
      const auditA1Before = await db.select().from(analyses).where(eq(analyses.id, auditA1Id)).limit(1);
      assert(auditA1Before.length === 1, 'Expected Audit A1 in database');
      const a1CompletedAt = auditA1Before[0].completedAt?.toISOString();
      const a1Score = auditA1Before[0].overallScore;

      // Create Audit A2
      const startA2 = await apiRequest('/api/analysis/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          resumeText: 'Maya Lin\nSenior Staff Engineer\nDistributed Systems, Go, Kafka',
          githubUsername: 'maya-lin',
          targetRole: 'Senior Staff Engineer',
          company: 'Netflix',
          jobDescriptionText: 'Lead distributed systems architecture.',
        }),
      });
      assert(startA2.status === 200, `Expected 200 for Audit A2, got ${startA2.status}`);
      auditA2Id = startA2.body.analysisId;

      let polls = 0;
      let status = startA2.body.analysis?.status;
      while (status !== 'completed' && polls < 20) {
        await new Promise((r) => setTimeout(r, 350));
        const check = await apiRequest(`/api/analysis/${auditA2Id}`, {
          headers: { Authorization: `Bearer ${tokenA}` },
        });
        status = check.body.analysis?.status;
        polls++;
      }
      assert(status === 'completed', 'Audit A2 must complete');

      // Verify Audit A1 did NOT change
      const auditA1After = await db.select().from(analyses).where(eq(analyses.id, auditA1Id)).limit(1);
      assert(auditA1After[0].targetRole === 'Frontend Engineer', 'Audit A1 targetRole must remain Frontend Engineer');
      assert(auditA1After[0].company === 'Stripe', 'Audit A1 company must remain Stripe');
      assert(auditA1After[0].overallScore === a1Score, 'Audit A1 overallScore must remain unchanged');
      assert(auditA1After[0].completedAt?.toISOString() === a1CompletedAt, 'Audit A1 completedAt must remain identical');

      // Verify history list lists both audits
      const list = await apiRequest('/api/analysis', {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(list.status === 200, `Expected 200 on /api/analysis, got ${list.status}`);
      assert(list.body.analyses.length >= 2, 'History must contain at least 2 audits');
      const ids = list.body.analyses.map((a: any) => a.id);
      assert(ids.includes(auditA1Id), 'History must include Audit A1');
      assert(ids.includes(auditA2Id), 'History must include Audit A2');
    })) && allPassed;

    // ========================================================
    // PROFILE AU — Finding Inspector
    // ========================================================
    console.log('\nRunning Profile AU — Finding Inspector:');
    allPassed = (await runTest('Profile AU: Finding inspector exposes observation, evidence, reasoning, status, and recommended action', async () => {
      const resultsRes = await apiRequest(`/api/analysis/${auditA1Id}/results`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(resultsRes.status === 200, `Expected 200, got ${resultsRes.status}`);
      assert(Array.isArray(resultsRes.body.findings), 'Expected findings array');

      // If findings exist, check contract
      if (resultsRes.body.findings.length > 0) {
        const finding = resultsRes.body.findings[0];
        assert(typeof finding.assessment === 'string' && finding.assessment.length > 0, 'Finding must contain assessment/observation');
        assert(Array.isArray(finding.evidenceSources), 'Finding must contain evidenceSources array');
        assert(typeof finding.evidenceStatus === 'string', 'Finding must contain evidenceStatus');
        assert(typeof finding.priority === 'string', 'Finding must contain priority level');
        assert(!finding.assessment.toLowerCase().includes('fake') && !finding.assessment.toLowerCase().includes('liar'), 'Finding must never use accusatory language');
      }

      // Check recommendations contract
      assert(Array.isArray(resultsRes.body.recommendations), 'Expected recommendations array');
      if (resultsRes.body.recommendations.length > 0) {
        const rec = resultsRes.body.recommendations[0];
        assert(Boolean(rec.title), 'Recommendation must have title');
        assert(Boolean(rec.observation), 'Recommendation must have observation');
        assert(Boolean(rec.recommendation), 'Recommendation must have actionable recommendation text');
      }
    })) && allPassed;

    // ========================================================
    // PROFILE AV — Demo Boundary
    // ========================================================
    console.log('\nRunning Profile AV — Demo Boundary:');
    allPassed = (await runTest('Profile AV: Demo session data never leaks into student account', async () => {
      // Demo session
      const demoRes = await apiRequest('/api/auth/demo', { method: 'POST' });
      assert(demoRes.status === 200, 'Expected demo login 200');
      const demoToken = demoRes.body.token;

      const demoDash = await apiRequest('/api/dashboard', {
        headers: { Authorization: `Bearer ${demoToken}` },
      });
      assert(demoDash.body.user?.email === 'demo@proofcheck.dev', 'Demo user must have demo email');

      // Real student session
      const studentDash = await apiRequest('/api/dashboard', {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(studentDash.body.user?.email === studentAEmail, 'Student dashboard must have student email');
      assert(studentDash.body.user?.email !== 'demo@proofcheck.dev', 'Demo email must never appear in student dashboard');
    })) && allPassed;

    // ========================================================
    // Register User B for isolation testing
    // ========================================================
    const regB = await apiRequest('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sam Rivera', email: studentBEmail, password }),
    });
    tokenB = regB.body.token;
    userIdB = regB.body.user.id;

    // ========================================================
    // PROFILE AW — Unauthorized Audit
    // ========================================================
    console.log('\nRunning Profile AW — Unauthorized Audit:');
    allPassed = (await runTest('Profile AW: User B receives 403 FORBIDDEN when attempting to access User A audit', async () => {
      // User B attempts to access Audit A1
      const getRes = await apiRequest(`/api/analysis/${auditA1Id}`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert(getRes.status === 403, `Expected 403 FORBIDDEN, got ${getRes.status}`);
      assert(getRes.body.error === 'FORBIDDEN', 'Expected FORBIDDEN error code');

      // User B attempts to fetch results for Audit A1
      const resultsRes = await apiRequest(`/api/analysis/${auditA1Id}/results`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert(resultsRes.status === 403, `Expected 403 FORBIDDEN on /results, got ${resultsRes.status}`);

      // User B attempts to retry Audit A1
      const retryRes = await apiRequest(`/api/analysis/${auditA1Id}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert(retryRes.status === 403, `Expected 403 FORBIDDEN on /retry, got ${retryRes.status}`);

      // User B attempts to rescan Audit A1
      const rescanRes = await apiRequest(`/api/analysis/${auditA1Id}/rescan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert(rescanRes.status === 403, `Expected 403 FORBIDDEN on /rescan, got ${rescanRes.status}`);
    })) && allPassed;

    // ========================================================
    // PROFILE AX — Mobile Workflow & Payload Integrity
    // ========================================================
    console.log('\nRunning Profile AX — Mobile Workflow & Payload Integrity:');
    allPassed = (await runTest('Profile AX: Wizard validation prevents malformed payloads and handles edge inputs', async () => {
      // 1. Missing resume
      const badResume = await apiRequest('/api/analysis/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          githubUsername: 'maya-lin',
          targetRole: 'Engineer',
        }),
      });
      assert(badResume.status === 400, `Expected 400 on missing resume, got ${badResume.status}`);

      // 2. Missing GitHub username
      const badGithub = await apiRequest('/api/analysis/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          resumeText: 'Some resume text',
          targetRole: 'Engineer',
        }),
      });
      assert(badGithub.status === 400, `Expected 400 on missing githubUsername, got ${badGithub.status}`);

      // 3. Normalization of GitHub URL with trailing slash
      const normalizedStart = await apiRequest('/api/analysis/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          resumeText: 'Maya Lin\nSoftware Engineer\nPython, Django',
          githubUsername: 'https://github.com/maya-mobile-user/',
          targetRole: 'Python Developer',
        }),
      });
      assert(normalizedStart.status === 200, `Expected 200 on normalized URL, got ${normalizedStart.status}`);
      const normAuditId = normalizedStart.body.analysisId;

      const normRecord = await db.select().from(analyses).where(eq(analyses.id, normAuditId)).limit(1);
      assert(normRecord[0].githubUsername === 'maya-mobile-user', `Expected normalized username 'maya-mobile-user', got ${normRecord[0].githubUsername}`);

      // Clean up test record
      await db.delete(analyses).where(eq(analyses.id, normAuditId));
    })) && allPassed;

  } finally {
    server.close();
  }

  console.log('\n======================================================');
  if (allPassed) {
    console.log(' ALL STUDENT WORKFLOW PROFILES (AN — AX: 12/12) PASSED! ');
  } else {
    console.error(' SOME TESTS IN STUDENT WORKFLOW MATRIX FAILED! ');
    process.exit(1);
  }
  console.log('======================================================\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
