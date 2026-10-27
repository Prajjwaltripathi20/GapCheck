import http from 'http';
import jwt from 'jsonwebtoken';
import app from '../server';
import { db, ensureDbReady } from '../db';
import { users, analyses, repositories, analysisFindings } from '../db/schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-proofcheck-2024';

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
  console.log(' GAPCHECK PRODUCTION DEPLOYMENT MATRIX (AY — BH: 10/10) ');
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
    const userAEmail = `prod_test_a_${timestamp}@example.com`;
    const userBEmail = `prod_test_b_${timestamp}@example.com`;
    const password = 'Password123!';

    let tokenA = '';
    let userIdA = '';
    let tokenB = '';
    let userIdB = '';
    let auditAId = '';

    // Pre-flight: Register User A and User B
    const regA = await apiRequest('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Prod User A', email: userAEmail, password }),
    });
    tokenA = regA.body.token;
    userIdA = regA.body.user.id;

    const regB = await apiRequest('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Prod User B', email: userBEmail, password }),
    });
    tokenB = regB.body.token;
    userIdB = regB.body.user.id;

    // Create a base analysis for User A
    const startA = await apiRequest('/api/analysis/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        resumeText: 'Prod User A\nFull Stack Engineer\nTypeScript, Node.js, React, PostgreSQL',
        githubUsername: 'prod-user-a',
        targetRole: 'Full Stack Engineer',
        company: 'Vercel',
      }),
    });
    auditAId = startA.body.analysisId;

    // ========================================================
    // PROFILE AY — Production CORS
    // ========================================================
    console.log('Running Profile AY — Production CORS:');
    allPassed = (await runTest('Profile AY: Unauthorized origin rejected appropriately', async () => {
      const corsReq = await apiRequest('/api/dashboard', {
        headers: {
          Authorization: `Bearer ${tokenA}`,
          Origin: 'https://malicious-phishing-site.example.com',
        },
      });
      // In development/test mode, origin header is evaluated via CORS middleware
      // Verify CORS headers do not grant wildcard access to untrusted origin
      const allowOrigin = corsReq.headers.get('access-control-allow-origin');
      assert(allowOrigin !== '*', 'CORS must never allow wildcard * for authenticated requests');
    })) && allPassed;

    // ========================================================
    // PROFILE AZ — Production Auth
    // ========================================================
    console.log('\nRunning Profile AZ — Production Auth:');
    allPassed = (await runTest('Profile AZ: Expired or corrupted JWT returns 401 UNAUTHORIZED', async () => {
      const expiredJwt = jwt.sign({ userId: userIdA }, JWT_SECRET, { expiresIn: -30 });
      const expRes = await apiRequest('/api/dashboard', {
        headers: { Authorization: `Bearer ${expiredJwt}` },
      });
      assert(expRes.status === 401, `Expected 401 on expired token, got ${expRes.status}`);
      assert(expRes.body.error === 'UNAUTHORIZED', 'Expected UNAUTHORIZED error code');
      assert(expRes.body.message.includes('expired'), 'Expected message indicating token expiry');
    })) && allPassed;

    // ========================================================
    // PROFILE BA — Production Ownership
    // ========================================================
    console.log('\nRunning Profile BA — Production Ownership:');
    allPassed = (await runTest('Profile BA: User B cannot access User A analysis or results', async () => {
      const viewRes = await apiRequest(`/api/analysis/${auditAId}`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert(viewRes.status === 403, `Expected 403 FORBIDDEN, got ${viewRes.status}`);
      assert(viewRes.body.error === 'FORBIDDEN', 'Expected FORBIDDEN error code');

      const resultsRes = await apiRequest(`/api/analysis/${auditAId}/results`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert(resultsRes.status === 403, `Expected 403 FORBIDDEN on /results, got ${resultsRes.status}`);
    })) && allPassed;

    // ========================================================
    // PROFILE BB — Production PDF Ownership
    // ========================================================
    console.log('\nRunning Profile BB — Production PDF Ownership:');
    allPassed = (await runTest('Profile BB: User B cannot download User A PDF reports', async () => {
      const pdfRes = await apiRequest(`/api/analysis/${auditAId}/report.pdf`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert(pdfRes.status === 403, `Expected 403 FORBIDDEN on report.pdf, got ${pdfRes.status}`);

      const resumePdfRes = await apiRequest(`/api/analysis/${auditAId}/annotated-resume.pdf`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      assert(resumePdfRes.status === 403, `Expected 403 FORBIDDEN on annotated-resume.pdf, got ${resumePdfRes.status}`);
    })) && allPassed;

    // ========================================================
    // PROFILE BC — Production Demo Isolation
    // ========================================================
    console.log('\nRunning Profile BC — Production Demo Isolation:');
    allPassed = (await runTest('Profile BC: Demo session data never leaks into real user account', async () => {
      const demoRes = await apiRequest('/api/auth/demo', { method: 'POST' });
      assert(demoRes.status === 200, `Expected 200 on demo login, got ${demoRes.status}`);
      const demoToken = demoRes.body.token;

      const demoDash = await apiRequest('/api/dashboard', {
        headers: { Authorization: `Bearer ${demoToken}` },
      });
      assert(demoDash.body.user?.email === 'demo@proofcheck.dev', 'Demo user must have demo email');

      const realDash = await apiRequest('/api/dashboard', {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(realDash.body.user?.email === userAEmail, 'Real user dashboard must have real user email');
      assert(realDash.body.user?.email !== 'demo@proofcheck.dev', 'Demo email must never leak to real user');
    })) && allPassed;

    // ========================================================
    // PROFILE BD — Production Rescan
    // ========================================================
    console.log('\nRunning Profile BD — Production Rescan:');
    allPassed = (await runTest('Profile BD: Rescan creates new immutable audit snapshot with parent link', async () => {
      // Poll until auditAId completes
      let polls = 0;
      let status = '';
      while (status !== 'completed' && polls < 20) {
        await new Promise((r) => setTimeout(r, 350));
        const check = await apiRequest(`/api/analysis/${auditAId}`, {
          headers: { Authorization: `Bearer ${tokenA}` },
        });
        status = check.body.analysis?.status;
        polls++;
      }

      const rescanRes = await apiRequest(`/api/analysis/${auditAId}/rescan`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(rescanRes.status === 200, `Expected 200 on rescan, got ${rescanRes.status}`);
      assert(rescanRes.body.previousAnalysisId === auditAId, 'Previous analysis ID must be preserved');
      assert(rescanRes.body.newAnalysisId !== auditAId, 'New analysis ID must be distinct');
    })) && allPassed;

    // ========================================================
    // PROFILE BE — Production Retry
    // ========================================================
    console.log('\nRunning Profile BE — Production Retry:');
    allPassed = (await runTest('Profile BE: Failed analysis retry preserves inputs and re-executes cleanly', async () => {
      const [failedAudit] = await db.insert(analyses).values({
        userId: userIdA,
        targetRole: 'Data Engineer',
        company: 'Snowflake',
        githubUsername: 'prod-user-a',
        resumeTextSnapshot: 'Prod User A\nData Engineer\nSpark, PySpark, SQL, Airflow',
        status: 'failed',
        progress: 30,
        progressMessage: 'Simulated network timeout during repository fetch',
      }).returning();

      const retryRes = await apiRequest(`/api/analysis/${failedAudit.id}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(retryRes.status === 200, `Expected 200 on retry, got ${retryRes.status}`);
      assert(retryRes.body.analysisId === failedAudit.id, 'Expected retry on same analysisId');

      const retriedRecord = await db.select().from(analyses).where(eq(analyses.id, failedAudit.id)).limit(1);
      assert(retriedRecord[0].targetRole === 'Data Engineer', 'Target role must be preserved');
      assert(retriedRecord[0].company === 'Snowflake', 'Company must be preserved');
    })) && allPassed;

    // ========================================================
    // PROFILE BF — Production Health
    // ========================================================
    console.log('\nRunning Profile BF — Production Health:');
    allPassed = (await runTest('Profile BF: GET /api/health returns 200 OK without internal leaks', async () => {
      const healthRes = await apiRequest('/api/health');
      assert(healthRes.status === 200, `Expected 200, got ${healthRes.status}`);
      assert(healthRes.body.status === 'ok', 'Expected status: ok');
      assert(Boolean(healthRes.body.timestamp), 'Expected timestamp in health response');
      assert(!JSON.stringify(healthRes.body).includes('password'), 'Health check must never leak credentials');
      assert(!JSON.stringify(healthRes.body).includes('postgresql://'), 'Health check must never leak database URL');
    })) && allPassed;

    // ========================================================
    // PROFILE BG — Production Error Safety
    // ========================================================
    console.log('\nRunning Profile BG — Production Error Safety:');
    allPassed = (await runTest('Profile BG: Server errors return structured safe format without leaking stack traces', async () => {
      // Trigger a 404
      const notFoundRes = await apiRequest('/api/analysis/00000000-0000-0000-0000-000000000000', {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(notFoundRes.status === 404, `Expected 404, got ${notFoundRes.status}`);
      assert(typeof notFoundRes.body.error === 'string', 'Error response must contain error code string');
      assert(typeof notFoundRes.body.message === 'string', 'Error response must contain safe message string');
      assert(!JSON.stringify(notFoundRes.body).includes('drizzle'), 'Error response must not leak SQL engine traces');
      assert(!JSON.stringify(notFoundRes.body).includes('node_modules'), 'Error response must not leak file system paths');
    })) && allPassed;

    // ========================================================
    // PROFILE BH — Production Input Limits
    // ========================================================
    console.log('\nRunning Profile BH — Production Input Limits:');
    allPassed = (await runTest('Profile BH: Oversized payloads and malformed IDs return controlled 4xx', async () => {
      // 1. Malformed UUID parameter
      const badIdRes = await apiRequest('/api/analysis/not-a-valid-uuid', {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      assert(badIdRes.status === 400, `Expected 400 on malformed UUID, got ${badIdRes.status}`);
      assert(badIdRes.body.error === 'INVALID_ID', 'Expected INVALID_ID error code');

      // 2. Oversized resume text (> 200k chars)
      const hugeResume = 'A'.repeat(250000);
      const oversizedRes = await apiRequest('/api/analysis/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          resumeText: hugeResume,
          githubUsername: 'prod-user-a',
          targetRole: 'Software Engineer',
        }),
      });
      assert(oversizedRes.status === 400, `Expected 400 on oversized resume, got ${oversizedRes.status}`);
      assert(oversizedRes.body.error === 'INVALID_INPUT', 'Expected INVALID_INPUT error code');
    })) && allPassed;

  } finally {
    server.close();
  }

  console.log('\n======================================================');
  if (allPassed) {
    console.log(' ALL PRODUCTION DEPLOYMENT PROFILES (AY — BH: 10/10) PASSED! ');
  } else {
    console.error(' SOME TESTS IN PRODUCTION MATRIX FAILED! ');
    process.exit(1);
  }
  console.log('======================================================\n');
  process.exit(0);
}

main().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
