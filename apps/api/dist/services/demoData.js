"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEMO_PARSED_JOB = exports.DEMO_JOB_DESCRIPTION = exports.DEMO_EVIDENCE = exports.DEMO_REPOS = exports.DEMO_CLAIMS = exports.DEMO_PARSED_RESUME = exports.DEMO_RESUME_TEXT = void 0;
// Demo student: Arjun Sharma — Frontend Developer Intern target
// Deliberately contains mismatches for demonstration
exports.DEMO_RESUME_TEXT = `Arjun Sharma
arjun.sharma@email.com | +91 9876543210
github.com/arjunsharma | linkedin.com/in/arjunsharma

Education
B.Tech Computer Science and Engineering
Rajasthan Technical University, Jaipur
2023 - 2027 | CGPA: 8.2

Skills
Programming Languages: JavaScript, TypeScript, Python, C++
Frameworks: React, Next.js, Node.js, Express.js, Tailwind CSS
Databases: MongoDB, PostgreSQL, Redis
Cloud & DevOps: AWS, Docker, Firebase
Tools: Git, GitHub, Postman, VS Code, Figma

Projects
WashEase - Laundry Management System
React, Node.js, MongoDB, Tailwind CSS
• Built a full-stack laundry management platform with real-time order tracking
• Implemented user authentication and role-based access control
• Developed REST APIs for order management, user profiles, and service catalog
• Integrated payment gateway for online transactions

TaskFlow - Project Management Tool
React, Firebase, Material UI
• Created a Kanban-style project management application
• Implemented drag-and-drop task management with real-time updates
• Built collaborative features with Firebase real-time database

Portfolio Website
HTML, CSS, JavaScript
• Designed and developed a responsive personal portfolio website
• Implemented smooth animations and modern UI design

Experience
Frontend Developer Intern | TechStartup Pvt Ltd | June 2025 - August 2025
• Developed responsive UI components using React and Tailwind CSS
• Implemented RESTful API integration for data fetching
• Collaborated with backend team on feature development

Achievements
• Solved 200+ problems on LeetCode
• Winner of College Hackathon 2024
• Published a technical blog on Medium`;
exports.DEMO_PARSED_RESUME = {
    personal: {
        name: 'Arjun Sharma',
        email: 'arjun.sharma@email.com',
        phone: '+919876543210',
        links: ['github.com/arjunsharma', 'linkedin.com/in/arjunsharma'],
    },
    education: [{
            institution: 'Rajasthan Technical University',
            degree: 'B.Tech Computer Science and Engineering',
            graduationYear: '2027',
            gpa: '8.2',
        }],
    skills: {
        languages: ['javascript', 'typescript', 'python', 'c++'],
        frameworks: ['react', 'next.js', 'node.js', 'express', 'tailwind'],
        databases: ['mongodb', 'postgresql', 'redis'],
        cloud: ['aws', 'firebase'],
        tools: ['docker', 'git', 'postman', 'figma'],
        other: [],
    },
    projects: [
        {
            name: 'WashEase - Laundry Management System',
            technologies: ['react', 'node.js', 'mongodb', 'tailwind'],
            description: 'Built a full-stack laundry management platform with real-time order tracking. Implemented user authentication and role-based access control. Developed REST APIs.',
            claims: ['Built a full-stack laundry management platform', 'Implemented user authentication', 'Developed REST APIs', 'Integrated payment gateway'],
            metrics: [],
            links: [],
        },
        {
            name: 'TaskFlow - Project Management Tool',
            technologies: ['react', 'firebase', 'material ui'],
            description: 'Created a Kanban-style project management application with drag-and-drop and real-time updates.',
            claims: ['Created a Kanban-style project management application', 'Implemented drag-and-drop task management'],
            metrics: [],
            links: [],
        },
        {
            name: 'Portfolio Website',
            technologies: ['html', 'css', 'javascript'],
            description: 'Designed and developed a responsive personal portfolio website.',
            claims: ['Designed and developed a responsive personal portfolio website'],
            metrics: [],
            links: [],
        },
    ],
    experience: [{
            company: 'TechStartup Pvt Ltd',
            role: 'Frontend Developer Intern',
            duration: 'June 2025 - August 2025',
            technologies: ['react', 'tailwind'],
            claims: ['Developed responsive UI components', 'Implemented RESTful API integration'],
            description: 'Developed responsive UI components using React and Tailwind CSS. Implemented RESTful API integration.',
        }],
    achievements: [
        'Solved 200+ problems on LeetCode',
        'Winner of College Hackathon 2024',
        'Published a technical blog on Medium',
    ],
    certifications: [],
};
exports.DEMO_CLAIMS = [
    { claim: 'javascript', claimType: 'skill', category: 'languages', source: 'resume.skills', proficiencyLevel: 'claimed' },
    { claim: 'typescript', claimType: 'skill', category: 'languages', source: 'resume.skills', proficiencyLevel: 'claimed' },
    { claim: 'python', claimType: 'skill', category: 'languages', source: 'resume.skills', proficiencyLevel: 'claimed' },
    { claim: 'c++', claimType: 'skill', category: 'languages', source: 'resume.skills', proficiencyLevel: 'claimed' },
    { claim: 'react', claimType: 'skill', category: 'frameworks', source: 'resume.skills', proficiencyLevel: 'claimed' },
    { claim: 'next.js', claimType: 'skill', category: 'frameworks', source: 'resume.skills', proficiencyLevel: 'claimed' },
    { claim: 'node.js', claimType: 'skill', category: 'frameworks', source: 'resume.skills', proficiencyLevel: 'claimed' },
    { claim: 'express', claimType: 'skill', category: 'frameworks', source: 'resume.skills', proficiencyLevel: 'claimed' },
    { claim: 'tailwind', claimType: 'skill', category: 'frameworks', source: 'resume.skills', proficiencyLevel: 'claimed' },
    { claim: 'mongodb', claimType: 'skill', category: 'databases', source: 'resume.skills', proficiencyLevel: 'claimed' },
    { claim: 'postgresql', claimType: 'skill', category: 'databases', source: 'resume.skills', proficiencyLevel: 'claimed' },
    { claim: 'redis', claimType: 'skill', category: 'databases', source: 'resume.skills', proficiencyLevel: 'claimed' },
    { claim: 'aws', claimType: 'skill', category: 'cloud', source: 'resume.skills', proficiencyLevel: 'claimed' },
    { claim: 'firebase', claimType: 'skill', category: 'cloud', source: 'resume.skills', proficiencyLevel: 'claimed' },
    { claim: 'docker', claimType: 'skill', category: 'tools', source: 'resume.skills', proficiencyLevel: 'claimed' },
    { claim: 'git', claimType: 'skill', category: 'tools', source: 'resume.skills', proficiencyLevel: 'claimed' },
];
exports.DEMO_REPOS = [
    {
        name: 'washease',
        fullName: 'arjunsharma/washease',
        description: 'Full-stack laundry management system',
        language: 'JavaScript',
        languages: { JavaScript: 45000, CSS: 8000, HTML: 2000 },
        stars: 2,
        forks: 0,
        topics: ['react', 'nodejs', 'mongodb'],
        hasReadme: true,
        readmeContent: '# WashEase\nA laundry management system built with MERN stack.\n\n## Setup\nnpm install\nnpm start',
        hasDockerfile: false,
        hasCi: false,
        hasTests: false,
        packageJson: {
            dependencies: {
                'react': '^18.2.0', 'react-dom': '^18.2.0', 'react-router-dom': '^6.0.0',
                'axios': '^1.4.0', 'tailwindcss': '^3.3.0',
            },
            devDependencies: {},
        },
        requirementsTxt: null,
        fileTree: [
            'package.json', 'README.md',
            'src/App.jsx', 'src/index.js',
            'src/components/Navbar.jsx', 'src/components/OrderCard.jsx', 'src/components/OrderForm.jsx',
            'src/components/OrderList.jsx', 'src/components/ServiceCard.jsx', 'src/components/Footer.jsx',
            'src/components/Dashboard.jsx', 'src/components/Profile.jsx', 'src/components/Login.jsx',
            'src/components/Register.jsx', 'src/components/ProtectedRoute.jsx',
            'src/pages/Home.jsx', 'src/pages/Orders.jsx', 'src/pages/Services.jsx', 'src/pages/About.jsx',
            'src/context/AuthContext.jsx',
            'src/utils/api.js',
            'server/index.js', 'server/routes/orders.js', 'server/routes/users.js', 'server/routes/services.js',
            'server/models/Order.js', 'server/models/User.js', 'server/models/Service.js',
            'server/middleware/auth.js',
        ],
        lastCommitAt: '2025-09-15T10:00:00Z',
        commitCount: 47,
        htmlUrl: 'https://github.com/arjunsharma/washease',
    },
    {
        name: 'taskflow',
        fullName: 'arjunsharma/taskflow',
        description: 'Kanban project management tool',
        language: 'JavaScript',
        languages: { JavaScript: 22000, CSS: 5000 },
        stars: 1,
        forks: 0,
        topics: ['react', 'firebase'],
        hasReadme: true,
        readmeContent: '# TaskFlow\nA project management tool.\n\nnpm start to run.',
        hasDockerfile: false,
        hasCi: false,
        hasTests: false,
        packageJson: {
            dependencies: {
                'react': '^18.2.0', 'react-dom': '^18.2.0',
                'firebase': '^10.0.0', '@mui/material': '^5.14.0',
                'react-beautiful-dnd': '^13.1.1',
            },
            devDependencies: {},
        },
        requirementsTxt: null,
        fileTree: [
            'package.json', 'README.md',
            'src/App.jsx', 'src/index.js',
            'src/components/Board.jsx', 'src/components/Column.jsx', 'src/components/TaskCard.jsx',
            'src/components/AddTask.jsx', 'src/components/Header.jsx',
            'src/firebase/config.js',
            'src/hooks/useFirestore.js',
        ],
        lastCommitAt: '2025-07-20T10:00:00Z',
        commitCount: 23,
        htmlUrl: 'https://github.com/arjunsharma/taskflow',
    },
    {
        name: 'portfolio',
        fullName: 'arjunsharma/portfolio',
        description: 'Personal portfolio website',
        language: 'HTML',
        languages: { HTML: 5000, CSS: 8000, JavaScript: 3000 },
        stars: 0,
        forks: 0,
        topics: [],
        hasReadme: false,
        readmeContent: null,
        hasDockerfile: false,
        hasCi: false,
        hasTests: false,
        packageJson: null,
        requirementsTxt: null,
        fileTree: ['index.html', 'style.css', 'script.js', 'assets/profile.jpg'],
        lastCommitAt: '2025-05-10T10:00:00Z',
        commitCount: 8,
        htmlUrl: 'https://github.com/arjunsharma/portfolio',
    },
    {
        name: 'cpp-dsa',
        fullName: 'arjunsharma/cpp-dsa',
        description: 'Data Structures and Algorithms practice in C++',
        language: 'C++',
        languages: { 'C++': 35000 },
        stars: 0,
        forks: 0,
        topics: ['dsa', 'competitive-programming'],
        hasReadme: true,
        readmeContent: '# DSA Practice\nMy solutions to various DSA problems.',
        hasDockerfile: false,
        hasCi: false,
        hasTests: false,
        packageJson: null,
        requirementsTxt: null,
        fileTree: [
            'README.md', 'arrays/two_sum.cpp', 'arrays/max_subarray.cpp',
            'linked_list/reverse.cpp', 'trees/bst.cpp', 'graphs/bfs.cpp',
            'dp/fibonacci.cpp', 'dp/knapsack.cpp',
            'sorting/merge_sort.cpp', 'sorting/quick_sort.cpp',
        ],
        lastCommitAt: '2025-08-01T10:00:00Z',
        commitCount: 65,
        htmlUrl: 'https://github.com/arjunsharma/cpp-dsa',
    },
];
exports.DEMO_EVIDENCE = [
    // JavaScript evidence
    { skill: 'javascript', evidenceType: 'language_usage', source: 'github.repository.washease', detail: 'JavaScript used in washease (45.0 KB)', confidence: 0.9, metadata: { repository: 'washease', bytes: 45000 } },
    { skill: 'javascript', evidenceType: 'language_usage', source: 'github.repository.taskflow', detail: 'JavaScript used in taskflow (22.0 KB)', confidence: 0.85, metadata: { repository: 'taskflow', bytes: 22000 } },
    // React evidence
    { skill: 'react', evidenceType: 'dependency', source: 'github.repository.washease.package.json', detail: 'react dependency detected in washease', confidence: 0.7, metadata: { repository: 'washease' } },
    { skill: 'react', evidenceType: 'source_code', source: 'github.repository.washease.source_files', detail: '15 React component file(s) detected in washease', confidence: 0.9, metadata: { repository: 'washease', componentCount: 15 } },
    { skill: 'react', evidenceType: 'dependency', source: 'github.repository.taskflow.package.json', detail: 'react dependency detected in taskflow', confidence: 0.7, metadata: { repository: 'taskflow' } },
    { skill: 'react', evidenceType: 'source_code', source: 'github.repository.taskflow.source_files', detail: '5 React component file(s) detected in taskflow', confidence: 0.75, metadata: { repository: 'taskflow', componentCount: 5 } },
    // Node.js evidence
    { skill: 'node.js', evidenceType: 'source_code', source: 'github.repository.washease.source_files', detail: 'Express server with routes and middleware in washease', confidence: 0.8, metadata: { repository: 'washease' } },
    { skill: 'express', evidenceType: 'source_code', source: 'github.repository.washease.source_files', detail: 'Express routes and middleware detected in washease', confidence: 0.8, metadata: { repository: 'washease' } },
    { skill: 'rest api', evidenceType: 'source_code', source: 'github.repository.washease.source_files', detail: '3 API route files detected in washease', confidence: 0.75, metadata: { repository: 'washease' } },
    // MongoDB evidence
    { skill: 'mongodb', evidenceType: 'source_code', source: 'github.repository.washease.source_files', detail: 'Mongoose models detected in washease', confidence: 0.8, metadata: { repository: 'washease' } },
    // Tailwind
    { skill: 'tailwind', evidenceType: 'dependency', source: 'github.repository.washease.package.json', detail: 'tailwindcss dependency detected in washease', confidence: 0.7, metadata: { repository: 'washease' } },
    // Firebase
    { skill: 'firebase', evidenceType: 'dependency', source: 'github.repository.taskflow.package.json', detail: 'firebase dependency detected in taskflow', confidence: 0.7, metadata: { repository: 'taskflow' } },
    { skill: 'firebase', evidenceType: 'source_code', source: 'github.repository.taskflow.source_files', detail: 'Firebase configuration and hooks in taskflow', confidence: 0.75, metadata: { repository: 'taskflow' } },
    // C++ evidence
    { skill: 'c++', evidenceType: 'language_usage', source: 'github.repository.cpp-dsa', detail: 'C++ used in cpp-dsa (35.0 KB)', confidence: 0.85, metadata: { repository: 'cpp-dsa', bytes: 35000 } },
    // Git evidence
    { skill: 'git', evidenceType: 'configuration', source: 'github.profile', detail: '4 repositories with active commit history', confidence: 0.9, metadata: {} },
    // HTML/CSS
    { skill: 'html', evidenceType: 'language_usage', source: 'github.repository.portfolio', detail: 'HTML used in portfolio', confidence: 0.7, metadata: { repository: 'portfolio' } },
    { skill: 'css', evidenceType: 'language_usage', source: 'github.repository.portfolio', detail: 'CSS used in portfolio', confidence: 0.7, metadata: { repository: 'portfolio' } },
    // Authentication evidence (partial)
    { skill: 'authentication', evidenceType: 'source_code', source: 'github.repository.washease.source_files', detail: 'Auth middleware and context detected in washease', confidence: 0.7, metadata: { repository: 'washease' } },
];
exports.DEMO_JOB_DESCRIPTION = `Frontend Developer Intern

Company: TechCorp Solutions, Bangalore

About the role:
We are looking for a passionate Frontend Developer Intern to join our engineering team. You will work on building modern web applications using React and TypeScript.

Requirements:
- Strong proficiency in JavaScript and TypeScript
- Experience with React.js and its ecosystem (hooks, context, routing)
- Familiarity with RESTful APIs and modern authentication
- Understanding of responsive web design
- Experience with version control (Git)
- Knowledge of CSS frameworks (Tailwind CSS or similar)
- Understanding of web performance optimization
- Basic knowledge of Node.js and backend concepts
- Knowledge of data structures and algorithms

Nice to have:
- Experience with Next.js
- Familiarity with testing frameworks (Jest, Cypress)
- Experience with cloud services (AWS, Firebase)
- Docker and CI/CD knowledge
- Experience with Agile methodologies

Qualifications:
- B.Tech/B.E. in Computer Science or related field (2025-2027 batch)
- Strong problem-solving skills
- Good communication skills
- Team player with willingness to learn`;
exports.DEMO_PARSED_JOB = {
    title: 'Frontend Developer Intern',
    company: 'TechCorp Solutions',
    required: {
        languages: ['javascript', 'typescript', 'css'],
        frameworks: ['react', 'node.js', 'tailwind'],
        tools: ['git', 'rest api'],
        databases: [],
        cloud: [],
        csFundamentals: ['data structures', 'algorithms'],
        experience: [],
        qualifications: ['B.Tech in Computer Science'],
    },
    preferred: {
        technologies: ['next.js'],
        cloud: ['aws', 'firebase'],
        databases: [],
        testing: ['jest', 'cypress'],
        deployment: ['docker', 'ci/cd'],
    },
    softSkills: ['communication', 'problem solving', 'teamwork'],
    allRequirements: ['javascript', 'typescript', 'css', 'react', 'node.js', 'tailwind', 'git', 'rest api'],
    dataQuality: 'COMPLETE',
    sufficientTechnicalDetail: true,
};
//# sourceMappingURL=demoData.js.map