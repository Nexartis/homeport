# TRUSTIP-45 — Subnet-Performance Connector: Design

**Status:** design-only (no code changes, no deploy — this document is the deliverable)
**Repo:** `Nexartis/homeport` (Apache-2.0) · **Linear:** TRUSTIP-45 · **Board row:** `yanez-bittensor-1.0-r3:homeport:implement`
**Train:** `yanez-bittensor-1.0`, milestone **M1-foundation** · **Roadmap item:** P1-4
**Author:** lane W2-45, yanez-phase2 wave · 2026-09-07
**Recommended landing path:** `homeport/docs/design/TRUSTIP-45-subnet-performance-connector.md` (see §12 Target path)

> Exit criterion this design serves (frozen seed, M1-foundation): *"BitMind agent certificate embeds subnet performance evidence and verifies offline (TRUSTIP-45)"* — `nexartis-product-portfolio/docs/research/data/yanez-bittensor-1.0-round-01/train-seed-yanez-bittensor-1.0.json:32`; task row *"P1-4 Subnet-performance connector into certifier + offline-verifiable anchor"* at `:74`.

---

## 1. Purpose

Add a **subnet-performance connector** to Homeport: a read-only ingestion service that pulls Bittensor subnet performance history (validator trust scores, emissions rank, stake, registration/identity events) for a configured set of subnets — pilot: **BitMind SN34** — persists it as dated, digest-pinned evidence snapshots in the node's own D1/R2, and feeds it into (a) the certifier's W3C Verifiable Credential issuance as an embedded evidence section and (b) the reputation/trust-score surface as a third, externally-grounded input. The connector also provides the **externally verifiable certificate anchor**: a buyer who does not run a NANDA node can re-derive the evidence digest from public chain data and verify the node's Ed25519 proof offline.

This closes the named capability-3 gap: Homeport's certification machinery exists (Wilson-scored trials, W3C VCs, cascading revocation — `nexartis-product-portfolio/docs/research/data/yanez-bittensor-1.0-round-01/harvest/04-homeport-gap.md:70`, `:47`) but has *"no ingestion of external (e.g. Bittensor subnet) performance data and no anchor independent of the node federation"* (`04-homeport-gap.md:73`); the gap table prescribes exactly *"a subnet-data connector + external verifiability story"*, effort **M** (`04-homeport-gap.md:89`, `:124`).

## 2. Context — why subnet performance history is part of the certification-with-evidence wedge

- The defensible product wedge is **certification-with-evidence** — "why should a paying enterprise buyer trust this specific agent's output?" — *"grounded in Yanez PoH + MIID adversarial data + BitMind detection + subnet performance history"* (`nexartis-product-portfolio/docs/research/yanez-bittensor-trust-monetization-2026-09-06.md:25`). Subnet performance history is one of the four named evidence legs; this connector is the leg that is entirely unbuilt today.
- The value chain row: *"Portable, evidence-backed agent certificate (Yanez PoH + MIID/BitMind evidence + subnet performance)"* is the differentiated product against an empirically Sybil-broken ERC-8004 reputation registry (59–91% of reviewers; *"cannot function as a trust signal"* — arXiv 2606.26028) (`yanez-bittensor-trust-monetization-2026-09-06.md:25`, `:188`).
- Competitive differentiation is exactly this bundle: Verathos SN96 sells proof-backed *inference*; Nexartis sells the portable *certification bundle* including subnet performance history (`yanez-bittensor-trust-monetization-2026-09-06.md:99`). If PoH goes protocol-native, the wedge must add value ABOVE the native primitive — *"evidence corpus + subnet performance + portability"* (`:157`).
- Homeport is the right asset and ~60% there, but *"subnet-performance ingestion into certification"* is on the missing list (`yanez-bittensor-trust-monetization-2026-09-06.md:27`; capability table row 3 at `:86`).
- The connector is counter-cyclical to the ecosystem honesty gap (~$28–35M real revenue vs ~$300M annual emissions — `yanez-bittensor-trust-monetization-2026-09-06.md:210`): emissions rank + validator trust are the protocol's own measured signals, and certifying against them is cheap to verify and hard to fake.

## 3. HARD CONSTRAINTS (binding on the implementation)

These are the arch-review A3 constraints recorded in the implementation handover (`nexartis-product-portfolio/docs/workspace-handoffs/yanez-bittensor-1.0/HO-2026-09-07-yanez-impl-handover.md:27`) and the SOTA refresh (`yanez-bittensor-trust-monetization-2026-09-06.md:214`, `:130`). Every one is a named section below and a named test in §10.

### C1 — Pin `spec_version >= 441`

The connector MUST read the chain runtime version (`state_getRuntimeVersion` → `specVersion`) at the start of every sync run and **refuse the run fail-loud** with classified refusal `spec_version_below_pin` when `specVersion < 441`. The observed `spec_version` is persisted on every snapshot and sync-run row (§5) so evidence is forever interpretable against the runtime that produced it. Rationale: V441 "Root Reborn" (Jul 2026) is a wire-format break — RootClaimed event moved 114→115 and SubtensorModule errors were renumbered (`yanez-bittensor-trust-monetization-2026-09-06.md:214`, `:211`; source: subtensor.com/learn/whats-new/v441). A pre-441 chain (or a misconfigured RPC pointing at an archive/testnet node behind the pin) produces bytes this connector must never silently reinterpret.

