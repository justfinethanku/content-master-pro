# Content Master Pro — MCP Server

MCP server that gives Claude Desktop access to your content database: search posts, prompt kits, Slack messages, and create new projects.

## Tools Available

### Read Tools
| Tool | What it does |
|------|-------------|
| `search_nate_posts` | Search published newsletter posts by keyword |
| `get_post` | Get full content of a specific post by ID |
| `search_prompt_kits` | Search prompt kit assets by keyword |
| `search_slack_messages` | Search raw Slack messages from #content-ideas |
| `get_slack_thread` | Get a thread's parent message + all replies |
| `list_projects` | List content projects (optionally filter by status) |

### Write Tools
| Tool | What it does |
|------|-------------|
| `create_project` | Create a new content project (starts as "draft") |
| `add_asset` | Add an asset (post, transcript, prompt kit, etc.) to a project |

## Setup

### 1. Build

```bash
cd mcp-server
npm install
npm run build
```

### 2. Get Nate's User ID

Find Nate's UUID from the Supabase auth.users table. You'll need this for the `NATE_USER_ID` env var.

### 3. Configure Claude Desktop

Add to your `claude_desktop_config.json`:

**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "content-master-pro": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/build/index.js"],
      "env": {
        "SUPABASE_URL": "https://uaiiskuioqirpcaliljh.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
        "NATE_USER_ID": "nates-auth-uuid"
      }
    }
  }
}
```

### 4. Restart Claude Desktop

Close and reopen Claude Desktop. You should see "content-master-pro" in the MCP tools list.

## Usage Examples

Once connected, you can ask Claude things like:

- "Search my posts about prompting techniques"
- "Find Slack messages about video ideas"
- "Create a new project called 'AI Tools Roundup'"
- "Add a post draft to the project I just created"
- "Show me all my draft projects"
- "Search prompt kits for newsletter templates"

## Development

```bash
# Run in dev mode (with tsx, no build step)
npm run dev

# Rebuild after changes
npm run build

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node build/index.js
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (bypasses RLS) |
| `NATE_USER_ID` | For writes | Nate's auth.users UUID (needed for create_project) |
