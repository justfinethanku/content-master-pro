# BFL FLUX Model Dimension Specifications

Research completed: 2026-02-19

## Summary

All BFL FLUX models have specific dimension constraints that explain why outputs don't always match requested dimensions.

## FLUX 2 Pro (`bfl/flux-2-pro`)

**API Documentation:** https://docs.bfl.ml/flux_2/flux2_text_to_image

### Constraints
- **Dimension requirement:** Must be multiples of **16**
- **Minimum:** 64×64
- **Maximum:** 4 MP (e.g., 2048×2048)
- **Recommended ceiling:** 2 MP
- **Default:** 1024×1024

### Why 1920×1080 outputs as 1920×1072
```
1920 ÷ 16 = 120 (exact multiple) ✓
1080 ÷ 16 = 67.5 (not exact) ✗
1080 → 1072 (nearest multiple of 16 = 67 × 16)
```

### Supported High Resolutions
| Requested | Actual Output | Megapixels | Within 4MP Limit? |
|-----------|---------------|------------|-------------------|
| 1920×1080 | 1920×1072 | 2.06 MP | ✓ (recommended ≤2MP) |
| 2560×1440 | 2560×1440 | 3.69 MP | ✓ (below 4MP max) |
| 3840×2160 | 3840×2160 | 8.29 MP | ✗ (exceeds 4MP limit) |

**Maximum practical resolution:** 2048×2048 (4.0 MP exactly)

## FLUX 1.1 Pro Ultra (`bfl/flux-pro-1.1-ultra`)

**API Documentation:** https://replicate.com/black-forest-labs/flux-1.1-pro-ultra/api

### Constraints
- **Maximum:** 4 MP (2048×2048)
- **Width/Height range:** 256–1440 pixels (per some providers)
- **No multiple-of-16 requirement** (unlike FLUX 2 Pro)
- Supports flexible aspect ratios via aspect ratio strings

### Why it outputs 2752×1536
The model appears to support resolutions **beyond the documented 2048×2048 limit**:
```
2752 × 1536 = 4.23 MP (exceeds documented 4MP limit)
```

This suggests either:
1. Documentation is outdated
2. The model has an internal upscaling mechanism
3. Provider-specific implementations allow higher resolutions

### Supported Modes
- **Ultra mode:** 4MP native generation
- **Raw mode:** 4MP photorealism

## FLUX Kontext Pro (`bfl/flux-kontext-pro`)

**API Documentation:** https://docs.bfl.ml/kontext/kontext_text_to_image

### Constraints
- **Total pixels:** ~1 megapixel (regardless of aspect ratio)
- **Aspect ratio range:** 3:7 (portrait) to 7:3 (landscape)
- **Default:** 1024×1024 (1:1 ratio)
- **Parameter:** `aspect_ratio` (e.g., "16:9"), not width/height

### Why 1920×1080 outputs as 1392×752
The model maintains aspect ratio while staying within ~1MP:
```
Requested: 1920×1080 = 2.07 MP (exceeds 1MP limit)
Closest 16:9 preset within 1MP: 1392×752 = 1.05 MP
```

### Common Presets
| Aspect Ratio | Approximate Dimensions | Megapixels |
|--------------|------------------------|------------|
| 1:1 | 1024×1024 | 1.05 MP |
| 16:9 | 1184×880 or 1392×752 | ~1 MP |
| 4:3 | ~1184×880 | ~1 MP |
| 3:2 | ~1232×816 | ~1 MP |

## Recommendations for CMP

### FLUX 2 Pro
For best results, request dimensions that are multiples of 16:

```typescript
// Good dimensions (multiples of 16)
{ width: 1920, height: 1072 }  // ~16:9, 2.06 MP
{ width: 2560, height: 1440 }  // 16:9, 3.69 MP
{ width: 2048, height: 2048 }  // 1:1, 4.0 MP (max)

// Bad dimensions (will be adjusted)
{ width: 1920, height: 1080 }  // 1080 → 1072
{ width: 2560, height: 1441 }  // 1441 → 1440
```

### FLUX 1.1 Pro Ultra
Can handle higher resolutions, but documentation is unclear. Test empirically:
- Start with 2048×2048 (documented max)
- Try 2752×1536 (observed output in our testing)
- Monitor for quality degradation at higher resolutions

### FLUX Kontext Pro
Use aspect ratio parameter instead of dimensions, constrained to ~1MP:

```typescript
{ aspect_ratio: "16:9" }  // ~1184×880 or 1392×752
{ aspect_ratio: "1:1" }   // 1024×1024
{ aspect_ratio: "4:3" }   // ~1184×880
```

Don't request specific dimensions above 1MP; they will be downscaled.

## Vercel AI Gateway Integration

The Vercel AI Gateway `/v1/images/generations` endpoint accepts:
- `model`: Provider/model ID (e.g., `bfl/flux-2-pro`)
- `size`: String format (e.g., "1920x1080") - may be ignored
- `width`: Explicit pixel width (256–1920 per Vercel docs)
- `height`: Explicit pixel height (256–1920 per Vercel docs)

**Important:** The gateway documents a 256–1920 pixel range, but BFL models themselves support higher resolutions (up to 4MP). The gateway may pass through larger values to the underlying provider.

## Sources

- BFL FLUX 2 Overview: https://docs.bfl.ml/flux_2/flux2_overview
- BFL FLUX 2 API: https://docs.bfl.ml/flux_2/flux2_text_to_image
- BFL Kontext API: https://docs.bfl.ml/kontext/kontext_text_to_image
- Vercel AI SDK BFL Provider: https://ai-sdk.dev/providers/ai-sdk-providers/black-forest-labs
- Replicate FLUX 1.1 Pro Ultra: https://replicate.com/black-forest-labs/flux-1.1-pro-ultra
- Various provider docs (Runware, AIMLAPI, Segmind)
