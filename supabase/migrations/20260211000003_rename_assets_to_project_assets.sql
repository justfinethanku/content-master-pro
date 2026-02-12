-- Rename assets table to project_assets for clarity

ALTER TABLE assets RENAME TO project_assets;

-- Rename indexes
ALTER INDEX idx_assets_project_id RENAME TO idx_project_assets_project_id;
ALTER INDEX idx_assets_asset_type RENAME TO idx_project_assets_asset_type;
ALTER INDEX idx_assets_platform RENAME TO idx_project_assets_platform;
ALTER INDEX idx_assets_status RENAME TO idx_project_assets_status;
ALTER INDEX idx_assets_project_type RENAME TO idx_project_assets_project_type;
ALTER INDEX idx_assets_type_platform RENAME TO idx_project_assets_type_platform;
ALTER INDEX idx_assets_metadata RENAME TO idx_project_assets_metadata;