### C2 — Decode events and errors BY NAME, never by index

No numeric event index or error index appears anywhere in connector source, fixtures, or config. Decoding resolves variant **names** through the chain's own runtime metadata (V14/V15 `metadata.events` / `metadata.errors` for pallet `SubtensorModule`), fetched per sync run and cached keyed by `spec_version`. The canonical trap: **error index 157 silently changed meaning** `TooManyRootClaimHotkeys → BetaBasketSeedInProgress` at V441 (`yanez-bittensor-trust-monetization-2026-09-06.md:214`; `HO-2026-09-07-yanez-impl-handover.md:27`) — an index-keyed decoder does not fail, it *misreads success as a different failure* (or vice versa). By-name decoding makes the entire renumbering class structurally impossible: if a variant name is absent from the fetched metadata, the refusal is `decode_unknown_variant` (fail-loud, §9), never a positional guess.

### C3 — `BetaBasketSeedInProgress` = retryable, not terminal

When a chain read or extrinsic-observation path surfaces the `SubtensorModule.BetaBasketSeedInProgress` error (resolved by name per C2), the connector classifies it **transient/retryable**: backoff-and-retry per §9, the sync run stays `running`/`pending_retry`, and it NEVER propagates as a terminal failure to a certification job, a certificate, or a reputation snapshot. It is a V441 root-basket seeding in-progress signal (meaning born at V441 at the index previously held by `TooManyRootClaimHotkeys` — `yanez-bittensor-trust-monetization-2026-09-06.md:214`), i.e. the chain is busy, not the agent uncertifiable.

### C4 — ADR-2026-08-09 alignment: reusable public-safe feature, canonical node = configured deployment

The connector lands **in Homeport Apache-2.0 source as a reusable public-safe feature** under the ADR's demonstrated-gap clause — the operator-approved train IS the demonstrated gap (`yanez-bittensor-trust-monetization-2026-09-06.md:175`; `HO-2026-09-07-yanez-impl-handover.md:31`; ADR: `nexartis-system-architecture/decisions/ADR-2026-08-09-homeport-open-core-and-nanda-retirement.md`). Concretely: no Nexartis-only branding, no hardcoded SN34/BitMind specifics in source (the pilot subnet is a **deployment-config row** in `subnet_nodes`, §5), no proprietary secrets in the feature path, and the canonical Nexartis node is a *configured deployment* of this same source — **never a fork**. Any self-hoster can enable the connector via the same admin surface (§6.4).

### C5 — Sequence: TRUSTIP-40 (deploy) → 45 → 46-design; 42/44 park until M0 human gates clear

Implementation of this design is sequence-gated: it lands on the occupied Homeport node **after TRUSTIP-40** (first operated prod node — *"Homeport prod node healthy at a public URL with deployment receipt"*, `train-seed-yanez-bittensor-1.0.json:30`; HO §3 deploy-prep-only, execution waits for the M0 gate, `HO-2026-09-07-yanez-impl-handover.md:39`) and **before TRUSTIP-46-design** (BitMind SN34 integration, `HO-2026-09-07-yanez-impl-handover.md:28`). Sequence unblocked work first: *"40 → 45 → 46-design; 42/44 park until their M0 human gates clear"* (`yanez-bittensor-trust-monetization-2026-09-06.md:173`) — TRUSTIP-42 waits on Yanez PoH pricing (TRUSTIP-36), TRUSTIP-44 on the MSB/counsel memo (TRUSTIP-28) (`:173`; `HO-2026-09-07-yanez-impl-handover.md:47-48`). This design doc itself is W2 scope: **design only, no deploy** (`HO-2026-09-07-yanez-impl-handover.md:25`).

## 4. Connector interface — sources, reads, decoding

### 4.1 Source tiers (trusted → convenience)

| Tier | Source | What is read | Trust posture |
| :- | :-- | :-- | :-- |
| T1 | **Subtensor chain RPC** (operator-configured public or self-run node; JSON-RPC over HTTPS) | `state_getRuntimeVersion` (C1 pin); `state_getMetadata` (C2 by-name maps); storage queries for subnet/neuron state (netuid metadata, neurons per hotkey: stake, validator trust/consensus scores, emissions, rank); finalized-block event scans for `SubtensorModule` registration/claim events by name | **Authoritative.** Snapshots cite block hash + number; evidence digests are re-derivable from chain state by any third party |
| T2 | **Subnet-native APIs** (pilot: BitMind SN34 endpoints — detection stats, Creator Rewards layer signals; the SN34 contact rides TRUSTIP-36/46, `HO-2026-09-07-yanez-impl-handover.md:28`) | Subnet-specific quality signals as *supplementary* evidence | Adapter-pluggable (`adapter_kind` on `subnet_nodes`); each adapter is public-safe source per C4; supplementary evidence is labeled with its source and never merged silently into T1 fields |
| T3 | Third-party dashboards/aggregators (tao.app-class) | Convenience cross-checks only | **Never** certificate-bearing; if stored at all, stored in `raw_json` with `source_tier=3` and excluded from digests |

Design rule: **the certificate anchor rides T1 only.** T2 enriches; T3 is noise-checked. This keeps the offline-verifiability story honest (any buyer can re-derive T1 from public chain data without trusting Nexartis or BitMind).

### 4.2 Sync run lifecycle

