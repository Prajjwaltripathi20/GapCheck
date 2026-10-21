'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Button from '@/components/ui/Button';
import Pill from '@/components/ui/Pill';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import api from '@/lib/api';

interface Finding {
  id: string;
  skill: string;
  resumeClaim?: string | null;
  claimLevel?: string;
  evidenceStatus: 'verified' | 'supported' | 'weakly_supported' | 'unverified' | 'unknown' | 'partial';
  assessment: string;
  confidence: number;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  evidenceSources?: Array<{
    source: string;
    repository?: string;
    file?: string;
    evidence: string;
    confidence?: number;
  }>;
  interviewQuestion?: string;
  honestAnswer?: string;
  category?: string;
}

interface Recommendation {
  id: string;
  title: string;
  observation: string;
  problem: string;
  hiringImpact?: string;
  recommendation: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  targetProject?: string;
  actionType?: string;
}

interface ActionItem {
  id: string;
  day: string;
  title: string;
  description: string;
  completed?: boolean;
  priority?: string;
}

interface HistoricalAnalysis {
  id: string;
  targetRole?: string;
  overallScore?: number;
  status: string;
  createdAt: string;
  summary?: string;
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
    dimensions?: {
      resumeQuality?: number;
      engineeringEvidence?: number;
      roleAlignment?: number;
      claimConsistency?: number;
      projectDepth?: number;
      technicalEvidence?: number;
    };
  } | null;
  findings: Finding[];
  recommendations: Recommendation[];
  actionPlan: ActionItem[];
  progressHistory?: Array<{
    id: string;
    overallScore: number;
    createdAt: string;
  }>;
  stats?: {
    totalSkills: number;
    verifiedSkills: number;
    unverifiedSkills: number;
    weakSkills: number;
    totalRecommendations: number;
    criticalIssues: number;
    highIssues: number;
    repositoriesAnalyzed: number;
  };
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedAnalysisId = searchParams.get('analysisId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [historyList, setHistoryList] = useState<HistoricalAnalysis[]>([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string | null>(requestedAnalysisId);

  // Sync selectedAnalysisId if URL param changes (e.g. from /analyze or history)
  useEffect(() => {
    setSelectedAnalysisId(requestedAnalysisId);
  }, [requestedAnalysisId]);

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'gaps' | 'claims' | 'requirements' | 'plan' | 'history'>('gaps');

  // Filter for claims
  const [claimFilter, setClaimFilter] = useState<'all' | 'verified' | 'supported' | 'partial' | 'unverified'>('all');

  // Evidence Explorer modal state
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);

  // Dimension explanation drawer
  const [showScoreModal, setShowScoreModal] = useState(false);

  // PDF Download loading states
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [downloadingResume, setDownloadingResume] = useState(false);

  // Milestone completion map
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;

    async function loadData(targetId?: string | null) {
      setLoading(true);
      setError(null);

      const token = api.getToken();
      if (!token) {
        try {
          await api.loginDemo();
        } catch {
          if (active) router.push('/analyze');
          return;
        }
      }

      try {
        const res = await api.getDashboard(targetId || undefined);
        if (active) {
          setData(res as unknown as DashboardData);
          // Sync action items completed status
          if (res.actionPlan) {
            const initialMap: Record<string, boolean> = {};
            (res.actionPlan as unknown as ActionItem[]).forEach((item) => {
              if (item.id) initialMap[item.id] = !!item.completed;
            });
            setCompletedSteps(initialMap);
          }
          setLoading(false);
        }

        try {
          const hist = await api.getAnalyses();
          if (active && hist.analyses) {
            setHistoryList(hist.analyses as unknown as HistoricalAnalysis[]);
          }
        } catch (histErr) {
          console.warn('Failed to load history list:', histErr);
        }
      } catch (err: unknown) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Failed to load readiness dashboard';
          setError(msg);
          setLoading(false);
        }
      }
    }

    loadData(selectedAnalysisId);

    return () => {
      active = false;
    };
  }, [router, selectedAnalysisId]);

  const handleSelectHistoryItem = (id: string) => {
    setSelectedAnalysisId(id);
    router.push(`/dashboard?analysisId=${id}`);
  };

  const handleDownloadReport = async () => {
    if (!data?.latestAnalysis?.id) return;
    setDownloadingReport(true);
    try {
      await api.downloadAuditReport(data.latestAnalysis.id, `GapCheck_Audit_Report_${data.user.name || 'Candidate'}.pdf`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to download report.';
      alert(msg);
    } finally {
      setDownloadingReport(false);
    }
  };

  const handleDownloadResume = async () => {
    if (!data?.latestAnalysis?.id) return;
    setDownloadingResume(true);
    try {
      await api.downloadAnnotatedResume(data.latestAnalysis.id, `GapCheck_Annotated_Resume_${data.user.name || 'Candidate'}.pdf`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to download annotated resume.';
      alert(msg);
    } finally {
      setDownloadingResume(false);
    }
  };

  const toggleActionItem = async (actionId: string, currentStatus: boolean) => {
    // Optimistic UI update
    setCompletedSteps((prev) => ({
      ...prev,
      [actionId]: !currentStatus,
    }));

    try {
      await api.toggleActionItem(actionId, !currentStatus);
    } catch (err) {
      console.warn('Failed to persist action item in DB:', err);
      // Revert if error
      setCompletedSteps((prev) => ({
        ...prev,
        [actionId]: currentStatus,
      }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col antialiased">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center space-y-3">
            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
            <p className="text-xs text-neutral-400 font-medium font-mono">Loading GapCheck audit data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col antialiased">
        <Navbar />
        <div className="flex-1 max-w-xl mx-auto px-6 py-20 text-center">
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs mb-6">
            {error}
          </div>
          <Button variant="primary" onClick={() => setSelectedAnalysisId(null)}>
            Retry Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!data || !data.hasAnalysis || !data.latestAnalysis) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col antialiased">
        <Navbar />
        <div className="flex-1 max-w-2xl mx-auto px-6 py-24 flex items-center justify-center">
          <EmptyState
            title="No analysis yet."
            description="Run your first GapCheck to discover what your profile can prove and where the biggest interview gaps are."
            actionLabel="Run GapCheck →"
            onAction={() => router.push('/analyze')}
          />
        </div>
      </div>
    );
  }

  const { latestAnalysis, findings = [], actionPlan = [], stats, user } = data;
  const overallScore = latestAnalysis.overallScore ?? 72;

  // Filter findings for claims matrix
  const filteredFindings = findings.filter((f) => {
    const st = f.evidenceStatus === 'weakly_supported' ? 'partial' : f.evidenceStatus;
    if (claimFilter === 'all') return true;
    if (claimFilter === 'verified') return st === 'verified';
    if (claimFilter === 'supported') return st === 'supported';
    if (claimFilter === 'partial') return st === 'partial';
    if (claimFilter === 'unverified') return st === 'unverified';
    return true;
  });

  // Prioritized gaps (unverified & partial)
  const prioritizedGaps = findings.filter(
    (f) => f.evidenceStatus === 'unverified' || f.evidenceStatus === 'weakly_supported'
  ).sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.priority || 'medium'] || 2) - (order[b.priority || 'medium'] || 2);
  });

  // Circular gauge calculations (r = 28, circ = 175.9)
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col antialiased selection:bg-white/20 selection:text-white">
      <Navbar />

      <main className="flex-1 py-12">
        <div className="max-w-6xl mx-auto px-6 space-y-10">
          {/* Top Header & Overview */}
          <div className="border-b border-white/[0.08] pb-8">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div>
                <div className="flex items-center gap-2 text-xs text-neutral-400 mb-2">
                  <span>Candidate: {user.name || 'Candidate'}</span>
                  <span className="text-neutral-600">&bull;</span>
                  <span>
                    {latestAnalysis.createdAt
                      ? new Date(latestAnalysis.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Today'}
                  </span>
                </div>

                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
                  {latestAnalysis.targetRole || user.targetRole || 'Software Engineer'}
                </h1>

                <p className="text-sm text-neutral-400 mt-2 max-w-2xl leading-relaxed">
                  {stats && stats.unverifiedSkills > 0
                    ? `Audit complete across code repositories. Found ${stats.verifiedSkills} verified claims, ${stats.weakSkills} partial claims, and ${stats.unverifiedSkills} unverified claims requiring remediation.`
                    : 'Evidence correlation complete. All major technical competencies verified against public code.'}
                </p>
              </div>

              {/* Header Actions & Score */}
              <div className="flex flex-wrap items-center gap-4">
                {/* PDF Report & Rescan Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownloadReport}
                    disabled={downloadingReport}
                  >
                    {downloadingReport ? 'Generating PDF...' : 'Audit Report (PDF)'}
                  </Button>

                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleDownloadResume}
                    disabled={downloadingResume}
                  >
                    {downloadingResume ? 'Annotating...' : 'Annotated Resume (PDF)'}
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => router.push('/analyze')}
                  >
                    Re-run Audit ↺
                  </Button>
                </div>

                {/* Score Widget */}
                <div
                  onClick={() => setShowScoreModal(true)}
                  className="flex items-center gap-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/[0.2] px-4 py-3 rounded-2xl shrink-0 backdrop-blur-xl cursor-pointer transition-all"
                  title="Click to view scoring dimension breakdown"
                >
                  <div className="relative w-14 h-14 flex items-center justify-center">
                    <svg className="w-14 h-14 transform -rotate-90">
                      <circle
                        cx="28"
                        cy="28"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="4.5"
                        className="text-white/[0.1]"
                        fill="transparent"
                      />
                      <circle
                        cx="28"
                        cy="28"
                        r={radius}
                        stroke="currentColor"
                        strokeWidth="4.5"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="text-emerald-400 transition-all duration-1000 ease-out"
                        fill="transparent"
                      />
                    </svg>
                    <span className="absolute text-sm font-semibold text-white">
                      {Math.round(overallScore)}%
                    </span>
                  </div>

                  <div className="space-y-0.5 text-xs">
                    <div className="font-semibold text-white flex items-center gap-1">
                      <span>Readiness</span>
                      <span className="text-[10px] text-neutral-500 font-mono">ℹ</span>
                    </div>
                    <div className="text-[11px] text-emerald-400">
                      {stats?.verifiedSkills ?? 0} verified
                    </div>
                    <div className="text-[11px] text-rose-400">
                      {stats?.unverifiedSkills ?? 0} unverified
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Apple Segmented Control Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 mt-8 pt-6 border-t border-white/[0.06]">
              <Pill
                size="sm"
                interactive
                selected={activeTab === 'gaps'}
                onClick={() => setActiveTab('gaps')}
              >
                Biggest Gaps ({prioritizedGaps.length})
              </Pill>
              <Pill
                size="sm"
                interactive
                selected={activeTab === 'claims'}
                onClick={() => setActiveTab('claims')}
              >
                Claims & Evidence ({findings.length})
              </Pill>
              <Pill
                size="sm"
                interactive
                selected={activeTab === 'requirements'}
                onClick={() => setActiveTab('requirements')}
              >
                Job Alignment
              </Pill>
              <Pill
                size="sm"
                interactive
                selected={activeTab === 'plan'}
                onClick={() => setActiveTab('plan')}
              >
                14-Day Roadmap ({actionPlan.length})
              </Pill>
              <Pill
                size="sm"
                interactive
                selected={activeTab === 'history'}
                onClick={() => setActiveTab('history')}
              >
                History ({historyList.length || 1})
              </Pill>
            </div>
          </div>

          {/* TAB 1: Biggest Gaps */}
          {activeTab === 'gaps' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Prioritized Technical Gaps
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Skills with missing or partial public evidence that represent high vulnerability in technical interviews.
                  </p>
                </div>
                <span className="text-xs text-neutral-500 font-mono">
                  {prioritizedGaps.length} detected
                </span>
              </div>

              {prioritizedGaps.length === 0 ? (
                <EmptyState
                  title="No critical gaps detected."
                  description="All resume claims have verifiable repository evidence and align with your target role."
                />
              ) : (
                <div className="space-y-4">
                  {prioritizedGaps.map((gap, idx) => {
                    const statusText = gap.evidenceStatus === 'weakly_supported' ? 'PARTIAL' : gap.evidenceStatus.toUpperCase();
                    return (
                      <div
                        key={gap.id || idx}
                        className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6 space-y-4 hover:border-white/[0.2] transition-all"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="flex items-start gap-3">
                            <span className="text-xs font-mono text-neutral-500 mt-0.5">
                              0{idx + 1}
                            </span>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-base font-semibold text-white">
                                  {gap.skill}
                                </span>
                                <Badge
                                  variant={
                                    gap.priority === 'critical'
                                      ? 'critical'
                                      : gap.priority === 'high'
                                      ? 'high'
                                      : 'medium'
                                  }
                                >
                                  {(gap.priority || 'high').toUpperCase()} PRIORITY
                                </Badge>
                                <span className="text-[11px] font-mono uppercase text-neutral-400">
                                  [{statusText}]
                                </span>
                              </div>
                              <p className="text-xs text-neutral-300 leading-relaxed max-w-3xl">
                                {gap.assessment}
                              </p>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setSelectedFinding(gap)}
                            className="shrink-0 text-xs self-start sm:self-auto"
                          >
                            Explore Evidence →
                          </Button>
                        </div>

                        {/* Prescriptive Remediation & Recruiter Probe */}
                        <div className="pt-4 border-t border-white/[0.06] grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                            <span className="text-[11px] font-medium uppercase text-neutral-500 tracking-wider">
                              Why this matters to recruiters
                            </span>
                            <p className="text-neutral-300 leading-relaxed">
                              {gap.interviewQuestion ||
                                `Claiming ${gap.skill} without observable repository code exposes you to direct technical grilling on implementation details, edge cases, and architecture.`}
                            </p>
                          </div>

                          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                            <span className="text-[11px] font-medium uppercase text-neutral-500 tracking-wider">
                              Prescriptive Fix
                            </span>
                            <p className="text-neutral-400 leading-relaxed">
                              {gap.honestAnswer ||
                                `Build one focused repository demonstrating ${gap.skill} with test coverage, configuration, and a README before claiming advanced proficiency.`}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Claims & Evidence Matrix */}
          {activeTab === 'claims' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Claims & Evidence Matrix
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Click any claim to inspect exact repository sources, manifests, and assessment reasoning.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill
                    size="sm"
                    interactive
                    selected={claimFilter === 'all'}
                    onClick={() => setClaimFilter('all')}
                  >
                    All ({findings.length})
                  </Pill>
                  <Pill
                    size="sm"
                    interactive
                    selected={claimFilter === 'verified'}
                    onClick={() => setClaimFilter('verified')}
                  >
                    Verified ({stats?.verifiedSkills ?? 0})
                  </Pill>
                  <Pill
                    size="sm"
                    interactive
                    selected={claimFilter === 'partial'}
                    onClick={() => setClaimFilter('partial')}
                  >
                    Partial ({stats?.weakSkills ?? 0})
                  </Pill>
                  <Pill
                    size="sm"
                    interactive
                    selected={claimFilter === 'unverified'}
                    onClick={() => setClaimFilter('unverified')}
                  >
                    Unverified ({stats?.unverifiedSkills ?? 0})
                  </Pill>
                </div>
              </div>

              <div className="space-y-3">
                {filteredFindings.map((finding) => {
                  const status = finding.evidenceStatus === 'weakly_supported' ? 'partial' : finding.evidenceStatus;
                  return (
                    <div
                      key={finding.id}
                      onClick={() => setSelectedFinding(finding)}
                      className="p-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] space-y-3 hover:border-white/[0.2] transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="text-[11px] font-mono text-neutral-500 uppercase tracking-wider">
                            Resume Claim
                          </div>
                          <div className="text-sm font-semibold text-white">
                            &ldquo;{finding.resumeClaim || finding.skill}&rdquo;
                          </div>
                        </div>

                        <Badge
                          variant={
                            status === 'verified'
                              ? 'verified'
                              : status === 'supported'
                              ? 'supported'
                              : status === 'partial'
                              ? 'weak'
                              : 'unverified'
                          }
                        >
                          {status.toUpperCase()}
                        </Badge>
                      </div>

                      <div className="pt-1">
                        <p className="text-xs text-neutral-300 leading-relaxed line-clamp-2">
                          {finding.assessment}
                        </p>
                      </div>

                      {finding.evidenceSources && finding.evidenceSources.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {finding.evidenceSources.slice(0, 3).map((src, sIdx) => (
                            <span
                              key={sIdx}
                              className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-neutral-400 font-mono"
                            >
                              {src.repository ? `[${src.repository}] ` : ''}{src.evidence}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: Job Alignment */}
          {activeTab === 'requirements' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Job Requirement Alignment
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Distinguishing mandatory required competencies from preferred qualifications.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-neutral-400 bg-white/[0.02]">
                      <th className="py-3.5 px-6 font-medium">Requirement</th>
                      <th className="py-3.5 px-6 font-medium hidden sm:table-cell">Tier</th>
                      <th className="py-3.5 px-6 font-medium">Code Evidence</th>
                      <th className="py-3.5 px-6 font-medium text-right">Alignment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {findings.map((item) => {
                      const isRequired = item.priority === 'critical' || item.priority === 'high';
                      const status = item.evidenceStatus === 'weakly_supported' ? 'partial' : item.evidenceStatus;

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedFinding(item)}
                          className="hover:bg-white/[0.02] transition-colors cursor-pointer"
                        >
                          <td className="py-4 px-6 font-semibold text-white">
                            {item.skill}
                          </td>
                          <td className="py-4 px-6 hidden sm:table-cell">
                            <span
                              className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded ${
                                isRequired
                                  ? 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                                  : 'bg-white/[0.04] text-neutral-400'
                              }`}
                            >
                              {isRequired ? 'Required' : 'Preferred'}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-neutral-300 max-w-sm truncate">
                            {item.assessment}
                          </td>
                          <td className="py-4 px-6 text-right font-medium">
                            {status === 'verified' || status === 'supported' ? (
                              <span className="text-emerald-400 font-semibold">VERIFIED</span>
                            ) : status === 'partial' ? (
                              <span className="text-amber-400 font-semibold">PARTIAL</span>
                            ) : (
                              <span className="text-rose-400 font-semibold">UNVERIFIED</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: 14-Day Roadmap (Persistent) */}
          {activeTab === 'plan' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    14-Day Remediation Roadmap
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Dynamic action items generated from your detected gaps. Progress persists automatically.
                  </p>
                </div>
                <div className="text-xs text-neutral-400 font-mono">
                  {Object.values(completedSteps).filter(Boolean).length} of {actionPlan.length} completed
                </div>
              </div>

              <div className="space-y-3">
                {actionPlan.map((action, idx) => {
                  const isDone = completedSteps[action.id] ?? !!action.completed;
                  return (
                    <div
                      key={action.id || idx}
                      onClick={() => toggleActionItem(action.id, isDone)}
                      className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 cursor-pointer flex items-start gap-4 ${
                        isDone
                          ? 'border-white/[0.04] bg-white/[0.01] opacity-60'
                          : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20'
                      }`}
                    >
                      <button
                        type="button"
                        className={`w-5 h-5 rounded-full border mt-0.5 flex items-center justify-center shrink-0 transition-colors ${
                          isDone
                            ? 'bg-white border-white text-black font-bold'
                            : 'border-neutral-500 bg-transparent'
                        }`}
                      >
                        {isDone && <span className="text-xs leading-none">&check;</span>}
                      </button>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-sm font-semibold ${
                              isDone ? 'line-through text-neutral-400' : 'text-white'
                            }`}
                          >
                            {action.title}
                          </span>
                          <span className="text-xs text-neutral-400 font-mono">
                            {action.day}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 leading-relaxed">
                          {action.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: History & Progression */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Audit History
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Click any historical audit to view its exact findings, recommendations, and evidence.
                </p>
              </div>

              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] divide-y divide-white/[0.04] overflow-hidden">
                {historyList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-500">
                    No historical runs recorded.
                  </div>
                ) : (
                  historyList.map((item) => {
                    const isSelected = item.id === latestAnalysis.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleSelectHistoryItem(item.id)}
                        className={`p-4 sm:p-5 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-white/[0.06] border-l-2 border-white'
                            : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-white text-sm">
                            {item.targetRole || 'Software Engineer'}
                          </div>
                          <div className="text-[11px] text-neutral-500 mt-0.5 font-mono">
                            {new Date(item.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-white font-semibold text-base">
                              {Math.round(item.overallScore ?? 72)}%
                            </span>
                            <div className="text-[10px] text-neutral-500 font-mono">Readiness</div>
                          </div>
                          <span
                            className={`text-[10px] uppercase font-mono px-2.5 py-1 rounded-full border ${
                              item.status === 'completed'
                                ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                                : 'border-white/[0.1] text-neutral-400'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* EVIDENCE EXPLORER MODAL */}
          {selectedFinding && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-[#0e0e11] border border-white/[0.12] rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-neutral-400 tracking-wider">
                      Evidence Explorer
                    </span>
                    <h3 className="text-2xl font-semibold text-white mt-0.5">
                      {selectedFinding.skill}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedFinding(null)}
                    className="text-neutral-400 hover:text-white text-xl px-2 py-1 leading-none"
                  >
                    &times;
                  </button>
                </div>

                {/* Status & Assessment */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-neutral-400 font-mono">Status:</span>
                    <Badge
                      variant={
                        selectedFinding.evidenceStatus === 'verified'
                          ? 'verified'
                          : selectedFinding.evidenceStatus === 'supported'
                          ? 'supported'
                          : selectedFinding.evidenceStatus === 'weakly_supported'
                          ? 'weak'
                          : 'unverified'
                      }
                    >
                      {(selectedFinding.evidenceStatus === 'weakly_supported' ? 'PARTIAL' : selectedFinding.evidenceStatus).toUpperCase()}
                    </Badge>
                  </div>

                  <p className="text-xs text-neutral-300 leading-relaxed bg-white/[0.02] p-4 rounded-xl border border-white/[0.06]">
                    {selectedFinding.assessment}
                  </p>
                </div>

                {/* Evidence Citations */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                    Observable GitHub Evidence ({selectedFinding.evidenceSources?.length || 0})
                  </h4>

                  {selectedFinding.evidenceSources && selectedFinding.evidenceSources.length > 0 ? (
                    <div className="space-y-2">
                      {selectedFinding.evidenceSources.map((src, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-xs space-y-1 font-mono"
                        >
                          <div className="flex items-center justify-between text-neutral-400">
                            <span className="text-white font-semibold">
                              {src.repository ? `repo: ${src.repository}` : src.source}
                            </span>
                            {src.file && <span className="text-neutral-500">{src.file}</span>}
                          </div>
                          <p className="text-neutral-300 font-sans text-xs pt-1">
                            {src.evidence}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-500 italic p-3 rounded-xl border border-white/[0.04] bg-white/[0.01]">
                      No observable public repository manifests or source files detected matching this claim.
                    </p>
                  )}
                </div>

                {/* Prescriptive Fix & Recruiter Probe */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                    <span className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider">
                      Interview Preparation Probe
                    </span>
                    <p className="text-neutral-300 leading-relaxed">
                      {selectedFinding.interviewQuestion ||
                        `Prepare to articulate real production challenges, trade-offs, and architecture decisions related to ${selectedFinding.skill}.`}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-1">
                    <span className="text-[10px] font-mono uppercase text-neutral-400 tracking-wider">
                      Evidence Fix Recommendation
                    </span>
                    <p className="text-neutral-400 leading-relaxed">
                      {selectedFinding.honestAnswer ||
                        `Commit working implementation code with tests in a public repository before listing ${selectedFinding.skill} as a core competency.`}
                    </p>
                  </div>
                </div>

                <div className="pt-2 text-right">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedFinding(null)}
                  >
                    Close Explorer
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* SCORE DIMENSION BREAKDOWN MODAL */}
          {showScoreModal && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-[#0e0e11] border border-white/[0.12] rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl">
                <div className="flex items-start justify-between border-b border-white/[0.08] pb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-white">
                      Readiness Score Formula
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Deterministic calculation across 4 structured dimensions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowScoreModal(false)}
                    className="text-neutral-400 hover:text-white text-xl leading-none px-2"
                  >
                    &times;
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  {[
                    {
                      name: 'Resume Quality (20%)',
                      score: latestAnalysis.dimensions?.resumeQuality ?? 85,
                      desc: 'Density of concrete technical claims, structure, and avoidance of buzzwords.',
                    },
                    {
                      name: 'Engineering Evidence (30%)',
                      score: latestAnalysis.dimensions?.engineeringEvidence ?? 70,
                      desc: 'Verifiable production artifacts: package manifests, Dockerfiles, and CI pipelines.',
                    },
                    {
                      name: 'Role Alignment (30%)',
                      score: latestAnalysis.dimensions?.roleAlignment ?? 75,
                      desc: 'Coverage of must-have and preferred requirements for the target role.',
                    },
                    {
                      name: 'Claim Consistency (20%)',
                      score: latestAnalysis.dimensions?.claimConsistency ?? 68,
                      desc: 'Percentage of claims that have corroborating public source code.',
                    },
                  ].map((dim) => (
                    <div
                      key={dim.name}
                      className="p-3.5 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <div className="font-semibold text-white">{dim.name}</div>
                        <div className="text-[11px] text-neutral-400">{dim.desc}</div>
                      </div>
                      <span className="text-sm font-semibold font-mono text-emerald-400 pl-4">
                        {Math.round(dim.score)}%
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 text-right">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setShowScoreModal(false)}
                  >
                    Got it
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}
