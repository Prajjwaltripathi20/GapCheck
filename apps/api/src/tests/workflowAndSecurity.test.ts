import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../server';
import { db, ensureDbReady } from '../db';
import { users, analyses, repositories, analysisFindings } from '../db/schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'proofcheck-jwt-secret-key-change-in-production';

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
  console.log(' GAPCHECK WORKFLOW & SECURITY TEST MATRIX (AC — AM) ');
  console.log('======================================================\n');

  await ensureDbReady();

  // Spin up an ephemeral test server
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  let allPassed = true;

  try {
    // Helper to make fetch requests
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

    // Shared credentials
    const timestamp = Date.now();
    const userAEmail = `student_a_${timestamp}@example.com`;
    const userBEmail = `student_b_${timestamp}@example.com`;
    const password = 'Password123!';

    let userAToken = '';
    let userAId = '';
    let userBToken = '';
    let userBId = '';
    let auditAId = '';

    // PROFILE AC: New Student
    console.log('Running Profile AC — New Student:');
    allPassed = (await runTest('Profile AC: Fresh registration yields empty, uncontaminated workspace', async () => {
      const reg = await apiRequest('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Alice Student', email: userAEmail, password }),
      });
      assert(reg.status === 201, `Expected 201 created, got ${reg.status}`);
      assert(Boolean(reg.body.token), 'Expected token in register response');
      userAToken = reg.body.token;
      userAId = reg.body.user.id;

      // Dashboard should show clean slate
      const dash = await apiRequest('/api/dashboard', {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert(dash.status === 200, `Expected 200, got ${dash.status}`);
      assert(dash.body.hasAnalysis === false, 'New student must not have an analysis');
      assert(dash.body.latestAnalysis === null, 'New student latestAnalysis must be null');
      assert(dash.body.findings.length === 0, 'New student findings must be empty');

      // Analyses list must be empty
      const list = await apiRequest('/api/analysis', {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert(list.status === 200, `Expected 200, got ${list.status}`);
      assert(Array.isArray(list.body.analyses) && list.body.analyses.length === 0, 'Analyses array must be empty');
    })) && allPassed;

    // PROFILE AD: Returning Student
    console.log('\nRunning Profile AD — Returning Student:');
    allPassed = (await runTest('Profile AD: User creates audit and returning student faithfully retrieves it', async () => {
      // Create Audit A
      const startRes = await apiRequest('/api/analysis/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
          targetRole: 'Full Stack Engineer',
          resumeText: 'Alice Student\nSoftware Engineer\nSkills: TypeScript, React, Node.js, PostgreSQL\nExperience: Built scalable web applications.',
          githubUsername: 'student-alice',
        }),
      });

      assert(startRes.status === 200, `Expected 200, got ${startRes.status}`);
      auditAId = startRes.body.analysisId;
      assert(Boolean(auditAId), 'Expected analysisId in response');

      // Let analysis complete in database if background
      let pollCount = 0;
      let status = startRes.body.analysis?.status;
      while (status !== 'completed' && pollCount < 15) {
        await new Promise(r => setTimeout(r, 400));
        const check = await apiRequest(`/api/analysis/${auditAId}`, {
          headers: { Authorization: `Bearer ${userAToken}` },
        });
        status = check.body.analysis?.status;
        pollCount++;
      }

      // Re-fetch dashboard as returning student
      const dash = await apiRequest('/api/dashboard', {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert(dash.status === 200, `Expected 200, got ${dash.status}`);
      assert(dash.body.hasAnalysis === true, 'Returning student must have an analysis');
      assert(dash.body.latestAnalysis?.id === auditAId, 'Returning student must see their analysis');
      assert(typeof dash.body.latestAnalysis?.overallScore === 'number', 'Expected numeric overallScore');

      // Analyses list must contain exactly this audit
      const list = await apiRequest('/api/analysis', {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert(list.status === 200, `Expected 200, got ${list.status}`);
      assert(list.body.analyses.length >= 1, 'Expected at least 1 analysis in history');
      assert(list.body.analyses[0].id === auditAId, 'Expected audit ID in list');
    })) && allPassed;

    // PROFILE AE: Expired Session
    console.log('\nRunning Profile AE — Expired Session:');
    allPassed = (await runTest('Profile AE: Missing, invalid, or expired tokens reject with 401 UNAUTHORIZED', async () => {
      // 1. Missing header
      const noAuth = await apiRequest('/api/dashboard');
      assert(noAuth.status === 401, `Expected 401 on missing auth, got ${noAuth.status}`);
      assert(noAuth.body.error === 'UNAUTHORIZED', 'Expected error UNAUTHORIZED');

      // 2. Invalid token
      const badToken = await apiRequest('/api/dashboard', {
        headers: { Authorization: 'Bearer definitely-not-a-valid-token' },
      });
      assert(badToken.status === 401, `Expected 401 on garbage token, got ${badToken.status}`);
      assert(badToken.body.error === 'UNAUTHORIZED', 'Expected error UNAUTHORIZED');

      // 3. Expired token
      const expiredJwt = jwt.sign({ userId: userAId }, JWT_SECRET, { expiresIn: -10 });
      const expRes = await apiRequest('/api/dashboard', {
        headers: { Authorization: `Bearer ${expiredJwt}` },
      });
      assert(expRes.status === 401, `Expected 401 on expired token, got ${expRes.status}`);
      assert(expRes.body.error === 'UNAUTHORIZED', 'Expected error UNAUTHORIZED');
      assert(!JSON.stringify(expRes.body).includes('demo@proofcheck.dev'), 'Expired token must NEVER return demo data');
    })) && allPassed;

    // PROFILE AF: Demo Isolation
    console.log('\nRunning Profile AF — Demo Isolation:');
    allPassed = (await runTest('Profile AF: Demo session data never leaks into a real student account', async () => {
      // Login demo
      const demoRes = await apiRequest('/api/auth/demo', { method: 'POST' });
      assert(demoRes.status === 200, `Expected 200 on demo login, got ${demoRes.status}`);
      const demoToken = demoRes.body.token;

      const demoDash = await apiRequest('/api/dashboard', {
        headers: { Authorization: `Bearer ${demoToken}` },
      });
      assert(demoDash.status === 200, 'Expected demo dashboard 200');
      assert(demoDash.body.user?.email === 'demo@proofcheck.dev', 'Expected demo email');

      // User A (real student) must see zero demo data
      const userADash = await apiRequest('/api/dashboard', {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert(userADash.body.user?.email === userAEmail, 'User A dashboard must belong to User A');
      assert(userADash.body.user?.email !== 'demo@proofcheck.dev', 'Demo email must not leak to User A');
    })) && allPassed;

    // Register User B for isolation testing
    const regB = await apiRequest('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bob Student', email: userBEmail, password }),
    });
    userBToken = regB.body.token;
    userBId = regB.body.user.id;

    // PROFILE AG: User Ownership Isolation
    console.log('\nRunning Profile AG — User Ownership Isolation:');
    allPassed = (await runTest('Profile AG: User B cannot access User A analysis, findings, or rescan', async () => {
      // User B attempts to read User A's analysis
      const viewA = await apiRequest(`/api/analysis/${auditAId}`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      assert(viewA.status === 403, `Expected 403 FORBIDDEN for User B on User A analysis, got ${viewA.status}`);
      assert(viewA.body.error === 'FORBIDDEN', 'Expected FORBIDDEN error code');

      // User B attempts to get User A's results
      const resA = await apiRequest(`/api/analysis/${auditAId}/results`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      assert(resA.status === 403, `Expected 403 FORBIDDEN on /results, got ${resA.status}`);

      // User B attempts to load User A's analysis via dashboard parameter
      const dashA = await apiRequest(`/api/dashboard?analysisId=${auditAId}`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      assert(dashA.status === 403, `Expected 403 FORBIDDEN on dashboard?analysisId, got ${dashA.status}`);

      // User B attempts to rescan User A's analysis
      const rescanA = await apiRequest(`/api/analysis/${auditAId}/rescan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      assert(rescanA.status === 403, `Expected 403 FORBIDDEN on rescan, got ${rescanA.status}`);

      // User B attempts to retry User A's analysis
      const retryA = await apiRequest(`/api/analysis/${auditAId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      assert(retryA.status === 403, `Expected 403 FORBIDDEN on retry, got ${retryA.status}`);
    })) && allPassed;

    // PROFILE AH: PDF Ownership Isolation
    console.log('\nRunning Profile AH — PDF Ownership Isolation:');
    allPassed = (await runTest('Profile AH: User B cannot download User A audit report or annotated resume PDF', async () => {
      // User B attempts PDF audit report
      const pdfB = await apiRequest(`/api/analysis/${auditAId}/report.pdf`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      assert(pdfB.status === 403, `Expected 403 FORBIDDEN on report.pdf, got ${pdfB.status}`);

      // User B attempts PDF annotated resume
      const resumeB = await apiRequest(`/api/analysis/${auditAId}/annotated-resume.pdf`, {
        headers: { Authorization: `Bearer ${userBToken}` },
      });
      assert(resumeB.status === 403, `Expected 403 FORBIDDEN on annotated-resume.pdf, got ${resumeB.status}`);

      // User A downloads their own report
      const pdfA = await apiRequest(`/api/analysis/${auditAId}/report.pdf`, {
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert(pdfA.status === 200, `Expected 200 on User A report.pdf, got ${pdfA.status}`);
      assert(Boolean(pdfA.headers.get('content-type')?.includes('application/pdf')), 'Expected application/pdf header');
    })) && allPassed;

    // PROFILE AI: Historical Snapshot Immutability
    console.log('\nRunning Profile AI — Historical Snapshot Immutability:');
    let originalCompletedAt = '';
    let originalScore = 0;
    allPassed = (await runTest('Profile AI: Completed audit remains completely frozen after a new scan', async () => {
      // Capture initial Audit A state
      const initialRecord = await db.select().from(analyses).where(eq(analyses.id, auditAId)).limit(1);
      assert(initialRecord.length === 1, 'Expected Audit A in database');
      originalCompletedAt = initialRecord[0].completedAt?.toISOString() || '';
      originalScore = initialRecord[0].overallScore || 0;

      // Seed a repo snapshot explicitly into Audit A
      await db.insert(repositories).values({
        analysisId: auditAId,
        userId: userAId,
        name: 'alice-initial-project',
        fullName: 'student-alice/alice-initial-project',
        hasReadme: true,
        language: 'TypeScript',
        stars: 3,
      });

      const audit1ReposBefore = await db.select().from(repositories).where(eq(repositories.analysisId, auditAId));
      assert(audit1ReposBefore.length >= 1, 'Expected at least 1 repo linked to Audit A');

      // User A runs a second distinct analysis (Audit A2)
      const audit2Res = await apiRequest('/api/analysis/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userAToken}`,
        },
        body: JSON.stringify({
          targetRole: 'Senior Backend Engineer',
          resumeText: 'Alice Student\nSenior Backend Engineer\nSkills: Go, Kubernetes, Kafka, Distributed Systems',
          githubUsername: 'student-alice',
        }),
      });
      assert(audit2Res.status === 200, 'Expected Audit A2 to start');

      // Verify Audit A did NOT change
      const audit1ReposAfter = await db.select().from(repositories).where(eq(repositories.analysisId, auditAId));
      assert(audit1ReposAfter.length === audit1ReposBefore.length, 'Audit A repositories must NOT be mutated by Audit A2');
      assert(audit1ReposAfter[0].name === 'alice-initial-project', 'Audit A repository name must remain identical');

      const audit1RecordAfter = await db.select().from(analyses).where(eq(analyses.id, auditAId)).limit(1);
      assert(audit1RecordAfter[0].targetRole === 'Full Stack Engineer', 'Audit A targetRole must remain intact');
      assert(audit1RecordAfter[0].overallScore === originalScore, 'Audit A overallScore must remain untouched');
    })) && allPassed;

    // PROFILE AJ: Rescan Delta
    console.log('\nRunning Profile AJ — Rescan Delta:');
    allPassed = (await runTest('Profile AJ: POST /api/analysis/:id/rescan creates new snapshot and computes deltas', async () => {
      const rescanRes = await apiRequest(`/api/analysis/${auditAId}/rescan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
      });

      assert(rescanRes.status === 200, `Expected 200 OK on rescan, got ${rescanRes.status}`);
      assert(rescanRes.body.previousAnalysisId === auditAId, 'Expected previousAnalysisId to match auditAId');
      assert(rescanRes.body.newAnalysisId !== auditAId, 'Expected newAnalysisId to be distinct');
      assert(typeof rescanRes.body.delta?.repositoriesAdded === 'number', 'Expected repositoriesAdded count');
      assert(typeof rescanRes.body.delta?.repositoriesRemoved === 'number', 'Expected repositoriesRemoved count');
      assert(typeof rescanRes.body.delta?.readmesAdded === 'number', 'Expected readmesAdded count');
      assert(typeof rescanRes.body.delta?.claimsNewlySupported === 'number', 'Expected claimsNewlySupported count');

      // Verify new audit links parentAnalysisId
      const newAuditRecord = await db.select().from(analyses).where(eq(analyses.id, rescanRes.body.newAnalysisId)).limit(1);
      assert(newAuditRecord[0].parentAnalysisId === auditAId, 'New audit must have parentAnalysisId set to original audit');
    })) && allPassed;

    // PROFILE AK: Failed Rescan Preservation
    console.log('\nRunning Profile AK — Failed Rescan Preservation:');
    allPassed = (await runTest('Profile AK: Failed GitHub fetch aborts rescan cleanly and preserves previous audit', async () => {
      // Temporarily set an invalid GitHub input that fails scanner fetch
      await db.update(analyses).set({ githubUsername: 'https://invalid-external-domain.com/unreachable' }).where(eq(analyses.id, auditAId));

      const failedRescan = await apiRequest(`/api/analysis/${auditAId}/rescan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
      });

      // Must return an error (404, 502, or 500)
      assert(failedRescan.status >= 400, `Expected error status code on failed rescan, got ${failedRescan.status}`);

      // Verify Audit A status is still 'completed' and not damaged
      const auditACheck = await db.select().from(analyses).where(eq(analyses.id, auditAId)).limit(1);
      assert(auditACheck[0].status === 'completed', 'Audit A status must remain completed after failed rescan');
      assert(Boolean(auditACheck[0].completedAt), 'Audit A completedAt must remain present');

      // Restore githubUsername
      await db.update(analyses).set({ githubUsername: 'student-alice' }).where(eq(analyses.id, auditAId));
    })) && allPassed;

    // PROFILE AL: Failed Analysis Retry
    console.log('\nRunning Profile AL — Failed Analysis Retry:');
    allPassed = (await runTest('Profile AL: Failed/pending analysis can be retried with preserved inputs', async () => {
      // Create a simulated interrupted/failed analysis
      const [failedAudit] = await db.insert(analyses).values({
        userId: userAToken ? userAId : '',
        targetRole: 'DevOps Engineer',
        githubUsername: 'student-alice',
        resumeTextSnapshot: 'Alice Student\nDevOps Engineer\nDocker, Kubernetes, Terraform, CI/CD',
        status: 'failed',
        progress: 40,
        progressMessage: 'Analysis interrupted by timeout',
      }).returning();

      assert(failedAudit.status === 'failed', 'Audit must be initialized as failed');

      // Call retry endpoint
      const retryRes = await apiRequest(`/api/analysis/${failedAudit.id}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
      });

      assert(retryRes.status === 200, `Expected 200 on retry, got ${retryRes.status}`);
      assert(retryRes.body.analysisId === failedAudit.id, 'Expected retry on same analysis ID');

      // Verify audit reset from failed and ran
      const retriedAudit = await db.select().from(analyses).where(eq(analyses.id, failedAudit.id)).limit(1);
      assert(retriedAudit[0].status === 'completed' || retriedAudit[0].status === 'pending', 'Status must have transitioned from failed');
      assert(retriedAudit[0].targetRole === 'DevOps Engineer', 'Target role must be preserved');
    })) && allPassed;

    // PROFILE AM: Invalid State Transition
    console.log('\nRunning Profile AM — Invalid State Transition:');
    allPassed = (await runTest('Profile AM: Completed analyses reject retry and non-existent IDs return 404', async () => {
      // 1. Attempting retry on an already completed audit
      const completedRetry = await apiRequest(`/api/analysis/${auditAId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert(completedRetry.status === 400, `Expected 400 INVALID_STATE on completed audit retry, got ${completedRetry.status}`);
      assert(completedRetry.body.error === 'INVALID_STATE', 'Expected INVALID_STATE error');

      // 2. Rescan on non-existent analysis
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const fakeRescan = await apiRequest(`/api/analysis/${fakeId}/rescan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert(fakeRescan.status === 404, `Expected 404 NOT_FOUND on fake rescan, got ${fakeRescan.status}`);

      // 3. Retry on non-existent analysis
      const fakeRetry = await apiRequest(`/api/analysis/${fakeId}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userAToken}` },
      });
      assert(fakeRetry.status === 404, `Expected 404 NOT_FOUND on fake retry, got ${fakeRetry.status}`);
    })) && allPassed;

  } finally {
    server.close();
  }

  console.log('\n======================================================');
  if (allPassed) {
    console.log(' ALL WORKFLOW & SECURITY PROFILES (AC — AM: 11/11) PASSED! ');
  } else {
    console.error(' SOME TESTS IN WORKFLOW MATRIX FAILED! ');
    process.exit(1);
  }
  console.log('======================================================\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
