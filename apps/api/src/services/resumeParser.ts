import * as pdfParseModule from 'pdf-parse';
import fs from 'fs';

export interface ParsedResume {
  personal: {
    name?: string;
    email?: string;
    phone?: string;
    links: string[];
  };
  education: Array<{
    institution?: string;
    degree?: string;
    graduationYear?: string;
    gpa?: string;
  }>;
  skills: {
    languages: string[];
    frameworks: string[];
    databases: string[];
    cloud: string[];
    tools: string[];
    other: string[];
  };
  projects: Array<{
    name: string;
    technologies: string[];
    description: string;
    claims: string[];
    metrics: string[];
    links: string[];
  }>;
  experience: Array<{
    company?: string;
    role?: string;
    duration?: string;
    technologies: string[];
    claims: string[];
    description: string;
  }>;
  achievements: string[];
  certifications: string[];
}

export interface ResumeClaim {
  claim: string;
  claimType: 'skill' | 'experience' | 'achievement' | 'project' | 'technical_depth' | 'impact';
  category: string;
  proficiencyLevel?: string;
  source: string;
  context?: string;
}

const KNOWN_SKILLS: Record<string, string[]> = {
  languages: ['javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'dart', 'scala', 'r', 'c', 'sql', 'html', 'css', 'sass', 'less'],
  frameworks: ['react', 'next.js', 'nextjs', 'angular', 'vue', 'vue.js', 'svelte', 'express', 'express.js', 'node.js', 'nodejs', 'django', 'flask', 'fastapi', 'spring', 'spring boot', 'rails', 'ruby on rails', 'laravel', '.net', 'flutter', 'react native', 'electron', 'gatsby', 'nuxt', 'remix', 'nest.js', 'nestjs', 'tailwind', 'tailwindcss', 'bootstrap', 'material ui', 'chakra ui'],
  databases: ['mongodb', 'postgresql', 'postgres', 'mysql', 'sqlite', 'redis', 'elasticsearch', 'dynamodb', 'cassandra', 'firebase', 'firestore', 'supabase', 'prisma', 'mongoose', 'sequelize', 'drizzle'],
  cloud: ['aws', 'amazon web services', 'gcp', 'google cloud', 'azure', 'heroku', 'vercel', 'netlify', 'railway', 'render', 'digitalocean', 'cloudflare'],
  tools: ['docker', 'kubernetes', 'k8s', 'git', 'github', 'gitlab', 'jenkins', 'ci/cd', 'github actions', 'terraform', 'ansible', 'nginx', 'apache', 'linux', 'webpack', 'vite', 'babel', 'jest', 'mocha', 'cypress', 'selenium', 'postman', 'figma', 'jira', 'graphql', 'rest api', 'websocket', 'socket.io', 'kafka', 'rabbitmq', 'grpc'],
};

const PROFICIENCY_MARKERS: Record<string, string[]> = {
  advanced: ['advanced', 'expert', 'proficient', 'strong', 'extensive', 'deep', 'mastery', 'fluent'],
  intermediate: ['intermediate', 'moderate', 'familiar', 'working knowledge', 'comfortable'],
  beginner: ['beginner', 'basic', 'learning', 'exposure', 'introductory', 'novice'],
};

export async function parseResumePDF(filePath: string): Promise<{ text: string; parsed: ParsedResume }> {
  const dataBuffer = fs.readFileSync(filePath);
  let text = '';

  const anyPdf: any = pdfParseModule;
  if (anyPdf.PDFParse) {
    const parser = new anyPdf.PDFParse({ data: dataBuffer });
    try {
      const result = await parser.getText();
      text = result.text || '';
    } finally {
      if (typeof parser.destroy === 'function') {
        await parser.destroy();
      }
    }
  } else if (typeof anyPdf === 'function') {
    const pdfData = await anyPdf(dataBuffer);
    text = pdfData.text || '';
  } else if (anyPdf.default && typeof anyPdf.default === 'function') {
    const pdfData = await anyPdf.default(dataBuffer);
    text = pdfData.text || '';
  } else if (anyPdf.default?.PDFParse) {
    const parser = new anyPdf.default.PDFParse({ data: dataBuffer });
    try {
      const result = await parser.getText();
      text = result.text || '';
    } finally {
      if (typeof parser.destroy === 'function') {
        await parser.destroy();
      }
    }
  } else {
    throw new Error('Unsupported PDF parsing module interface');
  }

  if (!text || text.trim().length === 0) {
    throw new Error('No readable text found in PDF. Please ensure the document is not an image-only scan.');
  }

  const parsed = extractResumeData(text);
  return { text, parsed };
}

export function parseResumeText(text: string): { text: string; parsed: ParsedResume } {
  const parsed = extractResumeData(text);
  return { text, parsed };
}

function extractResumeData(text: string): ParsedResume {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  return {
    personal: extractPersonal(text, lines),
    education: extractEducation(text, lines),
    skills: extractSkills(text),
    projects: extractProjects(text, lines),
    experience: extractExperience(text, lines),
    achievements: extractAchievements(text, lines),
    certifications: extractCertifications(text, lines),
  };
}

function extractPersonal(text: string, lines: string[]): ParsedResume['personal'] {
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const phoneMatch = text.match(/[\+]?[0-9]{10,13}/);
  const linkMatches = text.match(/https?:\/\/[^\s,)]+/g) || [];

  // Name is typically the first substantial line
  let name: string | undefined;
  for (const line of lines) {
    if (line.length > 2 && line.length < 50 && !line.includes('@') && !line.includes('http')) {
      name = line;
      break;
    }
  }

  return {
    name,
    email: emailMatch?.[0],
    phone: phoneMatch?.[0],
    links: linkMatches,
  };
}

