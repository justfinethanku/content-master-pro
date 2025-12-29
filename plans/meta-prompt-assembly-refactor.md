# Meta Prompt Assembly System Refactor

## Problem Statement

The current prompt system has 10 separate edge functions that all do essentially the same thing: load a prompt template, load settings, load guidelines, interpolate variables, call AI, and log the result. This creates:

- 10 functions doing the same assembly dance
- Platform specs hardcoded in edge functions
- No model-specific prompting guidance
- Confusing split between /prompts and /settings pages
- Two conflicting model selection strategies (prompt config vs app_settings)
- No way to preview what prompt actually gets sent

**Goal:** One universal edge function + one coherent admin UI (Prompt Studio) where everything about prompts, models, and destinations lives in one place.

---

## Current State Analysis

### What We Have

```
10 edge functions (duplicated logic)
├── prompt_sets + prompt_versions (templates) ✅ Works well
├── ai_models (basic info only) ⚠️ Needs extension
├── brand_guidelines (injectable content) ✅ Works well
├── voice_guidelines (legacy) ❌ Redundant
├── app_settings (model defaults scattered here) ⚠️ Confusing
├── _shared/prompts.ts (loadActivePromptConfig) ✅ Good foundation
├── _shared/guidelines.ts (buildGuidelineVariables) ✅ Good foundation
├── _shared/ai.ts (callAI + logging) ✅ Good but limited
└── 2 UI pages with overlapping concerns
```

### Three Model Types Discovered

| Type | Endpoint | How Called | Response Format | Special Config |
|------|----------|------------|-----------------|----------------|
| `text` | `/v1/chat/completions` | Direct fetch or `callAI()` | `choices[0].message.content` | temperature, max_tokens, streaming |
| `image` | Vercel AI SDK | `generateText()` | `files[0].base64` | Provider-specific: Google (aspectRatio), BFL (width/height) |
| `research` | `/v1/chat/completions` | Direct fetch | content + `citations[]` | Lower temperature, citation extraction |

### Current Model Selection Confusion

- **7 functions**: Model from `prompt_versions.model_id` (correct approach)
- **2 functions**: Model from `app_settings` (research, draft — why?)
- **1 function**: Hardcoded in code (image — bad)

**Decision:** ALL models should come from prompt config, with optional runtime override.

---

## Target Architecture

### Database Schema

#### 1. Extend `ai_models` table

```sql
ALTER TABLE ai_models ADD COLUMN
  -- Model classification
  model_type TEXT NOT NULL DEFAULT 'text'
    CHECK (model_type IN ('text', 'image', 'research')),

  -- Prompting guidance (for text/research models)
  system_prompt_tips TEXT,              -- "Use XML tags for structure"
  preferred_format TEXT,                -- 'xml', 'markdown', 'json', 'plain'
  format_instructions TEXT,             -- "Wrap sections in <section> tags"
  quirks JSONB DEFAULT '[]',            -- ["verbose", "ignores system prompt sometimes"]

  -- Image generation config (for image models only)
  image_config JSONB,                   -- {
                                        --   "provider_options_key": "google" | "bfl" | "openai",
                                        --   "supported_aspect_ratios": ["1:1", "16:9", "9:16"],
                                        --   "default_aspect_ratio": "16:9",
                                        --   "supports_negative_prompt": false,
                                        --   "max_prompt_length": 4000,
                                        --   "quality_options": ["standard", "hd"],
                                        --   "dimension_mode": "aspect_ratio" | "pixels",
                                        --   "default_dimensions": {"width": 1024, "height": 1024}
                                        -- }

  -- Research config (for research models only)
  research_config JSONB,                -- {
                                        --   "returns_citations": true,
                                        --   "search_recency_options": ["day", "week", "month", "year"],
                                        --   "default_recency": "month"
                                        -- }

  -- API specifics
  api_endpoint_override TEXT,           -- If different from default gateway
  api_notes TEXT,                       -- Developer notes

  -- Defaults
  default_temperature NUMERIC(3,2) DEFAULT 0.7,
  default_max_tokens INTEGER DEFAULT 4096;
```

