export interface ParsedJobDescription {
    title?: string;
    company?: string;
    required: {
        languages: string[];
        frameworks: string[];
        tools: string[];
        databases: string[];
        cloud: string[];
        csFundamentals: string[];
        experience: string[];
        qualifications: string[];
    };
    preferred: {
        technologies: string[];
        cloud: string[];
        databases: string[];
        testing: string[];
        deployment: string[];
    };
    softSkills: string[];
    allRequirements: string[];
    dataQuality: 'COMPLETE' | 'PARTIAL' | 'LIMITED' | 'FAILED';
    sufficientTechnicalDetail: boolean;
    statusMessage?: string;
}
export declare function parseJobDescription(text: string): ParsedJobDescription;
//# sourceMappingURL=jobParser.d.ts.map