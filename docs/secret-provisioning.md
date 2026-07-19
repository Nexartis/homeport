# Secret Provisioning

Homeport supports two secret provisioning paths, chosen per binding
at runtime by
[`src/lib/utils/resolve-secret.ts`](../src/lib/utils/resolve-secret.ts).
Pick one path per environment and stay consistent; runtime picks the
first source that returns a value, so a mixed configuration is hard
to reason about.

## Path 1 — Cloudflare Secrets Store bindings (recommended for prod)

Create each secret in your Cloudflare account's Secrets Store once,
then bind it into every environment in `wrangler.jsonc`. Runtime
reads the binding directly.

Do not provision by binding name alone. Two of the bindings map to
Secrets Store keys with a different name — pass the `secret_name`
explicitly when adding the binding.

| Worker binding                     | Secrets Store `secret_name`        | Purpose                                    |
| ---------------------------------- | ---------------------------------- | ------------------------------------------ |
| `KYM_NANDA_HMAC_SECRET`            | `KYM_NANDA_HMAC_SECRET`            | HMAC-SHA256 signing for internal integrity |
| `KYM_NANDA_RADIUS_SECRET`          | `KYM_NANDA_RADIUS_SECRET`          | HMAC signing for auditor receipt matching  |
| `KYM_NANDA_ED25519_PRIVATE_KEY_v1` | `KYM_NANDA_ED25519_PRIVATE_KEY_v1` | Ed25519 private key for W3C VC signing     |
| `CRON_AUTH_TOKEN`                  | `KYM_CRON_AUTH_TOKEN`              | Cron and internal endpoint authentication  |
| `NANDA_FEDERATION_ADMIN_KEY`       | `KYM_NANDA_FEDERATION_ADMIN_KEY`   | Federation peer management                 |

Pre-deploy checklist:

1. Every `secret_name` above exists in your Secrets Store.
2. `wrangler.jsonc` binds each name in every environment you deploy.
3. After `pnpm run deploy:<env>`, `GET /health?probe=secrets` on the
   deployed hostname reports each binding as `resolved`.

## Path 2 — KV-backed node secrets (self-hosters, small deployments)

If you do not want to provision Secrets Store, Homeport can hold the
same values in KV. This is the path the operator UI uses when you
bootstrap keys through `/admin/keys` on a fresh node.

- Values are written to the `NANDA_NODE_CACHE` KV namespace under a
  `__node_secrets:` prefix.
- No `generate` metadata lives in the checked-in `cube.jsonc` /
  `wrangler.jsonc`; the operator is responsible for generating keys
  and posting them through `/admin/keys` (Ed25519 is generated
  in-browser via Web Crypto).
- The Secrets Store binding takes precedence when both are present,
  so leave the binding unbound in `wrangler.jsonc` if you want to
  force the KV path.

| Worker binding                     | KV key                                  | Purpose                                    |
| ---------------------------------- | --------------------------------------- | ------------------------------------------ |
| `KYM_NANDA_HMAC_SECRET`            | `__node_secrets:hmac_secret`            | HMAC-SHA256 signing for internal integrity |
| `KYM_NANDA_RADIUS_SECRET`          | `__node_secrets:radius_secret`          | HMAC signing for auditor receipt matching  |
| `KYM_NANDA_ED25519_PRIVATE_KEY_v1` | `__node_secrets:ed25519_private_key_v1` | Ed25519 private key for W3C VC signing     |
| `CRON_AUTH_TOKEN`                  | `__node_secrets:cron_auth_token`        | Cron endpoint authentication               |
| `NANDA_FEDERATION_ADMIN_KEY`       | `__node_secrets:federation_admin_key`   | Federation peer management                 |

## Rotation

- HMAC / RADIUS / cron / federation keys: rotate by writing a new
  value (Secrets Store or `/admin/keys`), then redeploy.
- Ed25519 signing key: rotate by generating a new keypair, adding it
  as the next version under
  `/.well-known/keys/[version]`, and updating the active version
  binding. Old versions remain resolvable so previously issued
  credentials still verify.

## Resource IDs and the `__PEGASUS_PROVISION__` sentinel

The template `wrangler.jsonc` and `cube.jsonc` also use
`__PEGASUS_PROVISION__` for the non-secret resource IDs that a
deploy needs. Replace each before your first `wrangler deploy`:

- `d1_databases[].database_id` — output of `wrangler d1 create`.
- `kv_namespaces[].id` — output of `wrangler kv namespace create`.
- `secrets_store_secrets[].store_id` — your account's Secrets Store
  ID (`wrangler secrets-store store list`).
- Any Durable Object namespace ID declared in `cube.jsonc` — from
  the Cloudflare dashboard once the DO class is bound.
- `vars` such as `NANDA_REGISTRY_URL`, `VITE_BASE_URL`,
  `SITE_OWNER_EMAIL`, `FROM_EMAIL`, `NANDA_NODE_ID`, and the
  Ed25519 public key.

`pnpm run setup` provisions these values against your account and
prints the IDs to paste in. The two secret-material paths above
cover the `secrets_store_secrets[].secret_name` bindings.

## Never commit

- Cloudflare account IDs, D1/KV/R2 IDs, and Secrets Store IDs.
- Any raw secret material (HMAC keys, Ed25519 private keys, cron
  tokens, federation admin keys).
- `.dev.vars` — the file is `.gitignore`d for operator-only local
  overrides.