Follows the certifier job pattern (`homeport/src/lib/services/certifier/service.ts:329` `completeJob`; `cert_jobs` status lifecycle `pending | running | complete | failed` at `homeport/src/lib/db/schema.ts:68-80`) and the node's **inline processing model** — cron-authenticated HTTP entry points, no Cloudflare Queues dependency (`homeport/docs/CERTIFICATION_COMPLIANCE.md` §Inline processing model; existing cron routes `homeport/src/routes/api/cron/{probe-scheduler,gossip-push,external-registry-sync,sweep-intents,sweep-sunset}`; hourly crons `homeport/wrangler.jsonc:44`; cron auth lane D `requireCronAuth` at `homeport/src/lib/server/auth-lanes.ts:11`, bootstrap note `homeport/src/hooks.server.ts:354-376`).

```
subnet_sync_runs:  pending → running → { complete | pending_retry | failed }
```

One run per `(subnet_node, cursor window)`:
1. `state_getRuntimeVersion` → **C1 gate** (`spec_version_below_pin` refuses the run before any read).
2. `state_getMetadata` → build/refresh the by-name event+error maps for `SubtensorModule`, cached under `spec_version` (**C2**).
3. Read subnet/neuron storage at a **finalized block**; record `block_number` + `block_hash`.
4. Scan the cursor window's events, decoding **by name** (`RootClaimed`, registration/deregistration variants as named in fetched metadata — never 114/115 literals; the V441 move is absorbed structurally, `yanez-bittensor-trust-monetization-2026-09-06.md:214`).
5. Write `subnet_performance_snapshots` rows (idempotent, §5) + raw evidence blob to R2 with its sha256 in-row.
6. Advance the cursor; mark `complete`. Any classified transient (§9) → `pending_retry` with backoff; terminal → `failed` with `last_error_class`.

### 4.3 Agent ↔ hotkey binding

Subnet data is keyed by SS58 hotkey; certificates are keyed by Homeport `agent_id`. A binding row (`agent_subnet_bindings`, §5) is created only through an authenticated admin/agent flow that proves control of the hotkey (signed message from the hotkey, verified with the same fail-loud crypto posture as the Yanez BLS callback verification — `homeport/src/lib/services/yanez/service.ts:1-11` sign-and-return pattern; `04-homeport-gap.md:76-77`). Unbound hotkeys are ingested as subnet-level context only and never attached to a certificate.

### 4.4 spec_version pinning mechanics (C1 detail)

- `MIN_SPEC_VERSION = 441` is a **named constant with a comment citing V441** (RootClaimed 114→115; error 157 meaning change) — the only numeric literal of its kind allowed, and it gates rather than decodes.
- Every snapshot and sync-run row stores the observed `spec_version`; the evidence digest (§6.3) commits to it, so a verifier knows which runtime metadata to fetch.
- A chain that *upgrades past* 441 is fine: by-name decoding re-resolves from fresh metadata; unknown variant names refuse loud (`decode_unknown_variant`) instead of guessing — the connector degrades to "needs a code update", never to "silently wrong".

## 5. Data model (D1 via Drizzle — new SUBNET PERFORMANCE domain)

Conventions mirror the existing schema: `sqliteTable`, snake_case columns, `text` ULID/UUID primary keys, `integer` unix-epoch timestamps defaulting `sql\`(unixepoch())\``, explicit indexes (`homeport/src/lib/db/schema.ts:68-137` cert domain, `:217-237` `reputation_snapshots`). New domain block appended to `schema.ts` + a `subnet-performance.ts` repository in `homeport/src/lib/db/repositories/` (pattern: `repositories/certifier.ts`, `repositories/observer.ts`). Drizzle migration generated under `homeport/drizzle/`.

