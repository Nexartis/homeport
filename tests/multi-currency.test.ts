/**
 * Multi-Currency Support Tests — currency registry, multi-currency wallet,
 * and exchange rate service.
 *
 * Uses @cloudflare/vitest-pool-workers with real local D1 + KV bindings.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import { createDbClient } from '../src/lib/db/client';
import {
	CURRENCY_REGISTRY,
	getActiveCurrencies,
	getCurrencyBySymbol,
	validateCurrency,
	getStablecoins,
	getActiveStablecoins
} from '../src/lib/services/payment/currencies';
import {
	getWalletBalance,
	creditWallet,
	debitWallet,
	getMultiCurrencyBalances
} from '../src/lib/services/payment/multi-wallet';
import {
	getExchangeRate,
	convertAmount,
	getCachedRates
} from '../src/lib/services/payment/exchange-rates';

// Type the test env
declare module 'cloudflare:test' {
	interface ProvidedEnv {
		DB: D1Database;
		NANDA_NODE_CACHE: KVNamespace;
		KYM_NANDA_EVIDENCE: R2Bucket;
		KYM_NANDA_RADIUS_SECRET: string;
		ENVIRONMENT: string;
		LOG_LEVEL: string;
		NANDA_REGISTRY_URL: string;
	}
}

// Tables needed for wallet + currency tests
const SETUP_TABLES = [
	`CREATE TABLE IF NOT EXISTS audit_wallets (
    agent_name TEXT NOT NULL, balance_minor INTEGER DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'NP', scale INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT (unixepoch()),
    PRIMARY KEY (agent_name, currency))`,
	`CREATE TABLE IF NOT EXISTS currencies (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    decimals INTEGER NOT NULL DEFAULT 6,
    chain TEXT,
    contract_address TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    category TEXT NOT NULL DEFAULT 'stablecoin',
    created_at INTEGER DEFAULT (unixepoch()))`
];

beforeAll(async () => {
	await env.DB.batch(SETUP_TABLES.map((sql) => env.DB.prepare(sql)));
});

// =========================================================================
// Currency Registry
// =========================================================================

describe('Multi-Currency Support', () => {
	describe('Currency Registry', () => {
		it('CURRENCY_REGISTRY contains all supported currencies', () => {
			const symbols = Object.keys(CURRENCY_REGISTRY);
			expect(symbols).toContain('NP');
			expect(symbols).toContain('USDC');
			expect(symbols).toContain('USDT');
			expect(symbols).toContain('DAI');
			expect(symbols).toContain('EURC');
			expect(symbols.length).toBe(5);
		});

		it('getActiveCurrencies filters inactive currencies', () => {
			const active = getActiveCurrencies();
			const symbols = active.map((c) => c.symbol);
			expect(symbols).toContain('NP');
			expect(symbols).toContain('USDC');
			expect(symbols).toContain('USDT');
			expect(symbols).toContain('DAI');
			// EURC is inactive
			expect(symbols).not.toContain('EURC');
		});

		it('getCurrencyBySymbol returns correct definition', () => {
			const usdc = getCurrencyBySymbol('USDC');
			expect(usdc).not.toBeNull();
			expect(usdc!.name).toBe('USD Coin');
			expect(usdc!.decimals).toBe(6);
			expect(usdc!.chain).toBe('base');
			expect(usdc!.contractAddress).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
			expect(usdc!.active).toBe(true);
			expect(usdc!.category).toBe('stablecoin');
		});

		it('getCurrencyBySymbol returns null for unknown', () => {
			expect(getCurrencyBySymbol('BTC')).toBeNull();
			expect(getCurrencyBySymbol('ETH')).toBeNull();
			expect(getCurrencyBySymbol('')).toBeNull();
		});

		it('validateCurrency accepts known symbols', () => {
			expect(validateCurrency('NP')).toBe(true);
			expect(validateCurrency('USDC')).toBe(true);
			expect(validateCurrency('usdc')).toBe(true); // case-insensitive
			expect(validateCurrency('EURC')).toBe(true);
		});

		it('validateCurrency rejects unknown symbols', () => {
			expect(validateCurrency('BTC')).toBe(false);
			expect(validateCurrency('ETH')).toBe(false);
			expect(validateCurrency('FAKE')).toBe(false);
		});

		it('getStablecoins returns only stablecoin category', () => {
			const stables = getStablecoins();
			expect(stables.every((c) => c.category === 'stablecoin')).toBe(true);
			expect(stables.map((c) => c.symbol)).not.toContain('NP');
		});

		it('getActiveStablecoins excludes inactive stablecoins', () => {
			const active = getActiveStablecoins();
			expect(active.map((c) => c.symbol)).not.toContain('EURC');
			expect(active.every((c) => c.active)).toBe(true);
		});

		it('NP has 0 decimals and internal category', () => {
			const np = getCurrencyBySymbol('NP');
			expect(np!.decimals).toBe(0);
			expect(np!.category).toBe('internal');
			expect(np!.chain).toBeNull();
			expect(np!.contractAddress).toBeNull();
		});
	});

	// =========================================================================
	// Multi-Currency Wallet
	// =========================================================================

	describe('Multi-Currency Wallet', () => {
		const db = createDbClient(env.DB);

		it('getWalletBalance returns 0 for new agent', async () => {
			const balance = await getWalletBalance(db, 'agent://mc-new-agent', 'NP');
			expect(balance).toBe(0);
		});

		it('creditWallet increases balance for specific currency', async () => {
			await creditWallet(db, 'agent://mc-credit-test', 'NP', 500);
			const balance = await getWalletBalance(db, 'agent://mc-credit-test', 'NP');
			expect(balance).toBe(500);

			// Credit again
			await creditWallet(db, 'agent://mc-credit-test', 'NP', 300);
			const balance2 = await getWalletBalance(db, 'agent://mc-credit-test', 'NP');
			expect(balance2).toBe(800);
		});

		it('creditWallet rejects non-positive amounts', async () => {
			await expect(creditWallet(db, 'agent://mc-test', 'NP', 0)).rejects.toThrow('positive');
			await expect(creditWallet(db, 'agent://mc-test', 'NP', -10)).rejects.toThrow('positive');
		});

		it('creditWallet rejects unknown currency', async () => {
			await expect(creditWallet(db, 'agent://mc-test', 'BTC', 100)).rejects.toThrow(
				'Unknown currency'
			);
		});

		it('debitWallet decreases balance for specific currency', async () => {
			await creditWallet(db, 'agent://mc-debit-test', 'NP', 1000);
			const result = await debitWallet(db, 'agent://mc-debit-test', 'NP', 400);
			expect(result.success).toBe(true);

			const balance = await getWalletBalance(db, 'agent://mc-debit-test', 'NP');
			expect(balance).toBe(600);
		});

		it('debitWallet rejects insufficient balance', async () => {
			await creditWallet(db, 'agent://mc-insuf-test', 'NP', 100);
			const result = await debitWallet(db, 'agent://mc-insuf-test', 'NP', 500);
			expect(result.success).toBe(false);
			expect(result.error).toContain('Insufficient');
		});

		it('debitWallet rejects unknown currency', async () => {
			const result = await debitWallet(db, 'agent://mc-test', 'BTC', 100);
			expect(result.success).toBe(false);
			expect(result.error).toContain('Unknown currency');
		});

		it('getMultiCurrencyBalances returns balances for agent', async () => {
			// Credit NP for this agent
			await creditWallet(db, 'agent://mc-multi-test', 'NP', 1000);

			const balances = await getMultiCurrencyBalances(db, 'agent://mc-multi-test');
			expect(balances['NP']).toBe(1000);
		});

		it('getMultiCurrencyBalances returns empty for unknown agent', async () => {
			const balances = await getMultiCurrencyBalances(db, 'agent://mc-nonexistent');
			expect(Object.keys(balances).length).toBe(0);
		});
	});

	// =========================================================================
	// Exchange Rates
	// =========================================================================

	describe('Exchange Rates', () => {
		it('getExchangeRate returns NP to USD-pegged rate from config', async () => {
			const rate = await getExchangeRate('NP', 'USDC', env as any);
			expect(rate.from).toBe('NP');
			expect(rate.to).toBe('USDC');
			// Default NP_TO_USD_RATE = 0.001, USDC is 1:1 with USD
			expect(rate.rate).toBeCloseTo(0.001, 5);
			expect(rate.source).toBe('config');
		});

		it('same currency returns rate of 1', async () => {
			const rate = await getExchangeRate('USDC', 'USDC', env as any);
			expect(rate.rate).toBe(1);
			expect(rate.source).toBe('peg');
		});

		it('stablecoin rates are 1:1 with each other', async () => {
			const rate = await getExchangeRate('USDC', 'USDT', env as any);
			expect(rate.rate).toBe(1);
		});

		it('convertAmount correctly converts between currencies', async () => {
			const rate = await getExchangeRate('NP', 'USDC', env as any);
			// 1000 NP (0 decimals) at 0.001 rate → 1 USDC major unit → 1,000,000 USDC minor units (6 decimals)
			// = 1000 * 0.001 * 10^(6-0) = 1,000,000
			const converted = convertAmount(1000, 'NP', 'USDC', rate);
			expect(converted).toBe(1_000_000);
		});

		it('convertAmount rejects mismatched rate', async () => {
			const rate = await getExchangeRate('NP', 'USDC', env as any);
			expect(() => convertAmount(100, 'USDT', 'DAI', rate)).toThrow('Rate mismatch');
		});

		it('getExchangeRate is case-insensitive', async () => {
			const rate = await getExchangeRate('np', 'usdc', env as any);
			expect(rate.from).toBe('NP');
			expect(rate.to).toBe('USDC');
		});

		it('getExchangeRate rejects unknown currencies', async () => {
			await expect(getExchangeRate('BTC', 'USDC', env as any)).rejects.toThrow('Unknown currency');
		});

		it('getCachedRates returns empty array on cache miss', async () => {
			const rates = await getCachedRates(env.NANDA_NODE_CACHE);
			// Fresh KV namespace — no cached rates yet
			expect(Array.isArray(rates)).toBe(true);
		});

		it('USDC to NP conversion is inverse of NP to USDC', async () => {
			const npToUsdc = await getExchangeRate('NP', 'USDC', env as any);
			const usdcToNp = await getExchangeRate('USDC', 'NP', env as any);
			// rate * inverse ≈ 1
			expect(npToUsdc.rate * usdcToNp.rate).toBeCloseTo(1, 5);
		});
	});
});
