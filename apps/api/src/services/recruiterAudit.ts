import { GitHubRepo } from './githubAnalyzer';
import { ParsedResume } from './resumeParser';

export type RepoClassification =
  | 'STRONG PROJECT'
  | 'SUPPORTING PROJECT'
  | 'PRACTICE / LEARNING'
  | 'ASSIGNMENT / ACADEMIC'
  | 'TUTORIAL / CLONE'
  | 'OUTDATED'
  | 'INACTIVE'
  | 'UNFINISHED / NEEDS REVIEW'
  | 'FORK / DUPLICATE'
  | 'UNKNOWN';

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
  confidence: number;
  signals: string[];
  recruiterNotes: string;
  matchedResumeProject?: string;
  isFork?: boolean;
  isArchived?: boolean;
}

export interface RecruiterConcern {
  id: string;
  category: 'mismatch' | 'unverified_claim' | 'unfinished_project' | 'profile_noise' | 'missing_project' | 'hygiene';
  severity: 'high' | 'medium' | 'low';
  title: string;
  observation: string;
  risk: string;
  recommendation: string;
}

export interface RecruiterStrength {
  title: string;
  detail: string;
  evidence: string;
}

export interface PreparedQuestion {
  question: string;
  context: string;
  reason: string;
  suggestedFocus: string;
}

