import PDFDocument from 'pdfkit';
import { Response } from 'express';

interface ReportData {
  candidateName: string;
  candidateEmail?: string;
  targetRole: string;
  analysisDate: string;
  overallScore: number;
  dimensions: {
    resumeQuality: number;
    engineeringEvidence: number;
    roleAlignment: number;
    claimConsistency: number;
    projectDepth?: number;
    technicalEvidence?: number;
  };
  summary: string;
  findings: Array<{
    skill: string;
    resumeClaim?: string | null;
    evidenceStatus: string;
    priority?: string;
    assessment?: string;
    evidenceSources?: Array<{ source: string; repository?: string; file?: string; evidence: string }>;
  }>;
  jobRequirements?: {
    required: string[];
    preferred: string[];
  };
  recommendations: Array<{
    title: string;
    problem: string;
    hiringImpact?: string;
    recommendation: string;
    priority: string;
    targetProject?: string;
  }>;
  actionPlan: Array<{
    day: string;
    title: string;
    description: string;
    priority?: string;
    completed?: boolean;
  }>;
  rawResumeText?: string;
  recruiterAudit?: {
    summary?: {
      totalPublicRepos: number;
      strongProjectsCount: number;
      supportingCount: number;
      practiceCount: number;
      outdatedCount: number;
      needsReviewCount: number;
    };
    repositories?: Array<{
      name: string;
      classification: string;
      presentationPriority?: string;
      roleRelevance?: string;
      confidence?: string;
      signals: string[];
      recruiterNotes: string;
      commitCount: number;
    }>;
    concerns?: Array<{
      id?: string;
      canonicalId?: string;
      title: string;
      observation: string;
      signal?: string;
      reasoning?: string;
      evidence?: string;
      risk: string;
      recommendation: string;
      severity: string;
      confidence?: string;
    }>;
    strengths?: Array<{
      title: string;
      detail: string;
      evidence: string;
      confidence?: string;
    }>;
    preparedQuestions?: Array<{
      question: string;
      context: string;
      reason: string;
      suggestedFocus: string;
    }>;
    consistency?: {
      resumeProjectsFound: Array<{ resumeProject: string; repoName: string; matchStrength: string; matchConfidence?: string; matchReasons?: string[] }>;
      resumeProjectsMissing: Array<{ resumeProject: string; note: string; possibleReasons?: string[] }>;
      githubProjectsNotOnResume: Array<{ repoName: string; classification: string; assessment: string }>;
    };
    readiness?: {
      score: number;
      breakdown?: string[];
      positiveFactors?: string[];
      deductionFactors?: string[];
    };
  };
}

const COLORS = {
  black: '#0c0c0e',
  darkGray: '#1f1f23',
  midGray: '#52525b',
  lightGray: '#a1a1aa',
  borderGray: '#e4e4e7',
  bgSoft: '#f4f4f5',
  white: '#ffffff',
  verified: '#15803d',
  supported: '#0369a1',
  partial: '#b45309',
  unverified: '#b91c1c',
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#65a30d',
};

