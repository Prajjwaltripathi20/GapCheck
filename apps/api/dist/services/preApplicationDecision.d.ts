import { ClaimEvidenceMatch } from './evidenceEngine';
import { RecruiterProfileAudit } from './recruiterAudit';
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
export type DataQuality = 'COMPLETE' | 'PARTIAL' | 'LIMITED' | 'FAILED';
export interface SourceCoverage {
    resume: DataQuality;
    github: {
        quality: DataQuality;
        totalPublicRepos: number;
        scannedCount: number;
        failedCount: number;
        message?: string;
    };
    targetJob: DataQuality;
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
    confidenceDisclaimer?: string;
    sourceCoverage: SourceCoverage;
}
interface GenerateDecisionParams {
    findings: ClaimEvidenceMatch[];
    recruiterAudit: RecruiterProfileAudit;
    repos: GitHubRepo[];
    parsedResume?: ParsedResume | null;
    targetRole?: string;
    jobRequirements?: string[];
    sourceCoverage?: Partial<SourceCoverage>;
}
export declare function generatePreApplicationDecision(params: GenerateDecisionParams): PreApplicationDecision;
export declare function generateActionPlanFromDecision(decision: PreApplicationDecision, findings: ClaimEvidenceMatch[]): Array<{
    day: string;
    title: string;
    description: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
}>;
export {};
//# sourceMappingURL=preApplicationDecision.d.ts.map