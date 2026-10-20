'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Sparkles, 
  FileText, 
  Target, 
  Layers, 
  TrendingUp, 
  Check 
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';

export default function Home() {
  const router = useRouter();

  const handleLaunchDemo = async () => {
    try {
      await api.loginDemo();
      router.push('/dashboard');
    } catch (err) {
      console.error('Demo launch error:', err);
      router.push('/analyze');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e8ed] flex flex-col selection:bg-indigo-500/30">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-20 pb-24 overflow-hidden border-b border-[#2a2a3a]/50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col items-center text-center max-w-4xl mx-auto space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold animate-fade-in">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Evidence-Based Placement Readiness</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.1] animate-slide-up">
              Find the gaps{' '}
              <span className="gradient-text block mt-1">
                before recruiters do.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-zinc-400 max-w-2xl leading-relaxed">
              Don&apos;t get caught in technical interviews with fragile resume buzzwords. 
              GapCheck cross-verifies your resume claims against real GitHub code, commit history, 
              test coverage, and target job requirements — generating an unshakeable proof matrix and targeted gap roadmap.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <button
                onClick={handleLaunchDemo}
                className="btn-primary text-sm font-semibold shadow-xl shadow-indigo-600/25 flex items-center gap-2 cursor-pointer"
              >
                Launch One-Click Demo
                <ArrowRight className="w-4 h-4" />
              </button>
              
              <Link
                href="/analyze"
                className="btn-secondary text-sm font-semibold flex items-center gap-2"
              >
                <FileText className="w-4 h-4 text-zinc-400" />
                Audit My Resume & GitHub
              </Link>
            </div>

            {/* Quick Proof Matrix Snapshot */}
            <div className="w-full mt-14 p-1 rounded-2xl bg-gradient-to-b from-[#2a2a3a] to-[#12121a] shadow-2xl">
              <div className="bg-[#12121a] rounded-[14px] p-6 text-left border border-[#2a2a3a]">
                <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#2a2a3a]">
                  <div>
                    <div className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                      GapCheck Candidate Audit Sample
                    </div>
                    <div className="text-lg font-bold text-white flex items-center gap-2 mt-0.5">
                      Arjun Sharma 
                      <span className="text-xs font-normal text-zinc-400">• Target: Full-Stack Developer</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-zinc-400">Readiness Score</div>
                      <div className="text-xl font-black text-indigo-400">74%</div>
                    </div>
                    <div className="w-10 h-10 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                  {/* Item 1 */}
                  <div className="p-3.5 rounded-xl bg-[#16161f] border border-[#2a2a3a] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">Docker & Containers</span>
                      <span className="badge badge-verified text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        Strong Proof
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Multi-stage Dockerfile and container orchestration verified across projects with active commits.
                    </p>
                    <div className="text-[11px] text-emerald-400 font-mono">Confidence: 94%</div>
                  </div>

                  {/* Item 2 */}
                  <div className="p-3.5 rounded-xl bg-[#16161f] border border-[#2a2a3a] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">PostgreSQL & DB</span>
                      <span className="badge badge-supported text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        Supported
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Active schema definitions, migrations, and relational queries verified.
                    </p>
                    <div className="text-[11px] text-blue-400 font-mono">Confidence: 82%</div>
                  </div>

                  {/* Item 3 */}
                  <div className="p-3.5 rounded-xl bg-[#16161f] border border-[#2a2a3a] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">Redis & Caching</span>
                      <span className="badge badge-weakly-supported text-[10px]">
                        <AlertTriangle className="w-3 h-3" />
                        Fragile Claim
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Imported in package.json but only used for a simple tutorial snippet. High interview trap!
                    </p>
                    <div className="text-[11px] text-amber-400 font-mono">Defense Alert: High Risk</div>
                  </div>

                  {/* Item 4 */}
                  <div className="p-3.5 rounded-xl bg-[#16161f] border border-[#2a2a3a] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">Kubernetes / K8s</span>
                      <span className="badge badge-unverified text-[10px]">
                        <XCircle className="w-3 h-3" />
                        Unverified Gap
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Required by target job description, but zero manifests or cluster configs found in GitHub.
                    </p>
                    <div className="text-[11px] text-rose-400 font-mono">Prescription: Build K8s Pod</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why GapCheck Section */}
      <section className="py-20 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            The Placement Readiness Gap Solved
          </h2>
          <p className="text-zinc-400 text-sm mt-3">
            Students list 20+ technologies on their resume. Interviewers grill them on the exact skills they barely touched.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card space-y-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">4-Tier Verification Engine</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              We don&apos;t just check keyword matches. We inspect AST syntax, commit longevity, author contribution ratios, unit tests, and real configurations.
            </p>
            <ul className="text-xs text-zinc-300 space-y-1.5 pt-2">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                Strong Proof (Production-level depth)
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-blue-400" />
                Supported (Solid implementation)
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-amber-400" />
                Fragile (Surface tutorial / clone)
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-rose-400" />
                Unverified (Missing from public code)
              </li>
            </ul>
          </div>

          <div className="card space-y-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Interview Defense Generator</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              For any skill detected as fragile or unverified, get predictive questions that senior interviewers are guaranteed to ask, along with honest, credible answers.
            </p>
            <div className="p-3 bg-[#12121a] rounded-lg border border-[#2a2a3a] text-xs space-y-1 font-mono">
              <div className="text-rose-400 text-[10px]">Q: &quot;How did you configure Redis in production?&quot;</div>
              <div className="text-zinc-300 text-[11px] leading-tight">
                Honest defense provided: explain LRU caching fundamentals without pretending you ran a distributed cluster.
              </div>
            </div>
          </div>

          <div className="card space-y-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Target className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-bold text-white">Targeted Build Prescription</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Don&apos;t just get a list of mistakes. GapCheck gives you targeted project milestones to turn fragile skills into verified proof in under 48 hours.
            </p>
            <div className="flex items-center gap-2 text-xs text-indigo-400 font-semibold pt-2">
              <TrendingUp className="w-4 h-4" />
              Direct path to +25% readiness score
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 bg-[#12121a]/50 border-y border-[#2a2a3a]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              Zero Friction Workflow
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white mt-1">
              How GapCheck Works in 3 Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3 relative">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
                1
              </div>
              <h4 className="text-base font-bold text-white">Upload Resume & Target JD</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Paste or drop your current resume. Select or paste your dream job description.
              </p>
            </div>

            <div className="space-y-3 relative">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
                2
              </div>
              <h4 className="text-base font-bold text-white">Audit Public GitHub Repos</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Our evidence engine maps resume bullet points to real repo ASTs, commit trees, dependencies, and test files.
              </p>
            </div>

            <div className="space-y-3 relative">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-lg">
                3
              </div>
              <h4 className="text-base font-bold text-white">Get Gap Matrix & Defense</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Walk into technical rounds with 100% confidence. Defend what you built, know your gaps, and build what you&apos;re missing.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <footer className="mt-auto py-12 border-t border-[#2a2a3a] px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-zinc-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-white">GapCheck</span> — Find the gaps before recruiters do.
          </div>
          <div>
            Built for engineering students & ambitious builders.
          </div>
        </div>
      </footer>
    </div>
  );
}