#### 2. Create `destinations` table

```sql
CREATE TABLE destinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,            -- 'youtube', 'tiktok', 'substack'
  name TEXT NOT NULL,                   -- 'YouTube'
  category TEXT NOT NULL,               -- 'video', 'social', 'newsletter'

  -- Platform constraints
  specs JSONB NOT NULL DEFAULT '{}',    -- {
                                        --   "video": {
                                        --     "aspect_ratio": "16:9",
                                        --     "max_duration_seconds": 600,
                                        --     "thumbnail_size": "1280x720"
                                        --   },
                                        --   "text": {
                                        --     "max_characters": null,
                                        --     "supports_markdown": true,
                                        --     "supports_html": false
                                        --   }
                                        -- }

  -- Prompt adjustments
  prompt_instructions TEXT,             -- "Write for spoken delivery. Include [VISUAL CUE] markers."
  tone_modifiers JSONB DEFAULT '[]',    -- ["conversational", "hook-driven", "visual"]

  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### 3. Add `examples` to `brand_guidelines`

```sql
ALTER TABLE brand_guidelines ADD COLUMN
  examples JSONB DEFAULT '[]';          -- Sample content demonstrating this guideline
```

#### 4. Seed initial destinations

```sql
INSERT INTO destinations (slug, name, category, specs, prompt_instructions) VALUES
  ('substack', 'Substack', 'newsletter',
   '{"text": {"supports_markdown": true, "supports_html": true}}',
   'Write for reading. Use headers, subheads, and pull quotes. Optimize for email preview.'),

  ('youtube', 'YouTube', 'video',
   '{"video": {"aspect_ratio": "16:9", "max_duration_seconds": 600, "thumbnail_size": "1280x720"}}',
   'Write for spoken delivery. Include [B-ROLL] and [VISUAL CUE] markers. Hook in first 30 seconds.'),

  ('tiktok', 'TikTok', 'video',
   '{"video": {"aspect_ratio": "9:16", "max_duration_seconds": 60}}',
   'Hook immediately. Fast-paced delivery. End with CTA or question.'),

  ('youtube_shorts', 'YouTube Shorts', 'video',
   '{"video": {"aspect_ratio": "9:16", "max_duration_seconds": 60}}',
   'Vertical format. Immediate hook. No intro, straight to value.'),

  ('instagram_reels', 'Instagram Reels', 'video',
   '{"video": {"aspect_ratio": "9:16", "max_duration_seconds": 90}}',
   'Visual-first. Text overlays encouraged. End with engagement prompt.'),

  ('linkedin', 'LinkedIn', 'social',
   '{"text": {"max_characters": 3000, "supports_markdown": false}}',
   'Professional tone. Lead with insight. Use line breaks for readability.'),

  ('twitter', 'Twitter/X', 'social',
   '{"text": {"max_characters": 280, "supports_markdown": false}}',
   'Punchy. Thread-friendly. Hook in first line.');
```

#### 5. Seed model configs

Update existing ai_models with type and config:

```sql
-- Text models
UPDATE ai_models SET
  model_type = 'text',
  system_prompt_tips = 'Claude responds well to XML-structured prompts. Use <context>, <instructions>, <examples> tags.',
  preferred_format = 'xml',
  default_temperature = 0.7
WHERE provider = 'anthropic';

UPDATE ai_models SET
  model_type = 'text',
  system_prompt_tips = 'Gemini works well with clear, direct instructions. Use markdown for structure.',
  preferred_format = 'markdown',
  default_temperature = 0.7
WHERE model_id = 'google/gemini-2.0-flash';

-- Research models
UPDATE ai_models SET
  model_type = 'research',
  system_prompt_tips = 'Perplexity will search the web. Be specific about what information you need.',
  research_config = '{"returns_citations": true, "default_recency": "month"}',
  default_temperature = 0.3
WHERE provider = 'perplexity';

-- Image models (Google)
UPDATE ai_models SET
  model_type = 'image',
  system_prompt_tips = 'Be specific about composition, lighting, and style. Avoid text in images.',
  image_config = '{
    "provider_options_key": "google",
    "dimension_mode": "aspect_ratio",
    "supported_aspect_ratios": ["1:1", "16:9", "9:16", "4:3", "3:4"],
    "default_aspect_ratio": "16:9",
    "supports_negative_prompt": false
  }'
