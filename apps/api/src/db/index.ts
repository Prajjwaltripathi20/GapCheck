import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import path from 'path';
import fs from 'fs';
import * as schema from './schema';

const { Pool } = pg;

const DATA_DIR = path.resolve(__dirname, '../../.data');
const PGLITE_DIR = path.join(DATA_DIR, 'gapcheck_pg');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const ENUMS_TO_ENSURE: Array<{ name: string; values: string[] }> = [
  {
    name: 'analysis_status',
    values: ['pending', 'parsing_resume', 'extracting_skills', 'analyzing_github', 'analyzing_evidence', 'matching_claims', 'generating_recommendations', 'completed', 'failed']
  },
  {
    name: 'claim_type',
    values: ['skill', 'experience', 'achievement', 'project', 'technical_depth', 'impact']
  },
  {
    name: 'evidence_status',
    values: ['verified', 'supported', 'weakly_supported', 'unverified', 'unknown']
  },
  {
    name: 'priority',
    values: ['critical', 'high', 'medium', 'low']
  }
];

// Migration statements to ensure all tables exist
const MIGRATION_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "users" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "email" varchar(255) UNIQUE NOT NULL,
    "password_hash" varchar(255) NOT NULL,
    "name" varchar(255),
    "avatar_url" varchar(500),
    "target_role" varchar(255),
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "resumes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "filename" varchar(255) NOT NULL,
    "file_path" varchar(500) NOT NULL,
    "raw_text" text,
    "parsed_data" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "resume_claims" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "resume_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "claim" text NOT NULL,
    "claim_type" "claim_type" NOT NULL,
    "category" varchar(100),
    "proficiency_level" varchar(50),
    "source" varchar(100) NOT NULL,
    "context" text,
    "created_at" timestamp DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "github_accounts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "username" varchar(255) NOT NULL,
    "access_token" varchar(500),
    "profile_data" jsonb,
    "last_synced_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "repositories" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "github_account_id" uuid NOT NULL,
    "name" varchar(255) NOT NULL,
    "full_name" varchar(255) NOT NULL,
    "description" text,
    "language" varchar(100),
    "languages" jsonb,
    "stars" integer DEFAULT 0,
    "forks" integer DEFAULT 0,
    "topics" jsonb,
    "has_readme" boolean DEFAULT false,
    "readme_content" text,
    "has_dockerfile" boolean DEFAULT false,
    "has_ci" boolean DEFAULT false,
    "has_tests" boolean DEFAULT false,
    "package_json" jsonb,
    "requirements_txt" text,
    "file_tree" jsonb,
    "last_commit_at" timestamp,
    "commit_count" integer DEFAULT 0,
    "html_url" varchar(500) NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "repository_evidence" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "repository_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "skill" varchar(255) NOT NULL,
    "evidence_type" varchar(100) NOT NULL,
    "source" varchar(255) NOT NULL,
    "detail" text NOT NULL,
    "confidence" real NOT NULL,
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "job_descriptions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "title" varchar(255),
    "company" varchar(255),
    "raw_text" text NOT NULL,
    "parsed_data" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "job_requirements" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "job_description_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "requirement" varchar(255) NOT NULL,
    "category" varchar(100) NOT NULL,
    "importance" varchar(50) DEFAULT 'required' NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "analyses" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "resume_id" uuid,
    "github_account_id" uuid,
    "job_description_id" uuid,
    "target_role" varchar(255),
    "status" "analysis_status" DEFAULT 'pending' NOT NULL,
    "progress" integer DEFAULT 0,
    "progress_message" varchar(500),
    "overall_score" real,
    "dimensions" jsonb,
    "summary" text,
    "completed_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "analysis_findings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "analysis_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "skill" varchar(255) NOT NULL,
    "resume_claim" text,
    "claim_level" varchar(50),
    "evidence_status" "evidence_status" NOT NULL,
    "evidence_sources" jsonb,
    "assessment" text,
    "confidence" real,
    "priority" "priority",
    "created_at" timestamp DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "recommendations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "analysis_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "title" varchar(500) NOT NULL,
    "observation" text NOT NULL,
    "evidence" jsonb,
    "problem" text NOT NULL,
    "hiring_impact" text NOT NULL,
    "recommendation" text NOT NULL,
    "priority" "priority" NOT NULL,
    "confidence" real NOT NULL,
    "action_type" varchar(50) NOT NULL,
    "target_project" varchar(255),
    "created_at" timestamp DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "action_items" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "analysis_id" uuid NOT NULL,
    "user_id" uuid NOT NULL,
    "day" varchar(20) NOT NULL,
    "title" varchar(500) NOT NULL,
    "description" text NOT NULL,
    "completed" boolean DEFAULT false,
    "priority" "priority",
    "created_at" timestamp DEFAULT now() NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS "progress_snapshots" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "user_id" uuid NOT NULL,
    "overall_score" real NOT NULL,
    "dimensions" jsonb NOT NULL,
    "verified_skills_count" integer DEFAULT 0,
    "gap_skills_count" integer DEFAULT 0,
    "created_at" timestamp DEFAULT now() NOT NULL
  );`,
];

// Initialize database instance
let dbInstance: any;
let clientPool: any = null;

async function ensureEnums(pgClient: PGlite) {
  for (const item of ENUMS_TO_ENSURE) {
    try {
      const check = await pgClient.query(`SELECT 1 FROM pg_type WHERE typname = '${item.name}'`);
      if (check.rows.length === 0) {
        const valList = item.values.map(v => `'${v}'`).join(', ');
        await pgClient.query(`CREATE TYPE "${item.name}" AS ENUM (${valList});`);
      }
    } catch (e: any) {
      // non-blocking
    }
  }
}

// Helper to run schema setup on PGlite
async function initPglite(pgClient: PGlite) {
  await ensureEnums(pgClient);

  for (const statement of MIGRATION_STATEMENTS) {
    try {
      await pgClient.exec(statement);
    } catch (err: any) {
      if (!err.message?.includes('already exists')) {
        console.warn('PGlite table init notice:', err.message);
      }
    }
  }

  // Ensure any missing columns exist on repositories and progress_snapshots
  const patchQueries = [
    `ALTER TABLE "repositories" ADD COLUMN IF NOT EXISTS "complexity" varchar(50);`,
    `ALTER TABLE "repositories" ADD COLUMN IF NOT EXISTS "analyzed_data" jsonb;`,
    `ALTER TABLE "progress_snapshots" ADD COLUMN IF NOT EXISTS "analysis_id" uuid;`,
    `ALTER TABLE "progress_snapshots" ADD COLUMN IF NOT EXISTS "claim_consistency" real;`,
    `ALTER TABLE "progress_snapshots" ADD COLUMN IF NOT EXISTS "verified_skills" integer;`,
    `ALTER TABLE "progress_snapshots" ADD COLUMN IF NOT EXISTS "unverified_skills" integer;`,
    `ALTER TABLE "progress_snapshots" ADD COLUMN IF NOT EXISTS "total_skills" integer;`,
    `ALTER TABLE "progress_snapshots" ADD COLUMN IF NOT EXISTS "snapshot_date" timestamp DEFAULT now();`,
  ];
  for (const patch of patchQueries) {
    try {
      await pgClient.exec(patch);
    } catch {
      // non-blocking
    }
  }
}

function cleanStalePostmasterPid(dir: string) {
  try {
    const pidFile = path.join(dir, 'postmaster.pid');
    if (fs.existsSync(pidFile)) {
      fs.unlinkSync(pidFile);
    }
  } catch {
    // non-blocking
  }
}

function getSafePgliteClient(dir: string): PGlite {
  cleanStalePostmasterPid(dir);
  try {
    return new PGlite(dir);
  } catch (err) {
    console.warn('⚠️ Resetting local database directory due to initial lock/corruption:', err);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
    return new PGlite(dir);
  }
}

// Determine adapter to use
const databaseUrl = process.env.DATABASE_URL;
const useRemotePostgres = Boolean(databaseUrl && !databaseUrl.includes('localhost:5432'));

if (useRemotePostgres && databaseUrl) {
  try {
    clientPool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 2000 });
    dbInstance = drizzlePg(clientPool, { schema });
    console.log('✅ Connected to external PostgreSQL database via node-postgres');
  } catch (err) {
    console.warn('⚠️ External PostgreSQL connection failed, falling back to local persistent PGlite');
    const pgliteClient = getSafePgliteClient(PGLITE_DIR);
    dbInstance = drizzlePglite(pgliteClient, { schema });
    initPglite(pgliteClient).catch(e => console.error('PGlite init error:', e));
  }
} else {
  console.log('📦 Using persistent local PostgreSQL storage (PGlite engine) at', PGLITE_DIR);
  const pgliteClient = getSafePgliteClient(PGLITE_DIR);
  dbInstance = drizzlePglite(pgliteClient, { schema });
  initPglite(pgliteClient).then(() => {
    console.log('✅ Local PostgreSQL tables and schemas initialized successfully');
  }).catch(e => console.error('PGlite init error:', e));
}

export const db = dbInstance;
export { clientPool as pool };
