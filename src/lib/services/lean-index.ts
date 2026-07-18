/**
 * Lean Index Service — AgentAddr CRUD with Ed25519 signing and KV caching
 * (Phase 6 — Agent Bali)
 *
 * Implements the Lean Index layer from the NANDA DNS spec:
 *   agent_id → signed AgentAddr record → AgentFacts URL
 */

import type { DbClient } from '$lib/db/client';
import { upsertAgentAddr, getAgentAddr, countAgentAddrs } from '$lib/db/repositories';
import type {
	AgentAddr,
	AgentAddrCreateInput,
	AgentAddrResolution,
	AgentAddrSignable
} from '$lib/types/agent-addr';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'lean-index');

// ── Hex helpers ─────────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}

// ── Service ─────────────────────────────────────────────────────

export class LeanIndexService {
	private publicKeyHex: string | null = null;

	constructor(
		private db: DbClient,
		private kv: KVNamespace,
		private signingKey?: CryptoKey,
		private signerId: string = 'homeport-node',
		private verifyKey?: CryptoKey
	) {}

	/** Lazily derive and cache the public key hex from the signing key. */
	private async getPublicKeyHex(): Promise<string> {
		if (this.publicKeyHex) return this.publicKeyHex;

		// If we have a separate verify key, export that (preferred path)
		if (this.verifyKey) {
			const raw = await crypto.subtle.exportKey('raw', this.verifyKey);
			this.publicKeyHex = bytesToHex(new Uint8Array(raw));
			return this.publicKeyHex;
		}

		// Derive the public verify key from the signing key, then export as raw 32 bytes.
		// This avoids fragile PKCS8 byte-slicing — Web Crypto handles the encoding.
		if (!this.signingKey) throw new Error('signingKey is required for signing operations');
		const jwk = await crypto.subtle.exportKey('jwk', this.signingKey);
		// Remove private component `d` to create a public-only JWK
		const { d: _priv, ...pubJwk } = jwk;
		pubJwk.key_ops = ['verify'];
		const verifyKey = await crypto.subtle.importKey('jwk', pubJwk, { name: 'Ed25519' }, true, [
			'verify'
		]);
		const raw = await crypto.subtle.exportKey('raw', verifyKey);
		this.publicKeyHex = bytesToHex(new Uint8Array(raw));
		return this.publicKeyHex;
	}