WHERE model_id LIKE 'google/gemini%image%' OR model_id LIKE 'google/imagen%';

-- Image models (BFL/FLUX)
UPDATE ai_models SET
  model_type = 'image',
  system_prompt_tips = 'FLUX excels at photorealism. Be specific about lighting and composition.',
  image_config = '{
    "provider_options_key": "bfl",
    "dimension_mode": "pixels",
    "default_dimensions": {"width": 1024, "height": 1024},
    "supported_dimensions": [
      {"width": 1024, "height": 1024},
      {"width": 1920, "height": 1080},
      {"width": 1080, "height": 1920}
    ],
    "supports_negative_prompt": true
  }'
WHERE provider = 'bfl';

-- Image models (OpenAI)
UPDATE ai_models SET
  model_type = 'image',
  system_prompt_tips = 'DALL-E works best with detailed scene descriptions. Avoid complex text.',
  image_config = '{
    "provider_options_key": "openai",
    "dimension_mode": "size",
    "supported_sizes": ["1024x1024", "1792x1024", "1024x1792"],
    "default_size": "1024x1024",
    "quality_options": ["standard", "hd"],
    "supports_negative_prompt": false
  }'
WHERE provider = 'openai' AND model_id LIKE '%dall-e%';
```

#### 6. Clean up app_settings

Remove model defaults (now in ai_models) and per-function settings (now in prompt config):

```sql
-- Settings to REMOVE (now handled by prompt config or ai_models)
DELETE FROM app_settings WHERE key IN (
  'parse_brain_dump_model',
  'generate_research_model',
  'generate_outlines_model',
  'draft_writer_model',
  'voice_checker_model',
  'headline_generator_model',
  'image_generator_model',
  'image_generator_fallback_model'
);

-- Settings to KEEP (actual system config)
-- ai_call_log_retention_days
-- max_sessions_per_user
```

#### 7. Migrate voice_guidelines to brand_guidelines

```sql
-- Copy voice_guidelines to brand_guidelines with category='voice'
INSERT INTO brand_guidelines (user_id, category, slug, name, content, examples, is_active, sort_order)
SELECT
  user_id,
  'voice',
  'voice_' || LOWER(REPLACE(name, ' ', '_')),
  name,
  guidelines,
  examples,
  true,
  0
FROM voice_guidelines;

-- After verification, drop the table
-- DROP TABLE voice_guidelines;
```

---

## Universal Edge Function

### Endpoint

```
POST /functions/v1/generate
```

### Request Schema

```typescript
interface GenerateRequest {
  // What task to perform
  prompt_slug: string;                  // 'write_draft', 'generate_headlines', etc.

  // Session context (for logging and state)
  session_id?: string;

  // Runtime variables (the actual content)
  variables: Record<string, string>;    // { outline: "...", title: "..." }

  // Optional overrides
  overrides?: {
    model_id?: string;                  // Override default model
    destination_slug?: string;          // Apply destination requirements
    temperature?: number;               // Override default temperature
    max_tokens?: number;                // Override default max_tokens
    guideline_overrides?: Record<string, boolean>; // Include/exclude specific guidelines
  };

  // Response options
  stream?: boolean;                     // Enable SSE streaming (text models only)
}
```

### Response Schema

```typescript
interface GenerateResponse {
  success: boolean;

  // The output (type depends on model)
  content?: string;                     // Text/research models
  image?: {                             // Image models
    base64: string;
    media_type: string;
    storage_url?: string;               // If uploaded to storage
  };
  citations?: string[];                 // Research models only

  // Metadata
  meta: {
    model_used: string;
    model_type: 'text' | 'image' | 'research';
    prompt_version: number;
    destination_applied?: string;
    tokens_in?: number;
    tokens_out?: number;
    duration_ms: number;
  };

