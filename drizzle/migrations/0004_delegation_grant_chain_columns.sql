-- ===================================================================
-- NND-D1-prep — Delegation grant-chain columns (Wave 1)
--
-- Adds five columns to `delegation_tasks` to carry the scoped-grant
-- envelope for A2A sub-agent delegation. The first three columns
-- (`granted_scope`, `expires_at`, `granted_by_proof_hash`) capture the
-- envelope of a single grant; the last two (`parent_delegation_id`,
-- `revocable`) enable Wave-3 (NND-D3) grant-chain traversal and
-- cascading revocation.
--
-- All columns are nullable / defaulted so the migration is safe on
-- existing rows and idempotent to re-run.
-- ===================================================================

ALTER TABLE `delegation_tasks` ADD COLUMN `granted_scope` text;--> statement-breakpoint
ALTER TABLE `delegation_tasks` ADD COLUMN `expires_at` integer;--> statement-breakpoint
ALTER TABLE `delegation_tasks` ADD COLUMN `granted_by_proof_hash` text;--> statement-breakpoint
ALTER TABLE `delegation_tasks` ADD COLUMN `parent_delegation_id` text;--> statement-breakpoint
ALTER TABLE `delegation_tasks` ADD COLUMN `revocable` integer NOT NULL DEFAULT 1;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_dt_parent_delegation` ON `delegation_tasks` (`parent_delegation_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_dt_expires_at` ON `delegation_tasks` (`expires_at`);
