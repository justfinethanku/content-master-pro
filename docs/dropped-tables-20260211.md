# Dropped Tables Reference — 2026-02-11

Full schema documentation for the 6 tables dropped by migration `20260211000001_replace_nate_tables.sql`.
These are preserved as a rebuild blueprint for when routing and other features are reconnected to the new generic `projects` / `assets` system.

---

## 1. `nate_content_projects`

**Source migration**: `20260129000001_nate_content_projects.sql`

```sql
CREATE TABLE nate_content_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT UNIQUE NOT NULL,        -- yyyymmdd_xxx format
  title TEXT NOT NULL,
  scheduled_date DATE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'scheduled', 'published')),
  target_platforms JSONB DEFAULT '[]',    -- ['youtube', 'substack', 'tiktok']
  notes TEXT,
  video_runtime TEXT,                     -- e.g., "21:53"
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_nate_content_projects_created_by ON nate_content_projects(created_by);
CREATE INDEX idx_nate_content_projects_status ON nate_content_projects(status);
CREATE INDEX idx_nate_content_projects_scheduled_date ON nate_content_projects(scheduled_date);
CREATE INDEX idx_nate_content_projects_project_id ON nate_content_projects(project_id);

-- RLS
ALTER TABLE nate_content_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
  ON nate_content_projects FOR SELECT
  USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own projects"
  ON nate_content_projects FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own projects"
  ON nate_content_projects FOR UPDATE
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own projects"
  ON nate_content_projects FOR DELETE
  USING (auth.uid() = created_by);

-- Trigger
CREATE TRIGGER update_nate_content_projects_updated_at
  BEFORE UPDATE ON nate_content_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 2. `nate_project_assets`

**Source migration**: `20260129000002_nate_project_assets.sql`

```sql
CREATE TABLE nate_project_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES nate_content_projects(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,               -- post, transcript_youtube, description_youtube, prompts, guide, etc.
  title TEXT,
  content TEXT,
  current_version INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'final')),
  external_url TEXT,                      -- Legacy Google Doc link
  locked_by UUID REFERENCES auth.users(id),
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_nate_project_assets_project_id ON nate_project_assets(project_id);
CREATE INDEX idx_nate_project_assets_asset_type ON nate_project_assets(asset_type);
CREATE INDEX idx_nate_project_assets_status ON nate_project_assets(status);
CREATE INDEX idx_nate_project_assets_locked_by ON nate_project_assets(locked_by) WHERE locked_by IS NOT NULL;

-- RLS
ALTER TABLE nate_project_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project assets"
  ON nate_project_assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM nate_content_projects
      WHERE nate_content_projects.id = nate_project_assets.project_id
      AND nate_content_projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert own project assets"
  ON nate_project_assets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM nate_content_projects
      WHERE nate_content_projects.id = nate_project_assets.project_id
      AND nate_content_projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update own project assets"
  ON nate_project_assets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM nate_content_projects
      WHERE nate_content_projects.id = nate_project_assets.project_id
      AND nate_content_projects.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM nate_content_projects
      WHERE nate_content_projects.id = nate_project_assets.project_id
      AND nate_content_projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete own project assets"
  ON nate_project_assets FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM nate_content_projects
      WHERE nate_content_projects.id = nate_project_assets.project_id
      AND nate_content_projects.created_by = auth.uid()
    )
  );

-- Trigger
CREATE TRIGGER update_nate_project_assets_updated_at
  BEFORE UPDATE ON nate_project_assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 3. `nate_asset_versions`

**Source migration**: `20260129000003_nate_asset_versions.sql`

```sql
CREATE TABLE nate_asset_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES nate_project_assets(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, version_number)
);

-- Indexes
CREATE INDEX idx_nate_asset_versions_asset_id ON nate_asset_versions(asset_id);
CREATE INDEX idx_nate_asset_versions_created_by ON nate_asset_versions(created_by);

-- RLS
ALTER TABLE nate_asset_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own asset versions"
  ON nate_asset_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM nate_project_assets
      JOIN nate_content_projects ON nate_content_projects.id = nate_project_assets.project_id
      WHERE nate_project_assets.id = nate_asset_versions.asset_id
      AND nate_content_projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert own asset versions"
  ON nate_asset_versions FOR INSERT
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM nate_project_assets
      JOIN nate_content_projects ON nate_content_projects.id = nate_project_assets.project_id
      WHERE nate_project_assets.id = nate_asset_versions.asset_id
      AND nate_content_projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update own asset versions"
  ON nate_asset_versions FOR UPDATE
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM nate_project_assets
      JOIN nate_content_projects ON nate_content_projects.id = nate_project_assets.project_id
      WHERE nate_project_assets.id = nate_asset_versions.asset_id
      AND nate_content_projects.created_by = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM nate_project_assets
      JOIN nate_content_projects ON nate_content_projects.id = nate_project_assets.project_id
      WHERE nate_project_assets.id = nate_asset_versions.asset_id
      AND nate_content_projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete own asset versions"
  ON nate_asset_versions FOR DELETE
  USING (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM nate_project_assets
      JOIN nate_content_projects ON nate_content_projects.id = nate_project_assets.project_id
      WHERE nate_project_assets.id = nate_asset_versions.asset_id
      AND nate_content_projects.created_by = auth.uid()
    )
  );
```

