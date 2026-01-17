import "dotenv/config";

// CONFIRMED WORKING FEEDS (tested 2026-01-17)
const WORKING_FEEDS = [
  // OpenAI
  { name: "OpenAI Blog", url: "https://openai.com/blog/rss.xml", type: "rss" },

  // Google
  {
    name: "Google AI Blog",
    url: "https://blog.google/technology/ai/rss/",
    type: "rss",
  },

  // GitHub Releases - Anthropic
  {
    name: "Claude Code",
    url: "https://github.com/anthropics/claude-code/releases.atom",
    type: "atom",
  },
  {
    name: "Anthropic SDK (TS)",
    url: "https://github.com/anthropics/anthropic-sdk-typescript/releases.atom",
    type: "atom",
  },
  {
    name: "Anthropic SDK (Python)",
    url: "https://github.com/anthropics/anthropic-sdk-python/releases.atom",
    type: "atom",
  },
  {
    name: "Claude Agent SDK",
    url: "https://github.com/anthropics/claude-agent-sdk-python/releases.atom",
    type: "atom",
  },

  // GitHub Releases - xAI
  {
    name: "xAI SDK (Python)",
    url: "https://github.com/xai-org/xai-sdk-python/releases.atom",
    type: "atom",
  },

  // GitHub Releases - Others
  {
    name: "n8n",
    url: "https://github.com/n8n-io/n8n/releases.atom",
    type: "atom",
  },
  {
    name: "OpenAI Python SDK",
    url: "https://github.com/openai/openai-python/releases.atom",
    type: "atom",
  },
  {
    name: "Meta Llama",
    url: "https://github.com/meta-llama/llama/releases.atom",
    type: "atom",
  },
  {
    name: "Mistral Inference",
    url: "https://github.com/mistralai/mistral-inference/releases.atom",
    type: "atom",
  },
];

// NO RSS AVAILABLE - Need Perplexity API
const NO_FEED_SOURCES = [
  { name: "Anthropic News", url: "https://www.anthropic.com/news", domain: "anthropic.com" },
  { name: "Cursor Changelog", url: "https://www.cursor.com/changelog", domain: "cursor.com" },
  { name: "Perplexity", url: "https://perplexity.ai", domain: "perplexity.ai" },
  { name: "Windsurf/Codeium", url: "https://codeium.com/changelog", domain: "codeium.com" },
  { name: "Google Gemini Docs", url: "https://ai.google.dev/gemini-api/docs/changelog", domain: "ai.google.dev" },
];

const SOURCES = WORKING_FEEDS;

async function checkFeed(source: { name: string; url: string }) {
  try {
    const response = await fetch(source.url, {
      headers: { "User-Agent": "Mozilla/5.0 RSS Reader" },
    });
    if (response.ok) {
      const text = await response.text();
      const isXml =
        text.includes("<?xml") ||
        text.includes("<rss") ||
        text.includes("<feed");
      console.log(
        `✅ ${source.name}: ${response.status} (${isXml ? "valid XML" : "not XML"})`
      );
      // Show first item title if available
      const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/);
      if (titleMatch) console.log(`   First title: ${titleMatch[1]}`);
    } else {
      console.log(`❌ ${source.name}: ${response.status}`);
    }
  } catch (e) {
    console.log(
      `❌ ${source.name}: ${e instanceof Error ? e.message : "error"}`
    );
  }
}

async function main() {
  console.log("Checking RSS feeds...\n");
  for (const source of SOURCES) {
    await checkFeed(source);
  }
}

main();
