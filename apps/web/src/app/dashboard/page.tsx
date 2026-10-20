'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Search, 
  Target, 
  GitBranch, 
  Check, 
  HelpCircle, 
  Clock, 
  Flame, 
  TrendingUp, 
  Layers, 
  ChevronDown, 
  ChevronUp, 
  RefreshCw, 
  AlertCircle, 
  ArrowRight 
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';

interface Finding {
  id: string;
  skill: string;
  category?: string;
  evidenceStatus: 'verified' | 'supported' | 'weakly_supported' | 'unverified';
  confidence: number;
  resumeClaim: string | null;
  assessment: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  evidenceSources?: Array<{ source?: string; repository?: string; evidence?: string }>;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  interviewQuestion?: string;
  honestAnswer?: string;
  bluffWarning?: string;
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  day?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  completed?: boolean;
}

interface Recommendation {
  id: string;
  title: string;
  observation: string;
  problem: string;
  recommendation: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

interface DashboardData {
  user: {
    id: string;
    name?: string;
    email: string;
    targetRole?: string;
  };
  hasAnalysis: boolean;
  latestAnalysis: {
    id: string;
    targetRole?: string;
    overallScore?: number;
    summary?: string;
    createdAt?: string;
  } | null;
  findings: Finding[];
  recommendations: Recommendation[];
  actionPlan: ActionItem[];
  stats?: {
    totalSkills: number;
    verifiedSkills: number;
    unverifiedSkills: number;
    weakSkills: number;
    totalRecommendations: number;
    criticalIssues: number;
    highIssues: number;
  };
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  const [activeTab, setActiveTab] = useState<'matrix' | 'defense' | 'roadmap'>('matrix');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFindingId, setExpandedFindingId] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const token = api.getToken();
    if (!token) {
      try {
        await api.loginDemo();
      } catch {
        router.push('/analyze');
        return;
      }
    }

