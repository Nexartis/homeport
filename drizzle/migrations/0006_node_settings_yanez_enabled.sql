-- ===================================================================
-- Add the operator-facing Yanez sign-and-return toggle to node_settings.
-- Off by default; owners enable it from /admin/settings/auth. Idempotent
-- guard: SQLite has no "ADD COLUMN IF NOT EXISTS", so this is only safe to
-- run once (the migration journal enforces that).
-- ===================================================================

ALTER TABLE `node_settings` ADD `yanez_enabled` integer DEFAULT 0 NOT NULL;
