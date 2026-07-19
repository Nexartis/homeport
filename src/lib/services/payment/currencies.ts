/**
 * Currency Registry — typed definitions for all supported currencies.
 *
 * Provides an in-memory registry of supported currencies (NP, USDC, USDT, DAI, EURC)
 * with chain metadata, contract addresses, and helper functions for lookup/validation.
 *
 * The canonical source of truth is the `currencies` D1 table (migration 0009),
 * but this module provides a fast, typed, in-process registry for hot-path use.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CurrencyDefinition {
	/** Ticker symbol, e.g. 'USDC', 'NP' */
	symbol: string;
	/** Human-readable name, e.g. 'USD Coin' */
	name: string;
	/** Decimal places — 6 for USDC/USDT/EURC, 18 for DAI, 0 for NP */
	decimals: number;
	/** Chain identifier — 'base' for Base L2 on-chain tokens, null for off-chain */
	chain: string | null;
	/** ERC-20 contract address on the chain, null for off-chain currencies */
	contractAddress: string | null;
	/** Whether this currency is currently accepted for payments */
	active: boolean;
	/** Classification for filtering */
	category: 'stablecoin' | 'internal';
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/**
 * Static registry of all known currencies.
 *
 * Contract addresses are for Base L2 mainnet.
 */
export const CURRENCY_REGISTRY: Record<string, CurrencyDefinition> = {
	NP: {
		symbol: 'NP',
		name: 'Nanda Points',
		decimals: 0,
		chain: null,
		contractAddress: null,
		active: true,
		category: 'internal'
	},
	USDC: {
		symbol: 'USDC',
		name: 'USD Coin',
		decimals: 6,
		chain: 'base',
		contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
		active: true,
		category: 'stablecoin'
	},
	USDT: {
		symbol: 'USDT',
		name: 'Tether',
		decimals: 6,
		chain: 'base',
		contractAddress: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
		active: true,
		category: 'stablecoin'
	},
	DAI: {
		symbol: 'DAI',
		name: 'Dai',
		decimals: 18,
		chain: 'base',
		contractAddress: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
		active: true,
		category: 'stablecoin'
	},
	EURC: {
		symbol: 'EURC',
		name: 'Euro Coin',
		decimals: 6,
		chain: 'base',
		contractAddress: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42',
		active: false,
		category: 'stablecoin'
	}
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return all currencies that are currently active. */
export function getActiveCurrencies(): CurrencyDefinition[] {
	return Object.values(CURRENCY_REGISTRY).filter((c) => c.active);
}

/** Look up a currency by symbol (case-insensitive). Returns null if unknown. */
export function getCurrencyBySymbol(symbol: string): CurrencyDefinition | null {
	return CURRENCY_REGISTRY[symbol.toUpperCase()] ?? null;
}

/** Returns true if `symbol` is a known currency (case-insensitive). */
export function validateCurrency(symbol: string): boolean {
	return symbol.toUpperCase() in CURRENCY_REGISTRY;
}

/** Return only on-chain stablecoin currencies. */
export function getStablecoins(): CurrencyDefinition[] {
	return Object.values(CURRENCY_REGISTRY).filter((c) => c.category === 'stablecoin');
}

/** Return only active on-chain stablecoin currencies. */
export function getActiveStablecoins(): CurrencyDefinition[] {
	return Object.values(CURRENCY_REGISTRY).filter((c) => c.category === 'stablecoin' && c.active);
}
