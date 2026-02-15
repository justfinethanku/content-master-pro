import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const FEED_URL = "https://natesnewsletter.substack.com/feed";

interface RSSItem {
  title: string;
  link: string;
  pubDate: string;
}

function parseRSSFeed(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const getTag = (tag: string): string => {
      const patterns = [
        new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`),
        new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`),
      ];
      for (const pattern of patterns) {
        const tagMatch = itemXml.match(pattern);
        if (tagMatch) return tagMatch[1].trim();
      }
      return "";
    };

    const title = getTag("title");
    const link = getTag("link");
    const pubDate = getTag("pubDate");

    if (title && link && pubDate) {
      items.push({ title, link, pubDate });
    }
  }

  return items;
}

/** Normalize a string for fuzzy title comparison */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Simple word-overlap similarity score (0-1) */
function titleSimilarity(a: string, b: string): number {
  const wordsA = new Set(normalize(a).split(" "));
  const wordsB = new Set(normalize(b).split(" "));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }

  return overlap / Math.max(wordsA.size, wordsB.size);
}

/** Check if date string falls within ±1 day of target */
function isWithinOneDay(pubDateStr: string, scheduledDate: string): boolean {
  const pub = new Date(pubDateStr);
  // scheduled_date is YYYY-MM-DD, treat as noon UTC to avoid timezone edge cases
  const sched = new Date(scheduledDate + "T12:00:00Z");
  const diffMs = Math.abs(pub.getTime() - sched.getTime());
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  return diffMs <= ONE_DAY_MS;
}

/** Check if project name starts with a date prefix like "1.27" or "02.14" */
function hasDatePrefix(name: string): boolean {
  return /^\d+\.\d+/.test(name);
}

export async function GET(request: NextRequest) {
  // Auth: CRON_SECRET or authenticated user
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const supabase = await createServiceClient();

    // 1. Fetch RSS feed
    const feedResponse = await fetch(FEED_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ContentMasterPro/1.0)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });

    if (!feedResponse.ok) {
      throw new Error(`Failed to fetch RSS: ${feedResponse.status}`);
    }

    const feedXml = await feedResponse.text();
    const rssItems = parseRSSFeed(feedXml);

    // 2. Query projects: scheduled in last 7 days, no URL yet, scheduled or published
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString().split("T")[0];

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, name, scheduled_date, metadata")
      .gte("scheduled_date", cutoff)
      .in("status", ["scheduled", "published"]);

    if (projectsError) throw projectsError;
    if (!projects || projects.length === 0) {
      return NextResponse.json({
        message: "No eligible projects found",
        rss_items: rssItems.length,
        duration: `${Date.now() - startTime}ms`,
      });
    }

    // Filter to projects without a URL already set
    const unlinked = projects.filter((p) => {
      const meta = p.metadata as Record<string, unknown> | null;
      return !meta?.url;
    });

    if (unlinked.length === 0) {
      return NextResponse.json({
        message: "All recent projects already have URLs",
        projects_checked: projects.length,
        rss_items: rssItems.length,
        duration: `${Date.now() - startTime}ms`,
      });
    }

    // 3. Match each unlinked project to an RSS item
    const linked: Array<{
      projectId: string;
      projectName: string;
      url: string;
      rssTitle: string;
      renamed: boolean;
    }> = [];
    const skipped: Array<{ projectName: string; reason: string }> = [];

    for (const project of unlinked) {
      if (!project.scheduled_date) continue;

      // Find RSS items within ±1 day of scheduled_date
      const dateMatches = rssItems.filter((item) =>
        isWithinOneDay(item.pubDate, project.scheduled_date!)
      );

      if (dateMatches.length === 0) {
        skipped.push({
          projectName: project.name,
          reason: "No RSS items within ±1 day",
        });
        continue;
      }

      let bestMatch: RSSItem;

      if (dateMatches.length === 1) {
        bestMatch = dateMatches[0];
      } else {
        // Multiple date matches — use title similarity as tiebreaker
        const scored = dateMatches
          .map((item) => ({
            item,
            score: titleSimilarity(project.name, item.title),
          }))
          .sort((a, b) => b.score - a.score);

        if (scored[0].score < 0.3) {
          skipped.push({
            projectName: project.name,
            reason: `Multiple date matches, best title score ${scored[0].score.toFixed(2)} < 0.3`,
          });
          continue;
        }

        bestMatch = scored[0].item;
      }

      // Write URL to metadata
      const existingMeta =
        (project.metadata as Record<string, unknown>) || {};
      const updatedMeta = { ...existingMeta, url: bestMatch.link };

      // Check if we should also rename the project
      const shouldRename = hasDatePrefix(project.name);
      const updatePayload: { metadata: Record<string, unknown>; name?: string } =
        { metadata: updatedMeta };

      if (shouldRename) {
        updatePayload.name = bestMatch.title;
      }

      const { error: updateError } = await supabase
        .from("projects")
        .update(updatePayload)
        .eq("id", project.id);

      if (updateError) {
        skipped.push({
          projectName: project.name,
          reason: `Update failed: ${updateError.message}`,
        });
        continue;
      }

      linked.push({
        projectId: project.id,
        projectName: shouldRename ? bestMatch.title : project.name,
        url: bestMatch.link,
        rssTitle: bestMatch.title,
        renamed: shouldRename,
      });
    }

    return NextResponse.json({
      success: true,
      linked,
      skipped,
      summary: {
        rss_items: rssItems.length,
        projects_checked: unlinked.length,
        linked: linked.length,
        skipped: skipped.length,
        duration: `${Date.now() - startTime}ms`,
      },
    });
  } catch (error) {
    console.error("Link-substack cron error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Link failed" },
      { status: 500 }
    );
  }
}
