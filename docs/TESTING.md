# Testing and Validation

## Overview

Homeport's local validation is package-script based: install,
ESLint (semantic-only) lint, Svelte/type check, Vitest/miniflare
tests, public Playwright smoke, and (when Cloudflare credentials
are available) a dev deploy — with `pnpm run validate` as the
canonical composite gate. Formatting is a manual diagnostic
(`pnpm run format` / `pnpm run format:check`) and is never
gate-enforced. Authenticated browser E2E requires an
operator-supplied saved auth state.

## Test layers

| Layer                     | Current state                                                                                                                     | Command                          |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Install                   | pnpm lockfile pinned; frozen install for reproducible builds.                                                                     | `pnpm install --frozen-lockfile` |
| Lint                      | ESLint (semantic only).                                                                                                           | `pnpm run lint`                  |
| Formatting                | Prettier check — manual diagnostic only; not part of the validation gate.                                                         | `pnpm run format:check`          |
| Type/Svelte checks        | SvelteKit sync plus `svelte-check`.                                                                                               | `pnpm run check`                 |
| Unit / integration        | Vitest with Cloudflare/miniflare pool across service, route, MCP, auth-lane, billing, federation, and orchestration tests.        | `pnpm run test`                  |
| Build                     | Vite / SvelteKit Cloudflare build plus cache and scheduled-handler injection; also runs via `pretest` before `pnpm run test`.     | `pnpm run build`                 |
| Public browser E2E        | Playwright smoke covering public pages, docs, health contract, CTAs, landmarks, and keyboard focus.                               | `pnpm run test:e2e`              |
| Authenticated browser E2E | Not configured out of the box; operators supply a saved auth state (`playwright.storageState.json`) for admin/developer journeys. | Operator-supplied.               |
| Dev deploy                | Requires Cloudflare credentials and provisioned D1/R2/KV.                                                                         | `pnpm run deploy:dev`            |
| Prod deploy               | Runs after full validation.                                                                                                       | `pnpm run deploy:prod`           |

## Recommended validation order

1. `pnpm install --frozen-lockfile`
2. `pnpm run lint`
3. `pnpm run check`
4. `pnpm run test` (builds first via `pretest`)
5. `pnpm run test:e2e`
6. `pnpm run deploy:dev` (when safe and credentials are available;
   runs its own build)
7. Smoke checks against `/`, `/health`, `/stats`, and representative
   public routes.

`pnpm test` already builds the worker via `pretest`; a separate
`pnpm run build` is only needed for deploy artifacts when you are
not using a `deploy:*` script (each one builds first).

## Caveats

- `pnpm run validate` is non-mutating and does not check
  formatting; run `pnpm run format` when you intentionally want to
  rewrite files, or `pnpm run format:check` as a manual diagnostic
  — neither is part of the gate.
- Public Playwright is a smoke harness, not exhaustive browser
  coverage for every public content route.
- OpenAPI contract coverage is partial relative to the route
  surface — some SvelteKit routes are not yet annotated in
  `static/openapi.json`.
- There is no dedicated coverage threshold script in
  `package.json`; treat coverage as qualitative unless you add one.
- Authenticated browser E2E must not expose credentials, tokens,
  or magic-link URLs in test logs or shared artifacts.
- The Ed25519 signing key checked in at `wrangler.test.jsonc` is a
  disposable vitest/miniflare fixture (rotated, safe to publish) —
  it is **not** a template to copy into your own deployment. Real
  nodes generate their own key via the `/admin/keys` bootstrap and
  bind it through Cloudflare Secrets Store (see
  [`docs/secret-provisioning.md`](secret-provisioning.md)).
