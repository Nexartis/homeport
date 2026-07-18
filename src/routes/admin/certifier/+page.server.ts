/**
 * Certifier Admin — Page Data Loader
 *
 * Loads cert_jobs, certificates (with revocation status), and stats.
 */
import type { PageServerLoad } from './$types';
import { createDbClient } from '$lib/db/client';
import { certJobs, certificates, certRevocations } from '$lib/db/schema';
import { desc, count, eq, or, isNull, gt, sql } from 'drizzle-orm';
import { createLogger } from '$lib/utils/logger';

const log = createLogger(undefined, 'admin-certifier');

export const load: PageServerLoad = async ({ platform, url }) => {
	const d1 = platform?.env?.DB;
	const empty = { jobs: [], certificates: [], revocations: [], stats: null, tab: 'jobs' };
	if (!d1) return empty;

	const db = createDbClient(d1);
	const tab = url.searchParams.get('tab') || 'jobs';
	const now = Math.floor(Date.now() / 1000);

	try {
		const [
			jobs,
			certsWithRevocations,
			revocations,
			totalJobs,
			pending,
			running,
			activeCerts,
			revoked
		] = await Promise.all([
			db.select().from(certJobs).orderBy(desc(certJobs.createdAt)).limit(100),
			db
				.select({
					certId: certificates.certId,
					agentId: certificates.agentId,
					capability: certificates.capability,
					score: certificates.score,
					grade: certificates.grade,
					ci95Lo: certificates.ci95Lo,
					ci95Hi: certificates.ci95Hi,
					nTrials: certificates.nTrials,
					issuedAt: certificates.issuedAt,
					expiresAt: certificates.expiresAt,
					revocationReason: certRevocations.reason,
					revokedAt: certRevocations.revokedAt
				})
				.from(certificates)
				.leftJoin(certRevocations, eq(certificates.certId, certRevocations.certId))
				.orderBy(desc(certificates.issuedAt))
				.limit(100),
			db.select().from(certRevocations).orderBy(desc(certRevocations.revokedAt)).limit(100),
			db
				.select({ value: count() })
				.from(certJobs)
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(certJobs)
				.where(eq(certJobs.status, 'pending'))
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(certJobs)
				.where(eq(certJobs.status, 'running'))
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(certificates)
				.where(or(isNull(certificates.expiresAt), gt(certificates.expiresAt, now)))
				.then((r) => r[0]?.value ?? 0),
			db
				.select({ value: count() })
				.from(certRevocations)
				.then((r) => r[0]?.value ?? 0)
		]);

		const stats = { totalJobs, pending, running, activeCerts, revoked };

		return { jobs, certificates: certsWithRevocations, revocations, stats, tab };
	} catch (error) {
		log.error('load', 'Failed to load certifier data', {
			error: error instanceof Error ? error.message : String(error)
		});
		return empty;
	}
};
