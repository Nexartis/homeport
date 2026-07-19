/**
 * Protocol Detector — Auto-detect agent protocol support via well-known probing
 * Phase 6 — Agent California
 *
 * Probes a URL for:
 *   1. A2A: GET /.well-known/agent-card.json
 *   2. MCP: POST /mcp with { jsonrpc: "2.0", method: "initialize", id: 1 }
 *   3. NLWeb: GET /.well-known/nlweb.json or schema.org metadata
 *   4. NANDA AgentFacts: GET /agentfacts
 *
 * SSRF protection: blocks private IPs, localhost, non-HTTPS in production.
 *
 * @see DECENTRALIZED_AGENT_DNS_IMPLEMENTATION_PLAN.md §Phase E
 */

import type { DetectedProtocol } from '$lib/types/switchboard';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'protocol-detector');

/** Timeout for each probe request (ms) */
const PROBE_TIMEOUT_MS = 5000;

/** Private IP regex patterns for SSRF prevention */
const PRIVATE_IP_PATTERNS = [
	/^10\./,
	/^172\.(1[6-9]|2[0-9]|3[01])\./,
	/^192\.168\./,
	/^127\./,
	/^0\./,
	/^169\.254\./
];

/** IPv6 private/reserved prefixes (checked after stripping brackets) */
const PRIVATE_IPV6_PATTERNS = [/^::1$/, /^fc00:/i, /^fd[0-9a-f]{2}:/i, /^fe80:/i];

/** Validate URL is safe for probing (SSRF protection) */
export function isSafeUrl(url: string, environment?: string): boolean {
	try {
		const parsed = new URL(url);

		// Block non-HTTP(S) schemes
		if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

		// Enforce HTTPS in production
		if (environment === 'production' && parsed.protocol !== 'https:') return false;

		// Block private/reserved IPs
		const hostname = parsed.hostname;
		if (hostname === 'localhost') return false;
		if (PRIVATE_IP_PATTERNS.some((p) => p.test(hostname))) return false;

		// IPv6: strip brackets if present (workerd may keep them, Node strips them)
		const ipv6 = hostname.startsWith('[') ? hostname.slice(1, -1) : hostname;
		if (PRIVATE_IPV6_PATTERNS.some((p) => p.test(ipv6))) return false;

		return true;
	} catch {
		return false;
	}
}

/** Detect protocols supported by a given agent URL */
export async function detectProtocols(
	agentUrl: string,
	environment?: string
): Promise<DetectedProtocol[]> {
	if (!isSafeUrl(agentUrl, environment)) {
		log.warn('detectProtocols', `SSRF blocked: ${agentUrl}`);
		return [];
	}

	const baseUrl = agentUrl.replace(/\/+$/, '');
	const detected: DetectedProtocol[] = [];

	// Run all probes in parallel
	const results = await Promise.allSettled([
		probeA2A(baseUrl),
		probeMcp(baseUrl),
		probeNLWeb(baseUrl),
		probeNandaFacts(baseUrl)
	]);

	for (const result of results) {
		if (result.status === 'fulfilled' && result.value) {
			detected.push(result.value);
		}
	}

	// Sort by confidence descending
	detected.sort((a, b) => b.confidence - a.confidence);
	return detected;
}

/** Probe for A2A Agent Card at /.well-known/agent-card.json */
async function probeA2A(baseUrl: string): Promise<DetectedProtocol | null> {
	try {
		const res = await fetch(`${baseUrl}/.well-known/agent-card.json`, {
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
			headers: { Accept: 'application/json' }
		});

		if (!res.ok) return null;

		const data = (await res.json()) as Record<string, unknown>;
		if (data.name && data.skills) {
			return {
				protocol: 'a2a',
				url: `${baseUrl}/.well-known/agent-card.json`,
				confidence: 0.95,
				metadata: { name: data.name, version: data.version }
			};
		}
	} catch {
		// Probe failed — not an error
	}
	return null;
}

/** Probe for MCP endpoint */
async function probeMcp(baseUrl: string): Promise<DetectedProtocol | null> {
	try {
		const res = await fetch(`${baseUrl}/mcp`, {
			method: 'POST',
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1 })
		});

		if (!res.ok) return null;

		const data = (await res.json()) as Record<string, unknown>;
		if (data.jsonrpc === '2.0' && data.result) {
			return {
				protocol: 'mcp',
				url: `${baseUrl}/mcp`,
				confidence: 0.9,
				metadata: data.result as Record<string, unknown>
			};
		}
	} catch {
		// Probe failed — not an error
	}
	return null;
}

/** Probe for NLWeb endpoint */
async function probeNLWeb(baseUrl: string): Promise<DetectedProtocol | null> {
	try {
		const res = await fetch(`${baseUrl}/.well-known/nlweb.json`, {
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
			headers: { Accept: 'application/json' }
		});

		if (!res.ok) return null;

		const data = (await res.json()) as Record<string, unknown>;
		if (data.url || data.schemaOrgTypes) {
			return {
				protocol: 'nlweb',
				url: `${baseUrl}/.well-known/nlweb.json`,
				confidence: 0.8,
				metadata: data
			};
		}
	} catch {
		// Probe failed — not an error
	}
	return null;
}

/** Probe for NANDA AgentFacts */
async function probeNandaFacts(baseUrl: string): Promise<DetectedProtocol | null> {
	try {
		const res = await fetch(`${baseUrl}/agentfacts`, {
			signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
			headers: { Accept: 'application/json' }
		});

		if (!res.ok) return null;

		const data = (await res.json()) as Record<string, unknown>;
		if (data.agent_name || data.agentName) {
			return {
				protocol: 'nanda',
				url: `${baseUrl}/agentfacts`,
				confidence: 0.85,
				metadata: { agent_name: data.agent_name || data.agentName }
			};
		}
	} catch {
		// Probe failed — not an error
	}
	return null;
}
