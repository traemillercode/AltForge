import { Hono } from "hono";
import type { Context } from "hono";
import type { Database } from "bun:sqlite";
import Papa from "papaparse";
import AdmZip from "adm-zip";
import { authMiddleware } from "../middleware/auth.js";
import { crawlSite } from "../crawler.js";
import { generateAltText, requireApiKey } from "../ai.js";
import { sendEmail } from "../email.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_TOTAL_UPLOAD = 50 * 1024 * 1024; // 50MB
const MAX_IMAGES = 500;
const MAX_FILES = 50;
const MAX_URLS = 5000;

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

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

function isImageFile(name: string, type: string): boolean {
  // Check by MIME type first, then extension
  if (IMAGE_MIME_TYPES.has(type)) return true;
  const ext = name.toLowerCase().substring(name.lastIndexOf("."));
  return IMAGE_EXTENSIONS.has(ext);
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
      `SELECT id, job_id, image_url, alt_text, char_count, status, context_text, source_page_url, created_at
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

  // POST /api/jobs/crawl — crawl a website for images
  router.post("/crawl", async (c) => {
    const userId = getUserId(c);

    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.url !== "string" || !body.url.trim()) {
      return c.json({ error: "A valid URL is required" }, 400);
    }

    const url = body.url.trim();

    // Validate URL format
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return c.json({ error: "URL must use http or https protocol" }, 400);
      }
    } catch {
      return c.json({ error: "Invalid URL format" }, 400);
    }

    // Run the crawl
    const crawlResult = await crawlSite(url);

    // If the URL was disallowed or completely failed
    if (crawlResult.errors.length > 0 && crawlResult.images.length === 0) {
      const disallowedErr = crawlResult.errors.find((e) => e.includes("disallowed"));
      if (disallowedErr) {
        return c.json({ error: disallowedErr }, 403);
      }
    }

    // Check limits
    if (crawlResult.stats.imagesFound > 1000 && crawlResult.stats.imagesAdded === 0 && crawlResult.stats.imagesSkipped > 1000) {
      return c.json({
        error: "Too many images found on the site. The 1,000 image maximum was exceeded before finding any images needing alt text. Try crawling a more specific URL.",
      }, 400);
    }

    // Create job
    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.run(
      `INSERT INTO jobs (id, user_id, type, status, total_images, source_url, created_at)
       VALUES (?, ?, 'crawl', 'pending', ?, ?, ?)`,
      [jobId, userId, crawlResult.stats.imagesAdded, url, now]
    );

    // Create results rows for images that need alt text
    if (crawlResult.images.length > 0) {
      const insertResult = db.prepare(
        `INSERT INTO results (id, job_id, image_url, status, alt_text, context_text, source_page_url, created_at)
         VALUES (?, ?, ?, 'needs_review', ?, ?, ?, ?)`
      );

      const insertResults = db.transaction(() => {
        for (const img of crawlResult.images) {
          insertResult.run(
            crypto.randomUUID(),
            jobId,
            img.url,
            img.altText,
            img.contextText,
            img.sourcePageUrl,
            now
          );
        }
      });

      insertResults();
    }

    // Store skipped images
    if (crawlResult.stats.skippedImages.length > 0) {
      const insertSkipped = db.prepare(
        `INSERT INTO skipped_results (job_id, image_url, source_page_url, existing_alt_text, created_at)
         VALUES (?, ?, ?, ?, ?)`
      );

      const insertAllSkipped = db.transaction(() => {
        for (const skipped of crawlResult.stats.skippedImages) {
          insertSkipped.run(
            jobId,
            skipped.url,
            skipped.sourcePageUrl,
            skipped.altText,
            now
          );
        }
      });

      insertAllSkipped();
    }

    // Fetch created job with results
    const job = db.query(
      `SELECT id, user_id, type, status, total_images, processed_images,
              source_url, source_filename, created_at, completed_at
       FROM jobs WHERE id = ?`
    ).get(jobId) as Record<string, unknown> | undefined;

    const results = db.query(
      `SELECT id, job_id, image_url, alt_text, char_count, status, context_text, source_page_url, created_at
       FROM results WHERE job_id = ? ORDER BY created_at`
    ).all(jobId) as Record<string, unknown>[];

    return c.json({
      job: { ...job, user_id: undefined },
      results,
      stats: {
        pagesFound: crawlResult.stats.pagesFound,
        pagesCrawled: crawlResult.stats.pagesCrawled,
        pagesFailed: crawlResult.stats.pagesFailed,
        imagesFound: crawlResult.stats.imagesFound,
        imagesSkipped: crawlResult.stats.imagesSkipped,
        imagesAdded: crawlResult.stats.imagesAdded,
        crawledPages: crawlResult.stats.crawledPages,
        skippedImages: crawlResult.stats.skippedImages,
        costEstimate: crawlResult.stats.imagesAdded,
        errors: crawlResult.errors.slice(0, 10),
      },
    }, 201);
  });

  // POST /api/jobs/images — direct image upload (multi-file or zip)
  router.post("/images", async (c) => {
    const userId = getUserId(c);

    const formData = await c.req.formData();

    // Collect all "images" fields (multi-file) and "file" field (zip)
    const imageFiles: File[] = [];
    let zipFile: File | null = null;
    let totalSize = 0;

    for (const [, value] of formData.entries()) {
      // FormDataEntryValue can be string or File; check for File-like objects
      if (value && typeof value === "object" && "name" in value && "arrayBuffer" in value) {
        const file = value as unknown as File;
        if (file.name.toLowerCase().endsWith(".zip")) {
          zipFile = file;
        } else {
          imageFiles.push(file);
        }
        totalSize += file.size;
      }
    }

    // Must have either image files or a zip
    if (imageFiles.length === 0 && !zipFile) {
      return c.json({ error: "No image files or zip file provided. Upload images (.jpg, .png, .webp, .gif) or a .zip file." }, 400);
    }

    // Validate total size
    if (totalSize > MAX_TOTAL_UPLOAD) {
      return c.json({ error: `Total upload size ${(totalSize / 1024 / 1024).toFixed(1)}MB exceeds maximum ${MAX_TOTAL_UPLOAD / 1024 / 1024}MB` }, 400);
    }

    const extractedImages: { name: string; data: Buffer; size: number }[] = [];
    let invalidCount = 0;

    if (zipFile) {
      // Validate zip file
      if (zipFile.size > MAX_TOTAL_UPLOAD) {
        return c.json({
          error: `Zip file size ${(zipFile.size / 1024 / 1024).toFixed(1)}MB exceeds maximum ${MAX_TOTAL_UPLOAD / 1024 / 1024}MB`,
        }, 400);
      }

      // Extract zip in memory
      let zip: AdmZip;
      try {
        const zipBuffer = Buffer.from(await zipFile.arrayBuffer());
        zip = new AdmZip(zipBuffer);
      } catch {
        return c.json({ error: "Could not read zip file. Ensure it's a valid .zip archive." }, 400);
      }

      const entries = zip.getEntries();
      const seenNames = new Set<string>();

      for (const entry of entries) {
        if (entry.isDirectory) continue;

        const name = entry.entryName.split("/").pop() || entry.entryName;
        const lowerName = name.toLowerCase();

        // Check extension
        const ext = lowerName.substring(lowerName.lastIndexOf("."));
        if (!IMAGE_EXTENSIONS.has(ext)) {
          invalidCount++;
          continue;
        }

        // Deduplicate
        const dedupKey = lowerName;
        if (seenNames.has(dedupKey)) continue;
        seenNames.add(dedupKey);

        // Size check
        const data = entry.getData();
        if (data.length > MAX_FILE_SIZE) {
          invalidCount++;
          continue;
        }

        // Cap at MAX_IMAGES
        if (extractedImages.length >= MAX_IMAGES) break;

        extractedImages.push({ name, data: Buffer.from(data), size: data.length });
      }
    } else {
      // Multi-file upload
      if (imageFiles.length > MAX_FILES) {
        return c.json({
          error: `Too many files. Maximum is ${MAX_FILES} files per upload. Received ${imageFiles.length}.`,
        }, 400);
      }

      const seenNames = new Set<string>();

      for (const file of imageFiles) {
        // Validate file type
        if (!isImageFile(file.name, file.type)) {
          invalidCount++;
          continue;
        }

        // Validate size
        if (file.size > MAX_FILE_SIZE) {
          invalidCount++;
          continue;
        }

        // Deduplicate
        const dedupKey = file.name.toLowerCase();
        if (seenNames.has(dedupKey)) continue;
        seenNames.add(dedupKey);

        // Cap at MAX_IMAGES
        if (extractedImages.length >= MAX_IMAGES) break;

        const buf = Buffer.from(await file.arrayBuffer());
        extractedImages.push({ name: file.name, data: buf, size: file.size });
      }
    }

    if (extractedImages.length === 0) {
      return c.json({
        error: "No valid images found. Supported formats: .jpg, .jpeg, .png, .webp, .gif (max 10MB each).",
        invalidCount,
      }, 400);
    }

    // Create job
    const jobId = crypto.randomUUID();
    const now = new Date().toISOString();
    const sourceName = zipFile ? zipFile.name : "direct-upload";

    db.run(
      `INSERT INTO jobs (id, user_id, type, status, total_images, source_filename, created_at)
       VALUES (?, ?, 'images', 'pending', ?, ?, ?)`,
      [jobId, userId, extractedImages.length, sourceName, now]
    );

    // Create results rows — for direct uploads, image_url is a data URI
    const insertResult = db.prepare(
      `INSERT INTO results (id, job_id, image_url, status, created_at)
       VALUES (?, ?, ?, 'needs_review', ?)`
    );

    const insertResults = db.transaction(() => {
      for (const img of extractedImages) {
        // Store as a data URI so the AI can process it
        const ext = img.name.toLowerCase().substring(img.name.lastIndexOf("."));
        const mimeType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
          : ext === ".png" ? "image/png"
          : ext === ".webp" ? "image/webp"
          : "image/gif";
        const dataUri = `data:${mimeType};base64,${img.data.toString("base64")}`;
        insertResult.run(crypto.randomUUID(), jobId, dataUri, now);
      }
    });

    insertResults();

    // Fetch created job with results
    const job = db.query(
      `SELECT id, user_id, type, status, total_images, processed_images,
              source_url, source_filename, created_at, completed_at
       FROM jobs WHERE id = ?`
    ).get(jobId) as Record<string, unknown> | undefined;

    const results = db.query(
      `SELECT id, job_id, image_url, alt_text, char_count, status, context_text, source_page_url, created_at
       FROM results WHERE job_id = ? ORDER BY created_at`
    ).all(jobId) as Record<string, unknown>[];

    return c.json({
      job: { ...job, user_id: undefined },
      results,
      stats: {
        imagesFound: extractedImages.length,
        invalidCount,
        totalSizeBytes: extractedImages.reduce((s, i) => s + i.size, 0),
        costEstimate: extractedImages.length,
      },
    }, 201);
  });

  // POST /api/jobs/:id/process — start AI alt-text processing
  router.post("/:id/process", async (c) => {
    const userId = getUserId(c);
    const jobId = c.req.param("id");

    // Validate OPENAI_API_KEY is set
    let apiKey: string;
    try {
      apiKey = requireApiKey();
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }

    // Load job and verify ownership + status
    const job = db.query(
      `SELECT id, user_id, type, status, total_images, processed_images,
              source_url, source_filename, created_at, completed_at
       FROM jobs WHERE id = ? AND user_id = ?`
    ).get(jobId, userId) as Record<string, unknown> | undefined;

    if (!job) {
      return c.json({ error: "Job not found" }, 404);
    }

    if (job.status !== "pending") {
      return c.json({
        error: `Job cannot be processed. Current status: ${job.status}`,
        status: job.status,
      }, 409);
    }

    const totalImages = job.total_images as number;

    // Check user credits
    const user = db.query("SELECT credits FROM users WHERE id = ?")
      .get(userId) as { credits: number } | undefined;

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    if (user.credits < totalImages) {
      return c.json({
        error: `Insufficient credits. You have ${user.credits} credits but need ${totalImages}.`,
        creditsNeeded: totalImages - user.credits,
        currentCredits: user.credits,
      }, 402);
    }

    // Mark job as processing
    db.run("UPDATE jobs SET status = 'processing' WHERE id = ?", [jobId]);

    // Load results that need processing (status = 'needs_review')
    const resultsToProcess = db.query(
      `SELECT id, job_id, image_url, alt_text, char_count, status, context_text, source_page_url, created_at
       FROM results WHERE job_id = ? AND status = 'needs_review'
       ORDER BY created_at`
    ).all(jobId) as Record<string, unknown>[];

    // Start processing in the background (non-blocking)
    processJobInBackground(db, jobId, userId, resultsToProcess, apiKey);

    // Return the job in processing state immediately
    const updatedJob = db.query(
      `SELECT id, type, status, total_images, processed_images,
              source_url, source_filename, created_at, completed_at
       FROM jobs WHERE id = ?`
    ).get(jobId) as Record<string, unknown>;

    const allResults = db.query(
      `SELECT id, job_id, image_url, alt_text, char_count, status, context_text, source_page_url, created_at
       FROM results WHERE job_id = ? ORDER BY created_at`
    ).all(jobId) as Record<string, unknown>[];

    return c.json({ job: updatedJob, results: allResults });
  });

  // GET /api/jobs/:id/progress — lightweight polling endpoint
  router.get("/:id/progress", (c) => {
    const userId = getUserId(c);
    const jobId = c.req.param("id");

    const job = db.query(
      `SELECT status, total_images, processed_images
       FROM jobs WHERE id = ? AND user_id = ?`
    ).get(jobId, userId) as Record<string, unknown> | undefined;

    if (!job) {
      return c.json({ error: "Job not found" }, 404);
    }

    return c.json({
      status: job.status,
      processed_images: job.processed_images,
      total_images: job.total_images,
    });
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
      `SELECT id, job_id, image_url, alt_text, char_count, status, context_text, source_page_url, created_at
       FROM results WHERE job_id = ? ORDER BY created_at`
    ).all(jobId) as Record<string, unknown>[];

    return c.json({ job, results });
  });

  // PUT /api/jobs/:jobId/results/:resultId — update a result's alt text
  router.put("/:jobId/results/:resultId", async (c) => {
    const userId = getUserId(c);
    const jobId = c.req.param("jobId");
    const resultId = c.req.param("resultId");

    // Verify job ownership
    const job = db.query(
      `SELECT id FROM jobs WHERE id = ? AND user_id = ?`
    ).get(jobId, userId) as Record<string, unknown> | undefined;

    if (!job) {
      return c.json({ error: "Job not found" }, 404);
    }

    // Verify result belongs to job
    const result = db.query(
      `SELECT id, job_id FROM results WHERE id = ? AND job_id = ?`
    ).get(resultId, jobId) as Record<string, unknown> | undefined;

    if (!result) {
      return c.json({ error: "Result not found" }, 404);
    }

    const body = await c.req.json().catch(() => null);
    if (!body || typeof body.alt_text !== "string") {
      return c.json({ error: "alt_text is required" }, 400);
    }

    const altText = body.alt_text;
    const charCount = altText.length;

    // Determine compliance status
    let status: string;
    if (altText === "") {
      status = "decorative";
    } else if (charCount <= 125) {
      status = "compliant";
    } else if (charCount <= 250) {
      status = "compliant"; // long but still compliant
    } else {
      status = "needs_review";
    }

    db.run(
      `UPDATE results SET alt_text = ?, char_count = ?, status = ? WHERE id = ?`,
      [altText, charCount, status, resultId]
    );

    return c.json({
      id: resultId,
      alt_text: altText,
      char_count: charCount,
      status,
    });
  });

  // POST /api/jobs/:jobId/results/:resultId/regenerate — regenerate AI alt text for one image
  router.post("/:jobId/results/:resultId/regenerate", async (c) => {
    const userId = getUserId(c);
    const jobId = c.req.param("jobId");
    const resultId = c.req.param("resultId");

    // Verify job ownership
    const job = db.query(
      `SELECT id FROM jobs WHERE id = ? AND user_id = ?`
    ).get(jobId, userId) as Record<string, unknown> | undefined;

    if (!job) {
      return c.json({ error: "Job not found" }, 404);
    }

    // Load the result
    const result = db.query(
      `SELECT id, job_id, image_url, context_text FROM results WHERE id = ? AND job_id = ?`
    ).get(resultId, jobId) as Record<string, unknown> | undefined;

    if (!result) {
      return c.json({ error: "Result not found" }, 404);
    }

    // Check user credits
    const user = db.query("SELECT credits FROM users WHERE id = ?")
      .get(userId) as { credits: number } | undefined;

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    if (user.credits < 1) {
      return c.json({ error: "Insufficient credits. You need at least 1 credit to regenerate." }, 402);
    }

    // Get API key
    let apiKey: string;
    try {
      apiKey = requireApiKey();
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }

    // Deduct 1 credit
    db.run("UPDATE users SET credits = credits - 1 WHERE id = ? AND credits > 0", [userId]);

    // Call AI generation
    let altText: string;
    let status: string;
    let charCount: number;

    try {
      const generated = await generateAltText(
        result.image_url as string,
        result.context_text as string | null,
        apiKey
      );
      altText = generated.altText;
      status = generated.status;
      charCount = generated.charCount;
    } catch (err) {
      // Refund the credit on AI failure
      db.run("UPDATE users SET credits = credits + 1 WHERE id = ?", [userId]);
      return c.json({
        error: `AI generation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      }, 500);
    }

    // Update the result
    db.run(
      `UPDATE results SET alt_text = ?, char_count = ?, status = ? WHERE id = ?`,
      [altText, charCount, status, resultId]
    );

    return c.json({
      id: resultId,
      alt_text: altText,
      char_count: charCount,
      status,
    });
  });

  // GET /api/jobs/:id/skipped — get skipped images for a crawl job
  router.get("/:id/skipped", (c) => {
    const userId = getUserId(c);
    const jobId = c.req.param("id");

    // Verify job ownership
    const job = db.query(
      `SELECT id, type FROM jobs WHERE id = ? AND user_id = ?`
    ).get(jobId, userId) as Record<string, unknown> | undefined;

    if (!job) {
      return c.json({ error: "Job not found" }, 404);
    }

    if (job.type !== "crawl") {
      return c.json({ skipped: [], total: 0, page: 1, limit: 10 });
    }

    // Parse pagination params (optional; return all if not provided)
    const pageParam = c.req.query("page");
    const limitParam = c.req.query("limit");

    if (pageParam !== undefined && limitParam !== undefined) {
      const page = Math.max(1, parseInt(pageParam, 10) || 1);
      const limit = Math.max(1, Math.min(100, parseInt(limitParam, 10) || 10));
      const offset = (page - 1) * limit;

      const totalRow = db.query(
        `SELECT COUNT(*) as count FROM skipped_results WHERE job_id = ?`
      ).get(jobId) as { count: number };
      const total = totalRow.count;

      const skipped = db.query(
        `SELECT id, job_id, image_url, source_page_url, existing_alt_text, created_at
         FROM skipped_results WHERE job_id = ? ORDER BY id LIMIT ? OFFSET ?`
      ).all(jobId, limit, offset) as Record<string, unknown>[];

      const mapped = skipped.map((s) => ({
        id: s.id,
        job_id: s.job_id,
        image_url: s.image_url,
        source_page_url: s.source_page_url,
        existing_alt_text: s.existing_alt_text,
        created_at: s.created_at,
      }));

      return c.json({ skipped: mapped, total, page, limit });
    }

    // No pagination — return all (backward compatible)
    const skipped = db.query(
      `SELECT id, job_id, image_url, source_page_url, existing_alt_text, created_at
       FROM skipped_results WHERE job_id = ? ORDER BY id`
    ).all(jobId) as Record<string, unknown>[];

    const mapped = skipped.map((s) => ({
      id: s.id,
      job_id: s.job_id,
      image_url: s.image_url,
      source_page_url: s.source_page_url,
      existing_alt_text: s.existing_alt_text,
      created_at: s.created_at,
    }));

    return c.json({ skipped: mapped, total: mapped.length, page: 1, limit: mapped.length });
  });

  // POST /api/jobs/:id/skipped/:skippedId/generate — generate alt text for a skipped image
  router.post("/:id/skipped/:skippedId/generate", async (c) => {
    const userId = getUserId(c);
    const jobId = c.req.param("id");
    const skippedIdStr = c.req.param("skippedId");
    const skippedId = parseInt(skippedIdStr, 10);

    if (isNaN(skippedId)) {
      return c.json({ error: "Invalid skipped image ID" }, 400);
    }

    // Verify job ownership
    const job = db.query(
      `SELECT id, type FROM jobs WHERE id = ? AND user_id = ?`
    ).get(jobId, userId) as Record<string, unknown> | undefined;

    if (!job) {
      return c.json({ error: "Job not found" }, 404);
    }

    // Load the skipped result and verify it belongs to the job
    const skipped = db.query(
      `SELECT id, job_id, image_url, existing_alt_text, source_page_url
       FROM skipped_results WHERE id = ? AND job_id = ?`
    ).get(skippedId, jobId) as Record<string, unknown> | undefined;

    if (!skipped) {
      return c.json({ error: "Skipped image not found" }, 404);
    }

    // Check user credits
    const user = db.query("SELECT credits FROM users WHERE id = ?")
      .get(userId) as { credits: number } | undefined;

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    if (user.credits < 1) {
      return c.json({ error: "Insufficient credits. You need at least 1 credit to generate alt text." }, 402);
    }

    // Get API key
    let apiKey: string;
    try {
      apiKey = requireApiKey();
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }

    // Deduct 1 credit
    db.run("UPDATE users SET credits = credits - 1 WHERE id = ? AND credits > 0", [userId]);

    // Call AI generation
    let altText: string;
    let status: string;
    let charCount: number;

    try {
      const generated = await generateAltText(
        skipped.image_url as string,
        null,
        apiKey
      );
      altText = generated.altText;
      status = generated.status;
      charCount = generated.charCount;
    } catch (err) {
      // Refund the credit on AI failure
      db.run("UPDATE users SET credits = credits + 1 WHERE id = ?", [userId]);
      return c.json({
        error: `AI generation failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      }, 502);
    }

    // Insert a new result row and delete the skipped row in a transaction
    const now = new Date().toISOString();
    const newResultId = crypto.randomUUID();
    const skippedImageUrl = skipped.image_url as string;
    const skippedSourcePageUrl = skipped.source_page_url as string | null;

    const moveToResults = db.transaction(() => {
      db.run(
        `INSERT INTO results (id, job_id, image_url, alt_text, char_count, status, source_page_url, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newResultId, jobId, skippedImageUrl, altText, charCount, status, skippedSourcePageUrl, now]
      );
      db.run("DELETE FROM skipped_results WHERE id = ?", [skippedId]);
    });

    moveToResults();

    return c.json({
      id: newResultId,
      job_id: jobId,
      image_url: skipped.image_url,
      alt_text: altText,
      char_count: charCount,
      status,
      source_page_url: skipped.source_page_url,
    });
  });

  // DELETE /api/jobs/:id — delete a pending job
  router.delete("/:id", async (c) => {
    const userId = getUserId(c);
    const jobId = c.req.param("id");

    // Verify job ownership
    const job = db.query(
      `SELECT id, status FROM jobs WHERE id = ? AND user_id = ?`
    ).get(jobId, userId) as Record<string, unknown> | undefined;

    if (!job) {
      return c.json({ error: "Job not found" }, 404);
    }

    if (job.status !== "pending") {
      return c.json({
        error: `Only pending jobs can be cancelled. Current status: ${job.status}`,
      }, 409);
    }

    // Delete all associated results first, then the job
    db.run("DELETE FROM results WHERE job_id = ?", [jobId]);
    db.run("DELETE FROM jobs WHERE id = ?", [jobId]);

    return c.json({ success: true });
  });

  // GET /api/jobs/:id/export — export results as CSV or HTML
  router.get("/:id/export", (c) => {
    const userId = getUserId(c);
    const jobId = c.req.param("id");
    const format = c.req.query("format") || "csv";

    // Verify job ownership
    const job = db.query(
      `SELECT id, type, status, source_url, source_filename, created_at
       FROM jobs WHERE id = ? AND user_id = ?`
    ).get(jobId, userId) as Record<string, unknown> | undefined;

    if (!job) {
      return c.json({ error: "Job not found" }, 404);
    }

    // Load results
    const results = db.query(
      `SELECT id, job_id, image_url, alt_text, char_count, status, source_page_url
       FROM results WHERE job_id = ? ORDER BY created_at`
    ).all(jobId) as Record<string, unknown>[];

    const jobType = job.type as string;
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `altforge-export-${jobType}-${dateStr}`;

    if (format === "html") {
      return exportHtml(results, filename);
    }

    // Default: CSV
    return exportCsv(results, filename);
  });

  return router;
}

