"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.progressSnapshots = exports.actionItems = exports.recommendations = exports.analysisFindings = exports.analyses = exports.jobRequirements = exports.jobDescriptions = exports.repositoryEvidence = exports.repositories = exports.githubAccounts = exports.resumeClaims = exports.resumes = exports.users = exports.analysisStatusEnum = exports.claimTypeEnum = exports.priorityEnum = exports.evidenceStatusEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
// Enums
exports.evidenceStatusEnum = (0, pg_core_1.pgEnum)('evidence_status', [
    'verified', 'supported', 'weakly_supported', 'unverified', 'unknown'
]);
exports.priorityEnum = (0, pg_core_1.pgEnum)('priority', [
    'critical', 'high', 'medium', 'low'
]);
exports.claimTypeEnum = (0, pg_core_1.pgEnum)('claim_type', [
    'skill', 'experience', 'achievement', 'project', 'technical_depth', 'impact'
]);
exports.analysisStatusEnum = (0, pg_core_1.pgEnum)('analysis_status', [
    'pending', 'parsing_resume', 'extracting_skills', 'analyzing_github',
    'analyzing_evidence', 'matching_claims', 'generating_recommendations',
    'completed', 'failed'
]);
// Tables
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).unique().notNull(),
    passwordHash: (0, pg_core_1.varchar)('password_hash', { length: 255 }).notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }),
    avatarUrl: (0, pg_core_1.varchar)('avatar_url', { length: 500 }),
    targetRole: (0, pg_core_1.varchar)('target_role', { length: 255 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.resumes = (0, pg_core_1.pgTable)('resumes', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    filename: (0, pg_core_1.varchar)('filename', { length: 255 }).notNull(),
    filePath: (0, pg_core_1.varchar)('file_path', { length: 500 }).notNull(),
    rawText: (0, pg_core_1.text)('raw_text'),
    parsedData: (0, pg_core_1.jsonb)('parsed_data'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.resumeClaims = (0, pg_core_1.pgTable)('resume_claims', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    resumeId: (0, pg_core_1.uuid)('resume_id').references(() => exports.resumes.id, { onDelete: 'cascade' }).notNull(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    claim: (0, pg_core_1.text)('claim').notNull(),
    claimType: (0, exports.claimTypeEnum)('claim_type').notNull(),
    category: (0, pg_core_1.varchar)('category', { length: 100 }),
    proficiencyLevel: (0, pg_core_1.varchar)('proficiency_level', { length: 50 }),
    source: (0, pg_core_1.varchar)('source', { length: 100 }).notNull(),
    context: (0, pg_core_1.text)('context'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.githubAccounts = (0, pg_core_1.pgTable)('github_accounts', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    username: (0, pg_core_1.varchar)('username', { length: 255 }).notNull(),
    accessToken: (0, pg_core_1.varchar)('access_token', { length: 500 }),
    profileData: (0, pg_core_1.jsonb)('profile_data'),
    lastSyncedAt: (0, pg_core_1.timestamp)('last_synced_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.repositories = (0, pg_core_1.pgTable)('repositories', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    githubAccountId: (0, pg_core_1.uuid)('github_account_id').references(() => exports.githubAccounts.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    fullName: (0, pg_core_1.varchar)('full_name', { length: 500 }),
    description: (0, pg_core_1.text)('description'),
    language: (0, pg_core_1.varchar)('language', { length: 100 }),
    languages: (0, pg_core_1.jsonb)('languages'),
    stars: (0, pg_core_1.integer)('stars').default(0),
    forks: (0, pg_core_1.integer)('forks').default(0),
    topics: (0, pg_core_1.jsonb)('topics'),
    hasReadme: (0, pg_core_1.boolean)('has_readme').default(false),
    readmeContent: (0, pg_core_1.text)('readme_content'),
    hasDockerfile: (0, pg_core_1.boolean)('has_dockerfile').default(false),
    hasCi: (0, pg_core_1.boolean)('has_ci').default(false),
    hasTests: (0, pg_core_1.boolean)('has_tests').default(false),
    packageJson: (0, pg_core_1.jsonb)('package_json'),
    requirementsTxt: (0, pg_core_1.text)('requirements_txt'),
    fileTree: (0, pg_core_1.jsonb)('file_tree'),
    complexity: (0, pg_core_1.varchar)('complexity', { length: 50 }),
    analysisId: (0, pg_core_1.uuid)('analysis_id').references(() => exports.analyses.id, { onDelete: 'cascade' }),
    lastCommitAt: (0, pg_core_1.timestamp)('last_commit_at'),
    commitCount: (0, pg_core_1.integer)('commit_count'),
    analyzedData: (0, pg_core_1.jsonb)('analyzed_data'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.repositoryEvidence = (0, pg_core_1.pgTable)('repository_evidence', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    repositoryId: (0, pg_core_1.uuid)('repository_id').references(() => exports.repositories.id, { onDelete: 'cascade' }).notNull(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    skill: (0, pg_core_1.varchar)('skill', { length: 255 }).notNull(),
    evidenceType: (0, pg_core_1.varchar)('evidence_type', { length: 100 }).notNull(),
    source: (0, pg_core_1.varchar)('source', { length: 255 }).notNull(),
    detail: (0, pg_core_1.text)('detail').notNull(),
    confidence: (0, pg_core_1.real)('confidence').notNull(),
    metadata: (0, pg_core_1.jsonb)('metadata'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.jobDescriptions = (0, pg_core_1.pgTable)('job_descriptions', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    title: (0, pg_core_1.varchar)('title', { length: 255 }),
    company: (0, pg_core_1.varchar)('company', { length: 255 }),
    rawText: (0, pg_core_1.text)('raw_text').notNull(),
    parsedData: (0, pg_core_1.jsonb)('parsed_data'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.jobRequirements = (0, pg_core_1.pgTable)('job_requirements', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    jobDescriptionId: (0, pg_core_1.uuid)('job_description_id').references(() => exports.jobDescriptions.id, { onDelete: 'cascade' }).notNull(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    requirement: (0, pg_core_1.varchar)('requirement', { length: 255 }).notNull(),
    category: (0, pg_core_1.varchar)('category', { length: 100 }).notNull(),
    importance: (0, pg_core_1.varchar)('importance', { length: 50 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.analyses = (0, pg_core_1.pgTable)('analyses', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    resumeId: (0, pg_core_1.uuid)('resume_id').references(() => exports.resumes.id),
    githubAccountId: (0, pg_core_1.uuid)('github_account_id').references(() => exports.githubAccounts.id),
    jobDescriptionId: (0, pg_core_1.uuid)('job_description_id').references(() => exports.jobDescriptions.id),
    targetRole: (0, pg_core_1.varchar)('target_role', { length: 255 }),
    company: (0, pg_core_1.varchar)('company', { length: 255 }),
    githubUsername: (0, pg_core_1.varchar)('github_username', { length: 255 }),
    resumeTextSnapshot: (0, pg_core_1.text)('resume_text_snapshot'),
    jobDescriptionTextSnapshot: (0, pg_core_1.text)('job_description_text_snapshot'),
    repositoriesSnapshot: (0, pg_core_1.jsonb)('repositories_snapshot'),
    parentAnalysisId: (0, pg_core_1.uuid)('parent_analysis_id'),
    deltaFromPrevious: (0, pg_core_1.jsonb)('delta_from_previous'),
    status: (0, exports.analysisStatusEnum)('status').default('pending').notNull(),
    progress: (0, pg_core_1.integer)('progress').default(0),
    progressMessage: (0, pg_core_1.varchar)('progress_message', { length: 500 }),
    overallScore: (0, pg_core_1.real)('overall_score'),
    dimensions: (0, pg_core_1.jsonb)('dimensions'),
    summary: (0, pg_core_1.text)('summary'),
    completedAt: (0, pg_core_1.timestamp)('completed_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.analysisFindings = (0, pg_core_1.pgTable)('analysis_findings', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    analysisId: (0, pg_core_1.uuid)('analysis_id').references(() => exports.analyses.id, { onDelete: 'cascade' }).notNull(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    skill: (0, pg_core_1.varchar)('skill', { length: 255 }).notNull(),
    resumeClaim: (0, pg_core_1.text)('resume_claim'),
    claimLevel: (0, pg_core_1.varchar)('claim_level', { length: 50 }),
    evidenceStatus: (0, exports.evidenceStatusEnum)('evidence_status').notNull(),
    evidenceSources: (0, pg_core_1.jsonb)('evidence_sources'),
    assessment: (0, pg_core_1.text)('assessment'),
    confidence: (0, pg_core_1.real)('confidence'),
    priority: (0, exports.priorityEnum)('priority'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.recommendations = (0, pg_core_1.pgTable)('recommendations', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    analysisId: (0, pg_core_1.uuid)('analysis_id').references(() => exports.analyses.id, { onDelete: 'cascade' }).notNull(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    title: (0, pg_core_1.varchar)('title', { length: 500 }).notNull(),
    observation: (0, pg_core_1.text)('observation').notNull(),
    evidence: (0, pg_core_1.jsonb)('evidence'),
    problem: (0, pg_core_1.text)('problem').notNull(),
    hiringImpact: (0, pg_core_1.text)('hiring_impact'),
    recommendation: (0, pg_core_1.text)('recommendation').notNull(),
    priority: (0, exports.priorityEnum)('priority').notNull(),
    confidence: (0, pg_core_1.real)('confidence'),
    actionType: (0, pg_core_1.varchar)('action_type', { length: 50 }),
    targetProject: (0, pg_core_1.varchar)('target_project', { length: 255 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.actionItems = (0, pg_core_1.pgTable)('action_items', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    analysisId: (0, pg_core_1.uuid)('analysis_id').references(() => exports.analyses.id, { onDelete: 'cascade' }).notNull(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    day: (0, pg_core_1.varchar)('day', { length: 20 }).notNull(),
    title: (0, pg_core_1.varchar)('title', { length: 500 }).notNull(),
    description: (0, pg_core_1.text)('description').notNull(),
    completed: (0, pg_core_1.boolean)('completed').default(false),
    priority: (0, exports.priorityEnum)('priority'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
exports.progressSnapshots = (0, pg_core_1.pgTable)('progress_snapshots', {
    id: (0, pg_core_1.uuid)('id').defaultRandom().primaryKey(),
    userId: (0, pg_core_1.uuid)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }).notNull(),
    analysisId: (0, pg_core_1.uuid)('analysis_id').references(() => exports.analyses.id, { onDelete: 'cascade' }).notNull(),
    overallScore: (0, pg_core_1.real)('overall_score'),
    dimensions: (0, pg_core_1.jsonb)('dimensions'),
    claimConsistency: (0, pg_core_1.real)('claim_consistency'),
    verifiedSkills: (0, pg_core_1.integer)('verified_skills'),
    unverifiedSkills: (0, pg_core_1.integer)('unverified_skills'),
    totalSkills: (0, pg_core_1.integer)('total_skills'),
    snapshotDate: (0, pg_core_1.timestamp)('snapshot_date').defaultNow().notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
});
//# sourceMappingURL=schema.js.map