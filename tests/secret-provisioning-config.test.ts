/// <reference types="vite/client" />

import { describe, expect, it } from 'vitest';

import cubeConfig from '../cube.jsonc?raw';
import secretProvisioningDocs from '../docs/secret-provisioning.md?raw';
import setupScript from '../scripts/setup.js?raw';
import wranglerConfig from '../wrangler.jsonc?raw';

const REQUIRED_SHARED_SECRETS = [
	['KYM_NANDA_HMAC_SECRET', 'KYM_NANDA_HMAC_SECRET'],
	['KYM_NANDA_RADIUS_SECRET', 'KYM_NANDA_RADIUS_SECRET'],
	['KYM_NANDA_ED25519_PRIVATE_KEY_v1', 'KYM_NANDA_ED25519_PRIVATE_KEY_v1'],
	['CRON_AUTH_TOKEN', 'KYM_CRON_AUTH_TOKEN'],
	['NANDA_FEDERATION_ADMIN_KEY', 'KYM_NANDA_FEDERATION_ADMIN_KEY']
] as const;

const HOSTED_WRANGLER_ENVS = ['dev', 'test', 'prod'] as const;
// Public OSS build: wrangler.jsonc ships with a placeholder store_id that the
// operator (or Pegasus provisioning) rewrites at deploy time. cube.jsonc may
// carry an operator-specific store_id for the shared Secrets Store; we assert
// it is present and non-empty but do not pin the exact value.
const WRANGLER_STORE_ID_PLACEHOLDER = '__PEGASUS_PROVISION__';

type SecretBinding = {
	binding?: string;
	store_id?: string;
	secret_name?: string;
	generate?: unknown;
};

type CubeConfig = {
	bindingConfig?: {
		secrets_store_secrets?: SecretBinding[];
	};
};

type WranglerConfig = {
	env?: Partial<
		Record<
			(typeof HOSTED_WRANGLER_ENVS)[number],
			{
				secrets_store_secrets?: SecretBinding[];
			}
		>
	>;
};

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripJsoncComments(source: string): string {
	let output = '';
	let inString = false;
	let escaped = false;
	let inLineComment = false;
	let inBlockComment = false;

	for (let index = 0; index < source.length; index += 1) {
		const char = source[index];
		const next = source[index + 1];

		if (inLineComment) {
			if (char === '\n') {
				inLineComment = false;
				output += char;
			}
			continue;
		}

		if (inBlockComment) {
			if (char === '*' && next === '/') {
				inBlockComment = false;
				index += 1;
			}
			continue;
		}

		if (!inString && char === '/' && next === '/') {
			inLineComment = true;
			index += 1;
			continue;
		}

		if (!inString && char === '/' && next === '*') {
			inBlockComment = true;
			index += 1;
			continue;
		}

		output += char;

		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (char === '\\') {
				escaped = true;
			} else if (char === '"') {
				inString = false;
			}
		} else if (char === '"') {
			inString = true;
		}
	}

	return output;
}

function removeTrailingCommas(source: string): string {
	let output = '';
	let inString = false;
	let escaped = false;

	for (let index = 0; index < source.length; index += 1) {
		const char = source[index];

		if (!inString && char === ',') {
			const rest = source.slice(index + 1);
			if (/^\s*[}\]]/.test(rest)) continue;
		}

		output += char;

		if (inString) {
			if (escaped) {
				escaped = false;
			} else if (char === '\\') {
				escaped = true;
			} else if (char === '"') {
				inString = false;
			}
		} else if (char === '"') {
			inString = true;
		}
	}

	return output;
}

function parseJsonc<T>(source: string): T {
	return JSON.parse(removeTrailingCommas(stripJsoncComments(source))) as T;
}

function requiredSecretMap(secrets: SecretBinding[] | undefined): Map<string, SecretBinding> {
	expect(secrets).toBeDefined();

	const entries = REQUIRED_SHARED_SECRETS.map(([binding]) => {
		const matches = secrets?.filter((secret) => secret.binding === binding) ?? [];
		expect(matches, `Expected exactly one ${binding} binding`).toHaveLength(1);
		return [binding, matches[0]] as const;
	});

	return new Map(entries);
}

function expectSharedSecretBindings(
	secrets: SecretBinding[] | undefined,
	options: { storeId?: string } = {}
): void {
	const secretsByBinding = requiredSecretMap(secrets);

	for (const [binding, secretName] of REQUIRED_SHARED_SECRETS) {
		const secret = secretsByBinding.get(binding);
		expect(secret?.binding).toBe(binding);
		expect(secret?.secret_name).toBe(secretName);
		if (options.storeId !== undefined) {
			expect(secret?.store_id).toBe(options.storeId);
		} else {
			expect(secret?.store_id, `${binding} store_id must be set`).toBeTruthy();
		}
		expect(secret).not.toHaveProperty('generate');
	}
}

function docsContainMapping(source: string, binding: string, secretName: string): boolean {
	const tableRow = new RegExp(
		`\\|\\s*\`${escapeRegExp(binding)}\`\\s*\\|\\s*\`${escapeRegExp(secretName)}\`\\s*\\|`
	);
	return tableRow.test(source);
}

function normalizeWhitespace(source: string): string {
	return source.replace(/\s+/g, ' ').trim();
}

function textContainsInOrder(source: string, ...parts: string[]): boolean {
	const normalizedSource = normalizeWhitespace(source);
	const normalizedParts = parts.map(normalizeWhitespace);
	let searchFrom = 0;

	for (const part of normalizedParts) {
		const next = normalizedSource.indexOf(part, searchFrom);
		if (next === -1) return false;
		searchFrom = next + part.length;
	}

	return true;
}

describe('secret provisioning config', () => {
	it('keeps generated-secret metadata out of shared Secrets Store bindings', () => {
		const cube = parseJsonc<CubeConfig>(cubeConfig);
		const wrangler = parseJsonc<WranglerConfig>(wranglerConfig);

		// cube.jsonc: bindings + secret_name must match; store_id present.
		expectSharedSecretBindings(cube.bindingConfig?.secrets_store_secrets);

		// wrangler.jsonc: OSS ships with the placeholder store_id — operator
		// (or Pegasus) rewrites at deploy time.
		for (const envName of HOSTED_WRANGLER_ENVS) {
			expectSharedSecretBindings(wrangler.env?.[envName]?.secrets_store_secrets, {
				storeId: WRANGLER_STORE_ID_PLACEHOLDER
			});
		}
	});

	it('documents the Worker binding to shared secret_name mapping', () => {
		for (const [binding, secretName] of REQUIRED_SHARED_SECRETS) {
			expect(
				docsContainMapping(secretProvisioningDocs, binding, secretName),
				`docs/secret-provisioning.md missing mapping row for ${binding} -> ${secretName}`
			).toBe(true);
		}

		expect(
			textContainsInOrder(secretProvisioningDocs, 'No', '`generate` metadata', 'checked-in')
		).toBe(true);
		expect(
			textContainsInOrder(
				setupScript,
				'Nexartis-hosted Secrets Store uses secret_name values instead'
			)
		).toBe(true);
		expect(textContainsInOrder(setupScript, 'CRON_AUTH_TOKEN', '->', 'KYM_CRON_AUTH_TOKEN')).toBe(
			true
		);
	});
});
