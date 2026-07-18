import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/** Redirect legacy /sdk to /docs/sdk */
export const GET: RequestHandler = () => {
	redirect(301, '/docs/sdk');
};
