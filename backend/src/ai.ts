import OpenAI from "openai";

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

/**
 * Generate WCAG-compliant alt text for a single image using GPT-4o-mini.
 * Retries once on failure. On 429, waits and retries.
 */
export async function generateAltText(
  imageUrl: string,
  contextText: string | null,
  apiKey: string
): Promise<AltTextResult> {
  const openai = new OpenAI({ apiKey });

  const userPrompt = contextText
    ? `Generate alt text for this image.\n\nSurrounding context:\n${contextText}`
    : "Generate alt text for this image.";

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: ALT_TEXT_SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
            ],
          },
        ],
        max_tokens: 150,
        temperature: 0.3,
      });

      const raw = response.choices[0]?.message?.content?.trim() ?? "";

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

      // Handle rate limiting
      if (err && typeof err === "object" && "status" in err && (err as { status: number }).status === 429) {
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
 * Check that the OpenAI API key is configured. Returns the key or throws.
 */
export function requireApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key || key.trim() === "") {
    throw new Error(
      "OPENAI_API_KEY is not configured. Please set it in your environment variables."
    );
  }
  return key.trim();
}
