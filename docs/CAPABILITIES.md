# Content Master Pro - Capabilities & Internal Workings

> A personal content creation platform that transforms brain dumps into multi-platform deliverables using AI-powered workflows, semantic search, and database-driven configuration.

---

## Table of Contents

1. [Overview](#overview)
2. [Core Features](#core-features)
3. [Technical Architecture](#technical-architecture)
4. [Database Schema](#database-schema)
5. [AI Integrations](#ai-integrations)
6. [API Reference](#api-reference)
7. [Vector Search System](#vector-search-system)
8. [Partner API](#partner-api)
9. [Background Processes](#background-processes)
10. [Future TODOs & Roadmap](#future-todos--roadmap)
11. [Architecture Decisions](#architecture-decisions)
12. [Lessons Learned](#lessons-learned)

---

## Overview

Content Master Pro is a comprehensive content creation platform designed to streamline the process of creating multi-platform content from initial ideas to published deliverables. The platform leverages:

- **AI-Powered Generation**: Claude, Gemini, Perplexity for text; Imagen, FLUX, DALL-E for images
- **Semantic Search**: Vector similarity search across 470+ indexed newsletter posts
- **Database-Driven Configuration**: Zero hardcoded values - all prompts, models, and settings stored in database
- **Multi-Platform Output**: Substack, YouTube, TikTok, Instagram Reels, YouTube Shorts

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Auth & DB | Supabase (PostgreSQL) |
| Vector Search | Pinecone |
| AI | Vercel AI Gateway (Claude, Gemini, Perplexity, Imagen, FLUX) |
| Data Fetching | TanStack Query |
| Testing | Vitest + Testing Library |

---

## Core Features

### 1. Content Creation Pipeline

The core workflow transforms raw ideas into polished multi-platform content through five stages:

#### Stage 1: Brain Dump (`/create`)
- **Input**: Free-form text entry (raw ideas, notes, voice memos transcripts)
- **AI Processing**: Extracts themes, topics, angles, and key points
- **Output**: Structured theme cards for user selection
- **Technology**: Claude Sonnet 4.5 with brain_dump_parser prompt

#### Stage 2: Research (`/research`)
- **Input**: Selected themes from brain dump
- **AI Processing**: Perplexity Sonar Pro fetches relevant research with citations
- **Features**:
  - Search past content (470+ indexed newsletter posts)
  - Commentary panel for user notes
  - Auto-saves notes to database
- **Output**: Research results with citations and user commentary

#### Stage 3: Outline (`/outline`)
- **Input**: Research results + raw brain dump + user commentary
- **AI Processing**: Generates structured content outline
- **Output**:
  - Hook/intro
  - Main sections with subsections
  - Target audience identification
  - Recommended word count
- **Technology**: Claude with outline_generator prompt

#### Stage 4: Draft (`/draft`)
- **Input**: Outline + full context chain
- **AI Processing**: Full draft generation with streaming
- **Features**:
  - Real-time voice scoring (alignment with brand guidelines)
  - Markdown editor with live preview
  - Version history
- **Output**: Complete draft ready for editing

#### Stage 5: Outputs (`/outputs`)
- **Input**: Finalized draft
- **Multi-Platform Generation**:
  - **Substack**: Full post + header images
  - **YouTube**: Scripts, descriptions, SEO titles, thumbnails
  - **TikTok**: 15s, 30s, 60s scripts
  - **YouTube Shorts**: Vertical video scripts
  - **Instagram Reels**: Platform-optimized scripts
- **Image Generation**: AI-generated visuals with brand guidelines

---

### 2. Semantic Search (`/search`)

Full-text semantic search across all indexed content:

- **Technology**: Pinecone with `text-embedding-3-large` (3072 dimensions)
- **Index**: 470+ newsletter posts from Jon and Nate
- **Features**:
  - Results view with relevance scores
  - Chat view with citations (conversational search)
  - Namespace filtering (jon, nate, research, ideas)
  - Cross-reference panel for related content
- **API**: `/api/search` and `/api/search/chat`

---

### 3. News Curation System (Swipe)

Tinder-style interface for curating AI/tech news:

#### Swipe Interface (`/swipe`)
- **Input Sources**: RSS feeds + Perplexity news search
- **Interaction**:
  - Swipe right → Save with optional commentary
  - Swipe left → Dismiss
- **Features**:
  - PWA support for mobile use
  - iOS install prompt
  - Changelog ingestion system

#### Captures (`/captures`)
- Saved news items with user commentary
- Searchable archive
- Quick reference during content creation

---

### 4. Content Calendar & Project Management

#### Calendar View (`/calendar`)
- Calendar grid layout
- Drag-and-drop project scheduling
- Status workflow: `draft` → `review` → `scheduled` → `published`
- Visual project cards with metadata

#### Projects (`/projects`)
- **Project Structure**:
  - ID format: `yyyymmdd_xxx` (date-based)
  - Multiple assets per project
  - Target platforms tracking
- **Asset Types**:
  - Posts (Substack articles)
  - Transcripts (YouTube scripts)
  - Descriptions (SEO descriptions)
  - Prompts (AI generation prompts)
  - Guides (reference materials)

#### Asset Management (`/projects/[id]/assets/[assetId]`)
- Rich text editor
- Version history with rollback
- Edit locking (prevents concurrent edits)
- Publication tracking

---

### 5. Studio (Admin Configuration)

Full administrative control over AI behavior and platform configuration:

#### Prompt Management (`/studio/prompts`)
- **CRUD Operations**: Create, read, update, delete prompt sets
- **Version Control**: `draft` → `active` → `archived` workflow
- **Features**:
  - Variable interpolation (`{{variable_name}}`)
  - Model selection per prompt
  - Temperature and token limit controls
  - Guideline defaults per prompt

#### Model Configuration (`/studio/models`)
- All AI models synced from Vercel AI Gateway
- 18+ models across text, image, and research categories
- Extended Thinking support for Claude models
- Provider-specific configuration

#### Destinations (`/studio/destinations`)
- Platform-specific configuration
- Output format templates
- Character limits and constraints

#### Guidelines (`/studio/guidelines`)
- Brand voice guidelines
- Style guides
- Tone preferences
- Per-prompt guideline defaults

#### Prompt Testing (`/studio/test`)
- Live prompt testing interface
- Variable interpolation preview
- Token estimation
- Real-time response preview

#### AI Call Logs (`/studio/logs`)
- Complete audit trail
- Full prompt and response logging
- Token usage tracking
- Duration metrics

---

### 6. Settings & Configuration

#### User Settings (`/settings`)
- Personal preferences
- Guideline overrides
- Account management

#### Sync Status (`/sync`)
- Newsletter sync status
- Import progress tracking
- Error reporting

---

## Technical Architecture

### Application Structure

```
content-master-pro/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Auth pages (login, signup)
│   │   ├── (dashboard)/        # Protected routes
│   │   │   ├── admin/          # Admin-only routes
│   │   │   ├── partner/        # Partner dashboard
│   │   │   └── studio/         # Prompt/model configuration
│   │   └── api/                # API routes
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── calendar/           # Calendar components
│   │   ├── projects/           # Project management
│   │   ├── swipe/              # News curation
│   │   └── dashboard/          # Layout components
│   ├── lib/
│   │   ├── supabase/           # Database clients
│   │   ├── pinecone/           # Vector search
│   │   ├── ai/                 # Embeddings
│   │   └── partner-api/        # Partner API utilities
│   └── hooks/                  # Custom React hooks
├── supabase/
│   ├── functions/              # Edge Functions
│   └── migrations/             # Database migrations (61 files)
├── scripts/                    # Automation scripts
└── docs/                       # Documentation
```

### Key Design Principles

1. **Database-Driven Configuration**: No hardcoded values. All prompts, models, settings, and configurations stored in database.

2. **Universal Edge Function**: Single `/functions/v1/generate` endpoint handles all AI generation:
   - Text generation (Claude, Gemini)
   - Image generation (Imagen, FLUX, DALL-E)
   - Research queries (Perplexity)

3. **Full AI Logging**: Every AI call logged with:
   - Complete prompt sent
   - Full response received
   - Token counts (in/out)
   - Duration metrics

4. **Row-Level Security**: All database tables protected with RLS policies.

5. **SSE Streaming**: Long AI responses streamed via Server-Sent Events.

---

## Database Schema

### Content Pipeline Tables

| Table | Purpose |
|-------|---------|
| `content_sessions` | Full pipeline state tracking |
| `content_brain_dumps` | Raw input with extracted themes |
| `content_research` | Perplexity research results |
| `content_outlines` | Generated outlines |
| `content_drafts` | Drafts with voice scores |
| `content_outputs` | Final deliverables |

### AI & Configuration Tables

| Table | Purpose |
|-------|---------|
| `ai_models` | Model configurations (18+ models) |
| `prompt_sets` | Prompt groupings by purpose |
| `prompt_versions` | Versioned prompts with status |
| `ai_call_logs` | Complete audit trail |
| `app_settings` | All configurable values |
| `brand_guidelines` | Voice/style guidelines |
| `prompt_guidelines` | Per-prompt guideline defaults |
| `destinations` | Platform configurations |

### Content Library Tables

| Table | Purpose |
|-------|---------|
| `imported_posts` | Synced newsletter posts |
| `sync_manifests` | Sync status tracking |
| `pinecone_namespaces` | Namespace configuration |

### Project Management Tables

| Table | Purpose |
|-------|---------|
| `nate_content_projects` | Content projects |
| `nate_project_assets` | Project assets |
| `nate_asset_versions` | Version history |
| `nate_project_publications` | Publication tracking |

### Ideas & Captures Tables

| Table | Purpose |
|-------|---------|
| `idea_clusters` | Semantic idea groupings |
| `slack_ideas` | Captured ideas |
| `changelog_items` | News items from feeds |
| `swipe_captures` | Saved swipe captures |

### Partner API Tables

| Table | Purpose |
|-------|---------|
| `partner_invites` | Invite codes |
| `partners` | Partner accounts |
| `partner_api_keys` | API keys (hashed) |
| `partner_namespace_permissions` | Access control |
| `partner_api_usage` | Usage logging |

---

## AI Integrations

### Vercel AI Gateway

All AI calls route through Vercel AI Gateway using OpenAI-compatible format:

- **Endpoint**: `https://ai-gateway.vercel.sh/v1/chat/completions`
- **Auth**: `Authorization: Bearer ${VERCEL_AI_GATEWAY_API_KEY}`

### Text Generation Models

| Model ID | Provider | Use Case |
|----------|----------|----------|
| `anthropic/claude-sonnet-4-5` | Anthropic | Primary text generation |
| `anthropic/claude-haiku-4-5` | Anthropic | Fast, cost-effective |
| `anthropic/claude-opus-4-5` | Anthropic | Complex reasoning |
| `google/gemini-2.0-flash` | Google | Fast multimodal |
| `google/gemini-2.5-pro` | Google | Advanced reasoning |
| `perplexity/sonar-pro` | Perplexity | Web research with citations |

### Image Generation Models

| Model ID | Provider | Use Case |
|----------|----------|----------|
| `google/gemini-3-pro-image` | Google | Advanced diagrams, web search |
| `google/imagen-4.0-generate` | Google | Standard quality |
| `google/imagen-4.0-ultra-generate` | Google | Highest quality |
| `openai/dall-e-3` | OpenAI | Creative imagery |
| `bfl/flux-2-pro` | Black Forest Labs | Latest FLUX model |
| `bfl/flux-pro-1.1-ultra` | Black Forest Labs | High quality |
| `bfl/flux-kontext-pro` | Black Forest Labs | Context-aware editing |

### Extended Thinking (Claude)

Claude models support Extended Thinking for complex reasoning:

- `supports_thinking` flag in `ai_models` table
- Temperature must be omitted when reasoning enabled
- Budget tokens must be less than max_tokens
- Reasoning returned separately from content

---

## API Reference

### Internal API Routes

#### Search
- `POST /api/search` - Semantic search endpoint
- `POST /api/search/chat` - Conversational search with citations

#### Research
- `POST /api/research/save` - Save research results
- `POST /api/research/search` - Search research
- `POST /api/research/embed` - Embed research in Pinecone

#### Sync
- `POST /api/sync` - Content sync endpoint

#### Admin
- `POST /api/admin/sync-models` - Sync AI models from Vercel Gateway
- `GET/POST /api/admin/invites` - Partner invite management
- `GET/POST /api/admin/partners` - Partner management
- `POST /api/admin/partners/permissions` - Namespace permissions

#### Cron
- `POST /api/cron/ingest-changelogs` - Changelog ingestion
- `POST /api/cron/sync` - Automated sync

### Partner API (External)

- `POST /api/v1/search` - Semantic search (API key required)
- `GET /api/v1/namespaces` - List accessible namespaces

---

## Vector Search System

### Pinecone Configuration

- **Index**: `content-master-pro-v2`
- **Embedding Model**: `text-embedding-3-large` (3072 dimensions)
- **Total Vectors**: 1,670+ across all namespaces

### Namespaces

| Namespace | Description | Vectors |
|-----------|-------------|---------|
| `jon` | Jon's newsletter posts | ~60 |
| `nate` | Nate's newsletter posts | ~1,670 |
| `research` | Saved research results | Dynamic |
| `ideas` | Captured ideas | Dynamic |
| `official-docs` | Documentation | Dynamic |

### Search Features

- Semantic similarity search
- Namespace filtering
- Metadata filtering (author, date, source)
- Chunk-level search with context
- Cross-reference panel

---

## Partner API

### Overview

REST API for third-party access to semantic search capabilities.

### Authentication

- API keys generated via partner dashboard
- Keys are hashed before storage
- Include in `Authorization: Bearer <api_key>` header

### Rate Limiting

- Per-minute rate limits
- Per-day rate limits
- Configurable per partner

### Access Control

- Namespace-based permissions
- Read/write access levels
- Admin-configurable per partner

### Partner Dashboard

- `/partner` - Partner home
- `/partner/keys` - API key management
- `/partner/usage` - Usage statistics
- `/partner/redeem` - Invite redemption

---

## Background Processes

### Automated Scripts

| Script | Purpose |
|--------|---------|
| `scripts/sync-nate-full.ts` | Full content sync (Chrome CDP) |
| `scripts/daily-sync.sh` | Daily sync wrapper |
| `scripts/manage-sync-schedule.sh` | macOS LaunchAgent management |
| `scripts/sync-ai-models.ts` | Sync models from Vercel Gateway |
| `scripts/import-posts.ts` | Import posts to Pinecone |
| `scripts/ingest-changelogs.ts` | Changelog ingestion |
| `scripts/reindex-all.ts` | Reindex all content |

### Cron Jobs

- **Changelog Ingestion**: `/api/cron/ingest-changelogs`
- **Content Sync**: `/api/cron/sync`

### Edge Functions

- **Generate**: `/functions/v1/generate` - Universal AI generation

---

## Future TODOs & Roadmap

### High Priority

1. **Implement Semantic Search for Cross-References**
   - Location: `supabase/functions/_shared/variables.ts:265`
   - Status: TODO in code
   - Description: Add semantic search functionality for cross-reference variable resolution

2. **Implement Destination Requirements Assembly**
   - Location: `supabase/functions/_shared/variables.ts:280`
   - Status: TODO in code
   - Description: Assembly logic for platform-specific requirements

3. **Save Research Results to RAG**
   - Save all research results to Pinecone
   - Build comprehensive research resource library
   - Query previous research when generating summaries

4. **Fix Text Overflow Issues**
   - Fix text overflow throughout the app
   - Ensure proper module/card imports
   - Prevent text from overflowing bounds

5. **Reference Images for Image Generation**
   - Store reference images in brand guidelines
   - Allow attaching reference images when generating image assets

### Medium Priority

1. **Content Calendar Migration Script (Phase 7)**
   - Create script to import existing content
   - Parse markdown files
   - Extract dates, titles, links, notes
   - Create projects and asset stubs
   - Preserve Google Doc URLs as external_url

2. **Chat Mode for Search**
   - Currently placeholder in search page
   - Implement conversational search interface

3. **Analytics Dashboard**
   - Track AI call costs
   - Monitor token usage
   - Cost optimization insights

4. **Export Functionality**
   - Download drafts as markdown
   - Export as HTML
   - Platform-specific export formats

### Low Priority

1. **Add More Newsletters**
   - Test sync with various Substack publications
   - Expand content library

2. **Production Deployment Configuration**
   - Deploy to Vercel
   - Configure cron secrets
   - Environment setup

3. **Additional Testing & Optimization**
   - Increase test coverage
   - Performance optimization
   - Error handling improvements

---

## Architecture Decisions

### ADR-001: Extended Thinking for Claude Models (2024-12-30)

- Added `supports_thinking` column to `ai_models` table
- Temperature must be omitted when reasoning is enabled
- Budget tokens must be less than max_tokens
- Reasoning returned separately from content

### ADR-002: Universal Edge Function (2024-12-28)

- Consolidated 10+ Edge Functions into one `/functions/v1/generate` endpoint
- Three model types: text, image, research
- Provider-specific image config:
  - Google: `aspectRatio`
  - OpenAI: `size`
  - BFL: `width/height`

### ADR-003: Brand Guidelines System (2024-12-29)

- Database-driven brand guidelines replacing hardcoded values
- Junction table pattern for many-to-many relationships
- Template variable naming convention: `{{category_guidelines}}`

### ADR-004: Session Persistence (2024-12-29)

- Database > SessionStorage for persistence
- Full context flow through pipeline
- User commentary preserved as critical context

---

## Lessons Learned

### Technical Lessons

1. **Vercel AI Gateway Format**
   - Uses OpenAI-compatible API format (not native Anthropic)
   - Response: `choices[0].message.content` (not `content[0].text`)

2. **Model Type Determines API Pattern**
   - Text models: `/chat/completions`
   - Image models: `/images/generations`
   - Research models: Custom citation parsing

3. **Context Must Flow End-to-End**
   - User's original voice gets lost with only bullet points
   - Always include raw source material in context chain

4. **Database > SessionStorage**
   - SessionStorage is ephemeral (lost on tab close)
   - Store everything in database for true session resume

5. **Prompt Studio Should Control Models**
   - Hardcoded model overrides violate Rule 1
   - Database is the single source of truth

### Project Patterns

1. **Color Management**
   - All colors use CSS variables from `globals.css`
   - Use semantic classes: `text-foreground`, `bg-background`
   - Never hardcode: `text-white`, `text-black`

2. **Component Library**
   - shadcn/ui with `-d` flag for defaults
   - Use `-y` flag to skip prompts

3. **Next.js 15+ Setup**
   - React Compiler: Choose "No" (experimental)
   - Tailwind CSS v4 is default

---

## Quick Reference

### Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run lint     # Run ESLint
npm run test     # Run Vitest tests
npm run format   # Run Prettier
```

### Key Files

| File | Purpose |
|------|---------|
| `src/lib/supabase/client.ts` | Browser Supabase client |
| `src/lib/supabase/server.ts` | Server component client |
| `src/lib/pinecone/client.ts` | Pinecone client |
| `src/lib/utils.ts` | Utility functions |
| `middleware.ts` | Auth route protection |

### Environment Variables

```bash
NEXT_PUBLIC_SUPABASE_URL      # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY     # Server-side operations
PINECONE_API_KEY              # Pinecone API key
PINECONE_HOST                 # Pinecone index host
VERCEL_AI_GATEWAY_API_KEY     # AI Gateway key
```

---

*Last updated: February 2026*
