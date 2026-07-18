import type { PageServerLoad } from './$types';
import type { Env } from '$lib/types';
import { createDbClient } from '$lib/db/client';
import { auditWallets, auditSettlements } from '$lib/db/schema';
import { desc, gt } from 'drizzle-orm';
import { getActiveCurrencies } from '$lib/services/payment/currencies';
import { getExchangeRate } from '$lib/services/payment/exchange-rates';

export const load: PageServerLoad = async ({ platform }) => {
	const env = platform!.env as unknown as Env;
	const db = createDbClient(env.DB);

	const currencies = getActiveCurrencies();

	const codes = currencies.map((c) => c.symbol);
	const rates: Record<string, Record<string, number>> = {};
	for (const from of codes) {
		rates[from] = {};
		for (const to of codes) {
			if (from === to) {
				rates[from][to] = 1;
				continue;
			}
			try {
				const result = await getExchangeRate(from, to, env);
				rates[from][to] = result.rate;
			} catch {
				rates[from][to] = 0;
			}
		}
	}

	const [topWallets, recentTransactions] = await Promise.all([
		db
			.select({
				agentId: auditWallets.agentName,
				currency: auditWallets.currency,
				balance: auditWallets.balanceMinor
			})
			.from(auditWallets)
			.where(gt(auditWallets.balanceMinor, 0))
			.orderBy(desc(auditWallets.balanceMinor))
			.limit(50),
		db
			.select({
				id: auditSettlements.settlementId,
				txHash: auditSettlements.txHash,
				fromAgent: auditSettlements.frm,
				toAgent: auditSettlements.toAgent,
				amount: auditSettlements.amount,
				createdAt: auditSettlements.createdAt
			})
			.from(auditSettlements)
			.orderBy(desc(auditSettlements.createdAt))
			.limit(20)
	]);

	return {
		currencies,
		rates,
		topWallets,
		recentTransactions,
		config: {
			npToUsdRate: env.NP_TO_USD_RATE ?? 'not set',
			eurToUsdRate: env.EUR_TO_USD_RATE ?? 'not set'
		}
	};
};
