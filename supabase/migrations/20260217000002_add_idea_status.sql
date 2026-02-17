-- Add 'idea' to the projects status CHECK constraint
-- Ideas are fully written posts held outside the active pipeline
-- They don't appear in calendar/unscheduled views until promoted to 'draft'

ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('idea', 'draft', 'in_progress', 'review', 'scheduled', 'published', 'archived'));
