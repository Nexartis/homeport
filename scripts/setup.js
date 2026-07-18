#!/usr/bin/env node
/**
 * NANDA Node — Self-Hosted Setup Script
 *
 * Reads cube.jsonc and provisions all required Cloudflare infrastructure:
 *   1. D1 database + baseline migration
 *   2. R2 bucket
 *   3. KV namespace
 *   4. Ed25519 keypair generation
 *   5. HMAC + RADIUS secret generation
 *   6. Cron auth token + federation admin key
 *
 * Usage:
 *   pnpm run setup              # Interactive — prompts for node slug
 *   pnpm run setup -- --slug my-node --env prod
 *
 * Prerequisites:
 *   - wrangler CLI authenticated (`wrangler login`)
 *   - Node.js 20+
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { randomBytes, generateKeyPairSync } from 'node:crypto';
import { createInterface } from 'node:readline';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function run(cmd) {
	console.log(`  $ ${cmd}`);
	return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'inherit'] }).trim();
}

function parseJsonc(text) {
	return JSON.parse(text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''));
}

async function prompt(question) {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

function randomToken(bytes = 32) {
	return randomBytes(bytes).toString('hex');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	console.log('\n🔧 NANDA Node — Self-Hosted Setup\n');

	// Parse args
	const args = process.argv.slice(2);
	let slug = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;
	let env = args.includes('--env') ? args[args.indexOf('--env') + 1] : 'prod';

	if (!slug) {
		slug = await prompt('Enter node slug (e.g., my-nanda-node): ');
		if (!slug) {
			console.error('❌ Slug is required.');
			process.exit(1);
		}
	}

	// Load cube.jsonc
	const manifestPath = 'cube.jsonc';
	if (!existsSync(manifestPath)) {
		console.error('❌ cube.jsonc not found. Run from repo root.');
		process.exit(1);
	}
	const manifest = parseJsonc(readFileSync(manifestPath, 'utf8'));
	console.log(`📦 Manifest: ${manifest.displayName} v${manifest.version}`);
	console.log(`🏷️  Slug (workerName): ${slug}  |  Env: ${env}\n`);

	// Resolve resource names from cube.jsonc bindingConfig templates
	const bc = manifest.bindingConfig || {};
	const resolveTemplate = (tmpl) => tmpl.replace(/{workerName}/g, slug);

	const dbTemplate = bc.d1_databases?.[0]?.database_name_template;
	const r2Template = bc.r2_buckets?.[0]?.bucket_name_template;
	const kvTemplate = bc.kv_namespaces?.[0]?.namespace_name_template;

	const dbName = dbTemplate ? resolveTemplate(dbTemplate) : `${slug}-db`;
	const bucketName = r2Template ? resolveTemplate(r2Template) : `${slug}-evidence`;
	const kvName = kvTemplate ? resolveTemplate(kvTemplate) : `${slug}-cache`;

	console.log(`  Resource names: D1=${dbName}  R2=${bucketName}  KV=${kvName}\n`);

	// 1. Create D1 database
	console.log('━━━ 1/6 D1 Database ━━━');
	try {
		const out = run(`wrangler d1 create ${dbName}`);
		const idMatch = out.match(/database_id\s*=\s*"([^"]+)"/);
		if (idMatch) console.log(`  ✅ Created D1: ${dbName} (${idMatch[1]})`);
	} catch {
		console.log(`  ⚠️  D1 "${dbName}" may already exist — skipping.`);
	}

	// Run baseline migration
	console.log('  Running baseline migration...');
	try {
		run(`wrangler d1 migrations apply ${dbName} --env ${env}`);
		console.log('  ✅ Migration applied.');
	} catch (e) {
		console.log(`  ⚠️  Migration may have already been applied: ${e.message}`);
	}

	// 2. Create R2 bucket
	console.log('\n━━━ 2/6 R2 Bucket ━━━');
	try {
		run(`wrangler r2 bucket create ${bucketName}`);
		console.log(`  ✅ Created R2: ${bucketName}`);
	} catch {
		console.log(`  ⚠️  R2 "${bucketName}" may already exist — skipping.`);
	}

	// 3. Create KV namespace
	console.log('\n━━━ 3/6 KV Namespace ━━━');
	try {
		const out = run(`wrangler kv namespace create ${kvName}`);
		const idMatch = out.match(/id\s*=\s*"([^"]+)"/);
		if (idMatch) console.log(`  ✅ Created KV: ${kvName} (${idMatch[1]})`);
	} catch {
		console.log(`  ⚠️  KV "${kvName}" may already exist — skipping.`);
	}

	// 4. Generate Ed25519 keypair
	console.log('\n━━━ 4/6 Ed25519 Keypair ━━━');
	const { publicKey, privateKey } = generateKeyPairSync('ed25519');
	const pubKeyB64 = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
	const privKeyB64 = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
	console.log(`  ✅ Ed25519 public key: ${pubKeyB64.substring(0, 30)}...`);

	// 5. Generate HMAC + RADIUS secrets
	console.log('\n━━━ 5/6 HMAC & RADIUS Secrets ━━━');
	const hmacSecret = randomToken(32);
	const radiusSecret = randomToken(32);
	const cronToken = randomToken(32);
	console.log('  ✅ Generated HMAC, RADIUS, and cron auth secrets.');

	// 6. Generate federation admin key
	console.log('\n━━━ 6/6 Federation Admin Key ━━━');
	const fedAdminKey = randomToken(32);
	console.log('  ✅ Generated federation admin key.');

	// Output summary
	console.log('\n═══════════════════════════════════════════════════');
	console.log('  Setup Complete! Add these to your wrangler.jsonc:');
	console.log('═══════════════════════════════════════════════════\n');
	console.log('Secrets for self-hosted `wrangler secret put` (binding names):');
	console.log(`  KYM_NANDA_ED25519_PRIVATE_KEY_v1 = ${privKeyB64}`);
	console.log(`  KYM_NANDA_HMAC_SECRET            = ${hmacSecret}`);
	console.log(`  KYM_NANDA_RADIUS_SECRET           = ${radiusSecret}`);
	console.log(`  CRON_AUTH_TOKEN                   = ${cronToken}`);
	console.log(`  NANDA_FEDERATION_ADMIN_KEY        = ${fedAdminKey}`);
	console.log('\nNexartis-hosted Secrets Store uses secret_name values instead:');
	console.log('  CRON_AUTH_TOKEN            -> KYM_CRON_AUTH_TOKEN');
	console.log('  NANDA_FEDERATION_ADMIN_KEY -> KYM_NANDA_FEDERATION_ADMIN_KEY');
	console.log('\nEnvironment vars:');
	console.log(`  NANDA_ED25519_PUBLIC_KEY_v1       = ${pubKeyB64}`);
	console.log(`  NANDA_NODE_ID                     = ${slug}`);
	console.log('\n🚀 Now run: pnpm run deploy:prod\n');
}

main().catch((err) => {
	console.error('❌ Setup failed:', err);
	process.exit(1);
});
