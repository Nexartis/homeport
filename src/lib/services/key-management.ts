/**
 * Key Management Service — generate, store, rotate, and query node secrets in KV.
 *
 * Used by Pegasus-deployed NANDA nodes where secrets are managed via
 * the admin UI (/admin/keys) rather than Cloudflare Secrets Store.
 *
 * All secrets are stored in the KV namespace `NANDA_NODE_CACHE` under
 * the `__node_secrets:` prefix (see node-secrets.ts for key names).
 */
import { KV_SECRET_PREFIX } from '$lib/utils/resolve-secret';
import { SECRET_KEYS, type SecretKeyName } from '$lib/utils/node-secrets';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'key-management');

export interface KeyStatus {
	key: SecretKeyName;
	label: string;
	initialized: boolean;
	/** ISO timestamp of when the key was last set (stored as KV metadata) */
	updatedAt?: string;
	/** Whether this key has a public key counterpart (e.g., Ed25519) */
	hasPublicKey?: boolean;
	publicKey?: string;
}

export interface InitResult {
	success: boolean;
	keys: Record<string, boolean>;
	publicKeys?: Record<string, string>;
	error?: string;
}

/**
 * Check the initialization status of all node secrets in KV.
 */
export async function getKeyStatus(kv: KVNamespace): Promise<KeyStatus[]> {
	const statuses: KeyStatus[] = [];

	for (const [label, key] of Object.entries(SECRET_KEYS)) {
		const kvKey = `${KV_SECRET_PREFIX}${key}`;
		try {
			const { value, metadata } = await kv.getWithMetadata<{ updatedAt?: string }>(kvKey);
			const isEd25519 = key.startsWith('ed25519_private_key');
			let publicKey: string | undefined;

			if (isEd25519 && value) {
				// Read associated public key
				const version = key.replace('ed25519_private_key_', '');
				publicKey = (await kv.get(`${KV_SECRET_PREFIX}ed25519_public_key_${version}`)) ?? undefined;
			}

			statuses.push({
				key: key as SecretKeyName,
				label: label.replace(/_/g, ' '),
				initialized: !!value,
				updatedAt: metadata?.updatedAt,
				hasPublicKey: isEd25519,
				publicKey
			});
		} catch (err) {
			log.error('getKeyStatus', `Failed to check key: ${key}`, {
				error: (err as Error)?.message ?? String(err)
			});
			statuses.push({ key: key as SecretKeyName, label, initialized: false });
		}
	}

	return statuses;
}

/**
 * Check if all required secrets are initialized in KV.
 */
export async function areKeysInitialized(kv: KVNamespace): Promise<boolean> {
	const requiredKeys = [
		SECRET_KEYS.HMAC_SECRET,
		SECRET_KEYS.RADIUS_SECRET,
		SECRET_KEYS.ED25519_PRIVATE_KEY_V1,
		SECRET_KEYS.CRON_AUTH_TOKEN,
		SECRET_KEYS.FEDERATION_ADMIN_KEY
	];

	for (const key of requiredKeys) {
		const value = await kv.get(`${KV_SECRET_PREFIX}${key}`);
		if (!value) return false;
	}
	return true;
}

