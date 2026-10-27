# GapCheck — “Find the gaps before recruiters do.”

GapCheck audits technical candidate profiles by comparing resume claims against public code repositories and target job requirements. It provides an explainable, recruiter-perspective evaluation with concrete evidence matching, pre-application recommendations, and dynamic action plans.

---

## Architecture Overview

```text
                    STUDENTS & USERS
                           │
                           ▼
               ┌───────────────────────┐
               │        VERCEL         │
               │  Next.js 16 Frontend  │
               │       apps/web        │
               └───────────┬───────────┘
                           │ HTTPS (CORS protected)
                           ▼
               ┌───────────────────────┐
               │        RENDER         │
               │   Express 5 API       │
               │       apps/api        │
               └───────────┬───────────┘
                           │
               ┌───────────┴───────────┐
               │                       │
               ▼                       ▼
    ┌──────────────────────┐   ┌───────────────┐
    │  Managed PostgreSQL  │   │  GitHub API   │
    │  (Render / Supabase) │   │  Public repos │
    └──────────────────────┘   └───────────────┘
```

---

## Production Deployment Guide

### 1. Backend & Database (Render)

GapCheck includes a `render.yaml` Blueprint to configure both the API web service and Managed PostgreSQL database:

1. Connect your GitHub repository to [Render](https://render.com).
2. Create a new **Blueprint** and select `render.yaml` from the repository root.
3. Render will provision:
   - **`gapcheck-db`**: A Managed PostgreSQL database instance.
   - **`gapcheck-api`**: An Express Web Service pointing to `apps/api`.
4. Configure required environment variables on Render:
   - `JWT_SECRET`: 32+ character random secret string (e.g., generated with `openssl rand -base64 32`).
   - `FRONTEND_URL`: URL of your deployed Vercel frontend (e.g., `https://gapcheck.vercel.app`).
   - `GITHUB_TOKEN`: (Optional) GitHub Personal Access Token to raise public API rate limits.
5. Verify health check:
   ```bash
   curl -s https://<your-render-url>/api/health
   # Returns: {"status":"ok","timestamp":"...","service":"gapcheck-api"}
   ```

### 2. Frontend (Vercel)

1. Import the repository into [Vercel](https://vercel.com).
2. Configure project settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `apps/web`
   - **Build Command**: `next build`
   - **Output Directory**: `.next`
3. Add Environment Variable:
   - `NEXT_PUBLIC_API_URL`: The HTTPS URL of your deployed Render backend (e.g., `https://gapcheck-api.onrender.com`).
4. Deploy the application.

---

## Environment Variables

| Variable | Target | Purpose | Example |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | API | Environment mode | `production` |
| `PORT` | API | Server port (set by host) | `10000` or `3001` |
| `DATABASE_URL` | API | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `JWT_SECRET` | API | Authentication token signing secret | Random 32+ char string |
| `JWT_EXPIRES_IN` | API | Token lifetime | `7d` |
| `FRONTEND_URL` | API | Allowed CORS origin(s) | `https://gapcheck.vercel.app` |
| `GITHUB_TOKEN` | API | GitHub token for higher rate limits | `ghp_...` |
| `MAX_FILE_SIZE_MB` | API | Max PDF resume upload size | `10` |
| `NEXT_PUBLIC_API_URL` | Web | Backend API base URL | `https://gapcheck-api.onrender.com` |

See `.env.example` for a complete template.

---

## Local Development

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

### Getting Started

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/Prajjwaltripathi20/GapCheck.git
   cd GapCheck
   npm install
   ```

2. Run development servers:
   ```bash
   npm run dev
   ```
   - Web application: [http://localhost:3000](http://localhost:3000)
   - API service: [http://localhost:3001](http://localhost:3001)

*Note: In local development, GapCheck automatically uses persistent embedded PostgreSQL (PGlite engine) inside `apps/api/.data/gapcheck_pg` if an external database URL is not provided.*

---

## Testing & Quality Assurance

Run the complete 61-profile test suite:

```bash
# Core Recruiter Audit Engine (28/28 profiles)
npx tsx apps/api/src/tests/recruiterAuditMatrix.test.ts

# Workflow & Security Isolation (11/11 profiles)
npx tsx apps/api/src/tests/workflowAndSecurity.test.ts

# Student Workflow & 4-Step Wizard (12/12 profiles)
npx tsx apps/api/src/tests/studentWorkflow.test.ts

# Production Deployment & Security Matrix (10/10 profiles)
npx tsx apps/api/src/tests/productionSecurity.test.ts
```

Type safety & linting:
```bash
# TypeScript verification (0 errors required)
npx tsc --noEmit -p apps/api/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json

# ESLint verification (0 errors, 0 warnings required)
npm --prefix apps/web run lint
```
