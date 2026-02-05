# Idea Capture & Slack Integration Plan

## Status: 📋 Ready for Review

## Overview

Implement a complete idea capture system with multiple input sources:
1. **Manual capture** - Quick add via UI
2. **Slack integration** - Sync from a dedicated channel
3. **Other sources** - X shares, Granola transcripts, recordings (future)

The captured ideas flow into the routing system for scoring and scheduling.

---

## Current State

### What Exists
- `slack_ideas` table with support for multiple source types
- `slack_integration_config` table for OAuth tokens
- TypeScript types (`SlackIdea`, `SlackIdeaInsert`, etc.)
- React hooks (`useIdeas`, `useCreateIdea`, `useUpdateIdea`)
- Routing system ready to receive ideas

### What's Missing
- [ ] UI for viewing/managing ideas
- [ ] Manual capture form
- [ ] Slack OAuth flow
- [ ] Slack message sync
- [ ] Connection to routing system

---

## Phase 1: Ideas Management UI (Quick Win)

**Goal:** View and manually add ideas before Slack integration.

### 1.1 Ideas List Page (`/ideas`)

Create a new page for managing captured ideas.

**File:** `src/app/(dashboard)/ideas/page.tsx`

**Features:**
- List all ideas from `slack_ideas` table
- Filter by status (backlog, in_progress, drafted, archived)
- Filter by source type
- Search by content
- Quick actions (archive, delete, send to routing)

### 1.2 Manual Capture Form

**Add to ideas page** (or as a modal)

**Fields:**
- Raw content (textarea, required)
- Source type (default: "manual")
- Source URL (optional, for reference links)

**On submit:**
1. Insert into `slack_ideas`
2. Optionally trigger AI processing (summary, topics, type)
3. Optionally index to Pinecone

### 1.3 Sidebar Link

Add "Ideas" to main navigation in `sidebar.tsx`.

### Deliverables
- [ ] `/ideas` page with list view
- [ ] Manual capture form (inline or modal)
- [ ] Sidebar navigation link
- [ ] Basic CRUD operations working

---

## Phase 2: AI Processing Pipeline

**Goal:** Automatically enrich captured ideas with AI.

### 2.1 Idea Processing Function

**File:** `src/lib/ideas/processor.ts`

```typescript
interface ProcessedIdea {
  summary: string;
  extracted_topics: string[];
  idea_type: IdeaType;
  potential_angles: string[];
}

async function processIdea(rawContent: string): Promise<ProcessedIdea>
```

**Uses:** Claude (via existing AI gateway) with a new `idea_processor` prompt.

### 2.2 Processing Trigger

Options:
- **Immediate:** Process on create (may be slow)
- **Background:** Queue for processing (better UX)
- **Manual:** "Process" button in UI

### 2.3 Prompt Configuration

Add to `prompt_sets` table:
- Slug: `idea_processor`
- Purpose: Extract summary, topics, type, and angles from raw idea

### Deliverables
- [ ] `processIdea()` function
- [ ] Prompt set in database
- [ ] Processing trigger (immediate or background)
- [ ] UI shows processed fields

---

## Phase 3: Slack Integration

**Goal:** Automatically sync ideas from a Slack channel.

### 3.1 Slack App Setup (Manual)

1. Create Slack App at https://api.slack.com/apps
2. Configure OAuth scopes:
   - `channels:history` - Read messages
   - `channels:read` - List channels
   - `users:read` - Get user info
3. Set redirect URL: `https://your-domain.com/api/auth/slack/callback`
4. Get Client ID and Client Secret

### 3.2 Environment Variables

```bash
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_SIGNING_SECRET=
```

### 3.3 OAuth Flow

**Files:**
- `src/app/api/auth/slack/route.ts` - Initiate OAuth
- `src/app/api/auth/slack/callback/route.ts` - Handle callback

**Flow:**
1. User clicks "Connect Slack" in settings
2. Redirect to Slack OAuth consent
3. Slack redirects back with code
4. Exchange code for access token
5. Store in `slack_integration_config`

### 3.4 Message Sync

**File:** `src/app/api/cron/sync-slack/route.ts`

