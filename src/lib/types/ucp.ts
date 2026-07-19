/**
 * UCP (Universal Commerce Protocol) Types — Phase 5, D1
 *
 * TypeScript types for the full UCP data model per spec v2026-01-11.
 * Covers manifests, capabilities, checkout sessions, payments.
 *
 * @see https://github.com/Universal-Commerce-Protocol/ucp
 */

// ---------------------------------------------------------------------------
// Manifest
// ---------------------------------------------------------------------------

export interface UcpManifest {
	name: string;
	description: string;
	url: string;
	version: string;
	spec_version: string;
	capabilities: UcpCapability[];
	payment_methods: UcpPaymentMethod[];
	protocols: string[];
	extensions: unknown[];
}

export interface UcpPaymentMethod {
	type: string;
	description: string;
}

// ---------------------------------------------------------------------------
// Capabilities
// ---------------------------------------------------------------------------

export interface UcpCapabilityPrice {
	amount: number;
	currency: string;
}

export interface UcpCapability {
	id: string;
	name: string;
	description: string;
	price: UcpCapabilityPrice;
	type: string;
	metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Checkout Sessions
// ---------------------------------------------------------------------------

export type UcpCheckoutStatus =
	| 'open'
	| 'pending_payment'
	| 'paid'
	| 'completed'
	| 'cancelled'
	| 'expired';

export interface UcpCheckoutLineItem {
	capability_id: string;
	quantity: number;
	unit_price: number;
	total: number;
}

export interface UcpCheckoutTotals {
	subtotal: number;
	discount: number;
	tax: number;
	total: number;
	currency: string;
}

export interface UcpPaymentInfo {
	method: string;
	status: string;
	provider_ref: string | null;
	amount: number;
	currency: string;
}

export interface UcpCheckoutSession {
	id: string;
	status: UcpCheckoutStatus;
	client_agent_id: string | null;
	line_items: UcpCheckoutLineItem[];
	totals: UcpCheckoutTotals;
	payment: UcpPaymentInfo | null;
	metadata: Record<string, unknown> | null;
	created_at: number;
	updated_at: number;
	expires_at: number | null;
}

// ---------------------------------------------------------------------------
// Payment Submission (incoming from client)
// ---------------------------------------------------------------------------

export interface UcpPaymentSubmission {
	method: string;
	agent: string;
	tx_id: string;
	amount: number;
	signature: string;
}

// ---------------------------------------------------------------------------
// API Request/Response shapes
// ---------------------------------------------------------------------------

export interface CreateCheckoutRequest {
	capabilities: { id: string; quantity: number }[];
	client_agent_id?: string;
}

export interface UpdateCheckoutPaymentRequest {
	payment: UcpPaymentSubmission;
}
