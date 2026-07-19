-- ===================================================================
-- Phase 2 — Operator Control Surface (Launch Roadmap §4)
-- Adds node_settings singleton + invitations allowlist.
-- Idempotent: safe to re-run.
-- ===================================================================

CREATE TABLE IF NOT EXISTS `node_settings` (
	`id` text PRIMARY KEY NOT NULL DEFAULT 'default',
	`auth_mode` text NOT NULL DEFAULT 'solo',
	`waitlist_enabled` integer NOT NULL DEFAULT 0,
	`default_role` text NOT NULL DEFAULT 'developer',
	`owner_email` text,
	`node_name` text,
	`support_email` text,
	`welcome_headline` text,
	`welcome_body` text,
	`brand_logo_url` text,
	`brand_primary_color` text,
	`created_at` integer NOT NULL DEFAULT (unixepoch()),
	`updated_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint

-- Seed the singleton row. Subsequent writes UPDATE this row.
INSERT OR IGNORE INTO `node_settings` (`id`, `auth_mode`, `waitlist_enabled`, `default_role`)
VALUES ('default', 'solo', 0, 'developer');
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL DEFAULT 'developer',
	`status` text NOT NULL DEFAULT 'invited',
	`invited_by` text,
	`invited_by_email` text,
	`note` text,
	`expires_at` integer,
	`last_sent_at` integer,
	`send_count` integer NOT NULL DEFAULT 0,
	`accepted_at` integer,
	`accepted_user_id` text,
	`revoked_at` integer,
	`created_at` integer NOT NULL DEFAULT (unixepoch()),
	`updated_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS `idx_inv_email` ON `invitations` (`email`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_inv_status` ON `invitations` (`status`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_inv_created` ON `invitations` (`created_at`);