**Triggered by:** Vercel Cron (every 15 mins) or manual

**Logic:**
1. Get all active Slack configs
2. For each config:
   - Fetch messages since `last_message_ts`
   - Filter for new messages (not already in DB)
   - Insert into `slack_ideas`
   - Update `last_message_ts`
3. Optionally trigger AI processing

### 3.5 Settings UI

**File:** `src/app/(dashboard)/settings/slack/page.tsx`

**Features:**
- Connect/disconnect Slack workspace
- Select channel to sync from
- Configure sync frequency
- Manual sync trigger
- View sync status/errors

### Deliverables
- [ ] Slack App configured
- [ ] OAuth routes implemented
- [ ] Message sync cron job
- [ ] Settings UI for Slack connection
- [ ] Error handling and retry logic

---

## Phase 4: Routing Integration

**Goal:** Connect captured ideas to the routing system.

### 4.1 "Send to Routing" Action

From ideas list, user can:
1. Select an idea
2. Click "Send to Routing"
3. Creates entry in `idea_routing` table
4. Idea enters routing workflow

### 4.2 Automatic Routing (Optional)

Configure rules to auto-route certain ideas:
- Based on extracted topics
- Based on idea type
- Based on source

### 4.3 Status Sync

When idea is routed/scheduled/published:
- Update `slack_ideas.status` accordingly
- Update `slack_ideas.content_session_id` if linked

### Deliverables
- [ ] "Send to Routing" button
- [ ] Link between `slack_ideas` and `idea_routing`
- [ ] Status sync between tables

---

## Phase 5: Additional Sources (Future)

### 5.1 X/Twitter Shares
- Browser extension or bookmarklet
- Share to Content Master from X

### 5.2 Granola Transcripts
- Import from Granola API
- Auto-extract ideas from meeting notes

### 5.3 Voice Recordings
- Already linked via `recording_id`
- Process transcripts into ideas

---

## Database Considerations

### Existing Tables Used
- `slack_ideas` - Main ideas storage
- `slack_integration_config` - Slack OAuth
- `idea_routing` - Routing workflow state
- `idea_clusters` - Grouping similar ideas

### No New Tables Needed

The existing schema supports all planned features.

---

## API Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ideas` | GET | List ideas with filters |
| `/api/ideas` | POST | Create idea (manual) |
| `/api/ideas/[id]` | GET | Get single idea |
| `/api/ideas/[id]` | PATCH | Update idea |
| `/api/ideas/[id]` | DELETE | Delete idea |
| `/api/ideas/[id]/process` | POST | Trigger AI processing |
| `/api/ideas/[id]/route` | POST | Send to routing |
| `/api/auth/slack` | GET | Initiate Slack OAuth |
| `/api/auth/slack/callback` | GET | OAuth callback |
| `/api/cron/sync-slack` | POST | Sync Slack messages |

---

## Implementation Order

### Immediate (Phase 1)
1. Ideas list page - **enables manual testing of routing**
2. Manual capture form
3. Sidebar link

### Next (Phase 2-3)
4. AI processing pipeline
5. Slack OAuth
6. Message sync

### Later (Phase 4-5)
7. Routing integration
8. Additional sources

---

## Estimated Effort

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| Phase 1: Ideas UI | ~4 hours | None |
| Phase 2: AI Processing | ~3 hours | Prompt config |
| Phase 3: Slack Integration | ~6 hours | Slack App setup |
| Phase 4: Routing Integration | ~2 hours | Phase 1 |
| Phase 5: Additional Sources | TBD | Various APIs |

---

## Questions for Review

1. **Slack channel strategy:** Single channel per user, or multiple channels?
2. **Processing trigger:** Immediate on capture, or background queue?
3. **Auto-routing:** Should some ideas auto-route based on content?
4. **Clustering:** Enable automatic idea clustering?

---

## Quick Start: Manual Testing

While waiting for Slack integration, you can manually add ideas via SQL:

```sql
INSERT INTO slack_ideas (user_id, raw_content, source_type, status)
VALUES (
  'your-user-id',
  'My idea about AI content creation...',
  'manual',
  'backlog'
);
```

Or use the Supabase dashboard to insert rows directly.