function extractEducation(text: string, _lines: string[]): ParsedResume['education'] {
  const education: ParsedResume['education'] = [];
  const eduPatterns = [
    /(?:B\.?Tech|B\.?E\.?|Bachelor|M\.?Tech|M\.?S\.?|Master|Ph\.?D\.?|B\.?Sc|M\.?Sc|BCA|MCA)[\s\S]{0,200}/gi,
  ];

  for (const pattern of eduPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const yearMatch = match.match(/20\d{2}/);
        const gpaMatch = match.match(/(?:GPA|CGPA|percentage)[:\s]*(\d+\.?\d*)/i);
        education.push({
          institution: extractInstitution(match),
          degree: match.substring(0, 60).trim(),
          graduationYear: yearMatch?.[0],
          gpa: gpaMatch?.[1],
        });
      }
    }
  }

  return education;
}

function extractInstitution(text: string): string | undefined {
  const instPatterns = [
    /(?:university|institute|college|school|iit|nit|iiit|bits|vit|srm|manipal)[\s\w]*/i,
  ];
  for (const p of instPatterns) {
    const match = text.match(p);
    if (match) return match[0].trim();
  }
  return undefined;
}

function extractSkills(text: string): ParsedResume['skills'] {
  const lowerText = text.toLowerCase();
  const skills: ParsedResume['skills'] = {
    languages: [],
    frameworks: [],
    databases: [],
    cloud: [],
    tools: [],
    other: [],
  };

  for (const [category, skillList] of Object.entries(KNOWN_SKILLS)) {
    for (const skill of skillList) {
      const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lowerText)) {
        (skills as any)[category].push(skill);
      }
    }
  }

  return skills;
}

function extractProjects(text: string, lines: string[]): ParsedResume['projects'] {
  const projects: ParsedResume['projects'] = [];
  const projectSectionMatch = text.match(/(?:projects?|personal projects?|technical projects?)[\s:]*\n([\s\S]*?)(?=\n(?:experience|education|skills|certifications?|achievements?|awards?|$))/i);

  if (projectSectionMatch) {
    const projectText = projectSectionMatch[1];
    const projectBlocks = projectText.split(/\n(?=[A-Z])/);

    for (const block of projectBlocks) {
      if (block.trim().length < 10) continue;
      const blockLines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const name = blockLines[0]?.substring(0, 80) || 'Unnamed Project';
      const description = blockLines.slice(1).join(' ');
      const technologies = findTechnologiesInText(block);
      const links = block.match(/https?:\/\/[^\s,)]+/g) || [];
      const claims = extractProjectClaims(block);
      const metrics = extractMetrics(block);

      projects.push({ name, technologies, description, claims, metrics, links });
    }
  }

  // Fallback: look for project-like patterns
  if (projects.length === 0) {
    const projectPatterns = /(?:built|developed|created|implemented|designed)\s+(?:a\s+)?([^.]{10,80})/gi;
    let match;
    while ((match = projectPatterns.exec(text)) !== null) {
      projects.push({
        name: match[1].trim(),
        technologies: findTechnologiesInText(match[0]),
        description: match[0],
        claims: [],
        metrics: [],
        links: [],
      });
    }
  }

  return projects;
}

