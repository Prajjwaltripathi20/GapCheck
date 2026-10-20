import { ResumeClaim } from './resumeParser';
import { RepoEvidence, GitHubRepo } from './githubAnalyzer';

export type EvidenceStatus = 'verified' | 'supported' | 'weakly_supported' | 'unverified' | 'unknown';
export type Priority = 'critical' | 'high' | 'medium' | 'low';

export interface ClaimEvidenceMatch {
  skill: string;
  resumeClaim: string | null;
  claimLevel: string | null;
  evidenceStatus: EvidenceStatus;
  evidenceSources: EvidenceSource[];
  assessment: string;
  confidence: number;
  priority: Priority;
}

export interface EvidenceSource {
  source: string;
  repository?: string;
  file?: string;
  evidence: string;
  confidence: number;
}

export interface Recommendation {
  title: string;
  observation: string;
  evidence: EvidenceSource[];
  problem: string;
  hiringImpact: string;
  recommendation: string;
  priority: Priority;
  confidence: number;
  actionType: 'improve_existing' | 'build_new' | 'remove_claim' | 'add_evidence' | 'update_resume';
  targetProject?: string;
}

export interface ScoringDimensions {
  technicalEvidence: number;
  projectDepth: number;
  roleAlignment: number;
  resumeQuality: number;
  claimConsistency: number;
  engineeringEvidence: number;
}

export interface AnalysisResult {
  findings: ClaimEvidenceMatch[];
  recommendations: Recommendation[];
  dimensions: ScoringDimensions;
  overallScore: number;
  summary: string;
}

// Skill name normalization for matching
const SKILL_ALIASES: Record<string, string[]> = {
  'react': ['react', 'react.js', 'reactjs'],
  'node.js': ['node', 'node.js', 'nodejs'],
  'next.js': ['next', 'next.js', 'nextjs'],
  'vue': ['vue', 'vue.js', 'vuejs'],
  'express': ['express', 'express.js', 'expressjs'],
  'mongodb': ['mongodb', 'mongo'],
  'postgresql': ['postgresql', 'postgres', 'psql'],
  'docker': ['docker', 'docker-compose', 'containerization'],
  'kubernetes': ['kubernetes', 'k8s'],
  'aws': ['aws', 'amazon web services'],
  'gcp': ['gcp', 'google cloud', 'google cloud platform'],
  'typescript': ['typescript', 'ts'],
  'javascript': ['javascript', 'js'],
  'python': ['python', 'py'],
  'tailwind': ['tailwind', 'tailwindcss', 'tailwind css'],
  'ci/cd': ['ci/cd', 'cicd', 'ci cd', 'github actions', 'jenkins'],
  'testing': ['testing', 'jest', 'mocha', 'vitest', 'cypress', 'pytest'],
  'rest api': ['rest api', 'restful', 'api'],
  'graphql': ['graphql', 'gql'],
  'redis': ['redis'],
  'sql': ['sql', 'mysql', 'postgresql', 'postgres', 'sqlite'],
  'git': ['git', 'github', 'version control'],
  'linux': ['linux', 'ubuntu', 'shell', 'bash'],
};

function normalizeSkill(skill: string): string {
  const lower = skill.toLowerCase().trim();
  for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
    if (aliases.includes(lower)) return canonical;
  }
  return lower;
}

function findMatchingEvidence(skill: string, allEvidence: RepoEvidence[]): RepoEvidence[] {
  const normalizedSkill = normalizeSkill(skill);
  return allEvidence.filter(e => {
    const normalizedEvidenceSkill = normalizeSkill(e.skill);
    return normalizedEvidenceSkill === normalizedSkill ||
      SKILL_ALIASES[normalizedSkill]?.includes(normalizedEvidenceSkill) ||
      SKILL_ALIASES[normalizedEvidenceSkill]?.includes(normalizedSkill);
  });
}

