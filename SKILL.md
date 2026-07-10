# NANDA Delegated Admission — Human-Anchored Delegation Grants

> **Skill name:** `nanda-delegated-admission`
> **One line:** Grant, verify, and cascade-revoke agent delegations that
> chain back to a human principal — an agent's authority only counts if
> a human said it could act.
> **Base URL:** `https://nexartisnandahacksquad.link`
> **Tags:** `trust` `delegation` `revocation` `cascade` `proof-of-human`
> `yanez` `ed25519` `verifiable-admission` `nanda` `a2a`

## What this skill does

Most agent "trust" is bookkeeping between software processes: any
process can mint an identity and start emitting claims. This skill is a
**delegation authority anchored to a human principal**. A biometric
principal (Yanez proof-of-human) grants an agent a scoped, expiring
delegation. Agents may re-delegate down a chain — but only narrower
(scope can shrink, never grow; expiry can shorten, never extend). Any
grant can be revoked, and **revocation cascades**: kill a mid-chain
grant and every descendant grant dies with it, up to 32 hops.

Every grant is bound by a canonical SHA-256 proof hash to *exactly* the
scope, grantee, expiry, and parent it was issued for. Change one byte —
one tool name, one second of TTL — and the hash breaks and the grant is
refused.

This is **production code, not a hackathon mock**: the same service
runs on 28 live NANDA nodes deployed via CubiCube. The deterministic
Python port of this exact verification logic is our NandaHack Phase 2
submission to `projnanda/nandatown` (trust-layer plugin
`delegated_admission`), with byte-parity fixtures generated from this
service.

## Live endpoints

Discovery and health (no auth):

```
GET  https://nexartisnandahacksquad.link/health
GET  https://nexartisnandahacksquad.link/.well-known/agent-card.json
GET  https://nexartisnandahacksquad.link/.well-known/nanda-index
GET  https://nexartisnandahacksquad.link/.well-known/keys/ed25519-v1
```

Delegation actions (JSON-RPC 2.0 over A2A, **auth required** — see
below):

```
POST https://nexartisnandahacksquad.link/a2a    (delegation.grant)
POST https://nexartisnandahacksquad.link/a2a    (delegation.check)
POST https://nexartisnandahacksquad.link/a2a    (delegation.revoke)
```

## Authentication

Delegation actions mint and revoke authority, so they are never
anonymous (try it — an unauthenticated call returns JSON-RPC `-32001
"Authentication required for delegation.*"`; that refusal is itself the
security model working).

Send an API key with every delegation call:

```
Authorization: Bearer nanda_<your-api-key>
```

