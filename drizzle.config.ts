import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	schema: ['./src/lib/db/schema.ts', './src/lib/cubes/database/*-schema.ts'],
	out: './drizzle/migrations',
	dialect: 'sqlite',
	driver: 'd1-http',
	dbCredentials: {
		// Set by Pegasus CI during deployment. Not needed for local dev.
		accountId: process.env.CLOUDFLARE_ACCOUNT_ID ?? '',
		databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID ?? '',
		token: process.env.CLOUDFLARE_D1_TOKEN ?? ''
	}
});
