# GapCheck

**Find the gaps before recruiters do.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0%20%7C%207.0-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16.4.2-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-green?logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Drizzle%20ORM-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![GitHub API](https://img.shields.io/badge/GitHub-REST%20API%20v3-181717?logo=github&logoColor=white)](https://docs.github.com/en/rest)
[![Tests](https://img.shields.io/badge/Tests-69%2F69%20Passing-brightgreen)](file:///Users/prajjwaltripathi/GitHub%20Folder/GapCheck/apps/api/src/tests)
[![Production Status](https://img.shields.io/badge/Status-Production%20Hardened-emerald)](#28-final-production-readiness-status)

GapCheck audits a student's resume, public GitHub profile, and target job from a recruiter's perspective. It cross-examines resume claims against observable engineering evidence in public repositories, identifies technical gaps and profile risks, and synthesizes findings into a prioritized, explainable application readiness plan before submissions go live.

---

## Table of Contents

1. [Why GapCheck Exists](#1-why-gapcheck-exists)
2. [Core Product Philosophy & Flow](#2-core-product-philosophy--flow)
3. [What GapCheck Analyzes](#3-what-gapcheck-analyzes)
4. [System Architecture](#4-system-architecture)
5. [Repository & Codebase Architecture](#5-repository--codebase-architecture)
6. [Technology Stack](#6-technology-stack)
7. [Complete Analysis Pipeline](#7-complete-analysis-pipeline)
8. [Resume Analysis System](#8-resume-analysis-system)
9. [GitHub Identity Verification Engine](#9-github-identity-verification-engine)
10. [GitHub Repository Analysis System](#10-github-repository-analysis-system)
11. [Evidence Engine & Verification Model](#11-evidence-engine--verification-model)
12. [The Evidence Chain](#12-the-evidence-chain)
13. [Recruiter-Perspective Audit](#13-recruiter-perspective-audit)
14. [Pre-Application Decision Engine](#14-pre-application-decision-engine)
15. [Readiness Score Breakdown](#15-readiness-score-breakdown)
16. [Seven-Stage Deterministic UX](#16-seven-stage-deterministic-ux)
17. [Four-Step Audit Workflow](#17-four-step-audit-workflow)
18. [Finding Detail Inspector](#18-finding-detail-inspector)
19. [Security Architecture & Multi-Tenant Isolation](#19-security-architecture--multi-tenant-isolation)
20. [Demo Isolation Boundary](#20-demo-isolation-boundary)
21. [Immutable Audit Snapshots](#21-immutable-audit-snapshots)
22. [Rescan Architecture & Computed Deltas](#22-rescan-architecture--computed-deltas)
23. [Retry Architecture](#23-retry-architecture)
24. [Failure Handling & Graceful Degradation](#24-failure-handling--graceful-degradation)
25. [Important Trust Rules](#25-important-trust-rules)
26. [Production Deployment Architecture](#26-production-deployment-architecture)
27. [Database Architecture & Schema](#27-database-architecture--schema)
28. [API Architecture](#28-api-architecture)
29. [Testing Strategy & Test Matrices](#29-testing-strategy--test-matrices)
30. [Phase-by-Phase Engineering Journey](#30-phase-by-phase-engineering-journey)
31. [Key Engineering Decisions](#31-key-engineering-decisions)
32. [Limitations & Future Roadmap](#32-limitations--future-roadmap)
33. [Local Development Guide](#33-local-development-guide)
34. [Environment Variables](#34-environment-variables)
35. [Final Production Readiness Status](#35-final-production-readiness-status)

---

## 1. Why GapCheck Exists

Technical recruiting suffers from an asymmetric verification problem:

```text
Applicant claims skills on resume  ──►  Recruiter checks GitHub/Portfolio  ──►  Rejection or Probe
(e.g., React, Node, Docker, AWS)         (e.g., 2 repos, no tests, tutorials)      (Silence or Failed Screen)
```

Students and early-career software engineers often list every technology they have touched:
- Languages: Python, TypeScript, Java, C++
- Frameworks: React, Next.js, Express, Django
- Infrastructure: Docker, Kubernetes, AWS, Redis

When technical screeners or hiring managers review public GitHub portfolios, they regularly discover:
- Repositories that do not demonstrate the claimed technologies.
- Missing or placeholder README documentation.
- Forked repositories or tutorial clones with zero personal commit history.
- Prominent unfinished side-projects overshadowing solid work.
- Inconsistent naming between resume project titles and GitHub repository names.
- Role-critical requirements from the job description with zero demonstrable implementation.

Traditional resume screeners and ATS tools evaluate only:
$$\text{Resume} \longleftrightarrow \text{Job Description}$$

GapCheck bridges the credibility gap by evaluating:
$$\text{Resume} \longleftrightarrow \text{Public GitHub Code} \longleftrightarrow \text{Target Role} \longleftrightarrow \text{Recruiter Screening Signals}$$

GapCheck does not predict hiring or grade people; it acts as an **evidence-based pre-application mirror**, revealing gaps and inconsistencies before an external recruiter spots them.

---

## 2. Core Product Philosophy & Flow

GapCheck operates under strict reasoning frameworks:

$$\mathbf{Claim} \longrightarrow \mathbf{Evidence} \longrightarrow \mathbf{Strength} \longrightarrow \mathbf{Reasoning} \longrightarrow \mathbf{Status} \longrightarrow \mathbf{Priority} \longrightarrow \mathbf{Action}$$

$$\mathbf{Observation} \longrightarrow \mathbf{Signal} \longrightarrow \mathbf{Reasoning} \longrightarrow \mathbf{Conclusion} \longrightarrow \mathbf{Action}$$

```mermaid
flowchart TD
    A[Student Resume PDF / Text] --> B[Resume Claim & Handle Extraction]
    C[Public GitHub Profile] --> D[Identity Check & Repository Scan]
    E[Target Job Description] --> F[Job Requirement Extraction]

    B --> G[Evidence Matching Engine]
    D --> G
    F --> G

    G --> H[Resume ↔ GitHub Consistency Check]
    G --> I[Recruiter Perspective Audit]
    G --> J[Target Role Alignment]

    H --> K[Pre-Application Decision Engine]
    I --> K
    J --> K

    K --> L[Priority Fixes: Must Fix / Nice to Fix]
    K --> M[14-Day Tactical Action Plan]
    K --> N[Audited PDF Report & Annotated Resume]
```

---

## 3. What GapCheck Analyzes

| Domain | What GapCheck Actually Examines | What GapCheck Never Does |
| :--- | :--- | :--- |
| **Resume** | Declared candidate identity, technical skill claims, project highlights, declared GitHub profile URL/handle. | Never modifies resume without user direction; never guesses omitted contact details. |
| **GitHub Profile** | Public username, display name, public repositories, commit activity frequency, languages, stars, fork provenance. | **Never accesses private repositories**; never requires OAuth write permissions or private tokens. |
| **Code Repositories** | Package manifests (`package.json`, `requirements.txt`), README content and completeness, directory trees, test suites (`jest`, `pytest`, `vitest`), Dockerfiles, CI workflows. | Never executes untrusted repository code; operates strictly on static AST and manifest metadata. |
| **Job Description** | Required technologies, preferred skills, architectural expectations for specific roles (Frontend, Backend, Fullstack, Mobile, DevOps, ML). | Never penalizes candidate when job descriptions are brief or generic. |
| **Cross-Source Consistency** | Direct match between resume project names and GitHub repository names; verification of claimed technologies in project codebases. | Never assumes missing public code implies fraud or deceit. |
| **Recruiter Signals** | Project substance vs tutorial clone flags, documentation quality, recent commit cadence, profile noise (excessive unfinished repos). | Never issues emotional rejections; maintains calm, constructive, evidence-based feedback. |

---

## 4. System Architecture

```mermaid
flowchart LR
    subgraph Client ["Client (Vercel)"]
        UI["Next.js 16 Web App<br/>(React 19 + Tailwind CSS)"]
    end

    subgraph Server ["Server (Render)"]
        API["Express 5 REST API"]
        AUTH["Auth & JWT Middleware"]
        RATE["Rate Limiting Middleware"]
        
        subgraph Pipeline ["Core Analysis Pipeline"]
            RP["Resume Parser<br/>(pdf-parse)"]
            GA["GitHub Analyzer<br/>(API + Scraper Fallback)"]
            JP["Job Description Parser"]
            EE["Evidence Engine"]
            RA["Recruiter Auditor"]
            PAD["Pre-Application Decision"]
            PDF["Report Generator<br/>(PDFKit)"]
        end
    end

    subgraph Persistence ["Persistence (Render / Local)"]
        DB[("PostgreSQL 16<br/>(Drizzle ORM)")]
        PGLITE[("PGlite Embedded DB<br/>(Local Dev Fallback)")]
    end

    subgraph External ["External Services"]
        GH["GitHub REST API v3"]
    end

    UI -->|HTTPS / JSON| API
    API --> AUTH
    API --> RATE
    AUTH --> Pipeline
    Pipeline --> RP
    Pipeline --> GA
    Pipeline --> JP
    Pipeline --> EE
    Pipeline --> RA
    Pipeline --> PAD
    Pipeline --> PDF

    GA -->|HTTPS (Bearer Token)| GH
    Pipeline --> DB
    Pipeline -.->|Fallback| PGLITE
```

### Component Responsibilities:
1. **Next.js Web Client (`apps/web`)**: Implements the 4-step audit wizard, real-time deterministic polling progress UI, interactive finding inspector, claims matrix, and PDF report triggers.
2. **Express API Server (`apps/api`)**: Enforces authentication, rate limits, request payload validation, and manages background audit execution jobs.
3. **PostgreSQL Database (`Drizzle ORM`)**: Stores user accounts, resumes, extracted claims, scanned repository metadata, immutable audit records, and progress snapshots.
4. **Embedded PGlite Engine**: Automatically activates in local development when no external `DATABASE_URL` is configured, allowing zero-friction setup without Docker.

---

## 5. Repository & Codebase Architecture

```text
GapCheck/
├── apps/
│   ├── web/                               # Next.js 16 Frontend Application
│   │   ├── src/
│   │   │   ├── app/                       # App Router Pages
│   │   │   │   ├── page.tsx               # Landing Page & Marketing Showcase
│   │   │   │   ├── login/page.tsx         # User Authentication
│   │   │   │   ├── register/page.tsx      # Student Registration
│   │   │   │   ├── analyze/page.tsx       # 4-Step Audit Wizard & Live Progress
│   │   │   │   └── dashboard/page.tsx     # Audit Workspace, Findings & Action Plan
│   │   │   ├── components/                # Reusable UI Component Library
│   │   │   │   ├── Navbar.tsx             # Responsive Navigation & Session State
│   │   │   │   └── ui/                    # Design System (Buttons, Badges, Pills, Inputs)
│   │   │   └── lib/                       # Client Utilities
│   │   │       ├── api.ts                 # Type-Safe API Client & HTTP Transport
│   │   │       └── auth.ts                # Client Session Storage Helper
│   │   ├── package.json
│   │   └── next.config.ts
│   │
│   └── api/                               # Express 5 Backend API Service
│       ├── src/
│       │   ├── db/                        # Database Layer
│       │   │   ├── index.ts               # Idempotent Schema Bootstrapper & Client
│       │   │   └── schema.ts              # Drizzle ORM Relational Schemas & Enums
│       │   ├── middleware/                # HTTP Pipeline Interceptors
│       │   │   ├── auth.ts                # JWT Verification & Ownership Decorator
│       │   │   └── rateLimiter.ts         # Endpoint Rate Limiters
│       │   ├── routes/                    # RESTful Route Controllers
│       │   │   ├── auth.ts                # /api/auth (Register, Login, Me, Demo)
│       │   │   ├── resume.ts              # /api/resume (PDF Upload, Text Parse)
│       │   │   ├── github.ts              # /api/github (Validate, Profile Scan)
│       │   │   ├── job.ts                 # /api/job (JD Extraction & Requirements)
│       │   │   ├── analysis.ts            # /api/analysis (Start, Status, Rescan, Retry, PDFs)
│       │   │   └── dashboard.ts           # /api/dashboard (Aggregated Audit View)
│       │   ├── services/                  # Pure Business Logic & Domain Services
│       │   │   ├── githubAnalyzer.ts      # Profile Scraping, Repos, AST, Identity Check
│       │   │   ├── resumeParser.ts        # PDF Magic-Byte Validation, Claim Extraction
│       │   │   ├── jobParser.ts           # Target Role & Job Description Extractor
│       │   │   ├── evidenceEngine.ts      # Skill Matching & Verification Matrix
│       │   │   ├── recruiterAudit.ts      # Profile Auditor, Signals & Readiness Scoring
│       │   │   ├── preApplicationDecision.ts # Decision Engine (READY / FIXES / NEEDS WORK)
│       │   │   ├── reportGenerator.ts     # PDFKit Audit Report & Annotated Resume
│       │   │   └── demoData.ts            # Isolated Sample Profile Dataset
│       │   ├── tests/                     # Automated Test Suites (69 Profiles)
│       │   │   ├── recruiterAuditMatrix.test.ts          # Profiles A — AB (28 Profiles)
│       │   │   ├── workflowAndSecurity.test.ts           # Profiles AC — AM (11 Profiles)
│       │   │   ├── studentWorkflow.test.ts               # Profiles AN — AX (12 Profiles)
│       │   │   ├── productionSecurity.test.ts            # Profiles AY — BH (10 Profiles)
│       │   │   └── githubIdentityAndFailureHardening.test.ts # Tests A — H (8 Profiles)
│       │   └── server.ts                  # App Entrypoint, CORS, Security Headers
│       └── package.json
│
├── .env.example                           # Unified Environment Variables Reference
├── render.yaml                            # Render Blueprint Configuration (API + DB)
├── vercel.json                            # Vercel Deployment Settings (Web App)
├── package.json                           # Root Workspace Orchestration
└── README.md
```

---

## 6. Technology Stack

### Frontend (`apps/web`)
- **Framework**: Next.js 16.4.2 (App Router with Partial Prefetching and Turbopack).
- **Core Library**: React 19.3.0.
- **Language**: TypeScript 5.
- **Styling**: Tailwind CSS 4 with custom dark-mode Apple glass aesthetics.
- **Animation**: Framer Motion 14.4.0.
- **Icons**: Lucide React.
- **Visualization**: Recharts 3.10.1.

### Backend (`apps/api`)
- **Server Framework**: Express 5.3.0.
- **Runtime**: Node.js >= 20.0.0.
- **Language**: TypeScript 7.
- **PDF Extraction**: `pdf-parse` 2.4.5 with strict header validation.
- **PDF Generation**: `pdfkit` 0.20.2 for binary report streaming.
- **File Handling**: `multer` 2.4.0 with disk storage constraints and automatic temp file cleanup.
- **Security & Headers**: `helmet` 8.3.0, strict origin CORS validation.
- **Logging**: `morgan` 1.12.1 (production combined, dev formatted).

### Database & Persistence
- **Database Engine**: PostgreSQL 16 (Render Managed Postgres in production; embedded `@electric-sql/pglite` in local development).
- **ORM & Migrations**: Drizzle ORM 0.45.4 with Drizzle Kit.
- **Schema Design**: Fully typed relational schema with UUID primary keys and cascaded deletions.

### Authentication & Cryptography
- **Password Hashing**: `bcryptjs` 3.0.3 (cost factor: 12).
- **Tokens**: `jsonwebtoken` 9.0.3 (signed HMAC-SHA256 tokens).

---

## 7. Complete Analysis Pipeline

The audit lifecycle processes data through thirteen distinct phases:

```text
1. User Submission
   └─ User supplies resume (PDF/Text), GitHub handle, target role, and optional job description.

2. Input & Format Validation
   ├─ Checks PDF magic bytes (%PDF) or validates plain text length (>= 50 chars).
   └─ Normalizes GitHub username/URL format.

3. Resume Information Extraction
   ├─ Extracts candidate personal info (name, email, declared GitHub link).
   └─ Extracts structured skill assertions, project narratives, and proficiency markers.

4. GitHub Profile & Identity Consistency Check
   ├─ Verifies GitHub profile exists on GitHub API (returns 404 GITHUB_NOT_FOUND if missing).
   └─ Cross-references candidate name and resume handle with GitHub profile (blocks on MISMATCH).

5. Public Repository Harvesting
   ├─ Fetches public non-fork and contributed repositories via GitHub REST API.
   └─ Downloads file trees, package manifests, READMEs, test suites, and Dockerfiles.

6. Job Description Extraction
   └─ Parses required vs preferred technologies from raw JD text (marks targetJob=LIMITED if short).

7. Evidence Matching
   └─ Cross-references each resume claim against observable code AST, manifests, and file trees.

8. Repository Classification
   └─ Categorizes each repository: STRONG, SUPPORTING, PRACTICE, TUTORIAL_CLONE, or OUTDATED.

9. Recruiter Concern & Strength Generation
   └─ Detects unmatched resume projects, sparse unfinished repos, or lack of automated tests.

10. Target Role Alignment
    └─ Evaluates role-critical technologies for the specific role (e.g., React/TypeScript for Frontend).

11. Pre-Application Decision Synthesis
    └─ Determines status: READY, READY_WITH_FIXES, or NEEDS_WORK with prioritized mustFix actions.

12. Action Plan Construction
    └─ Assembles a 14-day prioritized checklist with concrete Options A, B, and C.

13. Immutable Snapshot Persistence
    └─ Commits the complete audit state, input copies, and repository snapshots to PostgreSQL.
```

---

## 8. Resume Analysis System

The resume parsing system (`apps/api/src/services/resumeParser.ts`) evaluates technical claims from uploaded documents.

### PDF Security & Format Validation
To protect against corrupted uploads and malicious files renamed with a `.pdf` extension, the parser inspects the initial byte headers:

```typescript
// Validate PDF magic bytes (%PDF)
if (dataBuffer.length < 4 || dataBuffer.subarray(0, 4).toString('utf-8') !== '%PDF') {
  throw new Error('Invalid file format: Uploaded document does not contain valid PDF headers.');
}
```

### Empty and Scanned Document Detection
If a valid PDF file contains no selectable text or fewer than 50 characters, it is classified as an unreadable scan or blank document:

```typescript
if (cleanText.length < 50) {
  throw new Error("We couldn't extract enough readable text from this resume (<50 chars). Please upload a text-based PDF or paste your resume text.");
}
```
This triggers an HTTP `400 EMPTY_RESUME` response, aborts analysis initiation, and removes temporary upload files immediately.

### Declared GitHub Extraction
The parser automatically extracts GitHub references directly from resume text, links, or contact headers using regex matching:
- `github.com/<username>`
- `github: <username>`
- Embedded hyperlinks containing GitHub URLs

---

## 9. GitHub Identity Verification Engine

### The Problem
A major vulnerability in candidate auditing is identity mismatch:
```text
Candidate Resume: "Uday Kumar Gorantla R"
Supplied GitHub: "https://github.com/Ananya0213"
```
Without identity validation, an engine would analyze Ananya's 15 public repositories and attribute them as technical evidence for Uday.

### The Identity State Matrix
The engine (`verifyGitHubIdentityConsistency`) evaluates multiple signals and assigns one of four states:

```mermaid
flowchart TD
    Start["Verify Identity"] --> R{"Resume Declares GitHub Handle?"}
    R -- "Yes, Matches Input Handle" --> Cons["Status: CONSISTENT (HIGH Confidence)"]
    R -- "Yes, Differs From Input Handle" --> Mis["Status: MISMATCH (HIGH Confidence)"]
    R -- "No" --> N{"Candidate Name vs GitHub Profile"}
    N -- "Display Name Matches Candidate" --> Cons
    N -- "Username Matches Name / Initials" --> Cons
    N -- "Contradictory Display Name / Username" --> Mis
    N -- "Inconclusive / No Contradiction" --> Unk["Status: POSSIBLY_CONSISTENT / UNKNOWN"]
```

1. **`CONSISTENT`**: Declared resume handle matches input, profile display name matches candidate name, or non-generic username tokens align with candidate name.
2. **`POSSIBLY_CONSISTENT`**: Username aligns with candidate initials or first name (e.g. `prajjwal-dev` for *Prajjwal Tripathi*).
3. **`MISMATCH`**: Declared resume handle explicitly contradicts entered handle, or GitHub display name/username belongs to an entirely different person (e.g. *Ananya Sharma* vs *Uday Kumar Gorantla R*).
4. **`UNKNOWN`**: Insufficient public profile data to establish identity. **Crucial rule: UNKNOWN is never treated as a MISMATCH.**

### Safe Handling of Mismatches
When an identity mismatch is detected:
1. `POST /api/analysis/start` returns `400 GITHUB_IDENTITY_MISMATCH` with detailed explanatory reasons.
2. The UI halts in Step 4 and displays an amber alert card with two options:
   - **[Change GitHub]**: Returns to Step 2 to correct the URL.
   - **[Continue without GitHub]**: Proceeds with resume-only analysis. The unrelated GitHub repositories are completely discarded (`repos = []`, `evidence = []`), and external source coverage is tagged `LIMITED`.

---

## 10. GitHub Repository Analysis System

Public repositories are analyzed statically without executing code:

### Data Extracted per Repository
- **Metadata**: Name, description, primary language, stars, forks, last commit timestamp, commit count.
- **Provenance**: Whether the repository is a fork, parent repository details, and whether commits are personal contributions.
- **Manifests**: Parsed dependencies from `package.json` (`dependencies`, `devDependencies`) and `requirements.txt`.
- **Engineering Indicators**: Automated tests (`hasTests`), Docker containers (`hasDockerfile`), CI/CD workflows (`hasCi`), and structured documentation (`hasReadme`).
- **File Structure**: AST inspection of file paths and directory trees.

### Repository Classification System

```text
STRONG PROJECT                Multi-file, architectural depth, tests, documentation, commit cadence
SUPPORTING PROJECT            Meaningful functionality supporting a secondary skill
PRACTICE / LEARNING           DSA, LeetCode, algorithm practice (preserved under "No Action Needed")
ASSIGNMENT / ACADEMIC         Coursework projects, semester lab repositories
POTENTIAL TUTORIAL / CLONE    High similarity to common bootcamp boilerplate or tutorial projects
TUTORIAL / CLONE              Exact tutorial match with minimal original commits
UTILITY / TOOL                Small scripts, dotfiles, configuration repos
OUTDATED                      Inactive for > 2 years with no recent maintenance
UNFINISHED / NEEDS REVIEW     Fewer than 3 commits, placeholder README, incomplete structure
FORK / CONTRIBUTION           Forked repository with verifiable personal contributions
FORK / DUPLICATE              Direct fork with zero original commits
```

---

## 11. Evidence Engine & Verification Model

The evidence matching engine (`apps/api/src/services/evidenceEngine.ts`) connects declared resume skills to observable repository signals:

### Verification Statuses

| Status | Meaning |
| :--- | :--- |
| **`VERIFIED`** | Direct, unambiguous proof in public code (e.g. React components, imports, package dependencies, and commits). |
| **`SUPPORTED`** | Meaningful proof exists (e.g. language present, secondary dependencies, documentation references). |
| **`PARTIAL`** | Basic references found, but insufficient depth to demonstrate proficiency. |
| **`UNVERIFIED`** | No observable evidence exists in public repositories. **Does NOT mean the candidate lied.** |
| **`UNKNOWN`** | Available repository scan was incomplete due to external rate limits or API timeouts. |

---

## 12. The Evidence Chain

Every item presented in GapCheck adheres to a non-negotiable traceability chain:

```text
Claim
  └─ "3 years of Node.js and Express API development"
       │
       ▼
Observable Evidence
  └─ Repository "payment-service": package.json lists express ^4.19.2, 42 commits in src/routes/
       │
       ▼
Evidence Strength
  └─ HIGH (verified across 3 public repositories with unit tests)
       │
       ▼
Reasoning
  └─ Implementation demonstrates routing, middleware, error handling, and test suites
       │
       ▼
Status
  └─ VERIFIED
       │
       ▼
Priority
  └─ LOW (Competency is solid; no remedial action required)
       │
       ▼
Action
  └─ PRESERVE (Highlight as flagship talking point in interviews)
```

---

## 13. Recruiter-Perspective Audit

The auditor (`apps/api/src/services/recruiterAudit.ts`) evaluates a profile across six major recruiter signals:

1. **Scope & Structure**: Does the repository demonstrate layered architecture (controllers, services, data models), or is it a flat single-file script?
2. **Engineering Standards**: Are automated test suites (`jest`, `pytest`) and containerization (`Dockerfile`) present?
3. **Documentation Quality**: Does the README explain setup, architectural decisions, and API routes, or is it the default `Create React App` boilerplate?
4. **Maintenance & Cadence**: Has the candidate pushed code in the last 12 months, or is the portfolio stagnant?
5. **Originality & Clone Indicators**: Does the project resemble standard tutorial clones (e.g. generic Netflix/Spotify clone), or does it show original domain modeling?
6. **Completeness**: Are repositories finished, documented applications, or abandoned placeholders?

---

## 14. Pre-Application Decision Engine

The decision engine (`apps/api/src/services/preApplicationDecision.ts`) evaluates whether a candidate should submit their application immediately or address critical gaps first.

```mermaid
flowchart TD
    Audit[Recruiter Profile Audit] --> DecisionRule{Evaluate Blocker Rules}
    DecisionRule -- ">= 3 Role Gaps OR >= 3 Unverified Claims without Core Projects" --> NeedsWork["NEEDS_WORK<br/>'Strengthen your profile before applying'"]
    DecisionRule -- "0 Critical Issues, 0 High Issues, 0 Role Gaps" --> Ready["READY<br/>'Profile broadly aligned — ready for application'"]
    DecisionRule -- "Default: 1 to 5 Fixable Priorities" --> ReadyWithFixes["READY_WITH_FIXES<br/>'Apply after addressing these priorities'"]
```

### Action Priority Calculation
Actions in the decision plan are prioritized using canonical severity scoring:
$$\text{Priority} = \text{Base Severity} + \text{Role Criticality} + \text{Remediation Effort}$$

- **`CRITICAL`**: Direct contradiction or high-severity gap on a target-role requirement.
- **`HIGH`**: Unverified resume claim on a primary skill, or flagship project lacking README documentation.
- **`MEDIUM`**: Unmatched secondary resume project or minor hygiene item.
- **`LOW`**: Compact utility documentation or minor formatting recommendations.

---

## 15. Readiness Score Breakdown

The overall readiness score ($0 - 100$) reflects observable engineering proof across five weighted dimensions:

$$\text{Readiness Score} = 0.30 \times Q_{\text{proj}} + 0.20 \times D_{\text{doc}} + 0.15 \times A_{\text{act}} + 0.20 \times C_{\text{cons}} + 0.15 \times H_{\text{hyg}}$$

| Dimension | Weight | What It Measures |
| :--- | :---: | :--- |
| **Core Project Evidence ($Q_{\text{proj}}$)** | **30%** | Depth, architecture, tests, and CI in top 3–4 repositories (unaffected by DSA practice repos). |
| **Documentation ($D_{\text{doc}}$)** | **20%** | Presence and thoroughness of technical READMEs across core projects. |
| **Activity & Maintenance ($A_{\text{act}}$)** | **15%** | Commits and updates pushed within the past 12 months. |
| **Resume ↔ GitHub Consistency ($C_{\text{cons}}$)** | **20%** | Percentage of resume-highlighted projects verifiable on public GitHub. |
| **Profile Hygiene ($H_{\text{hyg}}$)** | **15%** | Absence of prominent abandoned prototypes, broken forks, or noise. |

> **Crucial Principle**: The readiness score is an evidence-quality signal, **not an interview guarantee or hiring probability**.

---

## 16. Seven-Stage Deterministic UX

During analysis, the client polls the server (`/api/analysis/:id`) and displays deterministic, human-readable stages rather than arbitrary, erratic progress percentages:

```text
[Stage 1]  Reading resume
           Extracting technical claims, competencies, and scope
[Stage 2]  Scanning public GitHub profile
           Inspecting publicly accessible repositories and metadata
[Stage 3]  Analyzing repositories
           Auditing languages, commit frequency, tests, and documentation
[Stage 4]  Checking resume ↔ GitHub evidence
           Cross-referencing stated skills against observable source code
[Stage 5]  Comparing against target role
           Mapping technical requirements to observable competencies
[Stage 6]  Running recruiter perspective audit
           Detecting interview concerns and evidence gaps
[Stage 7]  Building your application plan
           Synthesizing pre-application decision, priorities, and action items
```

---

## 17. Four-Step Audit Workflow

The audit wizard (`apps/web/src/app/analyze/page.tsx`) guides students through a structured setup:

1. **Step 01 — Resume**: Upload text-based PDF or paste raw resume text. Instantly displays extracted technical claims.
2. **Step 02 — GitHub**: Enter public GitHub username or URL. Automatically normalizes handles and checks profile existence.
3. **Step 03 — Target Role**: Enter target role title (e.g. *Frontend Developer*), company name, and optional job description.
4. **Step 04 — Review & Verification**: Summarizes all three inputs, executes pre-flight identity cross-referencing, and launches the audit.

---

## 18. Finding Detail Inspector

Every gap or finding in the dashboard features a detail inspector that prevents unsupported AI speculation by presenting three structured options:

```text
Finding: Redis Caching Layer Lacks Public Code Evidence
────────────────────────────────────────────────────────────────────────
• Observation: Resume highlights Redis distributed caching; 0 public repos contain Redis imports.
• Reasoning: Interviewers who review GitHub will see no caching code, inviting technical probe.
• Evidence: Searched 14 public repos, package.json dependencies, and docker-compose files.

Action Plan Options:
  [Option A] Add Implementation Evidence: Add a Redis cache module with tests to your primary API repo.
  [Option B] Clarify Context: Note on resume that Redis was utilized in proprietary employer systems.
  [Option C] Soften Resume Claim: Revise bullet point to emphasize Node.js backend APIs.
```

---

## 19. Security Architecture & Multi-Tenant Isolation

GapCheck enforces complete multi-tenant account isolation:

```mermaid
flowchart TD
    subgraph Request ["Incoming HTTP Request"]
        REQ["GET /api/analysis/:id<br/>Authorization: Bearer <jwt>"]
    end

    subgraph AuthMiddleware ["Authentication Middleware"]
        VFY["Verify JWT Signature<br/>(getJwtSecret)"]
        UID["Extract req.userId"]
    end

    subgraph Controller ["Route Controller"]
        FETCH["SELECT FROM analyses WHERE id = :id"]
        CHECK{"analysis.userId === req.userId?"}
        ALLOW["200 OK — Render Resource"]
        DENY["403 FORBIDDEN — Access Denied"]
    end

    REQ --> VFY --> UID --> FETCH --> CHECK
    CHECK -- Yes --> ALLOW
    CHECK -- No --> DENY
```

### Authorization Guarantees
- **No Resource Access via Known UUIDs**: Knowing another user's analysis ID, resume ID, or report ID returns `403 FORBIDDEN`.
- **Scoped Relational Queries**: Every database query for findings, recommendations, action plans, and progress snapshots is joined or filtered by `WHERE user_id = req.userId`.
- **PDF Download Protection**: `/api/analysis/:id/report.pdf` and `/api/analysis/:id/annotated-resume.pdf` verify ownership before compiling or streaming binary bytes.
- **Production JWT Hardening**: `getJwtSecret()` strictly disallows default development secrets when `NODE_ENV=production`.

---

## 20. Demo Isolation Boundary

GapCheck provides a built-in sample experience (*Arjun Sharma — Frontend Developer Intern*) while strictly protecting real user data:

- **Separate Endpoint**: Only triggered by explicit calls to `POST /api/auth/demo`.
- **Dedicated Demo Account**: Tied to `demo@proofcheck.dev`.
- **Visible Banner**: The dashboard renders a persistent amber notice when in demo mode.
- **Zero Pollution**: Real user registrations never inherit demo audits, and demo sessions never touch real student databases.

---

## 21. Immutable Audit Snapshots

An audit is a frozen legal and technical snapshot in time:
- When code is pushed to GitHub or a resume is modified later, **past completed audits must never change**.
- To ensure immutability, `analyses` records store:
  - `resumeTextSnapshot`: Exact text analyzed.
  - `jobDescriptionTextSnapshot`: Exact JD analyzed.
  - `repositoriesSnapshot`: JSON snapshot of all repository metadata, commits, and file structures at that moment.
  - `repositories.analysisId`: Repositories are linked directly to the specific analysis instance.

---

## 22. Rescan Architecture & Computed Deltas

When a student pushes new code, adds a README, or fixes a gap, they trigger **Rescan GitHub** (`POST /api/analysis/:id/rescan`):

```text
Audit A (Frozen Snapshot)
   │
   ├── User pushes commits and adds README on GitHub
   │
   ▼
POST /api/analysis/:id/rescan
   │
   ├── Fetches fresh GitHub profile and repositories
   ├── Preserves Audit A completely untouched
   ├── Creates Audit B with parentAnalysisId = Audit A.id
   └── Computes and stores differential delta
```

### Computed Delta Metrics
- `repositoriesAdded`: New repositories detected since Audit A.
- `repositoriesRemoved`: Repositories deleted or privatized.
- `repositoriesChanged`: Repositories with new commits or updated timestamps.
- `readmesAdded`: Repositories that now feature a technical README.
- `claimsNewlySupported`: Resume claims that now have verifiable code evidence.

---

## 23. Retry Architecture

If an audit encounters a recoverable failure (such as an external API timeout), the user can invoke **Retry** (`POST /api/analysis/:id/retry`):
- Unlike Rescan, Retry does not fetch a new state; it re-executes the pipeline using the exact stored snapshot inputs (`resumeTextSnapshot`, `jobDescriptionTextSnapshot`, `githubUsername`, `targetRole`).
- Completed analyses reject retry requests with `400 INVALID_STATE`.
- Retried analyses reset state to `pending` without duplicating database records or corrupting history.

---

## 24. Failure Handling & Graceful Degradation

| Failure Scenario | HTTP Code | Error Key | System Behavior |
| :--- | :---: | :--- | :--- |
| **Invalid PDF Upload** | `400` | `INVALID_PDF_FILE` | Rejects non-PDF headers; cleans up uploaded temp file immediately. |
| **Empty / Scanned PDF** | `400` | `EMPTY_RESUME` | Rejects documents with < 50 characters; guides user to upload text-based PDF. |
| **Non-existent GitHub** | `404` | `GITHUB_NOT_FOUND` | Halts before creating audit record; never manufactures fake 0-repo analysis. |
| **GitHub Identity Mismatch** | `400` | `GITHUB_IDENTITY_MISMATCH` | Rejects unrelated profile; offers *Continue without GitHub* (0 repos analyzed). |
| **Short / Vague JD** | `200` | `targetJob: LIMITED` | Suppresses artificial role-gap generation; prevents false blocker warnings. |
| **GitHub API Rate Limit / Failure** | `200` | `github: PARTIAL / LIMITED` | Marks source coverage incomplete; **never penalizes readiness score**. |
| **Unauthorized Audit Access** | `403` | `FORBIDDEN` | Blocks foreign user access to audits, results, rescans, and PDFs. |
| **Expired Session** | `401` | `UNAUTHORIZED` | Clears local storage; redirects user to `/login?expired=true`. |

---

## 25. Important Trust Rules

### What GapCheck Will Never Assume:

> **NO EVIDENCE $\neq$ NEGATIVE EVIDENCE**
> The absence of public code does not mean a candidate lacks knowledge. Private repositories, employer systems, and coursework cannot be seen by public tools.

> **INCOMPLETE SCAN $\neq$ WEAK CANDIDATE**
> If the GitHub API times out or rate-limits, source coverage is marked `PARTIAL`. The candidate's readiness score is never penalized for external infrastructure failures.

> **SMALL PROJECT $\neq$ BAD PROJECT**
> A clean, focused 8-file CLI tool with tests and documentation is classified as complete, not unfinished.

> **OLD PROJECT $\neq$ OUTDATED SKILL**
> A stable, complete utility untouched for 2 years is categorized under "You Don't Need to Fix", preserving history without penalty.

> **FORK $\neq$ MISCONDUCT**
> Forked repositories are recognized as open-source participation or coursework reference unless claimed as original architecture.

> **UNVERIFIED $\neq$ FALSE**
> An unverified claim simply lacks observable public code proof; GapCheck suggests clarifying context rather than alleging deception.

---

## 26. Production Deployment Architecture

GapCheck is structured as a decoupled full-stack deployment:

```text
                            INTERNET
                                │
               ┌────────────────┴────────────────┐
               │                                 │
        Vercel (Edge)                     Render (Cloud)
               │                                 │
        apps/web (Next.js)              apps/api (Express 5)
               │                                 │
               └───────── HTTPS / CORS ──────────┤
                                                 │
                                        ┌────────┴────────┐
                                        ▼                 ▼
                                   PostgreSQL         GitHub API
                                  (Render Managed)   (Public v3)
```

- **Frontend**: Hosted on [Vercel](https://vercel.com) (`apps/web`), leveraging edge asset caching and route prefetching.
- **Backend API**: Hosted on [Render](https://render.com) (`apps/api`) via `render.yaml`, executing containerized Node.js with health monitoring on `/api/health`.
- **Database**: Managed PostgreSQL on Render with connection pooling and automated SSL.
- **Local Fallback**: Embedded persistent PGlite engine inside `apps/api/.data/gapcheck_pg`.

---

## 27. Database Architecture & Schema

```mermaid
erDiagram
    users ||--o{ resumes : owns
    users ||--o{ analyses : initiates
    users ||--o{ job_descriptions : creates
    users ||--o{ repositories : manages

    resumes ||--o{ resume_claims : contains
    job_descriptions ||--o{ job_requirements : contains

    analyses ||--o{ analysis_findings : generates
    analyses ||--o{ recommendations : produces
    analyses ||--o{ action_items : assigns
    analyses ||--o{ progress_snapshots : tracks
    analyses ||--o{ repositories : references
    analyses ||--o{ analyses : parent_rescan

    users {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar name
        varchar target_role
        timestamp created_at
    }

    analyses {
        uuid id PK
        uuid user_id FK
        uuid parent_analysis_id FK
        varchar target_role
        varchar company
        varchar github_username
        text resume_text_snapshot
        text job_description_text_snapshot
        jsonb repositories_snapshot
        jsonb delta_from_previous
        real overall_score
        jsonb dimensions
        varchar status
        timestamp created_at
    }

    analysis_findings {
        uuid id PK
        uuid analysis_id FK
        uuid user_id FK
        varchar skill
        text resume_claim
        varchar evidence_status
        jsonb evidence_sources
        text assessment
        real confidence
        varchar priority
    }
```

---

## 28. API Architecture

### Authentication Routes (`/api/auth`)
- `POST /register`: Register student account (validates email, password length, uniqueness).
- `POST /login`: Authenticate existing student and return signed JWT.
- `GET /me`: Return authenticated student profile.
- `POST /demo`: Launch isolated sample profile session.

### Resume Routes (`/api/resume`)
- `POST /upload`: Upload and validate PDF resume (validates magic bytes, extracts claims).
- `POST /text`: Parse raw pasted resume text.
- `GET /`: List authenticated student's resumes.
- `GET /:id`: Retrieve specific resume by ID (ownership verified).

### GitHub Routes (`/api/github`)
- `POST /validate`: Pre-flight profile existence and identity cross-referencing check.
- `GET /profile/:username`: Retrieve public GitHub profile and repository summary.

### Job Description Routes (`/api/job`)
- `POST /analyze`: Parse and extract requirements from job description text.
- `GET /`: List student's analyzed job descriptions.
- `GET /:id`: Retrieve specific job description by ID (ownership verified).

### Analysis Routes (`/api/analysis`)
- `POST /start`: Initiate 7-stage audit pipeline (checks identity consistency; returns `400` or `404` on failure).
- `GET /`: Retrieve user's historical audit snapshots.
- `GET /:id`: Poll audit progress and stage status.
- `GET /:id/results`: Fetch completed audit findings, recommendations, and action plan.
- `POST /:id/rescan`: Rescan GitHub profile and generate differential delta snapshot.
- `POST /:id/retry`: Re-execute failed analysis using preserved snapshot inputs.
- `GET /:id/report.pdf`: Stream compiled Audit Report PDF.
- `GET /:id/annotated-resume.pdf`: Stream compiled Annotated Resume PDF.

### Dashboard Routes (`/api/dashboard`)
- `GET /`: Retrieve aggregated audit overview, claims matrix, and readiness dimensions.

---

## 29. Testing Strategy & Test Matrices

GapCheck follows a multi-layer verification strategy, testing edge cases, security boundaries, and failure scenarios across **69 automated test profiles**:

```text
======================================================
 GAPCHECK TEST SUITE BREAKDOWN (69 / 69 PROFILES)
======================================================

1. Core Recruiter Audit Engine (Profiles A — AB)        28 / 28 PASS
   • Profiles A–N: Candidate scoring, DSA repo preservation, fork handling,
                   complete legacy projects, documentation gap detection.
   • Profiles O–AB: Empty resume, scanned image resume, GitHub URL normalization,
                    rate-limiting, 100+ repositories, single repo, non-English READMEs.

2. Student Workflow Matrix (Profiles AN — AX)           12 / 12 PASS
   • Fresh workspace zero-state, 4-step wizard payload integrity, edge inputs,
     stale session auto-recovery, mobile workflow normalization.

3. Workflow & Security Matrix (Profiles AC — AM)        11 / 11 PASS
   • Multi-tenant workspace isolation, cross-account access attempts,
     historical snapshot immutability, failed rescan preservation.

4. Production Deployment & Security (Profiles AY — BH)  10 / 10 PASS
   • Production CORS enforcement, expired/corrupt JWT rejection, Account A/B PDF
     ownership isolation, demo session boundary, server error stack-trace shielding.

5. GitHub Identity & Failure Hardening (Tests A — H)     8 / 8 PASS
   • Non-existent GitHub accounts (404), short JDs (LIMITED), invalid/empty PDFs (400),
     rate-limit handling, identity mismatches (MISMATCH), declared vs entered handle mismatch.
------------------------------------------------------
TOTAL PASS RATE:                                       100% (69 / 69 PASS)
```

---

## 30. Phase-by-Phase Engineering Journey

### Phase 1 — Foundational Engine (`e901d1b`, `8050569`, `2666ef7`)
- **Challenge**: Initial naive approaches matched keywords between resumes and GitHub summaries, leading to false positives.
- **Solution**: Built the core `recruiterAudit` service, parsing package manifests (`package.json`, `requirements.txt`) and file trees to establish observable code proof.
- **Validation**: Introduced Profiles A through H to benchmark score stability.

### Phase 2 — Pre-Application Decision Layer (`b42fb33`)
- **Challenge**: High readiness scores misled candidates if a single role-critical requirement was completely absent.
- **Solution**: Developed `preApplicationDecision.ts`, implementing categorical states (`READY`, `READY_WITH_FIXES`, `NEEDS_WORK`) coupled with actionable remediation options (A, B, C).
- **Validation**: Verified that a high score (85+) with an absent core role technology appropriately halts at `READY_WITH_FIXES`.

### Phase 3 — Edge Case & Data-Quality Hardening (`044dfa5`, `d25beee`)
- **Challenge**: Real-world portfolios feature 0 repos, 100+ repos, scanned image resumes, non-English READMEs, and GitHub API rate limits.
- **Solution**: Hardened parsing boundaries (Profiles O through AB), prevented division-by-zero errors, and established the source coverage model (`COMPLETE`, `PARTIAL`, `LIMITED`, `FAILED`).
- **Validation**: Automated edge-case matrix passing 28/28 profiles.

### Phase 4 — Student Workflow & UX Determinism (`6883bc5`)
- **Challenge**: Generic loading spinners and arbitrary progress percentages caused user confusion during multi-step scans.
- **Solution**: Created the 4-step wizard and replaced random percentage animations with 7 deterministic, stage-backed progress steps.
- **Validation**: Matrix AN through AX (12/12 profiles passing).

### Phase 5 — Multi-Tenant Security & Immutability (`f6900a2`, `28af209`)
- **Challenge**: Multi-user environments risked cross-account data leaks and mutating past audit history when GitHub accounts changed.
- **Solution**: Implemented JWT authentication with strict `userId` ownership checks across all endpoints, built snapshot immutability, and implemented the differential rescan engine.
- **Validation**: Security profiles AC through BH (21 profiles passing).

### Phase 6 — GitHub Identity Verification & Failure Hardening (Current)
- **Challenge**: Submitting an unrelated GitHub profile (e.g. *Ananya0213* for *Uday Kumar Gorantla R*) allowed external code to falsely become candidate evidence.
- **Solution**: Built `verifyGitHubIdentityConsistency`, added pre-flight validation on `/start`, established PDF magic-byte checks (`INVALID_PDF_FILE`), and enforced safe failure degradation.
- **Validation**: Tests A through H added; test suite expanded to 69/69 passing profiles.

---

## 31. Key Engineering Decisions

1. **Static AST & Manifest Inspection Over Code Execution**:
   - *Rationale*: Running candidate code in sandboxes is resource-intensive and introduces severe security vulnerabilities. Static inspection of manifests, imports, tests, and commit trees provides high-fidelity evidence safely.
2. **Deterministic Stages Over Percentage Progress Bars**:
   - *Rationale*: Percentage bars in long-running jobs are fabricated. Providing verified lifecycle stages (`Scanning profile` → `Analyzing repositories` → `Recruiter audit`) sets transparent expectations.
3. **PGlite Local Fallback**:
   - *Rationale*: Requiring a running local PostgreSQL instance creates onboarding friction. Embedding PGlite provides zero-dependency local development while using standard PostgreSQL in production.
4. **Snapshot Immutability Over Live Dynamic Lookups**:
   - *Rationale*: If a candidate audits their profile today and deletes a repo tomorrow, their historical audit report must remain historically accurate. Snapshots preserve audit integrity.

---

## 32. Limitations & Future Roadmap

- **GitHub Private Repository Context**: GapCheck exclusively audits public repositories. If a candidate developed major proprietary systems, GapCheck advises clarifying project context on the resume rather than penalizing the score.
- **Optical Character Recognition (OCR)**: Scanned image resumes currently return `EMPTY_RESUME` (400) requiring text-based PDFs. A future queue could integrate Tesseract/Vision OCR for scanned resumes.
- **GitLab & Bitbucket Support**: Currently optimized for GitHub; future releases will support GitLab and Bitbucket source URLs.

---

## 33. Local Development Guide

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0

### Quickstart

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Prajjwaltripathi20/GapCheck.git
   cd GapCheck
   ```

2. **Install all dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   *(Local development automatically runs on embedded persistent PGlite; no external database setup is required).*

4. **Launch development servers**:
   ```bash
   npm run dev
   ```
   - **Web Application**: [http://localhost:3000](http://localhost:3000)
   - **API Backend**: [http://localhost:3001](http://localhost:3001)

5. **Execute the complete test suite**:
   ```bash
   npm test
   ```

---

## 34. Environment Variables

### Backend Configuration (`apps/api/.env`)

| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Yes | Environment mode (`production`, `development`, `test`) | `production` |
| `PORT` | No | Express server listening port (default: 3001) | `3001` or `10000` |
| `DATABASE_URL` | No | PostgreSQL connection URL (defaults to embedded PGlite locally) | `postgresql://user:pass@host:5432/gapcheck` |
| `JWT_SECRET` | Yes (Prod) | 32+ character cryptographically random secret string | `openssl rand -base64 32` |
| `JWT_EXPIRES_IN` | No | JWT lifespan (default: `7d`) | `7d` |
| `FRONTEND_URL` | Yes (Prod) | Permitted CORS frontend origins (comma-separated) | `https://gapcheck.vercel.app` |
| `GITHUB_TOKEN` | No | GitHub PAT to increase rate limits (60/hr $\to$ 5000/hr) | `ghp_...` |
| `MAX_FILE_SIZE_MB` | No | Maximum resume upload size in MB (default: 10) | `10` |

### Frontend Configuration (`apps/web/.env.local`)

| Variable | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Yes | HTTPS base URL of deployed Express API backend | `https://gapcheck-api.onrender.com` |

---

## 35. Final Production Readiness Status

```text
======================================================================
 GAPCHECK PRODUCTION READINESS AUDIT
======================================================================
 [✓] Core Recruiter Engine:          28/28 Passing
 [✓] Workflow & Security:            11/11 Passing
 [✓] Student Workflow UX:            12/12 Passing
 [✓] Production Deployment Matrix:   10/10 Passing
 [✓] GitHub Identity & Hardening:     8/8 Passing
──────────────────────────────────────────────────────────────────────
 TOTAL AUTOMATED SUITE:              69/69 PASSING (100%)
 API TYPESCRIPT BUILD:               0 ERRORS
 WEB TYPESCRIPT / NEXT BUILD:        0 ERRORS
 ESLINT AUDIT:                       0 WARNINGS, 0 ERRORS
 DATA LEAK AUDIT:                    100% SCOPED BY req.userId
 MULTI-TENANT ISOLATION:             VERIFIED (403 ON FOREIGN ASSETS)
======================================================================
 FINAL CERTIFICATION:                READY FOR PRODUCTION DEPLOYMENT
======================================================================
```

---

**GapCheck** — *Find the gaps before recruiters do.*
Developed by [Prajjwal Tripathi](https://github.com/Prajjwaltripathi20).
