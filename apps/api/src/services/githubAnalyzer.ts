export interface GitHubProfile {
  login: string;
  name: string | null;
  bio: string | null;
  publicRepos: number;
  followers: number;
  following: number;
  avatarUrl: string;
  htmlUrl: string;
}

export interface GitHubRepo {
  name: string;
  fullName: string;
  description: string | null;
  language: string | null;
  languages: Record<string, number>;
  stars: number;
  forks: number;
  topics: string[];
  hasReadme: boolean;
  readmeContent: string | null;
  hasDockerfile: boolean;
  hasCi: boolean;
  hasTests: boolean;
  packageJson: any | null;
  requirementsTxt: string | null;
  fileTree: string[];
  lastCommitAt: string | null;
  commitCount: number;
  htmlUrl: string;
}

export interface RepoEvidence {
  skill: string;
  evidenceType: string;
  source: string;
  detail: string;
  confidence: number;
  metadata?: Record<string, any>;
}

const GITHUB_API = 'https://api.github.com';

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'ProofCheck-App',
  };
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

async function githubFetch(url: string): Promise<any> {
  const response = await fetch(url, { headers: getHeaders() });
  if (response.status === 404) return null;
  if (response.status === 403) {
    const resetTime = response.headers.get('x-ratelimit-reset');
    throw new Error(`GitHub API rate limit exceeded. Resets at ${resetTime ? new Date(parseInt(resetTime) * 1000).toISOString() : 'unknown'}`);
  }
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function githubFetchText(url: string): Promise<string | null> {
  const response = await fetch(url, {
    headers: { ...getHeaders(), 'Accept': 'application/vnd.github.v3.raw' },
  });
  if (!response.ok) return null;
  return response.text();
}

export function normalizeGitHubInput(input: string): string {
  if (!input || typeof input !== 'string') {
    throw new Error('GitHub username or profile URL is required');
  }
  let cleaned = input.trim();
  // Strip protocol and hostname
  cleaned = cleaned.replace(/^https?:\/\//i, '');
  cleaned = cleaned.replace(/^(www\.)?github\.com\//i, '');
  // Strip leading @
  cleaned = cleaned.replace(/^@+/, '');
  // Extract canonical username (strip trailing paths, query strings, hashes)
  cleaned = cleaned.split('/')[0].split('?')[0].split('#')[0].trim();

  if (!cleaned) {
    throw new Error('Please enter a valid GitHub username or URL');
  }

  const validRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;
  if (!validRegex.test(cleaned)) {
    throw new Error(`'${cleaned}' is not a valid GitHub username format`);
  }
  return cleaned;
}

export async function fetchGitHubProfile(username: string): Promise<GitHubProfile> {
  const cleanUsername = normalizeGitHubInput(username);
  const data = await githubFetch(`${GITHUB_API}/users/${cleanUsername}`);
  if (!data) throw new Error(`GitHub profile '${cleanUsername}' could not be found. Please verify the username or profile URL.`);

  return {
    login: data.login,
    name: data.name,
    bio: data.bio,
    publicRepos: data.public_repos,
    followers: data.followers,
    following: data.following,
    avatarUrl: data.avatar_url,
    htmlUrl: data.html_url,
  };
}

export async function fetchRepositories(username: string): Promise<GitHubRepo[]> {
  const cleanUsername = normalizeGitHubInput(username);
  // Fetch up to 100 repos (sorted by recently updated)
  const repos = await githubFetch(
    `${GITHUB_API}/users/${cleanUsername}/repos?per_page=100&sort=updated&direction=desc&type=owner`
  );

  if (!repos || !Array.isArray(repos)) return [];

  // Filter out forks and analyze top repos
  const ownRepos = repos.filter((r: any) => !r.fork);

  // Analyze top 15 most interesting repos
  const topRepos = ownRepos
    .sort((a: any, b: any) => {
      const scoreA = (a.stargazers_count * 3) + a.size + (a.has_wiki ? 10 : 0);
      const scoreB = (b.stargazers_count * 3) + b.size + (b.has_wiki ? 10 : 0);
      return scoreB - scoreA;
    })
    .slice(0, 15);

  const analyzedRepos: GitHubRepo[] = [];

  for (const repo of topRepos) {
    try {
      const analyzed = await analyzeRepository(username, repo);
      analyzedRepos.push(analyzed);
    } catch (err) {
      console.error(`Error analyzing repo ${repo.name}:`, err);
      // Still include basic repo info
      analyzedRepos.push({
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description,
        language: repo.language,
        languages: {},
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        topics: repo.topics || [],
        hasReadme: false,
        readmeContent: null,
        hasDockerfile: false,
        hasCi: false,
        hasTests: false,
        packageJson: null,
        requirementsTxt: null,
        fileTree: [],
        lastCommitAt: repo.pushed_at,
        commitCount: 0,
        htmlUrl: repo.html_url,
      });
    }
  }

  return analyzedRepos;
}

async function analyzeRepository(username: string, repo: any): Promise<GitHubRepo> {
  const repoName = repo.name;

  // Fetch multiple things in parallel
  const [languages, tree, readme, packageJson, requirementsTxt, commitCount] = await Promise.all([
    githubFetch(`${GITHUB_API}/repos/${username}/${repoName}/languages`).catch(() => ({})),
    fetchRepoTree(username, repoName),
    githubFetchText(`${GITHUB_API}/repos/${username}/${repoName}/readme`).catch(() => null),
    githubFetchText(`${GITHUB_API}/repos/${username}/${repoName}/contents/package.json`).catch(() => null),
    githubFetchText(`${GITHUB_API}/repos/${username}/${repoName}/contents/requirements.txt`).catch(() => null),
    fetchCommitCount(username, repoName),
  ]);

  const fileTree = tree || [];
  const hasDockerfile = fileTree.some((f: string) =>
    f.toLowerCase().includes('dockerfile') || f.toLowerCase().includes('docker-compose')
  );
  const hasCi = fileTree.some((f: string) =>
    f.includes('.github/workflows') || f.includes('.gitlab-ci') || f.includes('Jenkinsfile') ||
    f.includes('.circleci') || f.includes('.travis.yml')
  );
  const hasTests = fileTree.some((f: string) =>
    f.includes('test') || f.includes('spec') || f.includes('__tests__') ||
    f.includes('.test.') || f.includes('.spec.')
  );

  let parsedPackageJson = null;
  if (packageJson) {
    try { parsedPackageJson = JSON.parse(packageJson); } catch {}
  }

  return {
    name: repoName,
    fullName: repo.full_name,
    description: repo.description,
    language: repo.language,
    languages: languages || {},
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    topics: repo.topics || [],
    hasReadme: !!readme,
    readmeContent: readme ? readme.substring(0, 3000) : null,
    hasDockerfile,
    hasCi,
    hasTests,
    packageJson: parsedPackageJson,
    requirementsTxt,
    fileTree,
    lastCommitAt: repo.pushed_at,
    commitCount,
    htmlUrl: repo.html_url,
  };
}

async function fetchRepoTree(username: string, repoName: string): Promise<string[]> {
  try {
    const data = await githubFetch(
      `${GITHUB_API}/repos/${username}/${repoName}/git/trees/HEAD?recursive=1`
    );
    if (!data || !data.tree) return [];
    return data.tree
      .filter((item: any) => item.type === 'blob')
      .map((item: any) => item.path)
      .slice(0, 500); // Limit file tree size
  } catch {
    return [];
  }
}

async function fetchCommitCount(username: string, repoName: string): Promise<number> {
  try {
    const response = await fetch(
      `${GITHUB_API}/repos/${username}/${repoName}/commits?per_page=1`,
      { headers: getHeaders() }
    );
    const linkHeader = response.headers.get('link');
    if (linkHeader) {
      const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
      if (lastMatch) return parseInt(lastMatch[1]);
    }
    const data = await response.json();
    return Array.isArray(data) ? data.length : 0;
  } catch {
    return 0;
  }
}

// Technology evidence extraction
export function extractEvidenceFromRepos(repos: GitHubRepo[]): RepoEvidence[] {
  const evidence: RepoEvidence[] = [];

  for (const repo of repos) {
    // Language evidence
    for (const [lang, bytes] of Object.entries(repo.languages)) {
      evidence.push({
        skill: normalizeSkillName(lang),
        evidenceType: 'language_usage',
        source: `github.repository.${repo.name}`,
        detail: `${lang} used in ${repo.name} (${formatBytes(bytes as number)})`,
        confidence: Math.min(0.5 + (bytes as number) / 50000, 0.95),
        metadata: { repository: repo.name, bytes, language: lang },
      });
    }

    // Package.json dependencies
    if (repo.packageJson) {
      const allDeps = {
        ...(repo.packageJson.dependencies || {}),
        ...(repo.packageJson.devDependencies || {}),
      };

      for (const dep of Object.keys(allDeps)) {
        const skill = mapDependencyToSkill(dep);
        if (skill) {
          evidence.push({
            skill,
            evidenceType: 'dependency',
            source: `github.repository.${repo.name}.package.json`,
            detail: `${dep} dependency detected in ${repo.name}`,
            confidence: 0.7,
            metadata: { repository: repo.name, dependency: dep, file: 'package.json' },
          });
        }
      }
    }

    // Requirements.txt
    if (repo.requirementsTxt) {
      const deps = repo.requirementsTxt.split('\n').map(l => l.trim().split('==')[0].split('>=')[0].trim()).filter(l => l && !l.startsWith('#'));
      for (const dep of deps) {
        const skill = mapPythonDependencyToSkill(dep);
        if (skill) {
          evidence.push({
            skill,
            evidenceType: 'dependency',
            source: `github.repository.${repo.name}.requirements.txt`,
            detail: `${dep} dependency detected in ${repo.name}`,
            confidence: 0.7,
            metadata: { repository: repo.name, dependency: dep, file: 'requirements.txt' },
          });
        }
      }
    }

    // Docker evidence
    if (repo.hasDockerfile) {
      evidence.push({
        skill: 'docker',
        evidenceType: 'configuration',
        source: `github.repository.${repo.name}`,
        detail: `Docker configuration found in ${repo.name}`,
        confidence: 0.85,
        metadata: { repository: repo.name },
      });
    }

    // CI/CD evidence
    if (repo.hasCi) {
      evidence.push({
        skill: 'ci/cd',
        evidenceType: 'configuration',
        source: `github.repository.${repo.name}`,
        detail: `CI/CD pipeline detected in ${repo.name}`,
        confidence: 0.85,
        metadata: { repository: repo.name },
      });
    }

    // Testing evidence
    if (repo.hasTests) {
      evidence.push({
        skill: 'testing',
        evidenceType: 'test_files',
        source: `github.repository.${repo.name}`,
        detail: `Test files detected in ${repo.name}`,
        confidence: 0.8,
        metadata: { repository: repo.name },
      });
    }

    // File tree analysis
    analyzeFileTree(repo, evidence);

    // README analysis
    if (repo.readmeContent) {
      analyzeReadme(repo, evidence);
    }
  }

  return deduplicateEvidence(evidence);
}

function analyzeFileTree(repo: GitHubRepo, evidence: RepoEvidence[]) {
  const files = repo.fileTree;

  // React components
  const jsxFiles = files.filter(f => f.endsWith('.jsx') || f.endsWith('.tsx'));
  if (jsxFiles.length > 0) {
    evidence.push({
      skill: 'react',
      evidenceType: 'source_code',
      source: `github.repository.${repo.name}.source_files`,
      detail: `${jsxFiles.length} React component file(s) detected in ${repo.name}`,
      confidence: Math.min(0.6 + jsxFiles.length * 0.05, 0.95),
      metadata: { repository: repo.name, componentCount: jsxFiles.length },
    });
  }

  // TypeScript
  const tsFiles = files.filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.endsWith('.d.ts'));
  if (tsFiles.length > 0) {
    evidence.push({
      skill: 'typescript',
      evidenceType: 'source_code',
      source: `github.repository.${repo.name}.source_files`,
      detail: `${tsFiles.length} TypeScript file(s) detected in ${repo.name}`,
      confidence: Math.min(0.6 + tsFiles.length * 0.03, 0.95),
      metadata: { repository: repo.name, fileCount: tsFiles.length },
    });
  }

  // Python files
  const pyFiles = files.filter(f => f.endsWith('.py'));
  if (pyFiles.length > 0) {
    evidence.push({
      skill: 'python',
      evidenceType: 'source_code',
      source: `github.repository.${repo.name}.source_files`,
      detail: `${pyFiles.length} Python file(s) detected in ${repo.name}`,
      confidence: Math.min(0.6 + pyFiles.length * 0.03, 0.95),
      metadata: { repository: repo.name, fileCount: pyFiles.length },
    });
  }

  // tsconfig
  if (files.some(f => f.includes('tsconfig'))) {
    evidence.push({
      skill: 'typescript',
      evidenceType: 'configuration',
      source: `github.repository.${repo.name}.tsconfig`,
      detail: `TypeScript configuration found in ${repo.name}`,
      confidence: 0.85,
      metadata: { repository: repo.name },
    });
  }

  // Deployment evidence
  if (files.some(f => f.includes('vercel.json') || f.includes('netlify.toml'))) {
    evidence.push({
      skill: 'deployment',
      evidenceType: 'configuration',
      source: `github.repository.${repo.name}`,
      detail: `Deployment configuration detected in ${repo.name}`,
      confidence: 0.85,
      metadata: { repository: repo.name },
    });
  }

  // API routes
  const routeFiles = files.filter(f =>
    f.includes('route') || f.includes('controller') || f.includes('api/')
  );
  if (routeFiles.length > 0) {
    evidence.push({
      skill: 'rest api',
      evidenceType: 'source_code',
      source: `github.repository.${repo.name}.source_files`,
      detail: `${routeFiles.length} API route/controller file(s) in ${repo.name}`,
      confidence: 0.75,
      metadata: { repository: repo.name },
    });
  }
}

function analyzeReadme(repo: GitHubRepo, evidence: RepoEvidence[]) {
  const readme = repo.readmeContent!.toLowerCase();

  // Check for deployment links
  const deploymentPatterns = [
    { pattern: /vercel\.app/, platform: 'Vercel' },
    { pattern: /netlify\.app/, platform: 'Netlify' },
    { pattern: /herokuapp\.com/, platform: 'Heroku' },
    { pattern: /railway\.app/, platform: 'Railway' },
    { pattern: /render\.com/, platform: 'Render' },
    { pattern: /amazonaws\.com/, platform: 'AWS' },
    { pattern: /firebase/, platform: 'Firebase' },
  ];

  for (const { pattern, platform } of deploymentPatterns) {
    if (pattern.test(readme)) {
      evidence.push({
        skill: 'deployment',
        evidenceType: 'deployment_link',
        source: `github.repository.${repo.name}.README`,
        detail: `${platform} deployment link found in ${repo.name} README`,
        confidence: 0.9,
        metadata: { repository: repo.name, platform },
      });
    }
  }

  // Documentation quality
  if (readme.length > 500) {
    evidence.push({
      skill: 'documentation',
      evidenceType: 'readme',
      source: `github.repository.${repo.name}.README`,
      detail: `Detailed README documentation in ${repo.name}`,
      confidence: 0.7,
      metadata: { repository: repo.name, readmeLength: readme.length },
    });
  }
}

function normalizeSkillName(name: string): string {
  const map: Record<string, string> = {
    'JavaScript': 'javascript',
    'TypeScript': 'typescript',
    'Python': 'python',
    'Java': 'java',
    'C++': 'c++',
    'C#': 'c#',
    'Go': 'go',
    'Rust': 'rust',
    'Ruby': 'ruby',
    'PHP': 'php',
    'Shell': 'linux',
    'Dockerfile': 'docker',
    'HTML': 'html',
    'CSS': 'css',
    'SCSS': 'css',
    'Sass': 'css',
  };
  return map[name] || name.toLowerCase();
}

function mapDependencyToSkill(dep: string): string | null {
  const map: Record<string, string> = {
    'react': 'react', 'react-dom': 'react', 'react-router': 'react', 'react-router-dom': 'react',
    'next': 'next.js', 'vue': 'vue', 'nuxt': 'nuxt', '@angular/core': 'angular', 'svelte': 'svelte',
    'express': 'express', 'fastify': 'node.js', 'koa': 'node.js', 'hapi': 'node.js', 'nestjs': 'nestjs',
    'mongoose': 'mongodb', 'mongodb': 'mongodb', 'pg': 'postgresql', 'mysql2': 'mysql',
    'redis': 'redis', 'ioredis': 'redis',
    'sequelize': 'sql', 'prisma': 'prisma', 'drizzle-orm': 'sql', 'typeorm': 'sql',
    'jest': 'testing', 'mocha': 'testing', 'vitest': 'testing', 'cypress': 'testing',
    'tailwindcss': 'tailwind', '@mui/material': 'material ui', '@chakra-ui/react': 'chakra ui',
    'socket.io': 'websocket', 'graphql': 'graphql', 'apollo-server': 'graphql',
    'jsonwebtoken': 'authentication', 'passport': 'authentication', 'bcrypt': 'authentication',
    'aws-sdk': 'aws', '@aws-sdk/client-s3': 'aws',
    'firebase': 'firebase', 'firebase-admin': 'firebase',
    'axios': 'rest api', 'node-fetch': 'rest api',
    'webpack': 'webpack', 'vite': 'vite',
    'typescript': 'typescript',
    'docker-compose': 'docker',
    'eslint': 'code quality', 'prettier': 'code quality',
  };
  return map[dep] || null;
}

function mapPythonDependencyToSkill(dep: string): string | null {
  const map: Record<string, string> = {
    'django': 'django', 'flask': 'flask', 'fastapi': 'fastapi',
    'numpy': 'python', 'pandas': 'python', 'scipy': 'python',
    'tensorflow': 'machine learning', 'torch': 'machine learning', 'pytorch': 'machine learning',
    'sklearn': 'machine learning', 'scikit-learn': 'machine learning',
    'sqlalchemy': 'sql', 'psycopg2': 'postgresql', 'pymongo': 'mongodb',
    'pytest': 'testing', 'unittest': 'testing',
    'boto3': 'aws', 'celery': 'python', 'redis': 'redis',
    'requests': 'rest api', 'beautifulsoup4': 'python',
    'docker': 'docker',
  };
  return map[dep.toLowerCase()] || null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function deduplicateEvidence(evidence: RepoEvidence[]): RepoEvidence[] {
  const seen = new Map<string, RepoEvidence>();
  for (const e of evidence) {
    const key = `${e.skill}:${e.source}:${e.evidenceType}`;
    const existing = seen.get(key);
    if (!existing || e.confidence > existing.confidence) {
      seen.set(key, e);
    }
  }
  return Array.from(seen.values());
}
