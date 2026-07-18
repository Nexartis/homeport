/**
 * Node Settings Repository — singleton row at id='default'.
 *
 * Backs the operator control surface (Launch Roadmap §4). A single row
 * in `node_settings` holds auth mode, default role, branding, etc. The
 * row is seeded by the 0001 migration and mutated in place via update.
 */

import { eq, sql } from 'drizzle-orm';
import type { DbClient } from '../client';
import { nodeSettings, type NodeSettingsRecord } from '../schema';

export const SETTINGS_ID = 'default';

/** Column subset safe for PATCH updates from the admin UI. */
export type UpdatableSettings = Partial<
	Pick<
		NodeSettingsRecord,
		| 'authMode'
		| 'waitlistEnabled'
		| 'defaultRole'
		| 'yanezEnabled'
		| 'ownerEmail'
		| 'nodeName'
		| 'supportEmail'
		| 'welcomeHeadline'
		| 'welcomeBody'
		| 'brandLogoUrl'
		| 'brandPrimaryColor'
	>
>;

/** Read the singleton settings row. Returns null if migration hasn't run. */
export async function getNodeSettings(db: DbClient): Promise<NodeSettingsRecord | null> {
	const row = await db.query.nodeSettings.findFirst({
		where: eq(nodeSettings.id, SETTINGS_ID)
	});
	return row ?? null;
}

/**
 * Update the singleton row. Partial set — only provided keys are written.
 * Returns the updated record, or null if no row was found.
 */
export async function updateNodeSettings(
	db: DbClient,
	patch: UpdatableSettings
): Promise<NodeSettingsRecord | null> {
	const now = Math.floor(Date.now() / 1000);
	const result = await db
		.update(nodeSettings)
		.set({ ...patch, updatedAt: now })
		.where(eq(nodeSettings.id, SETTINGS_ID))
		.returning();
	return result[0] ?? null;
}

/**
 * Ensure the singleton row exists. Used as a safety net for nodes that
 * deploy without running migrations. Idempotent.
 */
export async function ensureNodeSettings(db: DbClient): Promise<NodeSettingsRecord> {
	const existing = await getNodeSettings(db);
	if (existing) return existing;
	await db
		.insert(nodeSettings)
		.values({ id: SETTINGS_ID })
		.onConflictDoNothing({ target: nodeSettings.id });
	const row = await getNodeSettings(db);
	if (!row) {
		// Fallback for environments where .returning() is needed — compose manually.
		throw new Error('Failed to ensure node_settings singleton');
	}
	return row;
}

/** Mark the settings as updated (no-op touch; useful for audit UIs). */
export async function touchNodeSettings(db: DbClient): Promise<void> {
	await db
		.update(nodeSettings)
		.set({ updatedAt: sql`(unixepoch())` })
		.where(eq(nodeSettings.id, SETTINGS_ID));
}
