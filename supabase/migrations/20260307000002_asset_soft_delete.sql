-- Add soft-delete support to project_assets
-- Instead of hard-deleting rows, we set deleted_at and filter them out in queries.

ALTER TABLE project_assets ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficient filtering of non-deleted assets
CREATE INDEX idx_project_assets_deleted_at ON project_assets (deleted_at) WHERE deleted_at IS NULL;

-- Comment for clarity
COMMENT ON COLUMN project_assets.deleted_at IS 'Soft-delete timestamp. NULL = active, non-NULL = deleted.';