```ts
// ---- SUBNET PERFORMANCE DOMAIN (5 tables) ----

// Which subnets this node watches. Deployment config, not source (C4):
// the canonical Nexartis node seeds one row for BitMind SN34; any
// self-hoster seeds their own.
export const subnetNodes = sqliteTable('subnet_nodes', {
  id: text('id').primaryKey(),                 // uuid
  netuid: integer('netuid').notNull(),
  chainRpcUrl: text('chain_rpc_url').notNull(),   // T1 source; admin-only writable (SSRF guard §8)
  adapterKind: text('adapter_kind').default('subtensor-v1'), // T2 adapter plug point
  adapterConfig: text('adapter_config'),       // JSON; adapter-specific, public-safe
  enabled: integer('enabled').default(0),      // off by default (mirrors yanez_enabled, §6.4)
  createdAt: integer('created_at').default(sql`(unixepoch())`)
}, (t) => ({ netuidIdx: uniqueIndex('idx_subnet_nodes_netuid').on(t.netuid) }));

// One sync run per (subnet, cursor window) — job-lifecycle twin of cert_jobs.
export const subnetSyncRuns = sqliteTable('subnet_sync_runs', {
  runId: text('run_id').primaryKey(),
  subnetNodeId: text('subnet_node_id').notNull().references(() => subnetNodes.id),
  status: text('status').default('pending'),   // pending | running | pending_retry | complete | failed
  cursorBlock: integer('cursor_block'),        // last finalized block ingested
  headBlock: integer('head_block'),
  specVersion: integer('spec_version'),        // C1: observed at run start; null until read
  attempts: integer('attempts').default(0),
  lastErrorClass: text('last_error_class'),    // classified refusal string (§9), never a raw stack
  startedAt: integer('started_at').default(sql`(unixepoch())`),
  finishedAt: integer('finished_at')
}, (t) => ({ nodeIdx: index('idx_ssr_node').on(t.subnetNodeId, t.startedAt) }));

// The evidence atoms: one row per (hotkey, block) observation.
export const subnetPerformanceSnapshots = sqliteTable('subnet_performance_snapshots', {
  id: text('id').primaryKey(),
  subnetNodeId: text('subnet_node_id').notNull().references(() => subnetNodes.id),
  netuid: integer('netuid').notNull(),
  hotkeySs58: text('hotkey_ss58').notNull(),
  blockNumber: integer('block_number').notNull(),
  blockHash: text('block_hash').notNull(),     // T1 re-derivability anchor
  specVersion: integer('spec_version').notNull(), // C1: runtime that produced this row
  emissionRank: integer('emission_rank'),
  validatorTrustScore: real('validator_trust_score'),
  consensusScore: real('consensus_score'),
  stake: text('stake'),                        // minor-unit string; never float for value
  incentive: real('incentive'),
  dividends: real('dividends'),
  rawJson: text('raw_json'),                   // full decoded neuron/event payload, by-name fields only
  sourceTier: integer('source_tier').default(1), // 1=chain 2=subnet-adapter 3=convenience (§4.1)
  evidenceR2Key: text('evidence_r2_key'),      // raw blob; mirrors trial_results.evidence_r2_key (schema.ts:82-103)
  evidenceSha256: text('evidence_sha256'),
  fetchedAt: integer('fetched_at').default(sql`(unixepoch())`)
}, (t) => ({
  idemIdx: uniqueIndex('idx_sps_idem').on(t.subnetNodeId, t.hotkeySs58, t.blockNumber), // idempotent re-sync
  hotkeyIdx: index('idx_sps_hotkey').on(t.hotkeySs58, t.fetchedAt)
}));

// Proof-of-control link between a Homeport agent and a chain hotkey (§4.3).
export const agentSubnetBindings = sqliteTable('agent_subnet_bindings', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  netuid: integer('netuid').notNull(),
  hotkeySs58: text('hotkey_ss58').notNull(),
  verifyMethod: text('verify_method').notNull(),   // 'hotkey-signature'
  verifyEvidenceR2Key: text('verify_evidence_r2_key'),
  verifiedAt: integer('verified_at').default(sql`(unixepoch())`),
  revokedAt: integer('revoked_at')
}, (t) => ({ agentIdx: uniqueIndex('idx_asb_agent_hotkey').on(t.agentId, t.netuid, t.hotkeySs58) }));

// The certificate-bearing evidence bundle: a digest-committed set of snapshots.
export const subnetEvidenceBundles = sqliteTable('subnet_evidence_bundles', {
  bundleId: text('bundle_id').primaryKey(),
  certId: text('cert_id'),                    // nullable until attached at issuance (§6.2)
  agentId: text('agent_id').notNull(),
  netuid: integer('netuid').notNull(),
  windowStartBlock: integer('window_start_block').notNull(),
  windowEndBlock: integer('window_end_block').notNull(),
  specVersion: integer('spec_version').notNull(),
  snapshotIds: text('snapshot_ids').notNull(), // JSON array
  bundleSha256: text('bundle_sha256').notNull(), // sha256 over canonical JSON of the bundle (§6.3)
  bundleR2Key: text('bundle_r2_key').notNull(),
  createdAt: integer('created_at').default(sql`(unixepoch())`)
}, (t) => ({ certIdx: index('idx_seb_cert').on(t.certId) }));
```

Retention: snapshots are append-only history (the product IS *performance history* — `yanez-bittensor-trust-monetization-2026-09-06.md:25`); a sweep cron (pattern: `api/cron/sweep-*`) prunes only `source_tier=3` rows past 90 days. Tier-1 rows are never auto-pruned.

## 6. Service integration points

New service module `homeport/src/lib/services/subnet-performance/` mirroring the yanez module shape (`service.ts` + `types.ts` + `index.ts` — `homeport/src/lib/services/yanez/`): `service.ts` (run lifecycle, decoding, digest), `adapters/` (T2 plugs), `queue-handler.ts`-style inline consumer if batched, `types.ts`.

### 6.1 Certifier (primary consumer)

- **Input, not replacement.** Wilson-CI trial scoring stays the certificate's capability score (`homeport/src/lib/services/certifier/service.ts:41-62` `wilsonCI`, `:73` `grade`; harvest cite `04-homeport-gap.md:70`). Subnet performance is **additive evidence**: at `completeJob` (`service.ts:329`), when the agent has an active binding (§4.3) and a fresh bundle, the VC gains a `subnetPerformance` evidence section inside `credentialSubject` (VC build at `service.ts:410-436`; existing subject fields `score/grade/ci95/n_trials/by_topic` untouched):

```json
"subnetPerformance": {
  "netuid": 34,
  "window": { "start_block": 7100000, "end_block": 7143200 },
  "spec_version": 441,
  "emission_rank": { "latest": 12, "median": 14, "samples": 180 },
  "validator_trust": { "latest": 0.91, "min": 0.84 },
  "evidence_bundle_sha256": "…",
  "evidence_uri": "https://<node>/credentials/evidence/<bundleId>",
  "verification": "re-derive from Subtensor finalized state at cited blocks; verify node Ed25519 proof offline"
}
```

