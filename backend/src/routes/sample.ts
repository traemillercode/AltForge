import { Hono } from "hono";
import type { Context } from "hono";
import { generateAltText, requireApiKey } from "../ai.js";

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const RATE_LIMIT = 5; // requests per window
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// In-memory rate limiter: IP -> { count, windowStart }
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

// Clean up stale entries every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.windowStart > RATE_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}, 15 * 60 * 1000);

function getClientIp(c: Context): string {
  // Try X-Forwarded-For header first (for proxied environments)
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded && forwarded.length > 0) {
    return forwarded.split(",")[0]!.trim();
  }
  // Fall back to raw request info
  // Hono on Bun provides this via c.req.raw
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = c.req.raw as any;
    if (raw?.remoteAddress) return raw.remoteAddress as string;
  } catch {
    // ignore
  }
  return "unknown";
}

function checkRateLimit(c: Context): { allowed: boolean; retryAfter?: number } {
  const ip = getClientIp(c);
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    // New window
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT) {
    const retryAfter = Math.ceil((entry.windowStart + RATE_WINDOW_MS - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mimeType] ?? "png";
}

export interface SampleImageResult {
  filename: string;
  dataUri: string;
  altText: string;
  charCount: number;
  status: "compliant" | "decorative";
  error?: string;
}

export function sampleRoutes(): Hono {
  const router = new Hono();

  router.post("/", async (c) => {
    // Rate limit check
    const rateLimit = checkRateLimit(c);
    if (!rateLimit.allowed) {
      c.header("Retry-After", String(rateLimit.retryAfter));
      return c.json(
        {
          error: `Rate limit exceeded. You can try ${RATE_LIMIT} free samples per hour. Please try again in ${Math.ceil((rateLimit.retryAfter ?? 3600) / 60)} minutes.`,
        },
        429
      );
    }

    // Validate API key is configured
    let apiKey: string;
    try {
      apiKey = requireApiKey();
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }

    // Parse multipart form data
    const formData = await c.req.formData().catch(() => null);
    if (!formData) {
      return c.json({ error: "Request must be multipart/form-data with image files" }, 400);
    }

    // Collect files
    const files: File[] = [];
    for (const [, value] of formData.entries()) {
      // Hono on Bun: formData values may be File objects
      if (value && typeof value === "object" && "arrayBuffer" in value && "name" in value) {
        files.push(value as unknown as File);
      }
    }

    // Validate file count
    if (files.length === 0) {
      return c.json({ error: "No image files provided. Please upload 1–5 images." }, 400);
    }

    if (files.length > MAX_IMAGES) {
      return c.json(
        { error: `Maximum ${MAX_IMAGES} images per sample. You uploaded ${files.length}.` },
        400
      );
    }

    // Validate each file
    for (const file of files) {
      if (!ALLOWED_TYPES.has(file.type)) {
        return c.json(
          {
            error: `Unsupported file type: ${file.name} (${file.type}). Accepted: JPEG, PNG, WebP, GIF.`,
          },
          400
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return c.json(
          { error: `File too large: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB per file.` },
          400
        );
      }
    }

    // Process each image
    const results: SampleImageResult[] = [];

    for (const file of files) {
      try {
        // Convert to base64 data URI
        const arrayBuf = await file.arrayBuffer();
        const base64 = Buffer.from(arrayBuf).toString("base64");
        const ext = getExtension(file.type);
        const dataUri = `data:image/${ext};base64,${base64}`;

        // Generate alt text using existing AI pipeline
        const generated = await generateAltText(dataUri, null, apiKey);

        results.push({
          filename: file.name,
          dataUri,
          altText: generated.altText,
          charCount: generated.charCount,
          status: generated.status,
        });
      } catch (err) {
        console.error(
          `[sample] Failed to process ${file.name}:`,
          err instanceof Error ? err.message : err
        );
        results.push({
          filename: file.name,
          dataUri: "",
          altText: "",
          charCount: 0,
          status: "compliant",
          error: err instanceof Error ? err.message : "Processing failed",
        });
      }
    }

    return c.json({ results });
  });

  return router;
}