function determineEvidenceStatus(matchingEvidence: RepoEvidence[]): EvidenceStatus {
  if (matchingEvidence.length === 0) return 'unverified';

  const maxConfidence = Math.max(...matchingEvidence.map(e => e.confidence));
  const evidenceTypes = new Set(matchingEvidence.map(e => e.evidenceType));
  const repoCount = new Set(matchingEvidence.map(e => e.metadata?.repository)).size;

  // Multiple evidence types across repos = strong
  if (evidenceTypes.size >= 3 && repoCount >= 2 && maxConfidence > 0.7) return 'verified';
  if (evidenceTypes.size >= 2 && maxConfidence > 0.6) return 'supported';
  if (matchingEvidence.length >= 1 && maxConfidence > 0.5) return 'weakly_supported';
  return 'weakly_supported';
}

function determinePriority(status: EvidenceStatus, isRequiredByJob: boolean): Priority {
  if (status === 'unverified' && isRequiredByJob) return 'critical';
  if (status === 'unverified') return 'high';
  if (status === 'weakly_supported' && isRequiredByJob) return 'high';
  if (status === 'weakly_supported') return 'medium';
  if (status === 'supported') return 'low';
  return 'low';
}

function generateAssessment(skill: string, status: EvidenceStatus, evidence: RepoEvidence[]): string {
  switch (status) {
    case 'verified':
      const repos = [...new Set(evidence.map(e => e.metadata?.repository).filter(Boolean))];
      return `Strong evidence supports your ${skill} claim. Found across ${repos.length} project(s): ${repos.join(', ')}.`;
    case 'supported':
      return `Evidence exists to support your ${skill} claim, but it demonstrates limited depth. Consider strengthening your implementation.`;
    case 'weakly_supported':
      return `Some evidence exists for ${skill}, but it's not strong enough to fully support the claim. The evidence suggests basic exposure rather than proficiency.`;
    case 'unverified':
      return `No observable evidence found for ${skill} in your GitHub repositories. This claim cannot be verified from available data.`;
    case 'unknown':
      return `Insufficient data to assess your ${skill} claim.`;
  }
}

