"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseJobDescription = parseJobDescription;
const TECH_KEYWORDS = {
    languages: ['javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'sql', 'html', 'css', 'dart', 'scala', 'r'],
    frameworks: ['react', 'next.js', 'nextjs', 'angular', 'vue', 'vue.js', 'svelte', 'express', 'node.js', 'nodejs', 'django', 'flask', 'fastapi', 'spring', 'spring boot', 'rails', 'laravel', 'flutter', 'react native', '.net', 'nest.js', 'nestjs', 'gatsby', 'nuxt', 'remix', 'tailwind', 'bootstrap', 'material ui'],
    tools: ['docker', 'kubernetes', 'git', 'github', 'jenkins', 'ci/cd', 'github actions', 'terraform', 'ansible', 'nginx', 'webpack', 'vite', 'jest', 'mocha', 'cypress', 'selenium', 'graphql', 'rest api', 'kafka', 'rabbitmq', 'grpc', 'postman'],
    databases: ['mongodb', 'postgresql', 'postgres', 'mysql', 'sqlite', 'redis', 'elasticsearch', 'dynamodb', 'cassandra', 'firebase', 'supabase'],
    cloud: ['aws', 'amazon web services', 'gcp', 'google cloud', 'azure', 'heroku', 'vercel', 'netlify'],
    csFundamentals: ['data structures', 'algorithms', 'system design', 'object oriented', 'oop', 'design patterns', 'solid', 'dsa', 'operating systems', 'computer networks', 'dbms'],
};
const SOFT_SKILLS = [
    'communication', 'teamwork', 'leadership', 'problem solving', 'problem-solving',
    'collaboration', 'ownership', 'initiative', 'critical thinking', 'adaptability',
    'time management', 'attention to detail', 'agile', 'scrum',
];
function parseJobDescription(text) {
    const trimmed = (text || '').trim();
    const lowerText = trimmed.toLowerCase();
    const lines = trimmed.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    // Extract title and company
    const title = extractTitle(lines);
    const company = extractCompany(lines);
    // Check for extremely short or empty JD
    if (trimmed.length < 50) {
        return {
            title,
            company,
            required: { languages: [], frameworks: [], tools: [], databases: [], cloud: [], csFundamentals: [], experience: [], qualifications: [] },
            preferred: { technologies: [], cloud: [], databases: [], testing: [], deployment: [] },
            softSkills: [],
            allRequirements: [],
            dataQuality: 'LIMITED',
            sufficientTechnicalDetail: false,
            statusMessage: 'This job description does not provide enough technical detail for a strong role-alignment assessment.',
        };
    }
    // Separate required vs preferred sections
    const { requiredSection, preferredSection } = splitSections(trimmed);
    const required = {
        languages: findKeywords(requiredSection || lowerText, TECH_KEYWORDS.languages),
        frameworks: findKeywords(requiredSection || lowerText, TECH_KEYWORDS.frameworks),
        tools: findKeywords(requiredSection || lowerText, TECH_KEYWORDS.tools),
        databases: findKeywords(requiredSection || lowerText, TECH_KEYWORDS.databases),
        cloud: findKeywords(requiredSection || lowerText, TECH_KEYWORDS.cloud),
        csFundamentals: findKeywords(requiredSection || lowerText, TECH_KEYWORDS.csFundamentals),
        experience: extractExperience(requiredSection || trimmed),
        qualifications: extractQualifications(requiredSection || trimmed),
    };
    const preferred = {
        technologies: preferredSection
            ? [...findKeywords(preferredSection, TECH_KEYWORDS.frameworks), ...findKeywords(preferredSection, TECH_KEYWORDS.languages)]
            : [],
        cloud: preferredSection ? findKeywords(preferredSection, TECH_KEYWORDS.cloud) : [],
        databases: preferredSection ? findKeywords(preferredSection, TECH_KEYWORDS.databases) : [],
        testing: preferredSection ? findKeywords(preferredSection, ['testing', 'jest', 'mocha', 'pytest', 'cypress', 'unit test', 'integration test']) : [],
        deployment: preferredSection ? findKeywords(preferredSection, ['docker', 'kubernetes', 'ci/cd', 'deployment', 'devops']) : [],
    };
    const softSkills = findKeywords(lowerText, SOFT_SKILLS);
    // Collect all unique requirements
    const allRequirements = [...new Set([
            ...required.languages,
            ...required.frameworks,
            ...required.tools,
            ...required.databases,
            ...required.cloud,
        ])];
    const sufficientTechnicalDetail = allRequirements.length >= 2;
    const dataQuality = sufficientTechnicalDetail
        ? 'COMPLETE'
        : (allRequirements.length === 1 ? 'PARTIAL' : 'LIMITED');
    const statusMessage = !sufficientTechnicalDetail
        ? 'This job description does not provide enough technical detail for a strong role-alignment assessment.'
        : undefined;
    return {
        title,
        company,
        required,
        preferred,
        softSkills,
        allRequirements,
        dataQuality,
        sufficientTechnicalDetail,
        statusMessage,
    };
}
function extractTitle(lines) {
    // Title is usually one of the first lines
    for (const line of lines.slice(0, 5)) {
        if (line.length > 5 && line.length < 100) {
            const titlePatterns = [
                /(?:software|frontend|backend|full.?stack|web|mobile|devops|cloud|data|ml|ai|machine learning)\s*(?:engineer|developer|intern|architect)/i,
                /(?:intern|internship)\s*[-–]\s*(?:software|frontend|backend|engineering)/i,
                /(?:sde|swe|se)\s*(?:intern|i|ii|iii)/i,
            ];
            for (const pattern of titlePatterns) {
                const match = line.match(pattern);
                if (match)
                    return match[0].trim();
            }
        }
    }
    return lines[0]?.substring(0, 80);
}
function extractCompany(lines) {
    for (const line of lines.slice(0, 10)) {
        const companyPatterns = [
            /(?:company|organization|employer)[\s:]*(.{2,50})/i,
            /(?:at|@)\s+(.{2,50})/i,
        ];
        for (const pattern of companyPatterns) {
            const match = line.match(pattern);
            if (match)
                return match[1].trim();
        }
    }
    return undefined;
}
function splitSections(text) {
    const lowerText = text.toLowerCase();
    const requiredPatterns = [
        /(?:required|must have|requirements|qualifications|what you.?ll need|what we.?re looking for)[\s:]*\n([\s\S]*?)(?=\n(?:preferred|nice to have|bonus|optional|good to have|what we offer|benefits|$))/i,
    ];
    const preferredPatterns = [
        /(?:preferred|nice to have|bonus|optional|good to have|plus|desired)[\s:]*\n([\s\S]*?)(?=\n(?:what we offer|benefits|about|how to apply|$))/i,
    ];
    let requiredSection = null;
    let preferredSection = null;
    for (const pattern of requiredPatterns) {
        const match = text.match(pattern);
        if (match) {
            requiredSection = match[1].toLowerCase();
            break;
        }
    }
    for (const pattern of preferredPatterns) {
        const match = text.match(pattern);
        if (match) {
            preferredSection = match[1].toLowerCase();
            break;
        }
    }
    return { requiredSection, preferredSection };
}
function findKeywords(text, keywords) {
    const found = [];
    for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(text) && !found.includes(keyword)) {
            found.push(keyword);
        }
    }
    return found;
}
function extractExperience(text) {
    const experience = [];
    const patterns = [
        /(\d+[\s+]*(?:years?|yrs?)[\s\w]*(?:experience|exp))/gi,
        /(experience\s+(?:with|in)\s+[^.]{5,60})/gi,
    ];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            experience.push(match[1].trim());
        }
    }
    return experience.slice(0, 5);
}
function extractQualifications(text) {
    const quals = [];
    const patterns = [
        /((?:B\.?Tech|B\.?E\.?|Bachelor|Master|M\.?Tech|M\.?S\.?|Ph\.?D\.?|B\.?Sc|M\.?Sc|BCA|MCA)[\s\w]{0,40})/gi,
    ];
    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
            quals.push(match[1].trim());
        }
    }
    return quals.slice(0, 3);
}
//# sourceMappingURL=jobParser.js.map