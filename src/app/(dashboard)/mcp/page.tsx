"use client";

import { useState } from "react";
import { Check, Copy, Terminal, Search, FolderPlus, MessageSquare, FileText, BookOpen, List } from "lucide-react";
import { Button } from "@/components/ui/button";

function CopyBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      {label && (
        <div className="text-xs text-muted-foreground mb-1 font-medium">{label}</div>
      )}
      <pre className="bg-muted rounded-lg p-4 text-sm overflow-x-auto font-mono text-foreground">
        {code}
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

function ToolCard({ icon: Icon, name, description }: { icon: React.ElementType; name: string; description: string }) {
  return (
    <div className="flex gap-3 p-3 rounded-lg border border-border bg-card">
      <div className="flex-shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <code className="text-sm font-semibold text-foreground">{name}</code>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}

const CLAUDE_DESKTOP_CONFIG = `{
  "mcpServers": {
    "content-master-pro": {
      "command": "node",
      "args": ["/Users/jonathanedwards/AUTOMATION/SubStack/content-master-pro/mcp-server/build/index.js"],
      "env": {
        "SUPABASE_URL": "https://uaiiskuioqirpcaliljh.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhaWlza3Vpb3FpcnBjYWxpbGpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Njg2OTk5MCwiZXhwIjoyMDgyNDQ1OTkwfQ.3NHfdJDJPXXNOnhZ4cz_leY0rz4njBkIpPi9be66Kp8",
        "NATE_USER_ID": "YOUR_USER_ID_HERE"
      }
    }
  }
}`;

export default function McpPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">MCP server setup</h1>
        <p className="mt-2 text-muted-foreground">
          Connect Claude Desktop to Content Master Pro. Search posts, Slack messages, and prompt kits.
          Create projects and add assets — all from inside Claude.
        </p>
      </div>

      {/* Available Tools */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Available tools</h2>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Search</h3>
          <div className="grid gap-2">
            <ToolCard icon={Search} name="search_nate_posts" description="Search published newsletter posts by keyword. Returns title, URL, date, and content preview." />
            <ToolCard icon={FileText} name="get_post" description="Get the full content of a specific post by ID. Use after searching to read the complete text." />
            <ToolCard icon={BookOpen} name="search_prompt_kits" description="Search prompt kit assets by keyword. Searches name and content." />
            <ToolCard icon={MessageSquare} name="search_slack_messages" description="Search raw Slack messages from #content-ideas. Returns who said it, when, and the full text." />
            <ToolCard icon={MessageSquare} name="get_slack_thread" description="Get a full Slack thread — parent message and all replies." />
            <ToolCard icon={List} name="list_projects" description="List content projects with optional status filter (draft, in_progress, review, scheduled, published, archived)." />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Create</h3>
          <div className="grid gap-2">
            <ToolCard icon={FolderPlus} name="create_project" description='Create a new content project. Starts in "draft" status with auto-generated yyyymmdd_xxx ID.' />
            <ToolCard icon={FolderPlus} name="add_asset" description="Add an asset to a project — post, transcript, description, thumbnail, promptkit, guide, etc." />
          </div>
        </div>
      </section>

      {/* Setup Steps */}
      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-foreground">Setup</h2>

        {/* Step 1 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
            <h3 className="font-medium text-foreground">Build the MCP server</h3>
          </div>
          <p className="text-sm text-muted-foreground ml-8">
            Clone the repo (or pull latest), then build the server:
          </p>
          <div className="ml-8">
            <CopyBlock code={`cd content-master-pro/mcp-server\nnpm install\nnpm run build`} />
          </div>
        </div>

        {/* Step 2 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
            <h3 className="font-medium text-foreground">Configure Claude Desktop</h3>
          </div>
          <p className="text-sm text-muted-foreground ml-8">
            Open your Claude Desktop config file and add the server block below.
            Replace <code className="rounded bg-muted px-1 py-0.5 text-xs">YOUR_USER_ID_HERE</code> with
            your user ID from Content Master Pro (ask Jon if you don&apos;t know it).
          </p>
          <div className="ml-8 space-y-2">
            <CopyBlock
              label="Mac: ~/Library/Application Support/Claude/claude_desktop_config.json"
              code={CLAUDE_DESKTOP_CONFIG}
            />
          </div>
          <p className="text-sm text-muted-foreground ml-8">
            On Windows, the config file is at <code className="rounded bg-muted px-1 py-0.5 text-xs">%APPDATA%\Claude\claude_desktop_config.json</code>.
            Update the <code className="rounded bg-muted px-1 py-0.5 text-xs">args</code> path to match where you cloned the repo.
          </p>
        </div>

        {/* Step 3 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
            <h3 className="font-medium text-foreground">Restart Claude Desktop</h3>
          </div>
          <p className="text-sm text-muted-foreground ml-8">
            Fully quit and reopen Claude Desktop. You should see <strong>content-master-pro</strong> in the
            MCP tools list (the hammer icon at the bottom of the chat input).
          </p>
        </div>
      </section>

      {/* Usage Examples */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Try it out</h2>
        <p className="text-sm text-muted-foreground">
          Once connected, you can ask Claude things like:
        </p>
        <div className="grid gap-2">
          {[
            "Search my posts about prompting techniques",
            "Find Slack messages about video ideas from last week",
            "Show me all prompt kits related to newsletters",
            "Create a new project called 'AI Tools Roundup'",
            "Add a post draft to the project I just created",
            "What are my draft projects right now?",
            "Get the full thread for that Slack message about content strategy",
          ].map((example) => (
            <div
              key={example}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5"
            >
              <Terminal className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-foreground">&ldquo;{example}&rdquo;</span>
            </div>
          ))}
        </div>
      </section>

      {/* Troubleshooting */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Troubleshooting</h2>
        <div className="space-y-3 text-sm text-muted-foreground">
          <div>
            <strong className="text-foreground">Tools not showing up?</strong>{" "}
            Make sure the <code className="rounded bg-muted px-1 py-0.5 text-xs">args</code> path
            points to the built <code className="rounded bg-muted px-1 py-0.5 text-xs">build/index.js</code> file,
            not the source <code className="rounded bg-muted px-1 py-0.5 text-xs">src/index.ts</code>. Run{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run build</code> if you haven&apos;t already.
          </div>
          <div>
            <strong className="text-foreground">Search returning no results?</strong>{" "}
            The search uses keyword matching (ILIKE). Try shorter, more general terms.
            For example, &ldquo;prompt&rdquo; instead of &ldquo;prompting techniques for newsletters&rdquo;.
          </div>
          <div>
            <strong className="text-foreground">Can&apos;t create projects?</strong>{" "}
            The <code className="rounded bg-muted px-1 py-0.5 text-xs">NATE_USER_ID</code> env var must be
            set to a valid user UUID. Ask Jon for yours.
          </div>
          <div>
            <strong className="text-foreground">Need to test locally?</strong>{" "}
            Run the inspector:{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">npx @modelcontextprotocol/inspector node build/index.js</code>
          </div>
        </div>
      </section>
    </div>
  );
}
