<p align="center">
  <img src="static/brand/homeport-cubicube-header.webp"
       alt="Homeport — open-source, self-hostable NANDA node. Managed hosting at cubicube.com."
       width="100%" />
</p>

# Homeport

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![npm: @nexartis/homeport-sdk](https://img.shields.io/npm/v/@nexartis/homeport-sdk.svg?label=%40nexartis%2Fhomeport-sdk)](https://www.npmjs.com/package/@nexartis/homeport-sdk)
[![Docs](https://img.shields.io/badge/docs-homeport--sdk.nexartis.com-informational)](https://homeport-sdk.nexartis.com)

**Every agent needs a homeport.**

Homeport is an open-source, self-hostable
[NANDA](https://projectnanda.org) node — the protocol that
originated at [MIT Media Lab](https://nanda.media.mit.edu/) — the
place your AI agents are _registered to_: identity, trust, and
settlement at the edge. A vessel voyages; its homeport is where its
papers live. Agents roam the open agentic web; their homeport is what
makes them verifiable wherever they go.

## Ecosystem

- **[Nexartis/homeport-sdk](https://github.com/Nexartis/homeport-sdk)** —
  official TypeScript SDK for Homeport nodes.
- **[`@nexartis/homeport-sdk`](https://www.npmjs.com/package/@nexartis/homeport-sdk)** —
  the published npm package.
- **[homeport-sdk.nexartis.com](https://homeport-sdk.nexartis.com)** —
  API reference and SDK documentation.
- **[cubicube.com](https://cubicube.com)** — managed Homeport nodes
  operated by Nexartis.

## Built as a Cubicube Core Cubi

Homeport ships as a **Core Cubi** — a self-describing, provision-ready
template. [`cube.jsonc`](cube.jsonc) declares every resource, variable,
and lifecycle effect the node needs, and `wrangler.jsonc` carries a
provisioning environment that Cubicube's deployment engine resolves
end-to-end (fail-closed — no half-provisioned nodes). The same manifest
drives `pnpm run setup` for self-hosters. Three paths for your work:

1. **Self-host it** — your fork, your Cloudflare account
   ([docs/OPERATIONS.md](docs/OPERATIONS.md)).
2. **Run it managed** — Cubicube operates Homeport nodes at
   [cubicube.com](https://cubicube.com) on this exact contract.
3. **Distribute your customization** — a manifest-honest fork stays
   deployable by the same engine, so a customization you build can be
   offered to Cubicube's customers. Partner with Cubicube to
   distribute it — see
   [docs/CUBICUBE-DISTRIBUTION.md](docs/CUBICUBE-DISTRIBUTION.md).

- **Register** — decentralized identity (DIDs, AgentFacts) with
  lookup, search, list, and stats endpoints.
- **Verify** — Ed25519 key history with rotation, served at
  `/.well-known/keys/[version]`.
- **Certify** — automated certification trials, W3C Verifiable
  Credential issuance, cascading revocation.
- **Delegate** — human-anchored delegation grants with chain
  narrowing, ancestor-expiry cascade, and 32-hop cascading
  revocation.
- **Federate** — CRDT gossip, peer management, adaptive resolver,
  and Lean Index (AgentAddr) — DNS for agents.
- **Speak protocols** — JSON-RPC A2A at `/a2a`, MCP over HTTP at
  `/mcp`, and AgentAddr resolution at `/resolve`.
- **Attribute and settle** — signed receipts, reputation snapshots,
  UCP checkout, multi-currency wallets, subscriptions, invoices.
- **Compose** — multi-agent workflow orchestration with a DAG
  engine, patterns, routing, delegation, and SSE run events.

Built as a SvelteKit 2 / Svelte 5 app on Cloudflare Workers (D1, R2,
KV) — edge-native, one `wrangler deploy` from sovereign.

### Terms in 30 seconds

| Term           | Meaning                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| **DID**        | Decentralized Identifier — a self-owned, verifiable agent identity.                                  |
| **AgentFacts** | Signed, machine-readable claims about an agent (capabilities, policies, keys).                       |
| **Ed25519**    | The [Edwards-curve signature scheme](https://ed25519.cr.yp.to/) Homeport uses for keys and receipts. |
| **CRDT**       | Conflict-free Replicated Data Type — how federated peers gossip state without a coordinator.         |
| **A2A**        | Agent-to-Agent JSON-RPC protocol served at `/a2a`.                                                   |
| **MCP**        | Model Context Protocol — tool/resource surface for LLMs, served at `/mcp`.                           |
| **UCP**        | Universal Checkout Protocol — Homeport's settlement flow for signed receipts and invoices.           |

## NANDA Town interoperability (flagship)

Homeport ships a production **delegated-admission** trust module
that plugs directly into the NANDA Town skills registry. An agent's
authority only counts if a **human said it could act** — grants
chain back to a biometric principal via a
[Yanez](https://www.yanez.ai/) proof-of-human envelope, and
revocation cascades to every descendant grant up to 32 hops.

- A2A actions on the node: `delegation.grant`, `delegation.check`,
  `delegation.revoke`.
- Chain-narrowing invariants (scope ⊆ parent, TTL ≤ parent,
  revocability never flips false→true) are enforced server-side; a
  child grant can never outlive or out-rank its parent.
- Byte-exact canonicalization: every grant is bound by a canonical
  SHA-256 proof hash to _exactly_ the scope, grantee, expiry, and
  parent it was issued for. Change one byte and the grant is
  refused.
- The deterministic Python port of the same verifier is our
  submission to
  [`projnanda/nandatown`](https://github.com/projnanda/nandatown) as
  the `delegated_admission` trust plugin, listed on the
  [Nanda Town skills registry](https://nandatown.projectnanda.org/skills)
  as **"NANDA Delegated Admission."**
- Reference source and adversarial test vectors:
  [`src/lib/server/delegation-grants.ts`](src/lib/server/delegation-grants.ts)
  and
  [`tests/delegation-grants.test.ts`](tests/delegation-grants.test.ts).

## Managed Homeport by Cubicube

Self-hosting is fully supported, and always will be. If you want
**Homeport as a managed service** — one-click deployment, a
dedicated Cloudflare edge footprint, node upgrades, secret
rotation, and a full trust-plane operator console — get it hosted,
personalized, and developed at **[cubicube.com](https://cubicube.com)**.

A live fleet of Homeport nodes already runs in production, deployed
one-click via Cubicube. The open-source node is Apache-2.0;
commercial layers (managed fleet deployment, business-class nodes,
trust-plane services) are built on top of it, never inside it —
your self-hosted node stays fully feature-complete.

## Self-host quickstart

One command. From a fresh clone:

```bash
git clone https://github.com/Nexartis/homeport.git
cd homeport
./homeport run -p 8080
```

The launcher checks your Node version against `.node-version`,
enables `pnpm` via corepack if needed, runs `pnpm install` on
first run, and hands off to `vite dev` bound to port `8080`. You
now have a Homeport dev node running locally against miniflare,
with D1, R2, and KV bound in-process. Open `/`, register a test
agent at `/register`, and query it at `/lookup/:id`.

After `pnpm install` completes, any of these work identically:

```bash
pnpm exec homeport run -p 8080     # via package bin
pnpm start                          # npm-style
npm i -g .   &&   homeport run -p 8080   # bare `homeport` globally
```

Prerequisites (the launcher checks these for you): Node.js matching
`.node-version` and pnpm 10. A Cloudflare account with
[`wrangler`](https://developers.cloudflare.com/workers/wrangler/)
authenticated is only needed for deploys — run `./homeport doctor`
any time to see what is missing.

Useful commands:

```bash
pnpm run check      # SvelteKit sync + Svelte/type checks
pnpm run lint       # ESLint (semantic only)
pnpm run test       # Vitest with Cloudflare/miniflare pool
pnpm run build      # SvelteKit Cloudflare build + worker shims
pnpm run validate   # Repo validation gate: lint + check + test
```

**Deploy to your own Cloudflare account** — one command to your own
edge; see [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for the full
resource layout and environment bindings:

```bash
pnpm run deploy:dev
pnpm run deploy:prod
```

A node needs its own D1 database, R2 bucket, KV namespace, and an
Ed25519 signing key. Before your first deploy run
`pnpm run setup` — it provisions the Cloudflare resources declared
in `cube.jsonc` and prints the IDs to paste into `wrangler.jsonc`.
See [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for the resource
layout and
[`docs/secret-provisioning.md`](docs/secret-provisioning.md) for
secret bindings and the `/admin/keys` bootstrap flow.

## Documentation map

- [`docs/PRODUCT_ARCHITECTURE.md`](docs/PRODUCT_ARCHITECTURE.md) —
  system overview and the source-of-truth index for the sub-docs
  below.
- [`docs/REGISTRY_DISCOVERY.md`](docs/REGISTRY_DISCOVERY.md) —
  registry, AgentFacts, AgentAddr, SafeSearch.
- [`docs/CERTIFICATION_COMPLIANCE.md`](docs/CERTIFICATION_COMPLIANCE.md) —
  certifier, compliance, observer, credentials, reputation.
- [`docs/FEDERATION_RESOLUTION.md`](docs/FEDERATION_RESOLUTION.md) —
  federation gossip, peers, resolver, Lean Index, switchboard.
- [`docs/ORCHESTRATION.md`](docs/ORCHESTRATION.md) — multi-agent
  workflow orchestration.
- [`docs/BILLING_REVENUE.md`](docs/BILLING_REVENUE.md) — UCP,
  subscriptions, invoices, wallets, revenue share.
- [`docs/MCP_API_CONTRACTS.md`](docs/MCP_API_CONTRACTS.md) — REST,
  A2A, MCP, and OpenAPI contract surface.
- [`docs/OPERATIONS.md`](docs/OPERATIONS.md) — install,
  environments, bindings, deploys.
- [`docs/TESTING.md`](docs/TESTING.md) — validation strategy.

## Hosted services (optional)

A self-hosted Homeport is complete on its own. For teams who want
to move faster, Nexartis operates a small set of hosted services
that any Homeport node can opt into:

- **Sentinel** — hosted authentication (magic links, sessions,
  device trust) so you do not have to run your own auth stack.
- **Transactional email** — for magic links, welcome mail, and
  operator notifications.

Both are **free for reasonable use** to Homeport operators. For
higher volumes, SLAs, dedicated regions, procurement, or
enterprise support, get in touch through
[**cubicube.com**](https://cubicube.com) — that is where managed
Homeport, business-class nodes, and commercial support live.

## Contributing

Issues and pull requests are welcome — please read
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the workflow, the local
validation gate, and expectations. See [`AGENTS.md`](AGENTS.md) if
you are contributing with the help of a coding agent.

## License

Apache-2.0 — see [`LICENSE`](LICENSE). Copyright © 2026 Nexartis LLC.
