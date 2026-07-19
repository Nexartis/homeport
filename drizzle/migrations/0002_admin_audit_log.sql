-- ===================================================================
-- Phase 2 — Admin Audit Log (Launch Roadmap §4)
-- Captures every mutation performed through the operator control
-- surface (settings, invitations, branding, waitlist approvals).
-- Separate from telemetry_events (which is agent-centric).
-- Idempotent: safe to re-run.
-- ===================================================================

CREATE TABLE IF NOT EXISTS `admin_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`actor_user_id` text,
	`actor_email` text,
	`target_type` text,
	`target_id` text,
	`metadata` text,
	`ip` text,
	`user_agent` text,
	`created_at` integer NOT NULL DEFAULT (unixepoch())
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_audit_event_type` ON `admin_audit_log` (`event_type`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_audit_created_at` ON `admin_audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_audit_actor` ON `admin_audit_log` (`actor_email`);
