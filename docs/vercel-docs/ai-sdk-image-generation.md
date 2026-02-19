# AI SDK Image Generation — Complete Reference

> Researched February 2026. Covers `ai` v6.0.93, `@ai-sdk/black-forest-labs` v0.0.7, `@ai-sdk/google` v2.0.14.

---

## 1. `generateImage()` API

**Import:**
```ts
import { experimental_generateImage as generateImage } from 'ai';
```
Still exported as `experimental_generateImage`.

### Parameters

| Parameter | Type | Description |
|---|---|---|
| `model` | `ImageModelV1` | The image model instance |
| `prompt` | `string \| { text: string; images?: (string \| Uint8Array \| URL)[]; mask?: string \| Uint8Array \| URL }` | Text prompt, or structured object with reference images and optional mask |
| `n?` | `number` | Number of images to generate |
| `size?` | `string` | Format `{width}x{height}` (e.g., `"1024x1024"`) |
| `aspectRatio?` | `string` | Format `{width}:{height}` (e.g., `"16:9"`) |
| `seed?` | `number` | Seed for reproducibility |
| `providerOptions?` | `Record<string, Record<string, JSONValue>>` | Provider-specific options (nested under provider slug key) |
| `maxRetries?` | `number` | Max retry count, default: 2 |
| `abortSignal?` | `AbortSignal` | Optional abort signal |
| `headers?` | `Record<string, string>` | Additional HTTP headers |

### Return Type

```ts
{
  image: GeneratedFile;       // First image (convenience shortcut)
  images: GeneratedFile[];    // All generated images (when n > 1)
  providerMetadata: Record<string, Record<string, unknown>>;
}
```

`GeneratedFile` shape:
```ts
{
  base64: string;        // Base64-encoded image string
  uint8Array: Uint8Array; // Raw bytes
  mediaType: string;     // e.g., 'image/jpeg', 'image/png'
}
```

### Key Behaviors