  // For debugging (optional, enabled via header)
  debug?: {
    assembled_system_prompt: string;
    assembled_user_prompt: string;
    model_config_applied: object;
    destination_config_applied: object;
    guidelines_included: string[];
  };
}
```

### Assembly Logic (Detailed)

```typescript
async function handleGenerate(req: Request): Promise<Response> {
  // 1. Auth & parse request
  const user = await getAuthenticatedUser(req);
  const body = await req.json() as GenerateRequest;
  const { prompt_slug, session_id, variables, overrides, stream } = body;

  // 2. Load prompt template
  const promptConfig = await loadActivePromptConfig(prompt_slug);
  // Returns: { promptContent, modelId, apiConfig, promptSetId }

  // 3. Determine model (override > prompt default)
  const modelId = overrides?.model_id ?? promptConfig.modelId;
  const modelConfig = await loadModelConfig(modelId);
  // Returns: { model_type, system_prompt_tips, image_config, research_config, ... }

  // 4. Load destination (if specified)
  let destinationConfig = null;
  if (overrides?.destination_slug) {
    destinationConfig = await loadDestination(overrides.destination_slug);
    // Returns: { prompt_instructions, specs, tone_modifiers }
  }

  // 5. Load user's guidelines
  const guidelineVars = await buildGuidelineVariables(
    promptConfig.promptSetId,
    user.id,
    overrides?.guideline_overrides
  );
  // Returns: { voice_guidelines: "...", image_guidelines: "...", ... }

  // 6. Assemble system prompt
  const systemPrompt = interpolateTemplate(promptConfig.promptContent, {
    // Model-specific instructions
    model_instructions: modelConfig.system_prompt_tips || '',
    model_format: modelConfig.format_instructions || '',

    // Destination-specific instructions
    destination_requirements: destinationConfig?.prompt_instructions || '',
    destination_specs: destinationConfig ? JSON.stringify(destinationConfig.specs) : '',

    // User guidelines
    ...guidelineVars,
  });

  // 7. Build user message from runtime variables
  const userMessage = buildUserMessage(variables);

  // 8. Determine API parameters
  const temperature = overrides?.temperature
    ?? promptConfig.apiConfig.temperature
    ?? modelConfig.default_temperature;
  const maxTokens = overrides?.max_tokens
    ?? promptConfig.apiConfig.max_tokens
    ?? modelConfig.default_max_tokens;

  // 9. Call AI based on model type
  let result;
  switch (modelConfig.model_type) {
    case 'text':
      result = await callTextModel({
        modelId, systemPrompt, userMessage, temperature, maxTokens, stream
      });
      break;

    case 'image':
      result = await callImageModel({
        modelId,
        prompt: userMessage,
        imageConfig: modelConfig.image_config,
        aspectRatio: destinationConfig?.specs?.video?.aspect_ratio
      });
      break;

    case 'research':
      result = await callResearchModel({
        modelId, systemPrompt, userMessage, temperature, maxTokens,
        researchConfig: modelConfig.research_config
      });
      break;
  }

  // 10. Log the call
  await logAICall({
    session_id,
    prompt_set_slug: prompt_slug,
    model_id: modelId,
    full_prompt: `${systemPrompt}\n\n${userMessage}`,
    full_response: JSON.stringify(result),
    tokens_in: result.tokensIn,
    tokens_out: result.tokensOut,
    duration_ms: result.durationMs,
  });

  // 11. Return response
  return jsonResponse({
    success: true,
    ...formatResponse(result, modelConfig.model_type),
    meta: {
      model_used: modelId,
      model_type: modelConfig.model_type,
      prompt_version: promptConfig.version,
      destination_applied: overrides?.destination_slug,
      tokens_in: result.tokensIn,
      tokens_out: result.tokensOut,
      duration_ms: result.durationMs,
    }
  });
}
```

### Model-Specific Call Functions

```typescript
// TEXT MODELS
async function callTextModel({ modelId, systemPrompt, userMessage, temperature, maxTokens, stream }) {
  if (stream) {
    return callTextModelStreaming(...); // Returns ReadableStream with SSE
  }

  const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GATEWAY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    tokensIn: data.usage?.prompt_tokens,
    tokensOut: data.usage?.completion_tokens,
  };
}