/**
 * Process a job's images in the background using GPT-4o-mini.
 * This runs asynchronously — the route handler returns immediately after kicking it off.
 */
async function processJobInBackground(
  db: Database,
  jobId: string,
  userId: string,
  results: Record<string, unknown>[],
  apiKey: string
): Promise<void> {
  const updateResult = db.prepare(
    `UPDATE results SET alt_text = ?, char_count = ?, status = ? WHERE id = ?`
  );
  const incrementProgress = db.prepare(
    `UPDATE jobs SET processed_images = processed_images + 1 WHERE id = ?`
  );
  const deductCredit = db.prepare(
    `UPDATE users SET credits = credits - 1 WHERE id = ? AND credits > 0`
  );

  try {
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (!result) continue;
      const resultId = result.id as string;
      const imageUrl = result.image_url as string;
      const contextText = result.context_text as string | null;

      // Check if user still has credits before processing
      const user = db.query("SELECT credits FROM users WHERE id = ?")
        .get(userId) as { credits: number } | undefined;

      if (!user || user.credits < 1) {
        // Pause the job — not enough credits
        db.run("UPDATE jobs SET status = 'pending' WHERE id = ?", [jobId]);
        console.log(`[process] Job ${jobId} paused — user out of credits after ${i} images`);
        return;
      }

      // Deduct credit atomically (in transaction)
      const deductTx = db.transaction(() => {
        deductCredit.run(userId);
        incrementProgress.run(jobId);
      });

      try {
        deductTx();

        // Check post-deduction credit balance and send warning emails
        const updatedUser = db.query("SELECT email, credits FROM users WHERE id = ?")
          .get(userId) as { email: string; credits: number } | undefined;
        if (updatedUser) {
          if (updatedUser.credits === 0) {
            sendEmail(
              updatedUser.email,
              "You're out of credits — refill to continue",
              `<h1>You're out of credits</h1>
<p>You've used all your credits. Don't worry — you can refill anytime.</p>
<p><a href="https://altforge.app/pricing">Get more credits</a> to keep generating alt-text.</p>
<p>— The AltForge team</p>`
            ).catch((err) => console.error("[jobs] Out-of-credits email failed:", err));
          } else if (updatedUser.credits <= 5) {
            sendEmail(
              updatedUser.email,
              "Running low on credits — refill to keep generating",
              `<h1>Running low on credits</h1>
<p>You have <strong>${updatedUser.credits} credit${updatedUser.credits === 1 ? "" : "s"}</strong> left. Refill now to keep generating alt-text without interruption.</p>
<p><a href="https://altforge.app/pricing">Get more credits</a></p>
<p>— The AltForge team</p>`
            ).catch((err) => console.error("[jobs] Low-credit email failed:", err));
          }
        }

        // Process the image with GPT-4o-mini
        const generated = await generateAltText(imageUrl, contextText, apiKey);

        // Update the result
        updateResult.run(
          generated.status === "decorative" ? "" : generated.altText,
          generated.charCount,
          generated.status,
          resultId
        );

        console.log(
          `[process] Job ${jobId}: ${i + 1}/${results.length} — ${generated.status} (${generated.charCount} chars)`
        );
      } catch (processingErr) {
        // Individual image processing failed — mark as needs_review, don't refund
        console.error(
          `[process] Job ${jobId}: failed to process image ${imageUrl}:`,
          processingErr instanceof Error ? processingErr.message : processingErr
        );
        // Leave the result as needs_review — user can manually add alt text
        // Credit already deducted, no refund
      }

      // Small delay between API calls to avoid rate limits
      if (i < results.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // All done — mark job as completed
    db.run(
      `UPDATE jobs SET status = 'completed', completed_at = ? WHERE id = ?`,
      [new Date().toISOString(), jobId]
    );
    console.log(`[process] Job ${jobId}: completed — ${results.length} images processed`);
  } catch (err) {
    console.error(
      `[process] Job ${jobId}: fatal error:`,
      err instanceof Error ? err.message : err
    );
    db.run(
      `UPDATE jobs SET status = 'failed' WHERE id = ?`,
      [jobId]
    );
  }
}

/**
 * Escape a CSV field: wrap in double quotes if it contains commas, quotes, or newlines.
 */
function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate a CSV file and return it as a download response.
 */
function exportCsv(results: Record<string, unknown>[], filename: string): Response {
  const header = "image_url,alt_text,char_count,status";
  const rows = results.map((r) => {
    const url = escapeCsvField((r.image_url as string) || "");
    const alt = escapeCsvField((r.alt_text as string) || "");
    const chars = String(r.char_count ?? 0);
    const status = escapeCsvField((r.status as string) || "");
    return `${url},${alt},${chars},${status}`;
  });
  const csv = [header, ...rows].join("\n") + "\n";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}

/**
 * Escape a string for safe inclusion in an HTML attribute value.
 */
function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Generate an HTML file with ready-to-paste <img> snippets and return as download.
 */
function exportHtml(results: Record<string, unknown>[], filename: string): Response {
  const now = new Date().toISOString();
  const compliant = results.filter((r) => r.status === "compliant").length;
  const decorative = results.filter((r) => r.status === "decorative").length;
  const needsReview = results.filter((r) => r.status === "needs_review").length;

  const imgTags = results.map((r) => {
    const src = escapeHtmlAttr((r.image_url as string) || "");
    const alt = escapeHtmlAttr((r.alt_text as string) || "");
    return `  <img src="${src}" alt="${alt}" />`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AltForge Export</title>
</head>
<body>
<!--
  AltForge alt-text export
  Generated: ${now}
  Total images: ${results.length}
  Compliant: ${compliant} | Decorative: ${decorative} | Needs review: ${needsReview}
-->
${imgTags}
</body>
</html>
`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.html"`,
    },
  });
}
