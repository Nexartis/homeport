# Billing, Payments, Subscriptions, Invoices, and Revenue — Current State

## Responsibility

This document owns billing and revenue-related current state for the NANDA node. It covers UCP checkout sessions, subscriptions, invoices, revenue sharing, multi-currency helpers, wallets, payment analytics, and auditor touchpoints.

## Product role

Billing capabilities let a node meter agent/API usage, verify payments, expose checkout and invoice surfaces, and compute developer-facing earnings/revenue-share views.

## Current surfaces

| Surface                                                                              | Responsibility                             |
| ------------------------------------------------------------------------------------ | ------------------------------------------ |
| `/api/ucp/checkout-sessions`                                                         | Create/list checkout sessions.             |
| `/api/ucp/checkout-sessions/:id`                                                     | Inspect a checkout session.                |
| `/api/subscriptions` and `/api/subscriptions/:id`                                    | Subscription lifecycle APIs.               |
| `/api/invoices` and `/api/invoices/:id`                                              | Invoice listing and retrieval.             |
| `/api/developer/earnings`                                                            | Developer earnings surface.                |
| `/api/payments/currencies`, `/rates`, `/convert`, `/wallets/:agent_id`, `/verify-np` | Payment/currency helpers and wallet views. |
| `/api/admin/billing`, `/api/admin/analytics/payments`                                | Admin billing and payment analytics.       |
| `/admin/payments`, `/admin/auditor`                                                  | Operator views.                            |
| A2A/MCP payment actions                                                              | Payment-related protocol access.           |

## Data responsibilities

- `ucp_checkout_sessions`, `subscriptions`, `subscription_events`, `invoices`, and `invoice_sequence` track customer-facing commercial lifecycle state.
- `billing_periods`, `billing_line_items`, `currencies`, `audit_wallets`, and payment analytics helpers support metering and currency views.
- `revenue_splits`, `revenue_shares`, and `revenue_settlements` support developer earnings/revenue-share workflows.

## Revenue boundary

This repo is not an OCME settlement engine. For OCME revenue audits, playlist creation alone is not revenue activity; settlement tracing must use play records, settlement periods, and payment records in the owning OCME repos. NANDA-node billing/revenue is agent/node commercial infrastructure.

## Current risks

- Payment analytics code still labels some billing/revenue/subscription fields as stubbed dashboard data.
- Contract and E2E coverage for billing/admin journeys is incomplete.
- Broader accounting/reconciliation questions belong to the operator's own revenue system, not to this document.
