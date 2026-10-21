# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Engineering students, new graduates, and junior software developers preparing for internship or technical placement interviews. They have resume claims (skills, frameworks, projects) and public GitHub code, but face high skepticism from technical interviewers and recruiters regarding whether they actually built and understand what is listed on their resume.

## Product Purpose

GapCheck enables candidates to find their technical skill and evidence gaps before recruiters do. It eliminates fragile buzzword claims by analyzing what a candidate claims on their resume, what they can demonstrably prove in their GitHub repositories (via AST parsing, commit history, test coverage, and dependency manifests), and what a specific target job requires. Success means the candidate walks into technical screens with unshakeable credibility and a concrete, prioritized 14-day roadmap to patch real gaps.

## Positioning

Unlike generic AI resume builders that hallucinate or stuff buzzwords to game ATS filters, GapCheck is an honest, evidence-driven audit engine. Its distinct mechanism is AST and commit-level verification: cross-referencing claimed competencies against actual code architecture, unit tests, commit frequency, and job requirements to generate honest recruiter probes and prescriptive actions.

## Operating Context

- **Pre-application & interview prep ritual**: Used 1–3 weeks before active job applications or technical phone screens.
- **Documents**: PDF resumes, raw resume text, job descriptions.
- **Artifacts**: GitHub public repositories, git commit logs, package.json / requirements.txt manifests, test suites.
- **Outputs**: Profile Readiness Score (0–100), Biggest Gaps with potential recruiter questions, Claim vs. Evidence Matrix, Job Competency Alignment, and a 14-Day Remediation Plan.

## Capabilities and Constraints

- **Capabilities**:
  - PDF and raw text resume ingestion with automatic skill and claim extraction.
  - Public GitHub repository inspection (languages, stars, commits, tests, Dockerfiles, dependencies).
  - Target job description parsing (categorized required vs. preferred skills).
  - Evidence correlation engine calculating multidimensional readiness (technical evidence, project depth, role alignment, claim consistency).
  - Prescriptive 14-day roadmap with interactive milestone completion.
  - Historical audit tracking across roles.
- **Constraints**:
  - Full-stack monorepo with Next.js 16 (Turbopack) frontend on port 3000 and Express 5 + PGlite PostgreSQL backend on port 3001.
  - Zero fabrication: no fake placement statistics or hallucinated claims; honest empty and loading states.

## Brand Commitments

- **Name**: GapCheck
- **Tagline**: "Find the gaps before recruiters do."
- **Voice**: Precise, honest, technical, calm, evidence-driven, and non-hyped.
- **Visual Direction**: Dark-first SaaS interface (#0d0e11 base, hairline 1px borders, typography-led, pill controls, restrained emerald accent, no AI glowing blobs or glassmorphism).

## Evidence on Hand

- Fully operational Next.js frontend with Landing, Analyze, and Readiness Dashboard surfaces.
- Working Express API backend connected to local embedded PostgreSQL (PGlite).
- Verified demo candidate profile ("Arjun Sharma") with real parsed claims, repository evidence, and historical audits.
- Prohibited: fabricating student testimonials, company logos without partnership, or false percentage claims.

## Product Principles

1. **Evidence Over Assertion**: What is observable in code always outranks what is asserted in text.
2. **Honesty Over Flattery**: Transparently show unverified claims and likely recruiter questions rather than inflating candidate confidence.
3. **Prescriptive Action Over Passive Analysis**: Every identified gap must link directly to a concrete, verifiable engineering action (e.g. adding tests, documenting architecture, shipping a commit).
4. **Calm Technical Precision**: Clean, distraction-free product surfaces that feel like professional developer infrastructure.

## Accessibility & Inclusion

- Keyboard navigability across all pill filters, tabs, and form steps.
- High contrast off-white on dark charcoal text conforming to WCAG AA.
- Clear semantic status indicators with text labels alongside color cues.