	/** Canonical serialization for signing: sorted keys, no whitespace. */
	canonicalize(signable: AgentAddrSignable): string {
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(signable).sort()) {
			sorted[key] = (signable as Record<string, unknown>)[key];
		}
		return JSON.stringify(sorted);
	}

	/** Create a new AgentAddr — generates Ed25519 signature, stores in D1 + KV. */
	async createAgentAddr(input: AgentAddrCreateInput): Promise<AgentAddr> {
		if (!this.signingKey) throw new Error('signingKey is required for createAgentAddr');
		const publicKeyHex = await this.getPublicKeyHex();

		const ttl = input.ttl_seconds ?? 300;

		const signable: AgentAddrSignable = {
			agent_id: input.agent_id,
			public_key_hex: publicKeyHex,
			facts_url: input.facts_url,
			private_url: input.private_url,
			resolver_url: input.resolver_url,
			ttl_seconds: ttl,
			signer_id: this.signerId
		};

		const canonical = this.canonicalize(signable);
		const encoded = new TextEncoder().encode(canonical);
		const signatureBuffer = await crypto.subtle.sign('Ed25519', this.signingKey, encoded);
		const signatureHex = bytesToHex(new Uint8Array(signatureBuffer));

		const record = await upsertAgentAddr(this.db, {
			agentId: input.agent_id,
			publicKeyHex: publicKeyHex,
			factsUrl: input.facts_url,
			privateUrl: input.private_url ?? null,
			resolverUrl: input.resolver_url ?? null,
			ttlSeconds: ttl,
			signatureHex,
			signerId: this.signerId,
			source: 'local',
			quiltType: input.quilt_type ?? 'native'
		});

		const agentAddr = this.recordToAgentAddr(record);
		await this.cacheAddr(agentAddr);

		log.info('createAgentAddr', `Created AgentAddr for ${input.agent_id}`, {
			agentId: input.agent_id,
			ttl
		});

		return agentAddr;
	}

	/** Resolve an agent ID to its signed AgentAddr (KV cache → D1 fallback). */
	async resolve(agentId: string): Promise<AgentAddrResolution | null> {
		// Check KV cache first
		const cached = await this.kv.get(`addr:${agentId}`, 'text');
		if (cached) {
			let agentAddr: AgentAddr | null;
			try {
				agentAddr = JSON.parse(cached);
			} catch {
				// Corrupted cache entry — treat as cache miss and invalidate
				log.warn('resolve', 'Corrupt KV cache entry, treating as miss', { agentId });
				await this.kv.delete(`addr:${agentId}`);
				agentAddr = null;
			}
			if (agentAddr) {
				// Check expiry
				if (agentAddr.expires_at && agentAddr.expires_at <= Math.floor(Date.now() / 1000)) {
					return null; // expired
				}
				return { agent_addr: agentAddr, cached: true, resolved_at: Math.floor(Date.now() / 1000) };
			}
		}

		// Fallback to D1
		const record = await getAgentAddr(this.db, agentId);
		if (!record) return null;

		const agentAddr = this.recordToAgentAddr(record);

		// Check expiry
		if (agentAddr.expires_at && agentAddr.expires_at <= Math.floor(Date.now() / 1000)) {
			return null;
		}

		// Cache the result
		await this.cacheAddr(agentAddr);

		return { agent_addr: agentAddr, cached: false, resolved_at: Math.floor(Date.now() / 1000) };
	}

	/** Revoke an AgentAddr — marks expired, invalidates cache. */
	async revoke(agentId: string): Promise<void> {
		const now = Math.floor(Date.now() / 1000);
		const record = await getAgentAddr(this.db, agentId);
		if (!record) return;

		await upsertAgentAddr(this.db, { ...record, expiresAt: now });
		await this.invalidateCache(agentId);

		log.info('revoke', `Revoked AgentAddr for ${agentId}`, { agentId });
	}

	/** Verify an AgentAddr signature using the embedded public key. */
	async verify(agentAddr: AgentAddr): Promise<boolean> {
		try {
			const signable: AgentAddrSignable = {
				agent_id: agentAddr.agent_id,
				public_key_hex: agentAddr.public_key_hex,
				facts_url: agentAddr.facts_url,
				private_url: agentAddr.private_url,
				resolver_url: agentAddr.resolver_url,
				ttl_seconds: agentAddr.ttl_seconds,
				signer_id: agentAddr.signer_id
			};
			const canonical = this.canonicalize(signable);
			const encoded = new TextEncoder().encode(canonical);
			const signatureBytes = hexToBytes(agentAddr.signature_hex);
			const publicKeyBytes = hexToBytes(agentAddr.public_key_hex);

			const publicKey = await crypto.subtle.importKey(
				'raw',
				publicKeyBytes.buffer as ArrayBuffer,
				{ name: 'Ed25519' },
				false,
				['verify']
			);

			return await crypto.subtle.verify(
				'Ed25519',
				publicKey,
				signatureBytes.buffer as ArrayBuffer,
				encoded
			);
		} catch (err) {
			log.warn('verify', 'Signature verification failed', {
				agentId: agentAddr.agent_id,
				error: err instanceof Error ? err.message : String(err)
			});
			return false;
		}
	}

	/** Get total count of AgentAddr records. */
	async count(): Promise<number> {
		return await countAgentAddrs(this.db);
	}

	// ── Private helpers ─────────────────────────────────────────

	/** Cache an AgentAddr in KV with TTL. */
	private async cacheAddr(agentAddr: AgentAddr): Promise<void> {
		try {
			await this.kv.put(`addr:${agentAddr.agent_id}`, JSON.stringify(agentAddr), {
				expirationTtl: Math.max(agentAddr.ttl_seconds, 60) // KV minimum TTL is 60s
			});
		} catch (err) {
			log.warn('cacheAddr', 'Failed to cache AgentAddr', {
				agentId: agentAddr.agent_id,
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}

	/** Invalidate KV cache for an agent. */
	private async invalidateCache(agentId: string): Promise<void> {
		try {
			await this.kv.delete(`addr:${agentId}`);
		} catch (err) {
			log.warn('invalidateCache', 'Failed to invalidate cache', {
				agentId,
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}

	/** Convert a database record to an AgentAddr. */
	private recordToAgentAddr(record: {
		agentId: string;
		publicKeyHex: string;
		factsUrl: string | null;
		privateUrl: string | null;
		resolverUrl: string | null;
		ttlSeconds: number;
		signatureHex: string;
		signerId: string;
		createdAt: number;
		updatedAt: number;
		expiresAt: number | null;
		source: string;
		quiltType: string;
		contentId: string | null;
	}): AgentAddr {
		return {
			agent_id: record.agentId,
			public_key_hex: record.publicKeyHex,
			facts_url: record.factsUrl,
			private_url: record.privateUrl ?? undefined,
			resolver_url: record.resolverUrl ?? undefined,
			ttl_seconds: record.ttlSeconds,
			signature_hex: record.signatureHex,
			signer_id: record.signerId,
			created_at: record.createdAt,
			updated_at: record.updatedAt,
			expires_at: record.expiresAt ?? undefined,
			source: record.source,
			quilt_type: record.quiltType as AgentAddr['quilt_type'],
			content_id: record.contentId ?? undefined
		};
	}
}
