-- ===================================================================
-- Auth Lanes — add owner_id to UCP checkout sessions and subscriptions
-- so Lane C (requireResourceOwner) can enforce per-tenant isolation.
-- Both columns are nullable: pre-existing rows remain visible to admins
-- only; new rows always carry the creating actor's id.
-- Idempotent: safe to re-run.
-- ===================================================================

ALTER TABLE `ucp_checkout_sessions` ADD COLUMN `owner_id` text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ucp_cs_owner` ON `ucp_checkout_sessions` (`owner_id`);--> statement-breakpoint

ALTER TABLE `subscriptions` ADD COLUMN `owner_id` text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_sub_owner` ON `subscriptions` (`owner_id`);