- The existing HMAC internal-integrity signature (`service.ts:153` `signCertHMAC`, `:398`) and Ed25519 VC proof (`service.ts:438` `buildVCProof`) cover the extended subject **unchanged** — the bundle digest rides inside the signed canonical JSON, so tampering with evidence breaks the proof.
- StatusList2021 revocation (`04-homeport-gap.md:28`; `schema.ts:121-137` `cert_revocations`) applies to subnet-evidence certificates as to any other; a revoked binding (§5 `revokedAt`) triggers the certifier's existing cascading-revocation path (`homeport/src/lib/services/certifier/revocation.ts`, 204 lines — `04-homeport-gap.md:47`).
- **Staleness gate:** a bundle older than `SUBNET_EVIDENCE_MAX_AGE_DAYS` (config, default 7) is refused at issuance with `subnet_evidence_stale` — the certificate may still issue *without* the section (capability score stands alone), fail-loud logged; never issue with stale evidence silently embedded.

### 6.2 Offline-verifiable anchor (the M1 exit criterion)

`train-seed-yanez-bittensor-1.0.json:32` requires the certificate to *"verify offline"*. Mechanism:
1. The VC carries `evidence_bundle_sha256` + cited `block_hash`es + `spec_version`.
2. Public route `GET /credentials/evidence/<bundleId>` serves the canonical bundle JSON (public-safe: chain-derived data only, no operator secrets) alongside the node's Ed25519 proof — mirroring the existing public credential-status surface (`/credentials/status/:id`, `homeport/docs/CERTIFICATION_COMPLIANCE.md` §Domain map) and key history at `/.well-known/keys/[version]` (`04-homeport-gap.md:30`).
3. An offline verifier: (a) checks the Ed25519 proof against the node's published key (Web Crypto, no node contact needed beyond the one-time fetch), (b) recomputes the bundle sha256, (c) optionally re-derives any snapshot from a public Subtensor RPC at the cited finalized block. Steps (a)+(b) are fully offline; (c) is independent corroboration. This answers the portability caveat *"no anchor independent of the node federation"* (`04-homeport-gap.md:73`) — the anchor is the chain itself.

### 6.3 Digest canonicalization

Bundle sha256 = sha256 over canonical JSON (sorted keys, UTF-8, no whitespace) of `{netuid, spec_version, window, snapshots:[{hotkey, block_number, block_hash, by-name fields…}]}` — the same byte-exact canonicalization discipline Homeport already applies to delegation grants (*"byte-exact SHA-256 canonicalization"*, `04-homeport-gap.md:43`). Field names in the canonical form are the **metadata-resolved variant/field names** (C2), so the digest is stable across index renumbering.

### 6.4 Reputation / trust score (secondary consumer)

- `trust-score-api.ts` today combines `local_reputation` + `federated_reputation` → `combined_reputation` with `peer_count`/`confidence` (`homeport/src/lib/services/trust/trust-score-api.ts:22-100`; harvest cite `04-homeport-gap.md:71`). Add an optional `subnet_reputation` block to `TrustScoreEntry`: emission-rank stability + validator-trust trajectory computed from snapshots, surfaced **separately** — never folded into `combined_reputation` silently (a federation score and a chain score are different measurands; mixing them without a decided weighting would be hidden behavior).
- Observer reputation snapshots (`schema.ts:217-237` `reputation_snapshots`; `04-homeport-gap.md:50`) gain no schema change in v1; the subnet signal is exposed via the trust API and the certificate, and a later revision may feed `computeTrustBadge` inputs (`trust-score-api.ts:80-86`) once weighting is an operator decision.
- MCP/A2A exposure: one new MCP tool `nanda_get_subnet_performance` (pattern: the 21-tool registry `homeport/src/lib/mcp/tools.ts:20-296`, `04-homeport-gap.md:39`) and one A2A action `subnet.performance` (pattern: `payment.rates|balance|convert` in `homeport/src/lib/services/a2a.ts:170-433`, `04-homeport-gap.md:35`). Both read-only.

### 6.5 Scheduling + operator toggle

- Cron route `POST /api/cron/subnet-sync` (lane D `requireCronAuth`, `auth-lanes.ts:11`), hourly alongside existing crons (`wrangler.jsonc:44`), walking enabled `subnet_nodes` rows.
- Node-settings toggle `subnetPerformanceEnabled`, **off by default**, owner-controlled in admin settings — exact mirror of `yanezEnabled` (`homeport/src/lib/services/node-settings/service.ts:31-36`; operator opt-in note `04-homeport-gap.md:77`).

## 7. Failure & retry semantics