// IMAGE MODELS
async function callImageModel({ modelId, prompt, imageConfig, aspectRatio }) {
  const gateway = createGateway({ apiKey: GATEWAY_API_KEY });

  // Build provider-specific options
  const providerOptions = buildImageProviderOptions(imageConfig, aspectRatio);

  const result = await generateText({
    model: gateway(modelId),
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    providerOptions,
  });

  return {
    base64: result.files[0].base64,
    mediaType: result.files[0].mediaType,
  };
}

function buildImageProviderOptions(imageConfig, aspectRatioOverride) {
  const key = imageConfig.provider_options_key;
  const aspectRatio = aspectRatioOverride ?? imageConfig.default_aspect_ratio;

  switch (key) {
    case 'google':
      return { google: { imageConfig: { aspectRatio } } };
    case 'bfl':
      const dims = aspectRatioToDimensions(aspectRatio, imageConfig.default_dimensions);
      return { bfl: { width: dims.width, height: dims.height } };
    case 'openai':
      return { openai: { size: aspectRatioToDALLESize(aspectRatio) } };
  }
}

// RESEARCH MODELS
async function callResearchModel({ modelId, systemPrompt, userMessage, temperature, maxTokens, researchConfig }) {
  const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GATEWAY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  const data = await response.json();
  return {
    content: data.choices[0].message.content,
    citations: data.citations || [], // Perplexity-specific
    tokensIn: data.usage?.prompt_tokens,
    tokensOut: data.usage?.completion_tokens,
  };
}
```

---

## Prompt Studio UI

### Route Structure

```
/studio                     → Redirects to /studio/templates
/studio/templates           → Template management (prompt_sets + prompt_versions)
/studio/models              → Model configuration (ai_models extended)
/studio/destinations        → Platform configuration (destinations)
/studio/guidelines          → Brand guidelines (brand_guidelines)
/studio/test                → Preview & test assembled prompts
```

### Layout

```tsx
// src/app/(dashboard)/studio/layout.tsx
export default function StudioLayout({ children }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Prompt Studio</h1>
        <p className="text-muted-foreground">
          Configure prompts, models, destinations, and guidelines in one place.
        </p>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList>
          <TabsTrigger value="templates" asChild>
            <Link href="/studio/templates">Templates</Link>
          </TabsTrigger>
          <TabsTrigger value="models" asChild>
            <Link href="/studio/models">Models</Link>
          </TabsTrigger>
          <TabsTrigger value="destinations" asChild>
            <Link href="/studio/destinations">Destinations</Link>
          </TabsTrigger>
          <TabsTrigger value="guidelines" asChild>
            <Link href="/studio/guidelines">Guidelines</Link>
          </TabsTrigger>
          <TabsTrigger value="test" asChild>
            <Link href="/studio/test">Test</Link>
          </TabsTrigger>
        </TabsList>

        {children}
      </Tabs>
    </div>
  );
}
```

### Tab 1: Templates

Reuse most of current `/prompts` page:
- Card grid of prompt_sets
- Click to edit (dialog)
- Version history
- Variable preview
- Model selection (from ai_models)
- Temperature/max_tokens config
- **NEW:** Show model type badge (text/image/research)
- **NEW:** Link to test with this template

### Tab 2: Models

Everything about each model in one place:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Models                                                    [Sync Models] │
├─────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐         │
│ │ Claude      │ │ Gemini      │ │ Perplexity  │ │ DALL-E 3    │  ...    │
│ │ Sonnet 4.5  │ │ 2.0 Flash   │ │ Sonar Pro   │ │             │         │
│ │ ───────     │ │ ───────     │ │ ───────     │ │ ───────     │         │
│ │ TEXT        │ │ TEXT        │ │ RESEARCH    │ │ IMAGE       │         │
│ │ 200k ctx    │ │ 1M ctx      │ │ 200k ctx    │ │ 4k prompt   │         │
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘

Clicking a model opens detail panel:

┌─────────────────────────────────────────────────────────────────────────┐
│ Claude Sonnet 4.5                                              [Close]  │
├─────────────────────────────────────────────────────────────────────────┤
│ BASIC INFO                                                              │
│ ├─ Model ID: anthropic/claude-sonnet-4-5                               │
│ ├─ Provider: Anthropic                                                  │
│ ├─ Type: TEXT                                                           │
│ ├─ Context Window: 200,000 tokens                                       │
│ ├─ Max Output: 8,192 tokens                                             │
│ └─ Capabilities: ☑ Streaming ☑ Images                                  │
│                                                                         │
│ PROMPTING                                                               │
│ ├─ System Prompt Tips: [textarea]                                       │
│ │   "Claude responds well to XML-structured prompts..."                │
│ ├─ Preferred Format: [dropdown: xml, markdown, json, plain]            │
│ ├─ Format Instructions: [textarea]                                      │
│ └─ Quirks: [tag input]                                                  │
│                                                                         │
│ DEFAULTS                                                                │
│ ├─ Temperature: [slider 0-1] 0.7                                        │
│ └─ Max Tokens: [number input] 4096                                      │
│                                                                         │
│ API NOTES                                                               │
│ └─ [textarea]                                                           │
│                                                                         │
│                                                           [Save Changes]│
└─────────────────────────────────────────────────────────────────────────┘

For IMAGE models, additional section:

│ IMAGE CONFIGURATION                                                     │
│ ├─ Provider Options Key: [dropdown: google, bfl, openai]               │
│ ├─ Dimension Mode: [dropdown: aspect_ratio, pixels, size]              │
│ ├─ Supported Aspect Ratios: [multi-select]                             │
│ ├─ Default Aspect Ratio: [dropdown]                                     │
│ ├─ Supports Negative Prompt: [toggle]                                   │
│ └─ Max Prompt Length: [number]                                          │

For RESEARCH models, additional section:

│ RESEARCH CONFIGURATION                                                  │
│ ├─ Returns Citations: [toggle]                                          │
│ └─ Default Recency: [dropdown: day, week, month, year]                 │
```

