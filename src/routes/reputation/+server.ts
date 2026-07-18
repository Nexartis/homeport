/**
 * GET /reputation — Agent reputation and trust scores
 *
 * @swagger
 * /reputation:
 *   get:
 *     summary: Get agent reputation scores
 *     description: Returns reputation snapshots merged with certification grades for all agents.
 *     tags:
 *       - Trust
 *     responses:
 *       200:
 *         description: Reputation data for all agents
 *       503:
 *         description: Database unavailable
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDbClient } from '$lib/db/client';
import { getLatestReputations, getLatestCertGrades } from '$lib/db/repositories';
import { safeParseStringArray } from '$lib/utils/safe-json';

export const GET: RequestHandler = async ({ platform }) => {
	if (!platform?.env?.DB) {
		return json({ error: 'Database binding unavailable' }, { status: 503 });
	}
	const db = createDbClient(platform.env.DB);
	const [reputations, certGrades] = await Promise.all([
		getLatestReputations(db),
		getLatestCertGrades(db)
	]);

	// Index cert grades by agentId for easy lookup
	const certMap = new Map(certGrades.map((c) => [c.agentId, c]));

	// Merge reputation + cert data per agent
	// Use cert_score from the certificates table (via certMap) for consistency
	// so that cert_score, cert_grade, and cert_capability all come from the same source.
	const agents = reputations.map((r) => {
		const cert = certMap.get(r.agent_id);
		return {
			agent_id: r.agent_id,
			reputation: r.reputation,
			availability: r.availability,
			error_rate: r.error_rate,
			fraud_rate: r.fraud_rate,
			p95_latency_ms: r.p95_latency_ms,
			probe_success: r.probe_success,
			cert_score: cert?.score ?? r.cert_score ?? null,
			actions: safeParseStringArray(r.actions),
			snapshot_at: r.created_at,
			cert_grade: cert?.grade ?? null,
			cert_capability: cert?.capability ?? null,
			cert_issued_at: cert?.issuedAt ?? null
		};
	});

	// Also include agents that have certs but no reputation snapshot yet
	for (const [agentId, cert] of certMap) {
		if (!reputations.find((r) => r.agent_id === agentId)) {
			agents.push({
				agent_id: agentId,
				reputation: null,
				availability: null,
				error_rate: null,
				fraud_rate: null,
				p95_latency_ms: null,
				probe_success: null,
				cert_score: cert.score,
				actions: [],
				snapshot_at: null,
				cert_grade: cert.grade,
				cert_capability: cert.capability,
				cert_issued_at: cert.issuedAt
			});
		}
	}

	return json({ agents, total: agents.length, fetchedAt: new Date().toISOString() });
};
