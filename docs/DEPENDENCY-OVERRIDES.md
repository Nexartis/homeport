# Dependency Overrides — Current State

## Responsibility

This document registers every entry under `overrides` in
`pnpm-workspace.yaml`, per the workspace dependency-maintenance rules.
Overrides are a last resort: a direct dependency bump comes first, and an
override is only used for a resolution a direct bump cannot reach.
Security overrides use selector form (`'pkg@vulnerableRange': 'fixed'`)
in `pnpm-workspace.yaml` only — plain graph-wide keys in `package.json`
are prohibited, and graph-wide keys in the workspace file are reserved
for graph alignment. A security override must never pin a vulnerable
version. Each entry lists its kind, what it fixes, and its exit
condition.

## Registered overrides

| Override                                               | Kind              | What it fixes                                                                                                                                                                                                                                                            | Exit condition                                                                                 |
| ------------------------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `'@sveltejs/kit@<=2.70.1': '2.70.2'`                   | security-selector | `@sveltejs/kit` advisories (GHSA-866w-xmhq-wj7x, GHSA-wqjv-9729-c5q2, GHSA-29g2-3rmr-qm68), patched at `>=2.69.1` / `>=2.70.2`; the widest vulnerable range (`<=2.70.1`) pins every sub-`2.70.2` resolution to the patched release.                                      | Delete once every parent requires `>=2.70.2` directly and `pnpm audit` stays clean without it. |
| `'cookie@<0.7.0': '0.7.0'`                             | security-selector | Prior `cookie` advisory; rewrites only vulnerable sub-`0.7.0` resolutions to the patched release.                                                                                                                                                                        | Delete once every parent requires `>=0.7.0` directly and `pnpm audit` stays clean without it.  |
| `'js-yaml@<4.3.2': '4.3.2'`                            | security-selector | Quadratic CPU consumption in `!!omap` resolution (GHSA-5p4m-2wfm-xmqj) and `maxTotalMergeKeys` CPU DoS for empty merge sources (>=4.0.0 <4.3.2); transitive via `eslint > @eslint/eslintrc`. Supersedes the `<4.3.1 → 4.3.1` selector.                                   | Delete once `@eslint/eslintrc` requires `>=4.3.2` directly and audit stays clean.              |
| `'undici@<7.29.0': '7.29.0'`                           | security-selector | Several `undici` advisories (cache desync, CRLF injection, cross-user disclosure, cookie-attribute injection); transitive via `miniflare`.                                                                                                                               | Delete once `miniflare` requires `>=7.29.0` directly and audit stays clean.                    |
| `'rollup@<4.59.0': '4.59.0'`                           | security-selector | Prior `rollup` advisory; rewrites vulnerable sub-`4.59.0` resolutions to the patched release.                                                                                                                                                                            | Delete once every parent requires `>=4.59.0` directly and audit stays clean.                   |
| `'minimatch@<9.0.7': '9.0.7'`                          | security-selector | Prior `minimatch`/`brace-expansion` ReDoS; rewrites vulnerable resolutions onto the patched `9.x` line.                                                                                                                                                                  | Delete once parents require a patched `minimatch` directly and audit stays clean.              |
| `'devalue@<5.8.1': '5.8.1'`                            | security-selector | Prior `devalue` serialization advisory; pins the patched release.                                                                                                                                                                                                        | Delete once every parent requires `>=5.8.1` directly and audit stays clean.                    |
| `'ws@<8.21.0': '8.21.0'`                               | security-selector | Prior `ws` denial-of-service advisories; pins the patched release.                                                                                                                                                                                                       | Delete once every parent requires `>=8.21.0` directly and audit stays clean.                   |
| `'brace-expansion@<2.1.4': '2.1.4'`                    | security-selector | Three DoS advisories (GHSA-3jxr-9vmj-r5cp, GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895); transitive via `minimatch`.                                                                                                                                                        | Delete once `minimatch` requires `>=2.1.4` directly and audit stays clean.                     |
| `'postcss@<8.5.26': '8.5.26'`                          | security-selector | PostCSS source-map advisories (GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849, GHSA-fxqj-rqcc-2cmp) and pulls `nanoid ^3.3.17`, clearing the transitive nanoid findings.                                                                                                       | Delete once every parent requires `>=8.5.26` directly and audit stays clean.                   |
| `'sharp@<0.35.4': '0.35.4'`                            | security-selector | `sharp`/`libvips` CVEs (GHSA-f88m-g3jw-g9cj) plus the libheif vulnerabilities (GHSA-g89c-p67h-r497, GHSA-2jg2-4ch7-h545, patched `>=0.35.4`); transitive via `miniflare`. Supersedes the `<0.35.0 → 0.35.3` selector that left the 0.35.0–0.35.3 band pinned-vulnerable. | Delete once `miniflare` requires `>=0.35.4` directly and audit stays clean.                    |
| `'baseline-browser-mapping@>=2.0.0 <2.11.0': '2.11.0'` | security-selector | `baseline-browser-mapping` process termination on invalid input DoS (>=2.0.0 <2.11.0).                                                                                                                                                                                   | Delete once parents require `>=2.11.0` directly and audit stays clean.                         |
| `'browserslist@<=4.28.6': '4.28.7'`                    | security-selector | Browserslist unbounded memory growth (no cache eviction) via distinct query results, and uncaught crash / prototype write via untrusted `browserslist-stats` (<=4.28.6, 2 high).                                                                                         | Delete once parents require `>=4.28.7` directly and audit stays clean.                         |
| `'fflate@>=0.7.0 <0.7.5': '0.7.5'`                     | security-selector | `fflate` `unzipSync` infinite loop on malformed ZIP64 archives (>=0.7.0 <0.7.5).                                                                                                                                                                                         | Delete once parents require `>=0.7.5` directly and audit stays clean.                          |
| `'postcss-selector-parser@>=6.1.0 <6.1.3': '6.1.3'`    | security-selector | `postcss-selector-parser` DoS through uncontrolled AST recursion (>=6.1.0 <6.1.3).                                                                                                                                                                                       | Delete once parents require `>=6.1.3` directly and audit stays clean.                          |
| `esbuild: '0.28.1'`                                    | alignment         | Aligns `esbuild` to a single copy across Vite and the build toolchain; avoids duplicate binaries. Not security-driven.                                                                                                                                                   | Delete once the graph naturally resolves one `esbuild` version.                                |
| `picomatch: '4.0.4'`                                   | alignment         | Aligns `picomatch` to a single copy across `chokidar`/`micromatch`/Tailwind tooling.                                                                                                                                                                                     | Delete once the graph naturally resolves one `picomatch` version.                              |
| `flatted: '3.4.2'`                                     | alignment         | Aligns `flatted` to a single copy in the graph.                                                                                                                                                                                                                          | Delete once the graph naturally resolves one `flatted` version.                                |
| `yaml: '1.10.3'`                                       | alignment         | Pins the legacy `yaml@1.x` line for tooling that requires it; avoids the `yaml@2.x` breaking surface.                                                                                                                                                                    | Delete once the dependent tooling supports `yaml@2.x`.                                         |

