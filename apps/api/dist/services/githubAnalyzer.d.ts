export interface GitHubProfile {
    login: string;
    name: string | null;
    bio: string | null;
    publicRepos: number;
    followers: number;
    following: number;
    avatarUrl: string;
    htmlUrl: string;
}
export type DataQuality = 'COMPLETE' | 'PARTIAL' | 'LIMITED' | 'FAILED';
export interface GitHubRepo {
    name: string;
    fullName: string;
    description: string | null;
    language: string | null;
    languages: Record<string, number>;
    stars: number;
    forks: number;
    topics: string[];
    hasReadme: boolean;
    readmeContent: string | null;
    hasDockerfile: boolean;
    hasCi: boolean;
    hasTests: boolean;
    packageJson: any | null;
    requirementsTxt: string | null;
    fileTree: string[];
    lastCommitAt: string | null;
    commitCount: number;
    htmlUrl: string;
    isFork?: boolean;
    parentRepo?: string | null;
    incompleteEvidence?: boolean;
    scanError?: string;
}
export interface GitHubScanResult {
    repos: GitHubRepo[];
    totalPublicRepos: number;
    scannedCount: number;
    failedCount: number;
    dataQuality: DataQuality;
    statusMessage?: string;
}
export interface RepoEvidence {
    skill: string;
    evidenceType: string;
    source: string;
    detail: string;
    confidence: number;
    metadata?: Record<string, any>;
}
export declare function normalizeGitHubInput(input: string): string;
export declare function fetchGitHubProfile(username: string): Promise<GitHubProfile>;
export declare function scanGitHubAccountWithQuality(username: string): Promise<GitHubScanResult>;
export declare function fetchRepositories(username: string): Promise<GitHubRepo[]>;
export declare function scrapePublicRepositories(username: string): Promise<GitHubRepo[]>;
export declare function extractEvidenceFromRepos(repos: GitHubRepo[]): RepoEvidence[];
//# sourceMappingURL=githubAnalyzer.d.ts.map