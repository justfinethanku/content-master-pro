# Changelog

All notable changes to Content Master Pro.

## [Unreleased]

### Added
- **Meta Prompt Assembly System Refactor (Phase 4)** - Prompt Studio UI
  - Created `/studio` with 5 tabs: Templates, Models, Destinations, Guidelines, Test
  - **Templates tab**: Full prompt editor with model selection, temperature/max_tokens, version history, preview with variable interpolation, guideline defaults
  - **Models tab**: All AI models displayed by provider with type badges (TEXT/IMAGE/RESEARCH), editable prompting tips, format preferences, default parameters
  - **Destinations tab**: Platform configuration editor with specs JSON, prompt instructions, tone modifiers, create/edit/delete
  - **Guidelines tab**: Integrated GuidelinesManager component for brand guidelines
  - **Test tab (killer feature)**:
    - Select template, optional model override, optional destination
    - Enter test variables with auto-detected placeholders
    - Live assembled prompt preview with token estimate
    - Execute test against real AI with streaming response
    - Display response with metadata (model used, tokens in/out, duration)
    - Support for text, image, and research responses with citations
  - Updated sidebar navigation: replaced "Prompts" with "Studio"
  - Added shadcn Switch component

- **Meta Prompt Assembly System Refactor (Phase 5)** - Cleanup and deployment
  - Removed 10 deprecated edge functions (check-voice, generate-draft, generate-headlines, generate-image, generate-image-prompt, generate-outlines, generate-research, generate-tiktok-script, generate-youtube-script, parse-brain-dump)
  - All generation now uses single universal `/functions/v1/generate` endpoint
  - Added `image_generator` prompt set for direct image generation passthrough
  - Fixed prompt slug mismatches between frontend and database:
    - `generate_research` → `research_generator`
    - `generate_outlines` → `outline_generator`
    - `generate_draft` → `draft_writer_substack`
    - `check_voice` → `voice_checker`
    - `generate_youtube_script` → `youtube_script_writer`
    - `generate_tiktok_script` → `tiktok_script_writer`
    - `generate_image_prompt` → `image_prompt_generator`
    - `generate_image` → `image_generator`

- **Meta Prompt Assembly System Refactor (Phase 3)** - Frontend migration to universal endpoint
  - Created `useGenerate()` hook for universal AI generation
  - Created `useGenerateJSON<T>()` convenience hook with automatic JSON parsing
  - Created `useResearch()` convenience hook for Perplexity research with citations
  - Migrated `/create` page to use new hook
  - Migrated `/research` page to use new hook
  - Migrated `/outline` page to use new hook
  - Migrated `/draft` page to use new hook (streaming support)
  - Migrated `/outputs` page to use new hook (4 generation types)

- **Meta Prompt Assembly System Refactor (Phase 2)** - Universal Edge Function
  - Created `supabase/functions/generate/index.ts` - single endpoint for all AI generation
  - Created `supabase/functions/_shared/models.ts` - model configuration loader
  - Created `supabase/functions/_shared/destinations.ts` - destination configuration loader
  - Supports three model types: text, image, research (each with different API patterns)
  - Provider-specific image config: Google (aspectRatio), OpenAI (size), BFL (width/height)
  - Destination-aware assembly with automatic requirement injection
  - SSE streaming support for text models
  - Full AI logging to `ai_call_logs` table

- **Meta Prompt Assembly System Refactor (Phase 1)** - Database foundation for unified AI generation
  - Extended `ai_models` table with `model_type` classification (text/image/research)
  - Added prompting guidance columns: `system_prompt_tips`, `preferred_format`, `format_instructions`, `quirks`
  - Added type-specific JSONB configs: `image_config` (for image models), `research_config` (for Perplexity)
  - Added default parameters: `default_temperature`, `default_max_tokens`
  - Added API specifics: `api_endpoint_override`, `api_notes`
  - Created `destinations` table for platform-specific output configuration (YouTube, TikTok, Substack, LinkedIn, Twitter, etc.)
  - Added `examples` column to `brand_guidelines` for demonstration content
  - Seeded 8 destinations across video, social, and newsletter categories
  - Configured all 18+ AI models with comprehensive type-specific settings
  - Added Nano Banana Pro (google/gemini-3-pro-image) with special capabilities
  - Migrated voice_guidelines to brand_guidelines with category='voice'
- **Refactor Planning** - Created comprehensive plan at `plans/meta-prompt-assembly-refactor.md`
- **Brand Guidelines System** - Database-driven brand guidelines replacing hardcoded values
  - `brand_guidelines` table with RLS for storing user guidelines
  - `prompt_guidelines` junction table for per-prompt defaults
  - `GuidelinesManager` component for full CRUD in Settings
  - `GuidelineToggle` component for runtime overrides on generation pages
  - Guidelines tab in Prompt Manager for setting per-prompt defaults
  - Template variables auto-named by category (`{{image_guidelines}}`, `{{voice_guidelines}}`)
  - Default LEJ image guidelines auto-seeded for new users
- Initial Next.js 15 project setup with App Router
- Tailwind CSS v4 configuration
- shadcn/ui components: button, card, input, textarea, label, badge, separator, sheet, dialog, dropdown-menu, tabs, tooltip, avatar, checkbox, collapsible
- Supabase client dependencies (@supabase/supabase-js, @supabase/ssr)
- Pinecone client dependency (@pinecone-database/pinecone)
- TanStack Query for data fetching
- Vercel AI SDK
- Testing setup (Vitest, Testing Library)
- Prettier for formatting
- Project documentation (CLAUDE.md, BUILD_LOG.md, CHANGELOG.md)
- Environment configuration (.env.local, .env.example)

### Changed
- `generate-image-prompt` Edge Function now loads guidelines from database instead of hardcoded values
- Settings page now includes Brand Guidelines section at top
- Prompts page editor dialog now has tabbed interface with Prompt and Guidelines tabs
