import { ClaimEvidenceMatch } from './evidenceEngine';
import { RecruiterProfileAudit, ClassifiedRepository, RecruiterConcern } from './recruiterAudit';
import { GitHubRepo } from './githubAnalyzer';
import { ParsedResume } from './resumeParser';

export type DecisionRecommendation = 'READY' | 'READY_WITH_FIXES' | 'NEEDS_WORK';

export type ActionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ActionCategory = 'resume' | 'github' | 'target_role' | 'presentation';

export type EstimatedEffort = 'QUICK' | 'LOW' | 'MEDIUM' | 'HIGH';

export interface ActionOption {
  label: string;
  description: string;
}

export interface PrioritizedAction {
  findingId: string;
  canonicalId?: string;
  priority: ActionPriority;
  category: ActionCategory;
  title: string;
  whyItMatters: string;
  evidence: string;
  recommendedAction: string;
  options?: ActionOption[];
  estimatedEffort: EstimatedEffort;
  targetRoleCritical?: boolean;
  relatedRepo?: string;
}

export interface NoActionItem {
  id: string;
  title: string;
  category: 'practice_work' | 'completed_legacy' | 'compact_utility' | 'healthy_area';
  whySafeToLeave: string;
  evidence: string;
  relatedRepo?: string;
}

export interface PreApplicationDecision {
  recommendation: DecisionRecommendation;
  recommendationLabel: string;
  headline: string;
  summary: string;
  readinessScore: number;
  
  summaryMetrics: {
    resumeGitHubConsistency: 'STRONG' | 'MODERATE' | 'NEEDS_ATTENTION';
    coreProjects: 'STRONG' | 'MODERATE' | 'NEEDS_ATTENTION';
    targetRoleFit: 'STRONG' | 'MODERATE' | 'LOW';
    publicProfile: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION';
    evidenceGapsCount: number;
    priorityFixesCount: number;
  };

  mustFix: PrioritizedAction[];
  niceToFix: PrioritizedAction[];
  noActionNeeded: NoActionItem[];
  roleCriticalGaps: PrioritizedAction[];