### Tab 3: Destinations

Platform configuration:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Destinations                                           [+ Add Destination]│
├─────────────────────────────────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────────────────────────────────┐│
│ │ YouTube                                                    VIDEO     ││
│ │ 16:9 aspect ratio • Max 10 min • Hook in first 30s                  ││
│ │ [Edit] [Duplicate] [Disable]                                         ││
│ └──────────────────────────────────────────────────────────────────────┘│
│ ┌──────────────────────────────────────────────────────────────────────┐│
│ │ TikTok                                                     VIDEO     ││
│ │ 9:16 aspect ratio • Max 60s • Immediate hook                        ││
│ │ [Edit] [Duplicate] [Disable]                                         ││
│ └──────────────────────────────────────────────────────────────────────┘│
│ ┌──────────────────────────────────────────────────────────────────────┐│
│ │ Substack                                                NEWSLETTER   ││
│ │ Long-form • Markdown • Email-optimized                              ││
│ │ [Edit] [Duplicate] [Disable]                                         ││
│ └──────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

Edit dialog:
- Name, slug, category
- Specs (JSON editor or structured form)
- Prompt instructions (textarea)
- Tone modifiers (tag input)

### Tab 4: Guidelines

Migrate GuidelinesManager component:
- Grouped by category (voice, image, tone)
- Full CRUD
- Add examples field
- Link to templates (show which templates use each guideline)

