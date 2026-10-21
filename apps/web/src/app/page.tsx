'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Button from '@/components/ui/Button';
import Pill from '@/components/ui/Pill';
import api from '@/lib/api';

export default function Home() {
  const router = useRouter();

  const handleDemoLaunch = async () => {
    try {
      await api.loginDemo();
      router.push('/dashboard');
    } catch (err) {
      console.error('Demo login error:', err);
      router.push('/analyze');
    }
  };

  const sampleSkills = [
    {
      skill: 'React',
      category: 'Core Frontend',
      evidence: '4 public repositories with custom hooks and component architecture',
      status: 'verified',
    },
    {
      skill: 'JavaScript (ES6+)',
      category: 'Foundational Language',
      evidence: '85+ commits verified across async workflows and REST clients',
      status: 'verified',
    },
    {
      skill: 'TypeScript',
      category: 'Type Safety',
      evidence: 'Claimed on resume, only 2 untyped config files detected in code',
      status: 'weak',
    },
    {
      skill: 'Next.js App Router',
      category: 'Target Job Requirement',
      evidence: 'Zero Next.js dependencies or server component routes found',
      status: 'unverified',
    },
    {
      skill: 'Automated Testing',
      category: 'Engineering Standards',
      evidence: 'Resume claims Jest & unit tests, zero test suites detected in repos',
      status: 'unverified',
    },
  ];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col antialiased selection:bg-white/20 selection:text-white">
      <Navbar />

      <main className="flex-1">
        {/* Apple Hero Section */}
        <section className="pt-24 pb-20 border-b border-white/[0.08]">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-3xl mx-auto text-center space-y-6">
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-tight text-white leading-[1.04]">
                Find the gaps.
                <br />
                <span className="text-neutral-500 font-normal">Before recruiters do.</span>
              </h1>

              <p className="text-base sm:text-lg text-neutral-400 leading-relaxed max-w-2xl mx-auto">
                GapCheck cross-examines what you claim on your resume against what you can prove in code, cross-referenced with your target job requirements.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link href="/analyze">
                  <Button variant="primary" size="lg">
                    Run a GapCheck
                  </Button>
                </Link>
                <Button variant="secondary" size="lg" onClick={handleDemoLaunch}>
                  Explore sample profile
                </Button>
              </div>
            </div>

            {/* Apple Showcase Stage: Candidate Audit Preview */}
            <div className="mt-16 max-w-4xl mx-auto rounded-2xl border border-white/[0.1] bg-[#0c0c0e]/90 backdrop-blur-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_24px_64px_rgba(0,0,0,0.6)] overflow-hidden">
              {/* Apple macOS style window header */}
              <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-white/[0.15]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/[0.15]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-white/[0.15]" />
                  </div>
                  <span className="ml-3 text-xs text-neutral-400 font-medium tracking-tight">
                    Audit &mdash; Frontend Developer Intern
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs text-neutral-400">
                    Readiness Score:{' '}
                    <strong className="text-white font-semibold">72 / 100</strong>
                  </span>
                  <Pill variant="weak" size="sm">
                    3 critical gaps
                  </Pill>
                </div>
              </div>

              {/* Skills vs Evidence Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-neutral-500 bg-white/[0.01]">
                      <th className="py-3 px-6 font-normal">Skill Claim</th>
                      <th className="py-3 px-6 font-normal hidden sm:table-cell">Category</th>
                      <th className="py-3 px-6 font-normal">Observable Code Evidence</th>
                      <th className="py-3 px-6 font-normal text-right">Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {sampleSkills.map((item) => (
                      <tr key={item.skill} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3.5 px-6 font-medium text-white">
                          {item.skill}
                        </td>
                        <td className="py-3.5 px-6 text-neutral-400 hidden sm:table-cell">
                          {item.category}
                        </td>
                        <td className="py-3.5 px-6 text-neutral-400 max-w-sm">
                          {item.evidence}
                        </td>
                        <td className="py-3.5 px-6 text-right">
                          {item.status === 'verified' && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              Strong
                            </span>
                          )}
                          {item.status === 'weak' && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Weak
                            </span>
                          )}
                          {item.status === 'unverified' && (
                            <span className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                              Missing
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom Stage Banner */}
              <div className="px-6 py-3.5 border-t border-white/[0.06] bg-white/[0.01] flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-400">
                <p>
                  Recruiters will scrutinize Next.js and testing frameworks during round 1 technical evaluations.
                </p>
                <Link
                  href="/analyze"
                  className="text-white hover:underline font-medium inline-flex items-center gap-1"
                >
                  Inspect complete matrix &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Apple Bento Feature Section */}
        <section className="py-24 border-b border-white/[0.08]">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-xl mb-16">
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white leading-tight">
                Engineering-grade profile inspection.
              </h2>
              <p className="text-neutral-400 text-sm mt-3 leading-relaxed">
                GapCheck moves beyond keyword density to verify the technical reality behind your resume claims.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-3">
                <div className="text-xs text-neutral-500 font-medium">01</div>
                <h3 className="text-sm font-semibold text-white">Connect Profile</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Upload your PDF resume or paste raw text alongside your public GitHub username.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-3">
                <div className="text-xs text-neutral-500 font-medium">02</div>
                <h3 className="text-sm font-semibold text-white">Target Specific Roles</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Provide exact job descriptions to rank competencies into required versus preferred tiers.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-3">
                <div className="text-xs text-neutral-500 font-medium">03</div>
                <h3 className="text-sm font-semibold text-white">Inspect Real Code</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  AST analysis cross-references claims against repository languages, commits, and dependencies.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] space-y-3">
                <div className="text-xs text-neutral-500 font-medium">04</div>
                <h3 className="text-sm font-semibold text-white">Remediate Gaps</h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Follow a structured 14-day roadmap with concrete engineering tasks to strengthen evidence.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Real Claim vs Evidence Discrepancy Section */}
        <section className="py-24 border-b border-white/[0.08]">
          <div className="max-w-6xl mx-auto px-6">
            <div className="max-w-2xl mb-14">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                What technical interviewers see.
              </h2>
              <p className="text-neutral-400 text-sm mt-2">
                The difference between an assertion on paper and observable code in repositories.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Supported */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                  <span className="text-xs font-medium text-neutral-400">Claim 01</span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Supported Claim
                  </span>
                </div>

                <div>
                  <div className="text-xs text-neutral-500 font-medium mb-1">
                    Your Resume Claim
                  </div>
                  <p className="text-sm font-medium text-white leading-snug">
                    &ldquo;Architected scalable React web application with client-side state caching.&rdquo;
                  </p>
                </div>

                <div>
                  <div className="text-xs text-neutral-500 font-medium mb-1">
                    Observed GitHub Evidence
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Repository verified. Custom React hooks, component modularity, clean git commit history, and active deployment link confirmed.
                  </p>
                </div>
              </div>

              {/* Card 2: Unverified */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                  <span className="text-xs font-medium text-neutral-400">Claim 02</span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    Unverified Claim
                  </span>
                </div>

                <div>
                  <div className="text-xs text-neutral-500 font-medium mb-1">
                    Your Resume Claim
                  </div>
                  <p className="text-sm font-medium text-white leading-snug">
                    &ldquo;Extensive experience writing automated test suites and integration tests.&rdquo;
                  </p>
                </div>

                <div>
                  <div className="text-xs text-neutral-500 font-medium mb-1">
                    Observed GitHub Evidence
                  </div>
                  <p className="text-xs text-neutral-400 leading-relaxed">
                    Zero test runners (Jest, Vitest, Cypress) found in package manifests. No test files detected across public repositories.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Apple CTA Section */}
        <section className="py-24">
          <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
            <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight text-white leading-tight">
              Test your profile readiness.
            </h2>
            <p className="text-sm sm:text-base text-neutral-400 max-w-lg mx-auto leading-relaxed">
              Audit your resume and GitHub profile in 60 seconds with GapCheck. Free and instant with demo profiles.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Link href="/analyze">
                <Button variant="primary" size="lg">
                  Run a GapCheck
                </Button>
              </Link>
              <Button variant="secondary" size="lg" onClick={handleDemoLaunch}>
                Try demo profile
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.08] py-8 bg-black">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-neutral-300 font-medium">GapCheck</span>
            <span>&mdash; Find the gaps before recruiters do.</span>
          </div>
          <div>
            <span>Placement readiness platform</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
