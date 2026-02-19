# Plan: Thumbnail Generator Page

## Context

Jon built a YouTube thumbnail generator using Google AI Studio (at `~/Downloads/nates-youtube-thumbnail-generator`). The team uses it regularly. He wants this functionality integrated into Content Master Pro as a first-class feature — a new "Thumbnails" sidebar tab where users can generate images, attach reference images, and save results as project assets.

CMP already has **complete backend infrastructure** for image generation (edge function, `generated_images` table, storage bucket, 12+ image models seeded, `image_generator` prompt set) — but **zero UI**. This plan adds the frontend and extends the edge function to support reference images and direct aspect ratio control.

## What the Model Receives

The image generation model gets a structured prompt assembled from:
1. **User image prompt** — the creative description/concept
2. **Image specs** — aspect ratio, dimensions (derived from model config)
3. **Title text** — text to render on the image (e.g. "SHOCKING TRUTH")
4. **Reference image** — an uploaded image sent alongside the prompt for style/composition guidance

## Files to Modify

| File | Change |
|------|--------|
| `src/components/dashboard/sidebar.tsx` | Add "Thumbnails" nav item |
| `supabase/functions/generate/index.ts` | Accept `aspect_ratio` + `reference_image` in request; pass to `callImageModel` |
| `src/hooks/use-generate.ts` | Extend `GenerateOptions` to accept `reference_image` (base64) and `aspect_ratio` |

## Files to Create

| File | Purpose |
|------|---------|
| `src/app/(dashboard)/thumbnails/page.tsx` | Main thumbnails page (client component) |

## Implementation Steps

### Step 1: Extend Edge Function for Reference Images + Aspect Ratio

**File:** `supabase/functions/generate/index.ts`

- Add to `GenerateRequest.overrides`:
  ```typescript
  aspect_ratio?: string;
  ```
- Add to `GenerateRequest` body:
  ```typescript
  reference_image?: string; // base64
  ```
- Update aspect ratio resolution (line ~251) to check `overrides.aspect_ratio` first:
  ```typescript
  const effectiveAspectRatio = overrides?.aspect_ratio
    || (destinationConfig ? getDestinationAspectRatio(destinationConfig) : null);
  ```
- Pass `reference_image` through to `callImageModel` and add it to the API request for providers that support it:
  - **BFL (FLUX Kontext):** Add `image` param to request body (these models have `supports_image_input: true`)
  - **Google/OpenAI:** Skip reference image (not supported via gateway images endpoint)

### Step 2: Extend Client Hook

**File:** `src/hooks/use-generate.ts`

- Add `reference_image?: string` and `aspect_ratio?: string` to `GenerateOptions.overrides`
- These get sent as part of the JSON body to the edge function (no other changes needed — the hook already `JSON.stringify`s the full options object)

### Step 3: Add Sidebar Nav Item

**File:** `src/components/dashboard/sidebar.tsx`

- Add to navigation array:
  ```typescript
  { name: "Thumbnails", href: "/thumbnails", icon: Image }
  ```
- Import `Image` from `lucide-react`

### Step 4: Build Thumbnails Page

**File:** `src/app/(dashboard)/thumbnails/page.tsx`

Single client component with these sections:

**Form (left/top):**
- **Image Prompt** — `Textarea` for the creative concept description
- **Title Text** — `Input` for text to render on the thumbnail (optional). Appended to prompt as: `"Include bold, legible text reading: '{titleText}'"`
- **Reference Image** — File upload with drag-and-drop. Converts to base64. Shows thumbnail preview with remove button. Only enabled when selected model has `supports_image_input: true` in its `image_config`
- **Model Selector** — `Select` dropdown populated from `ai_models` where `model_type = 'image'` and `is_available = true`. Grouped by provider. Shows which models support reference images
- **Aspect Ratio** — `Select` dropdown filtered by selected model's `image_config.supported_aspect_ratios`. Resets to model default when model changes. Presets labeled: "YouTube (16:9)", "Substack (2:1)", "Square (1:1)", etc.
- **Project Selector** — `Select` dropdown from `projects` table (optional, nullable). Label: "Save to project"
- **Generate Button** — Disabled when prompt is empty or loading

