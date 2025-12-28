# Brand Guidelines System

Database-driven brand guidelines with per-prompt defaults and runtime overrides.

## Requirements
- Individual guideline items (granular control)
- Categories: voice, image (extensible)
- Per-prompt defaults in Prompt Manager
- Runtime overrides inline on generation pages
- Auto-discovery: new guidelines = new template variables

---

## Database Schema

### Table: `brand_guidelines`
```sql
CREATE TABLE brand_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,  -- 'voice', 'image', 'tone', etc.
  slug TEXT NOT NULL,      -- 'lej_uniform', 'anti_corporate', etc.
  name TEXT NOT NULL,      -- Display name
  content TEXT NOT NULL,   -- The actual guideline text
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slug)
);

-- RLS: Users can only access their own guidelines
```

### Table: `prompt_guidelines` (junction)
```sql
CREATE TABLE prompt_guidelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_set_id UUID REFERENCES prompt_sets(id) ON DELETE CASCADE,
  guideline_id UUID REFERENCES brand_guidelines(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT true,  -- Include by default
  UNIQUE(prompt_set_id, guideline_id)
);
```

---

## How It Works

### Variable Naming Convention
Category `image` → Variable `{{image_guidelines}}`
Category `voice` → Variable `{{voice_guidelines}}`

All guidelines in a category are concatenated when the variable is interpolated.

### Prompt Flow
1. Load prompt config from `prompt_sets`/`prompt_versions`
2. Load default guidelines from `prompt_guidelines` + `brand_guidelines`
3. Apply runtime overrides (if user toggled any off)
4. Build variables map: `{ voice_guidelines: "...", image_guidelines: "..." }`
5. Interpolate template

---

## Files to Create

### 1. Migration: `supabase/migrations/20241229000001_brand_guidelines.sql`
- Create `brand_guidelines` table with RLS
- Create `prompt_guidelines` junction table
- Seed initial image guidelines from hardcoded values

### 2. Utility: `src/lib/supabase/guidelines.ts`
```typescript
// Load all user guidelines grouped by category
loadUserGuidelines(userId): Record<string, BrandGuideline[]>

// Load default guidelines for a prompt (with optional overrides)
loadPromptGuidelines(promptSetId, userId, overrides?): Record<string, string>
```

### 3. Edge Function utility: `supabase/functions/_shared/guidelines.ts`
Mirror of above for Edge Functions.

### 4. Component: `src/components/guideline-toggle.tsx`
Collapsible panel showing active guidelines with checkboxes.
- Props: `promptSlug`, `onChange(overrides)`
- Shows count when collapsed: "5 guidelines active"
- Expands to show per-category toggles

### 5. Component: `src/components/guidelines-manager.tsx`
Full CRUD for managing guidelines in Settings.
- Tabbed by category
- Add/edit/delete guidelines
- Drag to reorder

---

## Files to Modify

### Generation Pages (add GuidelineToggle)
- `src/app/(dashboard)/draft/page.tsx`
- `src/app/(dashboard)/outputs/page.tsx`
- `src/app/(dashboard)/outline/page.tsx`

### Prompt Manager (add defaults selector)
- `src/app/(dashboard)/prompts/page.tsx`
  - Add "Guidelines" tab in editor dialog
  - Checkbox list of all guidelines
  - Checked = included by default for this prompt

### Settings Page (add Guidelines Manager)
- `src/app/(dashboard)/settings/page.tsx`
  - New "Brand Guidelines" section

### Edge Functions (remove hardcoded, use DB)
- `supabase/functions/generate-image-prompt/index.ts`
  - Remove hardcoded lines 112-118
  - Import and use `loadPromptGuidelines()`
  - Accept `guideline_overrides` in request body

---

## Initial Guidelines to Seed

### Image Category
| Slug | Name | Content |
|------|------|---------|
| `lej_cinematic` | Cinematic Realism | Hyper-realistic, photorealistic - should look like a frame from a high-budget movie |
| `lej_anti_corporate` | Anti-Corporate | Avoid blazers, suits, offices, shared workspaces. Prefer influencer/creator aesthetic. |
| `lej_uniform` | LEJ Uniform | Characters wear fitted crop tops with "LEJ" in bold sans-serif. Black/white or grey/black. |
| `lej_diversity` | Diverse Representation | Prefer female protagonists. Weather-appropriate real clothing. |
| `lej_no_generic` | No Generic Imagery | No clip art, no cheesy illustrations, no glowing brains, no stock photo poses. |

---

## Implementation Order

1. **Database** - Create migrations, run them
2. **Backend utils** - Create `guidelines.ts` for Next.js and Edge Functions
3. **GuidelineToggle component** - Build and test in isolation
4. **Integrate /outputs page** - Add toggle for image generation
5. **Update Edge Function** - Remove hardcoded, use DB
6. **GuidelinesManager** - Add to Settings page
7. **Prompt Manager extension** - Add defaults selector

---

## Critical Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20241229000001_brand_guidelines.sql` | Schema + seed data |
| `src/lib/supabase/guidelines.ts` | Loading/interpolation logic |
| `src/components/guideline-toggle.tsx` | Runtime override UI |
| `supabase/functions/generate-image-prompt/index.ts` | Remove hardcoded (lines 112-118) |
| `src/app/(dashboard)/prompts/page.tsx` | Add defaults selector |
