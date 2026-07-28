/**
 * URL Crawler for AltForge
 * Fetches pages, extracts images, checks alt text quality, and gathers context.
 */

const PAGE_TIMEOUT_MS = 10_000;
const MAX_IMAGES = 1_000;

const GENERIC_ALT_PATTERNS = /^(image|photo|picture|img|placeholder|spacer|icon|logo|graphic|pic|figure|thumbnail)$/i;

export interface CrawlImage {
  url: string;
  altText: string | null;
  contextText: string;
  sourcePageUrl: string;
  fileSize?: number;
}

export interface CrawlSkippedImage {
  url: string;
  altText: string | null;
  sourcePageUrl: string;
  fileSize?: number;
}

export interface CrawlStats {
  pagesFound: number;
  pagesCrawled: number;
  pagesFailed: number;
  imagesFound: number;
  imagesSkipped: number;
  imagesAdded: number;
  crawledPages: string[];
  skippedImages: CrawlSkippedImage[];
}

export interface CrawlResult {
  images: CrawlImage[];
  stats: CrawlStats;
  errors: string[];
}

/**
 * Parse a robots.txt to find sitemap URLs and disallowed paths.
 */
export function parseRobotsTxt(text: string): { sitemaps: string[]; disallowed: string[] } {
  const sitemaps: string[] = [];
  const disallowed: string[] = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed === "") continue;

    const sitemapMatch = trimmed.match(/^Sitemap:\s*(.+)$/i);
    if (sitemapMatch && sitemapMatch[1]) {
      sitemaps.push(sitemapMatch[1].trim());
    }

    const disallowMatch = trimmed.match(/^Disallow:\s*(.+)$/i);
    if (disallowMatch && disallowMatch[1]) {
      disallowed.push(disallowMatch[1].trim());
    }
  }

  return { sitemaps, disallowed };
}

/**
 * Parse a sitemap XML (standard or index) to extract <loc> URLs.
 */
export function parseSitemapXml(xml: string): string[] {
  const urls: string[] = [];
  // Match <loc>...</loc> globally
  const locRegex = /<loc>([^<]+)<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = locRegex.exec(xml)) !== null) {
    if (match[1]) {
      urls.push(match[1].trim());
    }
  }
  return urls;
}

/**
 * Check if a URL path should be skipped based on robots.txt disallow rules.
 */
function isPathDisallowed(url: string, disallowed: string[]): boolean {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    for (const rule of disallowed) {
      if (rule === "") continue; // empty rule means nothing disallowed
      if (rule === "/") return true; // disallow everything
      if (path.startsWith(rule)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Check if alt text is considered "good" (not missing/generic).
 * Returns true if the alt text should be KEPT (good alt), false if it needs AI processing.
 */
export function isGoodAlt(alt: string | null): boolean {
  // No alt attribute at all → needs attention
  if (alt === null) return false;
  // Empty alt is valid for decorative images, but we flag it for review
  if (alt.trim() === "") return false;
  // Generic alt text → needs AI
  if (GENERIC_ALT_PATTERNS.test(alt.trim())) return false;
  return true;
}

/**
 * Extract the page title from HTML.
 */
function extractPageTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() || "";
}

/**
 * Find the nearest heading that precedes a given position in the HTML.
 */
function findNearestHeading(html: string, beforeIndex: number): string {
  const headingRegex = /<h([1-6])[^>]*>([^<]+)<\/h\1>/gi;
  let nearestHeading = "";
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(html)) !== null) {
    if (match.index > beforeIndex) break;
    if (match[2]) {
      nearestHeading = match[2].trim();
    }
  }
  return nearestHeading;
}

/**
 * Extract surrounding text context for an image.
 * Returns up to 200 characters of the nearest text content.
 */
function extractSurroundingText(html: string, imgStart: number): string {
  // Extract a window of 2000 chars around the image
  const windowStart = Math.max(0, imgStart - 500);
  const windowEnd = Math.min(html.length, imgStart + 1500);
  const window = html.slice(windowStart, windowEnd);

  // Strip all HTML tags except keep text
  const textOnly = window.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  if (textOnly.length <= 200) return textOnly;
  return textOnly.slice(0, 200) + "...";
}

/**
 * Extract all <img> tags from HTML and gather context.
 */
