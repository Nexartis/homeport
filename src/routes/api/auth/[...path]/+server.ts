/**
 * ⚠️  CUBESTORE ROUTE FILE — DO NOT MODIFY
 * This file is managed by cubes-driver.js and will be overwritten on every deployment.
 *
 * Auth API Catch-all Handler
 *
 * Exposes Sentinel SDK auth endpoints (start-login, register, poll, claim, logout, etc.)
 * via a single catch-all route at /api/auth/[...path].
 */
import { createAuthHandlers } from '@nexartis/sentinel-sdk/sveltekit/handlers';

export const { GET, POST } = createAuthHandlers();
