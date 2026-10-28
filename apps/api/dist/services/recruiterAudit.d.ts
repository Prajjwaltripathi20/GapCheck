import { GitHubRepo } from './githubAnalyzer';
import { ParsedResume } from './resumeParser';
export type RepoClassification = 'STRONG PROJECT' | 'SUPPORTING PROJECT' | 'PRACTICE / LEARNING' | 'ASSIGNMENT / ACADEMIC' | 'POTENTIAL TUTORIAL / CLONE' | 'TUTORIAL / CLONE' | 'UTILITY / TOOL' | 'OUTDATED' | 'INACTIVE' | 'UNFINISHED / NEEDS REVIEW' | 'FORK / CONTRIBUTION' | 'FORK / DUPLICATE' | 'UNKNOWN';
export type PresentationPriority = 'FLAGSHIP' | 'SUPPORTING' | 'LOW PRIORITY' | 'NEEDS REVIEW' | 'ARCHIVED';
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
    risk: string;
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
    score: number;
    dimensions: {
        projectQuality: number;
        documentation: number;
        activityRecency: number;
        resumeConsistency: number;
        profileHygiene: number;
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
export declare function matchProjectToRepo(project: {
    name: string;
    technologies: string[];
    description: string;
}, repo: GitHubRepo): {
    strength: MatchConfidence;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    score: number;
    reasons: string[];
};
export declare function classifyRepository(repo: GitHubRepo, resumeProjects?: Array<{
    name: string;
    technologies: string[];
    description: string;
}>, targetRole?: string): ClassifiedRepository;
export declare function performRecruiterAudit(repos: GitHubRepo[], parsedResume?: ParsedResume | null, targetRole?: string): RecruiterProfileAudit;
//# sourceMappingURL=recruiterAudit.d.ts.map