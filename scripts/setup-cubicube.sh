#!/bin/bash

# =============================================================================
# NANDA NODE — CUBICUBE SETUP SCRIPT
# =============================================================================
#
# Creates cubicube.jsonc AND patches wrangler.jsonc for Workers for Platforms
# deployment. Called by acme-nanda workflow or manually.
#
# This script is CRITICAL for correct site owner + node identity setup. It:
# 1. Creates cubicube.jsonc with owner metadata
# 2. Patches wrangler.jsonc to install actual owner + node-identity values
#    into the acme-nanda env block:
#      - SITE_OWNER_EMAIL, SITE_NAME, CONTACT_EMAIL_TO, FROM_EMAIL (owner vars)
#      - NANDA_NODE_ID           (per-tenant node identity, derived from worker)
#    NOTE: VITE_BASE_URL and NANDA_REGISTRY_URL are NOT patched here — they are
#    injected at deploy time by the Pegasus engine's deploy-driver from
#    WORKER_URL (the actual deployed hostname, sandbox-aware for dev/prod).
#    The template declares them as "" in env.acme-nanda.vars
#    (the opt-in contract). See workspace CORE-CUBI-CONVENTIONS.md.
#
# Without step 2 the deployed worker uses placeholder values and:
#   - rejects the actual site owner at login (hooks.server.ts validation)
#   - reports as a placeholder node ID in federation gossip
#   - emits wrong self-reference URLs in AgentFacts VCs + agent-card.json
#
# Usage:
#   ./scripts/setup-cubicube.sh \
#     --domain "nanda.example.com" \
#     --owner-name "Node Operator" \
#     --owner-email "operator@example.com" \
#     --support-email "support@example.com"
#
# Required: --domain
# Optional: --owner-name, --owner-email, --support-email
# Ignored:  Any other args (for workflow compatibility)
#
# =============================================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# Defaults
DOMAIN=""
OWNER_NAME=""
OWNER_EMAIL=""
SUPPORT_EMAIL=""

# Parse arguments
while [[ $# -gt 0 ]]; do
	case $1 in
		--domain)
			DOMAIN="$2"
			shift 2
			;;
		--owner-name)
			OWNER_NAME="$2"
			shift 2
			;;
		--owner-email)
			OWNER_EMAIL="$2"
			shift 2
			;;
		--support-email)
			SUPPORT_EMAIL="$2"
			shift 2
			;;
		*)
			# Silently ignore unknown args (workflow may pass extras)
			shift 2 2>/dev/null || shift 1
			;;
	esac
done

# Validate
if [ -z "$DOMAIN" ]; then
	echo -e "${RED}❌ Error: --domain is required${NC}"
	exit 1
fi

# Defaults
[ -z "$OWNER_EMAIL" ] && OWNER_EMAIL="operator@$DOMAIN"
[ -z "$SUPPORT_EMAIL" ] && SUPPORT_EMAIL="$OWNER_EMAIL"
[ -z "$OWNER_NAME" ] && OWNER_NAME="Node Operator"

# Worker name: nanda.example.com → nanda-example-com
WORKER_NAME=$(echo "$DOMAIN" | sed 's/\./-/g')

echo ""
echo -e "${CYAN}Homeport Cubicube Setup${NC}"
echo -e "${CYAN}=========================${NC}"
echo -e "Domain:      ${GREEN}$DOMAIN${NC}"
echo -e "Worker:      ${GREEN}$WORKER_NAME${NC}"
echo -e "Operator:    ${GREEN}$OWNER_NAME <$OWNER_EMAIL>${NC}"
echo ""

# Create cubicube.jsonc
cat > cubicube.jsonc << EOF
{
  "domain": "$DOMAIN",
  "workerName": "$WORKER_NAME",
  "owner": {
    "name": "$OWNER_NAME",
    "email": "$OWNER_EMAIL",
    "supportEmail": "$SUPPORT_EMAIL"
  },
  "deployment": {
    "dispatchNamespace": "cubicube-com-dispatch-namespace"
  },
  "setupDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "setupVersion": "2.0.0",
  "customizations": {}
}
EOF

echo -e "${GREEN}✅ cubicube.jsonc created${NC}"

# =============================================================================
# PATCH WRANGLER.JSONC — install owner + node-identity vars
# =============================================================================
# Vars go through scripts/patch-wrangler-vars.cjs, a JSONC-aware
# insert-or-replace patcher (envConfig.vars[key] = value) modeled on
# core-cubi-creator-v1's patch-creator-wrangler.cjs. Replaces the previous
# `sed -i.bak "s/\"KEY\": \"\"/…/"` approach which silently no-oped on
# legacy tenant forks whose wrangler.jsonc predated a key (e.g. FROM_EMAIL),
# then echoed success and broke the prod build with "missing required var".
#
# NOTE: setup-cubicube.sh is a canonical-trio file that Pegasus heals into
# legacy branches. Shipping the .cjs helper alongside it is safe because the
# engine's setup-helper healing loop also copies scripts/*.cjs from canonical.
# =============================================================================

