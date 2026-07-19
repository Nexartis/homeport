/**
 * Exchange Rate Service
 *
 * Provides exchange rate lookups and currency conversion between supported currencies.
 *
 * Rate sources:
 * - NP ↔ USD: from env config (NP_TO_USD_RATE — declared in wrangler.jsonc)
 * - Stablecoins (USDC, USDT, DAI): pegged 1:1 with USD
 * - EURC: from env config (EUR_TO_USD_RATE — declared in wrangler.jsonc)
 *
 * Rates are cached in KV with a 5-minute TTL.
 */

import type { Env } from '$lib/types';
import { validateCurrency, getCurrencyBySymbol } from './currencies';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExchangeRate {
	from: string;
	to: string;
	rate: number;
	/** Unix timestamp when this rate was fetched/computed */
	timestamp: number;
	/** Source of the rate: 'config' | 'cache' | 'peg' */
	source: 'config' | 'cache' | 'peg';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_TTL_SECONDS = 300; // 5 minutes
const CACHE_KEY_PREFIX = 'exchange-rate:';

/** Stablecoins pegged 1:1 with USD */
const USD_PEGGED = new Set(['USDC', 'USDT', 'DAI']);

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

/**
 * Get the exchange rate between two currencies.
 *
 * Supports: NP, USDC, USDT, DAI, EURC.
 * All rates are expressed as "1 unit of `from` = rate units of `to`".
 */
export async function getExchangeRate(from: string, to: string, env: Env): Promise<ExchangeRate> {
	const fromUpper = from.toUpperCase();
	const toUpper = to.toUpperCase();

	if (!validateCurrency(fromUpper)) throw new Error(`Unknown currency: ${fromUpper}`);
	if (!validateCurrency(toUpper)) throw new Error(`Unknown currency: ${toUpper}`);

	const now = Math.floor(Date.now() / 1000);

	// Same currency — trivial
	if (fromUpper === toUpper) {
		return { from: fromUpper, to: toUpper, rate: 1, timestamp: now, source: 'peg' };
	}

	// Try KV cache first
	const kv = env.NANDA_NODE_CACHE;
	if (kv) {
		const cached = await getCachedRate(kv, fromUpper, toUpper);
		if (cached) return cached;
	}

	// Compute rate from config/pegs
	const rate = computeRate(fromUpper, toUpper, env);
	const result: ExchangeRate = {
		from: fromUpper,
		to: toUpper,
		rate,
		timestamp: now,
		source: 'config'
	};

	// Cache the computed rate
	if (kv) {
		await cacheRate(kv, result);
	}

	return result;
}

/**
 * Convert an amount from one currency to another using a given rate.
 *
 * Accounts for differing decimal scales between currencies.
 * For example, NP has 0 decimals while USDC has 6, so converting
 * 1000 NP minor units to USDC minor units requires scaling by 10^(6-0).
 *
 * @param amount - Amount in `fromCurrency` minor units
 * @param fromCurrency - Source currency symbol
 * @param toCurrency - Target currency symbol
 * @param rate - Exchange rate object (major-unit exchange rate)
 * @returns Converted amount in `toCurrency` minor units (rounded down)
 */
export function convertAmount(
	amount: number,
	fromCurrency: string,
	toCurrency: string,
	rate: ExchangeRate
): number {
	if (rate.from !== fromCurrency.toUpperCase() || rate.to !== toCurrency.toUpperCase()) {
		throw new Error(
			`Rate mismatch: rate is ${rate.from}→${rate.to}, but converting ${fromCurrency}→${toCurrency}`
		);
	}

	const fromDef = getCurrencyBySymbol(fromCurrency);
	const toDef = getCurrencyBySymbol(toCurrency);
	if (!fromDef || !toDef) {
		throw new Error(`Unknown currency in conversion: ${fromCurrency} or ${toCurrency}`);
	}

	// Convert: minor_from → major_from → major_to → minor_to
	// = amount / 10^fromDecimals * rate * 10^toDecimals
	// = amount * rate * 10^(toDecimals - fromDecimals)
	const decimalAdjustment = Math.pow(10, toDef.decimals - fromDef.decimals);
	return Math.floor(amount * rate.rate * decimalAdjustment);
}

/**
 * Get all cached exchange rates from KV.
 * Returns an empty array on cache miss or if KV is unavailable.
 */
export async function getCachedRates(kv: KVNamespace | undefined): Promise<ExchangeRate[]> {
	if (!kv) return [];

	try {
		const listResult = await kv.list({ prefix: CACHE_KEY_PREFIX });
		const rates: ExchangeRate[] = [];
		for (const key of listResult.keys) {
			const val = await kv.get(key.name, 'json');
			if (val) rates.push(val as ExchangeRate);
		}
		return rates;
	} catch {
		return [];
	}
}

/**
 * Refresh all exchange rates and store in KV cache.
 */
export async function refreshRates(kv: KVNamespace, env: Env): Promise<void> {
	const pairs: [string, string][] = [
		['NP', 'USDC'],
		['USDC', 'NP'],
		['EURC', 'USDC'],
		['USDC', 'EURC']
	];

	const now = Math.floor(Date.now() / 1000);
	for (const [from, to] of pairs) {
		const rate = computeRate(from, to, env);
		await cacheRate(kv, { from, to, rate, timestamp: now, source: 'config' });
	}
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Compute the exchange rate between two currencies from env config. */
function computeRate(from: string, to: string, env: Env): number {
	const npToUsd = parseFloat(env.NP_TO_USD_RATE!);
	const eurToUsd = parseFloat(env.EUR_TO_USD_RATE!);

	// Convert both to USD, then from USD to target
	const fromToUsd = toUsd(from, npToUsd, eurToUsd);
	const toToUsd = toUsd(to, npToUsd, eurToUsd);

	return fromToUsd / toToUsd;
}

/** Get the USD value of 1 unit of the given currency. */
function toUsd(symbol: string, npToUsd: number, eurToUsd: number): number {
	if (USD_PEGGED.has(symbol)) return 1;
	if (symbol === 'NP') return npToUsd;
	if (symbol === 'EURC') return eurToUsd;
	throw new Error(`No USD rate for currency: ${symbol}`);
}

/** Read a cached rate from KV. Returns null on miss. */
async function getCachedRate(
	kv: KVNamespace,
	from: string,
	to: string
): Promise<ExchangeRate | null> {
	try {
		const key = `${CACHE_KEY_PREFIX}${from}:${to}`;
		return await kv.get(key, 'json');
	} catch {
		return null;
	}
}

/** Write a rate to KV cache with TTL. */
async function cacheRate(kv: KVNamespace, rate: ExchangeRate): Promise<void> {
	const key = `${CACHE_KEY_PREFIX}${rate.from}:${rate.to}`;
	await kv.put(key, JSON.stringify(rate), { expirationTtl: CACHE_TTL_SECONDS });
}
