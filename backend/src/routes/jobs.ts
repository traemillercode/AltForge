import { Hono } from "hono";
import type { Context } from "hono";
import type { Database } from "bun:sqlite";
import Papa from "papaparse";
import { authMiddleware } from "../middleware/auth.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_URLS = 5000;

const URL_COLUMN_NAMES = ["url", "image_url", "image", "src", "link", "img_url", "imageurl"];

function getUserId(c: Context): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (c as any).get("userId") as string;
}

function findUrlColumn(headers: string[]): number {
  // Try to find a column by name (case-insensitive)
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  for (const name of URL_COLUMN_NAMES) {
    const idx = lowerHeaders.indexOf(name);
    if (idx >= 0) return idx;
  }
  // Fall back to the first column
  return 0;
}

function isValidUrl(str: string): boolean {
  const trimmed = str.trim();
  if (!trimmed) return false;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function jobsRoutes(db: Database): Hono {
  const router = new Hono();

  // All routes require auth
  router.use("/*", authMiddleware);

  // POST /api/jobs/csv — upload CSV and create job
  router.post("/csv", async (c) => {
    const userId = getUserId(c);

    // Parse multipart form
    const formData = await c.req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return c.json({ error: "CSV file is required" }, 400);
    }

    // Validate file type
    const filename = file.name.toLowerCase();
    if (!filename.endsWith(".csv")) {
      return c.json({ error: "Only .csv files are accepted" }, 400);
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: "File size exceeds 10MB limit" }, 400);
    }

    // Read file content
    const csvText = await file.text();

    // Parse CSV
    const parseResult = Papa.parse<string[]>(csvText, {
      skipEmptyLines: true,
      header: false,
    });

    if (parseResult.errors.length > 0 && parseResult.data.length === 0) {
      return c.json({ error: "Could not parse CSV file" }, 400);
    }

    const rows = parseResult.data;

    if (rows.length === 0) {
      return c.json({ error: "CSV file is empty" }, 400);
    }

    // Find URL column
    const headers = rows[0] as string[];
    const hasHeaders = headers.some((h) => URL_COLUMN_NAMES.includes(h.toLowerCase().trim()));
    const urlColumnIdx = hasHeaders ? findUrlColumn(headers) : 0;
    const dataStartIdx = hasHeaders ? 1 : 0;

    // Extract URLs
    const validUrls: string[] = [];
    let invalidCount = 0;

    for (let i = dataStartIdx; i < rows.length; i++) {
      const row = rows[i] as string[];
      if (!row || row.length <= urlColumnIdx) {
        invalidCount++;
        continue;
      }
      const rawUrl = row[urlColumnIdx]?.trim();
      if (!rawUrl) {
        invalidCount++;
        continue;
      }
      if (isValidUrl(rawUrl)) {
        validUrls.push(rawUrl);
      } else {
        invalidCount++;
      }
    }

    if (validUrls.length === 0) {
      return c.json({
        error: "No valid image URLs found in CSV",
        invalidCount,
      }, 400);
    }

    if (validUrls.length > MAX_URLS) {
      return c.json({
        error: `Too many URLs. Maximum is ${MAX_URLS} per CSV. Found ${validUrls.length}.`,
      }, 400);
    }

    // Create job
    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO jobs (id, user_id, type, status, total_images, source_filename, created_at)
       VALUES (?, ?, 'csv', 'pending', ?, ?, ?)`,
      [jobId, userId, validUrls.length, file.name, now]
    );

    // Create results rows
    const insertResult = db.prepare(
      `INSERT INTO results (id, job_id, image_url, status, created_at)
       VALUES (?, ?, ?, 'needs_review', ?)`
    );

    const insertResults = db.transaction(() => {
      for (const url of validUrls) {
        insertResult.run(crypto.randomUUID(), jobId, url, now);
      }
    });

    insertResults();

    // Fetch the created job with results
    const job = db.query(
      `SELECT id, user_id, type, status, total_images, processed_images,
              source_url, source_filename, created_at, completed_at
       FROM jobs WHERE id = ?`
    ).get(jobId) as Record<string, unknown> | undefined;

    const results = db.query(
      `SELECT id, job_id, image_url, alt_text, char_count, status, context_text, created_at
       FROM results WHERE job_id = ? ORDER BY created_at`
    ).all(jobId) as Record<string, unknown>[];

    return c.json({
      job: { ...job, user_id: undefined },
      results,
      stats: {
        validUrls: validUrls.length,
        invalidCount,
        totalRows: rows.length - dataStartIdx,
        costEstimate: validUrls.length,
      },
    }, 201);
  });

  // GET /api/jobs — list all jobs for the user
  router.get("/", (c) => {
    const userId = getUserId(c);

    const jobs = db.query(
      `SELECT id, type, status, total_images, processed_images,
              source_url, source_filename, created_at, completed_at
       FROM jobs
       WHERE user_id = ?
       ORDER BY created_at DESC`
    ).all(userId) as Record<string, unknown>[];

    return c.json({ jobs });
  });

  // GET /api/jobs/:id — get a single job with results
  router.get("/:id", (c) => {
    const userId = getUserId(c);
    const jobId = c.req.param("id");

    const job = db.query(
      `SELECT id, type, status, total_images, processed_images,
              source_url, source_filename, created_at, completed_at
       FROM jobs WHERE id = ? AND user_id = ?`
    ).get(jobId, userId) as Record<string, unknown> | undefined;

    if (!job) {
      return c.json({ error: "Job not found" }, 404);
    }

    const results = db.query(
      `SELECT id, job_id, image_url, alt_text, char_count, status, context_text, created_at
       FROM results WHERE job_id = ? ORDER BY created_at`
    ).all(jobId) as Record<string, unknown>[];

    return c.json({ job, results });
  });

  return router;
}
