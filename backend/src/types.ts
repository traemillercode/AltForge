export interface User {
  id: string;
  email: string;
  credits: number;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  credits: number;
  created_at: string;
}

export interface Job {
  id: string;
  user_id: string;
  type: "csv" | "crawl" | "images";
  status: "pending" | "processing" | "completed" | "failed";
  total_images: number;
  processed_images: number;
  source_url: string | null;
  source_filename: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface Result {
  id: string;
  job_id: string;
  image_url: string;
  alt_text: string | null;
  char_count: number;
  status: "compliant" | "needs_review" | "decorative";
  context_text: string | null;
  created_at: string;
}

export interface Session {
  userId: string;
  token: string;
  createdAt: number;
}
