"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseResumePDF = parseResumePDF;
exports.parseResumeText = parseResumeText;
exports.extractClaims = extractClaims;
const pdfParseModule = __importStar(require("pdf-parse"));
const fs_1 = __importDefault(require("fs"));
const KNOWN_SKILLS = {
    languages: ['javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'dart', 'scala', 'r', 'c', 'sql', 'html', 'css', 'sass', 'less'],
    frameworks: ['react', 'next.js', 'nextjs', 'angular', 'vue', 'vue.js', 'svelte', 'express', 'express.js', 'node.js', 'nodejs', 'django', 'flask', 'fastapi', 'spring', 'spring boot', 'rails', 'ruby on rails', 'laravel', '.net', 'flutter', 'react native', 'electron', 'gatsby', 'nuxt', 'remix', 'nest.js', 'nestjs', 'tailwind', 'tailwindcss', 'bootstrap', 'material ui', 'chakra ui'],
    databases: ['mongodb', 'postgresql', 'postgres', 'mysql', 'sqlite', 'redis', 'elasticsearch', 'dynamodb', 'cassandra', 'firebase', 'firestore', 'supabase', 'prisma', 'mongoose', 'sequelize', 'drizzle'],
    cloud: ['aws', 'amazon web services', 'gcp', 'google cloud', 'azure', 'heroku', 'vercel', 'netlify', 'railway', 'render', 'digitalocean', 'cloudflare'],
    tools: ['docker', 'kubernetes', 'k8s', 'git', 'github', 'gitlab', 'jenkins', 'ci/cd', 'github actions', 'terraform', 'ansible', 'nginx', 'apache', 'linux', 'webpack', 'vite', 'babel', 'jest', 'mocha', 'cypress', 'selenium', 'postman', 'figma', 'jira', 'graphql', 'rest api', 'websocket', 'socket.io', 'kafka', 'rabbitmq', 'grpc'],
};
const PROFICIENCY_MARKERS = {
    advanced: ['advanced', 'expert', 'proficient', 'strong', 'extensive', 'deep', 'mastery', 'fluent'],
    intermediate: ['intermediate', 'moderate', 'familiar', 'working knowledge', 'comfortable'],
    beginner: ['beginner', 'basic', 'learning', 'exposure', 'introductory', 'novice'],
};
async function parseResumePDF(filePath) {
    const dataBuffer = fs_1.default.readFileSync(filePath);
    // Validate PDF magic bytes (%PDF)
    if (dataBuffer.length < 4 || dataBuffer.subarray(0, 4).toString('utf-8') !== '%PDF') {
        throw new Error('Invalid file format: Uploaded document does not contain valid PDF headers.');
    }
    let text = '';
    const anyPdf = pdfParseModule;
    if (anyPdf.PDFParse) {
        const parser = new anyPdf.PDFParse({ data: dataBuffer });
        try {
            const result = await parser.getText();
            text = result.text || '';
        }
        finally {
            if (typeof parser.destroy === 'function') {
                await parser.destroy();
            }
        }
    }
    else if (typeof anyPdf === 'function') {
        const pdfData = await anyPdf(dataBuffer);
        text = pdfData.text || '';
    }
    else if (anyPdf.default && typeof anyPdf.default === 'function') {
        const pdfData = await anyPdf.default(dataBuffer);
        text = pdfData.text || '';
    }
    else if (anyPdf.default?.PDFParse) {
        const parser = new anyPdf.default.PDFParse({ data: dataBuffer });
        try {
            const result = await parser.getText();
            text = result.text || '';
        }
        finally {
            if (typeof parser.destroy === 'function') {
                await parser.destroy();
            }
        }
    }
    else {
        throw new Error('Unsupported PDF parsing module interface');
    }
    const cleanText = (text || '').trim();
    if (cleanText.length === 0) {
        throw new Error("We couldn't extract enough readable text from this resume. The document appears to be empty or a scanned image. Please upload a text-based PDF or paste your resume text.");
    }
    if (cleanText.length < 50) {
        throw new Error("We couldn't extract enough readable text from this resume (less than 50 characters found). Please ensure your PDF contains selectable text or paste your resume text directly.");
    }
    const parsed = extractResumeData(cleanText);
    return { text: cleanText, parsed };
}
function parseResumeText(text) {
    const cleanText = (text || '').trim();
    if (cleanText.length < 50) {
        throw new Error("We couldn't extract enough readable text from this resume. Please provide at least 50 characters of resume content.");
    }
    const parsed = extractResumeData(cleanText);
    return { text: cleanText, parsed };
}
function extractResumeData(text) {
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
function extractPersonal(text, lines) {
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    const phoneMatch = text.match(/[\+]?[0-9]{10,13}/);
    const linkMatches = text.match(/https?:\/\/[^\s,)]+/g) || [];
    // Name is typically the first substantial line
    let name;
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
function extractEducation(text, _lines) {
    const education = [];
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
function extractInstitution(text) {
    const instPatterns = [
        /(?:university|institute|college|school|iit|nit|iiit|bits|vit|srm|manipal)[\s\w]*/i,
    ];
    for (const p of instPatterns) {
        const match = text.match(p);
        if (match)
            return match[0].trim();
    }
    return undefined;
}
function extractSkills(text) {
    const lowerText = text.toLowerCase();
    const skills = {
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
                skills[category].push(skill);
            }
        }
    }
    return skills;
}
function extractProjects(text, lines) {
    const projects = [];
    const projectSectionMatch = text.match(/(?:projects?|personal projects?|technical projects?)[\s:]*\n([\s\S]*?)(?=\n\s*(?:experience|work experience|education|skills|certifications?|achievements?|awards?)\b|$)/i);
    if (projectSectionMatch) {
        const projectText = projectSectionMatch[1];
        // Split by numbered list (e.g. \n1. , \n2. ) or double newlines before a project title
        const projectBlocks = projectText.split(/\n(?=\s*\d+[\.\)]\s+[A-Za-z])|\n\s*\n+(?=[A-Za-z0-9])/);
        for (const rawBlock of projectBlocks) {
            const block = rawBlock.trim();
            if (block.length < 10)
                continue;
            const blockLines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            let name = blockLines[0]?.substring(0, 80) || 'Unnamed Project';
            // Strip leading bullet point if present
            name = name.replace(/^[•\-\*]\s+/, '').trim();
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
function extractExperience(text, _lines) {
    const experience = [];
    const expSectionMatch = text.match(/(?:experience|work experience|internships?)[\s:]*\n([\s\S]*?)(?=\n\s*(?:projects?|personal projects?|education|skills|certifications?|achievements?)\b|$)/i);
    if (expSectionMatch) {
        const expText = expSectionMatch[1];
        const blocks = expText.split(/\n(?=[A-Z])/);
        for (const block of blocks) {
            if (block.trim().length < 10)
                continue;
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
function extractAchievements(text, _lines) {
    const achievements = [];
    const achieveMatch = text.match(/(?:achievements?|awards?|honors?)[\s:]*\n([\s\S]*?)(?=\n\s*(?:projects?|experience|education|skills)\b|$)/i);
    if (achieveMatch) {
        const items = achieveMatch[1].split('\n').map(l => l.trim()).filter(l => l.length > 5);
        achievements.push(...items.slice(0, 10));
    }
    return achievements;
}
function extractCertifications(text, _lines) {
    const certs = [];
    const certMatch = text.match(/(?:certifications?|courses?)[\s:]*\n([\s\S]*?)(?=\n\s*(?:projects?|experience|education|skills|achievements?)\b|$)/i);
    if (certMatch) {
        const items = certMatch[1].split('\n').map(l => l.trim()).filter(l => l.length > 5);
        certs.push(...items.slice(0, 10));
    }
    return certs;
}
function findTechnologiesInText(text) {
    const found = [];
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
function extractProjectClaims(text) {
    const claims = [];
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
function extractMetrics(text) {
    const metrics = [];
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
function extractClaims(parsed) {
    const claims = [];
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
function inferProficiency(skill, parsed) {
    // Check if proficiency is explicitly mentioned in resume text
    // This is a simplified inference
    return 'claimed';
}
//# sourceMappingURL=resumeParser.js.map