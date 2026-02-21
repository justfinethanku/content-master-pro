# Content Master Pro

A personal content creation platform for Nate Jones Media LLC. Manages the full lifecycle from project planning through deliverable creation, AI-assisted prompt kit generation, and multi-platform publishing.

## What it does

### Deliverables

The core of the app. Projects contain multiple **assets** — a Substack post, a prompt kit, a guide, a thumbnail — each tracked with versioning and status management (draft → ready → review → final → published → archived).

- Create projects from pasted content or from scratch
- AI-powered **prompt kit conversion** — transforms a post into a companion prompt kit
- AI-generated **preambles** that hook readers and link to the prompt kit
- Full markdown editor with rich text copy, version history, and side-by-side prompt kit panel
- Asset ID convention: `{project_id}_{type}_{platform}_{variant}`

### Calendar

Visual calendar view for scheduling and tracking content across time. Shows project cards with asset type badges and status.

### Thumbnails

AI image generation using BFL FLUX (Kontext Pro/Max) via Vercel AI Gateway and Google Gemini via direct provider. Supports reference image editing and saves generated images as project assets.

### Studio

Backend configuration for the AI pipeline:
- **Prompts** — Database-driven prompt management with versioning (draft → active → archived)
- **Models** — AI model registry synced from Vercel AI Gateway
- **Logs** — Full audit trail of every AI call (prompt, response, tokens, duration)
- **Destinations** — Output platform configuration with aspect ratios and requirements
- **Guidelines** — Voice and style guidelines injected into AI generation

### MCP Server

Internal MCP server for managing content through AI clients (Claude Desktop, etc.). Full CRUD on projects and assets, semantic search across indexed posts, and cross-reference suggestions.

### Executive Circle

Subscriber-facing MCP for paid Substack tier members. Read-only access to published posts and prompt kits from their AI clients. Self-service registration at `promptkit.natebjones.com/executive/mcp` with rate limiting (120 req/min, 2,000 req/day).

### Prompt Kit Presenter

Companion app ([separate repo](../prompt-kit-presenter)) that displays published prompt kits at `promptkit.natebjones.com/{assetId}`. Reads directly from the same Supabase database — no sync needed. See [docs/prompt-kit-pipeline.md](./docs/prompt-kit-pipeline.md).

### Content Sync

Imports newsletter archives into the platform for indexing and cross-referencing. Nate's newsletter sync uses CDP-based browser authentication.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Auth & DB | Supabase (PostgreSQL + Auth + Edge Functions) |
| Vector Search | Pinecone (multi-namespace) |
| AI Gateway | Vercel AI Gateway (Claude, Gemini, Perplexity) |
| AI SDK | Vercel AI SDK (`generateImage()` for BFL + Gemini) |
| Data Fetching | TanStack Query |
| Testing | Vitest |

## Getting Started

### Prerequisites

- Node.js 20+
- Supabase project (or local via Docker)
- Pinecone index
- Vercel AI Gateway API key
- Google AI API key (for Gemini image generation)

### Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
PINECONE_API_KEY=your_pinecone_key
PINECONE_HOST=your_pinecone_host
VERCEL_AI_GATEWAY_API_KEY=your_gateway_key
GOOGLE_GENERATIVE_AI_API_KEY=your_google_key
```

### Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Local Supabase

Requires Docker Desktop:

```bash
npm run supabase:start     # Start local containers
npm run supabase:seed-user # Create test user (test@example.com / password123)
npm run supabase:stop      # Stop containers
```

### Other Commands

```bash
npm run lint       # ESLint
npm run format     # Prettier
npm run test       # Vitest (watch mode)
npx vitest run     # Run tests once
npm run build      # Production build
```

## Documentation

- [CLAUDE.md](./CLAUDE.md) — Engineering rules, architecture, database schema
- [CHANGELOG.md](./CHANGELOG.md) — All changes (reverse chronological)
- [docs/prompt-kit-pipeline.md](./docs/prompt-kit-pipeline.md) — CMP ↔ Prompt Kit Presenter data flow

## License

Private — not for redistribution.
