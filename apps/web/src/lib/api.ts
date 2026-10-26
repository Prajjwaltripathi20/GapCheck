const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private token: string | null = null;
  public baseUrl: string = API_URL;

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('gapcheck_token') || localStorage.getItem('proofcheck_token');
    }
  }

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('gapcheck_token', token);
      localStorage.setItem('proofcheck_token', token);
      window.dispatchEvent(new Event('storage'));
    }
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('gapcheck_token');
      localStorage.removeItem('proofcheck_token');
      window.dispatchEvent(new Event('storage'));
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('gapcheck_token') || localStorage.getItem('proofcheck_token');
    }
    return this.token;
  }

  private async request<T = Record<string, unknown>>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't set Content-Type for FormData
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        this.clearToken();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = '/login?expired=true';
        }
      }
      throw new Error(data.message || data.error?.message || data.error || `Request failed: ${response.status}`);
    }

    return data as T;
  }

  // Auth
  async register(email: string, password: string, name: string) {
    const data = await this.request<{ token: string; user: Record<string, unknown> }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    this.setToken(data.token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request<{ token: string; user: Record<string, unknown> }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async loginDemo() {
    const data = await this.request<{ token: string; user: Record<string, unknown>; isDemo: boolean }>('/api/auth/demo', { method: 'POST' });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.request<{ user: Record<string, unknown> }>('/api/auth/me');
  }

  async updateProfile(data: { name?: string; targetRole?: string }) {
    return this.request<{ user: Record<string, unknown> }>('/api/auth/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Resume
  async uploadResume(file: File) {
    const formData = new FormData();
    formData.append('resume', file);
    return this.request<{ resumeId: string; resume: Record<string, unknown>; claims: unknown[] }>('/api/resume/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async submitResumeText(text: string, title?: string) {
    return this.request<{
      resumeId: string;
      filename: string;
      skills: Record<string, string[]>;
      education: unknown[];
      projects: unknown[];
      claims: unknown[];
    }>('/api/resume/text', {
      method: 'POST',
      body: JSON.stringify({ text, title }),
    });
  }

  async getResumes() {
    return this.request<{ resumes: Record<string, unknown>[] }>('/api/resume');
  }

  // GitHub
  async connectGitHub(username: string) {
    return this.request<{ account: Record<string, unknown>; profile: Record<string, unknown> }>('/api/github/connect', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  }

  async analyzeGitHub() {
    return this.request<{ repositoriesCount: number; evidenceCount: number }>('/api/github/analyze', { method: 'POST' });
  }

  async getRepos() {
    return this.request<{ repositories: Record<string, unknown>[] }>('/api/github/repos');
  }

  async getEvidence() {
    return this.request<{ evidence: Record<string, unknown>[] }>('/api/github/evidence');
  }

  // Job Description
  async analyzeJob(text: string, title?: string) {
    return this.request<{ jobDescription: Record<string, unknown> }>('/api/job/analyze', {
      method: 'POST',
      body: JSON.stringify({ text, title }),
    });
  }

  // Analysis
  async startAnalysis(params: {
    resumeId?: string;
    resumeText?: string;
    githubUsername?: string;
    jobDescriptionId?: string;
    jobDescriptionText?: string;
    targetRole?: string;
    company?: string;
    isDemo?: boolean;
  }) {
    return this.request<{ analysisId: string; analysis: { id: string; status: string } }>('/api/analysis/start', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getAnalysis(id: string) {
    return this.request<{ analysis: Record<string, unknown> }>(`/api/analysis/${id}`);
  }

  async getAnalysisResults(id: string) {
    return this.request<{
      analysis: Record<string, unknown>;
      findings: Record<string, unknown>[];
      recommendations: Record<string, unknown>[];
      actionPlan: Record<string, unknown>[];
    }>(`/api/analysis/${id}/results`);
  }

  async getAnalyses() {
    return this.request<{ analyses: Record<string, unknown>[] }>('/api/analysis');
  }

  async rescanAnalysis(id: string) {
    return this.request<{
      previousAnalysisId: string;
      newAnalysisId: string;
      delta: {
        repositoriesAdded: number;
        repositoriesRemoved: number;
        repositoriesChanged: number;
        readmesAdded: number;
        claimsNewlySupported: number;
        claimsNoLongerSupported: number;
      };
      analysis: { id: string; status: string };
    }>(`/api/analysis/${id}/rescan`, {
      method: 'POST',
    });
  }

  async retryAnalysis(id: string) {
    return this.request<{
      analysisId: string;
      status: string;
      message: string;
    }>(`/api/analysis/${id}/retry`, {
      method: 'POST',
    });
  }

  // Dashboard
  async getDashboard(analysisId?: string) {
    const query = analysisId ? `?analysisId=${encodeURIComponent(analysisId)}` : '';
    return this.request<{
      user: Record<string, unknown>;
      hasAnalysis: boolean;
      latestAnalysis: Record<string, unknown> | null;
      findings?: Record<string, unknown>[];
      recommendations?: Record<string, unknown>[];
      actionPlan?: Record<string, unknown>[];
      progressHistory?: Record<string, unknown>[];
      repositories?: Record<string, unknown>[];
      stats?: {
        totalSkills: number;
        verifiedSkills: number;
        unverifiedSkills: number;
        weakSkills: number;
        totalRecommendations: number;
        criticalIssues: number;
        highIssues: number;
        repositoriesAnalyzed: number;
      };
    }>(`/api/dashboard${query}`);
  }

  async toggleActionItem(id: string, completed?: boolean) {
    return this.request<{ actionItem: Record<string, unknown> }>(`/api/dashboard/action-item/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    });
  }

  async downloadAuditReport(analysisId: string, filename = 'GapCheck_Audit_Report.pdf') {
    const url = `${this.baseUrl}/api/analysis/${analysisId}/report.pdf`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
    if (!response.ok) throw new Error('Failed to download PDF audit report');
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }

  async downloadAnnotatedResume(analysisId: string, filename = 'GapCheck_Annotated_Resume.pdf') {
    const url = `${this.baseUrl}/api/analysis/${analysisId}/annotated-resume.pdf`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
      },
    });
    if (!response.ok) throw new Error('Failed to download annotated resume');
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }

  async getProgress() {
    return this.request<{ hasComparison: boolean; current?: Record<string, unknown>; previous?: Record<string, unknown>; changes?: Record<string, unknown>; snapshots: Record<string, unknown>[] }>('/api/dashboard/progress');
  }

  logout() {
    this.clearToken();
  }
}

export const api = new ApiClient();
export default api;
