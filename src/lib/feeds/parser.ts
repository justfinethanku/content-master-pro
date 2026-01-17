/**
 * RSS/Atom Feed Parser
 *
 * Parses RSS and Atom feeds to extract changelog entries.
 * Used for deterministic ingestion from sources that have feeds.
 */

export interface FeedEntry {
  title: string;
  link: string;
  published: Date | null;
  content: string;
  author?: string;
}

export interface ParsedFeed {
  title: string;
  entries: FeedEntry[];
}

/**
 * Parse an RSS or Atom feed from XML string
 */
export function parseFeed(xml: string): ParsedFeed {
  // Detect feed type
  const isAtom = xml.includes("<feed") && xml.includes("xmlns=");
  const isRss = xml.includes("<rss") || xml.includes("<channel>");

  if (isAtom) {
    return parseAtomFeed(xml);
  } else if (isRss) {
    return parseRssFeed(xml);
  }

  throw new Error("Unknown feed format");
}

/**
 * Parse Atom feed (used by GitHub releases)
 */
function parseAtomFeed(xml: string): ParsedFeed {
  const entries: FeedEntry[] = [];

  // Extract feed title
  const feedTitleMatch = xml.match(/<title[^>]*>([^<]+)<\/title>/);
  const feedTitle = feedTitleMatch?.[1] || "Unknown Feed";

  // Extract entries
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];

    // Extract fields
    const title = extractTag(entry, "title");
    const link =
      extractAttr(entry, "link", "href") ||
      extractTag(entry, "link") ||
      extractTag(entry, "id");
    const published =
      extractTag(entry, "published") || extractTag(entry, "updated");
    const content =
      extractTag(entry, "content") || extractTag(entry, "summary") || "";
    const author = extractTag(entry, "name"); // Inside <author>

    if (title) {
      entries.push({
        title: decodeHtmlEntities(title),
        link: link || "",
        published: published ? new Date(published) : null,
        content: decodeHtmlEntities(stripHtml(content)),
        author: author ? decodeHtmlEntities(author) : undefined,
      });
    }
  }

  return { title: decodeHtmlEntities(feedTitle), entries };
}

/**
 * Parse RSS 2.0 feed
 */
function parseRssFeed(xml: string): ParsedFeed {
  const entries: FeedEntry[] = [];

  // Extract channel title
  const channelTitleMatch = xml.match(
    /<channel>[\s\S]*?<title[^>]*>([^<]+)<\/title>/
  );
  const feedTitle = channelTitleMatch?.[1] || "Unknown Feed";

  // Extract items
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];

    // Extract fields
    const title = extractTag(item, "title");
    const link = extractTag(item, "link") || extractTag(item, "guid");
    const pubDate = extractTag(item, "pubDate");
    const content =
      extractTag(item, "content:encoded") ||
      extractTag(item, "description") ||
      "";
    const author =
      extractTag(item, "author") || extractTag(item, "dc:creator");

    if (title) {
      entries.push({
        title: decodeHtmlEntities(title),
        link: link || "",
        published: pubDate ? new Date(pubDate) : null,
        content: decodeHtmlEntities(stripHtml(content)),
        author: author ? decodeHtmlEntities(author) : undefined,
      });
    }
  }

  return { title: decodeHtmlEntities(feedTitle), entries };
}

/**
 * Extract text content from an XML tag
 */
function extractTag(xml: string, tagName: string): string | null {
  // Handle CDATA sections
  const cdataRegex = new RegExp(
    `<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`,
    "i"
  );
  const cdataMatch = xml.match(cdataRegex);
  if (cdataMatch) {
    return cdataMatch[1].trim();
  }

  // Handle regular content
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract attribute value from a self-closing tag
 */
function extractAttr(
  xml: string,
  tagName: string,
  attrName: string
): string | null {
  const regex = new RegExp(
    `<${tagName}[^>]*${attrName}=["']([^"']+)["'][^>]*/?>`,
    "i"
  );
  const match = xml.match(regex);
  return match ? match[1] : null;
}

/**
 * Strip HTML tags from content
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

/**
 * Fetch and parse a feed from URL
 */
export async function fetchFeed(url: string): Promise<ParsedFeed> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "ContentMasterPro/1.0 RSS Reader",
      Accept: "application/atom+xml, application/rss+xml, application/xml",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status}`);
  }

  const xml = await response.text();
  return parseFeed(xml);
}

/**
 * Filter feed entries to only include those from the last N hours
 */
export function filterEntriesByRecency(
  entries: FeedEntry[],
  hoursAgo: number
): FeedEntry[] {
  const cutoff = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

  return entries.filter((entry) => {
    if (!entry.published) return true; // Include entries without dates
    return entry.published >= cutoff;
  });
}
