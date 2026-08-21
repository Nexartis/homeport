ALTER TABLE `agent_addrs` ADD `visibility` text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_addrs` ADD `capability_manifest` text;--> statement-breakpoint
ALTER TABLE `agent_addrs` ADD `mcp_metadata` text;--> statement-breakpoint
ALTER TABLE `agent_addrs` ADD `pricing` text;--> statement-breakpoint
CREATE INDEX `idx_agent_addrs_visibility` ON `agent_addrs` (`visibility`);