### Tab 5: Test (The Killer Feature)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Test Prompt Assembly                                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ CONFIGURATION                                                           │
│ ┌─────────────────────────────────────────────────────────────────────┐│
│ │ Template: [dropdown] ─────────────────────────────────────────────  ││
│ │ Model: [dropdown] (auto-selected from template, can override) ────  ││
│ │ Destination: [dropdown] (optional) ────────────────────────────────  ││
│ └─────────────────────────────────────────────────────────────────────┘│
│                                                                         │
│ VARIABLES                              │ ASSEMBLED PROMPT               │
│ ┌─────────────────────────────────────┐│┌─────────────────────────────┐│
│ │ outline: [textarea]                 │││ SYSTEM PROMPT               ││
│ │                                     │││ ─────────────               ││
│ │ title: [input]                      │││ You are a content writer... ││
│ │                                     │││                             ││
│ │ research_summary: [textarea]        │││ MODEL INSTRUCTIONS:         ││
│ │                                     │││ Use XML tags for structure  ││
│ │                                     │││                             ││
│ │                                     │││ DESTINATION REQUIREMENTS:   ││
│ │                                     │││ Write for spoken delivery   ││
│ │                                     │││                             ││
│ │                                     │││ VOICE GUIDELINES:           ││
│ │                                     │││ - Be conversational         ││
│ │                                     │││ - Use first person          ││
│ │                                     │││                             ││
│ └─────────────────────────────────────┘││ ─────────────               ││
│                                        ││ USER PROMPT                 ││
│ Token estimate: ~1,234 tokens          ││ ─────────────               ││
│                                        ││ Write a post about...       ││
│ [Run Test]                             │└─────────────────────────────┘│
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ RESPONSE                                                                │
│ ┌─────────────────────────────────────────────────────────────────────┐│
│ │ (Response will appear here after running test)                      ││
│ │                                                                     ││
│ │ Model: claude-sonnet-4.5 • Tokens: 1,234 in / 567 out • 2.3s       ││
│ └─────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────┘
```

Features:
- Live preview of assembled prompt as you change settings
- Token count estimation
- Run test button executes against actual AI
- Response display with metadata
- Save test as example

---

## Migration Strategy

### Phase 1: Database Schema (Non-Breaking)

1. Add new columns to `ai_models` (model_type, prompting tips, configs)
2. Create `destinations` table
3. Add `examples` column to `brand_guidelines`
4. Seed destinations
5. Update ai_models with type and config data
6. Migrate voice_guidelines → brand_guidelines

**All existing code continues to work.** New columns are nullable or have defaults.

### Phase 2: Universal Edge Function

1. Create `supabase/functions/generate/index.ts`
2. Create `supabase/functions/_shared/assembly.ts` with unified logic
3. Implement text, image, research model handlers
4. Add streaming support
5. Deploy and test with curl

**Run in parallel with existing functions.** No changes to frontend yet.

### Phase 3: Frontend Migration

1. Create `src/hooks/use-generate.ts` wrapper
2. Update each page to use new endpoint:
   - /create → `useGenerate({ prompt_slug: 'brain_dump_parser', ... })`
   - /research → `useGenerate({ prompt_slug: 'research_generator', ... })`
   - etc.
3. Regression test entire user journey

**Old edge functions still exist as fallback.**

### Phase 4: Prompt Studio UI

1. Create /studio layout with tabs
2. Build Templates tab (reuse /prompts code)
3. Build Models tab (new)
4. Build Destinations tab (new)
5. Build Guidelines tab (migrate from /settings)
6. Build Test tab (new, the killer feature)

**Keep old /prompts and /settings working during transition.**

### Phase 5: Cleanup

1. Delete old edge functions (10 → 0)
2. Remove /prompts page (redirect to /studio/templates)
3. Simplify /settings (only non-prompt settings remain)
4. Drop voice_guidelines table
5. Clean up app_settings (remove model defaults)
6. Update CLAUDE.md

---

## Files to Create/Modify

### New Migrations
```
supabase/migrations/YYYYMMDD_extend_ai_models.sql
supabase/migrations/YYYYMMDD_create_destinations.sql
supabase/migrations/YYYYMMDD_add_guideline_examples.sql
supabase/migrations/YYYYMMDD_seed_destinations.sql
supabase/migrations/YYYYMMDD_seed_model_configs.sql
supabase/migrations/YYYYMMDD_migrate_voice_guidelines.sql
supabase/migrations/YYYYMMDD_cleanup_app_settings.sql
```

### New Edge Function
```
supabase/functions/generate/index.ts
supabase/functions/_shared/assembly.ts
supabase/functions/_shared/models.ts
supabase/functions/_shared/destinations.ts
```

### New Frontend
```
src/app/(dashboard)/studio/layout.tsx
src/app/(dashboard)/studio/page.tsx (redirect)
src/app/(dashboard)/studio/templates/page.tsx
src/app/(dashboard)/studio/models/page.tsx
src/app/(dashboard)/studio/destinations/page.tsx
src/app/(dashboard)/studio/guidelines/page.tsx
src/app/(dashboard)/studio/test/page.tsx
src/hooks/use-generate.ts
src/components/prompt-preview.tsx
src/components/model-config-editor.tsx
src/components/destination-editor.tsx
```

### Modify
```
src/app/(dashboard)/create/page.tsx
src/app/(dashboard)/research/page.tsx
src/app/(dashboard)/outline/page.tsx
src/app/(dashboard)/draft/page.tsx
src/app/(dashboard)/outputs/page.tsx
```

### Delete (Phase 5)
```
supabase/functions/parse-brain-dump/
supabase/functions/generate-research/
supabase/functions/generate-outlines/
supabase/functions/generate-draft/
supabase/functions/check-voice/
supabase/functions/generate-headlines/
supabase/functions/generate-image-prompt/
supabase/functions/generate-image/
supabase/functions/generate-youtube-script/
supabase/functions/generate-tiktok-script/
src/app/(dashboard)/prompts/page.tsx
```

---

## Execution Checklist

### Phase 1: Database
- [ ] Create migration: extend ai_models with model_type, prompting tips, configs
- [ ] Create migration: destinations table
- [ ] Create migration: add examples to brand_guidelines
- [ ] Create migration: seed destinations
- [ ] Create migration: seed model configs
- [ ] Create migration: migrate voice_guidelines
- [ ] Test all migrations locally
- [ ] Push to Supabase

### Phase 2: Edge Function
- [ ] Create `_shared/assembly.ts` with core assembly logic
- [ ] Create `_shared/models.ts` with model loader
- [ ] Create `_shared/destinations.ts` with destination loader
- [ ] Create `generate/index.ts` universal function
- [ ] Implement text model handler
- [ ] Implement image model handler (with provider-specific options)
- [ ] Implement research model handler (with citations)
- [ ] Implement streaming for text models
- [ ] Test with curl
- [ ] Deploy

### Phase 3: Frontend Migration
- [ ] Create `useGenerate()` hook
- [ ] Update /create page
- [ ] Update /research page
- [ ] Update /outline page
- [ ] Update /draft page
- [ ] Update /outputs page
- [ ] Regression test full journey

### Phase 4: Prompt Studio UI
- [ ] Create /studio layout with tabs
- [ ] Templates tab
- [ ] Models tab (with type-specific sections)
- [ ] Destinations tab
- [ ] Guidelines tab
- [ ] Test tab with live preview
- [ ] Test tab with execution

### Phase 5: Cleanup
- [ ] Delete old edge functions
- [ ] Remove/redirect old pages
- [ ] Drop voice_guidelines table
- [ ] Clean up app_settings
- [ ] Update CLAUDE.md
- [ ] Update nav/sidebar

---

## Documentation Requirements

**As you implement, keep these files updated:**

### BUILD_LOG.md
For each significant step, add an entry with:
- **What I Attempted** — what was the goal
- **What Happened** — what actually occurred, any surprises
- **Lessons Learned** — insights, gotchas, decisions made and why
- **Suggestions for Next Steps** — what comes next

This is the **narrative** — the story of the build, including decision rationale.

### CHANGELOG.md
Keep the `[Unreleased]` section updated with:
- **Added** — new features, tables, components
- **Changed** — modifications to existing functionality
- **Fixed** — bug fixes
- **Removed** — deleted code, deprecated features

This is the **summary** — what changed, not why.

---

## Success Criteria

- [ ] One edge function handles all AI generation
- [ ] Model type explicitly declared (text/image/research)
- [ ] Model-specific config stored per model (not hardcoded)
- [ ] Zero hardcoded platform specs
- [ ] Can add new destination without code changes
- [ ] Can update model prompting tips without code changes
- [ ] Preview shows exact assembled prompt before execution
- [ ] Test tab can execute prompts and show response
- [ ] Existing user journey works identically
- [ ] 10 edge functions deleted