---

## 4. `nate_project_publications`

**Source migration**: `20260129000004_nate_project_publications.sql`

```sql
CREATE TABLE nate_project_publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES nate_content_projects(id) ON DELETE CASCADE,
  destination_id UUID REFERENCES destinations(id),
  platform TEXT NOT NULL,
  published_at TIMESTAMPTZ NOT NULL,
  published_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_nate_project_publications_project_id ON nate_project_publications(project_id);
CREATE INDEX idx_nate_project_publications_platform ON nate_project_publications(platform);
CREATE INDEX idx_nate_project_publications_published_at ON nate_project_publications(published_at);

-- RLS
ALTER TABLE nate_project_publications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project publications"
  ON nate_project_publications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM nate_content_projects
      WHERE nate_content_projects.id = nate_project_publications.project_id
      AND nate_content_projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert own project publications"
  ON nate_project_publications FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM nate_content_projects
      WHERE nate_content_projects.id = nate_project_publications.project_id
      AND nate_content_projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update own project publications"
  ON nate_project_publications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM nate_content_projects
      WHERE nate_content_projects.id = nate_project_publications.project_id
      AND nate_content_projects.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM nate_content_projects
      WHERE nate_content_projects.id = nate_project_publications.project_id
      AND nate_content_projects.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete own project publications"
  ON nate_project_publications FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM nate_content_projects
      WHERE nate_content_projects.id = nate_project_publications.project_id
      AND nate_content_projects.created_by = auth.uid()
    )
  );
```

---

## 5. `project_routing`

**Source migration**: `20260205000007_project_routing.sql`

```sql
CREATE TABLE project_routing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES nate_content_projects(id) ON DELETE CASCADE,
  idea_routing_id UUID REFERENCES idea_routing(id) ON DELETE SET NULL,
  scores JSONB,
  tier TEXT CHECK (tier IN ('premium_a', 'a', 'b', 'c', 'kill')),
  slot_id UUID REFERENCES calendar_slots(id) ON DELETE SET NULL,
  is_staggered BOOLEAN DEFAULT false,
  stagger_youtube_date DATE,
  stagger_substack_date DATE,
  original_date DATE,
  bump_reason TEXT,
  bumped_at TIMESTAMPTZ,
  bumped_by UUID REFERENCES auth.users(id),
  bump_count INTEGER DEFAULT 0,
  published_platforms JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);

-- Indexes
CREATE INDEX idx_project_routing_project ON project_routing(project_id);
CREATE INDEX idx_project_routing_idea ON project_routing(idea_routing_id) WHERE idea_routing_id IS NOT NULL;
CREATE INDEX idx_project_routing_tier ON project_routing(tier);
CREATE INDEX idx_project_routing_staggered ON project_routing(is_staggered) WHERE is_staggered = true;
CREATE INDEX idx_project_routing_bumped ON project_routing(original_date) WHERE original_date IS NOT NULL;

-- RLS
ALTER TABLE project_routing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project_routing"
  ON project_routing FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM nate_content_projects p
      WHERE p.id = project_routing.project_id
      AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert own project_routing"
  ON project_routing FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM nate_content_projects p
      WHERE p.id = project_routing.project_id
      AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can update own project_routing"
  ON project_routing FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM nate_content_projects p
      WHERE p.id = project_routing.project_id
      AND p.created_by = auth.uid()
    )
  );

CREATE POLICY "Users can delete own project_routing"
  ON project_routing FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM nate_content_projects p
      WHERE p.id = project_routing.project_id
      AND p.created_by = auth.uid()
    )
  );

-- Trigger
CREATE TRIGGER update_project_routing_updated_at
  BEFORE UPDATE ON project_routing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 6. `evergreen_queues`

**Source migration**: `20260205000008_evergreen_queues.sql`

```sql
CREATE TABLE evergreen_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
  idea_routing_id UUID REFERENCES idea_routing(id) ON DELETE CASCADE,
  project_routing_id UUID REFERENCES project_routing(id) ON DELETE CASCADE,
  score DECIMAL(3,1) NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('premium_a', 'a', 'b', 'c')),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  staleness_check_at TIMESTAMPTZ,
  is_stale BOOLEAN DEFAULT false,
  stale_reason TEXT,
  pulled_at TIMESTAMPTZ,
  pulled_for_date DATE,
  pulled_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT evergreen_queues_one_source CHECK (
    (idea_routing_id IS NOT NULL AND project_routing_id IS NULL) OR
    (idea_routing_id IS NULL AND project_routing_id IS NOT NULL)
  ),
  CONSTRAINT evergreen_queues_unique_idea UNIQUE (publication_id, idea_routing_id),
  CONSTRAINT evergreen_queues_unique_project UNIQUE (publication_id, project_routing_id)
);

