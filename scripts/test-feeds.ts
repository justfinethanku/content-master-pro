import { fetchFeed, filterEntriesByRecency } from "../src/lib/feeds/parser";

async function test() {
  console.log("Testing feed parser...\n");

  // Test GitHub Atom feed
  console.log("=== Claude Code Releases ===");
  const feed = await fetchFeed(
    "https://github.com/anthropics/claude-code/releases.atom"
  );
  console.log("Feed title:", feed.title);
  console.log("Total entries:", feed.entries.length);

  // Filter to last 7 days
  const recent = filterEntriesByRecency(feed.entries, 168);
  console.log("Recent (7 days):", recent.length);

  if (recent.length > 0) {
    console.log("\nLatest entry:");
    console.log("  Title:", recent[0].title);
    console.log("  Date:", recent[0].published);
    console.log("  Link:", recent[0].link);
  }

  console.log("\n=== OpenAI Blog ===");
  const openai = await fetchFeed("https://openai.com/blog/rss.xml");
  console.log("Feed title:", openai.title);
  console.log("Total entries:", openai.entries.length);

  const recentOpenai = filterEntriesByRecency(openai.entries, 168);
  console.log("Recent (7 days):", recentOpenai.length);

  if (recentOpenai.length > 0) {
    console.log("\nLatest entry:");
    console.log("  Title:", recentOpenai[0].title);
    console.log("  Date:", recentOpenai[0].published);
  }

  console.log("\n=== n8n Releases ===");
  const n8n = await fetchFeed("https://github.com/n8n-io/n8n/releases.atom");
  console.log("Feed title:", n8n.title);
  console.log("Total entries:", n8n.entries.length);

  const recentN8n = filterEntriesByRecency(n8n.entries, 168);
  console.log("Recent (7 days):", recentN8n.length);

  if (recentN8n.length > 0) {
    console.log("\nLatest entries:");
    recentN8n.slice(0, 3).forEach((e) => {
      console.log("  -", e.title, "(" + e.published?.toISOString().split("T")[0] + ")");
    });
  }
}

test().catch(console.error);
