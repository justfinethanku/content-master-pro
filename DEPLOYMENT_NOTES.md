# Content Master Pro - Deployment Notes

## ✅ RESOLVED (2024-12-28)

The app is now deployed and working at: https://content-master-pro.vercel.app/

**Solution**: Changed Vercel Framework Preset from "Other" to "Next.js" and redeployed.

---

## Root Cause Found (2024-12-28)

**The Vercel Framework Preset was set to "Other" instead of "Next.js".**

This caused Vercel to treat the app as a static site, deploying only 5 SVG files from `public/` instead of building the Next.js application with serverless functions.

### Fix Required
1. Go to Vercel Dashboard → Project Settings → General
2. Change "Framework Preset" from "Other" to "Next.js"
3. Redeploy

---

## What Didn't Work (Don't Repeat These)

### 1. Adding `runtime = "nodejs"` to middleware.ts
```typescript
// ❌ DOESN'T WORK ON VERCEL
export const runtime = "nodejs";
```
- Vercel's Edge Middleware doesn't support Node.js runtime
- The `runtime` export is ignored for middleware files

### 2. Migrating to proxy.ts (Next.js 16 pattern)
```typescript
// ❌ HAS KNOWN BUGS ON VERCEL
// src/app/proxy.ts
export { auth as GET, auth as POST } from "@/auth";
```
- GitHub issues #86269, #86122 document Vercel compatibility issues
- `proxy.ts` is the Next.js 16+ replacement for middleware but has bugs

### 3. Using @supabase/ssr in Edge Runtime
```typescript
// ❌ USES NODE.JS APIs
import { createServerClient } from "@supabase/ssr";
```
- `@supabase/ssr` internally uses `process.versions` which isn't available in Edge Runtime
- Results in `500: MIDDLEWARE_INVOCATION_FAILED`

### 4. Deleting middleware entirely
- Changed error from 500 to 404
- Didn't fix the root cause (wrong Framework Preset)

---

## Correct Supabase Auth Setup for Next.js on Vercel

### Environment Variables Required
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... (for admin operations only)
```

### File Structure
```
src/lib/supabase/
├── client.ts      # Browser client (createBrowserClient)
├── server.ts      # Server client (createServerClient with cookies)
└── (no middleware.ts here - was duplicate, deleted)
```

### Middleware Approach
For Supabase Auth with Next.js on Vercel, consider:
1. **No middleware** - Handle auth in Server Components/Route Handlers
2. **Lightweight middleware** - Only refresh tokens, no heavy Supabase calls
3. **Client-side auth checks** - Use `useEffect` for protected routes

---

## Errors Encountered

| Error | Cause |
|-------|-------|
| `500: MIDDLEWARE_INVOCATION_FAILED` | @supabase/ssr uses Node.js APIs in Edge Runtime |
| `[ReferenceError: __dirname is not defined]` | Node.js code running in Edge Runtime |
| `404: NOT_FOUND` | Framework Preset set to "Other" - no serverless functions deployed |

---

## Lessons Learned

1. **Always verify Vercel Framework Preset** - Check it's set to "Next.js" not "Other"
2. **Check Deployment Resources** - Verify serverless functions are being created
3. **Edge Runtime has limitations** - Many npm packages use Node.js APIs that don't work
4. **@supabase/ssr and Edge don't mix** - Use alternative auth patterns or skip middleware
