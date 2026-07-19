# Operations

This document owns the install, build, deploy, environment, binding,
secret, and observability information a self-hoster needs to run
Homeport on their own Cloudflare account.

## Local setup

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Requirements:

- Node.js >= 20
- pnpm 10 (the repo pins `pnpm@10.28.1` via `packageManager`)
- [`wrangler`](https://developers.cloudflare.com/workers/wrangler/)
  authenticated to your Cloudflare account for any remote
  operation (deploys, log tailing, D1/R2/KV admin).

The test suite uses Miniflare through
`@cloudflare/vitest-pool-workers` and reads its worker bindings
from `wrangler.jsonc`. No `.env.example` is required for the
default local validation path. Keep `.dev.vars` untracked — it is
`.gitignore`d for operator-only local overrides.

## Validation command matrix

| Command             | Purpose                               | Notes                                            |
| ------------------- | ------------------------------------- | ------------------------------------------------ |
| `pnpm run check`    | SvelteKit sync and Svelte/type checks | Non-mutating.                                    |
| `pnpm run lint`     | Prettier check                        | Non-mutating.                                    |
| `pnpm run test`     | Vitest with Cloudflare/miniflare pool | `pretest` builds and injects worker shims first. |
| `pnpm run build`    | Cloudflare worker build               | Runs Vite build and inject scripts.              |
| `pnpm run validate` | Composite validation gate             | Runs `lint`, `check`, and `test`.                |

## Cloudflare resources

Each node owns its own D1 database, R2 bucket, and KV namespace. The
default template `wrangler.jsonc` declares environments (`dev` and
`prod`); create the resources under your own Cloudflare account,
paste the returned IDs into your local `wrangler.jsonc` (or a
private overlay), and deploy.

| Binding              | Type   | Purpose                                 |
| -------------------- | ------ | --------------------------------------- |
| `DB`                 | D1     | Primary database (all service domains). |
| `KYM_NANDA_EVIDENCE` | R2     | Evidence artifacts for certification.   |
| `NANDA_NODE_CACHE`   | KV     | Response caching, rate-limit counters,  |
|                      |        | and (in KV-secret mode) node secrets.   |
| `ASSETS`             | Assets | SvelteKit built static assets.          |

Create them with:

```bash
wrangler d1 create <your-node>-db
wrangler r2 bucket create <your-node>-evidence
wrangler kv namespace create <your-node>-cache
```

Cron: the node ships an hourly scheduled trigger (`0 * * * *`) for
observer probes, certification workers, and webhook delivery. The
`postbuild` step injects the `scheduled()` handler into the
Cloudflare worker output.

## Secrets

Homeport supports two secret provisioning paths and picks
per-binding at runtime through
[`src/lib/utils/resolve-secret.ts`](../src/lib/utils/resolve-secret.ts).

- **Cloudflare Secrets Store bindings** — production-grade path;
  each `secret_name` is created once in your account's Secrets Store
  and bound into every environment.
- **KV fallback** — bootstrapped from the operator UI at
  `/admin/keys`, stored under `__node_secrets:` in
  `NANDA_NODE_CACHE`. Suitable for self-hosters who don't want to
  provision Secrets Store.

Bindings and required key names:

| Binding                            | Purpose                                 |
| ---------------------------------- | --------------------------------------- |
| `KYM_NANDA_HMAC_SECRET`            | HMAC-SHA256 for internal integrity.     |
| `KYM_NANDA_RADIUS_SECRET`          | HMAC for auditor receipt matching.      |
| `KYM_NANDA_ED25519_PRIVATE_KEY_v1` | Ed25519 private key for W3C VC signing. |
| `CRON_AUTH_TOKEN`                  | Cron and internal endpoint auth.        |
| `NANDA_FEDERATION_ADMIN_KEY`       | Federation peer management.             |

See [`secret-provisioning.md`](secret-provisioning.md) for the full
provisioning checklist and the `secret_name` mapping used by the
Secrets Store path.

## Provisioning placeholders

The template `wrangler.jsonc` and `cube.jsonc` ship every operator-
specific value as the sentinel string `__PEGASUS_PROVISION__`. It
marks the fields you must fill in before a real deploy:

- D1 `database_id`
- KV namespace `id`
- Durable Object namespace and Secrets Store `store_id`
- Environment `vars` such as `NANDA_REGISTRY_URL`, `VITE_BASE_URL`,
  `SITE_OWNER_EMAIL`, `FROM_EMAIL`, `NANDA_NODE_ID`, and the
  Ed25519 public key.

`pnpm run setup` walks through each placeholder class and
[`docs/secret-provisioning.md`](secret-provisioning.md) documents
the Secrets Store and KV-fallback paths for the secret bindings.

## Deploy

Use the package scripts — they wrap `wrangler deploy` with the
right environment name so the pre-build steps run first:

```bash
pnpm run deploy:dev
pnpm run deploy:prod
```

After a deploy, hit `/health` on the deployed hostname to confirm
the node is up and bindings resolve:

```bash
curl https://<your-node-host>/health
```

Rollback today is Wrangler/Cloudflare-dashboard based — redeploy the
previous git ref or use the Cloudflare Workers version history.

## Observability

Wrangler observability is enabled with source-map upload. The node
exposes `/health` (public), `/stats` (public), and admin telemetry
under `/admin/*`. Dashboards, alert routing, and rollback runbooks
are operator responsibilities — pick names and thresholds that
match your Cloudflare tenancy.

## Package-manager notes

- All runtime and dev dependencies resolve from the public npm
  registry; `.npmrc` is clean and unauthenticated `pnpm install`
  works out of the box.
- `pnpm install --frozen-lockfile` reports ignored build scripts for
  packages such as `esbuild`, `sharp`, and `@scarf/scarf`. Do not
  run `pnpm approve-builds` without reviewing the package list.
- Local high/critical audit status: `pnpm audit --audit-level high`.