Classified, loud, never silent (house law; the certifier's own fail-loud posture at `service.ts:357`, `:396`).

| Class | Trigger | Terminal? | Action |
| :-- | :-- | :-- | :-- |
| `spec_version_below_pin` | C1 gate: `specVersion < 441` | **Terminal for the run** | Run → `failed`; alert log; no snapshots written; certification proceeds without the evidence section (§6.1 staleness path) |
| `beta_basket_seed_in_progress` | C3: by-name-resolved `BetaBasketSeedInProgress` from chain | **Retryable, never terminal** | Exponential backoff (base 30 s, ×2, cap 15 min, max 5 attempts per run window — mirrors the 5× retry convention of the cert queue, `homeport/src/lib/services/certifier/queue-handler.ts:1-13`); run → `pending_retry`; NEVER fails a cert job |
| `rpc_unreachable` / `rpc_timeout` | T1 transport | Retryable | Same backoff ladder; after max attempts run → `failed` with class; next cron tick starts a fresh run from the persisted cursor (no data loss — cursor only advances on `complete`) |
| `decode_unknown_variant` | C2: event/error name absent from fetched metadata (chain upgraded past connector's knowledge) | **Terminal for the run, fail-loud** | Run → `failed`; this is the "needs a code update" signal; snapshots already written at earlier blocks stand (each is digest-pinned to its own `spec_version`) |
| `decode_metadata_mismatch` | Metadata fetch fails or pallet `SubtensorModule` missing | Terminal for the run | As above; never fall back to cached metadata from a *different* `spec_version` |
| `binding_unverified` | Evidence requested for an agent with no active hotkey binding (§4.3) | Terminal for the request | Refuse the attach; cert issues without the section |
| `subnet_evidence_stale` | Bundle older than max-age at issuance (§6.1) | Terminal for the attach | Cert issues without the section; loud log |
| `ssrf_guard_rejected` | Admin-configured RPC URL fails the guard (§8) | Terminal for the config write | Refuse the row; admin error |

Idempotency: the `idx_sps_idem` unique index (§5) makes re-sync of the same `(node, hotkey, block)` a no-op — safe retries at every layer, the same discipline as the cert queue's *"checks for existing trial_results before INSERT to support safe retries"* (`queue-handler.ts:10-13`).

## 8. Security considerations

- **Read-only chain posture.** The connector holds no keys, signs no extrinsics, custodies nothing. No TAO/Alpha/stablecoin movement anywhere in this feature (payment rails are TRUSTIP-44/42 scope, parked — §3 C5; Homeport's rail gap is documented at `04-homeport-gap.md:91`).
- **SSRF guard on `chain_rpcUrl`.** Admin-only write; URL must be `https:`, host must not resolve to private/link-local ranges at write time and at fetch time (Workers `fetch` with an explicit allowlist check in `service.ts`); fail-loud refusal `ssrf_guard_rejected`. The Yanez service's fail-loud base-URL check is the in-repo precedent (`homeport/src/lib/services/yanez/service.ts:82` `publicBase` — *"Fail loud: an empty/relative base would mint an unreachable callback URL"*).
- **Secrets discipline.** No new secret is required for T1 (public RPC). If an operator uses an authenticated RPC, the key resolves through the existing `resolveSecret` + `kvFallback` + Secrets Store path (`certifier/service.ts:390-396`; `homeport/docs/CERTIFICATION_COMPLIANCE.md` §Credentials and keys) — never a D1 column, never `raw_json`.
- **Untrusted-input decoding.** Chain bytes and adapter payloads are parsed with strict schemas (zod-class validation at the boundary); unknown fields are dropped from typed columns but preserved in `raw_json` for audit; no `eval`-class parsing of SCALE by hand — use a maintained SCALE/metadata library (adopt-don't-invent posture, `yanez-bittensor-trust-monetization-2026-09-06.md:96`).
- **Evidence integrity.** Every certificate-bearing byte is inside the sha256-committed bundle and covered by the node's Ed25519 VC proof (§6.2-6.3); R2 blobs are write-once under run-scoped keys (pattern: `trial_results.evidence_r2_key`, `schema.ts:82-103`).
- **Public-safe source (C4).** No customer data, no Nexartis deployment specifics, no private subnet endpoints in source or fixtures; fixtures use synthetic metadata (§10).
- **Abuse surface.** The public evidence route is rate-limited like other public registry routes and serves only chain-derived public data; it exposes no agent private state beyond what the VC already discloses.

## 9. Retry/backoff summary (normative)

1. Per-run attempts cap: 5 (queue convention, `queue-handler.ts:10-13`).
2. Backoff: 30 s base, ×2, 15 min cap; `pending_retry` runs are picked up by the next cron tick, in-run backoff only while the cron budget allows (Workers CPU limits — long waits resume next tick from the persisted cursor).
3. `BetaBasketSeedInProgress` retries never count toward cert-job failure budget (C3).
4. Cursor advances only on `complete` — at-least-once ingestion, deduped by `idx_sps_idem`.

## 10. Test plan

Vitest unit + Playwright E2E per the repo's testing standard (`homeport/docs/TESTING.md`; script contract `test:unit`/`test:e2e`/`validate`).

| # | Test | Constraint proven |
| :- | :-- | :-- |
| T1 | **V441 metadata fixture decode:** synthetic runtime metadata with `RootClaimed` at index **115** and error `BetaBasketSeedInProgress` at index **157**; decoder resolves both by name; assert zero numeric-index literals in decoder source (lint rule / grep test) | C2 |
| T2 | **Pre-441 regression fixture:** synthetic metadata with `RootClaimed` at 114 + `TooManyRootClaimHotkeys` at 157; by-name decode still correct; index-keyed snapshot of the *same bytes* would misread — assert the by-name path never consults indices | C2 (the silent-meaning-change trap, `yanez-bittensor-trust-monetization-2026-09-06.md:214`) |
| T3 | **spec_version pin:** mocked `state_getRuntimeVersion` → 440 refuses run with `spec_version_below_pin`, writes zero snapshots; 441 and 445 pass | C1 |
| T4 | **BetaBasketSeedInProgress retry:** injected error → run goes `pending_retry`, backoff scheduled, 5th attempt exhausts to `failed` with the retryable class recorded, and a linked cert job is **unaffected** | C3 |
| T5 | **decode_unknown_variant:** metadata without an expected variant name → terminal fail-loud, no partial snapshots | C2 |
| T6 | **Idempotent re-sync:** same window synced twice → unique-index no-op, cursor stable | §7 |
| T7 | **VC embedding + offline verify E2E:** issue a cert with the `subnetPerformance` section; verify Ed25519 proof offline (Web Crypto, no node contact); recompute bundle sha256; assert match — the M1 exit criterion (`train-seed-yanez-bittensor-1.0.json:32`) | §6.1-6.3 |
| T8 | **Stale-evidence gate:** bundle aged past max-age → cert issues without section, `subnet_evidence_stale` logged | §6.1 |
| T9 | **SSRF guard:** private-range RPC URL rejected at config write and at fetch | §8 |
| T10 | **Toggle default-off:** fresh node → `subnetPerformanceEnabled=false`, cron route no-ops | §6.5 |
| T11 | **CI parity scrub:** suites pass with ambient state scrubbed (`env -i`, empty HOME) — no desk-only state dependency | house law (green-on-your-desk-is-not-green) |
| T12 | **Public-safe audit (C4):** fixture/source scan for Nexartis-only identifiers, hardcoded netuid 34 in source paths, secrets — zero hits | C4 |

## 11. Out of scope

- **Deployment** of anything: TRUSTIP-40 owns the prod node; this lane is design-only and implementation is sequence-gated behind 40 (§3 C5; `HO-2026-09-07-yanez-impl-handover.md:25`, `:39`).
- **BitMind SN34 integration design** (Creator Rewards layer, plugin-store shelf, named SN34 contact): TRUSTIP-46 (`HO-2026-09-07-yanez-impl-handover.md:28`). This connector is the substrate that design plugs into; T2 adapter for SN34 lands with 46.
- **Payment/settlement rails** — USDC/x402, per-verification billing, splits: TRUSTIP-44/42, parked until M0 human gates clear (`yanez-bittensor-trust-monetization-2026-09-06.md:173`; `04-homeport-gap.md:91`).
- **On-chain split contract / Subtensor EVM (chain 964)** work: P3-1/TRUSTIP-31 (`yanez-bittensor-trust-monetization-2026-09-06.md:151`, `:215`).
- **TAO/Alpha custody or conversion**: P3-3 (`:153`); the never-settle-in-Alpha rule stands (`:164`).
- **KYC/AML**: P1-5/P3-4 (`:131`, `:154`).
- **Folding subnet score into `combined_reputation`/badge weighting** — an operator weighting decision, deliberately deferred (§6.4).
- **Writing to the chain** in any form (extrinsics, claims, registrations) — the connector is read-only forever in v1.

## 12. Target path (orchestrator lands)

- **Recommended:** `homeport/docs/design/TRUSTIP-45-subnet-performance-connector.md` — a new `docs/design/` subdirectory for pre-implementation design docs. Rationale: existing `homeport/docs/` files are **current-state** topic docs indexed by `PRODUCT_ARCHITECTURE.md` (`homeport/docs/PRODUCT_ARCHITECTURE.md:11-13` *"This document is the source-of-truth index… Deeper facts live in focused sub-docs"*; e.g. `CERTIFICATION_COMPLIANCE.md` header *"Current State"*), and house docs-hygiene law bans forward-facing planning files at the repo top level — a ticket-scoped design doc in a `design/` subfolder keeps the current-state docs honest until the feature ships.
- **On ship:** fold the durable facts into `docs/CERTIFICATION_COMPLIANCE.md` (domain map + a Subnet-performance row) and add the index row in `PRODUCT_ARCHITECTURE.md`, same commit (generated-twins discipline); the design doc may then be archived or kept as provenance.
- Alternative if the orchestrator prefers zero new directories: `homeport/docs/SUBNET_PERFORMANCE.md` marked *Design — pre-implementation*, accepting the mild convention bend against the current-state doc style.

## 13. Open questions for the orchestrator

1. **SCALE/metadata library choice** (adopt-don't-invent, `yanez-bittensor-trust-monetization-2026-09-06.md:96`): `@polkadot-api/*` (modern, tree-shakeable, Workers-friendly) vs `@polkadot-js/api` (heavier, battle-tested). Needs a Workers-compat spike at implementation time; this design is library-agnostic (it constrains the *strategy*: metadata-driven by-name resolution).
2. **T1 RPC source for the canonical node**: public endpoints (e.g. entrypoint rpc) vs Nexartis-run Subtensor node — a TRUSTIP-40 deployment-config decision, not a source-code one (C4).
3. **Validator-trust field semantics per subnet**: Yuma-consensus field names/availability vary by subnet runtime; the SN34-specific mapping is TRUSTIP-46 territory — v1 stores what the metadata names, and the certificate section cites only fields present at the pinned `spec_version`.
4. **`subnet_reputation` weighting** into badges/combined score: deferred operator decision (§6.4, §11) — needs a picker when evidence from the pilot exists.

---

### Citation index (corpus → claim)

| Fact | Citation |
| :-- | :-- |
| W2 scope: design only, no deploy; board rows | `nexartis-product-portfolio/docs/workspace-handoffs/yanez-bittensor-1.0/HO-2026-09-07-yanez-impl-handover.md:25-26` |
| C1/C2/C3 constraints (arch review A3) | `HO-2026-09-07-yanez-impl-handover.md:27` |
| TRUSTIP-46 adjacency; SN34 contact rides TRUSTIP-36 | `HO-2026-09-07-yanez-impl-handover.md:28` |
| C4 ADR-2026-08-09 alignment (A5) | `HO-2026-09-07-yanez-impl-handover.md:31`; `yanez-bittensor-trust-monetization-2026-09-06.md:175` |
| TRUSTIP-40 deploy-prep-only; M0 gate | `HO-2026-09-07-yanez-impl-handover.md:39` |
| C5 sequence 40→45→46-design; 42/44 parked | `yanez-bittensor-trust-monetization-2026-09-06.md:173` |
| V441 wire-format break (RootClaimed 114→115; error 157 TooManyRootClaimHotkeys→BetaBasketSeedInProgress; pin ≥441; by-name; retryable) | `yanez-bittensor-trust-monetization-2026-09-06.md:214`; `:130`; source subtensor.com/learn/whats-new/v441 |
| V441 "Root Reborn" context (~936τ/day basket yield) | `yanez-bittensor-trust-monetization-2026-09-06.md:211` |
| chain-964 EVM re-validated post-V441 (out of scope) | `yanez-bittensor-trust-monetization-2026-09-06.md:215` |
| Certification-with-evidence wedge (4 evidence legs incl. subnet performance history) | `yanez-bittensor-trust-monetization-2026-09-06.md:25` |
| Homeport ~60% there; subnet-performance ingestion missing | `yanez-bittensor-trust-monetization-2026-09-06.md:27`; `:86` |
| Value-chain row: portable evidence-backed certificate | `yanez-bittensor-trust-monetization-2026-09-06.md:188` |
| Verathos SN96 differentiation; PoH-nativization watch | `yanez-bittensor-trust-monetization-2026-09-06.md:99`; `:157` |
| Honesty gap (counter-cyclical positioning) | `yanez-bittensor-trust-monetization-2026-09-06.md:210`, `:216` |
| Adopt-don't-invent posture | `yanez-bittensor-trust-monetization-2026-09-06.md:96` |
| Never settle in Alpha / wTAO bridge (out of scope) | `yanez-bittensor-trust-monetization-2026-09-06.md:164`, `:153` |
| M1 exit criterion: certificate embeds subnet performance evidence, verifies offline | `train-seed-yanez-bittensor-1.0.json:32`; task row `:74`; TRUSTIP-40 criterion `:30` |
| Homeport = Apache-2.0 SvelteKit 2/Svelte 5 on Cloudflare Workers, D1/R2/KV, Web Crypto Ed25519 | `harvest/04-homeport-gap.md:20` |
| Portability caveat: no subnet ingestion, no independent anchor | `harvest/04-homeport-gap.md:73` |
| Capability-3 gap row: needs subnet-data connector + external verifiability, effort M | `harvest/04-homeport-gap.md:89`, `:124` |
| Certifier Wilson 95% CI + grades; VC issuance; revocation cascade | `harvest/04-homeport-gap.md:70`, `:47`, `:28` |
| Trust score API (local+federated+badges) | `harvest/04-homeport-gap.md:71` |
| Reputation endpoint/badges/snapshots | `harvest/04-homeport-gap.md:50` |
| MCP 21 tools; A2A action surface | `harvest/04-homeport-gap.md:39`, `:35` |
| Yanez sign-and-return + opt-in toggle off-by-default | `harvest/04-homeport-gap.md:76-77` |
| Byte-exact SHA-256 canonicalization precedent | `harvest/04-homeport-gap.md:43` |
| Payment rails MISSING (out of scope) | `harvest/04-homeport-gap.md:91` |
| `wilsonCI` / `grade` / `signCertHMAC` / `completeJob` / VC build / `buildVCProof` | `homeport/src/lib/services/certifier/service.ts:41`, `:73`, `:153`, `:329`, `:410-436`, `:438` |
| `cert_jobs` / `trial_results` / `certificates` / `cert_revocations` / `reputation_snapshots` schema patterns | `homeport/src/lib/db/schema.ts:68-80`, `:82-103`, `:105-119`, `:121-137`, `:217-237` |
| Trust score entry shape | `homeport/src/lib/services/trust/trust-score-api.ts:22-100` |
| Inline processing model; cron routes; lane D cron auth | `homeport/docs/CERTIFICATION_COMPLIANCE.md` §Inline processing model; `homeport/src/routes/api/cron/`; `homeport/src/lib/server/auth-lanes.ts:11`; `homeport/src/hooks.server.ts:354-376`; `homeport/wrangler.jsonc:44` |
| Cert queue idempotent-retry convention (5×) | `homeport/src/lib/services/certifier/queue-handler.ts:10-13` |
| `yanezEnabled` default-off toggle pattern | `homeport/src/lib/services/node-settings/service.ts:31-36` |
| Yanez fail-loud base-URL precedent | `homeport/src/lib/services/yanez/service.ts:82` (`publicBase`) |
| Docs index convention (source-of-truth index; current-state sub-docs) | `homeport/docs/PRODUCT_ARCHITECTURE.md:11-13` |
