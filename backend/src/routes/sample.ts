import { Hono } from "hono";
import type { Context } from "hono";
import { generateAltText, requireApiKey } from "../ai.js";

const MAX_IMAGES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const RATE_LIMIT = 5; // requests per window
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

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

async function verifyTurnstile(token: string): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  
  // If no secret key is configured, skip verification (graceful degradation for dev)
  if (!secretKey) {
    console.warn("[sample] TURNSTILE_SECRET_KEY not set — skipping Turnstile verification");
    return true;
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);

    const res = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!res.ok) {
      console.error("[sample] Turnstile verification API error:", res.status, res.statusText);
      return false;
    }

    const data = await res.json() as {
      success: boolean;
      "error-codes"?: string[];
    };

    if (!data.success) {
      console.warn(
        "[sample] Turnstile verification failed:",
        data["error-codes"]?.join(", ") ?? "unknown error"
      );
    }

    return data.success;
  } catch (err) {
    console.error("[sample] Turnstile verification network error:", err);
    return false;
  }
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
    // Rate limit check (first layer of protection)
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

    // Validate API key is configured (early check)
    let apiKey: string;
    try {
      apiKey = requireApiKey();
    } catch (err) {
      return c.json({ error: (err as Error).message }, 500);
    }

    // Parse multipart form data (single call — body stream can only be consumed once)
    const formData = await c.req.formData().catch(() => null);
    if (!formData) {
      return c.json({ error: "Request must be multipart/form-data with image files" }, 400);
    }

    // Extract Turnstile token from form data (if present)
    const turnstileTokenField = formData.get("turnstileToken");
    const turnstileToken: string | null =
      turnstileTokenField && typeof turnstileTokenField === "string"
        ? turnstileTokenField
        : null;

    const secretKeyConfigured = !!process.env.TURNSTILE_SECRET_KEY;

    // If Turnstile is configured but no token was found, reject
    if (secretKeyConfigured && !turnstileToken) {
      return c.json(
        { error: "Security check required. Please complete the CAPTCHA." },
        400
      );
    }

    // Verify the token if we have one
    if (turnstileToken) {
      const verified = await verifyTurnstile(turnstileToken);
      if (!verified) {
        return c.json(
          { error: "Security check failed. Please try again." },
          400
        );
      }
    }

    // Collect files (skip the turnstileToken field)
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      // Skip the turnstile token field
      if (key === "turnstileToken") continue;
      
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
