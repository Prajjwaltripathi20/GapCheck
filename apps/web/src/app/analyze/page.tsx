'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import api from '@/lib/api';

const PRESET_ROLES = [
  {
    role: 'Full Stack Engineer',
    skills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'Redis'],
    description: 'Builds end-to-end web applications, scalable APIs, and manages relational databases.',
  },
  {
    role: 'Frontend Developer',
    skills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Testing (Jest/Vitest)'],
    description: 'Designs responsive client interfaces, state management, and modern component architectures.',
  },
  {
    role: 'Backend Systems Engineer',
    skills: ['Node.js', 'Go', 'Python', 'PostgreSQL', 'Docker', 'Distributed Systems'],
    description: 'Architects microservices, database schemas, caching layers, and high-throughput APIs.',
  },
  {
    role: 'AI / ML Engineer',
    skills: ['Python', 'PyTorch', 'TensorFlow', 'FastAPI', 'Docker', 'Vector DBs'],
    description: 'Develops model inference pipelines, vector search integrations, and data processing workloads.',
  },
];

const SAMPLE_RESUME = `Prajjwal Tripathi
Email: prajjwal.tripathi@example.com | GitHub: github.com/Prajjwaltripathi20
Target Role: Full Stack Engineer

EDUCATION:
B.Tech in Computer Science & Engineering (2022 - 2026)

TECHNICAL SKILLS:
- Languages: JavaScript, TypeScript, Python, HTML/CSS, SQL
- Frameworks: React, Next.js, Express, Node.js, Tailwind CSS
- Databases: PostgreSQL, MongoDB, Redis, MySQL
- Infrastructure & Tools: Git, GitHub, Docker, Vercel, Postman

PROJECTS:
1. WashEase - Laundry Management System
   - Full stack laundry management solution built with React, Vite, Express, and Node.js.
   - Designed responsive customer booking UI and order tracking dashboard.
   - Implemented RESTful APIs for inventory scheduling and status notifications.

2. DhanRaksha - Financial Security Tracker
   - Personal finance and security management platform built with React and Express.
   - Integrated secure multi-account tracking and budget analytics with visual graphs.

3. GapCheck - Pre-recruiter Placement Audit Engine
   - Technical verification system cross-referencing resume claims with public GitHub code proof.
   - Built with Next.js, TypeScript, Express, and PostgreSQL with automated report generation.`;

const COMMON_SKILLS_LIST = [
  'React', 'Next.js', 'Vue', 'Angular', 'TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Java', 'C++',
  'Node.js', 'Express', 'Django', 'FastAPI', 'Spring Boot', 'PostgreSQL', 'MongoDB', 'Redis', 'MySQL',
  'Docker', 'Kubernetes', 'AWS', 'GCP', 'Azure', 'Git', 'GitHub', 'CI/CD', 'GraphQL', 'REST APIs',
  'Tailwind CSS', 'Postman', 'Vercel', 'Linux', 'Jest', 'PyTorch', 'TensorFlow'
];

const DETERMINISTIC_STAGES = [
  { id: 1, title: 'Reading resume', description: 'Extracting technical claims, competencies, and scope' },
  { id: 2, title: 'Scanning public GitHub profile', description: 'Inspecting publicly accessible repositories and metadata' },
  { id: 3, title: 'Analyzing repositories', description: 'Auditing languages, commit frequency, tests, and documentation' },
  { id: 4, title: 'Checking resume ↔ GitHub evidence', description: 'Cross-referencing stated skills against observable source code' },
  { id: 5, title: 'Comparing against target role', description: 'Mapping technical requirements to observable competencies' },
  { id: 6, title: 'Running recruiter perspective audit', description: 'Detecting interview concerns and evidence gaps' },
  { id: 7, title: 'Building your application plan', description: 'Synthesizing pre-application decision, priorities, and action items' },
];

