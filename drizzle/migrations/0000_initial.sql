CREATE TABLE `agent_addrs` (
	`agent_id` text PRIMARY KEY NOT NULL,
	`public_key_hex` text NOT NULL,
	`facts_url` text,
	`private_url` text,
	`resolver_url` text,
	`ttl_seconds` integer DEFAULT 300 NOT NULL,
	`signature_hex` text NOT NULL,
	`signer_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer,
	`source` text DEFAULT 'local' NOT NULL,
	`quilt_type` text DEFAULT 'native' NOT NULL,
	`content_id` text,
	`agent_url` text,
	`api_url` text,
	`capabilities` text,
	`tags` text,
	`status` text DEFAULT 'alive',
	`version` text DEFAULT '1.0.0',
	`deprecated_at` integer,
	`sunset_at` integer,
	`registered_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_agent_addrs_source` ON `agent_addrs` (`source`);--> statement-breakpoint
CREATE INDEX `idx_agent_addrs_quilt` ON `agent_addrs` (`quilt_type`);--> statement-breakpoint
CREATE INDEX `idx_agent_addrs_expires` ON `agent_addrs` (`expires_at`);--> statement-breakpoint
CREATE INDEX `idx_agent_addrs_signer` ON `agent_addrs` (`signer_id`);--> statement-breakpoint
CREATE INDEX `idx_agent_addrs_status` ON `agent_addrs` (`status`);--> statement-breakpoint
CREATE TABLE `agent_behavior_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`period_type` text DEFAULT 'daily' NOT NULL,
	`uptime_pct` real,
	`avg_response_ms` real,
	`p95_response_ms` integer,
	`success_rate` real,
	`total_requests` integer DEFAULT 0,
	`error_count` integer DEFAULT 0,
	`payment_reliability` real,
	`reputation_score` real,
	`badge_tier` text,
	`computed_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_abm_agent_period` ON `agent_behavior_metrics` (`agent_id`,`period_type`,`period_start`);--> statement-breakpoint
CREATE INDEX `idx_abm_period_type` ON `agent_behavior_metrics` (`period_type`,`period_start`);--> statement-breakpoint
CREATE TABLE `agent_facts` (
	`agent_id` text PRIMARY KEY NOT NULL,
	`facts_json` text NOT NULL,
	`agent_name` text,
	`provider_did` text,
	`jurisdiction` text,
	`cert_level` text,
	`schema_version` text DEFAULT '1.0.0',
	`fetched_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	`trust_score` real,
	`compliance_status` text,
	`compliance_checked_at` text,
	`vc_json` text,
	`vc_issued_at` integer,
	`vc_expires_at` integer,
	`disclosure_policy` text DEFAULT 'public',
	FOREIGN KEY (`agent_id`) REFERENCES `agent_addrs`(`agent_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_af_name` ON `agent_facts` (`agent_name`);--> statement-breakpoint
CREATE INDEX `idx_af_jurisdiction` ON `agent_facts` (`jurisdiction`);--> statement-breakpoint
CREATE TABLE `agent_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`version` text NOT NULL,
	`agent_url` text NOT NULL,
	`api_url` text,
	`facts_url` text,
	`capabilities` text,
	`changelog` text,
	`status` text DEFAULT 'alive',
	`created_at` integer DEFAULT (unixepoch()),
	`deprecated_at` integer,
	`sunset_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_av_agent_version` ON `agent_versions` (`agent_id`,`version`);--> statement-breakpoint
CREATE INDEX `idx_av_agent_status` ON `agent_versions` (`agent_id`,`status`);--> statement-breakpoint
CREATE TABLE `audit_intents` (
	`intent_id` text PRIMARY KEY NOT NULL,
	`payer` text NOT NULL,
	`payee` text NOT NULL,
	`amount` integer NOT NULL,
	`memo` text,
	`nonce` text,
	`window_sec` integer DEFAULT 3600,
	`status` text DEFAULT 'open',
	`created_at` integer DEFAULT (unixepoch()),
	`expires_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_ai_payer` ON `audit_intents` (`payer`,`status`);--> statement-breakpoint
CREATE TABLE `audit_reconciliations` (
	`recon_id` text PRIMARY KEY NOT NULL,
	`intent_id` text,
	`tx_hash` text,
	`verdict` text NOT NULL,
	`delta` integer,
	`latency_ms` integer,
	`balances` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`intent_id`) REFERENCES `audit_intents`(`intent_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `audit_settlements` (
	`settlement_id` text PRIMARY KEY NOT NULL,
	`tx_hash` text NOT NULL,
	`frm` text NOT NULL,
	`to_agent` text NOT NULL,
	`amount` integer NOT NULL,
	`ts` integer NOT NULL,
	`sig` text,
	`verified` integer DEFAULT 0,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `audit_wallets` (
	`agent_name` text NOT NULL,
	`balance_minor` integer DEFAULT 0,
	`currency` text DEFAULT 'NP' NOT NULL,
	`scale` integer DEFAULT 0,
	`updated_at` integer DEFAULT (unixepoch()),
	PRIMARY KEY(`agent_name`, `currency`)
);
--> statement-breakpoint
CREATE TABLE `billing_line_items` (
	`id` text PRIMARY KEY NOT NULL,
	`period_id` text NOT NULL,
	`description` text NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`unit_price_np` real DEFAULT 0 NOT NULL,
	`total_np` integer DEFAULT 0 NOT NULL,
	`category` text DEFAULT 'overage' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`period_id`) REFERENCES `billing_periods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_bli_period` ON `billing_line_items` (`period_id`);--> statement-breakpoint
CREATE TABLE `billing_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`key_id` text NOT NULL,
	`tier` text DEFAULT 'free' NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`total_calls` integer DEFAULT 0 NOT NULL,
	`included_calls` integer DEFAULT 1000 NOT NULL,
	`overage_calls` integer DEFAULT 0 NOT NULL,
	`overage_charge_np` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`closed_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_bp_key` ON `billing_periods` (`key_id`);--> statement-breakpoint
CREATE INDEX `idx_bp_status` ON `billing_periods` (`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_bp_key_period` ON `billing_periods` (`key_id`,`period_start`);--> statement-breakpoint
CREATE TABLE `cert_jobs` (
	`job_id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`capability` text NOT NULL,
	`status` text DEFAULT 'pending',
	`num_trials` integer DEFAULT 5,
	`completed_trials` integer DEFAULT 0,
	`pass_threshold` real DEFAULT 0.8,
	`score` real,
	`grade` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `cert_revocations` (
	`cert_id` text PRIMARY KEY NOT NULL,
	`reason` text NOT NULL,
	`status_list_index` integer,
	`revoked_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`cert_id`) REFERENCES `certificates`(`cert_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_cert_rev_status_list_index` ON `cert_revocations` (`status_list_index`);--> statement-breakpoint
CREATE TABLE `certificates` (
	`cert_id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`capability` text NOT NULL,
	`score` real NOT NULL,
	`grade` text NOT NULL,
	`ci95_lo` real,
	`ci95_hi` real,
	`n_trials` integer NOT NULL,
	`hmac_signature` text NOT NULL,
	`ed25519_vc` text,
	`evidence_uri` text,
	`issued_at` integer DEFAULT (unixepoch()),
	`expires_at` integer
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`client_id` text PRIMARY KEY NOT NULL,
	`assigned_agent_id` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`assigned_agent_id`) REFERENCES `agent_addrs`(`agent_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `compliance_decisions` (
	`decision_id` text PRIMARY KEY NOT NULL,
	`envelope_hash` text NOT NULL,
	`from_agent` text,
	`to_agent` text,
	`capability` text,
	`decision` text NOT NULL,
	`reasons` text,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_cd_agents` ON `compliance_decisions` (`from_agent`,`to_agent`);--> statement-breakpoint
CREATE TABLE `compliance_policies` (
	`policy_id` text PRIMARY KEY NOT NULL,
	`rules_json` text NOT NULL,
	`version` integer DEFAULT 1,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `compliance_scan_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`policy_id` text NOT NULL,
	`decision` text NOT NULL,
	`reasons` text,
	`scan_type` text DEFAULT 'scheduled',
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_csr_agent_created` ON `compliance_scan_runs` (`agent_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_csr_decision` ON `compliance_scan_runs` (`decision`);--> statement-breakpoint
CREATE TABLE `compliance_violations` (
	`violation_id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`envelope_hash` text,
	`reason` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_cv_agent` ON `compliance_violations` (`agent_id`);--> statement-breakpoint
CREATE TABLE `conflict_resolutions` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`run_id` text,
	`step_id` text,
	`conflict_type` text DEFAULT 'competing_response' NOT NULL,
	`strategy` text DEFAULT 'highest_score' NOT NULL,
	`candidates_json` text DEFAULT '[]' NOT NULL,
	`winner_agent_id` text,
	`winner_response` text,
	`resolution_score` real,
	`resolved` integer DEFAULT 0 NOT NULL,
	`resolved_at` integer,
	`metadata_json` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `workflow_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_cr_workflow` ON `conflict_resolutions` (`workflow_id`);--> statement-breakpoint
CREATE INDEX `idx_cr_run` ON `conflict_resolutions` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_cr_resolved` ON `conflict_resolutions` (`resolved`);--> statement-breakpoint
CREATE INDEX `idx_cr_type` ON `conflict_resolutions` (`conflict_type`);--> statement-breakpoint
CREATE TABLE `cross_registry_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`local_reputation` real,
	`federated_reputation` real,
	`combined_reputation` real,
	`peer_count` integer DEFAULT 0,
	`confidence` real DEFAULT 0,
	`badge_tier` text DEFAULT 'none',
	`computed_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cross_registry_scores_agent_id_unique` ON `cross_registry_scores` (`agent_id`);--> statement-breakpoint
CREATE INDEX `idx_crs_agent` ON `cross_registry_scores` (`agent_id`);--> statement-breakpoint
CREATE TABLE `currencies` (
	`symbol` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`decimals` integer DEFAULT 6 NOT NULL,
	`chain` text,
	`contract_address` text,
	`active` integer DEFAULT 1 NOT NULL,
	`category` text DEFAULT 'stablecoin' NOT NULL,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE TABLE `delegation_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_workflow_id` text,
	`parent_step_id` text,
	`delegator_id` text NOT NULL,
	`delegate_id` text NOT NULL,
	`task_type` text DEFAULT 'a2a_call' NOT NULL,
	`action` text NOT NULL,
	`input_json` text DEFAULT '{}' NOT NULL,
	`output_json` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`delegation_token` text,
	`timeout_ms` integer DEFAULT 30000 NOT NULL,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`max_retries` integer DEFAULT 3 NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`parent_workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_dt_delegator` ON `delegation_tasks` (`delegator_id`);--> statement-breakpoint
CREATE INDEX `idx_dt_delegate` ON `delegation_tasks` (`delegate_id`);--> statement-breakpoint
CREATE INDEX `idx_dt_status` ON `delegation_tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_dt_workflow` ON `delegation_tasks` (`parent_workflow_id`);--> statement-breakpoint
CREATE TABLE `developer_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`owner_email` text,
	`status` text DEFAULT 'active' NOT NULL,
	`tier` text DEFAULT 'free' NOT NULL,
	`rate_limit_monthly` integer DEFAULT 1000 NOT NULL,
	`scopes` text,
	`last_used_at` integer,
	`usage_count_monthly` integer DEFAULT 0 NOT NULL,
	`usage_reset_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	`revoked_at` integer,
	`expires_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_dev_keys_key_hash` ON `developer_keys` (`key_hash`);--> statement-breakpoint
CREATE INDEX `idx_dev_keys_owner` ON `developer_keys` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_dev_keys_status` ON `developer_keys` (`status`);--> statement-breakpoint
CREATE INDEX `idx_dev_keys_prefix` ON `developer_keys` (`key_prefix`);--> statement-breakpoint
CREATE TABLE `external_registries` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`adapter_type` text DEFAULT 'nanda' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`sync_interval_min` integer DEFAULT 60 NOT NULL,
	`last_sync_at` integer,
	`last_sync_status` text,
	`last_sync_agent_count` integer DEFAULT 0,
	`last_sync_error` text,
	`total_agents_synced` integer DEFAULT 0,
	`config_json` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_er_enabled` ON `external_registries` (`enabled`);--> statement-breakpoint
CREATE INDEX `idx_er_adapter` ON `external_registries` (`adapter_type`);--> statement-breakpoint
CREATE TABLE `federation_peers` (
	`peer_id` text PRIMARY KEY NOT NULL,
	`peer_url` text NOT NULL,
	`node_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`last_sync_at` integer,
	`last_gossip_at` integer,
	`vector_clock` text DEFAULT '{}',
	`failure_count` integer DEFAULT 0,
	`capabilities` text DEFAULT '[]',
	`quilt_types` text DEFAULT '["native"]',
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_fp_status` ON `federation_peers` (`status`);--> statement-breakpoint
CREATE INDEX `idx_fp_node` ON `federation_peers` (`node_id`);--> statement-breakpoint
CREATE TABLE `federation_trust_scores` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`peer_url` text NOT NULL,
	`reputation` real,
	`availability` real,
	`probe_success` real,
	`cert_score` real,
	`fraud_rate` real,
	`badge_tier` text DEFAULT 'none',
	`fetched_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_fts_agent` ON `federation_trust_scores` (`agent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_fts_agent_peer` ON `federation_trust_scores` (`agent_id`,`peer_url`);--> statement-breakpoint
CREATE TABLE `gossip_log` (
	`id` text PRIMARY KEY NOT NULL,
	`peer_id` text NOT NULL,
	`direction` text DEFAULT 'inbound' NOT NULL,
	`message_json` text NOT NULL,
	`deltas_count` integer DEFAULT 0,
	`accepted` integer DEFAULT 0,
	`rejected` integer DEFAULT 0,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_gl_peer` ON `gossip_log` (`peer_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_gl_direction` ON `gossip_log` (`direction`,`created_at`);--> statement-breakpoint
CREATE TABLE `invoice_sequence` (
	`year` integer PRIMARY KEY NOT NULL,
	`next_number` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_number` text NOT NULL,
	`period_id` text,
	`key_id` text NOT NULL,
	`subscription_id` text,
	`line_items` text NOT NULL,
	`subtotal_np` integer DEFAULT 0 NOT NULL,
	`total_np` integer DEFAULT 0 NOT NULL,
	`total_usd_equivalent` real,
	`currency` text DEFAULT 'NP' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`issued_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`period_id`) REFERENCES `billing_periods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_invoice_number_unique` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `idx_inv_key` ON `invoices` (`key_id`);--> statement-breakpoint
CREATE INDEX `idx_inv_period` ON `invoices` (`period_id`);--> statement-breakpoint
CREATE TABLE `orchestrator_patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`category` text DEFAULT 'general' NOT NULL,
	`dag_template_json` text NOT NULL,
	`input_schema_json` text,
	`tags` text DEFAULT '[]',
	`usage_count` integer DEFAULT 0,
	`is_builtin` integer DEFAULT 0,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_op_category` ON `orchestrator_patterns` (`category`);--> statement-breakpoint
CREATE INDEX `idx_op_builtin` ON `orchestrator_patterns` (`is_builtin`);--> statement-breakpoint
CREATE TABLE `probe_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`endpoint` text,
	`capability` text,
	`probes_sent` integer,
	`success_count` integer,
	`p95_latency_ms` integer,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_pr_agent` ON `probe_runs` (`agent_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `protocol_adapters` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`protocol` text NOT NULL,
	`detected_at` integer DEFAULT (unixepoch()),
	`metadata_json` text,
	`last_synced_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_pa_agent` ON `protocol_adapters` (`agent_id`);--> statement-breakpoint
CREATE INDEX `idx_pa_protocol` ON `protocol_adapters` (`protocol`);--> statement-breakpoint
CREATE TABLE `quilt_routes` (
	`id` text PRIMARY KEY NOT NULL,
	`prefix` text NOT NULL,
	`quilt_type` text NOT NULL,
	`peer_id` text NOT NULL,
	`priority` integer DEFAULT 0,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_qr_prefix_peer` ON `quilt_routes` (`prefix`,`peer_id`);--> statement-breakpoint
CREATE INDEX `idx_qr_quilt_type` ON `quilt_routes` (`quilt_type`);--> statement-breakpoint
CREATE TABLE `reputation_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`availability` real,
	`error_rate` real,
	`fraud_rate` real,
	`p95_latency_ms` integer,
	`probe_success` real,
	`cert_score` real,
	`reputation` real,
	`actions` text,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_rs_agent` ON `reputation_snapshots` (`agent_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `resolution_log` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`requester_id` text,
	`strategy` text DEFAULT 'static' NOT NULL,
	`context_json` text,
	`result_json` text,
	`latency_ms` integer,
	`cache_hit` integer DEFAULT 0,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_rl_agent` ON `resolution_log` (`agent_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_rl_strategy` ON `resolution_log` (`strategy`);--> statement-breakpoint
CREATE TABLE `revenue_settlements` (
	`id` text PRIMARY KEY NOT NULL,
	`developer_id` text NOT NULL,
	`total_np` integer DEFAULT 0 NOT NULL,
	`shares_count` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`settled_at` integer,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_rse_developer` ON `revenue_settlements` (`developer_id`);--> statement-breakpoint
CREATE INDEX `idx_rse_status` ON `revenue_settlements` (`status`);--> statement-breakpoint
CREATE TABLE `revenue_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`split_id` text NOT NULL,
	`period_id` text NOT NULL,
	`gross_revenue_np` integer DEFAULT 0 NOT NULL,
	`developer_share_np` integer DEFAULT 0 NOT NULL,
	`platform_share_np` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`split_id`) REFERENCES `revenue_splits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`period_id`) REFERENCES `billing_periods`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_rsh_split` ON `revenue_shares` (`split_id`);--> statement-breakpoint
CREATE INDEX `idx_rsh_period` ON `revenue_shares` (`period_id`);--> statement-breakpoint
CREATE INDEX `idx_rsh_status` ON `revenue_shares` (`status`);--> statement-breakpoint
CREATE TABLE `revenue_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`developer_id` text NOT NULL,
	`split_pct` integer DEFAULT 70 NOT NULL,
	`effective_from` integer NOT NULL,
	`effective_to` integer,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_revsplit_agent` ON `revenue_splits` (`agent_id`);--> statement-breakpoint
CREATE INDEX `idx_revsplit_developer` ON `revenue_splits` (`developer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_revsplit_agent_dev` ON `revenue_splits` (`agent_id`,`developer_id`,`effective_from`);--> statement-breakpoint
CREATE TABLE `routing_decisions` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`source_agent_id` text NOT NULL,
	`target_agent_id` text NOT NULL,
	`action` text NOT NULL,
	`strategy` text DEFAULT 'capability' NOT NULL,
	`score` real DEFAULT 0 NOT NULL,
	`context_json` text,
	`candidates_json` text,
	`selected_reason` text,
	`latency_ms` integer,
	`success` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_rd_source` ON `routing_decisions` (`source_agent_id`);--> statement-breakpoint
CREATE INDEX `idx_rd_target` ON `routing_decisions` (`target_agent_id`);--> statement-breakpoint
CREATE INDEX `idx_rd_action` ON `routing_decisions` (`action`);--> statement-breakpoint
CREATE INDEX `idx_rd_created` ON `routing_decisions` (`created_at`);--> statement-breakpoint
CREATE TABLE `site_visitors` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`source` text DEFAULT 'vault_gate' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`visit_count` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`last_visited_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `site_visitors_email_unique` ON `site_visitors` (`email`);--> statement-breakpoint
CREATE INDEX `idx_sv_email` ON `site_visitors` (`email`);--> statement-breakpoint
CREATE INDEX `idx_sv_status` ON `site_visitors` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sv_created` ON `site_visitors` (`created_at`);--> statement-breakpoint
CREATE TABLE `subscription_events` (
	`id` text PRIMARY KEY NOT NULL,
	`subscription_id` text NOT NULL,
	`event_type` text NOT NULL,
	`from_plan` text,
	`to_plan` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_se_sub` ON `subscription_events` (`subscription_id`);--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`key_id` text NOT NULL,
	`plan` text DEFAULT 'starter' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`period_start` integer NOT NULL,
	`period_end` integer NOT NULL,
	`auto_renew` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()),
	`cancelled_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_sub_key` ON `subscriptions` (`key_id`);--> statement-breakpoint
CREATE INDEX `idx_sub_status` ON `subscriptions` (`status`);--> statement-breakpoint
CREATE TABLE `telemetry_events` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`latency_ms` integer,
	`success` integer,
	`status_code` integer,
	`fraud_flag` integer DEFAULT 0,
	`note` text,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_te_agent` ON `telemetry_events` (`agent_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `trial_results` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`trial_num` integer NOT NULL,
	`topic` text DEFAULT 'general',
	`prompt` text NOT NULL,
	`expected` text NOT NULL,
	`actual` text,
	`score` real,
	`passed` integer,
	`latency_ms` integer,
	`evidence_r2_key` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`job_id`) REFERENCES `cert_jobs`(`job_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_trial_results_job_trial` ON `trial_results` (`job_id`,`trial_num`);--> statement-breakpoint
CREATE TABLE `trust_framework_meta` (
	`id` text PRIMARY KEY NOT NULL,
	`framework_id` text NOT NULL,
	`name` text NOT NULL,
	`version` text NOT NULL,
	`governance_url` text,
	`alignment` text,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE UNIQUE INDEX `trust_framework_meta_framework_id_unique` ON `trust_framework_meta` (`framework_id`);--> statement-breakpoint
CREATE TABLE `trust_graph_edges` (
	`id` text PRIMARY KEY NOT NULL,
	`from_did` text NOT NULL,
	`to_did` text NOT NULL,
	`relationship` text NOT NULL,
	`trust_level` real DEFAULT 0,
	`evidence_uri` text,
	`framework_id` text,
	`valid_from` integer,
	`valid_until` integer,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_tge_from` ON `trust_graph_edges` (`from_did`);--> statement-breakpoint
CREATE INDEX `idx_tge_to` ON `trust_graph_edges` (`to_did`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tge_unique_edge` ON `trust_graph_edges` (`from_did`,`to_did`,`relationship`);--> statement-breakpoint
CREATE TABLE `ucp_checkout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`client_agent_id` text,
	`line_items` text NOT NULL,
	`totals` text NOT NULL,
	`payment` text,
	`metadata` text,
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch()),
	`expires_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_ucp_cs_status` ON `ucp_checkout_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ucp_cs_client` ON `ucp_checkout_sessions` (`client_agent_id`);--> statement-breakpoint
CREATE TABLE `webhook_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`callback_url` text NOT NULL,
	`events` text NOT NULL,
	`secret` text NOT NULL,
	`owner_id` text,
	`status` text DEFAULT 'active',
	`failure_count` integer DEFAULT 0,
	`last_delivered_at` integer,
	`created_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_ws_owner` ON `webhook_subscriptions` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_ws_status` ON `webhook_subscriptions` (`status`);--> statement-breakpoint
CREATE TABLE `workflow_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`run_id` text,
	`step_id` text,
	`event_type` text DEFAULT 'step_status' NOT NULL,
	`payload_json` text DEFAULT '{}' NOT NULL,
	`emitted_at` integer DEFAULT (unixepoch()) NOT NULL,
	`consumed` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `workflow_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_we_workflow` ON `workflow_events` (`workflow_id`);--> statement-breakpoint
CREATE INDEX `idx_we_run` ON `workflow_events` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_we_emitted` ON `workflow_events` (`emitted_at`);--> statement-breakpoint
CREATE INDEX `idx_we_consumed` ON `workflow_events` (`consumed`,`emitted_at`);--> statement-breakpoint
CREATE TABLE `workflow_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`trigger_type` text DEFAULT 'manual' NOT NULL,
	`input_json` text DEFAULT '{}',
	`output_json` text,
	`error_message` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_wr_workflow` ON `workflow_runs` (`workflow_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_wr_status` ON `workflow_runs` (`status`);--> statement-breakpoint
CREATE TABLE `workflow_step_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`step_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`input_json` text,
	`output_json` text,
	`error_message` text,
	`attempt` integer DEFAULT 1,
	`started_at` integer,
	`completed_at` integer,
	`duration_ms` integer,
	`delegated_to` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`run_id`) REFERENCES `workflow_runs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`step_id`) REFERENCES `workflow_steps`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_wsr_run` ON `workflow_step_runs` (`run_id`);--> statement-breakpoint
CREATE INDEX `idx_wsr_step` ON `workflow_step_runs` (`step_id`);--> statement-breakpoint
CREATE INDEX `idx_wsr_status` ON `workflow_step_runs` (`status`);--> statement-breakpoint
CREATE TABLE `workflow_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`workflow_id` text NOT NULL,
	`step_type` text DEFAULT 'agent_call' NOT NULL,
	`agent_id` text,
	`action` text,
	`config_json` text DEFAULT '{}',
	`position_x` real DEFAULT 0,
	`position_y` real DEFAULT 0,
	`depends_on` text DEFAULT '[]',
	`timeout_ms` integer DEFAULT 30000,
	`retry_count` integer DEFAULT 0,
	`retry_delay_ms` integer DEFAULT 1000,
	`condition_json` text,
	`created_at` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_ws_workflow` ON `workflow_steps` (`workflow_id`);--> statement-breakpoint
CREATE INDEX `idx_ws_agent` ON `workflow_steps` (`agent_id`);--> statement-breakpoint
CREATE TABLE `workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`owner_id` text NOT NULL,
	`dag_json` text DEFAULT '{"nodes":[],"edges":[]}' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`template_id` text,
	`metadata` text DEFAULT '{}',
	`created_at` integer DEFAULT (unixepoch()),
	`updated_at` integer DEFAULT (unixepoch())
);
--> statement-breakpoint
CREATE INDEX `idx_wf_owner` ON `workflows` (`owner_id`);--> statement-breakpoint
CREATE INDEX `idx_wf_status` ON `workflows` (`status`);--> statement-breakpoint
CREATE INDEX `idx_wf_template` ON `workflows` (`template_id`);