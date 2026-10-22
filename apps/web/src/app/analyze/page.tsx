'use client';

import { useState } from 'react';
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

export default function AnalyzePage() {
  const router = useRouter();

  // Step 1: Resume State
  const [resumeMode, setResumeMode] = useState<'upload' | 'paste'>('upload');
  const [resumeText, setResumeText] = useState('');
  const [uploadedResumeId, setUploadedResumeId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedClaimsCount, setUploadedClaimsCount] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Step 2: GitHub State
  const [githubInput, setGithubInput] = useState('');

  // Step 3: Target Role State
  const [targetMode, setTargetMode] = useState<'preset' | 'custom'>('preset');
  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [customRoleTitle, setCustomRoleTitle] = useState('');
  const [customJdText, setCustomJdText] = useState('');

  // Inspector / Execution State
  const [analyzing, setAnalyzing] = useState(false);
  const [inspectorStage, setInspectorStage] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMessage, setProgressMessage] = useState('Initializing audit engine...');
  const [error, setError] = useState<string | null>(null);

  const INSPECTOR_STEPS = [
    { number: '01', title: 'Resume Inspection', detail: 'Extracting candidate claims, technical stack, and depth' },
    { number: '02', title: 'GitHub Verification', detail: 'Scanning public repositories, dependencies, and commit activity' },
    { number: '03', title: 'Job Requirements', detail: 'Distinguishing required vs preferred competencies' },
    { number: '04', title: 'Evidence Synthesis', detail: 'Correlating evidence, detecting gaps, and generating action plan' },
  ];

  const handleFileUpload = async (file: File) => {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a text-based PDF resume.');
      return;
    }

    setIsUploading(true);
    try {
      if (!api.getToken()) {
        await api.loginDemo();
      }
      const res = await api.uploadResume(file);
      setUploadedResumeId(res.resumeId);
      setUploadedFileName(file.name);
      setUploadedClaimsCount(res.claims?.length || 0);
    } catch (err: unknown) {
      console.error('File upload error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to parse resume PDF.';
      setError(msg);
      setUploadedFileName(null);
      setUploadedResumeId(null);
    } finally {
      setIsUploading(false);
    }
  };

  const loadSampleData = () => {
    setResumeMode('paste');
    setResumeText(SAMPLE_RESUME);
    setGithubInput('Prajjwaltripathi20');
    setTargetMode('preset');
    setSelectedPresetIndex(0);
    setError(null);
  };

  const handleStartAudit = async () => {
    setError(null);

    // Validation
    if (resumeMode === 'upload' && !uploadedResumeId) {
      setError('Please upload a PDF resume or switch to "Paste text".');
      return;
    }
    if (resumeMode === 'paste' && (!resumeText || resumeText.trim().length < 50)) {
      setError('Please provide resume text containing at least 50 characters.');
      return;
    }
    if (!githubInput.trim()) {
      setError('Please provide a GitHub username or profile URL.');
      return;
    }

    setAnalyzing(true);
    setInspectorStage(0);
    setProgressPercent(10);
    setProgressMessage('Extracting technical claims and credentials...');

    try {
      if (!api.getToken()) {
        await api.loginDemo();
      }

      // Step 1: Submit Resume text if pasted
      let effectiveResumeId = uploadedResumeId;
      if (resumeMode === 'paste') {
        const textRes = await api.submitResumeText(resumeText, 'Candidate-Resume.txt');
        effectiveResumeId = textRes.resumeId;
      }

      setInspectorStage(1);
      setProgressPercent(30);
      setProgressMessage('Auditing public GitHub repositories and package manifests...');

      // Step 2: Target Role & JD
      const effectiveRole = targetMode === 'preset'
        ? PRESET_ROLES[selectedPresetIndex].role
        : (customRoleTitle.trim() || 'Software Engineer');

      const effectiveJdText = targetMode === 'custom' && customJdText.trim()
        ? customJdText.trim()
        : `Target Role: ${effectiveRole}\nRequirements: ${PRESET_ROLES[selectedPresetIndex]?.skills?.join(', ') || effectiveRole}`;

      setInspectorStage(2);
      setProgressPercent(55);
      setProgressMessage('Categorizing required and preferred job criteria...');

      // Step 3: Trigger Audit on Backend
      const isDemoAccount = githubInput.trim().toLowerCase() === 'arjunsharma';
      const runRes = await api.startAnalysis({
        resumeId: effectiveResumeId || undefined,
        resumeText: resumeMode === 'paste' ? resumeText : undefined,
        githubUsername: githubInput.trim(),
        jobDescriptionText: effectiveJdText,
        targetRole: effectiveRole,
        isDemo: isDemoAccount,
      });

      const analysisId = runRes.analysisId;

      setInspectorStage(3);
      setProgressPercent(80);
      setProgressMessage('Correlating code evidence against claims and synthesizing roadmap...');

      // Poll analysis progress from backend (up to 60 attempts = ~60s)
      let isCompleted = false;
      for (let attempt = 0; attempt < 60; attempt++) {
        await new Promise((r) => setTimeout(r, 1000));
        const statusRes = await api.getAnalysis(analysisId);
        const currentAnalysis = statusRes.analysis;

        if (currentAnalysis) {
          if (typeof currentAnalysis.progress === 'number') {
            setProgressPercent(Math.max(currentAnalysis.progress as number, 80));
          }
          if (currentAnalysis.progressMessage) {
            setProgressMessage(currentAnalysis.progressMessage as string);
          }
          if (currentAnalysis.status === 'completed') {
            setProgressPercent(100);
            isCompleted = true;
            break;
          }
          if (currentAnalysis.status === 'failed') {
            throw new Error((currentAnalysis.progressMessage as string) || 'Analysis failed during verification.');
          }
        }
      }

      if (!isCompleted) {
        // Double check status once more
        const finalCheck = await api.getAnalysis(analysisId);
        if (finalCheck.analysis?.status === 'failed') {
          throw new Error((finalCheck.analysis.progressMessage as string) || 'Analysis timed out or failed.');
        }
      }

      // Route to dashboard with analysisId
      await new Promise((r) => setTimeout(r, 400));
      router.push(`/dashboard?analysisId=${analysisId}`);
    } catch (err: unknown) {
      console.error('Audit execution error:', err);
      const msg = err instanceof Error ? err.message : 'An error occurred during verification.';
      setError(msg);
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col antialiased selection:bg-white/20 selection:text-white">
      <Navbar />

      <main className="flex-1 py-14">
        <div className="max-w-3xl mx-auto px-6">
          {/* Header */}
          <div className="mb-10">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
                  Analyze your profile.
                </h1>
                <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
                  Compare what you claim, what you can prove, and what your target role requires.
                </p>
              </div>

              {!analyzing && (
                <button
                  type="button"
                  onClick={loadSampleData}
                  className="hidden sm:inline-flex text-xs text-neutral-400 hover:text-white border border-white/[0.08] hover:border-white/[0.2] bg-white/[0.02] px-3 py-1.5 rounded-full transition-colors"
                >
                  Fill Sample Profile
                </button>
              )}
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-8 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between">
              <span className="leading-relaxed">{error}</span>
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-rose-400 hover:text-white text-base ml-4 leading-none"
              >
                &times;
              </button>
            </div>
          )}

          {/* INSPECTOR STATE: Real Technical Diagnostic Process */}
          {analyzing ? (
            <div className="rounded-2xl border border-white/[0.1] bg-white/[0.03] backdrop-blur-2xl p-8 sm:p-10 space-y-8 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-neutral-400">
                    GapCheck Technical Audit
                  </span>
                  <span className="text-xs font-mono text-neutral-300">
                    {progressPercent}%
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-white">
                  Auditing Profile & Evidence
                </h2>
                <p className="text-xs text-neutral-400">
                  {progressMessage}
                </p>
              </div>

              {/* Progress Track */}
              <div className="w-full bg-white/[0.06] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-white h-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Step Checklist */}
              <div className="space-y-3 pt-2">
                {INSPECTOR_STEPS.map((step, idx) => {
                  const isDone = inspectorStage > idx || progressPercent === 100;
                  const isCurrent = inspectorStage === idx && progressPercent < 100;

                  return (
                    <div
                      key={step.number}
                      className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${
                        isCurrent
                          ? 'border-white/[0.2] bg-white/[0.04]'
                          : isDone
                          ? 'border-white/[0.08] bg-transparent opacity-80'
                          : 'border-white/[0.04] bg-transparent opacity-30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-neutral-500">
                          {step.number}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-white">
                            {step.title}
                          </div>
                          <div className="text-xs text-neutral-400">
                            {step.detail}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs">
                        {isDone ? (
                          <span className="text-emerald-400 font-medium">✓ Done</span>
                        ) : isCurrent ? (
                          <span className="text-neutral-300 animate-pulse font-mono">Running...</span>
                        ) : (
                          <span className="text-neutral-600">Pending</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 text-center text-xs text-neutral-500">
                Evaluating verifiable AST claims and GitHub commit history. Please keep this tab open.
              </div>
            </div>
          ) : (
            /* CREATE AUDIT INPUT FORM */
            <div className="space-y-8">
              {/* SECTION 01: RESUME */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-neutral-400">01</span>
                      <h2 className="text-base font-semibold text-white">Resume Input</h2>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
                      Upload your PDF resume or paste raw resume text.
                    </p>
                  </div>

                  <div className="flex bg-neutral-900 border border-white/[0.08] p-0.5 rounded-full self-start">
                    <button
                      type="button"
                      onClick={() => setResumeMode('upload')}
                      className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all ${
                        resumeMode === 'upload'
                          ? 'bg-white text-black shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Upload PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => setResumeMode('paste')}
                      className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all ${
                        resumeMode === 'paste'
                          ? 'bg-white text-black shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Paste Text
                    </button>
                  </div>
                </div>

                {resumeMode === 'upload' ? (
                  <div>
                    <label
                      htmlFor="resume-file-input"
                      className="border border-dashed border-white/[0.12] hover:border-white/[0.25] rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-colors bg-white/[0.01] hover:bg-white/[0.02]"
                    >
                      <input
                        id="resume-file-input"
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                      />
                      <svg
                        className="w-8 h-8 text-neutral-400 mb-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>

                      {isUploading ? (
                        <p className="text-xs text-neutral-300 animate-pulse">
                          Parsing resume text and claims...
                        </p>
                      ) : uploadedFileName ? (
                        <div className="text-center space-y-1">
                          <p className="text-xs font-semibold text-white">
                            {uploadedFileName}
                          </p>
                          <p className="text-[11px] text-emerald-400">
                            ✓ {uploadedClaimsCount || 0} technical claims extracted from document
                          </p>
                          <p className="text-[11px] text-neutral-500 pt-1">
                            Click to replace PDF
                          </p>
                        </div>
                      ) : (
                        <div className="text-center space-y-1">
                          <p className="text-xs font-medium text-white">
                            Click or drag and drop your resume PDF
                          </p>
                          <p className="text-[11px] text-neutral-500">
                            Must be a text-based PDF (scans without OCR are unsupported)
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                ) : (
                  <div>
                    <Textarea
                      rows={7}
                      placeholder="Paste your complete resume markdown or text here (minimum 50 characters)..."
                      value={resumeText}
                      onChange={(e) => setResumeText(e.target.value)}
                    />
                    <div className="flex justify-between items-center text-[11px] text-neutral-500 mt-2 px-1">
                      <span>Includes education, technical skills, projects, and work history</span>
                      <span>{resumeText.length} characters</span>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 02: GITHUB */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8 space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-neutral-400">02</span>
                    <h2 className="text-base font-semibold text-white">GitHub Profile</h2>
                  </div>
                  <p className="text-xs text-neutral-400 mt-1">
                    Enter your public GitHub handle or profile URL. We analyze public repositories, package manifests, and commit history.
                  </p>
                </div>

                <div>
                  <Input
                    placeholder="e.g. Prajjwaltripathi20 or https://github.com/Prajjwaltripathi20"
                    value={githubInput}
                    onChange={(e) => setGithubInput(e.target.value)}
                  />
                  <p className="text-[11px] text-neutral-500 mt-2 px-1">
                    No password or token required. Only publicly accessible repositories are analyzed.
                  </p>
                </div>
              </div>

              {/* SECTION 03: TARGET ROLE */}
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-neutral-400">03</span>
                      <h2 className="text-base font-semibold text-white">Target Role & Requirements</h2>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
                      Select a standard role preset or paste an exact job description.
                    </p>
                  </div>

                  <div className="flex bg-neutral-900 border border-white/[0.08] p-0.5 rounded-full self-start">
                    <button
                      type="button"
                      onClick={() => setTargetMode('preset')}
                      className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all ${
                        targetMode === 'preset'
                          ? 'bg-white text-black shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Preset Role
                    </button>
                    <button
                      type="button"
                      onClick={() => setTargetMode('custom')}
                      className={`text-xs px-3.5 py-1.5 rounded-full font-medium transition-all ${
                        targetMode === 'custom'
                          ? 'bg-white text-black shadow-sm'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Custom JD
                    </button>
                  </div>
                </div>

                {targetMode === 'preset' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {PRESET_ROLES.map((preset, idx) => {
                      const isSelected = selectedPresetIndex === idx;
                      return (
                        <div
                          key={preset.role}
                          onClick={() => setSelectedPresetIndex(idx)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'border-white bg-white/[0.06] shadow-sm'
                              : 'border-white/[0.08] bg-white/[0.01] hover:border-white/[0.2]'
                          }`}
                        >
                          <div className="text-xs font-semibold text-white">
                            {preset.role}
                          </div>
                          <div className="text-[11px] text-neutral-400 mt-1 line-clamp-2">
                            {preset.description}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-3">
                            {preset.skills.slice(0, 3).map((s) => (
                              <span
                                key={s}
                                className="text-[10px] px-2 py-0.5 rounded bg-white/[0.04] text-neutral-300 font-mono"
                              >
                                {s}
                              </span>
                            ))}
                            {preset.skills.length > 3 && (
                              <span className="text-[10px] px-1.5 py-0.5 text-neutral-500">
                                +{preset.skills.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Input
                      placeholder="Target Job Title (e.g. Senior Frontend Engineer)"
                      value={customRoleTitle}
                      onChange={(e) => setCustomRoleTitle(e.target.value)}
                    />
                    <Textarea
                      rows={5}
                      placeholder="Paste the target job description here... GapCheck will extract required vs. preferred criteria."
                      value={customJdText}
                      onChange={(e) => setCustomJdText(e.target.value)}
                    />
                    <p className="text-[11px] text-neutral-500 px-1">
                      Pasting an exact job description allows GapCheck to distinguish must-have requirements from nice-to-haves.
                    </p>
                  </div>
                )}
              </div>

              {/* ACTION: RUN GAPCHECK */}
              <div className="pt-2">
                <Button
                  onClick={handleStartAudit}
                  size="lg"
                  className="w-full text-sm font-semibold tracking-wide py-4"
                >
                  Run GapCheck →
                </Button>
                <p className="text-center text-xs text-neutral-500 mt-3">
                  Cross-examining resume claims against observable public code evidence.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
