# Changelog

All notable changes to Content Master Pro.

## [Unreleased]

### Added
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