function extractExperience(text: string, _lines: string[]): ParsedResume['experience'] {
  const experience: ParsedResume['experience'] = [];
  const expSectionMatch = text.match(/(?:experience|work experience|internships?)[\s:]*\n([\s\S]*?)(?=\n(?:projects?|education|skills|certifications?|achievements?|$))/i);

  if (expSectionMatch) {
    const expText = expSectionMatch[1];
    const blocks = expText.split(/\n(?=[A-Z])/);

    for (const block of blocks) {
      if (block.trim().length < 10) continue;
      const technologies = findTechnologiesInText(block);
      const claims = extractProjectClaims(block);
      const durationMatch = block.match(/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s\S]{0,30}(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|present|current)/i);

      experience.push({
        company: undefined,
        role: block.split('\n')[0]?.substring(0, 80).trim(),
        duration: durationMatch?.[0]?.trim(),
        technologies,
        claims,
        description: block,
      });
    }
  }

  return experience;
}

function extractAchievements(text: string, _lines: string[]): string[] {
  const achievements: string[] = [];
  const achieveMatch = text.match(/(?:achievements?|awards?|honors?)[\s:]*\n([\s\S]*?)(?=\n(?:projects?|experience|education|skills|$))/i);
  if (achieveMatch) {
    const items = achieveMatch[1].split('\n').map(l => l.trim()).filter(l => l.length > 5);
    achievements.push(...items.slice(0, 10));
  }
  return achievements;
}

function extractCertifications(text: string, _lines: string[]): string[] {
  const certs: string[] = [];
  const certMatch = text.match(/(?:certifications?|courses?)[\s:]*\n([\s\S]*?)(?=\n(?:projects?|experience|education|skills|achievements?|$))/i);
  if (certMatch) {
    const items = certMatch[1].split('\n').map(l => l.trim()).filter(l => l.length > 5);
    certs.push(...items.slice(0, 10));
  }
  return certs;
}

function findTechnologiesInText(text: string): string[] {
  const found: string[] = [];
  const lowerText = text.toLowerCase();
  for (const skillList of Object.values(KNOWN_SKILLS)) {
    for (const skill of skillList) {
      const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lowerText) && !found.includes(skill)) {
        found.push(skill);
      }
    }
  }
  return found;
}

function extractProjectClaims(text: string): string[] {
  const claims: string[] = [];
  const claimPatterns = [
    /(?:built|developed|created|implemented|designed|deployed|integrated|optimized|automated|architected|led|managed)\s+[^.]{5,80}/gi,
  ];
  for (const pattern of claimPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      claims.push(match[0].trim());
    }
  }
  return claims.slice(0, 10);
}

function extractMetrics(text: string): string[] {
  const metrics: string[] = [];
  const metricPatterns = [
    /\d+[%+x]\s+[^.]{5,60}/g,
    /(?:reduced|increased|improved|achieved|served|handled)\s+[^.]*\d+[^.]{0,40}/gi,
  ];
  for (const pattern of metricPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      metrics.push(match[0].trim());
    }
  }
  return metrics;
}

export function extractClaims(parsed: ParsedResume): ResumeClaim[] {
  const claims: ResumeClaim[] = [];

  // Skill claims
  for (const [category, skills] of Object.entries(parsed.skills)) {
    for (const skill of skills) {
      claims.push({
        claim: skill,
        claimType: 'skill',
        category,
        source: 'resume.skills',
        proficiencyLevel: inferProficiency(skill, parsed),
      });
    }
  }

  // Project claims
  for (const project of parsed.projects) {
    claims.push({
      claim: project.name,
      claimType: 'project',
      category: 'project',
      source: 'resume.projects',
      context: project.description,
    });

    for (const projectClaim of project.claims) {
      claims.push({
        claim: projectClaim,
        claimType: 'technical_depth',
        category: 'project_claim',
        source: `resume.projects.${project.name}`,
        context: project.description,
      });
    }
  }

  // Experience claims
  for (const exp of parsed.experience) {
    for (const expClaim of exp.claims) {
      claims.push({
        claim: expClaim,
        claimType: 'experience',
        category: 'experience',
        source: 'resume.experience',
        context: exp.description,
      });
    }
  }

  // Achievement claims
  for (const achievement of parsed.achievements) {
    claims.push({
      claim: achievement,
      claimType: 'achievement',
      category: 'achievement',
      source: 'resume.achievements',
    });
  }

  return claims;
}

function inferProficiency(skill: string, parsed: ParsedResume): string {
  // Check if proficiency is explicitly mentioned in resume text
  // This is a simplified inference
  return 'claimed';
}
