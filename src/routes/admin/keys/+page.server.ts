/**
 * Admin Keys Page Server — loads key initialization status from KV.
 */
import type { PageServerLoad } from './$types';
import { getKeyStatus, areKeysInitialized } from '$lib/services/key-management';

export const load: PageServerLoad = async ({ platform }) => {
	const kv = platform?.env?.NANDA_NODE_CACHE;
	if (!kv) {
		return { keys: [], kvAvailable: false };
	}

	const keys = await getKeyStatus(kv);
	// Only check required keys (v2 is reserved for future key rotation)
	const allInitialized = await areKeysInitialized(kv);

	return { keys, kvAvailable: true, allInitialized };
};
