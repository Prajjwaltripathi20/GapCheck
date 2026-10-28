"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = exports.db = void 0;
exports.ensureDbReady = ensureDbReady;
const node_postgres_1 = require("drizzle-orm/node-postgres");
const pglite_1 = require("drizzle-orm/pglite");
const pglite_2 = require("@electric-sql/pglite");
const pg_1 = __importDefault(require("pg"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const schema = __importStar(require("./schema"));
const { Pool } = pg_1.default;
const DATA_DIR = path_1.default.resolve(__dirname, '../../.data');
const PGLITE_DIR = path_1.default.join(DATA_DIR, 'gapcheck_pg');
if (!fs_1.default.existsSync(DATA_DIR)) {
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
}
const ENUMS_TO_ENSURE = [
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
    "github_account_id" uuid,
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
    "html_url" varchar(500),
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
    "company" varchar(255),
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
let dbInstance;
let clientPool = null;
exports.pool = clientPool;
// Helper to ensure all required ENUM types exist in the database
async function ensureEnums(client) {
    for (const item of ENUMS_TO_ENSURE) {
        try {
            const check = await client.query(`SELECT 1 FROM pg_type WHERE typname = '${item.name}'`);
            if (!check.rows || check.rows.length === 0) {
                const valList = item.values.map(v => `'${v}'`).join(', ');
                await client.query(`CREATE TYPE "${item.name}" AS ENUM (${valList});`);
            }
        }
        catch {
            // non-blocking (e.g., if created concurrently)
        }
    }
}
// Non-destructive idempotent schema initialization for both external PostgreSQL and PGlite
async function initDatabaseSchema(client) {
    await ensureEnums(client);
    try {
        const check = await client.query(`SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users';`);
        const tablesExist = parseInt(check.rows?.[0]?.count || '0', 10) > 0;
        if (!tablesExist) {
            for (const statement of MIGRATION_STATEMENTS) {
                try {
                    await client.query(statement);
                }
                catch (err) {
                    if (!err.message?.includes('already exists')) {
                        console.warn('DB table init notice:', err.message);
                    }
                }
            }
        }
    }
    catch (err) {
        console.warn('DB table check notice:', err.message);
    }
    // Ensure any missing columns exist idempotently
    const patchQueries = [
        `ALTER TABLE "repositories" ADD COLUMN IF NOT EXISTS "complexity" varchar(50);`,
        `ALTER TABLE "repositories" ADD COLUMN IF NOT EXISTS "analyzed_data" jsonb;`,
        `ALTER TABLE "repositories" ADD COLUMN IF NOT EXISTS "analysis_id" uuid;`,
        `ALTER TABLE "analyses" ADD COLUMN IF NOT EXISTS "github_username" varchar(255);`,
        `ALTER TABLE "analyses" ADD COLUMN IF NOT EXISTS "company" varchar(255);`,
        `ALTER TABLE "analyses" ADD COLUMN IF NOT EXISTS "resume_text_snapshot" text;`,
        `ALTER TABLE "analyses" ADD COLUMN IF NOT EXISTS "job_description_text_snapshot" text;`,
        `ALTER TABLE "analyses" ADD COLUMN IF NOT EXISTS "repositories_snapshot" jsonb;`,
        `ALTER TABLE "analyses" ADD COLUMN IF NOT EXISTS "parent_analysis_id" uuid;`,
        `ALTER TABLE "analyses" ADD COLUMN IF NOT EXISTS "delta_from_previous" jsonb;`,
        `ALTER TABLE "progress_snapshots" ADD COLUMN IF NOT EXISTS "analysis_id" uuid;`,
        `ALTER TABLE "progress_snapshots" ADD COLUMN IF NOT EXISTS "claim_consistency" real;`,
        `ALTER TABLE "progress_snapshots" ADD COLUMN IF NOT EXISTS "verified_skills" integer;`,
        `ALTER TABLE "progress_snapshots" ADD COLUMN IF NOT EXISTS "unverified_skills" integer;`,
        `ALTER TABLE "progress_snapshots" ADD COLUMN IF NOT EXISTS "total_skills" integer;`,
        `ALTER TABLE "progress_snapshots" ADD COLUMN IF NOT EXISTS "snapshot_date" timestamp DEFAULT now();`,
        `ALTER TABLE "repositories" ALTER COLUMN "github_account_id" DROP NOT NULL;`,
        `ALTER TABLE "repositories" ALTER COLUMN "html_url" DROP NOT NULL;`,
    ];
    for (const patch of patchQueries) {
        try {
            await client.query(patch);
        }
        catch {
            // non-blocking
        }
    }
}
function cleanStalePostmasterPid(dir) {
    try {
        const pidFile = path_1.default.join(dir, 'postmaster.pid');
        if (fs_1.default.existsSync(pidFile)) {
            fs_1.default.unlinkSync(pidFile);
        }
    }
    catch {
        // non-blocking
    }
}
function getSafePgliteClient(dir) {
    cleanStalePostmasterPid(dir);
    try {
        return new pglite_2.PGlite(dir);
    }
    catch (err) {
        console.warn('⚠️ Resetting local database directory due to initial lock/corruption:', err);
        try {
            fs_1.default.rmSync(dir, { recursive: true, force: true });
        }
        catch {
            // ignore
        }
        return new pglite_2.PGlite(dir);
    }
}
// Determine adapter to use
const databaseUrl = process.env.DATABASE_URL;
const isExplicitProduction = process.env.NODE_ENV === 'production';
const useRemotePostgres = Boolean(databaseUrl &&
    !databaseUrl.startsWith('pglite://') &&
    (isExplicitProduction || !databaseUrl.includes('localhost:5432')));
let dbInitPromise = null;
let activePgliteClient = null;
if (useRemotePostgres && databaseUrl) {
    try {
        const isSsl = isExplicitProduction ||
            databaseUrl.includes('render.com') ||
            databaseUrl.includes('neon.tech') ||
            databaseUrl.includes('supabase.co');
        exports.pool = clientPool = new Pool({
            connectionString: databaseUrl,
            connectionTimeoutMillis: 5000,
            ssl: isSsl ? { rejectUnauthorized: false } : undefined,
        });
        dbInstance = (0, node_postgres_1.drizzle)(clientPool, { schema });
        console.log('✅ Connected to external PostgreSQL database via node-postgres');
        dbInitPromise = initDatabaseSchema(clientPool).then(() => {
            console.log('✅ Remote PostgreSQL tables and schemas verified successfully');
        }).catch(err => {
            console.error('Remote PostgreSQL initialization error:', err);
            throw err;
        });
    }
    catch (err) {
        console.warn('⚠️ External PostgreSQL connection failed, falling back to local persistent PGlite:', err);
        const pgliteClient = getSafePgliteClient(PGLITE_DIR);
        activePgliteClient = pgliteClient;
        dbInstance = (0, pglite_1.drizzle)(pgliteClient, { schema });
        dbInitPromise = initDatabaseSchema(pgliteClient);
    }
}
else {
    console.log('📦 Using persistent local PostgreSQL storage (PGlite engine) at', PGLITE_DIR);
    const pgliteClient = globalThis.__pgliteClient || getSafePgliteClient(PGLITE_DIR);
    globalThis.__pgliteClient = pgliteClient;
    activePgliteClient = pgliteClient;
    dbInstance = (0, pglite_1.drizzle)(pgliteClient, { schema });
    if (!globalThis.__pgliteInitPromise) {
        globalThis.__pgliteInitPromise = initDatabaseSchema(pgliteClient).then(() => {
            console.log('✅ Local PostgreSQL tables and schemas initialized successfully');
        }).catch(e => {
            console.error('PGlite init error:', e);
            throw e;
        });
    }
    dbInitPromise = globalThis.__pgliteInitPromise;
}
async function ensureDbReady() {
    if (dbInitPromise) {
        await dbInitPromise;
    }
}
exports.db = dbInstance;
//# sourceMappingURL=index.js.map