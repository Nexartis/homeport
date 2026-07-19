# AGENTS.md — Homeport

Conventions for AI coding agents (Claude Code, Cursor, Kilo, and
similar) working on this repository. Human contributors should read
[`CONTRIBUTING.md`](CONTRIBUTING.md) — this file adds the extra
context an agent needs to be productive without breaking things.

## Repository shape

Homeport is a single self-hostable NANDA node built as a SvelteKit 2
/ Svelte 5 app running on Cloudflare Workers. Data lives in
Cloudflare D1 (via Drizzle ORM), R2, and KV; signing keys are
Ed25519 via the Web Crypto API.

Top-level layout:

```
src/lib/
  db/            # Drizzle schema, client, repositories
  services/      # Registry, certifier, compliance, observer, auditor,
                 # federation, resolver, switchboard, orchestration,
                 # billing, payments, lean-index
  middleware/    # Rate limit, auth guards
  utils/         # Logger, resolveSecret, VC utilities, crypto
  server/        # Delegation grants, owner preferences
  mcp/           # MCP server executors
src/routes/
  a2a/           # JSON-RPC A2A entry point
  api/           # REST + admin + developer APIs, cron/queue endpoints
  mcp/           # MCP HTTP endpoint
  .well-known/   # Discovery: agent-card, DID, VC status, nanda-index,
                 # public keys
  register/      lookup/  search/  list/  resolve/  federation/
drizzle/migrations/   # Hand-written SQL migrations
tests/                # Vitest test suite (miniflare pool)
docs/                 # Product + operations docs
```

Read [`docs/PRODUCT_ARCHITECTURE.md`](docs/PRODUCT_ARCHITECTURE.md)
for the service-domain map before making non-trivial changes.

## Ground rules

- **Follow the validation gate before proposing changes.** The gate
  is `pnpm run lint && pnpm run check && pnpm run test` — same
  commands humans run. Anything you propose must pass all three.
- **Svelte 5 runes only.** `$state`, `$derived`, `$effect`,
  `$props()`. No Svelte 4 syntax.
- **Cloudflare Workers runtime.** No Node.js APIs, no `process.env`
  — read from `event.platform.env`.
- **Secrets always through `resolveSecret()`**
  (`src/lib/utils/resolve-secret.ts`) so both Secrets Store bindings
  and KV fallback keep working.
- **Never commit secret values, Cloudflare account IDs, D1/KV/R2
  IDs, or personal identifiers.** These belong in `wrangler` config
  or the operator's Cloudflare account, not in source.
- **Migrations are hand-written SQL** in `drizzle/migrations/`. Do
  not run `drizzle-kit push`; append a new numbered migration file
  and update `drizzle/migrations/meta/_journal.json`.
- **Do not touch `src/lib/protocol-constants.ts`.** Those values are
  stable JSON-LD namespace URIs required for cross-node signature
  verification.
- **Keep public routes public.** `/register`, `/lookup`, `/search`,
  `/list`, `/resolve`, `/.well-known/*`, and `/health` are part of
  the NANDA contract with other nodes.

## Protocol surface

- **REST** — `/register`, `/lookup/:id`, `/search`, `/list`,
  `/stats`, `/health`, `/agentfacts/:id`, `/resolve/:agent_id`.
- **A2A JSON-RPC 2.0** at `POST /a2a`. Actions use the pattern
  `{domain}.{action}` (e.g. `delegation.grant`, `policy.eval`,
  `payment.settle`, `audit.intent`).
- **MCP** over HTTP at `POST /mcp` — bearer auth via developer API
  key. See [`docs/MCP_API_CONTRACTS.md`](docs/MCP_API_CONTRACTS.md).
- **Well-known** — `/.well-known/agent-card.json`,
  `/.well-known/nanda-index`, `/.well-known/keys/[version]`,
  `/.well-known/did.json`.

## Test discipline

- New behavior: add a Vitest test in `tests/`.
- Delegation-grants tests are byte-parity fixtures — do not edit
  vectors without regenerating them from the canonicalization
  reference in `src/lib/server/delegation-grants.ts`.
- Tests run inside `@cloudflare/vitest-pool-workers` (miniflare);
  do not rely on Node globals in test code.

## Where to look first

- Auth lanes and API-key model: `src/lib/middleware/` and
  `docs/MCP_API_CONTRACTS.md`.
- Federation and resolver: `src/lib/services/federation/`,
  `src/lib/services/resolver/`, `docs/FEDERATION_RESOLUTION.md`.
- Delegation grants and PUH proofs:
  `src/lib/server/delegation-grants.ts` and the corresponding tests.
- Bindings and environments: `wrangler.jsonc`,
  `docs/OPERATIONS.md`, and `docs/secret-provisioning.md`.