function extractImagesFromHtml(html: string, pageUrl: string): CrawlImage[] {
  const images: CrawlImage[] = [];
  const pageTitle = extractPageTitle(html);

  // Regex to match <img ... > tags and extract src and alt
  // We use a two-stage approach:
  // 1. Find all <img tags
  // 2. Extract src and alt from each
  const imgTagRegex = /<img\b[^>]*>/gi;
  const srcRegex = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
  const altRegex = /\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = imgTagRegex.exec(html)) !== null) {
    const tag = tagMatch[0];
    const tagIndex = tagMatch.index;

    // Extract src
    const srcMatch = srcRegex.exec(tag);
    let src = "";
    if (srcMatch) {
      src = srcMatch[1] || srcMatch[2] || srcMatch[3] || "";
    }

    if (!src) continue;

    // Resolve relative URLs
    let absoluteUrl: string;
    try {
      absoluteUrl = new URL(src, pageUrl).href;
    } catch {
      continue; // skip invalid URLs
    }

    // Extract alt
    const altMatch = altRegex.exec(tag);
    // alt may be present but empty string "" or have a value
    // If alt attribute is not found at all, alt is null
    const altPresent = /\balt\s*=/i.test(tag);
    let alt: string | null;
    if (!altPresent) {
      alt = null;
    } else if (altMatch) {
      const captured = altMatch[1] ?? altMatch[2] ?? altMatch[3];
      alt = captured !== undefined ? captured : "";
    } else {
      alt = "";
    }

    // Gather context
    let contextText = "";
    const heading = findNearestHeading(html, tagIndex);
    const surrounding = extractSurroundingText(html, tagIndex);

    if (heading) {
      contextText = `Heading: ${heading}`;
      if (surrounding) {
        contextText += ` | Context: ${surrounding}`;
      }
    } else if (pageTitle) {
      contextText = `Page: ${pageTitle}`;
      if (surrounding) {
        contextText += ` | Context: ${surrounding}`;
      }
    } else {
      contextText = surrounding || `Image on ${pageUrl}`;
    }

    images.push({
      url: absoluteUrl,
      altText: alt,
      contextText: contextText.slice(0, 500), // limit context to 500 chars
      sourcePageUrl: pageUrl,
    });
  }

  return images;
}

/**
 * Fetch a URL with a timeout.
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "AltForge/1.0 (accessibility crawler; +https://altforge.app)",
        Accept: "text/html, application/xhtml+xml, text/xml, application/xml, */*",
      },
      redirect: "follow",
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch the text content of a URL.
 */
async function fetchText(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(url, timeoutMs);
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html") && !contentType.includes("text/xml") && !contentType.includes("application/xml")) {
      return null;
    }

    return await response.text();
  } catch {
    return null;
  }
}

/**
 * Fetch the Content-Length of an image URL via a HEAD request.
 * Returns the file size in bytes, or undefined if unavailable.
 */
async function fetchImageSize(url: string, timeoutMs: number): Promise<number | undefined> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      headers: {
        "User-Agent": "AltForge/1.0 (accessibility crawler; +https://altforge.app)",
      },
    });
    clearTimeout(timeout);
    if (!response.ok) return undefined;
    const cl = response.headers.get("content-length");
    if (cl) {
      const parsed = parseInt(cl, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Main crawl function.
 * Crawls ONLY the exact URL provided — no sitemap discovery, no following links.
 * Respects robots.txt disallowed paths on the single URL.
 * Extracts images with missing/generic alt text and returns results.
 */
export async function crawlSite(startUrl: string): Promise<CrawlResult> {
  const errors: string[] = [];
  const stats: CrawlStats = {
    pagesFound: 1,
    pagesCrawled: 0,
    pagesFailed: 0,
    imagesFound: 0,
    imagesSkipped: 0,
    imagesAdded: 0,
    crawledPages: [],
    skippedImages: [],
  };

  // Parse the base URL
  let baseUrl: URL;
  try {
    baseUrl = new URL(startUrl);
  } catch {
    return { images: [], stats, errors: ["Invalid URL provided"] };
  }

  const origin = baseUrl.origin;

  // 1. Try to fetch robots.txt — only to check if the single URL is disallowed
  const robotsUrl = `${origin}/robots.txt`;
  const robotsText = await fetchText(robotsUrl, PAGE_TIMEOUT_MS);

  if (robotsText) {
    const parsed = parseRobotsTxt(robotsText);
    // Don't crawl the starting URL if it's disallowed
    if (isPathDisallowed(startUrl, parsed.disallowed)) {
      return { images: [], stats, errors: ["URL is disallowed by robots.txt"] };
    }
  }

  // 2. Crawl only the exact URL entered — no sitemaps, no page discovery
  const pageUrls: string[] = [startUrl];

  // 3. Crawl each page and extract images
  const allImages: CrawlImage[] = [];
  const seenUrls = new Set<string>();

  for (const pageUrl of pageUrls) {
    const html = await fetchText(pageUrl, PAGE_TIMEOUT_MS);
    if (!html) {
      stats.pagesFailed++;
      errors.push(`Failed to fetch: ${pageUrl}`);
      continue;
    }

    stats.pagesCrawled++;
    stats.crawledPages.push(pageUrl);

    const pageImages = extractImagesFromHtml(html, pageUrl);
    stats.imagesFound += pageImages.length;

    for (const img of pageImages) {
      // Check limits
      if (allImages.length >= MAX_IMAGES) break;

      // Deduplicate
      const normalizedUrl = img.url.toLowerCase();
      if (seenUrls.has(normalizedUrl)) continue;
      seenUrls.add(normalizedUrl);

      // Fetch file size via HEAD (non-blocking, swallow errors)
      const fileSize = await fetchImageSize(img.url, 3000);

      // Check alt text quality
      if (isGoodAlt(img.altText)) {
        stats.imagesSkipped++;
        if (stats.skippedImages.length < 500) {
          stats.skippedImages.push({ url: img.url, altText: img.altText, sourcePageUrl: img.sourcePageUrl, fileSize });
        }
        continue;
      }

      img.fileSize = fileSize;
      allImages.push(img);
      stats.imagesAdded++;
    }

    if (allImages.length >= MAX_IMAGES) break;
  }

  return { images: allImages, stats, errors };
}