WRANGLER_CONFIG="wrangler.jsonc"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$WRANGLER_CONFIG" ]; then
	echo ""
	echo -e "${CYAN}Patching $WRANGLER_CONFIG with deployment data...${NC}"

	FROM_EMAIL="noreply@$DOMAIN"
	PATCHER="$SCRIPT_DIR/patch-wrangler-vars.cjs"
	if [ ! -f "$PATCHER" ]; then
		echo -e "${RED}❌ Missing wrangler patch helper: $PATCHER${NC}"
		exit 1
	fi
	# NANDA_REGISTRY_URL is deploy-time injected by the Pegasus engine
	# (deploy-driver.js — single writer, sourced from WORKER_URL / the actual
	# deployed hostname; sandbox-aware for dev/prod). Setup must NOT patch it:
	# the raw user domain is unreachable for sandbox deployments and would break
	# DID web resolution, VC issuer URLs, and federation join URLs. This
	# template opts in by declaring `"NANDA_REGISTRY_URL": ""` in
	# env.acme-nanda.vars of wrangler.jsonc. Same convention
	# as VITE_BASE_URL (workspace CORE-CUBI-CONVENTIONS.md).
	node "$PATCHER" \
		--file "$WRANGLER_CONFIG" \
		"SITE_OWNER_EMAIL=$OWNER_EMAIL" \
		"CONTACT_EMAIL_TO=$SUPPORT_EMAIL" \
		"SITE_NAME=$OWNER_NAME" \
		"FROM_EMAIL=$FROM_EMAIL" \
		"NANDA_NODE_ID=$WORKER_NAME"
	echo -e "  SITE_OWNER_EMAIL:    ${GREEN}$OWNER_EMAIL${NC}"
	echo -e "  CONTACT_EMAIL_TO:    ${GREEN}$SUPPORT_EMAIL${NC}"
	echo -e "  SITE_NAME:           ${GREEN}$OWNER_NAME${NC}"
	echo -e "  FROM_EMAIL:          ${GREEN}$FROM_EMAIL${NC}"
	echo -e "  NANDA_NODE_ID:       ${GREEN}$WORKER_NAME${NC}"

	# =========================================================================
	# POST-PATCH VALIDATION
	# Verify every patched key actually exists in the file afterwards. A
	# missing key means the patcher silently failed — FAIL LOUDLY instead of
	# echoing success (the exact failure mode of the old replace-only seds).
	# =========================================================================
	# Value-aware, env-scoped check (grep-anywhere matched key names that
	# exist in EVERY env block and could never fail). Verifies each key is
	# present in env.acme-nanda.vars AND that
	# SITE_OWNER_EMAIL carries the exact patched value.
	if ! node -e "
		const fs = require('fs');
		const raw = fs.readFileSync('$WRANGLER_CONFIG', 'utf8');
		const clean = raw.replace(/^\s*\/\/.*\$/gm, '').replace(/,\s*([}\]])/g, '\$1');
		const vars = (JSON.parse(clean).env || {})['acme-nanda']?.vars || {};
		const keys = ['SITE_OWNER_EMAIL','CONTACT_EMAIL_TO','SITE_NAME','FROM_EMAIL','NANDA_NODE_ID'];
		const missing = keys.filter(k => !(k in vars));
		if (missing.length) { console.error('missing from pegasus env vars: ' + missing.join(', ')); process.exit(1); }
		if (vars.SITE_OWNER_EMAIL !== process.argv[1]) { console.error('SITE_OWNER_EMAIL is ' + JSON.stringify(vars.SITE_OWNER_EMAIL) + ', expected ' + JSON.stringify(process.argv[1])); process.exit(1); }
		// VITE_BASE_URL and NANDA_REGISTRY_URL are deploy-time injected by the
		// Pegasus engine (single writer, sourced from WORKER_URL — the actual
		// deployed hostname). Setup must NOT patch them. The opt-in contract
		// requires each key to EXIST in the pegasus env (value may be '').
		for (const tenantUrlVar of ['VITE_BASE_URL', 'NANDA_REGISTRY_URL']) {
			if (!(tenantUrlVar in vars)) { console.error(tenantUrlVar + ' key missing from pegasus env vars: the deploy-time injection contract requires the key to exist (value may be \\'\\')'); process.exit(1); }
		}
	" "$OWNER_EMAIL"; then
		echo -e "${RED}🚨 CRITICAL: pegasus env validation failed after patching — aborting setup.${NC}"
		exit 1
	fi
	echo -e "${GREEN}✅ Verified: pegasus env carries all owner + node-identity vars (SITE_OWNER_EMAIL value-checked)${NC}"

	echo -e "${GREEN}✅ $WRANGLER_CONFIG patched with deployment data${NC}"
else
	echo -e "${YELLOW}⚠️ $WRANGLER_CONFIG not found - skipping env var patching${NC}"
	echo -e "${YELLOW}   deploy-driver.js will handle patching at deploy time${NC}"
fi
