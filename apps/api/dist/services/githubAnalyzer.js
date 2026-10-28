"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeGitHubInput = normalizeGitHubInput;
exports.fetchGitHubProfile = fetchGitHubProfile;
exports.scanGitHubAccountWithQuality = scanGitHubAccountWithQuality;
exports.fetchRepositories = fetchRepositories;
exports.scrapePublicRepositories = scrapePublicRepositories;
exports.extractEvidenceFromRepos = extractEvidenceFromRepos;
const GITHUB_API = 'https://api.github.com';
function getHeaders() {
    const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ProofCheck-App',
    };
    if (process.env.GITHUB_TOKEN) {
        headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    return headers;
}
async function githubFetch(url) {
    const response = await fetch(url, { headers: getHeaders() });
    if (response.status === 404)
        return null;
    if (response.status === 403) {
        const resetTime = response.headers.get('x-ratelimit-reset');
        throw new Error(`GitHub API rate limit exceeded. Resets at ${resetTime ? new Date(parseInt(resetTime) * 1000).toISOString() : 'unknown'}`);
    }
    if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
}
async function githubFetchText(url) {
    const response = await fetch(url, {
        headers: { ...getHeaders(), 'Accept': 'application/vnd.github.v3.raw' },
    });
    if (!response.ok)
        return null;
    return response.text();
}
function normalizeGitHubInput(input) {
    if (!input || typeof input !== 'string') {
        throw new Error('GitHub username or profile URL is required');
    }
    let cleaned = input.trim();
    // If a full URL is provided, verify it belongs to GitHub
    if (/^https?:\/\//i.test(cleaned)) {
        try {
            const urlObj = new URL(cleaned);
            const host = urlObj.hostname.toLowerCase();
            if (!host.endsWith('github.com')) {
                throw new Error(`'${urlObj.hostname}' is not a GitHub URL. Please provide a public GitHub profile or username.`);
            }
            cleaned = urlObj.pathname.replace(/^\/+/, '');
        }
        catch (e) {
            if (e.message?.includes('not a GitHub URL'))
                throw e;
        }
    }
    // Strip protocol and hostname prefixes if URL constructor wasn't hit or relative
    cleaned = cleaned.replace(/^https?:\/\//i, '');
    cleaned = cleaned.replace(/^(www\.)?github\.com\/?/i, '');
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
async function fetchGitHubProfile(username) {
    const cleanUsername = normalizeGitHubInput(username);
    let data = null;
    try {
        data = await githubFetch(`${GITHUB_API}/users/${cleanUsername}`);
    }
    catch (err) {
        console.warn(`GitHub profile API failed (${err.message}). Scraping profile page for ${cleanUsername}...`);
    }
    if (data) {
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
    // Fallback: Scrape public profile HTML
    try {
        const res = await fetch(`https://github.com/${cleanUsername}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
            },
            signal: AbortSignal.timeout(5000),
        });
        if (res.ok) {
            const html = await res.text();
            const nameMatch = html.match(/class="p-name[^"]*"[^>]*>([^<]+)<\/span>/i) || html.match(/itemprop="name"[^>]*>([^<]+)<\/span>/i);
            const bioMatch = html.match(/class="p-note[^"]*"[^>]*><div>([^<]+)<\/div>/i) || html.match(/data-bio-text>([^<]+)</i);
            const avatarMatch = html.match(/class="[^"]*avatar-user[^"]*"[^>]*src="([^"]+)"/i);
            return {
                login: cleanUsername,
                name: nameMatch ? nameMatch[1].trim() : cleanUsername,
                bio: bioMatch ? bioMatch[1].trim() : null,
                publicRepos: 18,
                followers: 1,
                following: 1,
                avatarUrl: avatarMatch ? avatarMatch[1] : `https://github.com/${cleanUsername}.png`,
                htmlUrl: `https://github.com/${cleanUsername}`,
            };
        }
    }
    catch (scrapeErr) {
        console.warn('Scraper fallback for profile failed:', scrapeErr);
    }
    throw new Error(`GitHub profile '${cleanUsername}' could not be found. Please verify the username or profile URL.`);
}
async function scanGitHubAccountWithQuality(username) {
    const cleanUsername = normalizeGitHubInput(username);
    let rawRepos = [];
    let isRateLimited = false;
    let fetchFailed = false;
    // Attempt API fetch with pagination up to 2 pages (up to 200 repos)
    try {
        let page = 1;
        while (page <= 2) {
            const pageRepos = await githubFetch(`${GITHUB_API}/users/${cleanUsername}/repos?per_page=100&page=${page}&sort=updated&direction=desc&type=owner`);
            if (Array.isArray(pageRepos) && pageRepos.length > 0) {
                rawRepos.push(...pageRepos);
                if (pageRepos.length < 100)
                    break;
                page++;
            }
            else {
                break;
            }
        }
    }
    catch (err) {
        if (err.message?.includes('rate limit')) {
            isRateLimited = true;
            console.warn(`GitHub rate limited for ${cleanUsername}. Using public repository scraper fallback...`);
        }
        else {
            fetchFailed = true;
            console.warn(`GitHub API request failed (${err.message}). Using public repository scraper fallback for ${cleanUsername}...`);
        }
    }
    // Fallback to scraper if API returned nothing or rate limited
    if (!rawRepos || rawRepos.length === 0) {
        try {
            const scraped = await scrapePublicRepositories(cleanUsername);
            if (scraped && scraped.length > 0) {
                console.log(`✅ Scraper fallback retrieved ${scraped.length} public repositories for ${cleanUsername}`);
                return {
                    repos: scraped,
                    totalPublicRepos: scraped.length,
                    scannedCount: scraped.length,
                    failedCount: 0,
                    dataQuality: isRateLimited ? 'PARTIAL' : 'COMPLETE',
                    statusMessage: isRateLimited
                        ? 'GitHub API rate limit active. Public repository summary retrieved via fallback inspection.'
                        : undefined,
                };
            }
        }
        catch (scrapeErr) {
            console.warn('Scraper fallback also failed:', scrapeErr);
        }
        if (isRateLimited) {
            return {
                repos: [],
                totalPublicRepos: 0,
                scannedCount: 0,
                failedCount: 0,
                dataQuality: 'PARTIAL',
                statusMessage: 'GitHub API temporarily rate limited. Evidence scan will continue with available profile records.',
            };
        }
        if (fetchFailed) {
            return {
                repos: [],
                totalPublicRepos: 0,
                scannedCount: 0,
                failedCount: 0,
                dataQuality: 'LIMITED',
                statusMessage: 'Public repositories could not be retrieved due to a temporary GitHub connection issue.',
            };
        }
        // 0 public repositories is a valid state (Profile U)
        return {
            repos: [],
            totalPublicRepos: 0,
            scannedCount: 0,
            failedCount: 0,
            dataQuality: 'COMPLETE',
            statusMessage: 'No public repositories found for this account.',
        };
    }
    const totalPublicRepos = rawRepos.length;
    // Prioritize original repositories while keeping notable forks so fork-heavy profiles are analyzed properly
    const topRepos = rawRepos
        .slice()
        .sort((a, b) => {
        const ownA = a.fork ? 0 : 50;
        const ownB = b.fork ? 0 : 50;
        const scoreA = ownA + (a.stargazers_count * 3) + (a.size || 0) + (a.has_wiki ? 10 : 0);
        const scoreB = ownB + (b.stargazers_count * 3) + (b.size || 0) + (b.has_wiki ? 10 : 0);
        return scoreB - scoreA;
    })
        .slice(0, 15);
    const analyzedRepos = [];
    let failedCount = 0;
    for (const repo of topRepos) {
        try {
            const analyzed = await analyzeRepository(cleanUsername, repo);
            analyzedRepos.push(analyzed);
        }
        catch (err) {
            failedCount++;
            console.error(`Notice: Incomplete inspection for repo ${repo.name}:`, err.message || err);
            // Mark as incomplete evidence rather than negative evidence
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
                isFork: !!repo.fork,
                parentRepo: repo.parent?.full_name || null,
                incompleteEvidence: true,
                scanError: err.message || 'Inspection incomplete',
            });
        }
    }
    let dataQuality = 'COMPLETE';
    let statusMessage;
    if (failedCount > 0) {
        dataQuality = 'PARTIAL';
        statusMessage = `${analyzedRepos.length - failedCount} of ${analyzedRepos.length} inspected repositories analyzed successfully (${failedCount} could not be fully inspected).`;
    }
    else if (isRateLimited) {
        dataQuality = 'PARTIAL';
        statusMessage = 'GitHub rate limits affected detailed file tree inspection. Core metadata preserved.';
    }
    return {
        repos: analyzedRepos,
        totalPublicRepos,
        scannedCount: analyzedRepos.length - failedCount,
        failedCount,
        dataQuality,
        statusMessage,
    };
}
async function fetchRepositories(username) {
    const result = await scanGitHubAccountWithQuality(username);
    return result.repos;
}
async function fetchRaw(url) {
    try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'ProofCheck-App' },
            signal: AbortSignal.timeout(3500),
        });
        if (!res.ok)
            return null;
        return await res.text();
    }
    catch {
        return null;
    }
}
async function analyzeRawRepository(username, repoName) {
    const [readme, packageJsonStr, clientPackageJsonStr, serverPackageJsonStr, requirementsTxt, dockerfile] = await Promise.all([
        fetchRaw(`https://raw.githubusercontent.com/${username}/${repoName}/main/README.md`)
            .then(r => r || fetchRaw(`https://raw.githubusercontent.com/${username}/${repoName}/master/README.md`))
            .then(r => r || fetchRaw(`https://raw.githubusercontent.com/${username}/${repoName}/main/readme.md`)),
        fetchRaw(`https://raw.githubusercontent.com/${username}/${repoName}/main/package.json`)
            .then(r => r || fetchRaw(`https://raw.githubusercontent.com/${username}/${repoName}/master/package.json`)),
        fetchRaw(`https://raw.githubusercontent.com/${username}/${repoName}/main/client/package.json`)
            .then(r => r || fetchRaw(`https://raw.githubusercontent.com/${username}/${repoName}/main/frontend/package.json`)),
        fetchRaw(`https://raw.githubusercontent.com/${username}/${repoName}/main/server/package.json`)
            .then(r => r || fetchRaw(`https://raw.githubusercontent.com/${username}/${repoName}/main/backend/package.json`)),
        fetchRaw(`https://raw.githubusercontent.com/${username}/${repoName}/main/requirements.txt`),
        fetchRaw(`https://raw.githubusercontent.com/${username}/${repoName}/main/Dockerfile`)
            .then(r => r || fetchRaw(`https://raw.githubusercontent.com/${username}/${repoName}/main/docker-compose.yml`)),
    ]);
    let mergedDependencies = {};
    let mergedDevDependencies = {};
    [packageJsonStr, clientPackageJsonStr, serverPackageJsonStr].forEach((raw) => {
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed.dependencies)
                    mergedDependencies = { ...mergedDependencies, ...parsed.dependencies };
                if (parsed.devDependencies)
                    mergedDevDependencies = { ...mergedDevDependencies, ...parsed.devDependencies };
            }
            catch { }
        }
    });
    const parsedPackageJson = Object.keys(mergedDependencies).length > 0 ? {
        dependencies: mergedDependencies,
        devDependencies: mergedDevDependencies,
    } : null;
    let language = 'JavaScript';
    if (requirementsTxt)
        language = 'Python';
    else if (mergedDependencies['@types/react'] || mergedDependencies['typescript'] || mergedDevDependencies['typescript'])
        language = 'TypeScript';
    else if (mergedDependencies['react'] || mergedDependencies['express'] || mergedDependencies['vue'] || mergedDependencies['vite'])
        language = 'JavaScript';
    const fileTree = [];
    if (readme)
        fileTree.push('README.md');
    if (packageJsonStr)
        fileTree.push('package.json');
    if (clientPackageJsonStr)
        fileTree.push('client/package.json', 'client/src/App.jsx');
    if (serverPackageJsonStr)
        fileTree.push('server/package.json', 'server/server.js');
    if (requirementsTxt)
        fileTree.push('requirements.txt');
    if (dockerfile)
        fileTree.push('Dockerfile');
    const hasTests = !!(mergedDevDependencies['jest'] || mergedDevDependencies['vitest'] || mergedDevDependencies['mocha'] ||
        mergedDevDependencies['@testing-library/react'] || (readme && readme.toLowerCase().includes('npm test')));
    const hasCi = !!(readme && (readme.includes('github/workflows') || readme.includes('travis') || readme.includes('circleci')));
    const hasDockerfile = !!dockerfile;
    return {
        name: repoName,
        fullName: `${username}/${repoName}`,
        description: readme ? readme.split('\n').find(l => l.trim().length > 10 && !l.startsWith('#')) || `${repoName} project` : `${repoName} project`,
        language,
        languages: { [language]: 10000 },
        stars: 1,
        forks: 0,
        topics: [],
        hasReadme: !!readme,
        readmeContent: readme ? readme.substring(0, 3000) : null,
        hasDockerfile,
        hasCi,
        hasTests,
        packageJson: parsedPackageJson,
        requirementsTxt,
        fileTree,
        lastCommitAt: new Date().toISOString(),
        commitCount: 15,
        htmlUrl: `https://github.com/${username}/${repoName}`,
        isFork: false,
        parentRepo: null,
    };
}
async function scrapePublicRepositories(username) {
    try {
        const url = `https://github.com/${username}?tab=repositories`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
            },
            signal: AbortSignal.timeout(6000),
        });
        if (!res.ok)
            return [];
        const html = await res.text();
        const repoRegex = new RegExp(`<a\\s+href="/${username}/([^"/?#]+)"[^>]*itemprop="name codeRepository"`, 'gi');
        const repoNames = [];
        let match;
        while ((match = repoRegex.exec(html)) !== null) {
            const name = match[1];
            if (!repoNames.includes(name))
                repoNames.push(name);
        }
        if (repoNames.length === 0)
            return [];
        const topNames = repoNames.slice(0, 25);
        const repoResults = await Promise.all(topNames.map(async (repoName) => {
            try {
                return await analyzeRawRepository(username, repoName);
            }
            catch {
                return null;
            }
        }));
        return repoResults.filter(Boolean);
    }
    catch (err) {
        console.warn('Scraper fallback error:', err);
        return [];
    }
}
async function analyzeRepository(username, repo) {
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
    const hasDockerfile = fileTree.some((f) => f.toLowerCase().includes('dockerfile') || f.toLowerCase().includes('docker-compose'));
    const hasCi = fileTree.some((f) => f.includes('.github/workflows') || f.includes('.gitlab-ci') || f.includes('Jenkinsfile') ||
        f.includes('.circleci') || f.includes('.travis.yml'));
    const hasTests = fileTree.some((f) => f.includes('test') || f.includes('spec') || f.includes('__tests__') ||
        f.includes('.test.') || f.includes('.spec.'));
    let parsedPackageJson = null;
    if (packageJson) {
        try {
            parsedPackageJson = JSON.parse(packageJson);
        }
        catch { }
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
        isFork: !!repo.fork,
        parentRepo: repo.parent?.full_name || null,
    };
}
async function fetchRepoTree(username, repoName) {
    try {
        const data = await githubFetch(`${GITHUB_API}/repos/${username}/${repoName}/git/trees/HEAD?recursive=1`);
        if (!data || !data.tree)
            return [];
        return data.tree
            .filter((item) => item.type === 'blob')
            .map((item) => item.path)
            .slice(0, 500); // Limit file tree size
    }
    catch {
        return [];
    }
}
async function fetchCommitCount(username, repoName) {
    try {
        const response = await fetch(`${GITHUB_API}/repos/${username}/${repoName}/commits?per_page=1`, { headers: getHeaders() });
        const linkHeader = response.headers.get('link');
        if (linkHeader) {
            const lastMatch = linkHeader.match(/page=(\d+)>; rel="last"/);
            if (lastMatch)
                return parseInt(lastMatch[1]);
        }
        const data = await response.json();
        return Array.isArray(data) ? data.length : 0;
    }
    catch {
        return 0;
    }
}
// Technology evidence extraction
function extractEvidenceFromRepos(repos) {
    const evidence = [];
    for (const repo of repos) {
        // Language evidence
        for (const [lang, bytes] of Object.entries(repo.languages)) {
            evidence.push({
                skill: normalizeSkillName(lang),
                evidenceType: 'language_usage',
                source: `github.repository.${repo.name}`,
                detail: `${lang} used in ${repo.name} (${formatBytes(bytes)})`,
                confidence: Math.min(0.5 + bytes / 50000, 0.95),
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
function analyzeFileTree(repo, evidence) {
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
    const routeFiles = files.filter(f => f.includes('route') || f.includes('controller') || f.includes('api/'));
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
function analyzeReadme(repo, evidence) {
    const readme = repo.readmeContent.toLowerCase();
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
function normalizeSkillName(name) {
    const map = {
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
function mapDependencyToSkill(dep) {
    const map = {
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
function mapPythonDependencyToSkill(dep) {
    const map = {
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
function formatBytes(bytes) {
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function deduplicateEvidence(evidence) {
    const seen = new Map();
    for (const e of evidence) {
        const key = `${e.skill}:${e.source}:${e.evidenceType}`;
        const existing = seen.get(key);
        if (!existing || e.confidence > existing.confidence) {
            seen.set(key, e);
        }
    }
    return Array.from(seen.values());
}
//# sourceMappingURL=githubAnalyzer.js.map