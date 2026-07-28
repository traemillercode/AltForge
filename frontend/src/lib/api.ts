const API_BASE = "/api";

interface ApiError {
  error: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new ApiClientError(
      (body as ApiError).error || `Request failed with status ${res.status}`,
      res.status
    );
  }
  return res.json() as Promise<T>;
}

export class ApiClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
  }
}

export interface User {
  id: string;
  email: string;
  credits: number;
}

// Job types
export type JobType = "csv" | "crawl" | "images";
export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  total_images: number;
  processed_images: number;
  source_url: string | null;
  source_filename: string | null;
  created_at: string;
  completed_at: string | null;
}

export type ResultStatus = "compliant" | "needs_review" | "decorative";

export interface JobResult {
  id: string;
  job_id: string;
  image_url: string;
  alt_text: string | null;
  char_count: number;
  status: ResultStatus;
  context_text: string | null;
  created_at: string;
}

export interface CsvUploadResponse {
  job: Job;
  results: JobResult[];
  stats: {
    validUrls: number;
    invalidCount: number;
    totalRows: number;
    costEstimate: number;
  };
}

export interface ImageUploadResponse {
  job: Job;
  results: JobResult[];
  stats: {
    imagesFound: number;
    invalidCount: number;
    totalSizeBytes: number;
    costEstimate: number;
  };
}

export interface JobProgress {
  status: string;
  processed_images: number;
  total_images: number;
}

export interface ProcessJobResponse {
  job: Job;
  results: JobResult[];
}

export const api = {
  async signup(email: string, password: string): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    return handleResponse<{ user: User }>(res);
  },

  async login(email: string, password: string): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    return handleResponse<{ user: User }>(res);
  },

  async me(): Promise<{ user: User }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      credentials: "include",
    });
    return handleResponse<{ user: User }>(res);
  },

  async logout(): Promise<void> {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  },

  // Job endpoints
  async uploadCsv(file: File): Promise<CsvUploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_BASE}/jobs/csv`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    return handleResponse<CsvUploadResponse>(res);
  },

  async uploadImages(files: File[]): Promise<ImageUploadResponse> {
    const formData = new FormData();
    for (const f of files) {
      formData.append("images", f);
    }
    const res = await fetch(`${API_BASE}/jobs/images`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    return handleResponse<ImageUploadResponse>(res);
  },

  async getJobs(): Promise<{ jobs: Job[] }> {
    const res = await fetch(`${API_BASE}/jobs`, {
      credentials: "include",
    });
    return handleResponse<{ jobs: Job[] }>(res);
  },

  async getJob(id: string): Promise<{ job: Job; results: JobResult[] }> {
    const res = await fetch(`${API_BASE}/jobs/${encodeURIComponent(id)}`, {
      credentials: "include",
    });
    return handleResponse<{ job: Job; results: JobResult[] }>(res);
  },

  async processJob(id: string): Promise<ProcessJobResponse> {
    const res = await fetch(`${API_BASE}/jobs/${encodeURIComponent(id)}/process`, {
      method: "POST",
      credentials: "include",
    });
    return handleResponse<ProcessJobResponse>(res);
  },

  async getJobProgress(id: string): Promise<JobProgress> {
    const res = await fetch(`${API_BASE}/jobs/${encodeURIComponent(id)}/progress`, {
      credentials: "include",
    });
    return handleResponse<JobProgress>(res);
  },

  async updateResult(
    jobId: string,
    resultId: string,
    altText: string
  ): Promise<{ id: string; alt_text: string; char_count: number; status: string }> {
    const res = await fetch(
      `${API_BASE}/jobs/${encodeURIComponent(jobId)}/results/${encodeURIComponent(resultId)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ alt_text: altText }),
      }
    );
    return handleResponse<{ id: string; alt_text: string; char_count: number; status: string }>(res);
  },

  getExportUrl(jobId: string, format: "csv" | "html"): string {
    return `${API_BASE}/jobs/${encodeURIComponent(jobId)}/export?format=${format}`;
  },
};