    try {
      const res = await api.getDashboard();
      setData(res as unknown as DashboardData);
      if (res.findings && res.findings.length > 0) {
        setExpandedFindingId((res.findings[0] as unknown as Finding).id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load readiness dashboard';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    let isCancelled = false;

    const init = async () => {
      const token = api.getToken();
      if (!token) {
        try {
          await api.loginDemo();
        } catch {
          if (!isCancelled) router.push('/analyze');
          return;
        }
      }

      try {
        const res = await api.getDashboard();
        if (!isCancelled) {
          setData(res as unknown as DashboardData);
          if (res.findings && res.findings.length > 0) {
            setExpandedFindingId((res.findings[0] as unknown as Finding).id);
          }
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const msg = err instanceof Error ? err.message : 'Failed to load readiness dashboard';
          setError(msg);
          setLoading(false);
        }
      }
    };

    void init();

    return () => {
      isCancelled = true;
    };
  }, [router]);

  const toggleStep = (stepKey: string) => {
    setCompletedSteps(prev => ({
      ...prev,
      [stepKey]: !prev[stepKey]
    }));
  };

  // Process findings to generate interview defense helpers if not provided
  const enrichedFindings: Finding[] = (data?.findings || []).map((f) => {
    const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 
      f.priority === 'critical' || f.evidenceStatus === 'weakly_supported' || f.evidenceStatus === 'unverified'
        ? 'HIGH'
        : f.evidenceStatus === 'supported'
        ? 'MEDIUM'
        : 'LOW';

    let interviewQuestion = f.interviewQuestion;
    let honestAnswer = f.honestAnswer;
    let bluffWarning = f.bluffWarning;

    if (!interviewQuestion) {
      if (f.evidenceStatus === 'weakly_supported') {
        interviewQuestion = `How did you implement ${f.skill} in your projects, and what architectural tradeoffs did you face?`;
        honestAnswer = `I have worked with ${f.skill} in basic project implementations and understand its core paradigms, but I am honest about not having scaled it in a multi-region production environment yet.`;
        bluffWarning = `Do not claim you tuned high-concurrency clusters or managed complex sharding for ${f.skill}.`;
      } else if (f.evidenceStatus === 'unverified') {
        interviewQuestion = `Can you explain your experience with ${f.skill} and how you would architect a solution with it?`;
        honestAnswer = `I have studied ${f.skill} conceptually and built tutorial demonstrations, but I do not currently have a production-grade repository in my portfolio. I have an actionable plan to build one.`;
        bluffWarning = `CRITICAL ALERT: Claiming extensive hands-on experience without observable code evidence is a primary interview trap.`;
      } else {
        interviewQuestion = `Walk me through your implementation of ${f.skill} and how you verified its reliability.`;
        honestAnswer = `I implemented ${f.skill} with active commits, structured tests, and verified configurations. I can walk through the architecture end-to-end.`;
      }
    }

    return {
      ...f,
      riskLevel,
      interviewQuestion,
      honestAnswer,
      bluffWarning,
    };
  });

  const verifiedCount = enrichedFindings.filter(f => f.evidenceStatus === 'verified').length;
  const supportedCount = enrichedFindings.filter(f => f.evidenceStatus === 'supported').length;
  const fragileCount = enrichedFindings.filter(f => f.evidenceStatus === 'weakly_supported').length;
  const unverifiedCount = enrichedFindings.filter(f => f.evidenceStatus === 'unverified').length;

  const overallScore = data?.latestAnalysis?.overallScore 
    ? Math.round(data.latestAnalysis.overallScore)
    : enrichedFindings.length > 0
    ? Math.round(((verifiedCount * 1.0 + supportedCount * 0.75 + fragileCount * 0.35 + unverifiedCount * 0.05) / enrichedFindings.length) * 100)
    : 0;

  const filteredFindings = enrichedFindings.filter((f) => {
    const matchesFilter = filterStatus === 'all' || f.evidenceStatus === filterStatus;
    const matchesSearch =
      f.skill.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.category && f.category.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  // LOADING STATE
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-[#e8e8ed] flex flex-col">
        <Navbar />
        <main className="max-w-7xl mx-auto px-6 py-16 w-full flex-1 flex flex-col items-center justify-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <h2 className="text-xl font-bold text-white">Loading GapCheck Audit...</h2>
          <p className="text-xs text-zinc-400">Retrieving personalized evidence findings and verification metrics</p>
        </main>
      </div>
    );
  }

  // ERROR STATE
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-[#e8e8ed] flex flex-col">
        <Navbar />
        <main className="max-w-xl mx-auto px-6 py-20 w-full flex-1 flex flex-col items-center text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-white">We couldn&apos;t load your analysis</h2>
          <p className="text-xs text-zinc-400">{error}</p>
          <div className="flex gap-3 pt-2">
            <button
              onClick={fetchDashboardData}
              className="btn-primary text-xs flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
            <Link href="/analyze" className="btn-secondary text-xs">
              Go to Audit Studio
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // EMPTY STATE
  if (!data?.hasAnalysis || enrichedFindings.length === 0) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-[#e8e8ed] flex flex-col">
        <Navbar />
        <main className="max-w-xl mx-auto px-6 py-20 w-full flex-1 flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold text-white">No Analysis Yet</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Run your first GapCheck audit to see where your profile is strong, where evidence is missing, and what you should build next to succeed in interviews.
            </p>
          </div>
          <Link
            href="/analyze"
            className="btn-primary text-sm flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30"
          >
            <span>Launch Your First Audit</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e8ed] flex flex-col">
      <Navbar />

      <main className="max-w-7xl mx-auto px-6 py-8 w-full flex-1 space-y-8">
        {/* Top Candidate Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-6 rounded-2xl bg-gradient-to-r from-[#16161f] via-[#12121a] to-[#16161f] border border-[#2a2a3a]">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-indigo-500/20">
              {data.user?.name ? data.user.name.slice(0, 2).toUpperCase() : 'GC'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white">{data.user?.name || 'Verified Candidate'}</h1>
                <span className="badge badge-supported text-[10px]">GapCheck Audit</span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Target Role: <strong className="text-white">{data.latestAnalysis?.targetRole || data.user?.targetRole || 'Software Engineer'}</strong> • Verified Claims vs Evidence
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-zinc-400">Readiness Score</div>
                <div className="text-2xl font-black text-indigo-400">{overallScore}%</div>
              </div>
              <div className="w-12 h-12 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 flex items-center justify-center font-bold text-xs text-indigo-300">
                {overallScore}%
              </div>
            </div>

            <div className="h-8 w-[1px] bg-[#2a2a3a] hidden sm:block" />

            <div className="flex items-center gap-2 text-xs">
              <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <span className="font-bold">{verifiedCount + supportedCount}</span> Verified/Supported
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <span className="font-bold">{fragileCount}</span> Fragile
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
                <span className="font-bold">{unverifiedCount}</span> Unverified
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 border-b border-[#2a2a3a] pb-2">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'matrix'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'text-zinc-400 hover:text-white hover:bg-[#16161f]'
            }`}
          >
            <Layers className="w-4 h-4" />
            Proof-of-Skill Matrix ({enrichedFindings.length})
          </button>

          <button
            onClick={() => setActiveTab('defense')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'defense'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'text-zinc-400 hover:text-white hover:bg-[#16161f]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            Interview Defense Cheat Sheet
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          </button>

          <button
            onClick={() => setActiveTab('roadmap')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'roadmap'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'text-zinc-400 hover:text-white hover:bg-[#16161f]'
            }`}
          >
            <Target className="w-4 h-4" />
            Build Prescription & Roadmap ({(data.actionPlan || []).length})
          </button>
        </div>

        {/* TAB 1: PROOF MATRIX */}
        {activeTab === 'matrix' && (
          <div className="space-y-6">
            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter skills or categories..."
                  className="input pl-9 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer ${
                    filterStatus === 'all'
                      ? 'bg-white text-black font-semibold'
                      : 'bg-[#16161f] text-zinc-400 border border-[#2a2a3a]'
                  }`}
                >
                  All ({enrichedFindings.length})
                </button>
                <button
                  onClick={() => setFilterStatus('verified')}
                  className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer ${
                    filterStatus === 'verified'
                      ? 'bg-emerald-500 text-black font-semibold'
                      : 'bg-[#16161f] text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  Verified ({verifiedCount})
                </button>
                <button
                  onClick={() => setFilterStatus('weakly_supported')}
                  className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer ${
                    filterStatus === 'weakly_supported'
                      ? 'bg-amber-500 text-black font-semibold'
                      : 'bg-[#16161f] text-amber-400 border border-amber-500/20'
                  }`}
                >
                  Fragile ({fragileCount})
                </button>
                <button
                  onClick={() => setFilterStatus('unverified')}
                  className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer ${
                    filterStatus === 'unverified'
                      ? 'bg-rose-500 text-white font-semibold'
                      : 'bg-[#16161f] text-rose-400 border border-rose-500/20'
                  }`}
                >
                  Unverified ({unverifiedCount})
                </button>
              </div>
            </div>

            {/* Findings List */}
            <div className="space-y-3">
              {filteredFindings.map((finding) => {
                const isExpanded = expandedFindingId === finding.id;

                let badge = (
                  <span className="badge badge-unverified">
                    <XCircle className="w-3.5 h-3.5" />
                    Unverified
                  </span>
                );
                if (finding.evidenceStatus === 'verified') {
                  badge = (
                    <span className="badge badge-verified">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Strong Proof
                    </span>
                  );
                } else if (finding.evidenceStatus === 'supported') {
                  badge = (
                    <span className="badge badge-supported">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Supported
                    </span>
                  );
                } else if (finding.evidenceStatus === 'weakly_supported') {
                  badge = (
                    <span className="badge badge-weakly-supported">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Fragile Claim
                    </span>
                  );
                }

                return (
                  <div
                    key={finding.id}
                    className={`rounded-xl border transition-all ${
                      isExpanded
                        ? 'bg-[#16161f] border-indigo-500/40 shadow-xl'
                        : 'bg-[#12121a] border-[#2a2a3a] hover:border-zinc-700'
                    }`}
                  >
                    <div
                      onClick={() => setExpandedFindingId(isExpanded ? null : finding.id)}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 shrink-0" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white capitalize">{finding.skill}</span>
                            {finding.category && (
                              <span className="text-[11px] text-zinc-500 font-mono">
                                {finding.category}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 mt-0.5 line-clamp-1">
                            {finding.assessment}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end sm:self-center">
                        <div className="text-right hidden sm:block">
                          <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                            Confidence
                          </div>
                          <div className="text-xs font-mono font-bold text-indigo-400">
                            {Math.round(finding.confidence * 100)}%
                          </div>
                        </div>

                        {badge}

                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <div className="px-5 pb-5 pt-2 border-t border-[#2a2a3a] space-y-4 text-xs bg-[#12121a]/60 rounded-b-xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className="space-y-1">
                            <div className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold">
                              Claim Context from Profile:
                            </div>
                            <div className="p-3 rounded-lg bg-[#0a0a0f] border border-[#2a2a3a] text-zinc-300 font-mono text-[11px]">
                              {finding.resumeClaim ? `Claimed on resume: "${finding.resumeClaim}"` : `Required by job description target, missing from resume.`}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div className="text-zinc-500 text-[10px] uppercase tracking-wider font-semibold">
                              Observable Evidence:
                            </div>
                            <div className="p-3 rounded-lg bg-[#0a0a0f] border border-[#2a2a3a] text-zinc-300 text-[11px]">
                              {finding.assessment}
                              {finding.evidenceSources && finding.evidenceSources.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {finding.evidenceSources.slice(0, 2).map((s, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 text-indigo-400 font-mono text-[10px]">
                                      <GitBranch className="w-3 h-3" />
                                      {s.repository ? `Repo: ${s.repository}` : s.source}: {s.evidence}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Interview Defense Talking Point */}
                        {finding.riskLevel === 'HIGH' && (
                          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                            <div className="flex items-center gap-2 text-amber-400 font-bold">
                              <AlertTriangle className="w-4 h-4" />
                              Interview Risk Assessment
                            </div>
                            <p className="text-zinc-300 leading-relaxed">
                              {finding.bluffWarning}
                            </p>
                            <div className="pt-2 border-t border-amber-500/20 text-zinc-400">
                              <span className="font-semibold text-white">Recommended Honest Talking Point:</span>
                              <div className="mt-1 text-zinc-300 italic font-mono bg-black/40 p-2.5 rounded">
                                &quot;{finding.honestAnswer}&quot;
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: INTERVIEW DEFENSE */}
        {activeTab === 'defense' && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-500/10 via-[#16161f] to-rose-500/10 border border-amber-500/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <ShieldCheck className="w-5 h-5" />
                Interviewer Attack Vector Prediction
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed max-w-3xl">
                Senior engineering interviewers look for gaps and buzzwords. 
                Below are the exact questions you will face on your unverified or fragile claims, with model honest defenses that protect your credibility.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {enrichedFindings
                .filter(f => f.interviewQuestion)
                .map((f, idx) => (
                  <div key={idx} className="card space-y-4 border-amber-500/20 hover:border-amber-500/40">
                    <div className="flex items-center justify-between pb-2 border-b border-[#2a2a3a]">
                      <span className="text-sm font-bold text-white capitalize">{f.skill}</span>
                      <span className={`badge ${f.riskLevel === 'HIGH' ? 'priority-critical' : 'priority-medium'} text-[10px]`}>
                        {f.riskLevel} RISK
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-rose-400 flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5" />
                        Anticipated Question:
                      </div>
                      <p className="text-xs font-mono bg-[#12121a] p-3 rounded-lg border border-[#2a2a3a] text-zinc-200">
                        &quot;{f.interviewQuestion}&quot;
                      </p>
                    </div>

                    {f.bluffWarning && (
                      <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] leading-relaxed">
                        ⛔ <strong>Trap:</strong> {f.bluffWarning}
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approved Honest Defense:
                      </div>
                      <p className="text-xs bg-[#12121a] p-3 rounded-lg border border-[#2a2a3a] text-zinc-300 italic leading-relaxed">
                        &quot;{f.honestAnswer}&quot;
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* TAB 3: ROADMAP & BUILD PRESCRIPTION */}
        {activeTab === 'roadmap' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-[#16161f] border border-[#2a2a3a]">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-indigo-400" />
                  Targeted Build Prescription & Gaps
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Complete these targeted project increments to eliminate gap warnings and boost your readiness score.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs bg-indigo-500/10 border border-indigo-500/30 px-3.5 py-2 rounded-xl text-indigo-300">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <span>Action Items: <strong>{(data.actionPlan || []).length} Milestones</strong></span>
              </div>
            </div>

            <div className="space-y-4">
              {(data.actionPlan || []).map((act, aIdx) => (
                <div key={act.id || aIdx} className="card space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2a2a3a]">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">{act.title}</span>
                        <span className="badge priority-critical text-[9px] uppercase">{act.priority || 'high'}</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">{act.description}</p>
                    </div>

                    {act.day && (
                      <div className="flex items-center gap-1 text-xs text-zinc-400 font-mono">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{act.day}</span>
                      </div>
                    )}
                  </div>

                  <div
                    onClick={() => toggleStep(`step-${aIdx}`)}
                    className={`p-3 rounded-lg border text-xs flex items-center gap-3 cursor-pointer transition-all ${
                      completedSteps[`step-${aIdx}`]
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 line-through'
                        : 'bg-[#12121a] border-[#2a2a3a] text-zinc-300 hover:border-zinc-600'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      completedSteps[`step-${aIdx}`] ? 'bg-emerald-500 border-emerald-500 text-black' : 'border-zinc-600'
                    }`}>
                      {completedSteps[`step-${aIdx}`] && <Check className="w-3 h-3 font-bold" />}
                    </div>
                    <span>Mark milestone completed</span>
                  </div>
                </div>
              ))}

              {(!data.actionPlan || data.actionPlan.length === 0) && (
                <div className="p-8 text-center text-xs text-zinc-500">
                  No action items generated yet.
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
