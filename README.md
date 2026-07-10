# Homeport

**Every agent needs a homeport.**

Homeport is an open-source [NANDA](https://projectnanda.org) node —
the place your AI agents are *registered to*: identity, trust, and
settlement at the edge. A vessel voyages; its homeport is where its
papers live. Agents roam the open agentic web; their homeport is what
makes them verifiable wherever they go.

- **Register** — decentralized identity (DIDs, AgentFacts)
- **Verify** — Ed25519 key history with rotation, served at
  `/.well-known/keys/[version]`
- **Certify** — delegation grants anchored to a human principal
  (proof-of-human envelope, canonical SHA-256 binding)
- **Attribute & Settle** — signed receipts, reputation, UCP payments
- **Monitor** — cascading revocation, signed audit trail

Built as a SvelteKit app on Cloudflare Workers (D1, R2, KV) —
edge-native, one `wrangler deploy` from sovereign. A live fleet of
Homeport nodes already runs in production, deployed one-click via
[CubiCube](https://nexartis.com).

## Status: source landing now

This repository is being seeded from our production codebase. The
**delegation-grants module is published today** (see below); the full
node source lands here **within one week of NandaHack 2026** after a
final code review and cleanup pass. Watch the repo to follow along.

### Published today

| Path | What it is |
| --- | --- |
| `src/lib/server/delegation-grants.ts` | Delegation grants (NND-D3): canonical proof-of-human envelope + SHA-256 hash binding, freshness windows, chain-narrowing (scope/TTL/revocability), cascading revocation (32-hop BFS), check-time ancestor walk |
| `tests/delegation-grants.test.ts` | The production test suite: TS↔wire parity vectors and attack cases |

These two files are the production source for the
`delegated_admission` trust plugin submitted to NandaHack
([projnanda/nandatown](https://github.com/projnanda/nandatown),
branch `hackathon/tony-nexartis-delegated-admission`) — a
deterministic Python port with byte-exact canonicalization parity,
adversarial validators, and a Tier-1 scenario. The live service is on
the [Nanda Town skills registry](https://nandatown.projectnanda.org/skills)
as **"NANDA Delegated Admission."**

## Why open source

Identity, trust, and settlement rails only work as public
infrastructure — a homeport you can't inspect isn't one you can trust
your fleet to. The node is Apache-2.0; commercial layers (managed
fleet deployment, business-class nodes, trust-plane services) are
built on top of it, never inside it.

## License

Apache-2.0 — see [LICENSE](./LICENSE).
Copyright © 2026 Nexartis LLC.
