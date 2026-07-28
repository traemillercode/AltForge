import Anthropic from "@anthropic-ai/sdk";
import type { ImageBlockParam } from "@anthropic-ai/sdk/resources/messages.mjs";

const ALT_TEXT_SYSTEM_PROMPT = `You are a WCAG 2.1 accessibility expert specializing in image alt text. Your task is to generate concise, accurate, and context-aware alternative text for images.

RULES:
1. **Simple / decorative-less images** (photos, people, objects, scenes): Write concise alt text under 125 characters that describes the meaningful content. Focus on what the image communicates, not just what it shows.

2. **Complex / informational images** (charts, graphs, infographics, diagrams, screenshots with text, maps): Provide more detailed alt text up to 250 characters that conveys the key data, trends, or information. Mention the chart type, axes, and main takeaway.

3. **Purely decorative images** (background patterns, decorative dividers, spacer images, ornamental icons with no information): Return exactly the word DECORATIVE (all caps, no punctuation). Use this ONLY when the image truly conveys no information and is purely aesthetic.

4. **Context awareness**: Use any provided context (surrounding heading, caption, or body text) to make the alt text more relevant and avoid redundancy with nearby text.

5. **Output format**: Return ONLY the alt text itself — no quotes, no prefixes like "Alt text:", no explanations, no markdown formatting.

6. **WCAG 2.1 compliance**: Alt text must serve the equivalent purpose as the image. Do not start with "Image of" or "Picture of" — screen readers already announce it's an image.`;

export interface AltTextResult {
  altText: string;
  status: "compliant" | "decorative";
  charCount: number;
}

/** Supported image media types for Anthropic's vision API */
type SupportedImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

/**
 * Normalize a content-type string to one of the types Anthropic supports.
 * Falls back to image/jpeg for unknown image types.
 */
function normalizeMediaType(contentType: string): SupportedImageMediaType {
  const mime = (contentType.split(";")[0] ?? "").trim().toLowerCase();
  if (mime === "image/jpeg" || mime === "image/png" || mime === "image/gif" || mime === "image/webp") {
    return mime;
  }
  // Map common alternatives
  if (mime === "image/jpg") return "image/jpeg";
  if (mime === "image/svg+xml") return "image/png"; // SVG not supported, fallback
  // For other image types, default to jpeg
  return "image/jpeg";
}

/**
 * Parse an image URL into an Anthropic-compatible image content block.
 * Handles both data URIs (base64) and remote HTTP URLs.
 */
async function imageUrlToContentBlock(
  imageUrl: string
): Promise<ImageBlockParam> {
  // Case 1: data URI — e.g. "data:image/jpeg;base64,/9j/..."
  if (imageUrl.startsWith("data:")) {
    const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match || !match[1] || !match[2]) {
      throw new Error("Invalid data URI format");
    }
    const mediaType = normalizeMediaType(match[1]);
    const data = match[2];
    return {
      type: "image",
      source: { type: "base64", media_type: mediaType, data },
    };
  }

  // Case 2: Remote HTTP URL — fetch, convert to base64
  const response = await fetch(imageUrl, {
    headers: { "User-Agent": "AltForge/1.0" },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch image: ${response.status} ${response.statusText}`
    );
  }

  const rawContentType =
    response.headers.get("content-type") || "image/jpeg";
  // Only accept image types
  if (!rawContentType.startsWith("image/")) {
    throw new Error(`Unsupported content type for image: ${rawContentType}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const data = Buffer.from(arrayBuffer).toString("base64");

  return {
    type: "image",
    source: { type: "base64", media_type: normalizeMediaType(rawContentType), data },
  };
}

/**
 * Generate WCAG-compliant alt text for a single image using Claude (Anthropic).
 * Retries once on failure. On 429, waits and retries.
 */
export async function generateAltText(
  imageUrl: string,
  contextText: string | null,
  apiKey: string
): Promise<AltTextResult> {
  const anthropic = new Anthropic({ apiKey });

  const userText = contextText
    ? `Generate alt text for this image.\n\nSurrounding context:\n${contextText}`
    : "Generate alt text for this image.";

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Parse the image URL into a content block (handles data URIs and remote URLs)
      const imageBlock = await imageUrlToContentBlock(imageUrl);

      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 150,
        system: ALT_TEXT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              imageBlock,
            ],
          },
        ],
        temperature: 0.3,
      });

      const raw =
        response.content
          .filter((block) => block.type === "text")
          .map((block) => (block.type === "text" ? block.text : ""))
          .join("")
          .trim() ?? "";

      if (raw === "DECORATIVE") {
        return { altText: "", status: "decorative", charCount: 0 };
      }

      // Clean up any stray quotes or prefixes the model might add
      let cleaned = raw
        .replace(/^["']|["']$/g, "")
        .replace(/^(Alt text:|ALT:|alt:)\s*/i, "")
        .trim();

      return {
        altText: cleaned,
        status: "compliant",
        charCount: cleaned.length,
      };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Handle rate limiting (Anthropic returns 429 as well)
      if (
        err &&
        typeof err === "object" &&
        "status" in err &&
        (err as { status: number }).status === 429
      ) {
        const delay = (attempt + 1) * 3000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // On non-rate-limit errors on first attempt, retry after 1s
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
    }
  }

  throw lastError ?? new Error("Failed to generate alt text after retries");
}

/**
 * Check that the Anthropic API key is configured. Returns the key or throws.
 */
export function requireApiKey(): string {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key || key.trim() === "") {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured. Please set it in your environment variables."
    );
  }
  return key.trim();
}