export function streamAuditReportPdf(data: ReportData, res: Response) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 48, left: 48, right: 48 },
    info: {
      Title: `GapCheck Audit Report - ${data.candidateName}`,
      Author: 'GapCheck Technical Profile Audit',
      Subject: 'Placement Readiness & Evidence Audit',
    },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="GapCheck_Audit_Report_${data.candidateName.replace(/\s+/g, '_')}.pdf"`
  );

  doc.pipe(res);

  const drawHeader = (title: string, subtitle?: string) => {
    doc.fillColor(COLORS.black).fontSize(16).font('Helvetica-Bold').text(title, { characterSpacing: -0.3 });
    if (subtitle) {
      doc.fillColor(COLORS.midGray).fontSize(9).font('Helvetica').text(subtitle, { characterSpacing: 0 });
    }
    doc.moveDown(0.6);
    doc.strokeColor(COLORS.borderGray).lineWidth(0.75).moveTo(48, doc.y).lineTo(547, doc.y).stroke();
    doc.moveDown(0.8);
  };

  const drawFooter = (pageNum: number) => {
    doc.fontSize(8).fillColor(COLORS.lightGray).font('Helvetica');
    doc.text(
      'GapCheck Technical Profile Audit • Based on observable evidence • Not a guarantee of employment',
      48,
      790,
      { align: 'left', width: 400 }
    );
    doc.text(`Page ${pageNum}`, 480, 790, { align: 'right', width: 67 });
  };

  let page = 1;

  // ================= PAGE 1: COVER & EXECUTIVE SUMMARY =================
  doc.rect(48, 48, 499, 110).fillAndStroke(COLORS.bgSoft, COLORS.borderGray);

  doc.fillColor(COLORS.black).fontSize(22).font('Helvetica-Bold').text('GAPCHECK', 64, 62, { characterSpacing: 1.5 });
  doc.fillColor(COLORS.midGray).fontSize(10).font('Helvetica').text('TECHNICAL PROFILE & EVIDENCE AUDIT', 64, 88);

  doc.fillColor(COLORS.black).fontSize(11).font('Helvetica-Bold').text(`Candidate: ${data.candidateName}`, 64, 112);
  doc.fillColor(COLORS.midGray).fontSize(9).font('Helvetica').text(`Target Role: ${data.targetRole}  •  Audited: ${data.analysisDate}`, 64, 128);

  // Score Badge
  const scoreBoxX = 420;
  doc.rect(scoreBoxX, 60, 112, 85).fillAndStroke(COLORS.white, COLORS.borderGray);
  doc.fillColor(COLORS.midGray).fontSize(8).font('Helvetica-Bold').text('READINESS SCORE', scoreBoxX, 70, { align: 'center', width: 112 });
  doc.fillColor(COLORS.black).fontSize(30).font('Helvetica-Bold').text(`${Math.round(data.overallScore)}`, scoreBoxX, 84, { align: 'center', width: 112 });
  doc.fillColor(COLORS.midGray).fontSize(8).font('Helvetica').text('out of 100', scoreBoxX, 122, { align: 'center', width: 112 });

  doc.y = 180;
  drawHeader('Executive Summary', 'Deterministic correlation of resume claims against code proof');

  doc.fillColor(COLORS.darkGray).fontSize(10).font('Helvetica').text(data.summary || 'Profile audited across code repositories and job requirements.', {
    lineGap: 4,
    align: 'justify',
  });

  doc.moveDown(1.2);

  // Stat summary pills
  const verifiedCount = data.findings.filter(f => f.evidenceStatus === 'verified' || f.evidenceStatus === 'supported').length;
  const partialCount = data.findings.filter(f => f.evidenceStatus === 'partial' || f.evidenceStatus === 'weakly_supported').length;
  const unverifiedCount = data.findings.filter(f => f.evidenceStatus === 'unverified').length;
  const criticalGaps = data.recommendations.filter(r => r.priority === 'critical' || r.priority === 'high').length;

  const statBoxes = [
    { label: 'Verified Claims', value: `${verifiedCount}`, color: COLORS.verified },
    { label: 'Partial Claims', value: `${partialCount}`, color: COLORS.partial },
    { label: 'Unverified Claims', value: `${unverifiedCount}`, color: COLORS.unverified },
    { label: 'High Priority Gaps', value: `${criticalGaps}`, color: COLORS.critical },
  ];

  const colWidth = (499 - 30) / 4;
  statBoxes.forEach((s, idx) => {
    const boxX = 48 + idx * (colWidth + 10);
    const boxY = doc.y;
    doc.rect(boxX, boxY, colWidth, 54).fillAndStroke(COLORS.bgSoft, COLORS.borderGray);
    doc.fillColor(s.color).fontSize(18).font('Helvetica-Bold').text(s.value, boxX, boxY + 8, { align: 'center', width: colWidth });
    doc.fillColor(COLORS.midGray).fontSize(8).font('Helvetica').text(s.label, boxX, boxY + 32, { align: 'center', width: colWidth });
  });

  doc.y += 75;

  // Disclaimer / Trust Model
  doc.rect(48, doc.y, 499, 60).fillAndStroke(COLORS.bgSoft, COLORS.borderGray);
  doc.fillColor(COLORS.black).fontSize(9).font('Helvetica-Bold').text('Report Trust Model & Operating Principles', 60, doc.y + 10);
  doc.fillColor(COLORS.midGray).fontSize(8).font('Helvetica').text(
    'GapCheck evaluates observable public evidence (code repositories, manifests, commit histories) against resume claims and target job requirements. It does not predict recruiter personality or guarantee interview outcomes. Gaps represent areas where verifiable evidence is missing or needs strengthening.',
    60,
    doc.y + 24,
    { width: 475, lineGap: 2 }
  );

  drawFooter(page++);

  // ================= PAGE 2: READINESS BREAKDOWN =================
  doc.addPage();
  drawHeader('Readiness Score Breakdown', 'Mathematical distribution across audit evaluation dimensions');

  const dimensions = [
    {
      name: 'Resume Quality',
      score: data.dimensions.resumeQuality || 0,
      desc: 'Clarity, density of verifiable technical claims, and absence of generic buzzwords.',
    },
    {
      name: 'Engineering Evidence',
      score: data.dimensions.engineeringEvidence || 0,
      desc: 'Verifiable production artifacts: package manifests, Dockerfiles, CI workflows, and test files.',
    },
    {
      name: 'Role Alignment',
      score: data.dimensions.roleAlignment || 0,
      desc: 'Percentage match between verified competencies and target role requirements.',
    },
    {
      name: 'Claim Consistency',
      score: data.dimensions.claimConsistency || 0,
      desc: 'Proportion of claims that have corroborating public source code evidence.',
    },
  ];

  dimensions.forEach((dim) => {
    const startY = doc.y;
    doc.rect(48, startY, 499, 58).fillAndStroke(COLORS.white, COLORS.borderGray);

    doc.fillColor(COLORS.black).fontSize(11).font('Helvetica-Bold').text(dim.name, 60, startY + 12);
    doc.fillColor(COLORS.midGray).fontSize(8.5).font('Helvetica').text(dim.desc, 60, startY + 28, { width: 350 });

    // Score pill
    doc.rect(460, startY + 14, 72, 28).fillAndStroke(COLORS.bgSoft, COLORS.borderGray);
    doc.fillColor(COLORS.black).fontSize(14).font('Helvetica-Bold').text(`${Math.round(dim.score)}%`, 460, startY + 20, { align: 'center', width: 72 });

    doc.y = startY + 68;
  });

  drawFooter(page++);

  // ================= PAGE 2B: RECRUITER PERSPECTIVE AUDIT =================
  if (data.recruiterAudit) {
    doc.addPage();
    drawHeader('Recruiter Perspective: What a Recruiter Sees', 'Strengths, potential concerns, and prepared technical inquiries');

    // Strengths
    doc.fillColor(COLORS.verified).fontSize(10).font('Helvetica-Bold').text('STRENGTHS & HIGHLIGHTS', 48, doc.y);
    doc.y += 14;
    const strengths = data.recruiterAudit.strengths || [];
    if (strengths.length > 0) {
      strengths.slice(0, 3).forEach((s) => {
        const sY = doc.y;
        doc.rect(48, sY, 499, 36).fillAndStroke(COLORS.bgSoft, COLORS.borderGray);
        doc.fillColor(COLORS.verified).fontSize(8.5).font('Helvetica-Bold').text(`✓ ${s.title}`, 56, sY + 8);
        doc.fillColor(COLORS.darkGray).fontSize(8).font('Helvetica').text(`${s.detail} (${s.evidence})`, 56, sY + 20, { width: 475 });
        doc.y = sY + 42;
      });
    }

    doc.y += 10;

    // Potential Concerns
    doc.fillColor(COLORS.partial).fontSize(10).font('Helvetica-Bold').text('POTENTIAL RECRUITER CONCERNS (TRACEABLE FINDINGS)', 48, doc.y);
    doc.y += 14;
    const concerns = data.recruiterAudit.concerns || [];
    if (concerns.length > 0) {
      concerns.slice(0, 3).forEach((c) => {
        const cY = doc.y;
        doc.rect(48, cY, 499, 56).fillAndStroke(COLORS.white, COLORS.borderGray);
        const confBadge = c.confidence ? ` [${c.confidence} CONFIDENCE]` : '';
        doc.fillColor(COLORS.critical).fontSize(8.5).font('Helvetica-Bold').text(`! ${c.title}${confBadge}`, 56, cY + 8);
        doc.fillColor(COLORS.darkGray).fontSize(8).font('Helvetica').text(`Observation: ${c.observation}`, 56, cY + 20, { width: 475 });
        if (c.evidence) {
          doc.fillColor(COLORS.midGray).fontSize(7.5).font('Helvetica').text(`Evidence: ${c.evidence}`, 56, cY + 32, { width: 475 });
        }
        doc.fillColor(COLORS.verified).fontSize(7.5).font('Helvetica').text(`Action: ${c.recommendation}`, 56, cY + 44, { width: 475 });
        doc.y = cY + 62;
      });
    }

    doc.y += 10;

    // Prepared Questions
    doc.fillColor(COLORS.black).fontSize(10).font('Helvetica-Bold').text('QUESTIONS YOU SHOULD BE PREPARED TO ANSWER', 48, doc.y);
    doc.y += 14;
    const questions = data.recruiterAudit.preparedQuestions || [];
    if (questions.length > 0) {
      questions.slice(0, 3).forEach((q, idx) => {
        const qY = doc.y;
        doc.rect(48, qY, 499, 44).fillAndStroke(COLORS.bgSoft, COLORS.borderGray);
        doc.fillColor(COLORS.black).fontSize(8.5).font('Helvetica-Bold').text(`${idx + 1}. ${q.question}`, 56, qY + 8, { width: 475 });
        doc.fillColor(COLORS.midGray).fontSize(7.5).font('Helvetica').text(`Why asked: ${q.reason} | Focus: ${q.suggestedFocus}`, 56, qY + 24, { width: 475 });
        doc.y = qY + 50;
      });
    }

    drawFooter(page++);

    // ================= PAGE 2C: REPOSITORY CLASSIFICATION =================
    doc.addPage();
    drawHeader('Complete GitHub Profile Audit & Classifications', 'Public repository classification based on observable engineering signals');

    const repos = data.recruiterAudit.repositories || [];
    const tableTop = doc.y;
    doc.rect(48, tableTop, 499, 18).fill(COLORS.darkGray);
    doc.fillColor(COLORS.white).fontSize(8).font('Helvetica-Bold');
    doc.text('REPOSITORY', 54, tableTop + 5, { width: 140 });
    doc.text('CLASSIFICATION', 200, tableTop + 5, { width: 120 });
    doc.text('COMMITS', 325, tableTop + 5, { width: 50 });
    doc.text('SIGNALS & RECRUITER ASSESSMENT', 380, tableTop + 5, { width: 160 });
    doc.y = tableTop + 22;

    repos.slice(0, 12).forEach((r) => {
      if (doc.y > 720) {
        drawFooter(page++);
        doc.addPage();
        drawHeader('GitHub Profile Audit (Continued)');
      }
      const rY = doc.y;
      doc.rect(48, rY, 499, 36).fillAndStroke(COLORS.white, COLORS.borderGray);
      doc.fillColor(COLORS.black).fontSize(8.5).font('Helvetica-Bold').text(r.name, 54, rY + 8, { width: 140 });
      const classText = r.confidence ? `${r.classification}\n[${r.confidence} CONF]` : r.classification;
      doc.fillColor(COLORS.midGray).fontSize(7).font('Helvetica-Bold').text(classText, 200, rY + 8, { width: 120 });
      doc.fillColor(COLORS.darkGray).fontSize(8).font('Helvetica').text(`${r.commitCount}`, 325, rY + 8, { width: 50 });
      doc.fillColor(COLORS.midGray).fontSize(7).font('Helvetica').text(r.signals.slice(0, 2).join('; ') || r.recruiterNotes, 380, rY + 8, { width: 160 });
      doc.y = rY + 40;
    });

    drawFooter(page++);
  }

  // ================= PAGE 3: CLAIMS & EVIDENCE MATRIX =================
  doc.addPage();
  drawHeader('Claims & Evidence Matrix', 'Systematic evaluation: Claim → Code Evidence → Strength → Reasoning');

  // Table header
  const tableTop = doc.y;
  doc.rect(48, tableTop, 499, 20).fill(COLORS.darkGray);
  doc.fillColor(COLORS.white).fontSize(8.5).font('Helvetica-Bold');
  doc.text('CLAIM / SKILL', 54, tableTop + 5, { width: 110 });
  doc.text('EVIDENCE FOUND', 170, tableTop + 5, { width: 170 });
  doc.text('STATUS', 345, tableTop + 5, { width: 70 });
  doc.text('ASSESSMENT', 420, tableTop + 5, { width: 120 });
  doc.y = tableTop + 24;

  const findingsToShow = data.findings.slice(0, 16);
  findingsToShow.forEach((f) => {
    if (doc.y > 720) {
      drawFooter(page++);
      doc.addPage();
      drawHeader('Claims & Evidence Matrix (Continued)');
    }

    const rowY = doc.y;
    const statusText = (f.evidenceStatus === 'weakly_supported' ? 'PARTIAL' : f.evidenceStatus).toUpperCase();
    const statusColor =
      statusText === 'VERIFIED'
        ? COLORS.verified
        : statusText === 'SUPPORTED'
        ? COLORS.supported
        : statusText === 'PARTIAL'
        ? COLORS.partial
        : COLORS.unverified;

    const evidenceSnippet =
      f.evidenceSources && f.evidenceSources.length > 0
        ? f.evidenceSources.map(e => `${e.repository ? `[${e.repository}] ` : ''}${e.evidence}`).join('; ')
        : 'No public repository evidence detected.';

    doc.rect(48, rowY, 499, 28).strokeColor(COLORS.borderGray).lineWidth(0.5).stroke();

    doc.fillColor(COLORS.black).fontSize(8.5).font('Helvetica-Bold').text(f.skill, 54, rowY + 6, { width: 110 });
    doc.fillColor(COLORS.midGray).fontSize(7.5).font('Helvetica').text(evidenceSnippet, 170, rowY + 6, { width: 170, height: 18, ellipsis: true });

    // Status tag
    doc.fillColor(statusColor).fontSize(8).font('Helvetica-Bold').text(statusText, 345, rowY + 8, { width: 70 });

    doc.fillColor(COLORS.darkGray).fontSize(7.5).font('Helvetica').text(f.assessment || 'Claim analyzed.', 420, rowY + 6, { width: 120, height: 18, ellipsis: true });

    doc.y = rowY + 30;
  });

  drawFooter(page++);

  // ================= PAGE 4: BIGGEST GAPS & PRESCRIPTIVE FIXES =================
  doc.addPage();
  drawHeader('High Priority Gaps & Actionable Fixes', 'Specific remediation to eliminate interview risks before recruiters review');

  const topGaps = data.recommendations.slice(0, 4);
  topGaps.forEach((gap, idx) => {
    if (doc.y > 660) {
      drawFooter(page++);
      doc.addPage();
      drawHeader('High Priority Gaps & Actionable Fixes (Continued)');
    }

    const gapY = doc.y;
    doc.rect(48, gapY, 499, 120).fillAndStroke(COLORS.bgSoft, COLORS.borderGray);

    // Number & title
    doc.fillColor(COLORS.critical).fontSize(8).font('Helvetica-Bold').text(`GAP 0${idx + 1} • ${gap.priority.toUpperCase()} PRIORITY`, 60, gapY + 10);
    doc.fillColor(COLORS.black).fontSize(11).font('Helvetica-Bold').text(gap.title, 60, gapY + 22);

    // Observation & problem
    doc.fillColor(COLORS.darkGray).fontSize(8.5).font('Helvetica').text(`Problem: ${gap.problem}`, 60, gapY + 38, { width: 475 });
    if (gap.hiringImpact) {
      doc.fillColor(COLORS.midGray).fontSize(8).font('Helvetica').text(`Impact: ${gap.hiringImpact}`, 60, gapY + 54, { width: 475 });
    }

    // Prescriptive Fix
    doc.rect(58, gapY + 70, 479, 38).fillAndStroke(COLORS.white, COLORS.borderGray);
    doc.fillColor(COLORS.black).fontSize(8).font('Helvetica-Bold').text('PRESCRIPTIVE REMEDIATION:', 66, gapY + 76);
    doc.fillColor(COLORS.darkGray).fontSize(8).font('Helvetica').text(gap.recommendation, 66, gapY + 88, { width: 460 });

    doc.y = gapY + 128;
  });

  drawFooter(page++);

  // ================= PAGE 5: 14-DAY ROADMAP =================
  doc.addPage();
  drawHeader('14-Day Remediation Roadmap', 'Step-by-step engineering plan to build evidence and update resume');

  const planItems = data.actionPlan.slice(0, 10);
  planItems.forEach((item) => {
    if (doc.y > 700) {
      drawFooter(page++);
      doc.addPage();
      drawHeader('14-Day Remediation Roadmap (Continued)');
    }

    const itemY = doc.y;
    doc.rect(48, itemY, 499, 42).fillAndStroke(COLORS.white, COLORS.borderGray);

    // Day badge
    doc.rect(56, itemY + 8, 54, 18).fillAndStroke(COLORS.bgSoft, COLORS.borderGray);
    doc.fillColor(COLORS.black).fontSize(7.5).font('Helvetica-Bold').text(item.day, 56, itemY + 13, { align: 'center', width: 54 });

    // Task & description
    doc.fillColor(COLORS.black).fontSize(9).font('Helvetica-Bold').text(item.title, 120, itemY + 8);
    doc.fillColor(COLORS.midGray).fontSize(7.5).font('Helvetica').text(item.description, 120, itemY + 22, { width: 360, height: 16, ellipsis: true });

    // Status
    doc.fillColor(item.completed ? COLORS.verified : COLORS.lightGray).fontSize(7.5).font('Helvetica-Bold');
    doc.text(item.completed ? 'COMPLETED' : 'PENDING', 475, itemY + 16, { width: 65, align: 'right' });

    doc.y = itemY + 48;
  });

  drawFooter(page);

  doc.end();
}

export function streamAnnotatedResumePdf(data: ReportData, res: Response) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 48, left: 48, right: 48 },
    info: {
      Title: `GapCheck Annotated Resume - ${data.candidateName}`,
      Author: 'GapCheck Resume Annotation Engine',
      Subject: 'Original Resume with Evidence Callout Annotations',
    },
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="GapCheck_Annotated_Resume_${data.candidateName.replace(/\s+/g, '_')}.pdf"`
  );

  doc.pipe(res);

  let page = 1;

  // Header Banner
  doc.rect(48, 48, 499, 52).fillAndStroke(COLORS.bgSoft, COLORS.borderGray);
  doc.fillColor(COLORS.black).fontSize(12).font('Helvetica-Bold').text('GAPCHECK ANNOTATED RESUME', 64, 58);
  doc.fillColor(COLORS.midGray).fontSize(8).font('Helvetica').text(
    'Analysis Copy (Candidate original preserved) • Evaluated against observable public GitHub evidence',
    64,
    76
  );

  doc.y = 114;

  // Candidate Name & Contact
  doc.fillColor(COLORS.black).fontSize(18).font('Helvetica-Bold').text(data.candidateName);
  if (data.candidateEmail) {
    doc.fillColor(COLORS.midGray).fontSize(9).font('Helvetica').text(data.candidateEmail);
  }
  doc.moveDown(0.8);
  doc.strokeColor(COLORS.borderGray).lineWidth(0.5).moveTo(48, doc.y).lineTo(547, doc.y).stroke();
  doc.moveDown(0.8);

  // Claims annotation legend
  doc.rect(48, doc.y, 499, 24).fillAndStroke(COLORS.bgSoft, COLORS.borderGray);
  doc.fillColor(COLORS.black).fontSize(7.5).font('Helvetica-Bold').text('ANNOTATION SYSTEM:', 58, doc.y + 7);
  doc.fillColor(COLORS.verified).text('[✓ VERIFIED]', 170, doc.y + 7);
  doc.fillColor(COLORS.supported).text('[✓ SUPPORTED]', 245, doc.y + 7);
  doc.fillColor(COLORS.partial).text('[△ PARTIAL]', 330, doc.y + 7);
  doc.fillColor(COLORS.unverified).text('[! UNVERIFIED]', 410, doc.y + 7);
  doc.y += 34;

  // Render raw text line by line with annotations
  const rawText = data.rawResumeText || 'Candidate Resume Text';
  const lines = rawText.split('\n');

  lines.forEach((line) => {
    if (doc.y > 730) {
      doc.fontSize(8).fillColor(COLORS.lightGray).text(`GapCheck Annotated Resume • Page ${page++}`, 48, 790);
      doc.addPage();
    }

    const trimmed = line.trim();
    if (!trimmed) {
      doc.moveDown(0.3);
      return;
    }

    // Check if line matches any findings
    const matchedFinding = data.findings.find(
      f => f.skill && trimmed.toLowerCase().includes(f.skill.toLowerCase())
    );

    if (matchedFinding) {
      const status = (matchedFinding.evidenceStatus === 'weakly_supported' ? 'PARTIAL' : matchedFinding.evidenceStatus).toUpperCase();
      const statusColor =
        status === 'VERIFIED'
          ? COLORS.verified
          : status === 'SUPPORTED'
          ? COLORS.supported
          : status === 'PARTIAL'
          ? COLORS.partial
          : COLORS.unverified;

      doc.fillColor(COLORS.darkGray).fontSize(9).font('Helvetica').text(trimmed, { continued: true });
      doc.fillColor(statusColor).font('Helvetica-Bold').fontSize(8).text(`  [${status}]`);

      // Marginal callout
      const calloutY = doc.y;
      doc.rect(58, calloutY, 489, 24).fillAndStroke(COLORS.bgSoft, COLORS.borderGray);
      doc.fillColor(statusColor).fontSize(7.5).font('Helvetica-Bold').text(`Evidence Note: `, 64, calloutY + 6, { continued: true });
      doc.fillColor(COLORS.darkGray).font('Helvetica').text(
        matchedFinding.assessment || 'Claim verified against public repository commits.',
        { width: 450, height: 14, ellipsis: true }
      );
      doc.y = calloutY + 28;
    } else {
      // Normal line
      const isHeader = trimmed.toUpperCase() === trimmed && trimmed.length < 35 && trimmed.length > 3;
      if (isHeader) {
        doc.moveDown(0.4);
        doc.fillColor(COLORS.black).fontSize(10).font('Helvetica-Bold').text(trimmed);
        doc.moveDown(0.2);
      } else {
        doc.fillColor(COLORS.darkGray).fontSize(8.5).font('Helvetica').text(trimmed);
      }
    }
  });

  doc.fontSize(8).fillColor(COLORS.lightGray).text(`GapCheck Annotated Resume • Page ${page}`, 48, 790);
  doc.end();
}
