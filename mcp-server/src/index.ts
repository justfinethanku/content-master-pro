#!/usr/bin/env node

/**
 * Content Master Pro MCP Server
 *
 * Provides Claude Desktop with tools to:
 * - Search Nate's published posts
 * - Search prompt kits
 * - Search Slack messages from #content-ideas
 * - Get full post content and Slack threads
 * - List existing projects
 * - Create new projects and add assets
 *
 * Runs over stdio transport for Claude Desktop integration.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSearchTools } from "./tools/search.js";
import { registerWriteTools } from "./tools/write.js";

const server = new McpServer({
  name: "content-master-pro",
  version: "1.0.0",
});

// Register all tools
registerSearchTools(server);
registerWriteTools(server);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Content Master Pro MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
