/**
 * Admin Layout Server — Auth guard + D1 stats loader
 *
 * Requires authentication and admin role. Loads aggregate stats
 * from all NANDA infrastructure tables for the admin dashboard sidebar.
 */
import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/roles';
import { createDbClient } from '$lib/db/client';
import {
	agentAddrs,
	certJobs,
	certificates,
	compliancePolicies,
	complianceDecisions,
	complianceViolations,
	telemetryEvents,
	probeRuns,
	reputationSnapshots,
	auditIntents,
	auditSettlements,
	auditWallets,
	siteVisitors,
	federationPeers,
	gossipLog
} from '$lib/db/schema';
import { count, eq, gt, or, isNull, and } from 'drizzle-orm';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'admin-layout');

export interface AdminStats {
	agents: { total: number; alive: number };
	certJobs: { total: number; pending: number; running: number; complete: number };
	certificates: { total: number; active: number };
	policies: { total: number };
	decisions: { total: number; recent: number };
	violations: { total: number };
	telemetry: { total: number; recentErrors: number };
	probes: { total: number };
	reputation: { total: number };
	intents: { total: number; open: number };
	settlements: { total: number };
	wallets: { total: number };
	visitors: { total: number };
	federation: { peers: number; active: number; gossipExchanges: number };
}

const EMPTY_STATS: AdminStats = {
	agents: { total: 0, alive: 0 },
	certJobs: { total: 0, pending: 0, running: 0, complete: 0 },
	certificates: { total: 0, active: 0 },
	policies: { total: 0 },
	decisions: { total: 0, recent: 0 },
	violations: { total: 0 },
	telemetry: { total: 0, recentErrors: 0 },
	probes: { total: 0 },
	reputation: { total: 0 },
	intents: { total: 0, open: 0 },
	settlements: { total: 0 },
	wallets: { total: 0 },
	visitors: { total: 0 },
	federation: { peers: 0, active: 0, gossipExchanges: 0 }
};

export const load: LayoutServerLoad = async ({ locals, platform, url }) => {
	const user = locals.user;

	if (!user?.isAuthenticated) {
		throw redirect(302, `/auth?redirect=${encodeURIComponent(url.pathname)}`);
	}

	if (!isAdmin(user)) {
		throw redirect(302, '/');
	}

	const d1 = platform?.env?.DB;
	let stats: AdminStats = { ...EMPTY_STATS };

	if (d1) {
		const db = createDbClient(d1);
		// Helper: count rows from a table with optional filter
		const c = async (table: any, where?: any) =>
			db
				.select({ value: count() })
				.from(table)
				.where(where)
				.then((r: any[]) => r[0]?.value ?? 0) as Promise<number>;

		try {
			const now = Math.floor(Date.now() / 1000);
			const dayAgo = now - 86400;

			const [
				agentsTotal,
				agentsAlive,
				jobsTotal,
				jobsPending,
				jobsRunning,
				jobsComplete,
				certsTotal,
				certsActive,
				policiesTotal,
				decisionsTotal,
				decisionsRecent,
				violationsTotal,
				telemetryTotal,
				telemetryRecentErrors,
				probesTotal,
				reputationTotal,
				intentsTotal,
				intentsOpen,
				settlementsTotal,
				walletsTotal,
				visitorsTotal,
				peersTotal,
				peersActive,
				gossipTotal
			] = await Promise.all([
				c(agentAddrs),
				c(agentAddrs, eq(agentAddrs.status, 'alive')),
				c(certJobs),
				c(certJobs, eq(certJobs.status, 'pending')),
				c(certJobs, eq(certJobs.status, 'running')),
				c(certJobs, eq(certJobs.status, 'complete')),
				c(certificates),
				c(certificates, or(isNull(certificates.expiresAt), gt(certificates.expiresAt, now))),
				c(compliancePolicies),
				c(complianceDecisions),
				c(complianceDecisions, gt(complianceDecisions.createdAt, dayAgo)),
				c(complianceViolations),
				c(telemetryEvents),
				c(
					telemetryEvents,
					and(eq(telemetryEvents.success, 0), gt(telemetryEvents.createdAt, dayAgo))
				),
				c(probeRuns),
				c(reputationSnapshots),
				c(auditIntents),
				c(auditIntents, eq(auditIntents.status, 'open')),
				c(auditSettlements),
				c(auditWallets),
				c(siteVisitors),
				c(federationPeers),
				c(federationPeers, eq(federationPeers.status, 'active')),
				c(gossipLog)
			]);

			stats = {
				agents: { total: agentsTotal, alive: agentsAlive },
				certJobs: {
					total: jobsTotal,
					pending: jobsPending,
					running: jobsRunning,
					complete: jobsComplete
				},
				certificates: { total: certsTotal, active: certsActive },
				policies: { total: policiesTotal },
				decisions: { total: decisionsTotal, recent: decisionsRecent },
				violations: { total: violationsTotal },
				telemetry: { total: telemetryTotal, recentErrors: telemetryRecentErrors },
				probes: { total: probesTotal },
				reputation: { total: reputationTotal },
				intents: { total: intentsTotal, open: intentsOpen },
				settlements: { total: settlementsTotal },
				wallets: { total: walletsTotal },
				visitors: { total: visitorsTotal },
				federation: { peers: peersTotal, active: peersActive, gossipExchanges: gossipTotal }
			};
		} catch (error) {
			log.error('load', 'Failed to load admin stats', {
				error: error instanceof Error ? error.message : String(error)
			});
		}
	}

	return { user, stats, currentPath: url.pathname };
};