  strongestReasons: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface GenerateDecisionParams {
  findings: ClaimEvidenceMatch[];
  recruiterAudit: RecruiterProfileAudit;
  repos: GitHubRepo[];
  parsedResume?: ParsedResume | null;
  targetRole?: string;
  jobRequirements?: string[];
}

// Target Role Skill Map (aligned with recruiter audit)
const ROLE_TECH_MAP: Record<string, string[]> = {
  frontend: ['react', 'next.js', 'vue', 'angular', 'svelte', 'typescript', 'javascript', 'tailwind', 'css', 'html', 'redux', 'vite'],
  backend: ['node.js', 'express', 'nestjs', 'python', 'django', 'fastapi', 'go', 'golang', 'java', 'spring', 'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'docker', 'testing', 'jest', 'vitest', 'pytest'],
  fullstack: ['react', 'next.js', 'node.js', 'express', 'typescript', 'mongodb', 'postgresql', 'docker', 'tailwind', 'testing'],
  mobile: ['react native', 'flutter', 'swift', 'kotlin', 'ios', 'android', 'dart'],
  ml: ['python', 'pytorch', 'tensorflow', 'pandas', 'numpy', 'scikit-learn', 'machine learning', 'deep learning'],
  devops: ['docker', 'kubernetes', 'terraform', 'ci/cd', 'github actions', 'jenkins', 'aws', 'gcp', 'linux'],
};

export function generatePreApplicationDecision(params: GenerateDecisionParams): PreApplicationDecision {
  const { findings, recruiterAudit, repos, targetRole = 'Software Engineer', jobRequirements = [] } = params;

  const mustFix: PrioritizedAction[] = [];
  const niceToFix: PrioritizedAction[] = [];
  const noActionNeeded: NoActionItem[] = [];
  const roleCriticalGaps: PrioritizedAction[] = [];

  const roleLower = targetRole.toLowerCase();
  const matchedRoleKey = Object.keys(ROLE_TECH_MAP).find(k => roleLower.includes(k));
  const roleKeywords = matchedRoleKey ? ROLE_TECH_MAP[matchedRoleKey] : ['typescript', 'react', 'node.js', 'python', 'testing', 'docker'];

  // Normalize explicit job requirements or fall back to role keywords
  const explicitRequirements = jobRequirements.length > 0
    ? jobRequirements.map(r => r.toLowerCase().trim())
    : roleKeywords;

  // --------------------------------------------------------------------------
  // 1. EVALUATE TARGET ROLE-CRITICAL GAPS
  // --------------------------------------------------------------------------
  // We check which explicit requirements have verified or supported public code evidence.
  // Crucial principle: Distinguish "Evidence Missing" from "Skill Probably Missing".
  const verifiedSkillsLower = new Set(
    findings
      .filter(f => f.evidenceStatus === 'verified' || f.evidenceStatus === 'supported')
      .map(f => f.skill.toLowerCase())
  );

  // Also check repos directly for technology usage in languages, packageJson, or fileTree
  for (const req of explicitRequirements) {
    const isVerifiedInFindings = Array.from(verifiedSkillsLower).some(s => s.includes(req) || req.includes(s));
    
    // Check repos evidence directly
    const foundInRepos = repos.some(r => {
      const langMatch = r.languages && Object.keys(r.languages).some(l => l.toLowerCase().includes(req));
      const pkgDeps = { ...(r.packageJson?.dependencies || {}), ...(r.packageJson?.devDependencies || {}) };
      const depMatch = Object.keys(pkgDeps).some(d => d.toLowerCase().includes(req));
      const nameMatch = r.name.toLowerCase().includes(req) || (r.description || '').toLowerCase().includes(req);
      const testMatch = (req === 'testing' || req === 'tests') && (r.hasTests || r.fileTree?.some(f => /\b(test|spec)\b/i.test(f)));
      const dockerMatch = (req === 'docker' || req === 'container') && (r.hasDockerfile || r.fileTree?.some(f => /docker/i.test(f)));
      return langMatch || depMatch || nameMatch || testMatch || dockerMatch;
    });

    if (!isVerifiedInFindings && !foundInRepos) {
      // Core role requirement has no public code evidence
      const action: PrioritizedAction = {
        findingId: `role-gap-${req}`,
        canonicalId: `target_role_missing_${req}`,
        priority: 'HIGH',
        category: 'target_role',
        title: `${capitalize(req)} — Evidence Missing for Target Role`,
        whyItMatters: `The target role (${targetRole}) lists ${capitalize(req)} as a requirement. Public code repositories currently offer no strong demonstrable implementation.`,
        evidence: `No active code, package manifest, or test runner containing "${req}" was detected across ${repos.length} public repositories.`,
        recommendedAction: `Add concrete ${capitalize(req)} implementation evidence to an existing flagship project or highlight relevant coursework/private experience.`,
        options: [
          {
            label: 'Option A: Add Public Evidence',
            description: `Integrate ${capitalize(req)} into your strongest project to make the competency verifiable.`
          },
          {
            label: 'Option B: Clarify Experience Context',
            description: `If ${capitalize(req)} was utilized in internships, academic coursework, or private systems, ensure that context is explicitly noted on your resume.`
          }
        ],
        estimatedEffort: 'MEDIUM',
        targetRoleCritical: true,
      };

      roleCriticalGaps.push(action);
      mustFix.push(action);
    }
  }

  // --------------------------------------------------------------------------
  // 2. EVALUATE UNSUPPORTED / INFLATED RESUME CLAIMS
  // --------------------------------------------------------------------------
  const unverifiedResumeClaims = findings.filter(
    f => f.resumeClaim && f.evidenceStatus === 'unverified'
  );

  for (const claim of unverifiedResumeClaims) {
    const isTargetRoleRelevant = explicitRequirements.some(req => claim.skill.toLowerCase().includes(req));
    const priority: ActionPriority = isTargetRoleRelevant ? 'CRITICAL' : 'HIGH';

    const action: PrioritizedAction = {
      findingId: `resume-unverified-${claim.skill}`,
      canonicalId: `unverified_claim_${claim.skill.toLowerCase().replace(/\s+/g, '_')}`,
      priority,
      category: 'resume',
      title: `Resume Claim for "${claim.skill}" Lacks Public Evidence`,
      whyItMatters: `Your resume asserts: "${claim.resumeClaim}". In technical screens, recruiters or engineers who verify GitHub will see zero observable implementation, creating an immediate credibility risk.`,
      evidence: claim.assessment || `Zero evidence for ${claim.skill} was found in public repositories, package manifests, or commit histories.`,
      recommendedAction: `Resolve the claim gap before applying: strengthen repository evidence, clarify project context, or revise the wording.`,
      options: [
        {
          label: 'Option A: Strengthen Repository Evidence',
          description: `Add an actual implementation of ${claim.skill} to a public repository with tests or commits.`
        },
        {
          label: 'Option B: Clarify Project Context',
          description: `If ${claim.skill} was used in proprietary work, team projects, or private systems, clarify that context on your resume so reviewers understand why it isn't in public repos.`
        },
        {
          label: 'Option C: Soften or Remove Resume Wording',
          description: `If the claim is overstated or obsolete, modify the bullet point to reflect only skills you can comfortably defend.`
        }
      ],
      estimatedEffort: 'QUICK',
      targetRoleCritical: isTargetRoleRelevant,
    };

    // Avoid duplicate title if already covered under roleCriticalGaps
    if (!mustFix.some(a => a.canonicalId === action.canonicalId)) {
      mustFix.push(action);
    }
  }

  // --------------------------------------------------------------------------
  // 3. EVALUATE RECRUITER CONCERNS & GITHUB PRESENTATION
  // --------------------------------------------------------------------------
  for (const concern of recruiterAudit.concerns) {
    // If high severity mismatch or unverified claim, promote to mustFix
    if (concern.severity === 'high') {
      const isMismatch = concern.category === 'mismatch' || concern.category === 'missing_project';
      const isClaim = concern.category === 'unverified_claim';

      const action: PrioritizedAction = {
        findingId: concern.id,
        canonicalId: concern.canonicalId || concern.id,
        priority: isMismatch ? 'CRITICAL' : 'HIGH',
        category: isClaim ? 'resume' : 'github',
        title: concern.title,
        whyItMatters: concern.reasoning || concern.risk,
        evidence: concern.evidence || concern.observation,
        recommendedAction: concern.recommendation,
        estimatedEffort: isMismatch ? 'QUICK' : 'MEDIUM',
      };

      if (!mustFix.some(a => a.title === action.title || a.canonicalId === action.canonicalId)) {
        mustFix.push(action);
      }
    } else if (concern.severity === 'medium') {
      // Meaningful but not application blocker -> niceToFix
      const action: PrioritizedAction = {
        findingId: concern.id,
        canonicalId: concern.canonicalId || concern.id,
        priority: 'MEDIUM',
        category: 'presentation',
        title: concern.title,
        whyItMatters: concern.reasoning || concern.risk,
        evidence: concern.evidence || concern.observation,
        recommendedAction: concern.recommendation,
        estimatedEffort: 'LOW',
      };

      if (!niceToFix.some(a => a.title === action.title)) {
        niceToFix.push(action);
      }
    } else if (concern.severity === 'low') {
      // Polish / optimization -> niceToFix
      const action: PrioritizedAction = {
        findingId: concern.id,
        canonicalId: concern.canonicalId || concern.id,
        priority: 'LOW',
        category: 'presentation',
        title: concern.title,
        whyItMatters: concern.reasoning || concern.risk,
        evidence: concern.evidence || concern.observation,
        recommendedAction: concern.recommendation,
        estimatedEffort: 'QUICK',
      };

      if (!niceToFix.some(a => a.title === action.title)) {
        niceToFix.push(action);
      }
    }
  }

  // Check repositories for specific presentation improvements (e.g. missing README on core projects)
  for (const repo of recruiterAudit.repositories) {
    if ((repo.classification === 'STRONG PROJECT' || repo.classification === 'SUPPORTING PROJECT') && !repo.hasReadme) {
      const action: PrioritizedAction = {
        findingId: `readme-missing-${repo.name}`,
        canonicalId: `missing_readme_${repo.name}`,
        priority: repo.classification === 'STRONG PROJECT' ? 'HIGH' : 'MEDIUM',
        category: 'github',
        title: `Add Technical README to "${repo.name}"`,
        whyItMatters: `"${repo.name}" is classified as a ${repo.classification.toLowerCase()}, but contains no README. Recruiters evaluate documentation to assess communication and architecture.`,
        evidence: `Repository "${repo.name}" has ${repo.commitCount} commits but lacks a README markdown document.`,
        recommendedAction: `Add a concise README containing: (1) project purpose, (2) tech stack, (3) local setup instructions, and (4) architectural decisions.`,
        estimatedEffort: 'LOW',
        relatedRepo: repo.name,
      };

      if (action.priority === 'HIGH' && !mustFix.some(a => a.canonicalId === action.canonicalId)) {
        mustFix.push(action);
      } else if (!niceToFix.some(a => a.canonicalId === action.canonicalId)) {
        niceToFix.push(action);
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4. "YOU DON'T NEED TO FIX" (PREVENT DESTRUCTIVE / POINTLESS CLEANING)
  // --------------------------------------------------------------------------
  // Category A: DSA & Competitive Programming Repos
  const practiceRepos = recruiterAudit.repositories.filter(
    r => r.classification === 'PRACTICE / LEARNING' || r.classification === 'ASSIGNMENT / ACADEMIC'
  );
  if (practiceRepos.length > 0) {
    noActionNeeded.push({
      id: 'no-action-dsa',
      title: `Practice & Problem Solving Repositories (${practiceRepos.length} repos)`,
      category: 'practice_work',
      whySafeToLeave: `Clearly classified as practice and algorithmic coursework. Recruiters understand that developers keep practice code public; these repositories do not distract from your flagship project evidence.`,
      evidence: practiceRepos.slice(0, 3).map(r => r.name).join(', ') + (practiceRepos.length > 3 ? ` and ${practiceRepos.length - 3} more` : ''),
    });
  }

  // Category B: Older Completed Projects
  const olderCompletedRepos = recruiterAudit.repositories.filter(
    r => {
      const isOld = r.lastCommitAt ? (Date.now() - new Date(r.lastCommitAt).getTime()) > 365 * 24 * 60 * 60 * 1000 : false;
      const hasCompleteSignal = r.signals.some(s => s.toLowerCase().includes('complete') || s.toLowerCase().includes('legacy'));
      return hasCompleteSignal || (isOld && (r.hasReadme || r.hasTests || r.classification === 'OUTDATED'));
    }
  );
  for (const oldRepo of olderCompletedRepos) {
    if (!noActionNeeded.some(n => n.relatedRepo === oldRepo.name)) {
      noActionNeeded.push({
        id: `no-action-old-${oldRepo.name}`,
        title: `Completed Project: "${oldRepo.name}"`,
        category: 'completed_legacy',
        whySafeToLeave: `Older but complete and documented. Demonstrates historical project completion without needing urgent updates or rewrites.`,
        evidence: `Repository "${oldRepo.name}" shows complete codebase structure and documentation.`,
        relatedRepo: oldRepo.name,
      });
    }
  }

  // Category C: Compact Utilities
  const utilityRepos = recruiterAudit.repositories.filter(
    r => r.classification === 'UTILITY / TOOL'
  );
  for (const utilRepo of utilityRepos) {
    if (!noActionNeeded.some(n => n.relatedRepo === utilRepo.name)) {
      noActionNeeded.push({
        id: `no-action-util-${utilRepo.name}`,
        title: `Compact Utility: "${utilRepo.name}"`,
        category: 'compact_utility',
        whySafeToLeave: `Small but focused with clean utility value and tests. You do not need to expand or delete single-purpose tools.`,
        evidence: `Compact codebase with dedicated purpose.`,
        relatedRepo: utilRepo.name,
      });
    }
  }

  // Category D: Strong Flagship Projects already in good shape
  const strongCleanRepos = recruiterAudit.repositories.filter(
    r => r.classification === 'STRONG PROJECT' && r.hasReadme && r.hasTests
  );
  for (const strongRepo of strongCleanRepos) {
    if (!noActionNeeded.some(n => n.relatedRepo === strongRepo.name)) {
      noActionNeeded.push({
        id: `no-action-strong-${strongRepo.name}`,
        title: `Flagship Project: "${strongRepo.name}"`,
        category: 'healthy_area',
        whySafeToLeave: `High-signal project with clean documentation, tests, and active commit evidence. Already serves as strong recruiter proof.`,
        evidence: `Contains README, test suites, and layered architecture.`,
        relatedRepo: strongRepo.name,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 5. SORT ACTIONS BY "FIX FIRST" ALGORITHM
  // --------------------------------------------------------------------------
  // Rank algorithm: Priority weight (CRITICAL=4, HIGH=3, MEDIUM=2, LOW=1)
  // + Target role criticality bonus (+2)
  // + Effort bonus (QUICK gets higher priority to clear easy wins first)
  const priorityScore = (a: PrioritizedAction): number => {
    let score = 0;
    if (a.priority === 'CRITICAL') score += 40;
    if (a.priority === 'HIGH') score += 30;
    if (a.priority === 'MEDIUM') score += 20;
    if (a.priority === 'LOW') score += 10;
    if (a.targetRoleCritical) score += 15;
    if (a.estimatedEffort === 'QUICK') score += 5;
    if (a.estimatedEffort === 'LOW') score += 3;
    return score;
  };

  mustFix.sort((a, b) => priorityScore(b) - priorityScore(a));
  niceToFix.sort((a, b) => priorityScore(b) - priorityScore(a));

  // --------------------------------------------------------------------------
  // 6. THREE DECISION STATES (CRITICAL: DO NOT LET SCORE ALONE DECIDE!)
  // --------------------------------------------------------------------------
  // Evaluate the actual evidence factors:
  const criticalCount = mustFix.filter(a => a.priority === 'CRITICAL').length;
  const highCount = mustFix.filter(a => a.priority === 'HIGH').length;
  const roleGapsCount = roleCriticalGaps.length;
  const unverifiedCount = unverifiedResumeClaims.length;
  const strongProjectsCount = recruiterAudit.summary.strongProjectsCount;
  const supportingProjectsCount = recruiterAudit.summary.supportingCount;
  const hasCoreProjects = (strongProjectsCount + supportingProjectsCount) >= 1;
  const hasMajorMismatch = recruiterAudit.concerns.some(c => c.severity === 'high' && c.category === 'mismatch');

  let recommendation: DecisionRecommendation;
  let recommendationLabel: string;
  let headline: string;
  let summary: string;
  const strongestReasons: string[] = [];

  // RULE 1: NEEDS_WORK
  // Used ONLY when major role requirements are unsupported, substantial resume/GitHub inconsistency exists,
  // multiple important claims lack evidence, or profile presentation has fundamental credibility gaps.
  const hasExtensiveBlockers = (roleGapsCount >= 3) || (unverifiedCount >= 3 && !hasCoreProjects) || (criticalCount >= 3);

  if (hasExtensiveBlockers) {
    recommendation = 'NEEDS_WORK';
    recommendationLabel = 'Strengthen your profile before applying';
    headline = 'ADDRESS CORE EVIDENCE & ROLE GAPS BEFORE APPLYING';
    summary = `Your profile shows significant gaps between target role requirements, resume assertions, and observable public code evidence. Addressing these core areas will substantially improve interview conversion.`;
    
    if (roleGapsCount > 0) strongestReasons.push(`${roleGapsCount} essential ${targetRole} requirements lack demonstrable implementation.`);
    if (unverifiedCount > 0) strongestReasons.push(`${unverifiedCount} resume claims could not be verified in public code repositories.`);
    if (hasMajorMismatch) strongestReasons.push('Major project mismatch between resume highlights and GitHub repositories.');
    if (!hasCoreProjects) strongestReasons.push('No primary full-stack or backend projects identified with tests or layered architecture.');
  }
  // RULE 2: READY
  // Used when no major evidence gaps, strong consistency, target role requirements substantially supported,
  // and no critical credibility concerns exist.
  // Note: Candidate score could be 72 (Profile J), but if all critical role requirements are supported,
  // strong project evidence exists, and no high-priority blockers exist -> READY!
  else if (criticalCount === 0 && highCount === 0 && roleGapsCount === 0) {
    recommendation = 'READY';
    recommendationLabel = 'Ready to apply';
    headline = 'PROFILE BROADLY ALIGNED — READY FOR APPLICATION';
    summary = `Your resume, public GitHub evidence, and target role are broadly aligned. No high-priority issues were identified. You can submit applications with confidence in your observable code evidence.`;

    strongestReasons.push('Key technical competencies and role requirements are supported by public code.');
    strongestReasons.push('Resume project descriptions match observable GitHub repositories.');
    strongestReasons.push('No unverified claims or critical recruiter concerns detected.');
  }
  // RULE 3: READY_WITH_FIXES (The most common, constructive state)
  // Candidate is fundamentally credible, has real projects and skills, but has 1–5 fixable priorities.
  // (Also applies when candidate score is 82+ but has role-critical gap, e.g. Profile I!)
  else {
    recommendation = 'READY_WITH_FIXES';
    recommendationLabel = 'Apply after addressing these priorities';
    
    const count = mustFix.length;
    headline = `FIX ${count} HIGH-PRIORITY ${count === 1 ? 'ISSUE' : 'ISSUES'} BEFORE APPLYING`;
    summary = `Your profile is fundamentally credible, but contains ${count} high-priority ${count === 1 ? 'item' : 'items'} that could raise questions in technical screening. Addressing these priorities first will protect your candidacy.`;

    if (roleGapsCount > 0) {
      strongestReasons.push(`Target role requires evidence for: ${roleCriticalGaps.map(g => g.title.split('—')[0].trim()).join(', ')}.`);
    }
    if (unverifiedCount > 0) {
      strongestReasons.push(`${unverifiedCount} resume claim${unverifiedCount > 1 ? 's lack' : ' lacks'} public implementation evidence.`);
    }
    if (hasMajorMismatch) {
      strongestReasons.push('Resume project highlights differ from public repository contents.');
    }
    if (mustFix.some(a => a.canonicalId?.includes('readme'))) {
      strongestReasons.push('Flagship repository lacks complete technical documentation.');
    }
  }

  // --------------------------------------------------------------------------
  // 7. COMPACT SUMMARY METRICS
  // --------------------------------------------------------------------------
  const resumeGitHubConsistency = hasMajorMismatch
    ? 'NEEDS_ATTENTION'
    : (recruiterAudit.consistency.resumeProjectsFound.length > 0 ? 'STRONG' : 'MODERATE');

  const coreProjects = strongProjectsCount >= 1
    ? 'STRONG'
    : (supportingProjectsCount >= 1 ? 'MODERATE' : 'NEEDS_ATTENTION');

  const targetRoleFit = roleGapsCount === 0
    ? 'STRONG'
    : (roleGapsCount <= 2 ? 'MODERATE' : 'LOW');

  const publicProfile = recruiterAudit.summary.needsReviewCount === 0 && recruiterAudit.readiness.dimensions.profileHygiene >= 70
    ? 'EXCELLENT'
    : (recruiterAudit.readiness.dimensions.profileHygiene >= 50 ? 'GOOD' : 'NEEDS_ATTENTION');

  return {
    recommendation,
    recommendationLabel,
    headline,
    summary,
    readinessScore: recruiterAudit.readiness.score,
    summaryMetrics: {
      resumeGitHubConsistency,
      coreProjects,
      targetRoleFit,
      publicProfile,
      evidenceGapsCount: unverifiedResumeClaims.length,
      priorityFixesCount: mustFix.length,
    },
    mustFix,
    niceToFix,
    noActionNeeded,
    roleCriticalGaps,
    strongestReasons: strongestReasons.slice(0, 4),
    confidence: 'HIGH',
  };
}

// ----------------------------------------------------------------------------
// DYNAMIC 14-DAY ROADMAP GENERATION FROM CANONICAL PRIORITIES
// ----------------------------------------------------------------------------
export function generateActionPlanFromDecision(
  decision: PreApplicationDecision,
  findings: ClaimEvidenceMatch[]
): Array<{ day: string; title: string; description: string; priority: 'critical' | 'high' | 'medium' | 'low' }> {
  const plan: Array<{ day: string; title: string; description: string; priority: 'critical' | 'high' | 'medium' | 'low' }> = [];

  const mustFix = decision.mustFix;
  const niceToFix = decision.niceToFix;

  // Case 1: READY with 0 mustFix items
  if (mustFix.length === 0) {
    if (niceToFix.length === 0) {
      plan.push({
        day: 'Day 1–2',
        title: 'Final Profile Review & Application Submission',
        description: 'Your profile has no high-priority evidence gaps. Do a quick final review of your resume links, verify repo permissions, and submit your application.',
        priority: 'low',
      });
      plan.push({
        day: 'Day 3–4',
        title: 'Technical Interview Preparation',
        description: 'Review your flagship project architecture, database design choices, and trade-offs in preparation for technical interview discussions.',
        priority: 'low',
      });
      return plan;
    } else {
      // 1 or 2 minor polish items only
      niceToFix.slice(0, 3).forEach((item, idx) => {
        plan.push({
          day: `Day ${idx * 2 + 1}–${idx * 2 + 2}`,
          title: item.title,
          description: item.recommendedAction,
          priority: item.priority.toLowerCase() as any,
        });
      });
      plan.push({
        day: `Day ${(niceToFix.slice(0, 3).length) * 2 + 1}`,
        title: 'Submit Application with Confidence',
        description: 'With all key technical competencies verified and polish tasks completed, proceed to submit your target role application.',
        priority: 'low',
      });
      return plan;
    }
  }

  // Case 2: 1 to 2 issues only -> Do NOT invent 14 days of filler work!
  if (mustFix.length <= 2) {
    mustFix.forEach((item, idx) => {
      plan.push({
        day: idx === 0 ? 'Day 1–2' : 'Day 3–5',
        title: item.title,
        description: `${item.recommendedAction} ${item.options ? `Recommended: ${item.options[0].description}` : ''}`.trim(),
        priority: item.priority.toLowerCase() as any,
      });
    });

    if (niceToFix.length > 0) {
      const topNice = niceToFix[0];
      plan.push({
        day: 'Day 6',
        title: topNice.title,
        description: topNice.recommendedAction,
        priority: topNice.priority.toLowerCase() as any,
      });
    }

    plan.push({
      day: 'Day 7',
      title: 'Profile Final Review & Application Submission',
      description: 'Review updated resume claims and GitHub project links. Your priority issues are resolved — submit your application.',
      priority: 'high',
    });

    return plan;
  }

  // Case 3: 3+ issues -> Spread systematically over 14 days by priority
  let currentDay = 1;
  const allActions = [...mustFix, ...niceToFix];

  for (let i = 0; i < Math.min(allActions.length, 6); i++) {
    const item = allActions[i];
    const daysSpan = item.priority === 'CRITICAL' ? 3 : 2;
    const endDay = Math.min(currentDay + daysSpan - 1, 13);
    const dayLabel = currentDay === endDay ? `Day ${currentDay}` : `Day ${currentDay}–${endDay}`;

    plan.push({
      day: dayLabel,
      title: item.title,
      description: `${item.recommendedAction} ${item.options ? `Recommended: ${item.options[0].description}` : ''}`.trim(),
      priority: item.priority.toLowerCase() as any,
    });

    currentDay = endDay + 1;
    if (currentDay > 13) break;
  }

  plan.push({
    day: 'Day 14',
    title: 'Re-scan with GapCheck & Submit Application',
    description: 'Run GapCheck to verify all claim gaps have been resolved, then submit your application with observable public evidence.',
    priority: 'high',
  });

  return plan;
}

function capitalize(s: string): string {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}