Hackathon evaluators and agents: **generate your own free-tier key in
under a minute** at
[nexartisnandahacksquad.link/developers/dashboard](https://nexartisnandahacksquad.link/developers/dashboard)
(sign up, click Generate, copy the raw `nanda_...` value once). Free
tier is least-privilege by default (1,000 requests/month, five keys) —
the same posture as our demo key. Grants are authorized per-identity:
you may grant only as yourself (`granted_by_did` must match your
authenticated identity), check only grants you issued or received, and
revoke only grants you issued — unless your key carries `operator` or
`admin` scope.

## How to use it

### Step 0 — confirm the node is alive

```bash
curl https://nexartisnandahacksquad.link/health
# → {"status":"ok", ...}
```

### Step 1 — compute the canonical proof hash

The grant must carry `granted_by_proof_hash` = SHA-256 (lowercase hex)
of this exact JSON envelope — **field order fixed, no whitespace,
`toolNames` trimmed, deduplicated of empties, and sorted**:

```json
{"principalPk":"<principal>","deviceDid":"<device-did>","requestId":"<request-id>","grantee":"<delegate-id>","scope":{"toolNames":["tool.a","tool.b"]},"expiresAt":<unix-seconds>,"parentDelegationId":null,"revocable":true,"issuedAt":<unix-milliseconds>}
```

Python reference:

```python
import hashlib, json

def proof_hash(proof, subject):
    tool_names = sorted(
        s.strip() for s in subject["grantedScope"]
        if isinstance(s, str) and s.strip()
    )
    envelope = {  # insertion order matters — do NOT sort keys
        "principalPk": proof["principalPk"],
        "deviceDid": proof["deviceDid"],
        "requestId": proof["requestId"],
        "grantee": subject["delegateId"],
        "scope": {"toolNames": tool_names},
        "expiresAt": subject["expiresAt"],            # unix SECONDS
        "parentDelegationId": subject["parentDelegationId"],  # null if none
        "revocable": subject["revocable"],
        "issuedAt": proof["issuedAt"],                # unix MILLISECONDS
    }
    canonical = json.dumps(envelope, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
```

Freshness rules: `boundAt` and `issuedAt` (both unix **milliseconds**)
must be within **5 minutes** of server time, with 30 s clock-skew
allowance. `expiresAt` is unix **seconds** and must be in the future.

### Step 2 — grant a delegation

```bash
curl -X POST https://nexartisnandahacksquad.link/a2a \
  -H "Authorization: Bearer nanda_<key>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0", "method": "message/send", "id": "1",
    "params": { "message": { "role": "user", "parts": [{ "text":
      "{\"action\":\"delegation.grant\",\"granted_by_did\":\"<your-id>\",\"granted_to_did\":\"agent-worker-7\",\"granted_scope\":[\"tool.echo\",\"tool.summarize\"],\"expires_at\":1794000000,\"revocable\":true,\"parent_delegation_id\":null,\"granted_by_proof_hash\":\"<sha256-hex-from-step-1>\",\"proof\":{\"principalPk\":\"<principal>\",\"deviceDid\":\"did:key:z6Mkdevice\",\"requestId\":\"<request-id>\",\"boundAt\":1794000000000,\"issuedAt\":1794000000500}}"
    }]}}
  }'
```

Success:

```json
{"jsonrpc":"2.0","result":{"role":"agent","parts":[{"text":
  "{\"delegationId\":\"del-abc123\",\"kymVcId\":null,\"expiresAt\":1794000000}"}]},"id":"1"}
```

To re-delegate, pass the parent's id as `parent_delegation_id`. The
server enforces **chain-narrowing**: child scope must be a subset of
the parent's, child expiry must not exceed the parent's, and a
revocable parent cannot spawn a non-revocable child.

### Step 3 — check a delegation (do this before trusting an agent)

```bash
curl -X POST https://nexartisnandahacksquad.link/a2a \
  -H "Authorization: Bearer nanda_<key>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0", "method": "message/send", "id": "2",
    "params": { "message": { "role": "user", "parts": [{ "text":
      "{\"action\":\"delegation.check\",\"delegation_id\":\"del-abc123\"}"
    }]}}
  }'
```

Response (inner payload shown unwrapped for readability — on the wire
it arrives inside the same JSON-RPC `result.parts[0].text` envelope as
the grant response above):

```json
{"valid":true,"revoked":false,"expired":false,"expiresAt":1794000000,
 "credentialSubject":{"grantedByDid":"<your-id>",
   "grantedToDid":"agent-worker-7","scope":["tool.echo","tool.summarize"]}}
```

`check` walks the **entire ancestor chain** (up to 32 hops): if any
ancestor is revoked, this grant reports `revoked`; if any ancestor has
expired, this grant reports `expired` with the narrowed expiry. A child
can never outlive or out-rank its parent.

### Step 4 — revoke (and watch the cascade)

```bash
curl -X POST https://nexartisnandahacksquad.link/a2a \
  -H "Authorization: Bearer nanda_<key>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0", "method": "message/send", "id": "3",
    "params": { "message": { "role": "user", "parts": [{ "text":
      "{\"action\":\"delegation.revoke\",\"delegation_id\":\"del-abc123\",\"reason\":\"operator recall\"}"
    }]}}
  }'
```

Response (unwrapped, as above):

```json
{"revoked":true,"revokedAt":1794000123,
 "cascadedIds":["del-child-1","del-grandchild-4"]}
```

Every descendant in `cascadedIds` is now dead. Re-checking any of them
returns `valid:false, revoked:true`. Revocation is idempotent.

## Error codes

HTTP 400 with a JSON-RPC error object. `message` is prefixed with a
stable machine-readable code:

| Code | Meaning |
| --- | --- |
| `-32001` | Auth required / not your grant / `not-found` / `not-revocable` |
| `-32602` | Validation: `missing-scope`, `already-expired`, `missing-proof`, `invalid-proof`, `puh-proof-stale`, `proof-hash-mismatch`, `parent-revoked`, `scope-widens-parent`, `ttl-widens-parent`, `revocable-flip-forbidden`, … |
| `-32000` | Anything else |

The interesting ones are the attacks this service refuses by
construction: widen your scope after the proof was hashed →
`proof-hash-mismatch`; replay a stale proof → `puh-proof-stale`; try to
grant broader authority than your parent grant → `scope-widens-parent`.

## Provenance

- Server: **Homeport**, the Nexartis open-source NANDA node
  (Apache-2.0) — https://github.com/Nexartis/homeport. Delegation
  logic in `src/lib/server/delegation-grants.ts`, exercised by
  `tests/delegation-grants.test.ts`; the delegation module is public
  today and the node's full source lands in the same repo within a
  week of the hackathon (code review + cleanup in progress).
- Fleet: 28 live NANDA nodes deployed via CubiCube; this endpoint is
  one of them.
- Human anchor: the `proof` envelope carries a Yanez biometric
  principal (`principalPk`) and preapproval `requestId` — the same
  proof-of-human ceremony that gates payments in our stack gates
  delegation minting.
- NandaHack Phase 2: deterministic Python port of this verifier as the
  `delegated_admission` trust plugin for `projnanda/nandatown`, with
  adversarial validators that fail on the baseline trust plugin and
  pass on ours, under the same scenario.

Operated by the Nexartis NandaHack squad.
