import { GitHubRepo } from './githubAnalyzer';
import { ParsedResume } from './resumeParser';

export type RepoClassification =
  | 'STRONG PROJECT'
  | 'SUPPORTING PROJECT'
  | 'PRACTICE / LEARNING'
  | 'ASSIGNMENT / ACADEMIC'
  | 'POTENTIAL TUTORIAL / CLONE'
  | 'TUTORIAL / CLONE'
  | 'UTILITY / TOOL'
  | 'OUTDATED'
  | 'INACTIVE'
  | 'UNFINISHED / NEEDS REVIEW'
  | 'FORK / CONTRIBUTION'
  | 'FORK / DUPLICATE'
  | 'UNKNOWN';

export type PresentationPriority =
  | 'FLAGSHIP'
  | 'SUPPORTING'
  | 'LOW PRIORITY'
  | 'NEEDS REVIEW'
  | 'ARCHIVED';

export type RoleRelevance = 'HIGH' | 'MEDIUM' | 'LOW' | 'GENERAL';

export type MatchConfidence = 'STRONG' | 'LIKELY' | 'POSSIBLE' | 'NO_MATCH';

export interface ClassifiedRepository {
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  commitCount: number;
  lastCommitAt: string | null;
  hasReadme: boolean;
  hasTests: boolean;
  hasDockerfile: boolean;
  hasCi: boolean;
  classification: RepoClassification;
  presentationPriority: PresentationPriority;
  roleRelevance: RoleRelevance;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceScore: number;
  signals: string[];
  recruiterNotes: string;
  matchedResumeProject?: string;
  matchConfidence?: MatchConfidence;
  matchReasons?: string[];
  isFork?: boolean;
  parentRepo?: string | null;
  isArchived?: boolean;
}

export interface RecruiterConcern {
  id: string;
  canonicalId: string;
  category: 'mismatch' | 'unverified_claim' | 'unfinished_project' | 'profile_noise' | 'missing_project' | 'hygiene' | 'target_role_gap';
  severity: 'high' | 'medium' | 'low';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  observation: string;
  signal: string;
  reasoning: string;
  evidence: string;
  recommendation: string;
  risk: string; // Retained for backward-compatibility with UI/PDF
}