export function matchClaimsToEvidence(
  claims: ResumeClaim[],
  evidence: RepoEvidence[],
  jobRequirements: string[] = []
): ClaimEvidenceMatch[] {
  const findings: ClaimEvidenceMatch[] = [];
  const processedSkills = new Set<string>();

  // Process skill claims
  const skillClaims = claims.filter(c => c.claimType === 'skill');
  for (const claim of skillClaims) {
    const normalized = normalizeSkill(claim.claim);
    if (processedSkills.has(normalized)) continue;
    processedSkills.add(normalized);

    const matchingEvidence = findMatchingEvidence(claim.claim, evidence);
    const status = determineEvidenceStatus(matchingEvidence);
    const isRequiredByJob = jobRequirements.some(
      r => normalizeSkill(r) === normalized
    );

    findings.push({
      skill: claim.claim,
      resumeClaim: claim.claim,
      claimLevel: claim.proficiencyLevel || 'claimed',
      evidenceStatus: status,
      evidenceSources: matchingEvidence.map(e => ({
        source: e.source,
        repository: e.metadata?.repository,
        file: e.metadata?.file,
        evidence: e.detail,
        confidence: e.confidence,
      })),
      assessment: generateAssessment(claim.claim, status, matchingEvidence),
      confidence: matchingEvidence.length > 0
        ? Math.max(...matchingEvidence.map(e => e.confidence))
        : 0.9, // High confidence we couldn't find evidence
      priority: determinePriority(status, isRequiredByJob),
    });
  }

  // Check job requirements that weren't in resume
  for (const req of jobRequirements) {
    const normalizedReq = normalizeSkill(req);
    if (processedSkills.has(normalizedReq)) continue;
    processedSkills.add(normalizedReq);

    const matchingEvidence = findMatchingEvidence(req, evidence);
    const status = matchingEvidence.length > 0 ? determineEvidenceStatus(matchingEvidence) : 'unverified';

    findings.push({
      skill: req,
      resumeClaim: null,
      claimLevel: null,
      evidenceStatus: status,
      evidenceSources: matchingEvidence.map(e => ({
        source: e.source,
        repository: e.metadata?.repository,
        file: e.metadata?.file,
        evidence: e.detail,
        confidence: e.confidence,
      })),
      assessment: `${req} is required by the target role but not listed on your resume. ${matchingEvidence.length > 0 ? 'However, some evidence exists in your GitHub.' : 'No evidence found in your GitHub.'}`,
      confidence: 0.85,
      priority: 'high',
    });
  }

  return findings.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

export function generateRecommendations(
  findings: ClaimEvidenceMatch[],
  repos: GitHubRepo[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // 1. Unverified claims that should be removed or demonstrated
  const unverified = findings.filter(f => f.evidenceStatus === 'unverified' && f.resumeClaim);
  if (unverified.length > 0) {
    const skills = unverified.map(f => f.skill);
    recommendations.push({
      title: 'Resume claims exceed available evidence',
      observation: `Your resume lists ${skills.join(', ')} but no observable evidence was found in your GitHub repositories.`,
      evidence: [],
      problem: `These claims cannot be verified, which may raise concerns during technical interviews.`,
      hiringImpact: 'Interviewers may question unsubstantiated claims, potentially affecting credibility.',
      recommendation: `Either remove unsupported claims (${skills.join(', ')}) from your resume, or demonstrate them through meaningful project work.`,
      priority: 'critical',
      confidence: 0.9,
      actionType: 'remove_claim',
    });
  }

  // 2. Weakly supported skills that need strengthening
  const weaklySupported = findings.filter(f => f.evidenceStatus === 'weakly_supported');
  for (const finding of weaklySupported) {
    const relatedRepo = findBestRepo(finding.skill, repos);
    recommendations.push({
      title: `Strengthen your ${finding.skill} evidence`,
      observation: `Your ${finding.skill} claim is only weakly supported by available evidence.`,
      evidence: finding.evidenceSources,
      problem: `Basic usage of ${finding.skill} detected, but not enough to demonstrate proficiency.`,
      hiringImpact: `Your target role may expect stronger ${finding.skill} evidence.`,
      recommendation: relatedRepo
        ? `Improve ${finding.skill} usage in your "${relatedRepo.name}" project by adding more depth, tests, and documentation.`
        : `Create a focused project that demonstrates meaningful ${finding.skill} implementation.`,
      priority: 'high',
      confidence: finding.confidence,
      actionType: relatedRepo ? 'improve_existing' : 'build_new',
      targetProject: relatedRepo?.name,
    });
  }

  // 3. Missing job requirements
  const missingRequired = findings.filter(f => !f.resumeClaim && f.evidenceStatus === 'unverified');
  for (const finding of missingRequired) {
    recommendations.push({
      title: `Missing required skill: ${finding.skill}`,
      observation: `The target role requires ${finding.skill}, which is not on your resume and has no GitHub evidence.`,
      evidence: [],
      problem: `This is a gap between your profile and the job requirements.`,
      hiringImpact: `This may disqualify your application if ${finding.skill} is a hard requirement.`,
      recommendation: `Add ${finding.skill} to an existing project or build a project that demonstrates it.`,
      priority: 'high',
      confidence: 0.85,
      actionType: 'build_new',
    });
  }

  // 4. Project depth issues
  const bestProjects = repos
    .filter(r => r.language && Object.keys(r.languages).length > 0)
    .sort((a, b) => Object.values(b.languages).reduce((s, v) => s + v, 0) - Object.values(a.languages).reduce((s, v) => s + v, 0))
    .slice(0, 3);

  for (const project of bestProjects) {
    const missing: string[] = [];
    if (!project.hasTests) missing.push('tests');
    if (!project.hasDockerfile) missing.push('Docker configuration');
    if (!project.hasCi) missing.push('CI/CD pipeline');
    if (!project.hasReadme || (project.readmeContent && project.readmeContent.length < 200)) missing.push('detailed README');

    if (missing.length >= 2) {
      recommendations.push({
        title: `Improve engineering depth of "${project.name}"`,
        observation: `"${project.name}" is one of your strongest projects but lacks engineering best practices.`,
        evidence: [{
          source: `github.repository.${project.name}`,
          repository: project.name,
          evidence: `Missing: ${missing.join(', ')}`,
          confidence: 0.9,
        }],
        problem: `The project demonstrates technical capability but lacks professional engineering practices.`,
        hiringImpact: `Recruiters look for engineering maturity in projects, not just functionality.`,
        recommendation: `Add ${missing.join(', ')} to "${project.name}" instead of starting a new project. This shows engineering depth.`,
        priority: missing.length >= 3 ? 'high' : 'medium',
        confidence: 0.85,
        actionType: 'improve_existing',
        targetProject: project.name,
      });
    }
  }

  return recommendations.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

function findBestRepo(skill: string, repos: GitHubRepo[]): GitHubRepo | null {
  const normalized = normalizeSkill(skill);
  for (const repo of repos) {
    const repoLangs = Object.keys(repo.languages).map(l => normalizeSkill(l));
    const repoDeps = repo.packageJson ? Object.keys({
      ...(repo.packageJson.dependencies || {}),
      ...(repo.packageJson.devDependencies || {}),
    }) : [];

    if (repoLangs.includes(normalized) || repoDeps.some(d => normalizeSkill(d) === normalized)) {
      return repo;
    }
  }
  return null;
}

export function calculateDimensions(
  findings: ClaimEvidenceMatch[],
  repos: GitHubRepo[],
  jobRequirements: string[]
): ScoringDimensions {
  // Technical Evidence (20%)
  const skillFindings = findings.filter(f => f.resumeClaim);
  const verifiedCount = skillFindings.filter(f => f.evidenceStatus === 'verified' || f.evidenceStatus === 'supported').length;
  const technicalEvidence = skillFindings.length > 0
    ? Math.round((verifiedCount / skillFindings.length) * 100)
    : 0;

  // Project Depth (20%)
  const projectScores = repos.map(r => {
    let score = 0;
    if (r.hasReadme && r.readmeContent && r.readmeContent.length > 200) score += 20;
    if (r.hasTests) score += 25;
    if (r.hasDockerfile) score += 15;
    if (r.hasCi) score += 15;
    if (Object.keys(r.languages).length > 1) score += 10;
    if (r.commitCount > 20) score += 10;
    if (r.description) score += 5;
    return Math.min(score, 100);
  });
  const projectDepth = projectScores.length > 0
    ? Math.round(projectScores.reduce((s, v) => s + v, 0) / projectScores.length)
    : 0;

  // Role Alignment (20%)
  const matchedRequirements = jobRequirements.filter(req => {
    const finding = findings.find(f => normalizeSkill(f.skill) === normalizeSkill(req));
    return finding && (finding.evidenceStatus === 'verified' || finding.evidenceStatus === 'supported');
  });
  const roleAlignment = jobRequirements.length > 0
    ? Math.round((matchedRequirements.length / jobRequirements.length) * 100)
    : 50;

  // Resume Quality (10%)
  const resumeQuality = Math.min(
    30 + (findings.length * 5) + (repos.filter(r => r.hasReadme).length * 10),
    100
  );

  // Claim Consistency (10%)
  const unverifiedCount = skillFindings.filter(f => f.evidenceStatus === 'unverified').length;
  const claimConsistency = skillFindings.length > 0
    ? Math.round(((skillFindings.length - unverifiedCount) / skillFindings.length) * 100)
    : 0;

  // Engineering Evidence (15%)
  const engineeringSignals = repos.reduce((score, r) => {
    if (r.hasTests) score += 15;
    if (r.hasDockerfile) score += 10;
    if (r.hasCi) score += 15;
    if (r.commitCount > 50) score += 10;
    return score;
  }, 0);
  const engineeringEvidence = Math.min(Math.round(engineeringSignals / Math.max(repos.length, 1)), 100);

  return {
    technicalEvidence,
    projectDepth,
    roleAlignment,
    resumeQuality,
    claimConsistency,
    engineeringEvidence,
  };
}

export function calculateOverallScore(dimensions: ScoringDimensions): number {
  const weights = {
    technicalEvidence: 0.20,
    projectDepth: 0.20,
    roleAlignment: 0.20,
    resumeQuality: 0.10,
    claimConsistency: 0.10,
    engineeringEvidence: 0.15,
  };
  // Remaining 5% is "professional presence" which we estimate
  const professionalPresence = Math.round((dimensions.projectDepth + dimensions.resumeQuality) / 2);

  const score =
    dimensions.technicalEvidence * weights.technicalEvidence +
    dimensions.projectDepth * weights.projectDepth +
    dimensions.roleAlignment * weights.roleAlignment +
    dimensions.resumeQuality * weights.resumeQuality +
    dimensions.claimConsistency * weights.claimConsistency +
    dimensions.engineeringEvidence * weights.engineeringEvidence +
    professionalPresence * 0.05;

  return Math.round(score);
}

export function generateActionPlan(
  recommendations: Recommendation[],
  findings: ClaimEvidenceMatch[]
): Array<{ day: string; title: string; description: string; priority: Priority }> {
  const plan: Array<{ day: string; title: string; description: string; priority: Priority }> = [];

  // Day 1-2: Remove unsupported claims
  const unverified = findings.filter(f => f.evidenceStatus === 'unverified' && f.resumeClaim);
  if (unverified.length > 0) {
    plan.push({
      day: 'Day 1–2',
      title: 'Remove unsupported skills from resume',
      description: `Remove or modify claims for: ${unverified.map(f => f.skill).join(', ')}. Only list skills you can demonstrate.`,
      priority: 'critical',
    });
  }

  // Day 3-5: Improve top project
  const improveRecs = recommendations.filter(r => r.actionType === 'improve_existing');
  if (improveRecs.length > 0) {
    const topProject = improveRecs[0];
    plan.push({
      day: 'Day 3–5',
      title: `Improve "${topProject.targetProject || 'your best project'}"`,
      description: topProject.recommendation,
      priority: 'high',
    });
  }

  // Day 6: Add error handling and validation
  plan.push({
    day: 'Day 6',
    title: 'Add error handling and input validation',
    description: 'Add proper error handling, input validation, and edge case management to your main project.',
    priority: 'high',
  });

  // Day 7: Write README
  plan.push({
    day: 'Day 7',
    title: 'Write comprehensive README',
    description: 'Add setup instructions, architecture overview, screenshots/demo, and tech stack explanation to your main project.',
    priority: 'medium',
  });

  // Day 8: Deploy
  plan.push({
    day: 'Day 8',
    title: 'Deploy your project',
    description: 'Deploy your project to Vercel, Netlify, Railway, or Render. Add the live link to your README and resume.',
    priority: 'high',
  });

  // Day 9-10: Add tests
  plan.push({
    day: 'Day 9–10',
    title: 'Add automated tests',
    description: 'Add unit tests for core logic and at least one integration test. This demonstrates engineering maturity.',
    priority: 'medium',
  });

  // Day 11: Improve resume
  plan.push({
    day: 'Day 11',
    title: 'Update resume with evidence-backed claims',
    description: 'Rewrite resume bullet points to reflect only demonstrable skills. Use action verbs and quantify impact where possible.',
    priority: 'medium',
  });

  // Day 12: Update GitHub
  plan.push({
    day: 'Day 12',
    title: 'Update GitHub profile',
    description: 'Add a profile README, pin your best repositories, add topics/descriptions to repos, and ensure commit history is clean.',
    priority: 'low',
  });

  // Day 13: Re-scan
  plan.push({
    day: 'Day 13',
    title: 'Run ProofCheck analysis again',
    description: 'Re-scan your profile to see how your Evidence Readiness Score has improved.',
    priority: 'medium',
  });

  // Day 14: Practice
  plan.push({
    day: 'Day 14',
    title: 'Practice explaining your projects',
    description: 'Prepare to explain your project architecture, design decisions, and challenges during interviews.',
    priority: 'medium',
  });

  return plan;
}
