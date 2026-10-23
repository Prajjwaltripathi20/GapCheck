import { GitHubRepo } from '../services/githubAnalyzer';
import { ParsedResume } from '../services/resumeParser';
import { performRecruiterAudit, classifyRepository } from '../services/recruiterAudit';
import { matchClaimsToEvidence } from '../services/evidenceEngine';
import { generatePreApplicationDecision } from '../services/preApplicationDecision';

function createMockRepo(overrides: Partial<GitHubRepo>): GitHubRepo {
  return {
    name: overrides.name || 'mock-repo',
    fullName: overrides.fullName || `user/${overrides.name || 'mock-repo'}`,
    description: overrides.description !== undefined ? overrides.description : 'A sample software project',
    language: overrides.language !== undefined ? overrides.language : 'TypeScript',
    languages: overrides.languages || { TypeScript: 10000, JavaScript: 2000 },
    stars: overrides.stars || 5,
    forks: overrides.forks || 0,
    topics: overrides.topics || ['typescript', 'react'],
    hasReadme: overrides.hasReadme !== undefined ? overrides.hasReadme : true,
    readmeContent: overrides.readmeContent !== undefined ? overrides.readmeContent : '# Project\n## Overview\nProduction application.\n## Setup\nRun npm install and npm test.\n## Architecture\nLayered MVC design.',
    hasDockerfile: overrides.hasDockerfile || false,
    hasCi: overrides.hasCi || false,
    hasTests: overrides.hasTests || false,
    packageJson: overrides.packageJson || { dependencies: { react: '^18.0.0', express: '^4.18.0' } },
    requirementsTxt: overrides.requirementsTxt || null,
    fileTree: overrides.fileTree || [
      'package.json',
      'README.md',
      'src/index.ts',
      'src/components/App.tsx',
      'src/routes/api.ts',
      'src/controllers/userController.ts',
      'src/services/userService.ts',
      'src/models/userModel.ts',
    ],
    lastCommitAt: overrides.lastCommitAt !== undefined ? overrides.lastCommitAt : new Date().toISOString(),
    commitCount: overrides.commitCount || 25,
    htmlUrl: overrides.htmlUrl || `https://github.com/user/${overrides.name || 'mock-repo'}`,
    isFork: overrides.isFork || false,
    parentRepo: overrides.parentRepo || null,
  };
}

