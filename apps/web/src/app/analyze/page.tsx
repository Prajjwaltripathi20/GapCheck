'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Upload, 
  GitBranch, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  Loader2, 
  ShieldCheck, 
  Code, 
  AlertCircle 
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import api from '@/lib/api';

const PRESET_JDS = [
  {
    title: 'Full-Stack Software Engineer (SDE-1)',
    company: 'Fintech Scaleup',
    skills: ['TypeScript', 'Node.js', 'React', 'PostgreSQL', 'Docker', 'Redis', 'Unit Testing'],
    text: `We are looking for a Full-Stack Software Engineer to build and scale our payment settlement engine.
Requirements:
- Strong proficiency in TypeScript, React, and Node.js.
- Relational database experience (PostgreSQL, schema migrations, indexing).
- Practical experience with containerization (Docker) and caching mechanisms (Redis).
- Commitment to software quality with unit testing and CI/CD pipelines.`
  },
  {
    title: 'Backend Systems Engineer',
    company: 'Cloud Infrastructure Corp',
    skills: ['Go', 'Node.js', 'Distributed Systems', 'PostgreSQL', 'Docker', 'Kubernetes'],
    text: `Seeking a Backend Systems Engineer to architect resilient microservices and internal cloud orchestration tooling.
Requirements:
- Hands-on expertise in backend services, asynchronous queues, and API design.
- Deep understanding of database internals, concurrency, and caching.
- Infrastructure awareness: Docker containers, Kubernetes fundamentals, metrics and logging.`
  },
  {
    title: 'Frontend / Product Engineer',
    company: 'Developer Platform',
    skills: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'State Management'],
    text: `We are looking for a Product Engineer with a sharp eye for design and performance.
Requirements:
- Master of modern React, Next.js App Router, and TypeScript.
- Strong knowledge of responsive UI design, component libraries, and client-side performance.
- Familiarity with consuming complex REST APIs and automated UI tests.`
  }
];

const DEMO_RESUME_TEXT = `Arjun Sharma
Full-Stack Developer | GitHub: github.com/arjunsharma

EDUCATION:
B.Tech in Computer Science & Engineering (2023-2027)

TECHNICAL SKILLS:
- Languages: JavaScript, TypeScript, Python, SQL
- Frontend: React, Next.js, Tailwind CSS
- Backend: Node.js, Express, REST APIs
- Databases: MongoDB, PostgreSQL, Redis
- Cloud & DevOps: Docker, Firebase, Git

PROJECTS:
1. WashEase - Laundry Management System
   - Full-stack laundry management platform with real-time tracking
   - User authentication and role-based access control with Express and MongoDB

2. TaskFlow - Project Management Kanban
   - Kanban-style task management with drag and drop
   - Collaborative features with Firebase real-time database`;

