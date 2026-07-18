# MCP, REST, A2A, and API Contracts — Current State

## Responsibility

This document owns the current API and protocol contract map: public REST routes, admin/developer APIs, A2A, MCP, OpenAPI generation, auth lanes, and known contract coverage gaps.

## Contract surfaces

| Surface        | Current contract shape                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| Public REST    | Registry, lookup, search, list, stats, health, trust badges, AgentFacts, resolution, well-known endpoints.            |
| Admin REST     | Authenticated settings, keys, invitations, audit, billing, federation, analytics, trust, queue/cron, and domain APIs. |
| Developer REST | Developer API keys, earnings, invoices, webhooks, subscriptions, UCP, orchestration, and payment helpers.             |
| A2A            | JSON-RPC 2.0 at `/a2a`; methods follow `{domain}.{action}`.                                                           |
| MCP            | JSON-RPC/MCP over HTTP at `/mcp`; bearer `nanda_` API key required through the developer API-key path.                |
| OpenAPI        | Generated to `static/openapi.json` by `sveltekit-openapi-generator`; currently partial.                               |

## MCP tools

The current MCP tool list has 21 tools:

| Tool family               | Tools                                                                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registry/discovery        | `nanda_lookup_agent`, `nanda_search_agents`, `nanda_list_agents`, `nanda_register_agent`, `nanda_get_agentfacts`, `nanda_resolve_agent`, `nanda_discover_agent` |
| Trust/compliance          | `nanda_get_reputation`, `nanda_check_cert`, `nanda_trust_scores`, `nanda_compliance_check`                                                                      |
| Infrastructure/federation | `nanda_check_health`, `nanda_federation_status`, `nanda_list_adapters`, `nanda_export_agent`                                                                    |
| Orchestration             | `nanda_create_workflow`, `nanda_run_workflow`                                                                                                                   |
| Webhooks/payments         | `nanda_subscribe_webhook`, `nanda_get_exchange_rates`, `nanda_get_wallet_balance`, `nanda_convert_currency`                                                     |

## Auth lane summary

- Browser session auth powers admin and user-session routes.
- Developer API keys power `nanda_` bearer token access and MCP.
- Cron/internal routes use the configured cron secret path.
- Some routes intentionally allow public reads; some transition-period paths still log unauthenticated writes before stricter enforcement.

## OpenAPI status

The generated `static/openapi.json` currently includes 54 paths, but the SvelteKit route surface is broader. Public/admin protocol docs must therefore treat OpenAPI as useful but incomplete until the route annotation gap is closed.

## Contract testing status

Vitest covers REST, A2A, MCP, auth-lane, queue, and domain services. Browser E2E and complete OpenAPI route parity are open work; see [`TESTING.md`](TESTING.md).
