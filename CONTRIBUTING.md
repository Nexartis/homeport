# Contributing to Homeport

Thanks for helping make Homeport better. This document is the short
version; everything else lives inline in the code and in
[`docs/`](docs/).

## Reporting issues

Open a GitHub issue at
<https://github.com/Nexartis/homeport/issues> with:

- What you were doing (endpoint, command, or code path).
- What you expected to happen.
- What actually happened (error text, HTTP status, or unexpected
  behavior).
- Node version, pnpm version, and OS.
- A minimal reproduction if you can.

Security-sensitive issues (identity/key/delegation flaws, auth
bypass, secret leakage) should be reported privately — see
[`SECURITY.md`](SECURITY.md) for the disclosure channel. Do not
file public issues for suspected vulnerabilities.

## Proposing changes

Non-trivial changes are easier to land if you open an issue first
and get agreement on the shape before writing the patch. Small
fixes (typos, docs, obvious bugs) can go straight to a pull request.

## Local setup

Prerequisites: Node.js >= 20, pnpm 10, and (for deploys)
[`wrangler`](https://developers.cloudflare.com/workers/wrangler/)
authenticated to a Cloudflare account you own.

```bash
git clone https://github.com/Nexartis/homeport.git
cd homeport
pnpm install --frozen-lockfile
./homeport run -p 8080   # equivalent to `pnpm dev` after install
```

`./homeport run -p 8080` is the onboarding command in the README —
after `pnpm install` completes, `pnpm dev` is the exact equivalent.

## The validation gate

Every pull request must pass the same gate we run locally before
pushing:

```bash
pnpm run lint       # Prettier check
pnpm run check      # SvelteKit sync + Svelte/type checks
pnpm run test       # Vitest inside @cloudflare/vitest-pool-workers
```

The composite command is `pnpm run validate` — it runs `lint`,
`check`, and `test` non-mutatively. A CI failure on any of these
blocks the merge.

## Code style

- Prettier is the formatter (`.prettierrc`); `pnpm run format`
  writes fixes.
- Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props()`);
  no Svelte 4 syntax.
- Cloudflare Workers runtime — no Node.js APIs. Use
  `event.platform.env`, not `process.env`.
- Secrets always go through `resolveSecret()`
  (`src/lib/utils/resolve-secret.ts`) so both Secrets Store bindings
  and KV fallback keep working.
- Migrations are hand-written SQL in `drizzle/migrations/`; never
  use `drizzle-kit push`.

## Pull request checklist

- Branch from `dev` and open your PR against `dev` — it is the
  default integration branch. `main` tracks tagged releases; direct
  PRs to `main` will be redirected.
- Keep the PR focused.
- New behavior has a Vitest test in `tests/`.
- Documentation in `docs/` is updated when contracts or bindings
  change.
- **All commits must be signed off** — see [DCO](#dco) below.
- No secret values, no Cloudflare account IDs, no personal
  identifiers in tracked files.

## DCO

All commits must be signed off under the
[Developer Certificate of Origin](https://developercertificate.org/).
Use `git commit -s` (or add `Signed-off-by: Your Name
<you@example.com>` to the commit message) on every commit. A CI
check enforces this and will block merges from unsigned commits.

## Conventional Commits

We use [Conventional Commits](https://www.conventionalcommits.org/)
for commit messages. This keeps changelogs and release notes
mechanical:

- `feat: …` — a new user-visible feature (minor bump).
- `fix: …` — a bug fix (patch bump).
- `docs: …`, `test: …`, `chore: …`, `refactor: …` — no release.
- `feat!: …` or a `BREAKING CHANGE:` footer — breaking change
  (major bump).

Keep the summary line ≤72 characters, lower-case, no trailing period.

## License

By contributing you agree that your contributions are licensed under
the Apache License, Version 2.0 — see [`LICENSE`](LICENSE).