export interface ResumeGitHubConsistency {
  resumeProjectsFound: Array<{
    resumeProject: string;
    repoName: string;
    matchStrength: 'STRONG' | 'MODERATE';
    evidenceSummary: string;
  }>;
  resumeProjectsMissing: Array<{
    resumeProject: string;
    note: string;
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
    projectQuality: number;
    documentation: number;
    activityRecency: number;
    resumeConsistency: number;
    profileHygiene: number; // Low noise, minimal unfinished repos
  };
  breakdown: string[];
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

// Tutorial/clone indicator regexes
const TUTORIAL_PATTERNS = [
  /\b(tutorial|clone|course|bootcamp|freecodecamp|udemy|coursera|codecademy|workshop|100daysof|scrimba)\b/i,
  /\b(todo-app|todoapp|calculator|weather-app|movie-search|tic-tac-toe|tictactoe)\b/i,
];

// Practice / DSA patterns
const PRACTICE_PATTERNS = [
  /\b(dsa|leetcode|hackerrank|codeforces|competitive-programming|algorithms|data-structures|interview-prep|problems|solutions)\b/i,
];

// Academic / Assignment patterns
const ACADEMIC_PATTERNS = [
  /\b(assignment|homework|lab|semester|coursework|cs\d{3}|ece\d{3}|college|university|exam)\b/i,
];

export function classifyRepository(repo: GitHubRepo, resumeProjectNames: string[] = []): ClassifiedRepository {
  const signals: string[] = [];
  const nameLower = repo.name.toLowerCase();
  const descLower = (repo.description || '').toLowerCase();
  const readmeLower = (repo.readmeContent || '').toLowerCase();

  const fileCount = repo.fileTree?.length || 0;
  const commitCount = repo.commitCount || 0;
  const stars = repo.stars || 0;
  const daysSinceLastCommit = repo.lastCommitAt
    ? Math.floor((Date.now() - new Date(repo.lastCommitAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  let classification: RepoClassification = 'SUPPORTING PROJECT';
  let confidence = 0.7;

  // 1. Check for Tutorial / Clone
  const isTutorialSignal =
    TUTORIAL_PATTERNS.some(p => p.test(nameLower) || p.test(descLower)) ||
    (readmeLower.includes('clone of') || readmeLower.includes('built following a tutorial') || readmeLower.includes('coded along with'));

  // 2. Check for Practice / DSA / LeetCode
  const isPracticeSignal =
    PRACTICE_PATTERNS.some(p => p.test(nameLower) || p.test(descLower) || p.test(readmeLower));

  // 3. Check for Academic / Assignment
  const isAcademicSignal =
    ACADEMIC_PATTERNS.some(p => p.test(nameLower) || p.test(descLower));

  // 4. Check for Outdated / Inactive
  const isOutdated = daysSinceLastCommit > 730; // 2+ years
  const isInactive = daysSinceLastCommit > 365 && daysSinceLastCommit <= 730; // 1-2 years

  // 5. Check for Unfinished / Needs Review
  const hasTodoMarker = readmeLower.includes('todo') || (repo.fileTree || []).some(f => f.toLowerCase().includes('todo'));
  const isSparse = fileCount < 5 && commitCount < 5;
  const isUnfinished = !repo.hasReadme && (isSparse || commitCount < 4);

  // 6. Check for Strong Project
  const isSubstantial =
    fileCount >= 15 &&
    commitCount >= 20 &&
    repo.hasReadme &&
    (repo.hasTests || repo.hasDockerfile || repo.hasCi || (repo.languages && Object.keys(repo.languages).length >= 2));

  // Match with resume projects
  let matchedResumeProject: string | undefined;
  for (const pName of resumeProjectNames) {
    const cleanP = pName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanR = repo.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanP && cleanR && (cleanR.includes(cleanP) || cleanP.includes(cleanR))) {
      matchedResumeProject = pName;
      signals.push(`Matches resume project "${pName}"`);
      break;
    }
  }

  // Determine Classification Hierarchy
  if (isPracticeSignal) {
    classification = 'PRACTICE / LEARNING';
    signals.push('Algorithmic problem-solving / DSA repository structure');
    confidence = 0.85;
  } else if (isTutorialSignal) {
    classification = 'TUTORIAL / CLONE';
    signals.push('Naming or documentation reflects common tutorial or starter template patterns');
    confidence = 0.8;
  } else if (isAcademicSignal) {
    classification = 'ASSIGNMENT / ACADEMIC';
    signals.push('Coursework or academic lab assignment naming markers');
    confidence = 0.8;
  } else if (isSubstantial || (matchedResumeProject && commitCount >= 15 && repo.hasReadme)) {
    classification = 'STRONG PROJECT';
    signals.push(`Substantial architecture: ${fileCount} files, ${commitCount} commits`);
    if (repo.hasReadme) signals.push('Includes structured documentation');
    if (repo.hasTests) signals.push('Automated test suite configured');
    if (repo.hasDockerfile) signals.push('Docker / containerization present');
    if (repo.hasCi) signals.push('CI/CD pipeline configuration detected');
    confidence = 0.9;
  } else if (isUnfinished || isSparse) {
    classification = 'UNFINISHED / NEEDS REVIEW';
    signals.push('Repository has minimal commit activity or missing documentation');
    if (hasTodoMarker) signals.push('Contains explicit unresolved TODO markers');
    confidence = 0.75;
  } else if (isOutdated) {
    classification = 'OUTDATED';
    signals.push(`Last updated over 2 years ago (${Math.round(daysSinceLastCommit / 365)} years inactive)`);
    confidence = 0.85;
  } else if (isInactive) {
    classification = 'INACTIVE';
    signals.push(`No commit activity within the past year (${Math.round(daysSinceLastCommit / 30)} months)`);
    confidence = 0.75;
  } else {
    classification = 'SUPPORTING PROJECT';
    signals.push('Functional supporting repository with moderate scope');
    confidence = 0.7;
  }

  // Recruiter notes
  let recruiterNotes = '';
  switch (classification) {
    case 'STRONG PROJECT':
      recruiterNotes = 'Shows genuine architectural depth, active iteration, and clear engineering initiative.';
      break;
    case 'SUPPORTING PROJECT':
      recruiterNotes = 'Provides secondary proof of technical familiarity without being a flagship showcase.';
      break;
    case 'PRACTICE / LEARNING':
      recruiterNotes = 'Demonstrates personal curiosity and problem-solving practice; keep visible alongside portfolio projects.';
      break;
    case 'ASSIGNMENT / ACADEMIC':
      recruiterNotes = 'Appears tied to curriculum; consider archiving or grouping if older than recent portfolio work.';
      break;
    case 'TUTORIAL / CLONE':
      recruiterNotes = 'Signals commonly associated with tutorial walkthroughs; recruiters favor unique product features over standard tutorials.';
      break;
    case 'OUTDATED':
      recruiterNotes = 'Legacy code that may reflect dated patterns or unmaintained dependencies.';
      break;
    case 'INACTIVE':
      recruiterNotes = 'Project hasn’t seen recent updates; be prepared to articulate what you would refactor today.';
      break;
    case 'UNFINISHED / NEEDS REVIEW':
      recruiterNotes = 'Low commit density and sparse structure can create an impression of unfinished side projects.';
      break;
    default:
      recruiterNotes = 'General public project.';
  }

  return {
    name: repo.name,
    fullName: repo.fullName,
    description: repo.description,
    language: repo.language,
    stars,
    forks: repo.forks || 0,
    commitCount,
    lastCommitAt: repo.lastCommitAt,
    hasReadme: repo.hasReadme,
    hasTests: repo.hasTests,
    hasDockerfile: repo.hasDockerfile,
    hasCi: repo.hasCi,
    classification,
    confidence,
    signals,
    recruiterNotes,
    matchedResumeProject,
  };
}

export function performRecruiterAudit(
  repos: GitHubRepo[],
  parsedResume?: ParsedResume | null,
  targetRole?: string
): RecruiterProfileAudit {
  const resumeProjects = parsedResume?.projects || [];
  const resumeProjectNames = resumeProjects.map(p => p.name);

  // 1. Classify all repositories
  const classifiedRepos = repos.map(r => classifyRepository(r, resumeProjectNames));

  // Count summaries
  let strongCount = 0;
  let supportingCount = 0;
  let practiceCount = 0;
  let outdatedCount = 0;
  let needsReviewCount = 0;

  classifiedRepos.forEach(r => {
    if (r.classification === 'STRONG PROJECT') strongCount++;
    else if (r.classification === 'SUPPORTING PROJECT') supportingCount++;
    else if (r.classification === 'PRACTICE / LEARNING') practiceCount++;
    else if (r.classification === 'OUTDATED') outdatedCount++;
    else if (r.classification === 'UNFINISHED / NEEDS REVIEW') needsReviewCount++;
  });

  // 2. Resume <-> GitHub Consistency
  const resumeProjectsFound: ResumeGitHubConsistency['resumeProjectsFound'] = [];
  const resumeProjectsMissing: ResumeGitHubConsistency['resumeProjectsMissing'] = [];

  for (const p of resumeProjects) {
    const matched = classifiedRepos.find(r => r.matchedResumeProject === p.name);
    if (matched) {
      resumeProjectsFound.push({
        resumeProject: p.name,
        repoName: matched.name,
        matchStrength: matched.classification === 'STRONG PROJECT' ? 'STRONG' : 'MODERATE',
        evidenceSummary: `${matched.signals.join('; ')} (${matched.commitCount} commits)`,
      });
    } else {
      resumeProjectsMissing.push({
        resumeProject: p.name,
        note: 'No sufficiently strong public repository match was found. (May be in a private repo or under an alternate repository name).',
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
          : 'Supporting or practice code that recruiters may skim as secondary background.',
      });
    }
  });

  // 3. Potential Recruiter Concerns
  const concerns: RecruiterConcern[] = [];

  // Concern: Unmatched resume projects
  if (resumeProjectsMissing.length > 0) {
    concerns.push({
      id: 'missing-resume-project',
      category: 'mismatch',
      severity: 'medium',
      title: `${resumeProjectsMissing.length} resume project(s) lack public repository evidence`,
      observation: `Resume lists: ${resumeProjectsMissing.map(m => `"${m.resumeProject}"`).join(', ')}, but no matching public repository was detected.`,
      risk: 'Recruiters reviewing your GitHub cannot independently verify your implementation depth or role in these projects.',
      recommendation: 'Ensure repositories are public where permitted, or add a link/demo/screencast to your resume or portfolio.',
    });
  }

  // Concern: Unfinished or sparse repositories
  if (needsReviewCount >= 2) {
    concerns.push({
      id: 'unfinished-repos',
      category: 'unfinished_project',
      severity: 'high',
      title: `${needsReviewCount} public repositories appear incomplete or need review`,
      observation: `Found repositories with very low commit activity, missing READMEs, or placeholder structures (${classifiedRepos.filter(r => r.classification === 'UNFINISHED / NEEDS REVIEW').map(r => r.name).join(', ')}).`,
      risk: 'Having abandoned or sparse projects publicly pinned or prominent can distract recruiters from your best work.',
      recommendation: 'Archive inactive repositories, complete their README files, or convert them to private repositories.',
    });
  }

  // Concern: Outdated repositories
  if (outdatedCount >= 2) {
    concerns.push({
      id: 'outdated-repos',
      category: 'hygiene',
      severity: 'low',
      title: `${outdatedCount} repositories have been inactive for over two years`,
      observation: `Projects like ${classifiedRepos.filter(r => r.classification === 'OUTDATED').slice(0, 2).map(r => r.name).join(', ')} have not seen recent commits.`,
      risk: 'May reflect older syntax versions or outdated dependency practices if examined.',
      recommendation: 'Pin your most modern projects to the top of your GitHub profile and add a status note to legacy repositories.',
    });
  }

  // Concern: High-value project missing from resume
  const valuableUnlisted = githubProjectsNotOnResume.filter(p => p.assessment === 'POTENTIALLY VALUABLE');
  if (valuableUnlisted.length > 0) {
    concerns.push({
      id: 'valuable-unlisted',
      category: 'missing_project',
      severity: 'medium',
      title: 'Strong GitHub project is missing from your resume',
      observation: `Repository "${valuableUnlisted[0].repoName}" has substantial architecture and commit history but is not highlighted on your resume.`,
      risk: 'You may be under-representing your technical capabilities on your primary resume document.',
      recommendation: `Evaluate whether "${valuableUnlisted[0].repoName}" is more technically impressive than your weakest listed resume project.`,
    });
  }

  // Concern: Excessive low-signal repositories (profile noise)
  const lowSignalCount = classifiedRepos.filter(r => r.classification === 'PRACTICE / LEARNING' || r.classification === 'TUTORIAL / CLONE').length;
  if (lowSignalCount > 6 && strongCount <= 2) {
    concerns.push({
      id: 'profile-noise',
      category: 'profile_noise',
      severity: 'medium',
      title: 'Profile noise may dilute your primary engineering projects',
      observation: `Profile has ${lowSignalCount} practice, tutorial, or clone repositories relative to ${strongCount} substantial project(s).`,
      risk: 'Recruiters spend 30-60 seconds scanning a profile and might click tutorial code instead of your best engineering work.',
      recommendation: 'Use GitHub pinned repositories to strictly feature your top 3-4 substantial projects.',
    });
  }

  // 4. Recruiter Strengths
  const strengths: RecruiterStrength[] = [];
  if (strongCount >= 2) {
    strengths.push({
      title: `${strongCount} substantial engineering repositories`,
      detail: 'Demonstrates ability to see multi-file, architecture-level applications through beyond simple snippets.',
      evidence: classifiedRepos.filter(r => r.classification === 'STRONG PROJECT').map(r => r.name).join(', '),
    });
  }
  if (resumeProjectsFound.length > 0) {
    strengths.push({
      title: 'Resume claims directly verified by code',
      detail: 'Public repositories corroborate project names, tech stack choices, and commit consistency.',
      evidence: resumeProjectsFound.map(m => `${m.resumeProject} → ${m.repoName}`).join(', '),
    });
  }
  const hasTestsOrCi = classifiedRepos.filter(r => r.hasTests || r.hasCi);
  if (hasTestsOrCi.length > 0) {
    strengths.push({
      title: 'Professional engineering standards (CI/Tests)',
      detail: 'Evidence of automated testing or CI/CD pipelines detected in public projects.',
      evidence: hasTestsOrCi.map(r => r.name).join(', '),
    });
  }

  // 5. Questions candidate should prepare for
  const preparedQuestions: PreparedQuestion[] = [];

  // Question on strongest project
  const topProject = classifiedRepos.find(r => r.classification === 'STRONG PROJECT') || classifiedRepos[0];
  if (topProject) {
    preparedQuestions.push({
      question: `What was the most challenging technical architectural decision in "${topProject.name}"?`,
      context: `Your repository "${topProject.name}" is one of your most prominent public projects.`,
      reason: 'Recruiters and engineers love to probe deep on your primary repository to see if you can explain tradeoffs.',
      suggestedFocus: 'Explain the folder structure, data flow, API bottlenecks, and why you chose this stack.',
    });
  }

  // Question on missing resume projects
  if (resumeProjectsMissing.length > 0) {
    preparedQuestions.push({
      question: `Can you walk me through your implementation in "${resumeProjectsMissing[0].resumeProject}"?`,
      context: `Listed on your resume, but no public GitHub repository was detected.`,
      reason: 'Interviewers often hone in on unverified projects to check authenticity.',
      suggestedFocus: 'Be prepared with architectural diagrams, technical challenges solved, or a live demo.',
    });
  }

  // Question on inactive/old repository
  const inactiveRepo = classifiedRepos.find(r => r.classification === 'OUTDATED' || r.classification === 'INACTIVE');
  if (inactiveRepo) {
    preparedQuestions.push({
      question: `If you were to refactor "${inactiveRepo.name}" today, what architectural choices would you change?`,
      context: `Last commit was ${inactiveRepo.lastCommitAt ? new Date(inactiveRepo.lastCommitAt).getFullYear() : 'several years ago'}.`,
      reason: 'Shows whether your engineering standards have matured since the repository was written.',
      suggestedFocus: 'Discuss modern typing, testing, security practices, and bundle optimization.',
    });
  }

  // 6. GitHub Profile Readiness Score
  // Calculation:
  // - projectQuality (0-100): strong / total ratio
  // - documentation (0-100): readme ratio in non-practice repos
  // - activityRecency (0-100): recent commits in past 12 months
  // - resumeConsistency (0-100): resume projects matched
  // - profileHygiene (0-100): low unfinished/noise penalty
  const totalRepos = Math.max(classifiedRepos.length, 1);

  const projectQuality = Math.min(100, Math.round((strongCount * 30 + supportingCount * 15) / Math.max(strongCount + supportingCount, 1) * 3.3));
  const reposWithReadme = classifiedRepos.filter(r => r.hasReadme).length;
  const documentation = Math.min(100, Math.round((reposWithReadme / totalRepos) * 100));

  const recentRepos = classifiedRepos.filter(r => {
    if (!r.lastCommitAt) return false;
    const days = (Date.now() - new Date(r.lastCommitAt).getTime()) / (1000 * 60 * 60 * 24);
    return days <= 365;
  }).length;
  const activityRecency = Math.min(100, Math.round((recentRepos / totalRepos) * 100));

  const matchedCount = resumeProjectsFound.length;
  const totalResumeProj = Math.max(resumeProjects.length, 1);
  const resumeConsistency = Math.min(100, Math.round((matchedCount / totalResumeProj) * 100));

  const hygienePenalty = (needsReviewCount * 12) + (lowSignalCount > 5 ? 10 : 0);
  const profileHygiene = Math.max(20, Math.min(100, 100 - hygienePenalty));

  // Weighted Profile Readiness
  const readinessScore = Math.round(
    projectQuality * 0.30 +
    documentation * 0.20 +
    activityRecency * 0.15 +
    resumeConsistency * 0.20 +
    profileHygiene * 0.15
  );

  const breakdown: string[] = [
    `Project Quality (${projectQuality}/100): ${strongCount} substantial, ${supportingCount} supporting project(s)`,
    `Documentation (${documentation}/100): ${reposWithReadme}/${totalRepos} public repositories contain README files`,
    `Activity Recency (${activityRecency}/100): ${recentRepos}/${totalRepos} repositories updated within past 12 months`,
    `Resume Consistency (${resumeConsistency}/100): ${matchedCount}/${totalResumeProj} resume projects verified on GitHub`,
    `Profile Hygiene (${profileHygiene}/100): ${needsReviewCount} unfinished, ${lowSignalCount} practice/tutorial repositories`,
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
    },
  };
}
