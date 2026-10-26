import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, boolean, real, pgEnum } from 'drizzle-orm/pg-core';

// Enums
export const evidenceStatusEnum = pgEnum('evidence_status', [
  'verified', 'supported', 'weakly_supported', 'unverified', 'unknown'
]);

export const priorityEnum = pgEnum('priority', [
  'critical', 'high', 'medium', 'low'
]);

export const claimTypeEnum = pgEnum('claim_type', [
  'skill', 'experience', 'achievement', 'project', 'technical_depth', 'impact'
]);

export const analysisStatusEnum = pgEnum('analysis_status', [
  'pending', 'parsing_resume', 'extracting_skills', 'analyzing_github',
  'analyzing_evidence', 'matching_claims', 'generating_recommendations',
  'completed', 'failed'
]);

// Tables
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 255 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  targetRole: varchar('target_role', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const resumes = pgTable('resumes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  filePath: varchar('file_path', { length: 500 }).notNull(),
  rawText: text('raw_text'),
  parsedData: jsonb('parsed_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const resumeClaims = pgTable('resume_claims', {
  id: uuid('id').defaultRandom().primaryKey(),
  resumeId: uuid('resume_id').references(() => resumes.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  claim: text('claim').notNull(),
  claimType: claimTypeEnum('claim_type').notNull(),
  category: varchar('category', { length: 100 }),
  proficiencyLevel: varchar('proficiency_level', { length: 50 }),
  source: varchar('source', { length: 100 }).notNull(),
  context: text('context'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const githubAccounts = pgTable('github_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  username: varchar('username', { length: 255 }).notNull(),
  accessToken: varchar('access_token', { length: 500 }),
  profileData: jsonb('profile_data'),
  lastSyncedAt: timestamp('last_synced_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const repositories = pgTable('repositories', {
  id: uuid('id').defaultRandom().primaryKey(),
  githubAccountId: uuid('github_account_id').references(() => githubAccounts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  fullName: varchar('full_name', { length: 500 }),
  description: text('description'),
  language: varchar('language', { length: 100 }),
  languages: jsonb('languages'),
  stars: integer('stars').default(0),
  forks: integer('forks').default(0),
  topics: jsonb('topics'),
  hasReadme: boolean('has_readme').default(false),
  readmeContent: text('readme_content'),
  hasDockerfile: boolean('has_dockerfile').default(false),
  hasCi: boolean('has_ci').default(false),
  hasTests: boolean('has_tests').default(false),
  packageJson: jsonb('package_json'),
  requirementsTxt: text('requirements_txt'),
  fileTree: jsonb('file_tree'),
  complexity: varchar('complexity', { length: 50 }),
  analysisId: uuid('analysis_id').references(() => analyses.id, { onDelete: 'cascade' }),
  lastCommitAt: timestamp('last_commit_at'),
  commitCount: integer('commit_count'),
  analyzedData: jsonb('analyzed_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const repositoryEvidence = pgTable('repository_evidence', {
  id: uuid('id').defaultRandom().primaryKey(),
  repositoryId: uuid('repository_id').references(() => repositories.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  skill: varchar('skill', { length: 255 }).notNull(),
  evidenceType: varchar('evidence_type', { length: 100 }).notNull(),
  source: varchar('source', { length: 255 }).notNull(),
  detail: text('detail').notNull(),
  confidence: real('confidence').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const jobDescriptions = pgTable('job_descriptions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 255 }),
  company: varchar('company', { length: 255 }),
  rawText: text('raw_text').notNull(),
  parsedData: jsonb('parsed_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const jobRequirements = pgTable('job_requirements', {
  id: uuid('id').defaultRandom().primaryKey(),
  jobDescriptionId: uuid('job_description_id').references(() => jobDescriptions.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  requirement: varchar('requirement', { length: 255 }).notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  importance: varchar('importance', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const analyses = pgTable('analyses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  resumeId: uuid('resume_id').references(() => resumes.id),
  githubAccountId: uuid('github_account_id').references(() => githubAccounts.id),
  jobDescriptionId: uuid('job_description_id').references(() => jobDescriptions.id),
  targetRole: varchar('target_role', { length: 255 }),
  githubUsername: varchar('github_username', { length: 255 }),
  resumeTextSnapshot: text('resume_text_snapshot'),
  jobDescriptionTextSnapshot: text('job_description_text_snapshot'),
  repositoriesSnapshot: jsonb('repositories_snapshot'),
  parentAnalysisId: uuid('parent_analysis_id'),
  deltaFromPrevious: jsonb('delta_from_previous'),
  status: analysisStatusEnum('status').default('pending').notNull(),
  progress: integer('progress').default(0),
  progressMessage: varchar('progress_message', { length: 500 }),
  overallScore: real('overall_score'),
  dimensions: jsonb('dimensions'),
  summary: text('summary'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const analysisFindings = pgTable('analysis_findings', {
  id: uuid('id').defaultRandom().primaryKey(),
  analysisId: uuid('analysis_id').references(() => analyses.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  skill: varchar('skill', { length: 255 }).notNull(),
  resumeClaim: text('resume_claim'),
  claimLevel: varchar('claim_level', { length: 50 }),
  evidenceStatus: evidenceStatusEnum('evidence_status').notNull(),
  evidenceSources: jsonb('evidence_sources'),
  assessment: text('assessment'),
  confidence: real('confidence'),
  priority: priorityEnum('priority'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const recommendations = pgTable('recommendations', {
  id: uuid('id').defaultRandom().primaryKey(),
  analysisId: uuid('analysis_id').references(() => analyses.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  observation: text('observation').notNull(),
  evidence: jsonb('evidence'),
  problem: text('problem').notNull(),
  hiringImpact: text('hiring_impact'),
  recommendation: text('recommendation').notNull(),
  priority: priorityEnum('priority').notNull(),
  confidence: real('confidence'),
  actionType: varchar('action_type', { length: 50 }),
  targetProject: varchar('target_project', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const actionItems = pgTable('action_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  analysisId: uuid('analysis_id').references(() => analyses.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  day: varchar('day', { length: 20 }).notNull(),
  title: varchar('title', { length: 500 }).notNull(),
  description: text('description').notNull(),
  completed: boolean('completed').default(false),
  priority: priorityEnum('priority'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const progressSnapshots = pgTable('progress_snapshots', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  analysisId: uuid('analysis_id').references(() => analyses.id, { onDelete: 'cascade' }).notNull(),
  overallScore: real('overall_score'),
  dimensions: jsonb('dimensions'),
  claimConsistency: real('claim_consistency'),
  verifiedSkills: integer('verified_skills'),
  unverifiedSkills: integer('unverified_skills'),
  totalSkills: integer('total_skills'),
  snapshotDate: timestamp('snapshot_date').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
