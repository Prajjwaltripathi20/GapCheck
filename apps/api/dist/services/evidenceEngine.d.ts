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
    githubProfile?: number;
}
export interface AnalysisResult {
    findings: ClaimEvidenceMatch[];
    recommendations: Recommendation[];
    dimensions: ScoringDimensions;
    overallScore: number;
    summary: string;
}
export declare function matchClaimsToEvidence(claims: ResumeClaim[], evidence: RepoEvidence[], jobRequirements?: string[]): ClaimEvidenceMatch[];
export declare function generateRecommendations(findings: ClaimEvidenceMatch[], repos: GitHubRepo[]): Recommendation[];
export declare function calculateDimensions(findings: ClaimEvidenceMatch[], repos: GitHubRepo[], jobRequirements: string[], githubProfileScore?: number): ScoringDimensions;
export declare function calculateOverallScore(dimensions: ScoringDimensions): number;
export declare function generateActionPlan(recommendations: Recommendation[], findings: ClaimEvidenceMatch[]): Array<{
    day: string;
    title: string;
    description: string;
    priority: Priority;
}>;
//# sourceMappingURL=evidenceEngine.d.ts.map