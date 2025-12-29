# Fix Content Sessions RLS Policies

## Status: Complete

## Problem Statement

The `content_sessions` table and related content tables have broken RLS (Row-Level Security) policies that prevent INSERT operations from the client. The error message is:

```
Failed to create session: new row violates row-level security policy for table "content_sessions"
```

### Root Cause Analysis

**Two interrelated issues:**

1. **RLS Policy Pattern Issue**: The policies use `FOR ALL USING (...)` without `WITH CHECK (...)`. In PostgreSQL:
   - `USING` controls SELECT, UPDATE (existing rows), DELETE
   - `WITH CHECK` controls INSERT and UPDATE (new row values)
   - When `FOR ALL` omits `WITH CHECK`, PostgreSQL uses `USING` as a fallback, but this can fail for INSERTs when the row doesn't exist yet

2. **Client Code Issue**: The insert at [create/page.tsx:62-65](src/app/(dashboard)/create/page.tsx#L62-L65) doesn't include `user_id`:
   ```typescript
   .insert({
     status: "brain_dump",
     title: content.trim().slice(0, 50) + "...",
     // MISSING: user_id
   })
   ```

   The `user_id` column is `NOT NULL` with no default, so either:
   - The RLS policy blocks it (can't verify `auth.uid() = user_id` when `user_id` isn't set)
   - The database rejects it for violating NOT NULL constraint

---

## Affected Tables

### Direct user_id reference (Priority 1)
| Table | Current Policy | Issue |
|-------|----------------|-------|
| `content_sessions` | `FOR ALL USING (auth.uid() = user_id)` | No `WITH CHECK`, client doesn't pass `user_id` |

### EXISTS subquery pattern (Priority 2)
These depend on `content_sessions` having proper ownership:
| Table | Current Policy | Issue |
|-------|----------------|-------|
| `content_brain_dumps` | `FOR ALL USING (EXISTS(...))` | No `WITH CHECK` |
| `content_research` | `FOR ALL USING (EXISTS(...))` | No `WITH CHECK` |
| `content_outlines` | `FOR ALL USING (EXISTS(...))` | No `WITH CHECK` |
| `content_drafts` | `FOR ALL USING (EXISTS(...))` | No `WITH CHECK` |
| `content_outputs` | `FOR ALL USING (EXISTS(...))` | No `WITH CHECK` |

### Already working (no changes needed)
- `ai_call_logs` - Has proper `FOR INSERT WITH CHECK (true)` policy
- `prompt_sets` / `prompt_versions` - Fixed in migration `20241228170000_fix_prompt_rls_policies.sql`
- `imported_posts` / `sync_manifests` - Has proper separate policies with `WITH CHECK`
- `brand_guidelines` - Has proper `WITH CHECK (user_id = auth.uid())`
- `generated_images` - Has proper separate policies with `WITH CHECK`

---

## Implementation Plan

### Phase 1: Database Migration (RLS Policies)

Create a new migration to fix all content table RLS policies.

**Pattern to follow** (from [import_sync.sql](supabase/migrations/20241227000007_import_sync.sql)):
```sql
-- Separate policies for each operation
CREATE POLICY "Users can view own X" ON table_name
  FOR SELECT USING (...);

CREATE POLICY "Users can create X" ON table_name
  FOR INSERT WITH CHECK (...);

CREATE POLICY "Users can update own X" ON table_name
  FOR UPDATE USING (...);

CREATE POLICY "Users can delete own X" ON table_name
  FOR DELETE USING (...);
```

### Phase 2: Client Code Fix

Update [create/page.tsx](src/app/(dashboard)/create/page.tsx) to include `user_id` in the insert.

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/20241230000001_fix_content_sessions_rls.sql` | New migration to fix RLS policies |
| `src/app/(dashboard)/create/page.tsx` | Add `user_id` to session insert |

---

## Execution Order

### Step 0: Preparation
- [x] Copy this plan to `./plans/` (already here)
- [x] Verify current state by reproducing the error

### Step 1: Create Database Migration
- [x] Drop old `FOR ALL` policies on all 6 content tables
- [x] Create new separate policies for SELECT, INSERT, UPDATE, DELETE
- [x] For `content_sessions`: use `user_id = auth.uid()` pattern
- [x] For child tables: use EXISTS subquery pattern (same logic, just split)

### Step 2: Fix Client Code
- [x] Update `create/page.tsx` to get user ID from session
- [x] Include `user_id` in the content_sessions insert

### Step 3: Test
- [x] Run migration: `npx supabase db push`
- [ ] Test creating a new content session in the UI
- [ ] Verify session shows in history

### Step 4: Deploy
- [x] Push migration to production (done via db push)
- [ ] Verify in production

---

## Migration SQL

```sql
-- Fix RLS policies for content tables
-- These tables used FOR ALL USING() which doesn't properly handle INSERT

-- ===========================================
-- content_sessions
-- ===========================================
DROP POLICY IF EXISTS "Users can manage own sessions" ON content_sessions;

CREATE POLICY "Users can view own sessions" ON content_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own sessions" ON content_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions" ON content_sessions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions" ON content_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ===========================================
-- content_brain_dumps
-- ===========================================
DROP POLICY IF EXISTS "Users can manage own brain_dumps" ON content_brain_dumps;

CREATE POLICY "Users can view own brain_dumps" ON content_brain_dumps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_brain_dumps.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create brain_dumps" ON content_brain_dumps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_brain_dumps.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own brain_dumps" ON content_brain_dumps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_brain_dumps.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own brain_dumps" ON content_brain_dumps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_brain_dumps.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

-- ===========================================
-- content_research
-- ===========================================
DROP POLICY IF EXISTS "Users can manage own research" ON content_research;

CREATE POLICY "Users can view own research" ON content_research
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_research.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create research" ON content_research
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_research.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own research" ON content_research
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_research.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own research" ON content_research
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_research.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

-- ===========================================
-- content_outlines
-- ===========================================
DROP POLICY IF EXISTS "Users can manage own outlines" ON content_outlines;

CREATE POLICY "Users can view own outlines" ON content_outlines
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_outlines.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create outlines" ON content_outlines
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_outlines.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own outlines" ON content_outlines
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_outlines.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own outlines" ON content_outlines
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_outlines.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

-- ===========================================
-- content_drafts
-- ===========================================
DROP POLICY IF EXISTS "Users can manage own drafts" ON content_drafts;

CREATE POLICY "Users can view own drafts" ON content_drafts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_drafts.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create drafts" ON content_drafts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_drafts.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own drafts" ON content_drafts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_drafts.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own drafts" ON content_drafts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_drafts.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

-- ===========================================
-- content_outputs
-- ===========================================
DROP POLICY IF EXISTS "Users can manage own outputs" ON content_outputs;

CREATE POLICY "Users can view own outputs" ON content_outputs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_outputs.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create outputs" ON content_outputs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_outputs.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own outputs" ON content_outputs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_outputs.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own outputs" ON content_outputs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM content_sessions
      WHERE content_sessions.id = content_outputs.session_id
      AND content_sessions.user_id = auth.uid()
    )
  );
```

---

## Client Code Fix

In `src/app/(dashboard)/create/page.tsx`, update the insert to include `user_id`:

```typescript
// Get user from session
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  setError("Please log in to continue");
  return;
}

// Create session with user_id
const { data: newSession, error: sessionError } = await supabase
  .from("content_sessions")
  .insert({
    user_id: session.user.id,  // ADD THIS
    status: "brain_dump",
    title: content.trim().slice(0, 50) + (content.length > 50 ? "..." : ""),
  })
  .select()
  .single();
```

---

## Notes

1. **Why separate policies?** PostgreSQL RLS behaves differently for each operation. Using `FOR ALL` with just `USING` is a shorthand that doesn't always work correctly for INSERT operations.

2. **Why include user_id in client?** Even with proper `WITH CHECK` policies, the RLS can only verify `auth.uid() = user_id` if `user_id` is actually set in the INSERT. Without it, the comparison fails.

3. **Order matters**: The migration must run BEFORE the client code is deployed, otherwise inserts will fail during the window between deploy and migration.

4. **Testing**: After migration, test both:
   - Creating a new session (INSERT)
   - Viewing existing sessions (SELECT)
   - Updating session status (UPDATE)
