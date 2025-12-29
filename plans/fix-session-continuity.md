# Fix Session Continuity & History

## Status: ✅ Complete

## Problem Statement

Multiple issues with session persistence and the History page:

1. **Refreshing pages clears state** - All state is in React, not reloaded from database
2. **"Continue" from History goes to blank page** - Pages don't load existing session data
3. **"Generate More" does nothing useful** - No feedback if there's nothing to generate
4. **Inconsistent data loading** - Some pages load from DB, some don't

---

## Current State Analysis

| Page | Accepts session_id? | Loads existing data from DB? | Status |
|------|---------------------|------------------------------|--------|
| **Create** | No | No | BROKEN - No session restoration |
| **Research** | Yes | No | BROKEN - Ignores existing content_research |
| **Outline** | Yes | Yes (loads content_research) | OK |
| **Draft** | Yes | No (loads outline, not existing draft) | BROKEN - Ignores existing content_drafts |
| **Outputs** | Yes | Yes (loads content_drafts) | OK |

### Specific Issues

**Create Page:**
- No URL param handling for `session_id`
- Always starts fresh - can't resume a brain_dump session
- Should load existing brain dump content and themes

**Research Page:**
- Has `session_id` from URL but doesn't use it to load existing research
- Only uses `session_id` to update status and pass to edge function
- Should check for existing `content_research` and display it

**Draft Page:**
- Loads outline correctly
- Does NOT load existing draft content from `content_drafts`
- Auto-generates new draft every time you visit
- Should show existing draft if one exists, with option to regenerate

---

## Implementation Plan

### Phase 1: Research Page - Load Existing Research

When `session_id` is present, load existing research from `content_research` table before showing empty state.

```typescript
// In Research page useEffect
if (sessionId) {
  const { data: existingResearch } = await supabase
    .from("content_research")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (existingResearch) {
    setTheme(existingResearch.query);
    // Parse and display the stored research result
    setResult({
      topic: existingResearch.query,
      summary: existingResearch.response,
      key_points: extractKeyPoints(existingResearch.response),
      sources: existingResearch.sources || [],
      // ... etc
    });
  }
}
```

### Phase 2: Draft Page - Load Existing Draft

When `session_id` is present, check for existing draft before auto-generating.

```typescript
// In Draft page useEffect
const { data: existingDraft } = await supabase
  .from("content_drafts")
  .select("content, voice_score")
  .eq("session_id", sessionId)
  .order("created_at", { ascending: false })
  .limit(1)
  .single();

if (existingDraft) {
  setDraft(existingDraft.content);
  if (existingDraft.voice_score) {
    setVoiceScore(existingDraft.voice_score);
  }
  // DON'T auto-generate if draft exists
}
```

### Phase 3: Create Page - Session Restoration

Add session restoration capability to Create page.

1. Accept `session_id` from URL params
2. If session exists, load brain dump content and themes
3. Display existing themes/results instead of empty state
4. Allow continuing to research with loaded data

```typescript
const searchParams = useSearchParams();
const sessionIdFromUrl = searchParams.get("session_id");

useEffect(() => {
  if (sessionIdFromUrl) {
    loadExistingSession(sessionIdFromUrl);
  }
}, [sessionIdFromUrl]);

async function loadExistingSession(id: string) {
  const { data } = await supabase
    .from("content_sessions")
    .select(`
      *,
      content_brain_dumps(raw_content, extracted_themes)
    `)
    .eq("id", id)
    .single();

  if (data?.content_brain_dumps?.[0]) {
    setContent(data.content_brain_dumps[0].raw_content);
    setResult(data.content_brain_dumps[0].extracted_themes);
    setSessionId(id);
  }
}
```

### Phase 4: History Page - Better Continue Logic

Update History page to navigate to appropriate stage with better UX.

```typescript
const handleContinue = (session: ContentSession) => {
  const config = STATUS_CONFIG[session.status];
  if (config) {
    // Add session_id to URL
    router.push(`${config.route}?session_id=${session.id}`);
  }
};
```

This already works but destination pages need to handle loading.

### Phase 5: Generate More - Better UX

"Generate More" should:
1. If session has draft → go to outputs
2. If session has no draft but has outline → go to draft
3. If session has no outline but has research → go to outline
4. Otherwise → show toast explaining what's missing

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/app/(dashboard)/research/page.tsx` | Load existing research when session_id present |
| `src/app/(dashboard)/draft/page.tsx` | Load existing draft when session_id present |
| `src/app/(dashboard)/create/page.tsx` | Accept session_id, load existing brain dump |
| `src/app/(dashboard)/history/page.tsx` | Improve "Generate More" logic |

---

## Execution Order

### Step 0: Preparation
- [ ] Copy this plan to `./plans/`

### Step 1: Research Page
- [x] Add useEffect to check for existing research on mount
- [x] Parse stored research response into display format
- [x] Show loaded research results if they exist
- [x] Keep theme/context editable for re-research

### Step 2: Draft Page
- [x] Add check for existing draft in loadOutline useEffect
- [x] If draft exists, set it and skip auto-generate
- [x] Add "Regenerate Draft" button for manual regeneration (already existed)
- [x] Load voice_score if it exists

### Step 3: Create Page
- [x] Add searchParams to get session_id
- [x] Add useEffect to load existing session
- [x] Display existing brain dump content and themes
- [x] Update handleContinueToResearch to use existing sessionId

### Step 4: History Page
- [x] Improve "Generate More" with smart routing
- [x] Add error message for cases where generation isn't possible

### Step 5: Test End-to-End
- [ ] Create session, navigate away, use History to continue
- [ ] Refresh page mid-session, verify state persists
- [ ] Test "Continue" button from various stages
- [ ] Test "Generate More" button

---

## Database Tables Reference

```sql
-- content_sessions
id, user_id, status, title, created_at, updated_at

-- content_brain_dumps
id, session_id, raw_content, extracted_themes, created_at

-- content_research
id, session_id, query, response, sources, created_at

-- content_outlines
id, session_id, outline_json, selected, user_feedback, created_at

-- content_drafts
id, session_id, content, voice_score, version, created_at

-- content_outputs
id, session_id, output_type, content, metadata, created_at
```

---

## Edge Cases to Handle

1. **Multiple research entries**: Use most recent (already sorted by created_at DESC)
2. **Session without brain dump**: Shouldn't happen, but handle gracefully
3. **Corrupted/empty data**: Show error state with option to restart
4. **Race conditions**: Ensure loading state prevents user interaction

---

## Notes

1. **Don't overwrite existing data on page load** - Only load for display, don't auto-regenerate
2. **Keep "Research Again" / "Regenerate" buttons** - Allow users to re-do steps
3. **Toast notifications** - Inform user when loading existing data vs starting fresh
4. **URL is source of truth for session** - `session_id` in URL should always be used
