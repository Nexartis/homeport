#!/usr/bin/env node
/**
 * Post-Build Script: Inject Scheduled Handler for Cloudflare Cron Triggers
 *
 * SvelteKit doesn't natively support Cloudflare Workers' `scheduled` event.
 * This script patches the generated _worker.js to add a scheduled handler
 * that runs hourly probe scheduling tasks.
 *
 * Usage:
 * - Run after `vite build`: node scripts/inject-scheduled-handler.js
 * - Added to package.json postbuild chain
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const workerPath = join(projectRoot, '.svelte-kit/cloudflare/_worker.js');

console.log('[Scheduled Handler] Injecting scheduled handler into _worker.js...');

try {
	const content = readFileSync(workerPath, 'utf-8');

	// Check if already patched
	if (content.includes('// SCHEDULED HANDLER INJECTED')) {
		console.log('[Scheduled Handler] Already patched, skipping...');
		process.exit(0);
	}

	const SCHEDULED_HANDLER = `
// SCHEDULED HANDLER INJECTED by scripts/inject-scheduled-handler.js
worker_default.scheduled = async function(controller, env, ctx) {
  var baseUrl = env.VITE_BASE_URL;
  var cronToken;
  try {
    cronToken = typeof env.CRON_AUTH_TOKEN === 'object' && env.CRON_AUTH_TOKEN
      ? await env.CRON_AUTH_TOKEN.get()
      : env.CRON_AUTH_TOKEN;
    // KV fallback for Pegasus deployments
    if (!cronToken && env.NANDA_NODE_CACHE) {
      cronToken = await env.NANDA_NODE_CACHE.get('__node_secrets:cron_auth_token');
    }
  } catch (e) {
    console.error('[Cron] Failed to resolve CRON_AUTH_TOKEN:', e.message);
    return;
  }

  if (!baseUrl) {
    console.error('[Cron] VITE_BASE_URL not configured — skipping scheduled tasks');
    return;
  }

  if (!cronToken) {
    console.error('[Cron] CRON_AUTH_TOKEN not configured — skipping scheduled tasks');
    return;
  }

  var headers = {
    'Content-Type': 'application/json',
    'X-Cron-Auth': cronToken
  };

  async function runTask(name, path) {
    try {
      var response = await worker_default.fetch(
        new Request(baseUrl + path, { method: 'POST', headers: headers }),
        env, ctx
      );
      var data = await response.json();
      console.log('[Cron] ' + name + ':', JSON.stringify(data));
    } catch (e) {
      console.error('[Cron] ' + name + ' failed:', e.message);
    }
  }

  // Hourly tasks (0 * * * *)
  console.log('[scheduled] cron triggered (env=' + (env.ENVIRONMENT || 'unknown') + ')');
  await runTask('sweep-intents', '/api/cron/sweep-intents');
  await runTask('probe-scheduler', '/api/cron/probe-scheduler');

  // Phase 4: Sweep deprecated agents past sunset date → tombstone
  await runTask('sweep-sunset', '/api/cron/sweep-sunset');

  // Daily tasks — Agent Beta: compliance scan (runs every trigger, scanner is idempotent)
  await runTask('compliance-scan', '/api/compliance/scan');

  // Phase 6: Federation v2 gossip push + tombstone GC
  await runTask('gossip-push', '/api/cron/gossip-push');
};
// END SCHEDULED HANDLER
`;

	const EXPORT_PATTERN = 'export {\n  worker_default as default\n};';

	if (!content.includes(EXPORT_PATTERN)) {
		console.error('[Scheduled Handler] Could not find expected export pattern in _worker.js.');
		console.error('The SvelteKit Cloudflare adapter output may have changed.');
		process.exit(1);
	}

	const patched = content.replace(EXPORT_PATTERN, SCHEDULED_HANDLER + '\n' + EXPORT_PATTERN);
	writeFileSync(workerPath, patched, 'utf-8');

	console.log('[Scheduled Handler] ✅ Successfully injected scheduled handler');
} catch (error) {
	console.error('[Scheduled Handler] ❌ Failed:', error.message);
	process.exit(1);
}