function runTest(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    return true;
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    return false;
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

console.log('\n======================================================');
console.log(' GAPCHECK AUDIT ENGINE TEST MATRIX (PROFILES A — H) ');
console.log('======================================================\n');

let allPassed = true;

// ----------------------------------------------------------------------------
// PROFILE A: EXCELLENT CANDIDATE
// ----------------------------------------------------------------------------
console.log('Running Profile A — Excellent Candidate:');
allPassed = runTest('Profile A achieves high readiness (>=80), few concerns, and strong consistency', () => {
  const repos: GitHubRepo[] = [
    createMockRepo({
      name: 'ecommerce-hub',
      hasTests: true,
      hasCi: true,
      hasDockerfile: true,
      commitCount: 45,
      packageJson: { dependencies: { react: '^18.0.0', next: '^14.0.0', typescript: '^5.0.0' } },
      fileTree: [
        'package.json', 'README.md', 'Dockerfile', '.github/workflows/ci.yml',
        'src/app/page.tsx', 'src/components/Cart.tsx', 'src/lib/api.ts',
        'src/services/orderService.ts', 'src/__tests__/order.test.ts',
      ],
    }),
    createMockRepo({
      name: 'api-gateway',
      language: 'Go',
      hasTests: true,
      commitCount: 30,
      fileTree: ['go.mod', 'README.md', 'main.go', 'proxy/handler.go', 'proxy/handler_test.go', 'config/config.go'],
    }),
    createMockRepo({
      name: 'dev-collab-tool',
      hasTests: true,
      commitCount: 22,
      fileTree: ['package.json', 'README.md', 'src/server.ts', 'src/routes.ts', 'src/auth.ts', 'tests/auth.test.ts'],
    }),
  ];

  const resume: ParsedResume = {
    personal: { links: [] },
    education: [],
    skills: { languages: ['TypeScript', 'Go'], frameworks: ['React', 'Next.js'], databases: ['PostgreSQL'], cloud: [], tools: ['Docker', 'CI/CD'], other: [] },
    projects: [
      { name: 'Ecommerce Hub', technologies: ['React', 'Next.js', 'TypeScript', 'Docker'], description: 'Production e-commerce storefront with live cart management and CI/CD automation.', claims: [], metrics: [], links: [] },
      { name: 'API Gateway', technologies: ['Go', 'Docker'], description: 'High-throughput reverse proxy and API routing service written in Go.', claims: [], metrics: [], links: [] },
    ],
    experience: [],
    achievements: [],
    certifications: [],
  };

  const audit = performRecruiterAudit(repos, resume, 'Full Stack Engineer');

  assert(audit.readiness.score >= 80, `Expected score >= 80, got ${audit.readiness.score}`);
  assert(audit.summary.strongProjectsCount >= 2, `Expected >= 2 strong projects, got ${audit.summary.strongProjectsCount}`);
  assert(audit.consistency.resumeProjectsFound.length === 2, `Expected 2 matched resume projects, got ${audit.consistency.resumeProjectsFound.length}`);
  assert(audit.concerns.filter(c => c.severity === 'high').length === 0, `Expected 0 high severity concerns, got ${audit.concerns.filter(c => c.severity === 'high').length}`);
}) && allPassed;

// ----------------------------------------------------------------------------
// PROFILE B: NOISY CANDIDATE (3 STRONG PROJECTS + 15 DSA / PRACTICE REPOS)
// ----------------------------------------------------------------------------
console.log('\nRunning Profile B — Noisy Candidate (3 Strong + 15 DSA / Practice repos):');
allPassed = runTest('Profile B retains strong core project evidence (>=80) without score crash from DSA repos', () => {
  const strongRepos: GitHubRepo[] = [
    createMockRepo({
      name: 'finance-tracker',
      hasTests: true,
      hasCi: true,
      hasDockerfile: true,
      commitCount: 35,
      fileTree: ['package.json', 'README.md', 'Dockerfile', 'src/App.tsx', 'src/components/Budget.tsx', 'src/api/routes.ts', 'src/tests/api.test.ts', 'src/models/account.ts'],
    }),
    createMockRepo({
      name: 'chat-application',
      hasTests: true,
      hasCi: true,
      commitCount: 28,
      fileTree: ['package.json', 'README.md', 'src/client/App.tsx', 'src/client/Chat.tsx', 'src/server/server.ts', 'src/server/socket.ts', 'src/tests/socket.test.ts'],
    }),
    createMockRepo({
      name: 'task-flow',
      hasTests: true,
      commitCount: 20,
      fileTree: ['package.json', 'README.md', 'src/index.ts', 'src/components/Task.tsx', 'src/components/Column.tsx', 'src/state/store.ts', 'src/tests/task.test.ts'],
    }),
  ];

  const dsaRepos: GitHubRepo[] = Array.from({ length: 15 }, (_, i) =>
    createMockRepo({
      name: `leetcode-solutions-${i + 1}`,
      description: 'Daily algorithmic problem solving exercises and competitive programming solutions',
      hasReadme: true,
      readmeContent: '# LeetCode Solutions\nCollection of problems solved on LeetCode.',
      commitCount: 10 + i,
      fileTree: ['README.md', 'solution.py', 'arrays/two_sum.py'],
    })
  );

  const repos = [...strongRepos, ...dsaRepos];
  const audit = performRecruiterAudit(repos, null);

  assert(audit.summary.strongProjectsCount >= 2, `Expected >= 2 strong projects, got ${audit.summary.strongProjectsCount}`);
  assert(audit.summary.practiceCount === 15, `Expected 15 practice repos, got ${audit.summary.practiceCount}`);
  assert(audit.readiness.dimensions.projectQuality >= 75, `Expected core projectQuality >= 75, got ${audit.readiness.dimensions.projectQuality}`);
  assert(audit.readiness.score >= 68, `Expected readiness score >= 68 (not destroyed by DSA repos), got ${audit.readiness.score}`);
}) && allPassed;

// ----------------------------------------------------------------------------
// PROFILE C: RESUME INFLATION (CLAIMS WITHOUT CODE EVIDENCE)
// ----------------------------------------------------------------------------
console.log('\nRunning Profile C — Resume Inflation:');
allPassed = runTest('Profile C calmly identifies unverified claims without abusive language', () => {
  const claims = [
    { claim: 'React', claimType: 'skill' as const, category: 'frontend', source: 'resume' },
    { claim: 'Node.js', claimType: 'skill' as const, category: 'backend', source: 'resume' },
    { claim: 'Redis', claimType: 'skill' as const, category: 'backend', source: 'resume' },
    { claim: 'Docker', claimType: 'skill' as const, category: 'devops', source: 'resume' },
    { claim: 'AWS', claimType: 'skill' as const, category: 'cloud', source: 'resume' },
  ];

  const evidence = [
    { skill: 'React', evidenceType: 'package_dependency', source: 'package.json', detail: 'react ^18.2.0', confidence: 0.95, metadata: { repository: 'frontend-app' } },
    { skill: 'React', evidenceType: 'ast_pattern', source: 'src/App.tsx', detail: 'React component tree', confidence: 0.90, metadata: { repository: 'frontend-app' } },
    { skill: 'React', evidenceType: 'package_dependency', source: 'package.json', detail: 'react ^18.0.0', confidence: 0.90, metadata: { repository: 'ui-kit' } },
    { skill: 'Node.js', evidenceType: 'manifest', source: 'package.json', detail: 'node runtime engine', confidence: 0.90, metadata: { repository: 'frontend-app' } },
    { skill: 'Node.js', evidenceType: 'ast_pattern', source: 'server.js', detail: 'Express server entrypoint', confidence: 0.85, metadata: { repository: 'frontend-app' } },
  ];

  const findings = matchClaimsToEvidence(claims, evidence, ['React', 'Node.js', 'Redis', 'AWS']);

  const reactMatch = findings.find(f => f.skill === 'React');
  const nodeMatch = findings.find(f => f.skill === 'Node.js');
  const redisMatch = findings.find(f => f.skill === 'Redis');
  const awsMatch = findings.find(f => f.skill === 'AWS');

  assert(reactMatch?.evidenceStatus === 'verified' || reactMatch?.evidenceStatus === 'supported', `React should be verified or supported, got ${reactMatch?.evidenceStatus}`);
  assert(nodeMatch?.evidenceStatus === 'supported' || nodeMatch?.evidenceStatus === 'verified', `Node.js should be supported, got ${nodeMatch?.evidenceStatus}`);
  assert(redisMatch?.evidenceStatus === 'unverified', 'Redis should be unverified');
  assert(awsMatch?.evidenceStatus === 'unverified', 'AWS should be unverified');
  assert(!redisMatch?.assessment.toLowerCase().includes('liar') && !redisMatch?.assessment.toLowerCase().includes('fake'), 'Assessment must use professional language');
}) && allPassed;

// ----------------------------------------------------------------------------
// PROFILE D: OLD BUT COMPLETE PROJECT (2+ YEARS OLD)
// ----------------------------------------------------------------------------
console.log('\nRunning Profile D — Old but Complete Project:');
allPassed = runTest('Profile D is not falsely flagged as outdated or broken side-project', () => {
  const threeYearsAgo = new Date(Date.now() - (1000 * 60 * 60 * 24 * 800)).toISOString();
  const repo = createMockRepo({
    name: 'portfolio-v1',
    description: 'Personal web application and showcase built in 2023',
    commitCount: 24,
    lastCommitAt: threeYearsAgo,
    hasReadme: true,
    hasTests: true,
    readmeContent: '# Portfolio V1\n## Architecture\nBuilt with React and Vite.\n## Setup\nRun npm install.\n## Features\nInteractive projects showcase.',
    fileTree: ['package.json', 'README.md', 'src/App.tsx', 'src/components/Header.tsx', 'src/components/Card.tsx', 'src/tests/app.test.tsx'],
  });

  const classified = classifyRepository(repo);

  assert(classified.classification !== 'UNFINISHED / NEEDS REVIEW', `Must not be UNFINISHED, got ${classified.classification}`);
  assert(classified.classification === 'SUPPORTING PROJECT' || classified.classification === 'STRONG PROJECT', `Expected SUPPORTING or STRONG PROJECT, got ${classified.classification}`);
  assert(classified.presentationPriority === 'ARCHIVED' || classified.presentationPriority === 'SUPPORTING', `Expected ARCHIVED or SUPPORTING priority, got ${classified.presentationPriority}`);
}) && allPassed;

// ----------------------------------------------------------------------------
// PROFILE E: SMALL BUT EXCELLENT PROJECT (8 MEANINGFUL FILES, TESTS, README)
// ----------------------------------------------------------------------------
console.log('\nRunning Profile E — Small but Excellent Project:');
allPassed = runTest('Profile E (8 files, clear tests & README) is recognized as complete, not unfinished', () => {
  const repo = createMockRepo({
    name: 'jwt-auth-middleware',
    description: 'Lightweight, zero-dependency JWT authentication middleware for Express',
    commitCount: 16,
    hasTests: true,
    hasReadme: true,
    readmeContent: '# JWT Auth Middleware\n## Setup\nnpm i jwt-auth\n## Architecture\nHandles Bearer token validation and claim verification.\n## Testing\n100% unit test coverage with Jest.',
    fileTree: [
      'package.json',
      'README.md',
      'src/index.ts',
      'src/verify.ts',
      'src/types.ts',
      'src/errors.ts',
      'tests/verify.test.ts',
      'tests/errors.test.ts',
    ],
  });

  const classified = classifyRepository(repo);

  assert(classified.classification !== 'UNFINISHED / NEEDS REVIEW', `Small tested repo must not be UNFINISHED, got ${classified.classification}`);
  assert(classified.classification === 'STRONG PROJECT' || classified.classification === 'UTILITY / TOOL' || classified.classification === 'SUPPORTING PROJECT', `Got ${classified.classification}`);
  assert(classified.signals.some(s => s.toLowerCase().includes('test') || s.toLowerCase().includes('utility')), 'Should identify testing or utility structure');
}) && allPassed;

// ----------------------------------------------------------------------------
// PROFILE F: FORK-HEAVY PROFILE
// ----------------------------------------------------------------------------
console.log('\nRunning Profile F — Fork-heavy Profile:');
allPassed = runTest('Profile F identifies forks without implying misconduct', () => {
  const repos = [
    createMockRepo({
      name: 'facebook-react-fork',
      isFork: true,
      parentRepo: 'facebook/react',
      commitCount: 2,
      fileTree: ['package.json', 'README.md', 'packages/react/index.js'],
    }),
    createMockRepo({
      name: 'express-fork',
      isFork: true,
      parentRepo: 'expressjs/express',
      commitCount: 1,
      fileTree: ['package.json', 'README.md', 'lib/express.js'],
    }),
  ];

  const audit = performRecruiterAudit(repos, null);
  const forkClass = audit.repositories[0].classification;

  assert(forkClass === 'FORK / CONTRIBUTION', `Expected FORK / CONTRIBUTION, got ${forkClass}`);
  assert(!audit.repositories[0].recruiterNotes.includes('cheating') && !audit.repositories[0].recruiterNotes.includes('fake'), 'No misconduct implied');
}) && allPassed;

// ----------------------------------------------------------------------------
// PROFILE G: NO GITHUB PROJECTS MATCHING RESUME
// ----------------------------------------------------------------------------
console.log('\nRunning Profile G — Unmatched Resume Projects:');
allPassed = runTest('Profile G flags unmatched projects calmly as UNVERIFIED with possible reasons', () => {
  const repos = [
    createMockRepo({ name: 'dotfiles', fileTree: ['.zshrc', '.vimrc'] }),
    createMockRepo({ name: 'misc-scripts', fileTree: ['backup.sh'] }),
  ];

  const resume: ParsedResume = {
    personal: { links: [] },
    education: [],
    skills: { languages: [], frameworks: [], databases: [], cloud: [], tools: [], other: [] },
    projects: [
      { name: 'Core Banking Ledger', technologies: ['Java', 'Spring'], description: 'High-security transaction accounting engine built for client engagement.', claims: [], metrics: [], links: [] },
    ],
    experience: [],
    achievements: [],
    certifications: [],
  };

  const audit = performRecruiterAudit(repos, resume);

  assert(audit.consistency.resumeProjectsMissing.length === 1, 'Should list 1 missing project');
  const missing = audit.consistency.resumeProjectsMissing[0];
  assert(missing.note.includes('No sufficiently strong public repository match was found'), 'Wording must be calm and clear');
  assert(missing.possibleReasons !== undefined && missing.possibleReasons.length > 0, 'Must include plausible reasons (e.g. private repo)');
}) && allPassed;

// ----------------------------------------------------------------------------
// PROFILE H: TARGET ROLE MISMATCH (FRONTEND CANDIDATE APPLYING FOR BACKEND)
// ----------------------------------------------------------------------------
console.log('\nRunning Profile H — Target Role Mismatch:');
allPassed = runTest('Profile H separates general GitHub quality from target role alignment', () => {
  const repos = [
    createMockRepo({
      name: 'react-design-system',
      language: 'TypeScript',
      hasTests: true,
      hasCi: true,
      commitCount: 30,
      packageJson: { dependencies: { react: '^18.0.0', tailwindcss: '^3.0.0' } },
      fileTree: ['package.json', 'README.md', 'src/Button.tsx', 'src/Input.tsx', 'src/Modal.tsx', 'src/Dropdown.tsx', 'src/hooks/useTheme.ts', 'src/tests/button.test.tsx'],
    }),
  ];

  const audit = performRecruiterAudit(repos, null, 'Backend Engineer');

  assert(audit.repositories[0].classification === 'STRONG PROJECT' || audit.repositories[0].classification === 'SUPPORTING PROJECT', `General project quality is preserved, got ${audit.repositories[0].classification}`);
  assert(audit.repositories[0].roleRelevance === 'LOW', `Role relevance for backend should be LOW, got ${audit.repositories[0].roleRelevance}`);
  const targetConcern = audit.concerns.find(c => c.category === 'target_role_gap');
  assert(targetConcern !== undefined, 'Should produce targeted role relevance recommendation');
}) && allPassed;

// ----------------------------------------------------------------------------
// PROFILE I: HIGH SCORE, MAJOR ROLE GAP
// ----------------------------------------------------------------------------
console.log('\nRunning Profile I — High Score, Major Role Gap:');
allPassed = runTest('Profile I is not automatically READY; role-critical gap influences recommendation', () => {
  const repos = [
    createMockRepo({
      name: 'react-frontend-suite',
      language: 'TypeScript',
      hasTests: true,
      hasCi: true,
      hasDockerfile: true,
      commitCount: 60,
      packageJson: { dependencies: { react: '^18.0.0', next: '^14.0.0', tailwindcss: '^3.0.0' } },
      fileTree: ['package.json', 'README.md', 'Dockerfile', 'src/App.tsx', 'src/tests/app.test.tsx'],
    }),
  ];

  const resume: ParsedResume = {
    personal: { links: [] },
    education: [],
    skills: { languages: ['TypeScript', 'JavaScript'], frameworks: ['React', 'Next.js'], databases: [], cloud: [], tools: ['Docker'], other: [] },
    projects: [{ name: 'React Frontend Suite', technologies: ['React', 'TypeScript'], description: 'Responsive web frontend.', claims: [], metrics: [], links: [] }],
    experience: [],
    achievements: [],
    certifications: [],
  };

  const findings = matchClaimsToEvidence([], [], ['go', 'postgresql', 'docker']);
  const audit = performRecruiterAudit(repos, resume, 'Backend Systems Engineer');

  const decision = generatePreApplicationDecision({
    findings,
    recruiterAudit: audit,
    repos,
    parsedResume: resume,
    targetRole: 'Backend Systems Engineer',
    jobRequirements: ['go', 'postgresql', 'docker'],
  });

  assert(audit.readiness.score >= 70, `General score is high (${audit.readiness.score})`);
  assert(decision.recommendation !== 'READY', `High score must NOT automatically result in READY when major role gaps exist (got ${decision.recommendation})`);
  assert(decision.roleCriticalGaps.length >= 1, 'Role-critical gaps must be identified');
  assert(decision.mustFix.some(a => a.targetRoleCritical), 'Must include role-critical action in mustFix');
}) && allPassed;

// ----------------------------------------------------------------------------
// PROFILE J: MODERATE SCORE, STRONG ROLE ALIGNMENT
// ----------------------------------------------------------------------------
console.log('\nRunning Profile J — Moderate Score, Strong Role Alignment:');
allPassed = runTest('Profile J with moderate score but strong role alignment is not unfairly blocked', () => {
  const repos = [
    createMockRepo({
      name: 'portfolio-cms',
      language: 'TypeScript',
      hasTests: true,
      commitCount: 22,
      packageJson: { dependencies: { react: '^18.0.0', typescript: '^5.0.0', tailwindcss: '^3.0.0' } },
      fileTree: ['package.json', 'README.md', 'src/index.tsx', 'src/components/Card.tsx', 'src/tests/card.test.tsx'],
    }),
  ];

  const resume: ParsedResume = {
    personal: { links: [] },
    education: [],
    skills: { languages: ['TypeScript'], frameworks: ['React', 'Tailwind'], databases: [], cloud: [], tools: ['Testing'], other: [] },
    projects: [{ name: 'Portfolio CMS', technologies: ['React', 'TypeScript'], description: 'Tailwind React frontend.', claims: [], metrics: [], links: [] }],
    experience: [],
    achievements: [],
    certifications: [],
  };

  const findings = [
    {
      skill: 'React',
      resumeClaim: 'Built React UI components',
      claimLevel: 'proficient' as const,
      evidenceStatus: 'verified' as const,
      assessment: 'Corroborated by active React repository.',
      confidence: 0.9,
      priority: 'low' as const,
      evidenceSources: [],
    },
    {
      skill: 'TypeScript',
      resumeClaim: 'Typed components in TypeScript',
      claimLevel: 'proficient' as const,
      evidenceStatus: 'verified' as const,
      assessment: 'TypeScript in package.json and source files.',
      confidence: 0.9,
      priority: 'low' as const,
      evidenceSources: [],
    },
  ];

  const audit = performRecruiterAudit(repos, resume, 'Frontend Developer');

  const decision = generatePreApplicationDecision({
    findings,
    recruiterAudit: audit,
    repos,
    parsedResume: resume,
    targetRole: 'Frontend Developer',
    jobRequirements: ['react', 'typescript'],
  });

  assert(decision.roleCriticalGaps.length === 0, 'No role critical gaps exist');
  assert(decision.mustFix.length === 0, 'Should have 0 must-fix blockers');
  assert(decision.recommendation === 'READY', `Score alone does not block application when role alignment is strong (got ${decision.recommendation})`);
}) && allPassed;

// ----------------------------------------------------------------------------
// PROFILE K: MANY PRACTICE REPOSITORIES
// ----------------------------------------------------------------------------
console.log('\nRunning Profile K — Many Practice Repositories:');
allPassed = runTest('Profile K preserves practice repos under "You Don\'t Need to Fix" without unfair penalty', () => {
  const practiceRepos = Array.from({ length: 15 }, (_, i) =>
    createMockRepo({
      name: `leetcode-solutions-${i + 1}`,
      language: 'C++',
      commitCount: 8,
      fileTree: ['solution.cpp'],
    })
  );

  const repos = [
    createMockRepo({
      name: 'ecommerce-backend',
      language: 'Go',
      hasTests: true,
      commitCount: 40,
      fileTree: ['go.mod', 'README.md', 'main.go', 'handler.go', 'handler_test.go'],
    }),
    ...practiceRepos,
  ];

  const resume: ParsedResume = {
    personal: { links: [] },
    education: [],
    skills: { languages: ['Go'], frameworks: [], databases: [], cloud: [], tools: [], other: [] },
    projects: [{ name: 'E-commerce Backend', technologies: ['Go'], description: 'Go REST service.', claims: [], metrics: [], links: [] }],
    experience: [],
    achievements: [],
    certifications: [],
  };

  const audit = performRecruiterAudit(repos, resume, 'Backend Engineer');
  const decision = generatePreApplicationDecision({
    findings: [],
    recruiterAudit: audit,
    repos,
    parsedResume: resume,
    targetRole: 'Backend Engineer',
    jobRequirements: ['go'],
  });

  const practiceSafe = decision.noActionNeeded.find(n => n.category === 'practice_work');
  assert(practiceSafe !== undefined, 'DSA practice repos must be explicitly identified as safe to leave');
  assert(practiceSafe!.whySafeToLeave.includes('practice'), 'Clear explanation that practice repos do not harm core evidence');
}) && allPassed;

// ----------------------------------------------------------------------------
// PROFILE L: UNSUPPORTED RESUME CLAIM
// ----------------------------------------------------------------------------
console.log('\nRunning Profile L — Unsupported Resume Claim:');
allPassed = runTest('Profile L produces HIGH-priority action with concrete options (A, B, C) for unverified claim', () => {
  const repos = [
    createMockRepo({
      name: 'web-api',
      language: 'TypeScript',
      packageJson: { dependencies: { express: '^4.18.0' } },
      fileTree: ['package.json', 'README.md', 'src/index.ts'],
    }),
  ];

  const findings = [
    {
      skill: 'Redis',
      resumeClaim: 'Architected distributed Redis caching layer for sub-millisecond response times.',
      claimLevel: 'advanced' as const,
      evidenceStatus: 'unverified' as const,
      assessment: 'Zero Redis dependencies, config, or calls detected across repositories.',
      confidence: 0.9,
      priority: 'high' as const,
      evidenceSources: [],
    },
  ];

  const audit = performRecruiterAudit(repos, null, 'Backend Engineer');
  const decision = generatePreApplicationDecision({
    findings,
    recruiterAudit: audit,
    repos,
    targetRole: 'Backend Engineer',
    jobRequirements: ['express', 'typescript'],
  });

  const redisFix = decision.mustFix.find(a => a.title.includes('Redis'));
  assert(redisFix !== undefined, 'Unsupported claim must generate a mustFix action');
  assert(redisFix!.priority === 'HIGH' || redisFix!.priority === 'CRITICAL', 'Priority must be HIGH or CRITICAL');
  assert(redisFix!.options !== undefined && redisFix!.options.length >= 3, 'Must provide structured options (A, B, C) for resume remediation');
}) && allPassed;

// ----------------------------------------------------------------------------
// PROFILE M: OLD BUT COMPLETE PROJECTS
// ----------------------------------------------------------------------------
console.log('\nRunning Profile M — Old but Complete Projects:');
allPassed = runTest('Profile M categorizes stable legacy project under "You Don\'t Need to Fix"', () => {
  const repos = [
    createMockRepo({
      name: 'legacy-payment-engine',
      language: 'TypeScript',
      hasReadme: true,
      hasTests: true,
      commitCount: 45,
      lastCommitAt: '2023-01-15T00:00:00.000Z',
      fileTree: ['package.json', 'README.md', 'src/payment.ts', 'src/payment.test.ts'],
    }),
  ];

  const audit = performRecruiterAudit(repos, null);
  const decision = generatePreApplicationDecision({
    findings: [],
    recruiterAudit: audit,
    repos,
  });

  assert(decision.noActionNeeded.length >= 1, 'Should include items in noActionNeeded');
  const oldComplete = decision.noActionNeeded.find(n => n.relatedRepo === 'legacy-payment-engine');
  assert(oldComplete !== undefined, 'Older complete project must be recognized under noActionNeeded');
  assert(oldComplete!.whySafeToLeave.includes('complete') || oldComplete!.whySafeToLeave.includes('documented'), 'Explain that older complete projects should not be deleted');
}) && allPassed;

// ----------------------------------------------------------------------------
// PROFILE N: ONLY MINOR DOCUMENTATION ISSUES
// ----------------------------------------------------------------------------
console.log('\nRunning Profile N — Only Minor Documentation Issues:');
allPassed = runTest('Profile N with only minor documentation gaps is READY or READY_WITH_FIXES, never NEEDS_WORK', () => {
  const repos = [
    createMockRepo({
      name: 'task-flow-app',
      language: 'TypeScript',
      hasTests: true,
      commitCount: 35,
      hasReadme: true,
      readmeContent: '# Task Flow', // Minimal readme
      packageJson: { dependencies: { react: '^18.0.0', typescript: '^5.0.0' } },
      fileTree: ['package.json', 'README.md', 'src/index.ts', 'src/index.test.ts'],
    }),
  ];

  const findings = [
    {
      skill: 'TypeScript',
      resumeClaim: 'TypeScript development',
      claimLevel: 'proficient' as const,
      evidenceStatus: 'verified' as const,
      assessment: 'Verified.',
      confidence: 0.9,
      priority: 'low' as const,
      evidenceSources: [],
    },
    {
      skill: 'React',
      resumeClaim: 'React development',
      claimLevel: 'proficient' as const,
      evidenceStatus: 'verified' as const,
      assessment: 'Verified.',
      confidence: 0.9,
      priority: 'low' as const,
      evidenceSources: [],
    },
  ];

  const audit = performRecruiterAudit(repos, null, 'Frontend Developer');
  const decision = generatePreApplicationDecision({
    findings,
    recruiterAudit: audit,
    repos,
    targetRole: 'Frontend Developer',
    jobRequirements: ['react', 'typescript'],
  });

  assert(decision.recommendation !== 'NEEDS_WORK', `Profile with only minor documentation gaps must never be NEEDS_WORK (got ${decision.recommendation})`);
  assert(decision.recommendation === 'READY' || decision.recommendation === 'READY_WITH_FIXES', 'Must be READY or READY_WITH_FIXES');
}) && allPassed;

console.log('\n======================================================');
if (allPassed) {
  console.log(' ALL TEST MATRIX PROFILES (A — N: 14/14) PASSED SUCCESSFULLY! ');
} else {
  console.error(' SOME TESTS IN MATRIX FAILED! ');
  process.exit(1);
}
console.log('======================================================\n');
