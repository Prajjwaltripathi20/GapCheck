import { Response } from 'express';
import { PreApplicationDecision } from './preApplicationDecision';
interface ReportData {
    candidateName: string;
    candidateEmail?: string;
    targetRole: string;
    analysisDate: string;
    overallScore: number;
    preApplicationDecision?: PreApplicationDecision;
    dimensions: {
        resumeQuality: number;
        engineeringEvidence: number;
        roleAlignment: number;
        claimConsistency: number;
        projectDepth?: number;
        technicalEvidence?: number;
    };
    summary: string;
    findings: Array<{
        skill: string;
        resumeClaim?: string | null;
        evidenceStatus: string;
        priority?: string;
        assessment?: string;
        evidenceSources?: Array<{
            source: string;
            repository?: string;
            file?: string;
            evidence: string;
        }>;
    }>;
    jobRequirements?: {
        required: string[];
        preferred: string[];
    };
    recommendations: Array<{
        title: string;
        problem: string;
        hiringImpact?: string;
        recommendation: string;
        priority: string;
        targetProject?: string;
    }>;
    actionPlan: Array<{
        day: string;
        title: string;
        description: string;
        priority?: string;
        completed?: boolean;
    }>;
    rawResumeText?: string;
    recruiterAudit?: {
        summary?: {
            totalPublicRepos: number;
            strongProjectsCount: number;
            supportingCount: number;
            practiceCount: number;
            outdatedCount: number;
            needsReviewCount: number;
        };
        repositories?: Array<{
            name: string;
            classification: string;
            presentationPriority?: string;
            roleRelevance?: string;
            confidence?: string;
            signals: string[];
            recruiterNotes: string;
            commitCount: number;
        }>;
        concerns?: Array<{
            id?: string;
            canonicalId?: string;
            title: string;
            observation: string;
            signal?: string;
            reasoning?: string;
            evidence?: string;
            risk: string;
            recommendation: string;
            severity: string;
            confidence?: string;
        }>;
        strengths?: Array<{
            title: string;
            detail: string;
            evidence: string;
            confidence?: string;
        }>;
        preparedQuestions?: Array<{
            question: string;
            context: string;
            reason: string;
            suggestedFocus: string;
        }>;
        consistency?: {
            resumeProjectsFound: Array<{
                resumeProject: string;
                repoName: string;
                matchStrength: string;
                matchConfidence?: string;
                matchReasons?: string[];
            }>;
            resumeProjectsMissing: Array<{
                resumeProject: string;
                note: string;
                possibleReasons?: string[];
            }>;
            githubProjectsNotOnResume: Array<{
                repoName: string;
                classification: string;
                assessment: string;
            }>;
        };
        readiness?: {
            score: number;
            breakdown?: string[];
            positiveFactors?: string[];
            deductionFactors?: string[];
        };
    };
}
export declare function streamAuditReportPdf(data: ReportData, res: Response): void;
export declare function streamAnnotatedResumePdf(data: ReportData, res: Response): void;
export {};
//# sourceMappingURL=reportGenerator.d.ts.map