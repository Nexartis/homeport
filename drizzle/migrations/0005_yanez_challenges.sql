-- ===================================================================
-- Yanez biometric sign-and-return challenges (opt-in service).
-- Backs /api/yanez/{challenge,callback,status}. One row per signing
-- request; single-use (status moves pending -> verified|invalid|expired).
-- Idempotent: safe to re-run.
-- ===================================================================

CREATE TABLE IF NOT EXISTS `yanez_challenges` (
	`id` text PRIMARY KEY NOT NULL,             -- request_id (uuid)
	`kind` text NOT NULL DEFAULT 'session',     -- session (sign-and-return)
	`status` text NOT NULL DEFAULT 'pending',   -- pending | verified | invalid | expired
	`subject` text,                             -- optional caller-supplied context
	`message_b64` text NOT NULL,                -- base64url message the app signs verbatim
	`callback_url` text NOT NULL,               -- callback embedded in the deep link
	`deep_link` text NOT NULL,                  -- yanezbio://sign?... (for re-render)
	`verify_ok` integer NOT NULL DEFAULT 0,     -- boolean: signature verified
	`yid` text,                                 -- returned stable id (if present)
	`group_public_key` text,                    -- returned G1 pubkey hex
	`eth_address` text,                         -- server-re-derived EIP-55 address
	`signature` text,                           -- returned G2 signature hex
	`payload_json` text,                        -- full verified callback payload (json)
	`reason` text,                              -- invalidation reason (if invalid)
	`created_at` integer NOT NULL DEFAULT (unixepoch()),
	`updated_at` integer NOT NULL DEFAULT (unixepoch()),
	`expires_at` integer NOT NULL               -- unix seconds; single-use TTL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_yanez_challenges_status` ON `yanez_challenges` (`status`);
