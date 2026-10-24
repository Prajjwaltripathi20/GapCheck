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

export interface ActionOption {
  label: string;
  description: string;
}

export interface PrioritizedAction {
  findingId: string;
  canonicalId?: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'resume' | 'github' | 'target_role' | 'presentation';
  title: string;
  whyItMatters: string;
  evidence: string;
  recommendedAction: string;
  options?: ActionOption[];
  estimatedEffort: 'QUICK' | 'LOW' | 'MEDIUM' | 'HIGH';
  targetRoleCritical?: boolean;
  relatedRepo?: string;
}

export interface NoActionItem {
  id: string;
  title: string;
  category: 'practice_work' | 'completed_legacy' | 'compact_utility' | 'healthy_area';
  whySafeToLeave: string;
  evidence: string;
  relatedRepo?: string;
}

export type DataQuality = 'COMPLETE' | 'PARTIAL' | 'LIMITED' | 'FAILED';

export interface SourceCoverage {
  resume: DataQuality;
  github: {
    quality: DataQuality;
    totalPublicRepos: number;
    scannedCount: number;
    failedCount: number;
    message?: string;
  };
  targetJob: DataQuality;
}

export interface PreApplicationDecision {
  recommendation: 'READY' | 'READY_WITH_FIXES' | 'NEEDS_WORK';
  recommendationLabel: string;
  headline: string;
  summary: string;
  readinessScore: number;
  summaryMetrics: {
    resumeGitHubConsistency: 'STRONG' | 'MODERATE' | 'NEEDS_ATTENTION';
    coreProjects: 'STRONG' | 'MODERATE' | 'NEEDS_ATTENTION';
    targetRoleFit: 'STRONG' | 'MODERATE' | 'LOW';
    publicProfile: 'EXCELLENT' | 'GOOD' | 'NEEDS_ATTENTION';
    evidenceGapsCount: number;
    priorityFixesCount: number;
  };
  mustFix: PrioritizedAction[];
  niceToFix: PrioritizedAction[];
  noActionNeeded: NoActionItem[];
  roleCriticalGaps: PrioritizedAction[];
  strongestReasons: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  confidenceDisclaimer?: string;
  sourceCoverage?: SourceCoverage;
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
  user?: {
    id: string;
    name?: string;
    email?: string;
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
  recruiterAudit?: {
    summary: {
      totalPublicRepos: number;
      strongProjectsCount: number;
      supportingCount: number;
      practiceCount: number;
      outdatedCount: number;
      needsReviewCount: number;
    };
    repositories: Array<{
      name: string;
      fullName: string;
      description: string | null;
      language: string | null;
      stars: number;
      forks: number;
      commitCount: number;
      lastCommitAt: string | null;
      hasReadme: boolean;
      hasTests: boolean;
      hasDockerfile: boolean;
      hasCi: boolean;
      classification: string;
      presentationPriority?: string;
      roleRelevance?: string;
      confidence?: string | number;
      confidenceScore?: number;
      signals: string[];
      recruiterNotes: string;
      matchedResumeProject?: string;
      matchConfidence?: string;
      matchReasons?: string[];
    }>;
    concerns: Array<{
      id: string;
      canonicalId?: string;
      category: string;
      severity: 'high' | 'medium' | 'low';
      confidence?: 'HIGH' | 'MEDIUM' | 'LOW';
      title: string;
      observation: string;
      signal?: string;
      reasoning?: string;
      evidence?: string;
      risk: string;
      recommendation: string;
    }>;
    strengths: Array<{
      title: string;
      detail: string;
      evidence: string;
      confidence?: string;
    }>;
    preparedQuestions: Array<{
      question: string;
      context: string;
      reason: string;
      suggestedFocus: string;
      category?: string;
    }>;
    consistency: {
      resumeProjectsFound: Array<{
        resumeProject: string;
        repoName: string;
        matchStrength: string;
        matchConfidence?: string;
        evidenceSummary: string;
        matchReasons?: string[];
      }>;
      resumeProjectsMissing: Array<{
        resumeProject: string;
        note: string;
        possibleReasons?: string[];
      }>;
      githubProjectsNotOnResume: Array<{
        repoName: string;
        classification: string;
        assessment: string;
        note: string;
      }>;
    };
    readiness: {
      score: number;
      dimensions: {
        projectQuality: number;
        documentation: number;
        activityRecency: number;
        resumeConsistency: number;
        profileHygiene: number;
      };
      breakdown: string[];
      positiveFactors?: string[];
      deductionFactors?: string[];
    };
  } | null;
  repositories?: Array<{
    id: string;
    name: string;
    description?: string | null;
    language?: string | null;
    stars?: number;
    commitCount?: number;
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
  preApplicationDecision?: PreApplicationDecision;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedAnalysisId = searchParams.get('analysisId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [historyList, setHistoryList] = useState<HistoricalAnalysis[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const effectiveAnalysisId = selectedHistoryId || requestedAnalysisId;

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'decision' | 'recruiter' | 'repos' | 'gaps' | 'claims' | 'requirements' | 'plan' | 'history'>('decision');

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
        let res: Record<string, unknown>;
        try {
          res = (await api.getDashboard(targetId || undefined)) as unknown as Record<string, unknown>;
        } catch (fetchErr: unknown) {
          const errMsg = fetchErr instanceof Error ? fetchErr.message : '';
          if (errMsg.includes('401') || errMsg.toLowerCase().includes('user not found') || errMsg.toLowerCase().includes('session')) {
            api.clearToken();
            await api.loginDemo();
            res = (await api.getDashboard(targetId || undefined)) as unknown as Record<string, unknown>;
          } else {
            throw fetchErr;
          }
        }
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

    loadData(effectiveAnalysisId);

    return () => {
      active = false;
    };
  }, [router, effectiveAnalysisId]);

  const handleSelectHistoryItem = (id: string) => {
    setSelectedHistoryId(id);
    router.push(`/dashboard?analysisId=${id}`);
  };

  const handleDownloadReport = async () => {
    if (!data?.latestAnalysis?.id) return;
    setDownloadingReport(true);
    try {
      await api.downloadAuditReport(data.latestAnalysis.id, `GapCheck_Audit_Report_${data.user?.name || 'Candidate'}.pdf`);
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
      await api.downloadAnnotatedResume(data.latestAnalysis.id, `GapCheck_Annotated_Resume_${data.user?.name || 'Candidate'}.pdf`);
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
          <Button variant="primary" onClick={() => setSelectedHistoryId(null)}>
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
                  <span>Candidate: {user?.name || 'Candidate'}</span>
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
                  {latestAnalysis.targetRole || user?.targetRole || 'Software Engineer'}
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
                  className="crystal-glass flex items-center gap-4 px-4 py-3 rounded-2xl shrink-0 cursor-pointer"
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

            {/* Segmented Control Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 mt-8 pt-6 border-t border-white/[0.06]">
              <Pill
                size="sm"
                interactive
                selected={activeTab === 'decision'}
                onClick={() => setActiveTab('decision')}
              >
                Before You Apply {data.preApplicationDecision?.mustFix.length ? `(${data.preApplicationDecision.mustFix.length})` : '✓'}
              </Pill>
              <Pill
                size="sm"
                interactive
                selected={activeTab === 'recruiter'}
                onClick={() => setActiveTab('recruiter')}
              >
                What a Recruiter Sees
              </Pill>
              <Pill
                size="sm"
                interactive
                selected={activeTab === 'repos'}
                onClick={() => setActiveTab('repos')}
              >
                GitHub Profile ({data.recruiterAudit?.summary.totalPublicRepos ?? data.repositories?.length ?? 0})
              </Pill>
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

          {/* TAB 0: Before You Apply — Pre-Application Decision */}
          {activeTab === 'decision' && (
            <div className="space-y-8">
              {/* Executive Decision Card */}
              {data.preApplicationDecision && (
                <div className="crystal-glass relative overflow-hidden rounded-2xl border border-white/[0.12] bg-white/[0.03] backdrop-blur-2xl p-6 sm:p-8 space-y-6">
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    <div className="space-y-3 max-w-3xl">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span
                          className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                            data.preApplicationDecision.recommendation === 'READY'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : data.preApplicationDecision.recommendation === 'READY_WITH_FIXES'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          }`}
                        >
                          {data.preApplicationDecision.recommendation === 'READY' && '✓ '}
                          {data.preApplicationDecision.recommendation === 'READY_WITH_FIXES' && '⚡ '}
                          {data.preApplicationDecision.recommendation === 'NEEDS_WORK' && '⚠ '}
                          {data.preApplicationDecision.recommendationLabel}
                        </span>

                        <span className="text-[11px] font-mono text-neutral-400">
                          Pre-Application Decision Layer
                        </span>
                      </div>

                      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                        {data.preApplicationDecision.headline}
                      </h2>

                      <p className="text-sm text-neutral-300 leading-relaxed">
                        {data.preApplicationDecision.summary}
                      </p>

                      {/* Strongest Reasons */}
                      {data.preApplicationDecision.strongestReasons?.length > 0 && (
                        <div className="pt-2 space-y-1.5">
                          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                            Key Decision Factors:
                          </div>
                          <div className="space-y-1">
                            {data.preApplicationDecision.strongestReasons.map((reason, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs text-neutral-300">
                                <span className="text-neutral-500 font-mono mt-0.5">•</span>
                                <span>{reason}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Confidence Disclaimer (Section 6, 7, 19) */}
                      {data.preApplicationDecision.confidenceDisclaimer && (
                        <div className="pt-2">
                          <div className="text-xs text-neutral-400 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 py-2 flex items-center gap-2">
                            <span className="font-mono text-[10px] text-amber-400 uppercase tracking-wider font-semibold">
                              Confidence: {data.preApplicationDecision.confidence}
                            </span>
                            <span className="text-neutral-500">•</span>
                            <span className="text-[11px] text-neutral-300">
                              {data.preApplicationDecision.confidenceDisclaimer}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Subtle Evidence Coverage Strip (Section 18) */}
                      {data.preApplicationDecision.sourceCoverage && (
                        <div className="pt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                          <span className="font-semibold text-neutral-500 uppercase tracking-wider text-[10px]">Evidence Coverage:</span>
                          <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-neutral-300 font-mono text-[10px]">
                            Resume: {data.preApplicationDecision.sourceCoverage.resume}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-neutral-300 font-mono text-[10px]">
                            GitHub: {data.preApplicationDecision.sourceCoverage.github.quality}
                            {data.preApplicationDecision.sourceCoverage.github.scannedCount > 0
                              ? ` (${data.preApplicationDecision.sourceCoverage.github.scannedCount}/${data.preApplicationDecision.sourceCoverage.github.totalPublicRepos} repos)`
                              : ''}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-neutral-300 font-mono text-[10px]">
                            Target Job: {data.preApplicationDecision.sourceCoverage.targetJob}
                          </span>
                          {data.preApplicationDecision.sourceCoverage.github.failedCount > 0 && (
                            <span className="text-amber-400 text-[10px]">
                              ({data.preApplicationDecision.sourceCoverage.github.failedCount} repos could not be inspected)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick Stats / Right Widget */}
                    <div className="shrink-0 flex flex-col items-start lg:items-end gap-3 bg-white/[0.02] border border-white/[0.06] p-4 rounded-xl">
                      <div className="text-xs text-neutral-400 font-medium">Profile Readiness</div>
                      <div className="text-3xl font-bold text-white font-mono">
                        {data.preApplicationDecision.readinessScore}
                        <span className="text-sm text-neutral-500 font-normal"> / 100</span>
                      </div>
                      <div className="text-[11px] text-neutral-400 max-w-[200px] text-left lg:text-right">
                        Evidence-based assessment across observable code repositories.
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setActiveTab('plan')}
                        className="mt-1"
                      >
                        View Action Roadmap →
                      </Button>
                    </div>
                  </div>

                  {/* 6-Metric Overview Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-4 border-t border-white/[0.06]">
                    <div
                      onClick={() => setActiveTab('recruiter')}
                      className="cursor-pointer p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] transition-colors space-y-1"
                    >
                      <div className="text-[10px] text-neutral-400 font-medium truncate">Resume ↔ GitHub</div>
                      <div className={`text-xs font-semibold ${
                        data.preApplicationDecision.summaryMetrics.resumeGitHubConsistency === 'STRONG' ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {data.preApplicationDecision.summaryMetrics.resumeGitHubConsistency}
                      </div>
                    </div>

                    <div
                      onClick={() => setActiveTab('repos')}
                      className="cursor-pointer p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] transition-colors space-y-1"
                    >
                      <div className="text-[10px] text-neutral-400 font-medium truncate">Core Projects</div>
                      <div className={`text-xs font-semibold ${
                        data.preApplicationDecision.summaryMetrics.coreProjects === 'STRONG' ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {data.preApplicationDecision.summaryMetrics.coreProjects}
                      </div>
                    </div>

                    <div
                      onClick={() => setActiveTab('requirements')}
                      className="cursor-pointer p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] transition-colors space-y-1"
                    >
                      <div className="text-[10px] text-neutral-400 font-medium truncate">Target Role Fit</div>
                      <div className={`text-xs font-semibold ${
                        data.preApplicationDecision.summaryMetrics.targetRoleFit === 'STRONG' ? 'text-emerald-400' : 'text-amber-400'
                      }`}>
                        {data.preApplicationDecision.summaryMetrics.targetRoleFit}
                      </div>
                    </div>

                    <div
                      onClick={() => setActiveTab('repos')}
                      className="cursor-pointer p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] transition-colors space-y-1"
                    >
                      <div className="text-[10px] text-neutral-400 font-medium truncate">Public Profile</div>
                      <div className={`text-xs font-semibold ${
                        data.preApplicationDecision.summaryMetrics.publicProfile === 'EXCELLENT' ? 'text-emerald-400' : 'text-neutral-200'
                      }`}>
                        {data.preApplicationDecision.summaryMetrics.publicProfile}
                      </div>
                    </div>

                    <div
                      onClick={() => setActiveTab('claims')}
                      className="cursor-pointer p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] transition-colors space-y-1"
                    >
                      <div className="text-[10px] text-neutral-400 font-medium truncate">Evidence Gaps</div>
                      <div className="text-xs font-semibold text-rose-400 font-mono">
                        {data.preApplicationDecision.summaryMetrics.evidenceGapsCount} unverified
                      </div>
                    </div>

                    <div
                      onClick={() => setActiveTab('gaps')}
                      className="cursor-pointer p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] transition-colors space-y-1"
                    >
                      <div className="text-[10px] text-neutral-400 font-medium truncate">Priority Fixes</div>
                      <div className="text-xs font-semibold text-amber-400 font-mono">
                        {data.preApplicationDecision.summaryMetrics.priorityFixesCount} recommended
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: FIX FIRST (Must Fix / Strongly Recommended) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                      <span>Fix First — High-Priority Priorities Before Applying</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/[0.08] text-neutral-300">
                        {data.preApplicationDecision?.mustFix.length || 0}
                      </span>
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Ranked by credibility impact, role relevance, and ease of remediation.
                    </p>
                  </div>
                </div>

                {data.preApplicationDecision?.mustFix.length === 0 ? (
                  <div className="crystal-glass p-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] text-center space-y-2">
                    <div className="text-emerald-400 text-lg">✓</div>
                    <div className="text-sm font-semibold text-white">No Critical Application Blockers</div>
                    <p className="text-xs text-neutral-400 max-w-md mx-auto">
                      All core technical claims and required target role skills are corroborated by observable code. You can proceed with applying.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.preApplicationDecision?.mustFix.map((action, idx) => (
                      <div
                        key={action.findingId || idx}
                        className="group relative p-5 rounded-2xl border border-white/[0.1] bg-white/[0.02] hover:border-white/30 hover:bg-white/[0.04] transition-all space-y-3.5"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.04] pb-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                              action.priority === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}>
                              {action.priority}
                            </span>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 bg-white/[0.04] px-2 py-0.5 rounded">
                              {action.category}
                            </span>
                            {action.targetRoleCritical && (
                              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded">
                                Role Critical
                              </span>
                            )}
                          </div>

                          <span className="text-[11px] text-neutral-400 font-mono">
                            Estimated Effort: <strong className="text-white">{action.estimatedEffort}</strong>
                          </span>
                        </div>

                        <div>
                          <h4 className="text-sm font-semibold text-white">
                            {action.title}
                          </h4>
                          <p className="text-xs text-neutral-300 mt-1 leading-relaxed">
                            <strong className="text-neutral-400">Why It Matters: </strong>
                            {action.whyItMatters}
                          </p>
                        </div>

                        <div className="p-3 rounded-xl bg-black/40 border border-white/[0.05] space-y-1">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">
                            Observable Evidence:
                          </div>
                          <div className="text-xs font-mono text-neutral-300">
                            {action.evidence}
                          </div>
                        </div>

                        {/* Concrete Action Options */}
                        {action.options && action.options.length > 0 ? (
                          <div className="space-y-2 pt-1">
                            <div className="text-[11px] font-semibold text-neutral-300">
                              Recommended Options:
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                              {action.options.map((opt, oIdx) => (
                                <div key={oIdx} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1">
                                  <div className="text-xs font-semibold text-white">{opt.label}</div>
                                  <p className="text-[11px] text-neutral-400 leading-snug">{opt.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-neutral-300">
                            <strong className="text-neutral-400">Action: </strong>
                            {action.recommendedAction}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION: YOU DON'T NEED TO FIX (Prevents Destructive / Pointless Cleaning) */}
              <div className="space-y-4 pt-2">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <span className="text-emerald-400">✓</span>
                    <span>You Don&apos;t Need To Fix (Safe to Leave As-Is)</span>
                  </h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Do not blindly delete or rewrite historical repositories. These areas represent valid practice or complete work.
                  </p>
                </div>

                {(!data.preApplicationDecision?.noActionNeeded || data.preApplicationDecision.noActionNeeded.length === 0) ? (
                  <div className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] text-xs text-neutral-400">
                    Your profile does not contain extraneous repositories requiring preservation notes.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.preApplicationDecision.noActionNeeded.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.02] space-y-1.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400 text-xs font-bold">✓</span>
                          <div className="text-xs font-semibold text-white">{item.title}</div>
                        </div>
                        <p className="text-xs text-neutral-300 leading-relaxed pl-4">
                          {item.whySafeToLeave}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* SECTION: NICE TO FIX (Secondary Polish) */}
              {data.preApplicationDecision?.niceToFix && data.preApplicationDecision.niceToFix.length > 0 && (
                <div className="space-y-4 pt-2">
                  <div>
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                      <span>Nice to Fix (Non-Blocking Polish)</span>
                      <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/[0.08] text-neutral-400">
                        {data.preApplicationDecision.niceToFix.length}
                      </span>
                    </h3>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Helpful polish and portfolio presentation improvements that can be tackled after priority fixes.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {data.preApplicationDecision.niceToFix.map((action, idx) => (
                      <div
                        key={action.findingId || idx}
                        className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.02] space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                          <span>{action.category.toUpperCase()}</span>
                          <span>Effort: {action.estimatedEffort}</span>
                        </div>
                        <h4 className="text-xs font-semibold text-white">{action.title}</h4>
                        <p className="text-xs text-neutral-400 leading-relaxed">{action.recommendedAction}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 0A: What a Recruiter Sees */}
          {activeTab === 'recruiter' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    What a Recruiter Sees
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    An objective evaluation of your public GitHub footprint and resume consistency from an engineering recruiter’s vantage point.
                  </p>
                </div>
                {data.recruiterAudit?.readiness && (
                  <div className="flex items-center gap-3 bg-white/[0.03] border border-white/[0.08] px-4 py-2 rounded-xl shrink-0">
                    <span className="text-xs text-neutral-400 font-medium">Profile Readiness:</span>
                    <span className="text-sm font-semibold text-emerald-400 font-mono">
                      {data.recruiterAudit.readiness.score ?? 0}/100
                    </span>
                  </div>
                )}
              </div>

              {/* Explainable Readiness Score Breakdown */}
              {data.recruiterAudit?.readiness && (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.04] pb-3">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-200">
                        GitHub Profile Readiness Breakdown
                      </h3>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Defensible multi-signal scoring separating core engineering evidence from practice noise.
                      </p>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 font-medium">
                      Overall: {data.recruiterAudit.readiness.score ?? 0}%
                    </span>
                  </div>

                  {/* 5 Dimensions Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="crystal-glass p-3 rounded-xl">
                      <div className="text-[10px] text-neutral-400 uppercase tracking-wider">Project Evidence</div>
                      <div className="text-sm font-bold text-white font-mono mt-1">
                        {data.recruiterAudit.readiness.dimensions.projectQuality ?? 0}%
                      </div>
                    </div>
                    <div className="crystal-glass p-3 rounded-xl">
                      <div className="text-[10px] text-neutral-400 uppercase tracking-wider">Documentation</div>
                      <div className="text-sm font-bold text-white font-mono mt-1">
                        {data.recruiterAudit.readiness.dimensions.documentation ?? 0}%
                      </div>
                    </div>
                    <div className="crystal-glass p-3 rounded-xl">
                      <div className="text-[10px] text-neutral-400 uppercase tracking-wider">Activity Recency</div>
                      <div className="text-sm font-bold text-white font-mono mt-1">
                        {data.recruiterAudit.readiness.dimensions.activityRecency ?? 0}%
                      </div>
                    </div>
                    <div className="crystal-glass p-3 rounded-xl">
                      <div className="text-[10px] text-neutral-400 uppercase tracking-wider">Resume Consistency</div>
                      <div className="text-sm font-bold text-white font-mono mt-1">
                        {data.recruiterAudit.readiness.dimensions.resumeConsistency ?? 0}%
                      </div>
                    </div>
                    <div className="crystal-glass p-3 rounded-xl col-span-2 sm:col-span-1">
                      <div className="text-[10px] text-neutral-400 uppercase tracking-wider">Profile Hygiene</div>
                      <div className="text-sm font-bold text-white font-mono mt-1">
                        {data.recruiterAudit.readiness.dimensions.profileHygiene ?? 0}%
                      </div>
                    </div>
                  </div>

                  {/* Positive & Deduction Factors */}
                  {((data.recruiterAudit.readiness.positiveFactors && data.recruiterAudit.readiness.positiveFactors.length > 0) ||
                    (data.recruiterAudit.readiness.deductionFactors && data.recruiterAudit.readiness.deductionFactors.length > 0)) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-[11px]">
                      {data.recruiterAudit.readiness.positiveFactors && data.recruiterAudit.readiness.positiveFactors.length > 0 && (
                        <div className="space-y-1.5 p-3 rounded-xl bg-emerald-500/[0.02] border border-emerald-500/15">
                          <span className="text-emerald-400 font-semibold uppercase tracking-wider text-[10px]">Observable Strengths</span>
                          {data.recruiterAudit.readiness.positiveFactors.map((pf, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 text-neutral-300">
                              <span className="text-emerald-400 font-bold">+</span>
                              <span>{pf}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {data.recruiterAudit.readiness.deductionFactors && data.recruiterAudit.readiness.deductionFactors.length > 0 && (
                        <div className="space-y-1.5 p-3 rounded-xl bg-amber-500/[0.02] border border-amber-500/15">
                          <span className="text-amber-400 font-semibold uppercase tracking-wider text-[10px]">Deduction Factors</span>
                          {data.recruiterAudit.readiness.deductionFactors.map((df, idx) => (
                            <div key={idx} className="flex items-start gap-1.5 text-neutral-300">
                              <span className="text-amber-400 font-bold">-</span>
                              <span>{df}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Strengths Grid */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Profile Strengths
                  </h3>
                </div>
                {(!data.recruiterAudit?.strengths || data.recruiterAudit.strengths.length === 0) ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 text-xs text-neutral-500">
                    No primary strengths classified yet. Add substantial projects with READMEs and commit histories.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.recruiterAudit.strengths.map((s, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 space-y-1.5"
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-emerald-400 text-xs mt-0.5">✓</span>
                          <div>
                            <h4 className="text-xs font-medium text-white">{s.title}</h4>
                            <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">{s.detail}</p>
                            <p className="text-[10px] text-emerald-400/80 font-mono mt-1.5">Evidence: {s.evidence}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Potential Recruiter Concerns */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Potential Recruiter Concerns
                  </h3>
                </div>
                {(!data.recruiterAudit?.concerns || data.recruiterAudit.concerns.length === 0) ? (
                  <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 text-xs text-neutral-500">
                    No significant concerns detected. Your repositories align well with your resume.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {data.recruiterAudit.concerns.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-xl border border-amber-500/20 bg-amber-500/[0.03] p-5 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5">
                            <span className="text-amber-400 text-sm font-bold leading-none mt-0.5">!</span>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-semibold text-white">{c.title}</h4>
                                {c.confidence && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-neutral-300 font-mono">
                                    {c.confidence} Confidence
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-neutral-300 leading-relaxed">
                                <span className="text-neutral-500 font-medium">Observation: </span>
                                {c.observation}
                              </p>
                              {c.evidence && (
                                <p className="text-[11px] text-neutral-400 font-mono leading-relaxed">
                                  <span className="text-neutral-500 font-sans font-medium">Evidence: </span>
                                  {c.evidence}
                                </p>
                              )}
                              <p className="text-xs text-neutral-400 leading-relaxed">
                                <span className="text-neutral-500 font-medium">Why it raises questions: </span>
                                {c.reasoning || c.risk}
                              </p>
                            </div>
                          </div>
                          <Badge variant={c.severity === 'high' ? 'critical' : c.severity === 'medium' ? 'high' : 'low'}>
                            {c.severity} priority
                          </Badge>
                        </div>
                        <div className="pt-2 border-t border-white/[0.04] text-[11px] text-neutral-400 flex items-start gap-1.5">
                          <span className="text-emerald-400 font-medium shrink-0">Actionable Fix:</span>
                          <span>{c.recommendation}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resume <-> GitHub Consistency Matrix */}
              {data.recruiterAudit?.consistency && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                      Resume ↔ GitHub Project Consistency
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Resume projects found vs missing */}
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-3">
                      <div className="text-xs font-semibold text-white">
                        Resume Projects Verification
                      </div>
                      <div className="space-y-2">
                        {data.recruiterAudit.consistency.resumeProjectsFound.map((p, idx) => (
                          <div key={idx} className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-xs font-medium text-white flex items-center gap-1.5">
                                <span className="text-emerald-400">✓</span> {p.resumeProject}
                              </div>
                              <Badge variant="verified">{p.matchStrength} MATCH</Badge>
                            </div>
                            <div className="text-[11px] text-neutral-400">
                              Matched Repo: <span className="font-mono text-neutral-300">{p.repoName}</span>
                            </div>
                            {p.matchReasons && p.matchReasons.length > 0 && (
                              <div className="pt-1 border-t border-white/[0.04] space-y-0.5">
                                {p.matchReasons.map((r, rIdx) => (
                                  <div key={rIdx} className="text-[10px] text-emerald-400/90 font-mono">
                                    {r}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {data.recruiterAudit.consistency.resumeProjectsMissing.map((p, idx) => (
                          <div key={idx} className="p-3 rounded-lg bg-rose-500/[0.03] border border-rose-500/20 space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-xs font-medium text-rose-300 flex items-center gap-1.5">
                                <span>!</span> {p.resumeProject}
                              </div>
                              <Badge variant="unverified">UNVERIFIED</Badge>
                            </div>
                            <div className="text-[11px] text-neutral-400 leading-relaxed">
                              {p.note}
                            </div>
                            {p.possibleReasons && p.possibleReasons.length > 0 && (
                              <div className="pt-1 border-t border-white/[0.04] text-[10px] text-neutral-400 space-y-0.5">
                                <span className="text-neutral-500 font-medium">Common explanations:</span>
                                {p.possibleReasons.slice(0, 2).map((reason, prIdx) => (
                                  <div key={prIdx} className="text-neutral-400 pl-2">
                                    • {reason}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* GitHub projects not on resume */}
                    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-3">
                      <div className="text-xs font-semibold text-white">
                        Public GitHub Projects Not On Resume
                      </div>
                      <div className="space-y-2">
                        {data.recruiterAudit.consistency.githubProjectsNotOnResume.length === 0 ? (
                          <p className="text-xs text-neutral-500">All public repositories correspond to resume projects.</p>
                        ) : (
                          data.recruiterAudit.consistency.githubProjectsNotOnResume.slice(0, 5).map((p, idx) => (
                            <div key={idx} className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                              <div>
                                <div className="text-xs font-mono font-medium text-white">{p.repoName}</div>
                                <div className="text-[11px] text-neutral-400 mt-0.5">{p.note}</div>
                              </div>
                              <Badge variant={p.assessment === 'POTENTIALLY VALUABLE' ? 'verified' : 'neutral'}>
                                {p.assessment}
                              </Badge>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Questions you should be prepared for */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-violet-400" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Questions You Should Be Prepared To Answer
                  </h3>
                </div>
                <div className="space-y-3">
                  {(!data.recruiterAudit?.preparedQuestions || data.recruiterAudit.preparedQuestions.length === 0) ? (
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-4 text-xs text-neutral-500">
                      Standard architectural walkthrough questions apply.
                    </div>
                  ) : (
                    data.recruiterAudit.preparedQuestions.map((q, idx) => (
                      <div
                        key={idx}
                        className="crystal-glass rounded-xl p-5 space-y-2"
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-mono font-semibold text-violet-400 mt-0.5">
                            Q0{idx + 1}
                          </span>
                          <div className="space-y-1 flex-1">
                            <h4 className="text-xs font-semibold text-white leading-relaxed">
                              &ldquo;{q.question}&rdquo;
                            </h4>
                            <p className="text-xs text-neutral-400">
                              <span className="text-neutral-500">Context: </span>{q.context}
                            </p>
                            <p className="text-[11px] text-neutral-400 pt-1">
                              <span className="text-neutral-500 font-medium">Why recruiters ask this: </span>{q.reason}
                            </p>
                            <div className="mt-2 p-2 rounded-lg bg-white/[0.03] text-[11px] text-neutral-300 font-mono">
                              💡 Suggested preparation: {q.suggestedFocus}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 0B: GitHub Profile Overview & Classification */}
          {activeTab === 'repos' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Public GitHub Profile Classification
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Objective categorization of all public repositories to identify flagship projects versus practice and outdated code.
                  </p>
                </div>
                {data.recruiterAudit?.summary && (
                  <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
                    <span className="text-emerald-400 font-semibold">{data.recruiterAudit.summary.strongProjectsCount} strong</span> •{' '}
                    <span>{data.recruiterAudit.summary.supportingCount} supporting</span> •{' '}
                    <span className="text-amber-400">{data.recruiterAudit.summary.needsReviewCount} needs review</span>
                  </div>
                )}
              </div>

              {/* Repositories table/cards */}
              <div className="space-y-3">
                {(!data.recruiterAudit?.repositories || data.recruiterAudit.repositories.length === 0) ? (
                  <EmptyState
                    title="No repositories analyzed."
                    description="Connect a public GitHub profile with repositories to view classification."
                  />
                ) : (
                  data.recruiterAudit.repositories.map((repo, idx) => (
                    <div
                      key={idx}
                      className="crystal-glass rounded-xl p-5 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2.5">
                            <h3 className="text-sm font-semibold text-white font-mono">{repo.name}</h3>
                            {repo.matchedResumeProject && (
                              <Badge variant="verified">Resume Project</Badge>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-xs text-neutral-400 mt-1">{repo.description}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {repo.presentationPriority && (
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                              repo.presentationPriority === 'FLAGSHIP'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : repo.presentationPriority === 'SUPPORTING'
                                ? 'bg-sky-500/10 border-sky-500/30 text-sky-400'
                                : repo.presentationPriority === 'NEEDS REVIEW'
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                                : 'bg-white/[0.04] border-white/[0.08] text-neutral-400'
                            }`}>
                              {repo.presentationPriority}
                            </span>
                          )}
                          {repo.roleRelevance === 'HIGH' && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-300">
                              Role Aligned
                            </span>
                          )}
                          <Badge
                            variant={
                              repo.classification === 'STRONG PROJECT'
                                ? 'verified'
                                : repo.classification === 'SUPPORTING PROJECT' || repo.classification === 'UTILITY / TOOL'
                                ? 'supported'
                                : repo.classification === 'UNFINISHED / NEEDS REVIEW'
                                ? 'critical'
                                : repo.classification === 'OUTDATED'
                                ? 'weak'
                                : 'neutral'
                            }
                          >
                            {repo.classification}
                          </Badge>
                          {repo.confidence && (
                            <span className="text-[10px] font-mono text-neutral-500">
                              ({repo.confidence} Conf)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-400 pt-1">
                        {repo.language && (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-sky-400" />
                            {repo.language}
                          </span>
                        )}
                        <span>{repo.commitCount} commits</span>
                        {repo.hasReadme ? (
                          <span className="text-emerald-400">✓ README</span>
                        ) : (
                          <span className="text-neutral-500">No README</span>
                        )}
                        {repo.hasTests && <span className="text-emerald-400">✓ Tests</span>}
                        {repo.hasDockerfile && <span className="text-emerald-400">✓ Docker</span>}
                        {repo.hasCi && <span className="text-emerald-400">✓ CI/CD</span>}
                        {repo.lastCommitAt && (
                          <span className="text-neutral-500">
                            Updated {new Date(repo.lastCommitAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                          </span>
                        )}
                      </div>

                      {repo.signals && repo.signals.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {repo.signals.map((sig, sIdx) => (
                            <span
                              key={sIdx}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.02] border border-white/[0.05] text-neutral-400"
                            >
                              • {sig}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="pt-2 border-t border-white/[0.04] text-[11px] text-neutral-400">
                        <span className="text-neutral-500 font-medium">Recruiter Assessment: </span>
                        {repo.recruiterNotes}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

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
                      <div
                        className={`w-5 h-5 rounded-full border mt-0.5 flex items-center justify-center shrink-0 transition-all ${
                          isDone
                            ? 'bg-white border-white text-black'
                            : 'border-neutral-500 bg-transparent hover:border-neutral-400'
                        }`}
                        aria-hidden="true"
                      >
                        {isDone && (
                          <svg className="w-3 h-3 text-black stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </div>

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