**Preview (right/bottom):**
- Shows generated image (from base64 response) in a card
- Metadata badge: model used, aspect ratio, generation time
- **Save to Project** button (if project selected and image exists) — uses `useCreateAsset()` with:
  - `asset_type: 'thumbnail'`
  - `file_url`: the storage URL from the response
  - `metadata`: `{ prompt, title_text, model_used, aspect_ratio, reference_image_used: boolean }`
- **Download** button (creates a blob URL from base64 and triggers download)
- **Regenerate** button (re-runs with same inputs)

**Data fetching (TanStack Query):**
```typescript
// Image models
const { data: models } = useQuery({
  queryKey: ['ai_models', 'image'],
  queryFn: async () => {
    const { data } = await supabase
      .from('ai_models')
      .select('model_id, display_name, provider, image_config, is_available')
      .eq('model_type', 'image')
      .eq('is_available', true)
      .order('provider')
      .order('display_name');
    return data || [];
  }
});

// Projects for save dropdown
const { data: projects } = useQuery({
  queryKey: ['projects', 'list-simple'],
  queryFn: async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, name, project_id')
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  }
});
```

**Generation call:**
```typescript
const { generate, isLoading, result, error } = useGenerate();

// Assemble prompt with title text
let fullPrompt = imagePrompt;
if (titleText) {
  fullPrompt += `\n\nInclude bold, legible text on the image reading: "${titleText}". The text should be high-contrast, prominent, and styled for a YouTube thumbnail.`;
}

await generate({
  prompt_slug: 'image_generator',
  variables: { content: fullPrompt },
  overrides: {
    model_id: selectedModelId,
    aspect_ratio: selectedAspectRatio,
  },
  reference_image: referenceImageBase64 || undefined,
});
```

**Save to project:**
```typescript
const createAsset = useCreateAsset();

await createAsset.mutateAsync({
  project_id: selectedProjectId,
  asset_id: `thumb_${Date.now()}`,
  name: titleText || `Thumbnail (${aspectRatio})`,
  asset_type: 'thumbnail',
  file_url: result.image.storage_url,
  status: 'draft',
  metadata: {
    prompt: imagePrompt,
    title_text: titleText,
    model_used: result.meta.model_used,
    aspect_ratio: selectedAspectRatio,
    reference_image_used: !!referenceImageBase64,
    generated_at: new Date().toISOString(),
  },
});
```

### Step 5: Edge Function — Store Image in Supabase Storage

The current `callImageModel` returns base64 but does **not** store it or return a `storage_url`. We need to add post-generation storage:

After `callImageModel` returns, before building the response:
1. Upload base64 to `generated-images` bucket at path `{user_id}/{uuid}.png`
2. Get public URL
3. Insert row into `generated_images` table
4. Attach `storage_url` to the response

This ensures every generated image is persisted and has a stable URL for project asset references.

## What We're NOT Building (Future)

- AI prompt enhancement (structured form → optimized prompt via text model)
- Template library (pre-built prompts for common styles)
- Batch generation (multiple images per prompt)
- Image editing/cropping
- History/favorites panel
- Negative prompt support

## Verification

1. **Generate image:** Enter a prompt, select a model, pick 16:9, click Generate → image appears
2. **Title text:** Add "BREAKING NEWS" as title → visible in generated image
3. **Reference image:** Upload a reference, select FLUX Kontext model, generate → image reflects reference style
4. **Reference image gating:** Select Imagen 4 → reference upload is disabled with tooltip explaining why
5. **Save to project:** Select a project, generate, click Save → asset appears in that project's Deliverables detail page with `asset_type: 'thumbnail'`
6. **Download:** Click Download → image saves locally as PNG
7. **Aspect ratios:** Switch between 16:9, 2:1, 1:1 → generated images have correct proportions
8. **Dark/light mode:** All text meets WCAG AA contrast in both modes