- **No streaming.** `generateImage` is a one-shot async function; it polls internally (for BFL's async API) until the image is ready.
- **Error handling:** Standard `fetch`-level errors and provider HTTP errors will throw. For BFL models, the SDK internally polls up to `pollTimeoutMillis` (default 60s) and throws on timeout. Use `maxRetries` for network retry logic.

---

## 2. AI SDK + Vercel AI Gateway for Image Generation

The AI SDK automatically uses the AI Gateway when you pass a model string in `creator/model-name` format:

```ts
import { experimental_generateImage as generateImage } from 'ai';

// Plain string = uses Gateway automatically
const result = await generateImage({
  model: 'bfl/flux-kontext-pro',
  prompt: { text: 'Edit this image', images: [sourceImageBuffer] },
});
```

Or with explicit gateway instance (requires `ai` v5.0.36+):

```ts
import { gateway, experimental_generateImage as generateImage } from 'ai';

const result = await generateImage({
  model: gateway('bfl/flux-kontext-pro'),
  prompt: { text: 'Edit this image', images: [sourceImageBuffer] },
});
```

### Authentication

- **Env var (outside Vercel):** `AI_GATEWAY_API_KEY=your_key`
- **Constructor:** `createGateway({ apiKey: '...' })`
- **On Vercel deployments:** OIDC tokens handled automatically

### `prompt.images` through Gateway

The structured `prompt` object (`{ text, images, mask }`) is an **AI SDK-level abstraction**, not a Gateway-specific feature. It works the same whether routing through the Gateway or hitting a provider directly.

### Gateway-available image models (with reference image support)

- `bfl/flux-kontext-pro`
- `bfl/flux-kontext-max`
- `bfl/flux-2-flex`
- `google/imagen-4.0-generate`
- `google/imagen-4.0-fast-generate`
- `google/imagen-4.0-ultra-generate`

---

## 3. AI SDK in Deno / Supabase Edge Functions

Supabase Edge Functions run **Deno 2.1** with full Node.js compatibility and `package.json` / `node_modules` support.

### Import Methods

```ts
// Option 1: npm: specifier (Deno 2 style)
import { experimental_generateImage as generateImage } from 'npm:ai';
import { blackForestLabs } from 'npm:@ai-sdk/black-forest-labs';
import { google } from 'npm:@ai-sdk/google';

// Option 2: package.json + node_modules (Deno 2.1 / Supabase 2025+)
import { experimental_generateImage as generateImage } from 'ai';
import { blackForestLabs } from '@ai-sdk/black-forest-labs';
```

### Compatibility Notes

- The `ai` package and all `@ai-sdk/*` providers are standard ESM with no Node-specific APIs that block Deno
- They use the Web `fetch` API, which Deno supports natively
- `fs` (used in some AI SDK examples) is available in Deno 2 via `node:fs`
- `process.env` → use `Deno.env.get()` in Supabase Edge Functions

### Latest Package Versions (Feb 2026)

| Package | Version |
|---|---|
| `ai` | `6.0.93` |
| `@ai-sdk/black-forest-labs` | `0.0.7` |
| `@ai-sdk/google` | `2.0.14` |

---

## 4. BFL Provider — `@ai-sdk/black-forest-labs`

**API key env var:** `BFL_API_KEY` (sent as `x-key` header)
**Base URL:** `https://api.bfl.ai/v1` (regional: `api.eu.bfl.ai/v1`, `api.us.bfl.ai/v1`)

### Polling

BFL uses an async generation API. The SDK polls automatically every `pollIntervalMillis` (default: **500ms**) up to `pollTimeoutMillis` (default: **60,000ms**). These can be set at provider-instance level or per-call via `providerOptions.blackForestLabs`.

### `prompt.images` → BFL Field Mapping

| AI SDK `prompt` field | BFL API field |
|---|---|
| `prompt.text` | `prompt` string |
| `prompt.images[0]` | `input_image` (raw base64 or URL) |
| `prompt.images[1..9]` | `input_image_2` through `input_image_10` |
| `prompt.mask` | Used only with `flux-pro-1.0-fill` inpainting |

**Accepted image formats:** URLs (HTTP/HTTPS) or base64-encoded strings. Max **20MB** or **20 megapixels** per image. Up to **10 input images** total.

### Provider Options (`providerOptions.blackForestLabs`)

```ts
{
  width: number;              // 256–1920, overrides `size`
  height: number;             // 256–1920, overrides `size`
  outputFormat: 'jpeg' | 'png';
  steps: number;              // inference steps
  guidance: number;           // prompt adherence scale
  imagePrompt: string;        // base64 image for additional visual context (NOT primary reference)
  imagePromptStrength: number; // 0.0–1.0
  promptUpsampling: boolean;
  raw: boolean;               // natural/authentic aesthetics mode
  safetyTolerance: number;    // 0 (strict) to 6 (permissive)
  pollIntervalMillis: number; // default 500
  pollTimeoutMillis: number;  // default 60000
  webhookUrl: string;         // async completion webhook
  webhookSecret: string;      // X-Webhook-Secret header value
}
```

### Kontext Model Constraints

- Both `flux-kontext-pro` and `flux-kontext-max` support reference images via `prompt.images`
- Aspect ratios: 3:7 (portrait) through 7:3 (landscape)
- `flux-kontext-max` adds improved prompt adherence and typography generation

### Response Shape

```ts
const { image, images, providerMetadata } = await generateImage({ ... });

image.base64      // string (base64)
image.uint8Array  // Uint8Array
image.mediaType   // 'image/jpeg' | 'image/png'

// Provider metadata:
const meta = providerMetadata?.blackForestLabs?.images?.[0];
meta.seed              // number (for reproducibility)
meta.start_time        // number (unix timestamp)
meta.end_time          // number (unix timestamp)
meta.duration          // number (seconds)
meta.cost              // number (USD cost)
meta.inputMegapixels   // number
meta.outputMegapixels  // number
```

---

## 5. Google Provider — `@ai-sdk/google`

**API key env var:** `GOOGLE_GENERATIVE_AI_API_KEY` (sent as `x-goog-api-key` header)

### Gemini Image Models (via `google.image()`)

These models support BOTH text-to-image AND image-to-image with reference images:

| Model | Image Gen | Image Editing | Aspect Ratios |
|---|---|---|---|
| `gemini-2.5-flash-image` | Yes | Yes | 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9 |
| `gemini-3-pro-image-preview` | Yes | Yes (up to 14 refs) | 1:1, 2:3, 3:2, 3:4, 4:3, 4:5, 5:4, 9:16, 16:9, 21:9 |

**Basic usage:**
```ts
const { image } = await generateImage({
  model: google.image('gemini-3-pro-image-preview'),
  prompt: 'A photorealistic cat wearing a wizard hat',
  aspectRatio: '16:9',
});
```

**With reference image (image editing):**
```ts
const { image } = await generateImage({
  model: google.image('gemini-3-pro-image-preview'),
  prompt: {
    text: 'Add a small wizard hat to this cat',
    images: [sourceImage],  // Uint8Array, URL, or base64 string
  },
});
```

**Gemini image models do NOT support:** `size`, `n > 1`, or masks/inpainting. Use `aspectRatio`.

### Imagen Models (via `google.image()`)

| Model | Aspect Ratios |
|---|---|
| `imagen-4.0-generate-001` | 1:1, 3:4, 4:3, 9:16, 16:9 |
| `imagen-4.0-ultra-generate-001` | 1:1, 3:4, 4:3, 9:16, 16:9 |
| `imagen-4.0-fast-generate-001` | 1:1, 3:4, 4:3, 9:16, 16:9 |

> Imagen models do **not** support reference images (`prompt.images`). Text-to-image only.

### Alternative: Image via `generateText`

For text + image together:
```ts
const result = await generateText({
  model: google('gemini-2.5-flash-image'),
  prompt: 'Create a picture of a nano banana in a fancy restaurant',
});

for (const file of result.files) {
  if (file.mediaType.startsWith('image/')) {
    // file.base64, file.mediaType
  }
}
```

Requires `providerOptions.google.responseModalities: ['IMAGE', 'TEXT']` when using the language model path.

---

## 6. Providers with Image-to-Image Support — Summary

| Provider | Model(s) | Gateway String | Reference Images | Max Images |
|---|---|---|---|---|
| **BFL** | `flux-kontext-pro`, `flux-kontext-max` | `bfl/flux-kontext-pro` | `prompt.images[]` | 10 |
| **Google** | `gemini-3-pro-image-preview` | `google/gemini-3-pro-image` | `prompt.images[]` | 14 |
| **OpenAI** | `gpt-image-1`, `gpt-image-1-mini`, `gpt-image-1.5` | `openai/gpt-image-1` | `prompt.images[]` + mask | 16 |
| **xAI** | `grok-2-image`, `grok-imagine-image` | `xai/grok-2-image` | `prompt.images[]` | 1 |
| **Fal** | `fal-ai/flux-pro/kontext`, `fal-ai/omnigen-v2`, etc. | via `@ai-sdk/fal` | `prompt.images[]` | varies |

### Key Differences

- **Most flexible:** OpenAI `gpt-image-1` — up to 16 images + mask
- **Best face preservation:** BFL Kontext Pro/Max — designed for identity-preserving edits
- **Simplest:** xAI Grok — single image, prompt-driven only
- **Best for face/style transfer:** Fal's ControlNet and IP-Adapter models

---

## 7. Critical Gotchas

1. **BFL: Reference images MUST go in `prompt.images[]`**, NOT in `providerOptions.blackForestLabs.imagePrompt`. The `imagePrompt` field is only "additional visual context" and will NOT be used as the primary editing reference.

2. **Google Gemini via `generateText` path:** Must set `providerOptions.google.responseModalities: ['IMAGE']` or images are silently not generated. This is NOT needed when using `google.image()` with `generateImage()`.

3. **Fal AI:** The deprecated `providerOptions.fal.imageUrl` field is silently ignored. Only `prompt.images[]` works.

4. **No streaming:** `generateImage()` is always one-shot. BFL polling is handled internally by the SDK.

5. **Deno imports:** Use `npm:ai` specifier or configure `package.json` in Supabase Edge Functions.

6. **Gemini is NOT a native Gateway image model.** The Gateway classifies `google/gemini-3-pro-image` as `modelType: "language"`, not `"image"`. While `gateway.image()` works for text-to-image via a compatibility path, `prompt.images[]` does NOT reliably deliver reference images through this path. **Use the direct `@ai-sdk/google` provider instead:** `google.image('gemini-3-pro-image-preview')` with `GOOGLE_GENERATIVE_AI_API_KEY`. This gives first-class `prompt.images[]` support. Verified Feb 2026.

7. **`@ai-sdk/google` version matters.** The `.image()` method routes Gemini models via `:generateContent` (not `:predict`). This was added in v3.x. Using v2.x will fail with "not supported for predict" errors. Use `@ai-sdk/google@^3.0.0`.

8. **Gateway model ID ≠ Direct provider model ID.** Gateway: `google/gemini-3-pro-image`. Direct: `gemini-3-pro-image-preview` (note the `-preview` suffix). The edge function strips the `google/` prefix and appends `-preview` for the direct provider path.
