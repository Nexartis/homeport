ALTER TABLE `federation_peers` ADD `public_key_spki` text;--> statement-breakpoint
ALTER TABLE `federation_peers` ADD `key_updated_at` integer;
