/**
 * Certifier Repository — typed data access for cert_jobs, trial_results,
 * certificates, and cert_revocations tables.
 */

import { eq, desc, sql, and } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
	certJobs,
	trialResults,
	certificates,
	certRevocations,
	type NewCertJob,
	type NewTrialResult,
	type NewCertificate
} from '../schema';

// ===================================================================
// Cert Jobs
// ===================================================================

/** Insert a new certification job */
export async function insertCertJob(db: DbClient, job: NewCertJob) {
	const result = await db.insert(certJobs).values(job).returning();
	return result[0];
}

/** Update cert job status. If `onlyIfCurrent` is provided, the row is updated
 *  only when the current status matches — preventing race conditions where
 *  concurrent processing has already advanced the status beyond the expected value. */
export async function updateCertJobStatus(
	db: DbClient,
	jobId: string,
	status: string,
	onlyIfCurrent?: string
) {
	const where = onlyIfCurrent
		? and(eq(certJobs.jobId, jobId), eq(certJobs.status, onlyIfCurrent))
		: eq(certJobs.jobId, jobId);

	return await db
		.update(certJobs)
		.set({ status, updatedAt: sql`(unixepoch())` })
		.where(where);
}

/** Update cert job as complete with score and grade */
export async function updateCertJobComplete(
	db: DbClient,
	jobId: string,
	data: { status: string; score: number; grade: string }
) {
	return await db
		.update(certJobs)
		.set({ ...data, updatedAt: sql`(unixepoch())` })
		.where(eq(certJobs.jobId, jobId));
}

/** Get full cert job by ID */
export async function getCertJob(db: DbClient, jobId: string) {
	return (
		(await db.query.certJobs.findFirst({
			where: eq(certJobs.jobId, jobId)
		})) ?? null
	);
}

/** Get job status (specific columns for status check) */
export async function getJobStatus(db: DbClient, jobId: string) {
	return (
		(await db.query.certJobs.findFirst({
			columns: {
				jobId: true,
				agentId: true,
				capability: true,
				status: true,
				numTrials: true,
				completedTrials: true,
				score: true,
				grade: true,
				createdAt: true,
				updatedAt: true
			},
			where: eq(certJobs.jobId, jobId)
		})) ?? null
	);
}

/** Increment completed_trials atomically */
export async function incrementCompletedTrials(db: DbClient, jobId: string) {
	return await db
		.update(certJobs)
		.set({
			completedTrials: sql`completed_trials + 1`,
			updatedAt: sql`(unixepoch())`
		})
		.where(eq(certJobs.jobId, jobId));
}

/** Get completed trial count for a job */
export async function getCompletedTrialCount(db: DbClient, jobId: string) {
	const [result] = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(trialResults)
		.where(eq(trialResults.jobId, jobId));
	return result?.count ?? 0;
}

// ===================================================================
// Trial Results
// ===================================================================

/** Check if a trial result already exists (idempotency) */
export async function checkTrialExists(db: DbClient, jobId: string, trialNum: number) {
	return (
		(await db.query.trialResults.findFirst({
			columns: { id: true },
			where: and(eq(trialResults.jobId, jobId), eq(trialResults.trialNum, trialNum))
		})) ?? null
	);
}

/** Insert trial result — INSERT OR IGNORE for idempotent inserts */
export async function insertTrialResult(db: DbClient, trial: NewTrialResult) {
	return await db.insert(trialResults).values(trial).onConflictDoNothing();
}

/** Get all trial results for a job (with topic for by_topic scoring) */
export async function getTrialResultsForJob(db: DbClient, jobId: string) {
	return await db.select().from(trialResults).where(eq(trialResults.jobId, jobId));
}

// ===================================================================
// Certificates
// ===================================================================

/** Get total certificate count (for statusListIndex assignment) */
export async function getCertificateCount(db: DbClient) {
	const [result] = await db.select({ count: sql<number>`COUNT(*)` }).from(certificates);
	return result?.count ?? 0;
}

/** Insert a new certificate */
export async function insertCertificate(db: DbClient, cert: NewCertificate) {
	const result = await db.insert(certificates).values(cert).returning();
	return result[0];
}

/** Get certificate by ID */
export async function getCertificateById(db: DbClient, certId: string) {
	return (
		(await db.query.certificates.findFirst({
			where: eq(certificates.certId, certId)
		})) ?? null
	);
}

/** Get latest cert score for an agent (for reputation computation) */
export async function getLatestCertScore(db: DbClient, agentId: string) {
	return (
		(await db.query.certificates.findFirst({
			columns: { score: true },
			where: eq(certificates.agentId, agentId),
			orderBy: [desc(certificates.issuedAt)]
		})) ?? null
	);
}

/** Get latest cert score + grade for every agent (bulk read-only) */
export interface CertGradeRow {
	agentId: string;
	score: number;
	grade: string;
	capability: string;
	issuedAt: number;
}

export async function getLatestCertGrades(db: DbClient): Promise<CertGradeRow[]> {
	// Correlated subquery: get latest cert per agent. Cannot be expressed
	// via Drizzle's relational builder, so we use a typed sql template.
	const rows = await db.all<{
		agent_id: string;
		score: number;
		grade: string;
		capability: string;
		issued_at: number;
	}>(sql`SELECT c.agent_id, c.score, c.grade, c.capability, c.issued_at
		FROM certificates c
		WHERE c.rowid = (
			SELECT c2.rowid FROM certificates c2
			WHERE c2.agent_id = c.agent_id
			ORDER BY c2.issued_at DESC, c2.rowid DESC
			LIMIT 1
		)
		ORDER BY c.score DESC`);
	// Map snake_case D1 columns to camelCase for consistency
	return rows.map((r) => ({
		agentId: r.agent_id,
		score: r.score,
		grade: r.grade,
		capability: r.capability,
		issuedAt: r.issued_at
	}));
}

// ===================================================================
// Revocations
// ===================================================================

/** Check if a certificate exists (for revocation validation) */
export async function getCertificateExists(db: DbClient, certId: string) {
	return (
		(await db.query.certificates.findFirst({
			columns: { certId: true },
			where: eq(certificates.certId, certId)
		})) ?? null
	);
}

/** Get existing revocation for a certificate */
export async function getRevocation(db: DbClient, certId: string) {
	return (
		(await db.query.certRevocations.findFirst({
			where: eq(certRevocations.certId, certId)
		})) ?? null
	);
}

/** Get the max status_list_index (for atomic index assignment) */
export async function getMaxRevocationIndex(db: DbClient) {
	const [result] = await db
		.select({ maxIdx: sql<number | null>`MAX(status_list_index)` })
		.from(certRevocations);
	return result?.maxIdx ?? -1;
}

/** Insert a revocation record */
export async function insertRevocation(
	db: DbClient,
	data: { certId: string; reason: string; statusListIndex: number }
) {
	return await db.insert(certRevocations).values(data);
}

/** Get all revocation status_list_index values (for StatusList2021 bitstring) */
export async function getAllRevocationIndices(db: DbClient) {
	return await db
		.select({ statusListIndex: certRevocations.statusListIndex })
		.from(certRevocations);
}

/** Get revocation stats: total count and max index */
export async function getRevocationStats(db: DbClient) {
	const [count] = await db.select({ count: sql<number>`COUNT(*)` }).from(certRevocations);
	const [maxIdx] = await db
		.select({ maxIdx: sql<number | null>`MAX(status_list_index)` })
		.from(certRevocations);
	return {
		total: count?.count ?? 0,
		maxIndex: maxIdx?.maxIdx ?? -1
	};
}
