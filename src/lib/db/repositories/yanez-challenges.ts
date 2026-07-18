/**
 * Yanez Challenges Repository — sign-and-return signing requests.
 *
 * One row per signing request, keyed by `id` (= request_id). Single-use: the
 * terminal transitions (`markVerified` / `markInvalid` / `markExpired`) are
 * compare-and-swap on `status = 'pending'`, so a row leaves `pending` at most
 * once even under concurrent callbacks (D1 has no cross-statement transaction
 * here; the conditional UPDATE is the atomicity boundary). A `null` return
 * means the row was not pending — a lost race or an already-terminal state.
 */

import { and, eq } from 'drizzle-orm';
import type { DbClient } from '../client';
import {
	yanezChallenges,
	type YanezChallengeRecord,
	type NewYanezChallengeRecord
} from '../schema';

export async function createChallenge(
	db: DbClient,
	record: NewYanezChallengeRecord
): Promise<YanezChallengeRecord> {
	const rows = await db.insert(yanezChallenges).values(record).returning();
	const created = rows[0];
	if (!created) {
		// A plain INSERT ... RETURNING always yields the row; a missing result
		// means the driver contract was violated. Fail loud rather than return a
		// half-typed value.
		throw new Error('createChallenge: INSERT did not return the created row');
	}
	return created;
}

export async function getChallenge(db: DbClient, id: string): Promise<YanezChallengeRecord | null> {
	const row = await db.query.yanezChallenges.findFirst({
		where: eq(yanezChallenges.id, id)
	});
	return row ?? null;
}

/** Fields written when a callback verifies successfully. */
export interface VerifiedUpdate {
	yid?: string | null;
	groupPublicKey: string;
	ethAddress: string;
	signature: string;
	payloadJson: string;
}

/**
 * Compare-and-swap the status of a still-`pending` challenge. Returns the
 * updated row, or `null` if the row was not pending (already verified /
 * invalid / expired, or unknown id) — i.e. the caller lost the race.
 */
async function transitionFromPending(
	db: DbClient,
	id: string,
	patch: Partial<YanezChallengeRecord>
): Promise<YanezChallengeRecord | null> {
	const rows = await db
		.update(yanezChallenges)
		.set({ ...patch, updatedAt: Math.floor(Date.now() / 1000) })
		.where(and(eq(yanezChallenges.id, id), eq(yanezChallenges.status, 'pending')))
		.returning();
	return rows[0] ?? null;
}

export async function markVerified(
	db: DbClient,
	id: string,
	patch: VerifiedUpdate
): Promise<YanezChallengeRecord | null> {
	return transitionFromPending(db, id, {
		status: 'verified',
		verifyOk: true,
		yid: patch.yid ?? null,
		groupPublicKey: patch.groupPublicKey,
		ethAddress: patch.ethAddress,
		signature: patch.signature,
		payloadJson: patch.payloadJson,
		reason: null
	});
}

export async function markInvalid(
	db: DbClient,
	id: string,
	reason: string
): Promise<YanezChallengeRecord | null> {
	return transitionFromPending(db, id, { status: 'invalid', verifyOk: false, reason });
}

export async function markExpired(db: DbClient, id: string): Promise<YanezChallengeRecord | null> {
	return transitionFromPending(db, id, { status: 'expired', verifyOk: false, reason: 'expired' });
}
