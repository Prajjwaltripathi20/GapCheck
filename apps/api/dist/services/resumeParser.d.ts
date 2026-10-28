export interface ParsedResume {
    personal: {
        name?: string;
        email?: string;
        phone?: string;
        links: string[];
    };
    education: Array<{
        institution?: string;
        degree?: string;
        graduationYear?: string;
        gpa?: string;
    }>;
    skills: {
        languages: string[];
        frameworks: string[];
        databases: string[];
        cloud: string[];
        tools: string[];
        other: string[];
    };
    projects: Array<{
        name: string;
        technologies: string[];
        description: string;
        claims: string[];
        metrics: string[];
        links: string[];
    }>;
    experience: Array<{
        company?: string;
        role?: string;
        duration?: string;
        technologies: string[];
        claims: string[];
        description: string;
    }>;
    achievements: string[];
    certifications: string[];
}
export interface ResumeClaim {
    claim: string;
    claimType: 'skill' | 'experience' | 'achievement' | 'project' | 'technical_depth' | 'impact';
    category: string;
    proficiencyLevel?: string;
    source: string;
    context?: string;
}
export declare function parseResumePDF(filePath: string): Promise<{
    text: string;
    parsed: ParsedResume;
}>;
export declare function parseResumeText(text: string): {
    text: string;
    parsed: ParsedResume;
};
export declare function extractClaims(parsed: ParsedResume): ResumeClaim[];
//# sourceMappingURL=resumeParser.d.ts.map