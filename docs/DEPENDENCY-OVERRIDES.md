# Dependency Overrides — Current State

## Responsibility

This document registers every entry under `pnpm.overrides` in
`package.json`, per the workspace dependency-maintenance rules. Overrides
are a last resort: a direct dependency bump comes first, and an override is
only used for a resolution a direct bump cannot reach. A security override
must never pin a vulnerable version. Each entry lists its kind, what it
fixes, and its exit condition.

## Registered overrides

| Override                 | Kind              | What it fixes                                                                                                                                                      | Exit condition                                                                                |
| ------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `cookie: ^0.7.0`         | security-selector | Prior `cookie` advisory; keeps every resolution at or above the patched `0.7.x` line (resolves `0.7.2`).                                                           | Delete once every parent requires `>=0.7.0` directly and `pnpm audit` stays clean without it. |
| `js-yaml: ^4.3.1`        | security-selector | Quadratic CPU consumption in `!!omap` resolution (GHSA-5p4m-2wfm-xmqj); transitive via `eslint > @eslint/eslintrc`.                                                | Delete once `@eslint/eslintrc` requires `>=4.3.1` directly and audit stays clean.             |
| `undici: 7.29.0`         | security-selector | Several `undici` advisories (cache desync, CRLF injection, cross-user disclosure, cookie-attribute injection); transitive via `miniflare`.                         | Delete once `miniflare` requires `>=7.29.0` directly and audit stays clean.                   |
| `rollup: ^4.59.0`        | security-selector | Prior `rollup` advisory; keeps the bundler at or above the patched `4.59.x` line.                                                                                  | Delete once every parent requires `>=4.59.0` directly and audit stays clean.                  |
| `minimatch: ^9.0.7`      | security-selector | Prior `minimatch`/`brace-expansion` ReDoS; aligns `minimatch` on the `9.x` line (resolves `9.0.9`).                                                                | Delete once parents require a patched `minimatch` directly and audit stays clean.             |
| `devalue: 5.8.1`         | security-selector | Prior `devalue` serialization advisory; pins the patched release.                                                                                                  | Delete once every parent requires `>=5.8.1` directly and audit stays clean.                   |
| `ws: 8.21.0`             | security-selector | Prior `ws` denial-of-service advisories; pins the patched release.                                                                                                 | Delete once every parent requires `>=8.21.0` directly and audit stays clean.                  |
| `esbuild: 0.28.1`        | alignment         | Aligns `esbuild` to a single copy across Vite and the build toolchain; avoids duplicate binaries. Not security-driven.                                             | Delete once the graph naturally resolves one `esbuild` version.                               |
| `brace-expansion: 2.1.4` | security-selector | Three DoS advisories (GHSA-3jxr-9vmj-r5cp, GHSA-mh99-v99m-4gvg, GHSA-rgw5-rvv9-x895); transitive via `minimatch`.                                                  | Delete once `minimatch` requires `>=2.1.4` directly and audit stays clean.                    |
| `picomatch: 4.0.4`       | alignment         | Aligns `picomatch` to a single copy across `chokidar`/`micromatch`/Tailwind tooling.                                                                               | Delete once the graph naturally resolves one `picomatch` version.                             |
| `flatted: 3.4.2`         | alignment         | Aligns `flatted` to a single copy in the graph.                                                                                                                    | Delete once the graph naturally resolves one `flatted` version.                               |
| `yaml: 1.10.3`           | alignment         | Pins the legacy `yaml@1.x` line for tooling that requires it; avoids the `yaml@2.x` breaking surface.                                                              | Delete once the dependent tooling supports `yaml@2.x`.                                        |
| `postcss: 8.5.26`        | security-selector | PostCSS source-map advisories (GHSA-6g55-p6wh-862q, GHSA-r28c-9q8g-f849, GHSA-fxqj-rqcc-2cmp) and pulls `nanoid ^3.3.17`, clearing the transitive nanoid findings. | Delete once every parent requires `>=8.5.23` directly and audit stays clean.                  |
| `sharp@<0.35.0: 0.35.3`  | security-selector | `sharp`/`libvips` CVEs (GHSA-f88m-g3jw-g9cj); semver-selector override rewriting only vulnerable `<0.35.0` resolutions, transitive via `miniflare`.                | Delete once `miniflare` requires `>=0.35.0` directly and audit stays clean.                   |

## Kinds

- `security-selector` — an override whose purpose is to fix or prevent a
  security advisory. `sharp@<0.35.0` is a literal semver-selector override;
  the others are pinned-range security overrides that pre-date the
  selector convention and can migrate to selector form as parents ship
  fixes.
- `alignment` — an override that aligns the dependency graph on a single
  copy or a compatible line; it is not security-driven.

## Related direct bumps

`nanoid` was bumped directly in `dependencies` from `^5.1.6` to `^5.1.16`
to clear GHSA-28wg-ghj8-5hjv on the `5.x` line. The `3.x` nanoid copy
(transitive via `postcss`) is cleared by the `postcss` override pulling
`nanoid ^3.3.17`. No override is needed for either.

## Remaining advisories

After these changes `pnpm audit` reports zero critical and zero high. The
only remainders are moderate `@sveltejs/kit` findings
(GHSA-866w-xmhq-wj7x, GHSA-wqjv-9729-c5q2, GHSA-29g2-3rmr-qm68), patched at
`>=2.69.1` / `>=2.70.2`. They are left for a deliberate framework bump
rather than an override, since a SvelteKit minor upgrade is a broader
change than this dependency pass.