export default function AnalyzePage() {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'upload' | 'paste'>('paste');
  const [resumeText, setResumeText] = useState(DEMO_RESUME_TEXT);
  const [uploadedResumeId, setUploadedResumeId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [githubUsername, setGithubUsername] = useState('arjunsharma');
  const [selectedJdIndex, setSelectedJdIndex] = useState<number | null>(0);
  const [customJd, setCustomJd] = useState('');
  const [targetRole, setTargetRole] = useState('Full-Stack Software Engineer');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const steps = [
    'Parsing resume claims and technical skills...',
    'Fetching GitHub commit graph, repositories, and ASTs...',
    'Cross-verifying claims against author commits and tests...',
    'Generating 4-tier evidence breakdown and readiness index...',
    'Synthesizing personalized interview defense & gap roadmap...'
  ];

  const handleFileUpload = async (file: File) => {
    setError(null);
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF documents are supported for resume upload. Please select a PDF file or use the Text paste tab.');
      return;
    }

    try {
      if (!api.getToken()) {
        await api.loginDemo();
      }
      const res = await api.uploadResume(file);
      setUploadedResumeId(res.resumeId);
      setUploadedFileName(file.name);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setError(msg);
    }
  };

  const handleStartAnalysis = async (forceDemo: boolean = false) => {
    setError(null);

    // Validate inputs for real mode
    if (!forceDemo) {
      if (activeTab === 'paste' && (!resumeText || resumeText.trim().length < 50)) {
        setError('Please provide at least 50 characters of resume text to analyze.');
        return;
      }
      if (activeTab === 'upload' && !uploadedResumeId) {
        setError('Please upload a PDF resume or switch to the Text tab to paste your resume content.');
        return;
      }
      if (!targetRole.trim()) {
        setError('Please specify a target role.');
        return;
      }
    }

    setAnalyzing(true);
    setAnalysisStep(0);

    const stepInterval = setInterval(() => {
      setAnalysisStep((prev) => {
        if (prev < steps.length - 1) return prev + 1;
        return prev;
      });
    }, 800);

    try {
      // 1. Ensure user has a valid authentication session
      if (!api.getToken()) {
        await api.loginDemo();
      }

      // 2. Prepare payload
      const effectiveJdText = selectedJdIndex !== null ? PRESET_JDS[selectedJdIndex].text : customJd;
      
      const payload = {
        resumeId: activeTab === 'upload' ? uploadedResumeId || undefined : undefined,
        resumeText: activeTab === 'paste' ? resumeText.trim() : undefined,
        githubUsername: githubUsername.trim() || undefined,
        targetRole: targetRole.trim(),
        jobDescriptionText: effectiveJdText.trim() || undefined,
        isDemo: forceDemo,
      };

      // 3. Trigger backend analysis
      await api.startAnalysis(payload);

      clearInterval(stepInterval);
      setAnalysisStep(steps.length - 1);

      setTimeout(() => {
        router.push('/dashboard');
      }, 400);
    } catch (err: unknown) {
      clearInterval(stepInterval);
      setAnalyzing(false);
      const msg = err instanceof Error ? err.message : 'Analysis failed. Please verify your inputs and try again.';
      setError(msg);
    }
  };

  const handleUseDemo = () => {
    setResumeText(DEMO_RESUME_TEXT);
    setGithubUsername('arjunsharma');
    setSelectedJdIndex(0);
    setTargetRole(PRESET_JDS[0].title);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-[#e8e8ed] flex flex-col">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 py-10 w-full flex-1">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-8 border-b border-[#2a2a3a]">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Evidence Extraction Studio</span>
            </div>
            <h1 className="text-3xl font-extrabold text-white">
              Launch Placement Readiness Audit
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Provide your real resume, GitHub handle, and target job description to run an evidence-based gap audit.
            </p>
          </div>

          <button
            onClick={handleUseDemo}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#16161f] border border-[#2a2a3a] text-xs font-medium text-zinc-300 hover:border-indigo-500/50 hover:text-white transition-all self-start md:self-auto cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Load Sample Profile
          </button>
        </div>

        {error && (
          <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3 text-amber-300 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal / Overlay when analyzing */}
        {analyzing && (
          <div className="fixed inset-0 z-50 bg-[#0a0a0f]/90 backdrop-blur-md flex items-center justify-center p-6">
            <div className="card max-w-lg w-full text-center space-y-6 border-indigo-500/30 shadow-2xl shadow-indigo-500/10">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 flex items-center justify-center mx-auto text-indigo-400">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white">
                  Auditing Technical Evidence
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Cross-referencing resume bullets with GitHub AST, commit trees, and target JD
                </p>
              </div>

              {/* Step indicator */}
              <div className="space-y-3 text-left bg-[#12121a] p-4 rounded-xl border border-[#2a2a3a]">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-xs">
                    {idx < analysisStep ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : idx === analysisStep ? (
                      <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-zinc-700 shrink-0" />
                    )}
                    <span
                      className={
                        idx === analysisStep
                          ? 'text-white font-semibold'
                          : idx < analysisStep
                          ? 'text-zinc-400 line-through'
                          : 'text-zinc-600'
                      }
                    >
                      {step}
                    </span>
                  </div>
                ))}
              </div>

              <div className="w-full bg-[#16161f] h-2 rounded-full overflow-hidden border border-[#2a2a3a]">
                <div
                  className="bg-indigo-500 h-full transition-all duration-500"
                  style={{ width: `${((analysisStep + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Form Inputs Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          {/* Step 1: Resume */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#2a2a3a]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-bold">
                  1
                </div>
                <h3 className="text-sm font-bold text-white">Resume Input</h3>
              </div>
              <div className="flex bg-[#12121a] p-0.5 rounded-lg border border-[#2a2a3a] text-[11px]">
                <button
                  type="button"
                  onClick={() => setActiveTab('paste')}
                  className={`px-2.5 py-1 rounded cursor-pointer ${
                    activeTab === 'paste' ? 'bg-indigo-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('upload')}
                  className={`px-2.5 py-1 rounded cursor-pointer ${
                    activeTab === 'upload' ? 'bg-indigo-600 text-white' : 'text-zinc-400'
                  }`}
                >
                  Upload PDF
                </button>
              </div>
            </div>

            {activeTab === 'paste' ? (
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Resume Content & Skills:
                </label>
                <textarea
                  value={resumeText}
                  onChange={(e) => setResumeText(e.target.value)}
                  rows={14}
                  className="input font-mono text-xs leading-relaxed resize-none w-full"
                  placeholder="Paste resume text with skills, projects, and work experience..."
                />
              </div>
            ) : (
              <div className="border-2 border-dashed border-[#2a2a3a] hover:border-indigo-500/50 rounded-xl p-8 text-center transition-colors cursor-pointer bg-[#12121a]">
                <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                <p className="text-xs font-medium text-white">
                  {uploadedFileName ? `Selected: ${uploadedFileName}` : 'Click to upload PDF resume'}
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">PDF documents only (up to 10MB)</p>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  id="resume-file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleFileUpload(file);
                    }
                  }}
                />
                <label
                  htmlFor="resume-file"
                  className="btn-secondary text-xs mt-4 inline-block cursor-pointer"
                >
                  Choose PDF
                </label>
              </div>
            )}
          </div>

          {/* Step 2: GitHub Profile */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#2a2a3a]">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-bold">
                2
              </div>
              <h3 className="text-sm font-bold text-white">GitHub Audit Target</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  GitHub Username / Handle:
                </label>
                <div className="relative">
                  <GitBranch className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={githubUsername}
                    onChange={(e) => setGithubUsername(e.target.value)}
                    className="input pl-9 text-xs"
                    placeholder="e.g. torvalds"
                  />
                </div>
              </div>

              <div className="p-3 bg-[#12121a] rounded-xl border border-[#2a2a3a] space-y-2">
                <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Code className="w-3.5 h-3.5 text-indigo-400" />
                  Evidence Inspection Scope
                </div>
                <div className="text-[11px] text-zinc-400 space-y-1">
                  <p>Our AST engine will cross-reference:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-zinc-400 text-[10px]">
                    <li>Commit authorship and branch history</li>
                    <li>Dependencies declared vs imported in code</li>
                    <li>Configuration files (Docker, CI/CD, K8s)</li>
                    <li>Test suites (Jest, PyTest, Mocha, Cypress)</li>
                  </ul>
                </div>
              </div>

              <div className="text-[11px] text-zinc-500 leading-relaxed bg-[#12121a]/50 p-2.5 rounded-lg border border-[#2a2a3a]/50">
                💡 <strong>Graceful Verification:</strong> If a GitHub profile is unavailable or rate-limited, GapCheck continues audit verification with available profile signals.
              </div>
            </div>
          </div>

          {/* Step 3: Job Description */}
          <div className="card space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-[#2a2a3a]">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-bold">
                3
              </div>
              <h3 className="text-sm font-bold text-white">Target Role & JD</h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Target Job Position:
                </label>
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="input text-xs"
                  placeholder="e.g. Full-Stack Software Engineer"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">
                  Job Description Presets or Custom JD:
                </label>
                <div className="space-y-2">
                  {PRESET_JDS.map((jd, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedJdIndex(idx);
                        setTargetRole(jd.title);
                      }}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        selectedJdIndex === idx
                          ? 'border-indigo-500 bg-indigo-500/10 text-white'
                          : 'border-[#2a2a3a] bg-[#12121a] text-zinc-400 hover:border-zinc-600'
                      }`}
                    >
                      <div className="font-semibold text-white flex items-center justify-between">
                        <span>{jd.title}</span>
                        <span className="text-[10px] text-zinc-500">{jd.company}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {jd.skills.slice(0, 4).map((sk, sIdx) => (
                          <span
                            key={sIdx}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-black/40 text-zinc-400"
                          >
                            {sk}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div
                    onClick={() => setSelectedJdIndex(null)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      selectedJdIndex === null
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : 'border-[#2a2a3a] bg-[#12121a] text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    <div className="font-semibold text-white">Custom Job Description</div>
                    {selectedJdIndex === null && (
                      <textarea
                        value={customJd}
                        onChange={(e) => setCustomJd(e.target.value)}
                        rows={3}
                        placeholder="Paste target job description requirements here..."
                        className="input mt-2 text-xs font-mono"
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Action Bar */}
        <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-[#16161f] to-violet-950/40 border border-indigo-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              Execute Real GapCheck Verification
            </h4>
            <p className="text-xs text-zinc-400 mt-0.5">
              Audits claims, detects fragile skills, identifies missing requirements, and prepares your interview defense.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleStartAnalysis(true)}
              disabled={analyzing}
              className="btn-secondary text-xs font-semibold cursor-pointer"
            >
              Test with Demo Data
            </button>
            <button
              onClick={() => handleStartAnalysis(false)}
              disabled={analyzing}
              className="btn-primary text-sm font-semibold flex items-center gap-2 shrink-0 cursor-pointer shadow-lg shadow-indigo-600/30"
            >
              <span>Run GapCheck Verification</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
