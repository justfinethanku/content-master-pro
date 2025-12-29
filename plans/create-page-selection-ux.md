# Create Page Selection-Based UX Redesign

## Status: Complete

## Problem Statement

The Create page's research selection flow is broken and unintuitive:

1. **Theme "Research" buttons** - Each immediately navigates away with just that one theme. No way to select multiple themes.
2. **Suggested Research badges** - Have `cursor-pointer hover:bg-accent` but NO onClick handler. They do nothing.
3. **Key Insights** - Just displays as a list. Could be useful context for research.
4. **"Continue to Research" button** - Only takes `themes[0]`, ignoring everything else.
5. **One-way flow** - Once you leave, you can't come back to research something else from the same brain dump.

The Research page already uses a good selection pattern (checkboxes for key points/data points). The Create page should use the same pattern.

---

## Proposed Solution

Transform the Create page results into a **selection-based flow**:

```
Brain Dump → Extract Themes → SELECT items → Continue to Research
```

### User Flow

1. User enters brain dump, clicks "Extract Themes"
2. AI extracts themes, insights, and suggested queries
3. User sees results with **checkboxes** on:
   - Themes (select which to research together)
   - Suggested Research Queries (include as additional prompts)
   - Key Insights (optional - include as context)
4. User checks desired items
5. User clicks "Continue to Research" (only enabled if something selected)
6. Research page receives all selected items and combines them into a rich prompt

### Research Page Changes

- Accept multiple themes/queries via URL params or session storage
- Show selected items as editable context at top
- Allow adding more research topics without going back

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/app/(dashboard)/create/page.tsx` | Add selection state, checkboxes, update button logic |
| `src/app/(dashboard)/research/page.tsx` | Accept multiple themes, show as editable context |

---

## Implementation Plan

### Phase 1: Create Page Selection UI

#### 1.1 Add Selection State
```typescript
const [selectedThemes, setSelectedThemes] = useState<Set<number>>(new Set());
const [selectedQueries, setSelectedQueries] = useState<Set<number>>(new Set());
const [selectedInsights, setSelectedInsights] = useState<Set<number>>(new Set());
```

#### 1.2 Theme Card Redesign
- Remove individual "Research" buttons from each theme
- Add checkbox to each theme row
- Show potential_angles as sub-items (visual only, not selectable)

#### 1.3 Suggested Research Card
- Add checkboxes to each query badge (or convert to list with checkboxes)
- Make them toggleable

#### 1.4 Key Insights Card
- Add optional checkboxes
- Label as "Include as context" or similar

#### 1.5 Update "Continue to Research" Button
- Disable if nothing selected
- Show count of selected items: "Continue to Research (3 items)"
- Pass all selected items to research page

### Phase 2: Research Page Multi-Topic Support

#### 2.1 Accept Multiple Topics
- Parse multiple themes from URL params (comma-separated or array)
- Or use sessionStorage to pass complex data

#### 2.2 Show Selected Context
- Display selected themes/queries at top of page
- Allow editing before starting research
- Allow removing items

#### 2.3 Combined Research Prompt
- Modify the prompt to handle multiple topics coherently
- Research all selected themes together, not separately

---

## Execution Order

### Step 0: Preparation
- [x] Copy this plan to `./plans/`

### Step 1: Create Page - Selection State
- [x] Add state variables for selected themes, queries, insights
- [x] Create toggle functions for each

### Step 2: Create Page - Theme Card
- [x] Replace "Research" buttons with checkboxes
- [x] Style selected vs unselected states
- [x] Keep potential_angles badges as visual context

### Step 3: Create Page - Suggested Research Card
- [x] Convert badges to selectable items with checkboxes
- [x] Style consistently with themes

### Step 4: Create Page - Key Insights Card
- [x] Add optional checkboxes
- [x] Add helper text explaining these are optional context

### Step 5: Create Page - Continue Button
- [x] Update to be disabled when nothing selected
- [x] Show selection count
- [x] Build comprehensive params for research page

### Step 6: Research Page - Accept Multiple Topics
- [x] Parse multiple themes from sessionStorage
- [x] Display as editable list at top
- [x] Allow removing items before research

### Step 7: Research Page - Combined Prompt
- [x] Combine themes and queries into topic field
- [x] Include selected insights as additional context

### Step 8: Test End-to-End
- [ ] Test selecting multiple themes
- [ ] Test selecting suggested queries
- [ ] Test including insights as context
- [ ] Verify research page shows all selected items
- [ ] Verify research results are comprehensive

---

## UI Mockup (Text)

### Current (Broken)
```
┌─────────────────────────────────────┐
│ Themes                              │
│ "Click Research on any theme..."    │
├─────────────────────────────────────┤
│ Theme 1                  [Research] │
│ Description...                      │
│ [angle1] [angle2]                   │
├─────────────────────────────────────┤
│ Theme 2                  [Research] │
│ ...                                 │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Suggested Research                  │
├─────────────────────────────────────┤
│ [query1] [query2] [query3]  ← do nothing │
└─────────────────────────────────────┘

[ Continue to Research → ]  ← only takes themes[0]
```

### Proposed (Fixed)
```
┌─────────────────────────────────────┐
│ Themes                              │
│ "Select themes to research together"│
├─────────────────────────────────────┤
│ [✓] Theme 1                         │
│     Description...                  │
│     [angle1] [angle2]               │
├─────────────────────────────────────┤
│ [ ] Theme 2                         │
│     ...                             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Research Queries                    │
│ "Add to your research"              │
├─────────────────────────────────────┤
│ [✓] Query 1                         │
│ [ ] Query 2                         │
│ [✓] Query 3                         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Key Insights (optional context)     │
├─────────────────────────────────────┤
│ [ ] Insight 1                       │
│ [ ] Insight 2                       │
└─────────────────────────────────────┘

[ Continue to Research (4 selected) → ]
     ↑ disabled if nothing selected
```

---

## Data Flow

### Create Page → Research Page

**Option A: URL Params (simple)**
```typescript
const params = new URLSearchParams();
params.set("session_id", sessionId);
params.set("themes", JSON.stringify(selectedThemeData));
params.set("queries", JSON.stringify(selectedQueryData));
params.set("insights", JSON.stringify(selectedInsightData));
router.push(`/research?${params.toString()}`);
```

**Option B: Session Storage (cleaner for complex data)**
```typescript
sessionStorage.setItem("research_context", JSON.stringify({
  themes: selectedThemeData,
  queries: selectedQueryData,
  insights: selectedInsightData,
}));
router.push(`/research?session_id=${sessionId}`);
```

Recommend **Option B** - URL params get ugly with complex JSON.

---

## Notes

1. **Consistency**: Match the Research page's checkbox styling exactly - it already looks good.

2. **Default selection**: Consider auto-selecting first theme and first 1-2 queries to reduce clicks, but still allow deselection.

3. **Edge case**: If user deselects everything, disable the Continue button.

4. **Mobile**: Ensure checkboxes have adequate touch targets (min 44px).

5. **Accessibility**: Proper label associations for checkboxes.
