# Homeport as a Cubicube Core Cubi

Homeport is built as a **[Cubicube](https://cubicube.com) Core Cubi** —
a self-describing, provision-ready application template. That is not a
branding detail; it is a deployment contract baked into the repo, and it
is the same machinery Cubicube uses to run managed Homeport nodes in
production.

## The declarative contract

**Templates declare. The engine follows.**

Two files carry the contract:

- **[`cube.jsonc`](../cube.jsonc)** — the Core Cubi manifest. It
  declares everything this application needs to exist: the stack
  (SvelteKit on Cloudflare Workers), the infrastructure to provision
  (D1 database, R2 bucket, KV namespace, Secrets Store entries), the
  required variables and SDK dependencies (`requiredCubes`), and the
  lifecycle effects of a deployment. Nothing about a Homeport deploy is
  implicit — if the manifest doesn't declare it, it doesn't happen.
- **[`wrangler.jsonc`](../wrangler.jsonc)** — alongside the ordinary
  `dev`/`prod` environments you use when self-hosting, it ships a
  provisioning environment whose resource IDs and tenant values are
  `__PEGASUS_PROVISION__` sentinels. Cubicube's deployment engine
  (Pegasus) resolves every sentinel at deploy time — database IDs,
  store IDs, tenant URLs, signing keys — and **fails the deploy loudly**
  if any declaration cannot be honored. No half-provisioned nodes.

The same manifest serves self-hosters: `pnpm run setup` reads
`cube.jsonc`, provisions the declared Cloudflare resources in *your*
account, and prints the IDs to paste into `wrangler.jsonc`. One
declaration, two consumers.

## Why this matters if you're customizing Homeport

Because the contract is declarative, **a customized fork of Homeport
stays deployable by the same engine**. Add routes, extend the trust
model, restyle the console — as long as your fork keeps its manifest
honest (declare any new bindings, variables, or provisioned resources
in `cube.jsonc`), it remains a one-command deployment target, for you
and for Cubicube.

That opens three paths for your work:

1. **Self-host your customization** — `pnpm run setup` +
   `pnpm run deploy:prod` to your own Cloudflare account, exactly like
   stock Homeport ([self-hosting guide](OPERATIONS.md)).
2. **Run it managed** — Cubicube operates managed Homeport nodes at
   [cubicube.com](https://cubicube.com); the same provisioning contract
   powers those deployments.
3. **Distribute it through Cubicube** — because your fork is still a
   valid Core Cubi, it can be deployed and operated for Cubicube
   customers like any first-party template. If you've built a
   customization others would want — an industry-specific trust model,
   a vertical agent registry, a themed operator console — **partner
   with Cubicube to offer it to Cubicube's customers**. Learn more or
   start the conversation at [cubicube.com](https://cubicube.com).

## Keeping a fork manifest-honest

When you extend Homeport, keep the contract intact:

- New Cloudflare binding (D1/R2/KV/queue)? Declare it in `cube.jsonc`
  and add the `__PEGASUS_PROVISION__` sentinel in the provisioning env
  of `wrangler.jsonc`.
- New required secret or environment variable? Declare it in the
  manifest; document the value's origin in
  [`secret-provisioning.md`](secret-provisioning.md).
- New runtime dependency on another cube/SDK? Add it to
  `requiredCubes`.

Undeclared infrastructure is the one thing that breaks the promise —
the engine fails closed on anything it can't resolve, which protects
your users from silently broken deployments.

## Further reading

- [`OPERATIONS.md`](OPERATIONS.md) — full resource layout, environments,
  and deploy flows.
- [`secret-provisioning.md`](secret-provisioning.md) — secret bindings
  and the `/admin/keys` bootstrap.
- [`PRODUCT_ARCHITECTURE.md`](PRODUCT_ARCHITECTURE.md) — what the node
  actually does once it's running.
