# Visibility Lifecycle — Current State

## Responsibility

This document is the canonical contract for agent visibility and the
metadata descriptors that travel with a registration (Set C wire
contract v1). It owns the four visibility states, the discovery matrix
each state participates in, and the shapes of the capability manifest,
MCP metadata, and pricing descriptors. The TypeScript source of truth is
`src/lib/types/agent-visibility.ts`. Registry surface behavior lives in
[`REGISTRY_DISCOVERY.md`](REGISTRY_DISCOVERY.md); federation transport
lives in [`FEDERATION_RESOLUTION.md`](FEDERATION_RESOLUTION.md).

## The four states

`visibility` is one of four string literals (`AGENT_VISIBILITIES`):

| State      | Meaning                                                               |
| ---------- | --------------------------------------------------------------------- |
| `private`  | Not discoverable; direct lookup returns 404; never federated.         |
| `unlisted` | Resolvable by direct lookup but hidden from search, list, and gossip. |
| `public`   | Discoverable everywhere. This is the default.                         |
| `for_hire` | Discoverable everywhere and flagged as commercially available.        |

The discoverable set is exactly `public` and `for_hire`
(`DISCOVERABLE_VISIBILITIES`).

## Discovery matrix

| Surface                    | private | unlisted | public | for_hire |
| -------------------------- | ------- | -------- | ------ | -------- |
| `/search`, `/list`         | —       | —        | yes    | yes      |
| `/lookup/:id`              | 404     | yes      | yes    | yes      |
| Federation gossip (deltas) | —       | —        | yes    | yes      |
| SafeSearch                 | —       | —        | yes    | yes      |

- Search and list filter at the repository layer with
  `visibility IN ('public', 'for_hire')`.
- Lookup serves `public`, `unlisted`, and `for_hire`, and returns 404
  for `private`.
- Federation gossip propagates only discoverable rows, and the CRDT
  merge engine rejects inbound deltas whose visibility is not
  discoverable — a `private` or `unlisted` row can never enter a node
  through gossip.
- SafeSearch applies the same discoverable filter alongside its existing
  `status = 'alive'` requirement.

## Metadata descriptors

Three optional descriptors travel with a registration. Each is stored as
JSON text and validated on write before being persisted.

### PricingDescriptor

| Field      | Type   | Notes                                                           |
| ---------- | ------ | --------------------------------------------------------------- |
| `model`    | enum   | Required. `free` \| `per_request` \| `subscription` \| `usage`. |
| `currency` | string | Optional.                                                       |
| `price`    | number | Optional.                                                       |
| `unit`     | string | Optional.                                                       |

### CapabilityManifestEntry

`capability_manifest` is a JSON array of these entries.

| Field         | Type   | Notes                                                              |
| ------------- | ------ | ------------------------------------------------------------------ |
| `id`          | string | Required, non-empty.                                               |
| `name`        | string | Optional.                                                          |
| `description` | string | Optional.                                                          |
| `auth`        | enum   | Optional. `none` \| `bearer` \| `oauth2` \| `api_key` \| `custom`. |
| `pricing`     | object | Optional `PricingDescriptor`.                                      |

### McpMetadata

| Field            | Type   | Notes                                                                                                                            |
| ---------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `endpoint`       | string | Optional.                                                                                                                        |
| `transport`      | enum   | Optional. `streamable-http` \| `sse` \| `stdio`.                                                                                 |
| `authentication` | enum   | Optional. Same auth enum as capabilities.                                                                                        |
| `tools`          | array  | Optional. Each tool: `name` (required, non-empty), `description`?, `auth_required`? (boolean), `pricing`? (`PricingDescriptor`). |

## Wire contract (snake_case)

The REST surface uses snake_case field names:

- `visibility` — `'private' | 'unlisted' | 'public' | 'for_hire'`
- `capability_manifest` — JSON array of `CapabilityManifestEntry`
- `mcp_metadata` — `McpMetadata` object
- `pricing` — `PricingDescriptor` object

## Storage and defaults

Migration `drizzle/migrations/0007_agent_visibility_metadata.sql` adds
four columns to `agent_addrs`:

- `visibility` — `text DEFAULT 'public' NOT NULL`
- `capability_manifest` — nullable `text` (JSON)
- `mcp_metadata` — nullable `text` (JSON)
- `pricing` — nullable `text` (JSON)

It also creates `idx_agent_addrs_visibility` on `visibility`. The
storage default is `'public'`; a NULL or missing visibility is
normalized to `'public'` on read (`normalizeVisibility`).

## What this does not touch

AgentFacts VC shapes and `src/lib/protocol-constants.ts` are unchanged.
Visibility is a registry/federation discovery concern and does not alter
the signed AgentAddr or Verifiable Credential envelopes.
