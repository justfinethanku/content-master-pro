# Content Master Pro - Automated UI Testing Plan

## Status: ✅ Complete
**Completed:** 2025-12-28
**Results:** [test-results-summary.md](./test-results-summary.md)

---

## Overview
Fully automated testing of Content Master Pro using Chrome DevTools MCP against `localhost:3000`.

**Test Credentials:**
- Email: `jon@contentionmedia.com`
- Password: `Tiny&Pink2018`

**Test Configuration:**
- ✅ Execute all AI features (theme extraction, research, drafts, etc.)
- ✅ Full content pipeline test (create → research → outline → draft → outputs)
- ✅ Continue on failures, log errors, summarize at end

---

## Pre-Test Setup

### 0. Add Engineering Rule 14 to CLAUDE.md
Add the following rule after Rule 13 in `/Users/jonathanedwards/AUTOMATION/SubStack/content-master-pro/CLAUDE.md`:

```markdown
### Rule 14: Plan Tracking
All implementation plans must be tracked:
- Copy plans from `~/.claude/plans/` to `./plans/<descriptive-name>.md`
- Update the plan during implementation (check off completed items)
- Mark status when finished: add `## Status: ✅ Complete` at the top
- Keep completed plans for reference (don't delete)
```

Also remove the existing line 4 instruction ("## when making a plan ALWAYS copy it...").

### 1. Copy Plan to Project
```bash
cp /Users/jonathanedwards/.claude/plans/humble-tinkering-clarke.md \
   /Users/jonathanedwards/AUTOMATION/SubStack/content-master-pro/plans/automated-ui-test-plan.md
```

### 2. Start Development Server
```bash
cd /Users/jonathanedwards/AUTOMATION/SubStack/content-master-pro
npm run dev
```
Wait for server to be ready on `localhost:3000`

### 2. Open Browser & Navigate
- Use `mcp__chrome-devtools__new_page` to open `http://localhost:3000`
- Take initial snapshot to verify page loaded

---

## Test Sequence

### Phase 1: Authentication
**Goal:** Log in to access dashboard

1. Navigate to `http://localhost:3000/login`
2. Take snapshot to find form elements
3. Fill email field with test email
4. Fill password field with test password
5. Click login button
6. Wait for redirect to `/dashboard`
7. Verify: Dashboard page loads with user content

---

### Phase 2: Dashboard (`/dashboard`)
**Goal:** Verify dashboard displays correctly

**Tests:**
1. Take snapshot of dashboard
2. Verify presence of:
   - 4 stat cards (Active Sessions, Posts Indexed, Completed, Monthly Outputs)
   - Quick action buttons (New Brain Dump, Search Library, View History, Sync)
   - Recent sessions list
3. Click "New Brain Dump" button → should navigate to `/create`
4. Navigate back to dashboard
5. Click "Search Library" → should navigate to `/search`
6. Navigate back to dashboard

---

### Phase 3: Full Content Pipeline (CREATE → RESEARCH → OUTLINE → DRAFT → OUTPUTS)
**Goal:** Test the complete content creation workflow with AI features

#### Step 3.1: Brain Dump (`/create`)
1. Navigate to `/create`
2. Take snapshot to find textarea
3. Fill textarea with sample brain dump:
   ```
   I've been thinking about how AI is changing content creation.
   The tools available now make it possible to produce high-quality
   content faster than ever. But there's a risk of losing authenticity.
   How do we balance efficiency with genuine voice? Maybe the key is
   using AI as a collaborator rather than a replacement. Writers can
   use AI for research and drafting while maintaining their unique
   perspective and voice.
   ```
4. Verify character count updates
5. Click "Extract Themes" button
6. Wait for AI response (~10-15 seconds)
7. Take snapshot to verify themes displayed
8. Verify: Theme cards appear with extracted themes
9. Click "Research" button on one of the themes → navigates to `/research`

#### Step 3.2: Research (`/research`)
1. Verify research page loaded with theme context
2. Take snapshot
3. If no auto-research, enter topic: "AI and authentic content creation"
4. Click "Generate Research" button
5. Wait for Perplexity AI response (~15-20 seconds)
6. Take snapshot to verify research results
7. Verify: Summary, key points, sources displayed
8. Select some key points (checkboxes)
9. Click "Continue to Outline" → navigates to `/outline`

#### Step 3.3: Outline (`/outline`)
1. Verify outline page loaded
2. Take snapshot
3. If not auto-generated, click "Generate Outline" button
4. Wait for AI response (~10-15 seconds)
5. Take snapshot to verify outline structure
6. Verify: Title, subtitle, hook, sections visible
7. Expand sections to see key points
8. Click "Continue to Draft" → navigates to `/draft`

#### Step 3.4: Draft (`/draft`)
1. Verify draft page loaded
2. Take snapshot
3. If not auto-generating, click "Generate Draft" button
4. Wait for streaming draft (~30-60 seconds for full draft)
5. Take periodic snapshots to see streaming progress
6. Verify: Full draft text appears in editor
7. Verify: Voice score panel shows tone/style analysis
8. Test cross-reference panel if available
9. Click "Continue to Outputs" → navigates to `/outputs`

#### Step 3.5: Outputs (`/outputs`)
1. Verify outputs page loaded
2. Take snapshot

**YouTube Tab:**
3. Click YouTube tab (if not default)
4. Click "Generate YouTube Script" if available
5. Wait for AI response (~15-20 seconds)
6. Verify: Script with timestamps, B-roll suggestions, description

**TikTok Tab:**
7. Click TikTok tab
8. Click "Generate TikTok Scripts" if available
9. Wait for AI response (~10-15 seconds)
10. Verify: Short-form scripts (15s, 30s, 60s versions)

**Images Tab:**
11. Click Images tab
12. Take snapshot to see image prompt generator
13. Toggle brand guidelines if available
14. Click "Generate Image Prompt" if available
15. Verify: AI-generated image prompt text

---

### Phase 4: Search (`/search`)
**Goal:** Test both Results and Chat modes

**Tests - Results Mode:**
1. Navigate to `/search`
2. Take snapshot
3. Find search input
4. Fill search with "AI content creation"
5. Press Enter or click search button
6. Wait for results
7. Verify: Search results appear with relevance scores

**Tests - Chat Mode:**
1. Click "Chat" tab
2. Take snapshot
3. Find chat input
4. Type: "What has Jon written about AI?"
5. Submit message
6. Wait for streaming response
7. Verify: AI response appears in chat

---

### Phase 5: History (`/history`)
**Goal:** Test session history display

**Tests:**
1. Navigate to `/history`
2. Take snapshot
3. Verify: Session list displays (may be empty or have items)
4. If sessions exist:
   - Click on a session to view details
   - Verify details panel shows
5. Test status filter dropdown if available

---

### Phase 6: Sync (`/sync`)
**Goal:** Test newsletter sync interface

**Tests:**
1. Navigate to `/sync`
2. Take snapshot
3. Verify: Newsletter list displays
4. If newsletters exist:
   - Verify sync status badges
   - Expand a newsletter to see recent posts
5. Click "Add Newsletter" button
6. Verify: Dialog opens
7. Close dialog (click outside or cancel)

---

### Phase 7: Prompts (`/prompts`)
**Goal:** Test prompt management UI

**Tests:**
1. Navigate to `/prompts`
2. Take snapshot
3. Verify: Prompt grid displays
4. Click on a prompt card to open editor
5. Take snapshot of editor dialog
6. Verify:
   - Prompt content textarea
   - Model selector dropdown
   - Temperature slider
   - Version history sidebar
7. Switch to "Guidelines" tab
8. Verify: Guideline checkboxes display
9. Close dialog (don't save changes)

---

### Phase 8: Settings (`/settings`)
**Goal:** Test app settings interface

**Tests:**
1. Navigate to `/settings`
2. Take snapshot
3. Verify: Settings page loads with categories
4. Find and expand a collapsible category
5. Verify: Settings inputs visible (model selects, sliders)
6. Scroll to Brand Guidelines Manager section
7. Verify: Guidelines list displays
8. Click "Create" to open guideline dialog
9. Take snapshot of dialog
10. Close dialog without saving

---

### Phase 9: Outputs (`/outputs`)
**Goal:** Test multi-platform output generation UI

**Tests:**
1. Navigate to `/outputs`
2. Take snapshot
3. Verify: Output tabs display (YouTube, TikTok, Images)
4. Click through each tab:
   - YouTube tab: Verify script sections visible
   - TikTok tab: Verify short-form script templates
   - Images tab: Verify image prompt generator
5. Check guideline toggle functionality

---

### Phase 10: Theme Toggle
**Goal:** Verify dark/light mode works

**Tests:**
1. Find theme toggle in header
2. Take screenshot (current theme)
3. Click theme toggle
4. Take screenshot (opposite theme)
5. Verify: Visual difference between modes

---

## Test Execution Strategy

### For Each Test:
1. `take_snapshot` - Get current page state with element UIDs
2. `fill` or `click` - Interact with elements by UID
3. `wait_for` - Wait for expected text/state
4. `take_snapshot` - Verify result

### Error Handling:
- If element not found, take screenshot for debugging
- Log all actions and results
- Continue to next test on non-critical failures

### Timing:
- Allow 10-15 seconds for AI operations (theme extraction, chat)
- Allow 2-3 seconds for page navigation
- Use `wait_for` for dynamic content

---

## Success Criteria

| Page | Must Work |
|------|-----------|
| Login | Form submission, redirect to dashboard |
| Dashboard | Stats display, navigation buttons |
| Create | Textarea input, character count |
| Search | Search input, results display, chat mode |
| History | Session list display |
| Sync | Newsletter list, add dialog |
| Prompts | Prompt grid, editor dialog |
| Settings | Settings display, guidelines manager |
| Outputs | Tab navigation, content display |

---

## Test Results Summary Template

After testing, generate a summary report:

```markdown
# Content Master Pro - Test Results
**Date:** [timestamp]
**Duration:** [total time]

## Summary
- Total Tests: X
- Passed: X
- Failed: X
- Skipped: X

## Results by Phase

### Phase 1: Authentication
- [ ] Login form displayed
- [ ] Credentials accepted
- [ ] Redirected to dashboard

### Phase 2: Dashboard
- [ ] Stats cards displayed
- [ ] Quick actions work
- [ ] Navigation functional

### Phase 3: Full Content Pipeline
- [ ] Brain dump input works
- [ ] Theme extraction successful
- [ ] Research generation works
- [ ] Outline generation works
- [ ] Draft streaming works
- [ ] Outputs generated (YouTube/TikTok/Images)

### Phase 4: Search
- [ ] Results mode works
- [ ] Chat mode works

### Phase 5-9: Other Features
- [ ] History page loads
- [ ] Sync page loads
- [ ] Prompts editor works
- [ ] Settings page works
- [ ] Theme toggle works

## Failures & Issues
[List any failures with screenshots/details]

## Performance Notes
[Any slow operations or timeouts]
```

---

## Notes

- AI features will be executed (may incur API costs)
- Full pipeline creates a content session in the database
- On failure: log error, take screenshot, continue to next test
- Estimated total runtime: 5-10 minutes (depending on AI response times)
