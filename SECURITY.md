# Security Policy

Thanks for helping keep Homeport and its operators safe.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for suspected
vulnerabilities. Report privately via one of:

- **GitHub private vulnerability reporting** — the preferred
  channel. Open a report at
  <https://github.com/Nexartis/homeport/security/advisories/new>.
- **Email** — `security@nexartis.com` for issues that cannot be
  filed through GitHub.

Please include:

- A description of the issue and the impact you observed or expect.
- Steps to reproduce (endpoint, request, code path, or PoC).
- The commit SHA or release tag you tested against.

We acknowledge new reports within a few business days and keep the
reporter updated as we triage, patch, and coordinate disclosure.

## Coordinated disclosure SLA

We follow a **90-day coordinated disclosure SLA** from the date a
report is acknowledged by a maintainer:

| Milestone                         | Target                                    |
| --------------------------------- | ----------------------------------------- |
| Initial acknowledgement           | Within **3 business days** of receipt     |
| Triage and severity assessment    | Within **10 business days**               |
| Fix, advisory draft, release plan | Within **45 days** for High/Critical      |
| Public disclosure + advisory      | By **day 90**, or sooner once a fix ships |

If a report is already being actively exploited, we may accelerate
disclosure. Reporters are credited in the published advisory unless
they request anonymity.

## Scope

In scope: the Homeport node code in this repository — the
SvelteKit/Cloudflare Worker app, REST/A2A/MCP endpoints, the
`.well-known` surface, delegation grants, and the secret-resolution
path (`resolveSecret`).

Out of scope: third-party services an operator plugs in (their own
Cloudflare account posture, external identity providers, hosted
add-ons such as Sentinel), and denial-of-service reports that rely
on unbounded self-inflicted request volume.

## Supported versions

Homeport is pre-1.0. Only the tip of the default integration branch
(`dev`) and the latest tagged release on `main` receive security
fixes. Operators are expected to track those two refs.

## Coordinated disclosure

We ship fixes on the default branch first and cut a release after
the fix has soaked. When a report warrants an advisory we publish
one through GitHub Security Advisories and credit the reporter
unless they prefer to remain anonymous.

There is no bug bounty program at this time.

## Safe harbor

We will not pursue legal action against researchers who:

- Act in good faith and avoid privacy violations, data destruction,
  or service disruption.
- Give us a reasonable window to remediate before public disclosure.
- Do not exploit the vulnerability beyond what is necessary to
  demonstrate impact.
- Report only against Homeport nodes they operate themselves, or
  against a node whose operator has explicitly authorized the test.