/** Generate a random 256-bit hex secret */
function generateRandomSecret(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

/** Generate a random URL-safe token (48 bytes → base64url) */
function generateRandomToken(): string {
	const bytes = new Uint8Array(48);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

/** Store a secret in KV with metadata */
async function storeSecret(kv: KVNamespace, key: string, value: string): Promise<void> {
	await kv.put(`${KV_SECRET_PREFIX}${key}`, value, {
		metadata: { updatedAt: new Date().toISOString() }
	});
}

/**
 * Initialize all node secrets. Generates new cryptographic material
 * and stores it in KV. Optionally skips keys that are already set.
 *
 * Returns the generated Ed25519 public key(s) for display in the admin UI.
 */
export async function initializeAllKeys(
	kv: KVNamespace,
	options: { force?: boolean } = {}
): Promise<InitResult> {
	const results: Record<string, boolean> = {};
	const publicKeys: Record<string, string> = {};

	try {
		// 1. HMAC secret (random 256-bit)
		if (options.force || !(await kv.get(`${KV_SECRET_PREFIX}${SECRET_KEYS.HMAC_SECRET}`))) {
			await storeSecret(kv, SECRET_KEYS.HMAC_SECRET, generateRandomSecret());
			results[SECRET_KEYS.HMAC_SECRET] = true;
		}

		// 2. RADIUS secret (random 256-bit)
		if (options.force || !(await kv.get(`${KV_SECRET_PREFIX}${SECRET_KEYS.RADIUS_SECRET}`))) {
			await storeSecret(kv, SECRET_KEYS.RADIUS_SECRET, generateRandomSecret());
			results[SECRET_KEYS.RADIUS_SECRET] = true;
		}

		// 3. Cron auth token (random URL-safe token)
		if (options.force || !(await kv.get(`${KV_SECRET_PREFIX}${SECRET_KEYS.CRON_AUTH_TOKEN}`))) {
			await storeSecret(kv, SECRET_KEYS.CRON_AUTH_TOKEN, generateRandomToken());
			results[SECRET_KEYS.CRON_AUTH_TOKEN] = true;
		}

		// 4. Federation admin key (random URL-safe token)
		if (
			options.force ||
			!(await kv.get(`${KV_SECRET_PREFIX}${SECRET_KEYS.FEDERATION_ADMIN_KEY}`))
		) {
			await storeSecret(kv, SECRET_KEYS.FEDERATION_ADMIN_KEY, generateRandomToken());
			results[SECRET_KEYS.FEDERATION_ADMIN_KEY] = true;
		}

		// 5. Ed25519 keypair (PKCS8 private key + SPKI public key, base64)
		if (
			options.force ||
			!(await kv.get(`${KV_SECRET_PREFIX}${SECRET_KEYS.ED25519_PRIVATE_KEY_V1}`))
		) {
			const keyPair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
			const privateKeyDer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey as CryptoKey);
			const publicKeyDer = await crypto.subtle.exportKey('spki', keyPair.publicKey as CryptoKey);

			const privateKeyBase64 = btoa(
				String.fromCharCode(...new Uint8Array(privateKeyDer as ArrayBuffer))
			);
			const publicKeyBase64 = btoa(
				String.fromCharCode(...new Uint8Array(publicKeyDer as ArrayBuffer))
			);

			await storeSecret(kv, SECRET_KEYS.ED25519_PRIVATE_KEY_V1, privateKeyBase64);
			await storeSecret(kv, 'ed25519_public_key_v1', publicKeyBase64);

			results[SECRET_KEYS.ED25519_PRIVATE_KEY_V1] = true;
			publicKeys['v1'] = publicKeyBase64;
		}

		return { success: true, keys: results, publicKeys };
	} catch (err) {
		log.error('initializeAllKeys', 'Key initialization failed', {
			error: (err as Error)?.message ?? String(err)
		});
		return {
			success: false,
			keys: results,
			error: (err as Error)?.message ?? 'Unknown error'
		};
	}
}

/**
 * Rotate a single secret. Generates new material and replaces the existing value.
 */
export async function rotateKey(
	kv: KVNamespace,
	key: SecretKeyName
): Promise<{ success: boolean; publicKey?: string; error?: string }> {
	try {
		if (key.startsWith('ed25519_private_key')) {
			const keyPair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
			const privateKeyDer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey as CryptoKey);
			const publicKeyDer = await crypto.subtle.exportKey('spki', keyPair.publicKey as CryptoKey);
			const privateKeyBase64 = btoa(
				String.fromCharCode(...new Uint8Array(privateKeyDer as ArrayBuffer))
			);
			const publicKeyBase64 = btoa(
				String.fromCharCode(...new Uint8Array(publicKeyDer as ArrayBuffer))
			);
			const version = key.replace('ed25519_private_key_', '');
			await storeSecret(kv, key, privateKeyBase64);
			await storeSecret(kv, `ed25519_public_key_${version}`, publicKeyBase64);
			return { success: true, publicKey: publicKeyBase64 };
		}

		// Token-style secrets
		if (key === SECRET_KEYS.CRON_AUTH_TOKEN || key === SECRET_KEYS.FEDERATION_ADMIN_KEY) {
			await storeSecret(kv, key, generateRandomToken());
		} else {
			await storeSecret(kv, key, generateRandomSecret());
		}

		return { success: true };
	} catch (err) {
		log.error('rotateKey', `Failed to rotate key: ${key}`, {
			error: (err as Error)?.message ?? String(err)
		});
		return { success: false, error: (err as Error)?.message ?? 'Unknown error' };
	}
}