## Kinds

- `security-selector` — a selector-form override
  (`'pkg@vulnerableRange': 'fixed'`) that rewrites only vulnerable
  resolutions and becomes inert once every parent ships the fix.
- `alignment` — a graph-wide override that aligns the dependency graph on
  a single copy or a compatible line; it is not security-driven. Graph-wide
  keys live in `pnpm-workspace.yaml` only, never in `package.json`.

## Supply-chain quarantine

`minimumReleaseAge: 10080` delays newly published versions by 7 days
(malicious-release window). Every override-pinned package above is listed
in `minimumReleaseAgeExclude` (together with `'@nexartis/*'`) so the fixed
versions resolve past the quarantine.

## Related direct bumps

- `nanoid` was bumped directly in `dependencies` from `^5.1.6` to `^5.1.16`
  to clear GHSA-28wg-ghj8-5hjv on the `5.x` line. The `3.x` nanoid copy
  (transitive via `postcss`) is cleared by the `postcss` override pulling
  `nanoid ^3.3.17`. No override is needed for either.
- `@sveltejs/kit` (direct devDependency) was bumped from `^2.66.0` to
  `^2.70.2` because the advisory targets the manifest range itself; the
  selector override above additionally rewrites any remaining sub-`2.70.2`
  resolutions in the graph.

## Remaining advisories

After the 2026-09-11 selector wave `pnpm audit` reports **2 moderate**
(down from 9): both are the same vitest advisory pair — Path Traversal /
Arbitrary File Read via `@vitest/mocker` redirect mock (GHSA-82fw-gwwq-j7x9,
vulnerable `>=2.1.0 <4.1.11`). No override can clear it: the patch exists
only in the vitest 4.x line and root carries `vitest@^3.2.6` because
`@cloudflare/vitest-pool-workers@^0.12.21` peers vitest `2.0.x - 3.2.x`.
`pnpm audit --prod` is clean — dev scope only.

**Named migration lane (measured 2026-09-11, never a ride-along on a
security-overrides PR):** vitest `^4.1.11` + pool-workers `^0.22.0`. The
config codemod is mechanical (`defineWorkersConfig` from
`@cloudflare/vitest-pool-workers/config` → `defineConfig` + the
`cloudflareTest()` plugin; the package ships `./codemods/vitest-v3-to-v4`;
`singleWorker`/`isolatedStorage` were REMOVED in 0.22), but the suite then
fails 10/61 files: 9 × 5s `SELF.fetch()` integration timeouts, D1 seed-insert
failures, and a 10s `beforeAll` hook timeout — the `isolatedStorage: false`
shared-state semantics the integration tests rely on changed under the new
pool. Exit condition: the migration lands with the full suite green, then
this section is deleted.

The former moderate `@sveltejs/kit` findings
(GHSA-866w-xmhq-wj7x, GHSA-wqjv-9729-c5q2, GHSA-29g2-3rmr-qm68) are closed
by the direct `^2.70.2` bump plus the `'@sveltejs/kit@<=2.70.1': '2.70.2'`
selector override.
