"use client";

import { useState, useEffect } from "react";
import { Key, Settings, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import Image from "next/image";

const SETUP_STEPS = [
  {
    image: "/images/mcp-setup/01-settings.png",
    title: "Open settings",
    description: "Click your profile icon in the bottom-left corner of Claude, then click Settings.",
  },
  {
    image: "/images/mcp-setup/02-connectors.png",
    title: "Go to Connectors",
    description: "In the Settings sidebar, click Connectors.",
  },
  {
    image: "/images/mcp-setup/03-add-connector.png",
    title: "Add a custom connector",
    description: 'Click the "Add custom connector" button.',
  },
  {
    image: "/images/mcp-setup/04-name-and-url.png",
    title: "Name it and paste your URL",
    description:
      'Type "Content Master Pro" as the name, then paste the connector URL that Jon gave you. Click Add.',
  },
  {
    image: "/images/mcp-setup/05-configure.png",
    title: "Configure it",
    description:
      "You should see Content Master Pro in your connectors list. Click Configure to set permissions.",
  },
  {
    image: "/images/mcp-setup/06-permissions.png",
    title: "Set permissions",
    description:
      'You\'ll see all the available tools. Set them to "Always allow" so Claude can use them without asking every time. Or leave them on "Ask" if you prefer to approve each use.',
  },
  {
    image: "/images/mcp-setup/07-enable-in-chat.png",
    title: "Turn it on in a chat",
    description:
      "Start a new chat. Click the + button at the bottom, then Connectors, and make sure Content Master Pro is toggled on.",
  },
];

export default function McpPage() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role === "admin") setIsAdmin(true);
    }
    checkAdmin();
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-16">
      {/* Admin banner */}
      {isAdmin && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <Key className="h-5 w-5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Token management</p>
              <p className="text-sm text-muted-foreground">Create, copy, and revoke connector tokens</p>
            </div>
          </div>
          <Link href="/mcp/tokens">
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              Manage tokens
            </Button>
          </Link>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Connect Claude to Content Master Pro</h1>
        <p className="mt-2 text-muted-foreground">
          This gives Claude direct access to your content — posts, Slack ideas, prompt kits, and projects.
          No installs, no config files. Just paste a URL and go.
        </p>
      </div>

      {/* What you can do */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">What you can do once connected</h2>
        <div className="grid gap-3">
          {[
            {
              title: "Browse recent ideas",
              description: "Ask Claude what's been shared in #content-ideas lately. It'll pull up the links, summaries, and any discussion threads.",
            },
            {
              title: "Search the post archive",
              description: "Search across 411+ published newsletter posts. Great for finding what's already been written about a topic.",
            },
            {
              title: "Cross-link content",
              description: "When you're working on something new, Claude will find related older posts you can link to — building a web of connected content.",
            },
            {
              title: "Create and manage projects",
              description: "Start a new content project, add drafts for different platforms, and update them as you revise. Claude tracks versions automatically.",
            },
            {
              title: "Search prompt kits",
              description: "Find and reuse prompt templates that have been saved as project assets.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-lg border border-border bg-card p-4">
              <p className="font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Before you start */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Before you start</h2>
        <p className="text-sm text-muted-foreground">
          You need a <strong>connector URL</strong> from Jon. It looks something like:
        </p>
        <p className="rounded-lg bg-muted px-4 py-3 text-sm font-mono text-foreground break-all">
          https://www.contentmasterpro.limited/api/mcp/cmp__xxxxxxxx...
        </p>
        <p className="text-sm text-muted-foreground">
          This URL has your personal access key built in. Treat it like a password — don&apos;t share it with anyone else.
        </p>
      </section>

      {/* Setup Steps */}
      <section className="space-y-8">
        <h2 className="text-lg font-semibold text-foreground">Setup (takes about 30 seconds)</h2>

        {SETUP_STEPS.map((step, i) => (
          <div key={step.title} className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {i + 1}
              </span>
              <h3 className="font-medium text-foreground">{step.title}</h3>
            </div>
            <p className="text-sm text-muted-foreground ml-10">{step.description}</p>
            <div className="ml-10 overflow-hidden rounded-lg border border-border">
              <Image
                src={step.image}
                alt={step.title}
                width={600}
                height={400}
                className="w-full h-auto"
                unoptimized
              />
            </div>
          </div>
        ))}
      </section>

      {/* Try it out */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Try it out</h2>
        <p className="text-sm text-muted-foreground">
          Once it&apos;s connected, just talk to Claude normally. Here are some things you can ask:
        </p>
        <div className="grid gap-2">
          {[
            "What ideas have been shared in Slack this week?",
            "Search for posts about prompting techniques",
            "Find me related posts I can cross-link to",
            "Create a new project for my next newsletter",
            "Update the draft I just added — here's the new version",
            "What are my current projects?",
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
            <strong className="text-foreground">Not seeing the tools?</strong>{" "}
            Make sure Content Master Pro is toggled on for your chat (step 7 above).
          </div>
          <div>
            <strong className="text-foreground">Getting errors?</strong>{" "}
            Your connector URL may have been revoked. Ask Jon for a new one.
          </div>
          <div>
            <strong className="text-foreground">Search not finding what you expect?</strong>{" "}
            Keep your search terms short — one or two words work best.
            Try &ldquo;prompt&rdquo; instead of &ldquo;prompting techniques for newsletters&rdquo;.
          </div>
        </div>
      </section>
    </div>
  );
}