-- Indexes
CREATE INDEX idx_evergreen_queues_publication ON evergreen_queues(publication_id);
CREATE INDEX idx_evergreen_queues_score ON evergreen_queues(score DESC);
CREATE INDEX idx_evergreen_queues_tier ON evergreen_queues(tier);
CREATE INDEX idx_evergreen_queues_added ON evergreen_queues(added_at DESC);
CREATE INDEX idx_evergreen_queues_stale ON evergreen_queues(is_stale) WHERE is_stale = false;
CREATE INDEX idx_evergreen_queues_unpulled ON evergreen_queues(publication_id, score DESC) WHERE pulled_at IS NULL;
CREATE INDEX idx_evergreen_queues_staleness_due ON evergreen_queues(staleness_check_at)
  WHERE pulled_at IS NULL AND is_stale = false;

-- RLS
ALTER TABLE evergreen_queues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evergreen_queues"
  ON evergreen_queues FOR SELECT
  USING (
    (idea_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM idea_routing ir WHERE ir.id = evergreen_queues.idea_routing_id AND ir.user_id = auth.uid()
    ))
    OR
    (project_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_routing pr
      JOIN nate_content_projects p ON p.id = pr.project_id
      WHERE pr.id = evergreen_queues.project_routing_id AND p.created_by = auth.uid()
    ))
  );

CREATE POLICY "Users can insert own evergreen_queues"
  ON evergreen_queues FOR INSERT
  WITH CHECK (
    (idea_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM idea_routing ir WHERE ir.id = evergreen_queues.idea_routing_id AND ir.user_id = auth.uid()
    ))
    OR
    (project_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_routing pr
      JOIN nate_content_projects p ON p.id = pr.project_id
      WHERE pr.id = evergreen_queues.project_routing_id AND p.created_by = auth.uid()
    ))
  );

CREATE POLICY "Users can update own evergreen_queues"
  ON evergreen_queues FOR UPDATE
  USING (
    (idea_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM idea_routing ir WHERE ir.id = evergreen_queues.idea_routing_id AND ir.user_id = auth.uid()
    ))
    OR
    (project_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_routing pr
      JOIN nate_content_projects p ON p.id = pr.project_id
      WHERE pr.id = evergreen_queues.project_routing_id AND p.created_by = auth.uid()
    ))
  );

CREATE POLICY "Users can delete own evergreen_queues"
  ON evergreen_queues FOR DELETE
  USING (
    (idea_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM idea_routing ir WHERE ir.id = evergreen_queues.idea_routing_id AND ir.user_id = auth.uid()
    ))
    OR
    (project_routing_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_routing pr
      JOIN nate_content_projects p ON p.id = pr.project_id
      WHERE pr.id = evergreen_queues.project_routing_id AND p.created_by = auth.uid()
    ))
  );

-- Trigger
CREATE TRIGGER update_evergreen_queues_updated_at
  BEFORE UPDATE ON evergreen_queues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Dependency Graph

```
evergreen_queues
  └→ project_routing
       └→ nate_content_projects
  └→ idea_routing (NOT dropped — stays)
  └→ publications (NOT dropped — stays)

project_routing
  └→ nate_content_projects
  └→ idea_routing (NOT dropped)
  └→ calendar_slots (NOT dropped)

nate_project_publications
  └→ nate_content_projects
  └→ destinations (NOT dropped)

nate_asset_versions
  └→ nate_project_assets
       └→ nate_content_projects

nate_project_assets
  └→ nate_content_projects
```

## Drop Order (FK-safe)

1. `evergreen_queues` (depends on `project_routing`)
2. `project_routing` (depends on `nate_content_projects`)
3. `nate_asset_versions` (depends on `nate_project_assets`)
4. `nate_project_publications` (depends on `nate_content_projects`)
5. `nate_project_assets` (depends on `nate_content_projects`)
6. `nate_content_projects` (root)

## Replacement Tables

All 6 tables are replaced by the generic project/asset system:
- `nate_content_projects` → `projects`
- `nate_project_assets` → `assets`
- `nate_asset_versions` → `asset_versions`
- `nate_project_publications` → `project_publications`
- `project_routing` → deferred (reconnect later with FK to `projects`)
- `evergreen_queues` → deferred (reconnect later with FK to new routing table)

New addition: `project_name_versions` — tracks project name change history.