export interface RecruiterStrength {
  title: string;
  detail: string;
  evidence: string;
  confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface PreparedQuestion {
  question: string;
  context: string;
  reason: string;
  suggestedFocus: string;
  category?: 'architecture' | 'unverified_claim' | 'tradeoff' | 'role_alignment' | 'testing';
}

export interface ResumeGitHubConsistency {
  resumeProjectsFound: Array<{
    resumeProject: string;
    repoName: string;
    matchStrength: 'STRONG' | 'LIKELY' | 'POSSIBLE' | 'MODERATE';
    matchConfidence: 'HIGH' | 'MEDIUM' | 'LOW';
    evidenceSummary: string;
    matchReasons: string[];
  }>;
  resumeProjectsMissing: Array<{
    resumeProject: string;
    note: string;
    possibleReasons: string[];
  }>;
  githubProjectsNotOnResume: Array<{
    repoName: string;
    classification: RepoClassification;
    assessment: 'POTENTIALLY VALUABLE' | 'LOW SIGNAL' | 'SUPPORTING';
    note: string;
  }>;
}

export interface GitHubProfileReadiness {
  score: number; // 0-100
  dimensions: {
    projectQuality: number; // Core project evidence
    documentation: number;
    activityRecency: number;
    resumeConsistency: number;
    profileHygiene: number; // Presentation and noise handling
  };
  breakdown: string[];
  positiveFactors: string[];
  deductionFactors: string[];
}

export interface RecruiterProfileAudit {
  repositories: ClassifiedRepository[];
  summary: {
    totalPublicRepos: number;
    strongProjectsCount: number;
    supportingCount: number;
    practiceCount: number;
    outdatedCount: number;
    needsReviewCount: number;
  };
  consistency: ResumeGitHubConsistency;
  concerns: RecruiterConcern[];
  strengths: RecruiterStrength[];
  preparedQuestions: PreparedQuestion[];
  readiness: GitHubProfileReadiness;
}

// ============================================================================
// DETECTION PATTERNS & HEURISTICS
// ============================================================================

const PRACTICE_PATTERNS = [
  /\b(dsa|leetcode|hackerrank|codeforces|competitive-programming|algorithms|algorithm|data-structures|interview-prep|problems|solutions|coding-challenges|neetcode|gfg|geeksforgeeks)\b/i,
];

const ACADEMIC_PATTERNS = [
  /\b(assignment|homework|coursework|cs\d{3}|ece\d{3}|cse\d{3}|lab\d+|semester|university|college-project|academic|final-year-project)\b/i,
];

const TUTORIAL_PATTERNS = [
  /\b(tutorial|freecodecamp|udemy|coursera|codecademy|workshop|100daysof|scrimba|traversy|codewithharry)\b/i,
];

const COMMON_GENERIC_PROJECTS = [
  'todo', 'todoapp', 'todo-app', 'calculator', 'weather-app', 'weatherapp',
  'tictactoe', 'tic-tac-toe', 'movie-search', 'quiz-app', 'clock', 'counter',
];

const NON_MEANINGFUL_FILE_REGEX = /\.(lock|log|png|jpg|jpeg|gif|svg|ico|map|md|txt|gitignore|gitattributes|eslint.*|prettier.*|editorconfig)$/i;

// Target Role Technology Maps
const ROLE_TECH_MAP: Record<string, string[]> = {
  frontend: ['react', 'next.js', 'vue', 'angular', 'svelte', 'typescript', 'javascript', 'tailwind', 'css', 'html', 'redux', 'vite', 'ui', 'frontend'],
  backend: ['node.js', 'express', 'nestjs', 'python', 'django', 'fastapi', 'go', 'golang', 'java', 'spring', 'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'docker', 'rest', 'graphql', 'sql', 'api', 'backend', 'microservices'],
  fullstack: ['react', 'next.js', 'vue', 'node.js', 'express', 'typescript', 'mongodb', 'postgresql', 'docker', 'api', 'tailwind'],
  mobile: ['react native', 'flutter', 'swift', 'kotlin', 'ios', 'android', 'dart', 'mobile'],
  ml: ['python', 'pytorch', 'tensorflow', 'pandas', 'numpy', 'scikit-learn', 'jupyter', 'machine learning', 'deep learning', 'nlp', 'cv', 'ai'],
  devops: ['docker', 'kubernetes', 'terraform', 'ci/cd', 'github actions', 'jenkins', 'aws', 'gcp', 'linux', 'bash', 'ansible'],
};

// ============================================================================
// HELPER FUNCTIONS: SCOPE, ENGINEERING, DOCUMENTATION
// ============================================================================

function cleanTokens(str: string): string[] {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

function analyzeRepoScope(repo: GitHubRepo) {
  const fileTree = repo.fileTree || [];
  const meaningfulFiles = fileTree.filter(f => !NON_MEANINGFUL_FILE_REGEX.test(f) && !f.startsWith('.'));
  const meaningfulCount = meaningfulFiles.length;

  const hasFrontendLayer = fileTree.some(f =>
    /(src|app|client|frontend)\/(components|pages|views|hooks|styles)/i.test(f)
  );
  const hasBackendLayer = fileTree.some(f =>
    /(src|app|server|backend|api)\/(routes|controllers|services|models|handlers|middleware|endpoints)/i.test(f)
  );
  const hasMonorepo = fileTree.some(f => /(apps|packages)\//i.test(f));

  return {
    fileCount: fileTree.length,
    meaningfulCount,
    hasFrontendLayer,
    hasBackendLayer,
    hasMonorepo,
    hasMultiLayer: (hasFrontendLayer && hasBackendLayer) || hasMonorepo,
  };
}

function analyzeRepoEngineering(repo: GitHubRepo) {
  const fileTree = repo.fileTree || [];
  const pkg = repo.packageJson;
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  const depKeys = Object.keys(deps).map(d => d.toLowerCase());
  const reqText = (repo.requirementsTxt || '').toLowerCase();

  const hasManifest = !!pkg || !!repo.requirementsTxt || fileTree.some(f =>
    /^(Cargo\.toml|go\.mod|pom\.xml|build\.gradle|composer\.json|Gemfile)$/i.test(f)
  );

  const hasTests = repo.hasTests || fileTree.some(f =>
    /\b(test|spec|__tests__)\b/i.test(f) || /\.(test|spec)\.[a-z]+$/i.test(f)
  ) || depKeys.some(d => ['jest', 'vitest', 'mocha', 'cypress', 'pytest', 'playwright'].includes(d));

  const hasCi = repo.hasCi || fileTree.some(f =>
    f.includes('.github/workflows') || f.includes('.gitlab-ci') || f.includes('Jenkinsfile') || f.includes('.circleci')
  );

  const hasDockerfile = repo.hasDockerfile || fileTree.some(f =>
    /dockerfile/i.test(f) || /docker-compose/i.test(f)
  );

  const hasDb = fileTree.some(f =>
    /(prisma|migrations|drizzle|models|schemas|db)\//i.test(f)
  ) || depKeys.some(d => ['prisma', 'drizzle-orm', 'mongoose', 'typeorm', 'pg', 'mysql2', 'sequelize'].includes(d))
    || reqText.includes('psycopg2') || reqText.includes('sqlalchemy') || reqText.includes('pymongo');

  const hasAuth = depKeys.some(d => ['jsonwebtoken', 'passport', 'bcrypt', 'next-auth', 'auth0', 'firebase-admin'].includes(d))
    || fileTree.some(f => /(auth|passport|jwt)/i.test(f));

  const hasConfig = fileTree.some(f =>
    /\b(tsconfig\.json|vite\.config|next\.config|webpack|tailwind\.config|\.env\.example)\b/i.test(f)
  );

  return {
    hasManifest,
    hasTests,
    hasCi,
    hasDockerfile,
    hasDb,
    hasAuth,
    hasConfig,
  };
}

function analyzeRepoDocumentation(repo: GitHubRepo) {
  const readme = repo.readmeContent || '';
  const length = readme.trim().length;

  if (!repo.hasReadme || length === 0) {
    return { quality: 'NONE' as const, length: 0, sections: [] };
  }

  const sections: string[] = [];
  const lower = readme.toLowerCase();

  if (/setup|install|getting started|how to run/i.test(lower)) sections.push('Setup / Installation');
  if (/architecture|overview|design|folder structure/i.test(lower)) sections.push('Architecture / Overview');
  if (/features|capabilities/i.test(lower)) sections.push('Features');
  if (/demo|screenshots|preview|live/i.test(lower)) sections.push('Demo / Live Links');
  if (/tech stack|technologies|built with/i.test(lower)) sections.push('Tech Stack');

  let quality: 'COMPREHENSIVE' | 'ADEQUATE' | 'MINIMAL';
  if (length >= 500 && sections.length >= 2) {
    quality = 'COMPREHENSIVE';
  } else if (length >= 150) {
    quality = 'ADEQUATE';
  } else {
    quality = 'MINIMAL';
  }

  return { quality, length, sections };
}

// ============================================================================
// RESUME <-> GITHUB MATCHING (MULTI-SIGNAL CONSERVATIVE)
// ============================================================================

export function matchProjectToRepo(
  project: { name: string; technologies: string[]; description: string },
  repo: GitHubRepo
): {
  strength: MatchConfidence;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  const pName = project.name.trim();
  const rName = repo.name.trim();

  const cleanP = pName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanR = rName.toLowerCase().replace(/[^a-z0-9]/g, '');

  const pTokens = cleanTokens(pName);
  const rTokens = cleanTokens(rName);

  // 1. Name Similarity
  let nameScore = 0;
  if (cleanP === cleanR && cleanP.length > 0) {
    nameScore = 1.0;
    reasons.push(`Direct name match: "${pName}" ↔ "${repo.name}"`);
  } else if (cleanP.length >= 4 && cleanR.length >= 4 && (cleanR.includes(cleanP) || cleanP.includes(cleanR))) {
    nameScore = 0.85;
    reasons.push(`Strong name containment: "${pName}" matches repository name`);
  } else if (pTokens.length > 0 && rTokens.length > 0) {
    const matchingTokens = pTokens.filter(t => rTokens.includes(t));
    if (matchingTokens.length > 0) {
      // Check for generic single token matches like "app", "web", "portfolio"
      const isGeneric = matchingTokens.length === 1 && ['app', 'web', 'project', 'portal', 'website'].includes(matchingTokens[0]);
      if (!isGeneric) {
        nameScore = matchingTokens.length / Math.max(pTokens.length, 1);
        if (nameScore >= 0.5) {
          reasons.push(`Key name token match: [${matchingTokens.join(', ')}]`);
        }
      }
    }
  }

  // 2. Technology Overlap
  const repoTechs = new Set<string>();
  if (repo.language) repoTechs.add(repo.language.toLowerCase());
  Object.keys(repo.languages || {}).forEach(l => repoTechs.add(l.toLowerCase()));
  const pkgDeps = { ...(repo.packageJson?.dependencies || {}), ...(repo.packageJson?.devDependencies || {}) };
  Object.keys(pkgDeps).forEach(d => repoTechs.add(d.toLowerCase()));
  if (repo.requirementsTxt) {
    repo.requirementsTxt.toLowerCase().split('\n').forEach(line => {
      const pkg = line.split(/[==<>;]/)[0].trim();
      if (pkg) repoTechs.add(pkg);
    });
  }

  const pTechs = (project.technologies || []).map(t => t.toLowerCase().trim()).filter(Boolean);
  let techMatches = 0;
  const matchedTechNames: string[] = [];

  for (const t of pTechs) {
    const isMatched = Array.from(repoTechs).some(rt => rt.includes(t) || t.includes(rt));
    if (isMatched) {
      techMatches++;
      matchedTechNames.push(t);
    }
  }

  const techScore = pTechs.length > 0 ? techMatches / pTechs.length : 0;
  if (matchedTechNames.length > 0) {
    reasons.push(`Corroborated technology stack: ${matchedTechNames.slice(0, 4).join(', ')}`);
  }

  // 3. Semantic / Description Overlap
  const descTokens = cleanTokens(project.description || '');
  const repoReadme = (repo.readmeContent || '').toLowerCase();
  const repoDesc = (repo.description || '').toLowerCase();
  let semanticMatches = 0;
  const matchedKeywords: string[] = [];

  const significantTokens = descTokens.filter(t => t.length > 3 && !['with', 'from', 'that', 'this', 'have', 'using', 'built', 'project', 'application', 'system'].includes(t));
  for (const t of significantTokens) {
    if (repoDesc.includes(t) || repoReadme.includes(t)) {
      semanticMatches++;
      if (matchedKeywords.length < 3) matchedKeywords.push(t);
    }
  }

  const semanticScore = significantTokens.length > 0 ? semanticMatches / significantTokens.length : 0;
  if (matchedKeywords.length > 0) {
    reasons.push(`Semantic description match: [${matchedKeywords.join(', ')}]`);
  }

  // 4. Combined Confidence Assessment
  let strength: MatchConfidence = 'NO_MATCH';
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  const totalScore = (nameScore * 0.50) + (techScore * 0.30) + (semanticScore * 0.20);

  if (nameScore >= 0.85 && (techScore >= 0.3 || semanticScore >= 0.2)) {
    strength = 'STRONG';
    confidence = 'HIGH';
  } else if (nameScore >= 0.7 && (techScore >= 0.2 || semanticScore >= 0.2)) {
    strength = 'LIKELY';
    confidence = 'HIGH';
  } else if (nameScore >= 0.5 || (techScore >= 0.6 && semanticScore >= 0.3)) {
    strength = 'POSSIBLE';
    confidence = 'MEDIUM';
  } else {
    strength = 'NO_MATCH';
    confidence = 'LOW';
  }

  return {
    strength,
    confidence,
    score: totalScore,
    reasons,
  };
}

// ============================================================================
// REPOSITORY CLASSIFICATION: MULTI-SIGNAL MODEL
// ============================================================================

export function classifyRepository(
  repo: GitHubRepo,
  resumeProjects: Array<{ name: string; technologies: string[]; description: string }> = [],
  targetRole?: string
): ClassifiedRepository {
  const signals: string[] = [];
  const nameLower = repo.name.toLowerCase();
  const descLower = (repo.description || '').toLowerCase();
  const readmeLower = (repo.readmeContent || '').toLowerCase();

  const scope = analyzeRepoScope(repo);
  const eng = analyzeRepoEngineering(repo);
  const doc = analyzeRepoDocumentation(repo);

  const daysSinceLastCommit = repo.lastCommitAt
    ? Math.floor((Date.now() - new Date(repo.lastCommitAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999;
  const commitCount = repo.commitCount || 0;

  // 1. Resume Match Check
  let bestMatch: { project: string; strength: MatchConfidence; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; reasons: string[] } | null = null;
  for (const p of resumeProjects) {
    const match = matchProjectToRepo(p, repo);
    if (match.strength !== 'NO_MATCH') {
      if (!bestMatch || match.strength === 'STRONG' || (match.strength === 'LIKELY' && bestMatch.strength === 'POSSIBLE')) {
        bestMatch = {
          project: p.name,
          strength: match.strength,
          confidence: match.confidence,
          reasons: match.reasons,
        };
      }
    }
  }

  if (bestMatch) {
    signals.push(`Matches resume project "${bestMatch.project}" (${bestMatch.strength} match)`);
  }

  // 2. Fork Analysis
  const isFork = !!repo.isFork;
  let forkSignal = '';
  if (isFork) {
    if (commitCount > 10 && (eng.hasTests || scope.meaningfulCount > 8)) {
      forkSignal = 'Active customized fork with own commit history and tests';
    } else {
      forkSignal = 'Forked repository — candidate contribution depth could not be determined independently';
    }
    signals.push(forkSignal);
  }

  // 3. Practice / DSA / Learning
  const isPractice = PRACTICE_PATTERNS.some(p => p.test(nameLower) || p.test(descLower) || (p.test(readmeLower) && !scope.hasMultiLayer));

  // 4. Academic / Coursework
  const isAcademic = ACADEMIC_PATTERNS.some(p => p.test(nameLower) || p.test(descLower));

  // 5. Tutorial / Clone Detection (Multi-Signal)
  const hasTutorialKeyword = TUTORIAL_PATTERNS.some(p => p.test(nameLower) || p.test(descLower) || p.test(readmeLower));
  const hasGenericProjectName = COMMON_GENERIC_PROJECTS.some(p => nameLower === p || nameLower.startsWith(`${p}-`));
  const hasTutorialAttribution =
    readmeLower.includes('clone of') ||
    readmeLower.includes('built following') ||
    readmeLower.includes('tutorial by') ||
    readmeLower.includes('coded along with') ||
    readmeLower.includes('udemy course') ||
    readmeLower.includes('freecodecamp');

  const isTutorial = hasTutorialAttribution || (hasTutorialKeyword && !eng.hasTests && !scope.hasMultiLayer);
  const isPotentialClone = hasGenericProjectName && doc.quality !== 'COMPREHENSIVE' && !eng.hasTests && !eng.hasCi;

  // 6. Completeness & Lifecycle
  const isOld = daysSinceLastCommit > 730; // > 2 years
  const isInactive = daysSinceLastCommit > 365 && daysSinceLastCommit <= 730;

  // A repo is only "UNFINISHED" if converging signals demonstrate incompleteness:
  // Sparse code (<5 meaningful files) + NO README + very low activity (<4 commits) + no tests
  const isSparse = scope.meaningfulCount < 5 && commitCount < 5;
  const isExplicitlyUnfinished = !repo.hasReadme && isSparse && !eng.hasTests && !eng.hasManifest;

  // "OLD BUT COMPLETE" distinction:
  const isOldButComplete = isOld && (doc.quality === 'COMPREHENSIVE' || doc.quality === 'ADEQUATE') && (eng.hasTests || eng.hasManifest || commitCount >= 10);

  // 7. Substantial / Strong Project Signal
  // Scope + Engineering + Documentation
  const engineeringRigorCount =
    (eng.hasTests ? 1 : 0) +
    (eng.hasCi ? 1 : 0) +
    (eng.hasDockerfile ? 1 : 0) +
    (eng.hasDb ? 1 : 0) +
    (eng.hasAuth ? 1 : 0) +
    (scope.hasMultiLayer ? 1 : 0) +
    (eng.hasConfig ? 1 : 0);

  const isSubstantial =
    !isFork &&
    !isPractice &&
    !isAcademic &&
    !isTutorial &&
    scope.meaningfulCount >= 5 &&
    commitCount >= 8 &&
    doc.quality !== 'NONE' &&
    (engineeringRigorCount >= 2 || (scope.hasMultiLayer && commitCount >= 10));

  // Small focused utility:
  const isSmallUtility =
    !isSubstantial &&
    scope.meaningfulCount >= 3 &&
    scope.meaningfulCount <= 8 &&
    (eng.hasTests || eng.hasConfig) &&
    doc.quality !== 'NONE' &&
    commitCount >= 4 &&
    !scope.hasFrontendLayer &&
    !scope.hasMultiLayer;

  // 8. Determine Classification & Presentation Priority
  let classification: RepoClassification = 'SUPPORTING PROJECT';
  let presentationPriority: PresentationPriority = 'SUPPORTING';
  let confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  let confidenceScore = 0.75;

  if (isFork && commitCount <= 5) {
    classification = 'FORK / CONTRIBUTION';
    presentationPriority = 'LOW PRIORITY';
    confidenceLevel = 'HIGH';
    confidenceScore = 0.85;
  } else if (isPractice) {
    classification = 'PRACTICE / LEARNING';
    presentationPriority = 'LOW PRIORITY';
    signals.push('Algorithmic problem-solving / coding practice structure');
    confidenceLevel = 'HIGH';
    confidenceScore = 0.90;
  } else if (isTutorial || isPotentialClone) {
    classification = 'POTENTIAL TUTORIAL / CLONE';
    presentationPriority = 'LOW PRIORITY';
    signals.push(isTutorial ? 'Attribution or keywords match tutorial/course walkthrough' : 'Matches common tutorial naming and boilerplate structure');
    confidenceLevel = hasTutorialAttribution ? 'HIGH' : 'MEDIUM';
    confidenceScore = hasTutorialAttribution ? 0.88 : 0.70;
  } else if (isAcademic) {
    classification = 'ASSIGNMENT / ACADEMIC';
    presentationPriority = 'LOW PRIORITY';
    signals.push('Academic coursework or lab assignment naming markers');
    confidenceLevel = 'HIGH';
    confidenceScore = 0.85;
  } else if (isExplicitlyUnfinished) {
    classification = 'UNFINISHED / NEEDS REVIEW';
    presentationPriority = 'NEEDS REVIEW';
    signals.push(`Very low commit density (${commitCount} commits) with no documentation or manifest`);
    confidenceLevel = 'HIGH';
    confidenceScore = 0.85;
  } else if (isOldButComplete) {
    classification = isSubstantial ? 'STRONG PROJECT' : 'SUPPORTING PROJECT';
    presentationPriority = 'ARCHIVED';
    signals.push(`Completed legacy project (last updated ${Math.round(daysSinceLastCommit / 365)} years ago); stable documentation preserved`);
    confidenceLevel = 'HIGH';
    confidenceScore = 0.85;
  } else if (isSubstantial || (bestMatch && bestMatch.strength === 'STRONG' && commitCount >= 10 && doc.quality !== 'NONE')) {
    classification = 'STRONG PROJECT';
    presentationPriority = 'FLAGSHIP';
    signals.push(`Substantial architecture: ${scope.meaningfulCount} source files across ${commitCount} commits`);
    if (doc.quality === 'COMPREHENSIVE') signals.push(`Detailed documentation covering: ${doc.sections.join(', ')}`);
    if (eng.hasTests) signals.push('Automated test suite configured');
    if (eng.hasCi) signals.push('CI/CD automation pipeline present');
    if (eng.hasDockerfile) signals.push('Docker / containerization present');
    if (eng.hasDb) signals.push('Database layer / ORM configured');
    if (scope.hasMultiLayer) signals.push('Frontend & backend layered architecture');
    confidenceLevel = 'HIGH';
    confidenceScore = 0.92;
  } else if (isSmallUtility) {
    classification = 'UTILITY / TOOL';
    presentationPriority = 'SUPPORTING';
    signals.push(`Focused utility implementation: ${scope.meaningfulCount} files, tested and documented`);
    confidenceLevel = 'HIGH';
    confidenceScore = 0.80;
  } else if (isOldButComplete) {
    classification = 'SUPPORTING PROJECT';
    presentationPriority = 'ARCHIVED';
    signals.push(`Completed legacy project (last updated ${Math.round(daysSinceLastCommit / 365)} years ago); stable documentation preserved`);
    confidenceLevel = 'HIGH';
    confidenceScore = 0.85;
  } else if (isOld && commitCount < 6) {
    classification = 'OUTDATED';
    presentationPriority = 'NEEDS REVIEW';
    signals.push(`Last updated over 2 years ago with minimal historical commits (${commitCount} commits)`);
    confidenceLevel = 'MEDIUM';
    confidenceScore = 0.75;
  } else if (isInactive) {
    classification = 'SUPPORTING PROJECT';
    presentationPriority = 'ARCHIVED';
    signals.push(`No commit activity within past year (${Math.round(daysSinceLastCommit / 30)} months)`);
    confidenceLevel = 'MEDIUM';
    confidenceScore = 0.75;
  } else {
    classification = 'SUPPORTING PROJECT';
    presentationPriority = 'SUPPORTING';
    signals.push('Functional supporting repository demonstrating practical implementation');
    confidenceLevel = 'MEDIUM';
    confidenceScore = 0.72;
  }

  // 9. Target Role Relevance
  let roleRelevance: RoleRelevance = 'GENERAL';
  if (targetRole) {
    const roleKey = Object.keys(ROLE_TECH_MAP).find(k => targetRole.toLowerCase().includes(k));
    if (roleKey) {
      const targetTechs = ROLE_TECH_MAP[roleKey];
      const repoTechs = [
        (repo.language || '').toLowerCase(),
        ...Object.keys(repo.languages || {}).map(l => l.toLowerCase()),
        ...Object.keys(repo.packageJson?.dependencies || {}).map(d => d.toLowerCase()),
      ];
      const matches = targetTechs.filter(t => repoTechs.some(rt => {
        if (t === 'java' && rt.includes('javascript')) return false;
        if (t === 'c' && (rt === 'css' || rt.includes('cpp') || rt.includes('c#'))) return false;
        if (t === 'go' && (rt.includes('django') || rt.includes('algo') || rt.includes('category'))) return false;
        if (t === 'r' && rt.length > 1) return false;
        const tTokens = t.split(/[^a-z0-9]/).filter(Boolean);
        const rTokens = rt.split(/[^a-z0-9]/).filter(Boolean);
        return t === rt || tTokens.some(tok => rTokens.includes(tok));
      }));
      if (matches.length >= 2) {
        roleRelevance = 'HIGH';
        signals.push(`High relevance to target role (${targetRole}): utilizes ${matches.slice(0, 3).join(', ')}`);
      } else if (matches.length === 1) {
        roleRelevance = 'MEDIUM';
      } else {
        roleRelevance = 'LOW';
      }
    }
  }

  // 10. Recruiter Notes (Defensible & Calm)
  let recruiterNotes = '';
  switch (classification) {
    case 'STRONG PROJECT':
      recruiterNotes = 'Shows genuine architectural depth, active iteration, and clear engineering initiative.';
      break;
    case 'SUPPORTING PROJECT':
      recruiterNotes = presentationPriority === 'ARCHIVED'
        ? 'Demonstrates stable, completed historical work; good supporting evidence when accompanied by recent activity.'
        : 'Provides secondary proof of technical familiarity without being a primary flagship showcase.';
      break;
    case 'PRACTICE / LEARNING':
      recruiterNotes = 'Demonstrates personal curiosity and problem-solving practice; keep visible alongside portfolio projects.';
      break;
    case 'ASSIGNMENT / ACADEMIC':
      recruiterNotes = 'Appears tied to curriculum; consider grouping or pinning higher-signal personal projects first.';
      break;
    case 'POTENTIAL TUTORIAL / CLONE':
      recruiterNotes = 'Signals commonly associated with tutorial walkthroughs; adding custom architectural features or deployment links improves recruiter signal.';
      break;
    case 'UTILITY / TOOL':
      recruiterNotes = 'Focused, well-scoped implementation demonstrating clean modular code and specific problem-solving.';
      break;
    case 'FORK / CONTRIBUTION':
      recruiterNotes = commitCount > 5
        ? 'Active contribution to an external or upstream repository.'
        : 'Forked repository — candidate contribution depth could not be determined independently from public commit history.';
      break;
    case 'OUTDATED':
      recruiterNotes = 'Legacy code that has not seen updates in multiple years; verify if current standards are better reflected elsewhere.';
      break;
    case 'UNFINISHED / NEEDS REVIEW':
      recruiterNotes = 'Very low commit density and sparse structure can create an impression of unfinished side projects.';
      break;
    default:
      recruiterNotes = 'General public project.';
  }

  return {
    name: repo.name,
    fullName: repo.fullName,
    description: repo.description,
    language: repo.language,
    stars: repo.stars || 0,
    forks: repo.forks || 0,
    commitCount,
    lastCommitAt: repo.lastCommitAt,
    hasReadme: repo.hasReadme,
    hasTests: eng.hasTests,
    hasDockerfile: eng.hasDockerfile,
    hasCi: eng.hasCi,
    classification,
    presentationPriority,
    roleRelevance,
    confidence: confidenceLevel,
    confidenceScore,
    signals,
    recruiterNotes,
    matchedResumeProject: bestMatch?.project,
    matchConfidence: bestMatch?.strength,
    matchReasons: bestMatch?.reasons,
    isFork,
    parentRepo: repo.parentRepo || null,
  };
}

// ============================================================================
// MAIN RECRUITER AUDIT ENGINE
// ============================================================================

export function performRecruiterAudit(
  repos: GitHubRepo[],
  parsedResume?: ParsedResume | null,
  targetRole?: string
): RecruiterProfileAudit {
  const resumeProjects = parsedResume?.projects || [];

  // 1. Classify all repositories
  const classifiedRepos = repos.map(r => classifyRepository(r, resumeProjects, targetRole));

  // Count summaries
  let strongCount = 0;
  let supportingCount = 0;
  let practiceCount = 0;
  let outdatedCount = 0;
  let needsReviewCount = 0;

  classifiedRepos.forEach(r => {
    if (r.classification === 'STRONG PROJECT') strongCount++;
    else if (r.classification === 'SUPPORTING PROJECT' || r.classification === 'UTILITY / TOOL') supportingCount++;
    else if (r.classification === 'PRACTICE / LEARNING' || r.classification === 'ASSIGNMENT / ACADEMIC') practiceCount++;
    else if (r.classification === 'OUTDATED') outdatedCount++;
    else if (r.classification === 'UNFINISHED / NEEDS REVIEW') needsReviewCount++;
  });

  // 2. Resume <-> GitHub Consistency Matrix
  const resumeProjectsFound: ResumeGitHubConsistency['resumeProjectsFound'] = [];
  const resumeProjectsMissing: ResumeGitHubConsistency['resumeProjectsMissing'] = [];

  for (const p of resumeProjects) {
    const matched = classifiedRepos.find(r => r.matchedResumeProject === p.name);
    if (matched) {
      resumeProjectsFound.push({
        resumeProject: p.name,
        repoName: matched.name,
        matchStrength: (matched.matchConfidence === 'STRONG' || matched.matchConfidence === 'LIKELY' || matched.matchConfidence === 'POSSIBLE')
          ? matched.matchConfidence
          : 'MODERATE',
        matchConfidence: matched.confidence,
        evidenceSummary: `${matched.signals.slice(0, 3).join('; ')} (${matched.commitCount} commits)`,
        matchReasons: matched.matchReasons || [],
      });
    } else {
      resumeProjectsMissing.push({
        resumeProject: p.name,
        note: 'No sufficiently strong public repository match was found.',
        possibleReasons: [
          'Project is hosted in a private or organization repository',
          'Repository exists under a different project name on GitHub',
          'Code was developed for an employer or internal university system',
          'Project has not been published publicly',
        ],
      });
    }
  }

  const githubProjectsNotOnResume: ResumeGitHubConsistency['githubProjectsNotOnResume'] = [];
  classifiedRepos.forEach(r => {
    if (!r.matchedResumeProject) {
      const isValuable = r.classification === 'STRONG PROJECT';
      githubProjectsNotOnResume.push({
        repoName: r.name,
        classification: r.classification,
        assessment: isValuable ? 'POTENTIALLY VALUABLE' : (r.classification === 'SUPPORTING PROJECT' ? 'SUPPORTING' : 'LOW SIGNAL'),
        note: isValuable
          ? 'Substantial implementation with commits and documentation; consider adding to resume if space permits.'
          : 'Supporting or practice repository providing secondary evidence of activity.',
      });
    }
  });

  // 3. Potential Recruiter Concerns (Canonical, Evidence-Backed, Traceable)
  const concerns: RecruiterConcern[] = [];

  // Concern: Unmatched resume projects
  if (resumeProjectsMissing.length > 0) {
    const missingNames = resumeProjectsMissing.map(m => `"${m.resumeProject}"`).join(', ');
    concerns.push({
      id: 'missing-resume-project',
      canonicalId: 'canonical-missing-resume-project',
      category: 'mismatch',
      severity: resumeProjectsMissing.length >= 2 ? 'medium' : 'low',
      confidence: 'HIGH',
      title: `${resumeProjectsMissing.length} resume project(s) lack public repository evidence`,
      observation: `Resume highlights: ${missingNames}, but no sufficiently strong matching public repository was detected.`,
      signal: 'Code verification gap for key resume project claims.',
      reasoning: 'A recruiter reviewing your GitHub cannot independently verify your implementation depth or role in these projects.',
      evidence: `0 public repositories matched project name or tech stack for: ${missingNames}.`,
      recommendation: 'Ensure repositories are public where permitted, or add a live demo, video walkthrough, or portfolio link to your resume.',
      risk: 'A recruiter reviewing your GitHub cannot independently verify your implementation depth or role in these projects.',
    });
  }

  // Concern: Unfinished or sparse repositories
  const unfinishedRepos = classifiedRepos.filter(r => r.classification === 'UNFINISHED / NEEDS REVIEW');
  if (unfinishedRepos.length >= 2) {
    concerns.push({
      id: 'unfinished-repos',
      canonicalId: 'canonical-unfinished-repos',
      category: 'unfinished_project',
      severity: 'high',
      confidence: 'HIGH',
      title: `${unfinishedRepos.length} public repositories appear incomplete or need review`,
      observation: `Found repositories with very low commit activity, missing READMEs, and sparse files (${unfinishedRepos.map(r => r.name).join(', ')}).`,
      signal: 'Public repositories with placeholder structure and minimal commit density.',
      reasoning: 'Recruiters spend 30-60 seconds scanning a profile; prominent sparse projects can distract from your best engineering work.',
      evidence: unfinishedRepos.map(r => `${r.name}: ${r.commitCount} commits, no README`).join('; '),
      recommendation: 'Archive inactive repositories, complete their README files, or convert placeholder side-projects to private repositories.',
      risk: 'Having abandoned or sparse projects publicly prominent can distract recruiters from your best work.',
    });
  }

  // Concern: Truly Outdated repositories (without documentation)
  const trueOutdated = classifiedRepos.filter(r => r.classification === 'OUTDATED');
  if (trueOutdated.length >= 2) {
    concerns.push({
      id: 'outdated-repos',
      canonicalId: 'canonical-outdated-repos',
      category: 'hygiene',
      severity: 'low',
      confidence: 'MEDIUM',
      title: `${trueOutdated.length} repositories are legacy with sparse history`,
      observation: `Repositories like ${trueOutdated.slice(0, 2).map(r => r.name).join(', ')} have not seen updates in over 2 years and have low commit density.`,
      signal: 'Older legacy repositories without recent maintenance.',
      reasoning: 'May reflect older package versions or abandoned prototypes if clicked by a recruiter.',
      evidence: trueOutdated.slice(0, 2).map(r => `${r.name} (last active ${r.lastCommitAt ? new Date(r.lastCommitAt).getFullYear() : 'years ago'})`).join(', '),
      recommendation: 'Pin your most modern projects to the top of your profile so recruiters see your current coding standards first.',
      risk: 'May reflect older syntax versions or outdated dependency practices if examined.',
    });
  }

  // Concern: Valuable project missing from resume
  const valuableUnlisted = githubProjectsNotOnResume.filter(p => p.assessment === 'POTENTIALLY VALUABLE');
  if (valuableUnlisted.length > 0) {
    concerns.push({
      id: 'valuable-unlisted',
      canonicalId: 'canonical-valuable-unlisted',
      category: 'missing_project',
      severity: 'low',
      confidence: 'HIGH',
      title: `Substantial project "${valuableUnlisted[0].repoName}" is not highlighted on your resume`,
      observation: `Repository "${valuableUnlisted[0].repoName}" demonstrates strong architecture and documentation but is missing from your resume projects.`,
      signal: 'High-signal engineering work under-represented on the primary resume document.',
      reasoning: 'You may be under-representing your technical capabilities on your primary resume document.',
      evidence: `Repository "${valuableUnlisted[0].repoName}" classified as STRONG PROJECT.`,
      recommendation: `Evaluate whether "${valuableUnlisted[0].repoName}" is more technically impressive than your weakest listed resume project.`,
      risk: 'You may be under-representing your technical capabilities on your primary resume document.',
    });
  }

  // Concern: Profile noise (only if severe ratio of tutorial/boilerplate to real projects)
  const tutorialOrBoilerplateCount = classifiedRepos.filter(r => r.classification === 'POTENTIAL TUTORIAL / CLONE' || r.classification === 'TUTORIAL / CLONE').length;
  if (tutorialOrBoilerplateCount >= 4 && strongCount <= 1) {
    concerns.push({
      id: 'profile-noise',
      canonicalId: 'canonical-profile-noise',
      category: 'profile_noise',
      severity: 'medium',
      confidence: 'MEDIUM',
      title: 'Tutorial and boilerplate repositories are prominent on your profile',
      observation: `Profile features ${tutorialOrBoilerplateCount} tutorial or clone projects relative to ${strongCount} substantial project(s).`,
      signal: 'Standard tutorial projects outnumber original engineering applications.',
      reasoning: 'Technical interviewers prioritize custom architectures and independent problem-solving over standard tutorial walkthroughs.',
      evidence: `${tutorialOrBoilerplateCount} repositories classified as tutorial/clone.`,
      recommendation: 'Pin your top custom applications and add custom features or architectural extensions to tutorial code.',
      risk: 'Recruiters spend 30-60 seconds scanning a profile and might click tutorial code instead of your best engineering work.',
    });
  }

  // Concern: Target Role Mismatch (if targetRole is specified and primary repos don't align)
  if (targetRole) {
    const highRelevanceCount = classifiedRepos.filter(r => r.roleRelevance === 'HIGH').length;
    if (highRelevanceCount === 0 && strongCount > 0) {
      concerns.push({
        id: 'target-role-mismatch',
        canonicalId: 'canonical-target-role-mismatch',
        category: 'target_role_gap',
        severity: 'medium',
        confidence: 'HIGH',
        title: `Public repositories show limited alignment with target role (${targetRole})`,
        observation: `You are targeting "${targetRole}", but your public repositories focus primarily on different technology domains.`,
        signal: 'Domain divergence between target role expectations and public portfolio code.',
        reasoning: 'A hiring manager for a specific role looks for direct demonstration of role-critical libraries and system patterns.',
        evidence: `0 of ${classifiedRepos.length} public repositories heavily utilize core ${targetRole} technologies.`,
        recommendation: `Build or highlight a flagship project directly implementing the primary technologies expected for ${targetRole}.`,
        risk: 'Recruiters seeking specialized skills may view your background as adjacent rather than directly aligned.',
      });
    }
  }

  // 4. Recruiter Strengths (Evidence-Backed)
  const strengths: RecruiterStrength[] = [];
  if (strongCount >= 2) {
    strengths.push({
      title: `${strongCount} substantial engineering repositories`,
      detail: 'Demonstrates ability to see multi-file, architecture-level applications through beyond simple code snippets.',
      evidence: classifiedRepos.filter(r => r.classification === 'STRONG PROJECT').map(r => r.name).join(', '),
      confidence: 'HIGH',
    });
  }
  if (resumeProjectsFound.length > 0) {
    strengths.push({
      title: 'Resume claims directly corroborated by code',
      detail: 'Public repositories verify project names, technical stack choices, and commit consistency.',
      evidence: resumeProjectsFound.map(m => `${m.resumeProject} → ${m.repoName}`).join(', '),
      confidence: 'HIGH',
    });
  }
  const hasTestsOrCi = classifiedRepos.filter(r => r.hasTests || r.hasCi);
  if (hasTestsOrCi.length > 0) {
    strengths.push({
      title: 'Professional engineering standards (CI/Tests)',
      detail: 'Evidence of automated testing or CI/CD pipelines detected in public projects.',
      evidence: hasTestsOrCi.map(r => r.name).join(', '),
      confidence: 'HIGH',
    });
  }
  const documentedRepos = classifiedRepos.filter(r => r.hasReadme);
  if (documentedRepos.length >= 3) {
    strengths.push({
      title: 'Consistent documentation habits',
      detail: `${documentedRepos.length} repositories feature structured README documentation explaining purpose and setup.`,
      evidence: documentedRepos.slice(0, 4).map(r => r.name).join(', '),
      confidence: 'HIGH',
    });
  }

  // 5. Prepared Technical Questions (Evidence-Based)
  const preparedQuestions: PreparedQuestion[] = [];

  // Question on top flagship project
  const topProject = classifiedRepos.find(r => r.classification === 'STRONG PROJECT') || classifiedRepos[0];
  if (topProject) {
    preparedQuestions.push({
      question: `What was the most challenging technical architectural decision in "${topProject.name}"?`,
      context: `Your repository "${topProject.name}" is one of your most prominent public projects (${topProject.commitCount} commits).`,
      reason: 'Recruiters and engineers love to probe deep on your primary repository to see if you can explain design tradeoffs.',
      suggestedFocus: 'Explain the folder structure, data flow, API bottlenecks, and why you chose this stack.',
      category: 'architecture',
    });
  }

  // Question on missing resume projects
  if (resumeProjectsMissing.length > 0) {
    preparedQuestions.push({
      question: `Can you walk me through your implementation in "${resumeProjectsMissing[0].resumeProject}"?`,
      context: `Listed on your resume, but no matching public GitHub repository was detected.`,
      reason: 'Interviewers often hone in on unverified projects to check candidate authenticity and depth of involvement.',
      suggestedFocus: 'Be prepared with architectural diagrams, technical challenges solved, or a live demo.',
      category: 'unverified_claim',
    });
  }

  // Question on testing if present
  const testedRepo = classifiedRepos.find(r => r.hasTests);
  if (testedRepo) {
    preparedQuestions.push({
      question: `How did you structure your test strategy in "${testedRepo.name}"?`,
      context: `Automated test files detected in repository "${testedRepo.name}".`,
      reason: 'Demonstrates whether candidate wrote meaningful integration/unit tests or just boilerplate smoke tests.',
      suggestedFocus: 'Discuss edge cases tested, mocking strategies for external APIs, and test coverage.',
      category: 'testing',
    });
  }

  // Question on target role alignment if mismatch exists
  if (targetRole && classifiedRepos.some(r => r.roleRelevance === 'HIGH')) {
    const roleRepo = classifiedRepos.find(r => r.roleRelevance === 'HIGH')!;
    preparedQuestions.push({
      question: `How does your work in "${roleRepo.name}" prepare you for the day-to-day requirements of a ${targetRole}?`,
      context: `Repository "${roleRepo.name}" demonstrates technologies critical to ${targetRole}.`,
      reason: 'Evaluates your ability to connect personal engineering work to job deliverables.',
      suggestedFocus: `Emphasize production readiness, state management, and scalability related to ${targetRole}.`,
      category: 'role_alignment',
    });
  }

  // 6. GitHub Profile Readiness Score (Explainable & Defensible)
  // Dimensions:
  // - projectQuality (0-100): Evaluates top 3-4 projects (NOT diluted by practice/DSA repos!)
  // - documentation (0-100): Evaluates README presence & quality on core/supporting repos
  // - activityRecency (0-100): Evaluates commit history and maintenance across recent projects
  // - resumeConsistency (0-100): Percentage of resume projects verified on GitHub
  // - profileHygiene (0-100): Penalizes unfinished/broken repos; offers pinning advice for noise
  const totalRepos = Math.max(classifiedRepos.length, 1);

  // Core project quality: evaluates top 3 projects
  const nonPracticeRepos = classifiedRepos.filter(r => r.classification !== 'PRACTICE / LEARNING' && r.classification !== 'ASSIGNMENT / ACADEMIC');
  const evaluatedCoreRepos = (nonPracticeRepos.length > 0 ? nonPracticeRepos : classifiedRepos).slice(0, 4);

  let coreProjectPoints = 0;
  evaluatedCoreRepos.forEach(r => {
    if (r.classification === 'STRONG PROJECT') coreProjectPoints += 30;
    else if (r.classification === 'SUPPORTING PROJECT' || r.classification === 'UTILITY / TOOL') coreProjectPoints += 20;
    else if (r.classification === 'POTENTIAL TUTORIAL / CLONE') coreProjectPoints += 12;
    else coreProjectPoints += 8;

    if (r.hasTests) coreProjectPoints += 5;
    if (r.hasCi || r.hasDockerfile) coreProjectPoints += 5;
  });

  const projectQuality = Math.min(100, Math.max(25, Math.round((coreProjectPoints / (evaluatedCoreRepos.length * 40)) * 100)));

  // Documentation: evaluates non-practice repos
  const nonPracticeTotal = Math.max(nonPracticeRepos.length, 1);
  const coreWithReadme = nonPracticeRepos.filter(r => r.hasReadme).length;
  const documentation = Math.min(100, Math.round((coreWithReadme / nonPracticeTotal) * 100));

  // Activity recency: commits within past 12 months
  const recentRepos = classifiedRepos.filter(r => {
    if (!r.lastCommitAt) return false;
    const days = (Date.now() - new Date(r.lastCommitAt).getTime()) / (1000 * 60 * 60 * 24);
    return days <= 365;
  }).length;
  const activityRecency = Math.min(100, Math.round((recentRepos / totalRepos) * 100));

  // Resume consistency: strong/likely matches
  const matchedCount = resumeProjectsFound.length;
  const totalResumeProj = Math.max(resumeProjects.length, 1);
  const resumeConsistency = Math.min(100, Math.round((matchedCount / totalResumeProj) * 100));

  // Profile hygiene: penalize truly unfinished/sparse repos
  const hygieneDeduction = (needsReviewCount * 15) + (tutorialOrBoilerplateCount >= 3 ? 10 : 0);
  const profileHygiene = Math.max(25, Math.min(100, 100 - hygieneDeduction));

  // Weighted overall readiness
  const readinessScore = Math.round(
    projectQuality * 0.30 +
    documentation * 0.20 +
    activityRecency * 0.15 +
    resumeConsistency * 0.20 +
    profileHygiene * 0.15
  );

  // Explainable positive and deduction factors
  const positiveFactors: string[] = [];
  const deductionFactors: string[] = [];

  if (strongCount >= 2) {
    positiveFactors.push(`Strong architectural evidence across ${strongCount} substantial project(s)`);
  } else if (strongCount === 1) {
    positiveFactors.push(`1 flagship repository with solid architectural scope`);
  }
  if (matchedCount > 0) {
    positiveFactors.push(`${matchedCount}/${totalResumeProj} resume projects corroborated by public code`);
  }
  if (hasTestsOrCi.length > 0) {
    positiveFactors.push('Automated testing or CI/CD pipelines detected');
  }
  if (documentation >= 75) {
    positiveFactors.push(`${coreWithReadme}/${nonPracticeTotal} engineering repositories feature structured documentation`);
  }

  if (resumeProjectsMissing.length > 0) {
    deductionFactors.push(`${resumeProjectsMissing.length} resume project(s) have unverified public repository evidence`);
  }
  if (needsReviewCount > 0) {
    deductionFactors.push(`${needsReviewCount} repository/repositories have sparse commit history or missing documentation`);
  }
  if (documentation < 60) {
    deductionFactors.push('Multiple engineering repositories lack setup or architectural README files');
  }
  if (targetRole && classifiedRepos.filter(r => r.roleRelevance === 'HIGH').length === 0) {
    deductionFactors.push(`Public code demonstrates limited alignment with target role (${targetRole})`);
  }

  const breakdown: string[] = [
    `Project Evidence (${projectQuality}/100): ${strongCount} substantial, ${supportingCount} supporting project(s)`,
    `Documentation (${documentation}/100): ${coreWithReadme}/${nonPracticeTotal} engineering repositories contain README files`,
    `Activity Recency (${activityRecency}/100): ${recentRepos}/${totalRepos} repositories updated within past 12 months`,
    `Resume Consistency (${resumeConsistency}/100): ${matchedCount}/${totalResumeProj} resume projects verified on GitHub`,
    `Profile Organization (${profileHygiene}/100): ${needsReviewCount} unfinished, ${practiceCount} practice/academic repositories`,
  ];

  return {
    repositories: classifiedRepos,
    summary: {
      totalPublicRepos: classifiedRepos.length,
      strongProjectsCount: strongCount,
      supportingCount: supportingCount,
      practiceCount: practiceCount,
      outdatedCount: outdatedCount,
      needsReviewCount: needsReviewCount,
    },
    consistency: {
      resumeProjectsFound,
      resumeProjectsMissing,
      githubProjectsNotOnResume,
    },
    concerns,
    strengths,
    preparedQuestions,
    readiness: {
      score: readinessScore,
      dimensions: {
        projectQuality,
        documentation,
        activityRecency,
        resumeConsistency,
        profileHygiene,
      },
      breakdown,
      positiveFactors,
      deductionFactors,
    },
  };
}