export default function AnalyzePage() {
  const router = useRouter();

  // Wizard Step: 1 = Resume, 2 = GitHub, 3 = Target Role, 4 = Review
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Resume State
  const [resumeMode, setResumeMode] = useState<'upload' | 'paste'>('upload');
  const [resumeText, setResumeText] = useState('');
  const [uploadedResumeId, setUploadedResumeId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedClaims, setUploadedClaims] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [resumeReadError, setResumeReadError] = useState<string | null>(null);

  // Step 2: GitHub State
  const [githubInput, setGithubInput] = useState('');
  const [githubError, setGithubError] = useState<string | null>(null);

  // Step 3: Target Role State
  const [targetMode, setTargetMode] = useState<'preset' | 'custom'>('preset');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [customRoleTitle, setCustomRoleTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [customJdText, setCustomJdText] = useState('');

  // Analysis / Inspector State
  const [analyzing, setAnalyzing] = useState(false);
  const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
  const [activeStageId, setActiveStageId] = useState<number>(1);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // General error banner
  const [error, setError] = useState<string | null>(null);

  // Auth gate
  useEffect(() => {
    if (typeof window !== 'undefined' && !api.getToken()) {
      router.push('/login');
    }
  }, [router]);

  // Load draft from sessionStorage on initial mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const timer = setTimeout(() => {
      try {
        const saved = sessionStorage.getItem('gapcheck_audit_draft');
        if (saved) {
          const draft = JSON.parse(saved);
          if (draft.wizardStep) setWizardStep(draft.wizardStep);
          if (draft.resumeMode) setResumeMode(draft.resumeMode);
          if (draft.resumeText) setResumeText(draft.resumeText);
          if (draft.uploadedResumeId) setUploadedResumeId(draft.uploadedResumeId);
          if (draft.uploadedFileName) setUploadedFileName(draft.uploadedFileName);
          if (draft.uploadedClaims) setUploadedClaims(draft.uploadedClaims);
          if (draft.githubInput) setGithubInput(draft.githubInput);
          if (draft.targetMode) setTargetMode(draft.targetMode);
          if (typeof draft.selectedPresetIndex === 'number') setSelectedPresetIndex(draft.selectedPresetIndex);
          if (draft.customRoleTitle) setCustomRoleTitle(draft.customRoleTitle);
          if (draft.companyName) setCompanyName(draft.companyName);
          if (draft.customJdText) setCustomJdText(draft.customJdText);
        }
      } catch {
        // ignore draft parse error
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Save draft to sessionStorage on state changes
  useEffect(() => {
    if (typeof window === 'undefined' || analyzing) return;
    try {
      sessionStorage.setItem(
        'gapcheck_audit_draft',
        JSON.stringify({
          wizardStep,
          resumeMode,
          resumeText,
          uploadedResumeId,
          uploadedFileName,
          uploadedClaims,
          githubInput,
          targetMode,
          selectedPresetIndex,
          customRoleTitle,
          companyName,
          customJdText,
        })
      );
    } catch {
      // non-blocking
    }
  }, [
    wizardStep,
    resumeMode,
    resumeText,
    uploadedResumeId,
    uploadedFileName,
    uploadedClaims,
    githubInput,
    targetMode,
    selectedPresetIndex,
    customRoleTitle,
    companyName,
    customJdText,
    analyzing,
  ]);

  // Compute detected claims for pasted text
  const detectedPastedClaims = useMemo(() => {
    if (!resumeText || resumeText.length < 20) return [];
    const textLower = resumeText.toLowerCase();
    return COMMON_SKILLS_LIST.filter((skill) =>
      textLower.includes(skill.toLowerCase())
    );
  }, [resumeText]);

  // Effective technical claims list
  const activeClaimsList = useMemo(() => {
    if (resumeMode === 'upload') {
      return uploadedClaims;
    }
    return detectedPastedClaims;
  }, [resumeMode, uploadedClaims, detectedPastedClaims]);

  // Normalized GitHub preview calculation
  const normalizedGitHub = useMemo(() => {
    const raw = githubInput.trim();
    if (!raw) return null;
    let username = raw.replace(/^https?:\/\//i, '').replace(/^(www\.)?github\.com\//i, '').replace(/^@/, '').trim();
    username = username.split('/')[0].split('?')[0];
    if (!username || username.includes('.') || username.length > 39) {
      return null;
    }
    return username;
  }, [githubInput]);

  // Effective target role
  const effectiveTargetRole = useMemo(() => {
    if (targetMode === 'preset') {
      return PRESET_ROLES[selectedPresetIndex]?.role || 'Full Stack Engineer';
    }
    return customRoleTitle.trim() || 'Software Engineer';
  }, [targetMode, selectedPresetIndex, customRoleTitle]);

  // Is JD limited / short
  const isJdLimited = useMemo(() => {
    if (!customJdText.trim()) return false;
    const wordCount = customJdText.trim().split(/\s+/).length;
    return wordCount < 50;
  }, [customJdText]);

  // Map progress to deterministic stage 1-7
  const mapProgressToStage = (progress: number, message?: string): number => {
    const msg = (message || '').toLowerCase();
    if (msg.includes('reading resume') || msg.includes('parsing resume')) return 1;
    if (msg.includes('scanning public github')) return 2;
    if (msg.includes('analyzing repositories')) return 3;
    if (msg.includes('checking resume') || msg.includes('cross-referencing')) return 4;
    if (msg.includes('comparing against target role')) return 5;
    if (msg.includes('recruiter perspective audit')) return 6;
    if (msg.includes('building your application plan') || msg.includes('synthesizing')) return 7;

    if (progress < 20) return 1;
    if (progress < 35) return 2;
    if (progress < 50) return 3;
    if (progress < 65) return 4;
    if (progress < 80) return 5;
    if (progress < 90) return 6;
    return 7;
  };

  // Poll analysis status
  const pollAnalysisStatus = useCallback(
    async (analysisId: string) => {
      let isCompleted = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const statusRes = await api.getAnalysis(analysisId);
          const currentAnalysis = statusRes.analysis;

          if (currentAnalysis) {
            const prog = typeof currentAnalysis.progress === 'number' ? currentAnalysis.progress : 50;
            const stage = mapProgressToStage(prog, currentAnalysis.progressMessage as string);
            setActiveStageId(stage);

            if (currentAnalysis.status === 'completed') {
              setActiveStageId(7);
              isCompleted = true;
              sessionStorage.removeItem('gapcheck_active_analysis_id');
              await new Promise((r) => setTimeout(r, 500));
              router.push(`/dashboard?analysisId=${analysisId}`);
              break;
            }

            if (currentAnalysis.status === 'failed') {
              sessionStorage.removeItem('gapcheck_active_analysis_id');
              setAnalysisError((currentAnalysis.progressMessage as string) || 'Analysis could not be completed.');
              break;
            }
          }
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Connection check failed';
          if (msg.includes('failed during verification')) {
            setAnalysisError(msg);
            break;
          }
        }
      }

      if (!isCompleted && !analysisError) {
        // If 60 attempts expired without complete or fail
        // check final status
        try {
          const finalCheck = await api.getAnalysis(analysisId);
          if (finalCheck.analysis?.status === 'completed') {
            router.push(`/dashboard?analysisId=${analysisId}`);
          }
        } catch {
          // ignore
        }
      }
    },
    [router, analysisError]
  );

  // Recover active analysis on page reload or return
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const pendingAnalysisId = sessionStorage.getItem('gapcheck_active_analysis_id');
    if (!pendingAnalysisId) return;

    let isSubscribed = true;
    const checkInterruptedAnalysis = async () => {
      try {
        const res = await api.getAnalysis(pendingAnalysisId);
        const analysis = res.analysis;
        if (!analysis || !isSubscribed) return;

        setActiveAnalysisId(pendingAnalysisId);

        if (analysis.status === 'completed') {
          sessionStorage.removeItem('gapcheck_active_analysis_id');
          router.push(`/dashboard?analysisId=${pendingAnalysisId}`);
        } else if (analysis.status === 'failed') {
          sessionStorage.removeItem('gapcheck_active_analysis_id');
          setAnalyzing(true);
          setAnalysisError((analysis.progressMessage as string) || 'Previous analysis attempt could not be completed.');
        } else {
          // Still in progress - resume polling
          setAnalyzing(true);
          const prog = (analysis.progress as number) || 50;
          setActiveStageId(mapProgressToStage(prog, analysis.progressMessage as string));
          pollAnalysisStatus(pendingAnalysisId);
        }
      } catch {
        sessionStorage.removeItem('gapcheck_active_analysis_id');
      }
    };

    checkInterruptedAnalysis();
    return () => {
      isSubscribed = false;
    };
  }, [router, pollAnalysisStatus]);

  // Step 1: File Upload Handler
  const handleFileUpload = async (file: File) => {
    setResumeReadError(null);
    setError(null);

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setResumeReadError('Please upload a text-based PDF resume.');
      return;
    }

    setIsUploading(true);
    try {
      const res = await api.uploadResume(file);
      setUploadedResumeId(res.resumeId);
      setUploadedFileName(file.name);

      const claimNames: string[] = [];
      if (Array.isArray(res.claims)) {
        res.claims.forEach((c: unknown) => {
          if (c && typeof c === 'object' && 'claim' in c) {
            const claimVal = (c as { claim: unknown }).claim;
            if (typeof claimVal === 'string') {
              claimNames.push(claimVal);
            }
          }
        });
      }
      setUploadedClaims(claimNames);
    } catch (err: unknown) {
      console.error('File upload error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to parse resume PDF.';
      setResumeReadError(msg);
      setUploadedFileName(null);
      setUploadedResumeId(null);
      setUploadedClaims([]);
    } finally {
      setIsUploading(false);
    }
  };

  // Preload sample student profile
  const loadSampleData = () => {
    setResumeMode('paste');
    setResumeText(SAMPLE_RESUME);
    setGithubInput('Prajjwaltripathi20');
    setTargetMode('preset');
    setSelectedPresetIndex(0);
    setCompanyName('Modern Web Corp');
    setError(null);
    setResumeReadError(null);
    setGithubError(null);
  };

  // Step Validation Helpers
  const isStep1Valid = Boolean(
    (resumeMode === 'upload' && uploadedResumeId) ||
    (resumeMode === 'paste' && resumeText.trim().length >= 50)
  );

  const isStep2Valid = Boolean(normalizedGitHub);

  const isStep3Valid = Boolean(
    targetMode === 'preset' || (targetMode === 'custom' && customRoleTitle.trim().length > 0)
  );

  // Step Navigation
  const handleGoToStep2 = () => {
    if (!isStep1Valid) {
      setError('Please provide a readable resume before continuing.');
      return;
    }
    setError(null);
    setWizardStep(2);
  };

  const handleGoToStep3 = () => {
    if (!normalizedGitHub) {
      setGithubError('Please enter a valid GitHub username or profile URL.');
      return;
    }
    setGithubError(null);
    setError(null);
    setWizardStep(3);
  };

  const handleGoToStep4 = () => {
    if (!isStep3Valid) {
      setError('Please specify your target role before reviewing.');
      return;
    }
    setError(null);
    setWizardStep(4);
  };

  // Launch Analysis
  const handleStartAudit = async () => {
    setError(null);
    setAnalysisError(null);

    if (!isStep1Valid || !isStep2Valid || !isStep3Valid) {
      setError('Please complete all required fields before running the audit.');
      return;
    }

    setAnalyzing(true);
    setActiveStageId(1);

    try {
      const isDemo = normalizedGitHub?.toLowerCase() === 'arjunsharma';
      const res = await api.startAnalysis({
        resumeId: resumeMode === 'upload' ? uploadedResumeId || undefined : undefined,
        resumeText: resumeMode === 'paste' ? resumeText : undefined,
        githubUsername: normalizedGitHub || undefined,
        jobDescriptionText: customJdText.trim() ? customJdText : undefined,
        targetRole: effectiveTargetRole,
        company: companyName.trim() || undefined,
        isDemo,
      });

      const analysisId = res.analysisId;
      setActiveAnalysisId(analysisId);

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('gapcheck_active_analysis_id', analysisId);
      }

      if (res.analysis?.status === 'completed') {
        setActiveStageId(7);
        sessionStorage.removeItem('gapcheck_active_analysis_id');
        await new Promise((r) => setTimeout(r, 400));
        router.push(`/dashboard?analysisId=${analysisId}`);
      } else {
        pollAnalysisStatus(analysisId);
      }
    } catch (err: unknown) {
      console.error('Audit initiation error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to start GapCheck audit';
      setAnalysisError(msg);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('gapcheck_active_analysis_id');
      }
    }
  };

  // Safe Retry Analysis
  const handleRetryAnalysis = async () => {
    if (!activeAnalysisId) return;
    setIsRetrying(true);
    setAnalysisError(null);
    setActiveStageId(1);

    try {
      const res = await api.retryAnalysis(activeAnalysisId);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('gapcheck_active_analysis_id', activeAnalysisId);
      }

      if (res.status === 'completed') {
        setActiveStageId(7);
        sessionStorage.removeItem('gapcheck_active_analysis_id');
        router.push(`/dashboard?analysisId=${activeAnalysisId}`);
      } else {
        pollAnalysisStatus(activeAnalysisId);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Retry failed';
      setAnalysisError(msg);
    } finally {
      setIsRetrying(false);
    }
  };

  // ANALYSIS SCREEN: DETERMINISTIC 7-STAGE PROGRESSION & RECOVERY
  if (analyzing) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col antialiased">
        <Navbar />

        <main className="flex-1 max-w-3xl mx-auto px-6 py-16 flex flex-col justify-center">
          {analysisError ? (
            /* Analysis Failure Recovery State */
            <div className="p-8 rounded-3xl bg-[#0e0e11] border border-rose-500/30 space-y-6 shadow-2xl">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-rose-500" />
                <h2 className="text-xl font-semibold text-white">We couldn&apos;t complete this GapCheck.</h2>
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs text-neutral-300 leading-relaxed space-y-2">
                <p className="text-emerald-400 font-medium">✓ Your original inputs are safe.</p>
                <p className="text-neutral-400">
                  <span className="font-semibold text-neutral-200">Reason:</span> {analysisError}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleRetryAnalysis}
                  disabled={isRetrying}
                >
                  {isRetrying ? 'Retrying...' : 'Retry Analysis'}
                </Button>

                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => {
                    setAnalyzing(false);
                    setAnalysisError(null);
                    router.push('/dashboard');
                  }}
                >
                  Back to Dashboard
                </Button>
              </div>
            </div>
          ) : (
            /* Deterministic 7-Stage Execution View */
            <div className="space-y-8">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-400 font-mono mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Audit in progress &bull; {effectiveTargetRole}
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
                  Analyzing your profile
                </h1>
                <p className="text-xs sm:text-sm text-neutral-400 max-w-lg mx-auto leading-relaxed">
                  GapCheck is comparing observable evidence. It is not judging your potential or predicting hiring outcomes.
                </p>
              </div>

              {/* Sequential 7 Stages Card */}
              <div className="p-6 sm:p-8 rounded-3xl bg-[#0e0e11] border border-white/[0.08] shadow-2xl space-y-4">
                {DETERMINISTIC_STAGES.map((stage) => {
                  const isDone = activeStageId > stage.id;
                  const isActive = activeStageId === stage.id;

                  return (
                    <div
                      key={stage.id}
                      className={`flex items-start gap-4 p-3.5 rounded-2xl transition-all duration-300 ${
                        isActive
                          ? 'bg-white/[0.06] border border-white/[0.12] shadow-sm'
                          : isDone
                          ? 'bg-transparent border border-transparent'
                          : 'opacity-40 bg-transparent border border-transparent'
                      }`}
                    >
                      <div className="pt-0.5">
                        {isDone ? (
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center text-xs font-bold">
                            ✓
                          </span>
                        ) : isActive ? (
                          <span className="w-5 h-5 rounded-full bg-white/20 text-white border border-white/40 flex items-center justify-center text-xs animate-pulse">
                            ●
                          </span>
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-white/[0.05] text-neutral-600 border border-white/[0.08] flex items-center justify-center text-xs">
                            ○
                          </span>
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3
                            className={`text-sm font-medium tracking-tight ${
                              isActive ? 'text-white font-semibold' : isDone ? 'text-neutral-200' : 'text-neutral-500'
                            }`}
                          >
                            {stage.title}
                          </h3>
                          {isActive && (
                            <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">
                          {stage.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-center text-[11px] text-neutral-500 font-mono">
                Preserving immutable snapshot in database &bull; Do not close your browser
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // WIZARD SCREEN: 4-STEP CREATE AUDIT FLOW
  return (
    <div className="min-h-screen bg-black text-white flex flex-col antialiased selection:bg-white/20 selection:text-white">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full space-y-10">
        {/* Wizard Header & Top Progress Indicator */}
        <div className="space-y-6 border-b border-white/[0.08] pb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] uppercase font-mono tracking-wider text-emerald-400 font-semibold">
                GapCheck Wizard
              </span>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mt-1">
                Create Placement Audit
              </h1>
            </div>

            <button
              onClick={loadSampleData}
              className="text-xs font-mono text-neutral-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/[0.1] bg-white/[0.03] transition-colors self-start sm:self-auto cursor-pointer"
            >
              Load Sample Profile
            </button>
          </div>

          {/* 4-Step Progress Indicator */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { num: 1, label: '01 Resume', desc: 'Claims extraction' },
              { num: 2, label: '02 GitHub', desc: 'Public profile scan' },
              { num: 3, label: '03 Target Role', desc: 'Job alignment' },
              { num: 4, label: '04 Review', desc: 'Config summary' },
            ].map((s) => {
              const isCurrent = wizardStep === s.num;
              const isPast = wizardStep > s.num;

              return (
                <button
                  key={s.num}
                  type="button"
                  onClick={() => {
                    // Allow clicking backward or current
                    if (s.num < wizardStep) setWizardStep(s.num as 1 | 2 | 3 | 4);
                  }}
                  className={`text-left p-3 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'bg-white/[0.08] border-white/[0.2] text-white shadow-sm'
                      : isPast
                      ? 'bg-white/[0.03] border-emerald-500/30 text-emerald-300 hover:bg-white/[0.05] cursor-pointer'
                      : 'bg-white/[0.01] border-white/[0.05] text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{s.label}</span>
                    {isPast && <span className="text-emerald-400">✓</span>}
                  </div>
                  <div className="text-[10px] text-neutral-400 truncate mt-0.5">{s.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-neutral-400 hover:text-white text-base">
              &times;
            </button>
          </div>
        )}

        {/* STEP 1: RESUME */}
        {wizardStep === 1 && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                01 — Your Resume
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                GapCheck uses your resume to identify technical claims and compare them against publicly observable evidence.
              </p>
            </div>

            {/* Mode Switcher: PDF Upload vs Paste */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] max-w-xs">
              <button
                type="button"
                onClick={() => setResumeMode('upload')}
                className={`flex-1 text-xs py-1.5 rounded-lg transition-all ${
                  resumeMode === 'upload' ? 'bg-white/[0.12] text-white font-medium shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Upload PDF
              </button>
              <button
                type="button"
                onClick={() => setResumeMode('paste')}
                className={`flex-1 text-xs py-1.5 rounded-lg transition-all ${
                  resumeMode === 'paste' ? 'bg-white/[0.12] text-white font-medium shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Paste text
              </button>
            </div>

            {resumeMode === 'upload' ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-white/[0.12] hover:border-white/[0.25] rounded-3xl p-8 sm:p-12 text-center bg-white/[0.01] transition-all">
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    className="hidden"
                    id="resume-pdf-upload"
                  />
                  <label htmlFor="resume-pdf-upload" className="cursor-pointer space-y-3 block">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/[0.1] flex items-center justify-center mx-auto text-lg text-white">
                      📄
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-white hover:underline">
                        {isUploading ? 'Extracting text...' : 'Click to upload your resume PDF'}
                      </span>
                      <p className="text-xs text-neutral-400 mt-1">Must be a text-based PDF up to 10MB</p>
                    </div>
                  </label>
                </div>

                {uploadedFileName && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between text-xs text-emerald-300">
                    <div className="flex items-center gap-2">
                      <span>✓</span>
                      <span className="font-semibold">{uploadedFileName}</span>
                      <span className="text-neutral-400">&bull;</span>
                      <span>{uploadedClaims.length} technical claims detected</span>
                    </div>
                    <button
                      onClick={() => {
                        setUploadedFileName(null);
                        setUploadedResumeId(null);
                        setUploadedClaims([]);
                      }}
                      className="text-neutral-400 hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <Textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  placeholder="Paste your raw resume text here (experience, skills, projects)..."
                  rows={10}
                  className="font-mono text-xs leading-relaxed"
                />
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>{resumeText.length} characters</span>
                  <span>{detectedPastedClaims.length} technical competencies recognized</span>
                </div>
              </div>
            )}

            {/* Resume Error Alert */}
            {resumeReadError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3">
                <p className="text-xs text-rose-300 font-medium">{resumeReadError}</p>
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setResumeReadError(null);
                      setResumeMode('paste');
                    }}
                  >
                    Paste resume text instead
                  </Button>
                </div>
              </div>
            )}

            {/* Lightweight Technical Claims Preview */}
            {activeClaimsList.length > 0 && (
              <div className="p-5 rounded-2xl bg-[#0e0e11] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white uppercase tracking-wider font-mono">
                    Technical claims detected ({activeClaimsList.length})
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">Ready for evidence matching</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeClaimsList.slice(0, 16).map((c, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono bg-white/[0.05] border border-white/[0.08] text-neutral-200"
                    >
                      {c}
                    </span>
                  ))}
                  {activeClaimsList.length > 16 && (
                    <span className="px-2 py-1 text-xs text-neutral-500">
                      +{activeClaimsList.length - 16} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Trust Clarification */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] text-xs text-neutral-400 leading-relaxed">
              <span className="font-semibold text-neutral-200">GapCheck does not grade your writing style.</span> It
              evaluates stated claims against observable public code evidence.
            </div>

            <div className="flex justify-end pt-4">
              <Button
                variant="primary"
                size="md"
                onClick={handleGoToStep2}
                disabled={!isStep1Valid || isUploading}
              >
                Next: GitHub →
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: GITHUB */}
        {wizardStep === 2 && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                02 — Your GitHub
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                Provide your GitHub username or profile URL so GapCheck can inspect public repositories and code artifacts.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-300 block">
                GitHub username or profile URL
              </label>
              <Input
                type="text"
                placeholder="e.g. PrajjwalTripathi20 or https://github.com/PrajjwalTripathi20"
                value={githubInput}
                onChange={(e) => {
                  setGithubInput(e.target.value);
                  setGithubError(null);
                }}
              />
              {githubError && <p className="text-xs text-rose-400 mt-1">{githubError}</p>}
            </div>

            {/* Normalized Preview Card */}
            {normalizedGitHub ? (
              <div className="p-6 rounded-3xl bg-[#0e0e11] border border-white/[0.1] space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-emerald-400">✓ Valid profile input:</span>
                    <span className="text-sm font-semibold text-white font-mono">github.com/{normalizedGitHub}</span>
                  </div>
                  <span className="text-[10px] text-neutral-400 uppercase font-mono tracking-wider">Public Profile</span>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-neutral-300 font-medium">Observable evidence GapCheck will inspect:</p>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-400 font-mono">
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400">&bull;</span> Public repositories & source code
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400">&bull;</span> Repository activity & commit timelines
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400">&bull;</span> README & documentation completeness
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-emerald-400">&bull;</span> Package manifests (npm, pip, cargo)
                    </li>
                  </ul>
                </div>
              </div>
            ) : null}

            {/* Public Evidence Only Notice */}
            <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] space-y-2 text-xs leading-relaxed">
              <div className="flex items-center gap-2 text-white font-semibold">
                <span className="text-emerald-400">ℹ</span>
                <span>Public evidence only</span>
              </div>
              <p className="text-neutral-400">
                GapCheck analyzes publicly accessible GitHub information. Private repositories are never accessed.
                When evidence cannot be found, GapCheck reports{' '}
                <span className="text-neutral-200 italic font-mono">&ldquo;No public evidence was found for X in the scanned profile.&rdquo;</span> It does not assume you lack the skill.
              </p>
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button variant="secondary" size="md" onClick={() => setWizardStep(1)}>
                ← Back: Resume
              </Button>
              <Button variant="primary" size="md" onClick={handleGoToStep3} disabled={!isStep2Valid}>
                Next: Target Role →
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: TARGET ROLE */}
        {wizardStep === 3 && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                03 — Target Role
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                The job description helps GapCheck identify which skills and requirements matter most for this application.
              </p>
            </div>

            {/* Preset vs Custom Mode */}
            <div className="flex items-center gap-2 p-1 rounded-xl bg-white/[0.04] border border-white/[0.08] max-w-xs">
              <button
                type="button"
                onClick={() => setTargetMode('preset')}
                className={`flex-1 text-xs py-1.5 rounded-lg transition-all ${
                  targetMode === 'preset' ? 'bg-white/[0.12] text-white font-medium shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Standard Roles
              </button>
              <button
                type="button"
                onClick={() => setTargetMode('custom')}
                className={`flex-1 text-xs py-1.5 rounded-lg transition-all ${
                  targetMode === 'custom' ? 'bg-white/[0.12] text-white font-medium shadow-sm' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Custom Role
              </button>
            </div>

            {targetMode === 'preset' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PRESET_ROLES.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedPresetIndex(idx)}
                    className={`text-left p-4 rounded-2xl border transition-all ${
                      selectedPresetIndex === idx
                        ? 'bg-white/[0.08] border-white/[0.2] text-white shadow-sm'
                        : 'bg-white/[0.02] border-white/[0.06] text-neutral-400 hover:bg-white/[0.04] hover:text-white'
                    }`}
                  >
                    <div className="text-sm font-semibold text-white">{preset.role}</div>
                    <p className="text-xs text-neutral-400 mt-1 leading-relaxed">{preset.description}</p>
                    <div className="flex flex-wrap gap-1 mt-3">
                      {preset.skills.map((s, si) => (
                        <span key={si} className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-neutral-300">
                          {s}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-medium text-neutral-300 block">Target Role Title</label>
                <Input
                  type="text"
                  placeholder="e.g. Frontend Developer Intern, Cloud Infrastructure Engineer"
                  value={customRoleTitle}
                  onChange={(e) => setCustomRoleTitle(e.target.value)}
                />
              </div>
            )}

            {/* Company Name (Optional) */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-300 block">
                Target Company <span className="text-neutral-500">(Optional)</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Stripe, Vercel, Datadog"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            {/* Job Description Paste */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-neutral-300 block">
                Job Description Text <span className="text-neutral-500">(Optional but recommended)</span>
              </label>
              <Textarea
                placeholder="Paste the full job posting or requirements here to enable role-specific gap detection..."
                value={customJdText}
                onChange={(e) => setCustomJdText(e.target.value)}
                rows={6}
                className="font-mono text-xs leading-relaxed"
              />
            </div>

            {/* Limited JD Evidence Indicator */}
            {isJdLimited && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 space-y-1">
                <p className="font-semibold">Target job evidence: Limited</p>
                <p className="text-amber-200/80 leading-relaxed">
                  This job description contains limited technical detail (fewer than 50 words). Role-specific gap detection may therefore be less precise.
                </p>
              </div>
            )}

            <div className="flex items-center justify-between pt-4">
              <Button variant="secondary" size="md" onClick={() => setWizardStep(2)}>
                ← Back: GitHub
              </Button>
              <Button variant="primary" size="md" onClick={handleGoToStep4} disabled={!isStep3Valid}>
                Next: Review →
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW & START */}
        {wizardStep === 4 && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-white">
                04 — Review Your Audit
              </h2>
              <p className="text-xs sm:text-sm text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                Review your configuration summary before running the deterministic placement verification engine.
              </p>
            </div>

            {/* Configuration Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Resume Card */}
              <div className="p-5 rounded-3xl bg-[#0e0e11] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">01 Resume</span>
                  <button onClick={() => setWizardStep(1)} className="text-xs text-emerald-400 hover:underline">
                    Edit
                  </button>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <span className="text-emerald-400">✓</span> Ready
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 truncate">
                    {resumeMode === 'upload' ? uploadedFileName : 'Pasted resume text'}
                  </p>
                  <p className="text-xs text-emerald-400 mt-1 font-mono">
                    {activeClaimsList.length} technical claims detected
                  </p>
                </div>
              </div>

              {/* GitHub Card */}
              <div className="p-5 rounded-3xl bg-[#0e0e11] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">02 GitHub</span>
                  <button onClick={() => setWizardStep(2)} className="text-xs text-emerald-400 hover:underline">
                    Edit
                  </button>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <span className="text-emerald-400">✓</span> Ready
                  </div>
                  <p className="text-xs text-neutral-400 mt-1 font-mono truncate">@{normalizedGitHub}</p>
                  <p className="text-xs text-neutral-400 mt-1">Public profile & repositories</p>
                </div>
              </div>

              {/* Target Role Card */}
              <div className="p-5 rounded-3xl bg-[#0e0e11] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">03 Role</span>
                  <button onClick={() => setWizardStep(3)} className="text-xs text-emerald-400 hover:underline">
                    Edit
                  </button>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white truncate">{effectiveTargetRole}</div>
                  <p className="text-xs text-neutral-400 mt-1 truncate">
                    Company: {companyName.trim() || 'Not specified'}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    JD: {customJdText.trim() ? (isJdLimited ? 'Limited' : 'Detailed') : 'General baseline'}
                  </p>
                </div>
              </div>
            </div>

            {/* What GapCheck Will Analyze Checklist */}
            <div className="p-6 sm:p-8 rounded-3xl bg-[#0e0e11] border border-white/[0.08] space-y-4">
              <h3 className="text-sm font-semibold text-white uppercase tracking-wider font-mono">
                What GapCheck will analyze
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-neutral-300">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span> Resume technical claims & skills
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span> Public GitHub repositories & code AST
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span> Observable repository evidence & tests
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span> Resume ↔ GitHub consistency check
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span> Target-role requirement alignment
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span> Recruiter-facing concerns & probes
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-bold">✓</span> Application readiness & 14-day roadmap
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button variant="secondary" size="md" onClick={() => setWizardStep(3)}>
                ← Back: Target Role
              </Button>
              <Button variant="primary" size="lg" onClick={handleStartAudit} className="px-8 shadow-lg">
                Run GapCheck →
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
