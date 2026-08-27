#!/usr/bin/env node

// =============================================================================
// PATCH WRANGLER VARS — insert-or-replace owner vars in wrangler.jsonc
// =============================================================================
//
// Modeled on core-cubi-creator-v1's scripts/patch-creator-wrangler.cjs (the
// family gold standard). Parses wrangler.jsonc (JSONC comments stripped
// string-aware), targets the `acme-nanda` env block, and
// ASSIGNS each var. Requires the canonical `acme-nanda` env
// to exist; throws with a hint listing other pegasus-* envs when missing (no
// silent fallback — deploy.js/Pegasus always target the canonical env). The
// assignment is:
//
//     envConfig.vars[key] = value
//
// This is insert-or-replace: keys missing from legacy tenant forks (forked
// before the var existed) are INSERTED, not silently skipped like the old
// replace-only `sed "s/\"KEY\": \"\"/…/"` approach, which no-oped when the
// key was absent and caused `missing required var SITE_NAME` prod failures.
//
// Usage:
//   node scripts/patch-wrangler-vars.cjs --file wrangler.jsonc --env <name> KEY=VALUE [KEY=VALUE ...]
//
// =============================================================================

const fs = require('fs');

function stripJsoncComments(content) {
	let out = '';
	let inString = false;
	let stringQuote = '';
	let escaped = false;
	for (let i = 0; i < content.length; i += 1) {
		const c = content[i];
		const n = content[i + 1];
		if (inString) {
			out += c;
			if (escaped) escaped = false;
			else if (c === '\\') escaped = true;
			else if (c === stringQuote) inString = false;
			continue;
		}
		if (c === '"' || c === "'") {
			inString = true;
			stringQuote = c;
			out += c;
			continue;
		}
		if (c === '/' && n === '/') {
			while (i < content.length && content[i] !== '\n') i += 1;
			out += '\n';
			continue;
		}
		if (c === '/' && n === '*') {
			i += 2;
			while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) i += 1;
			i += 1;
			continue;
		}
		out += c;
	}
	return out;
}

function parseJsonc(content) {
	const noComments = stripJsoncComments(content);
	const parts = noComments.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/);
	for (let i = 0; i < parts.length; i += 2) {
		parts[i] = parts[i].replace(/,(\s*[}\]])/g, '$1');
	}
	return JSON.parse(parts.join(''));
}

function parseArgs(argv) {
	const args = { file: '', envName: '', pairs: [] };
	for (let i = 2; i < argv.length; i += 1) {
		const token = argv[i];
		if (token === '--file') {
			args.file = argv[i + 1];
			i += 1;
			continue;
		}
		if (token === '--env') {
			args.envName = argv[i + 1];
			i += 1;
			continue;
		}
		if (token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
		const eq = token.indexOf('=');
		if (eq <= 0) throw new Error(`Expected KEY=VALUE, got: ${token}`);
		const key = token.slice(0, eq);
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) throw new Error(`Invalid var key: ${key}`);
		args.pairs.push([key, token.slice(eq + 1)]);
	}
	if (!args.file) throw new Error('Missing required --file');
	if (!args.envName) throw new Error('Missing required --env <name> (never default a tenant env)');
	if (args.pairs.length === 0) throw new Error('No KEY=VALUE pairs provided');
	return args;
}

// Resolve the env block named by --env. Fails LOUDLY if missing — never
// silently create or fall back. Pegasus tenants historically used
// `acme-nanda`; this repo also ships `pegasus-horizon-breakthrough`.
// Callers must pass the env they will deploy (`wrangler deploy --env <name>`).
function resolvePegasusEnv(wrangler, envName) {
	if (!wrangler || typeof wrangler !== 'object')
		throw new Error('wrangler.jsonc root must be an object');
	if (!wrangler.env || typeof wrangler.env !== 'object')
		throw new Error('wrangler.jsonc env must be an object');
	if (!envName) throw new Error('env name is required');
	const envConfig = wrangler.env[envName];
	if (!envConfig || typeof envConfig !== 'object') {
		const found = Object.keys(wrangler.env).filter((k) => k.startsWith('pegasus-'));
		const hint = found.length
			? ` (found pegasus-* envs: ${found.join(', ')} — pass --env matching the wrangler deploy --env you will run)`
			: '';
		throw new Error(
			`wrangler.jsonc missing required env.${envName} block${hint}. deploy.js always runs \`wrangler deploy --env ${envName}\`; patching a different env would leave the deploy env unpatched.`
		);
	}
	return { envName, envConfig };
}

function patchVars(wrangler, pairs, requestedEnv) {
	const { envName, envConfig } = resolvePegasusEnv(wrangler, requestedEnv);
	envConfig.vars = envConfig.vars && typeof envConfig.vars === 'object' ? envConfig.vars : {};
	for (const [key, value] of pairs) {
		envConfig.vars[key] = value;
	}
	return envName;
}

if (require.main === module) {
	try {
		const args = parseArgs(process.argv);
		const wrangler = parseJsonc(fs.readFileSync(args.file, 'utf8'));
		const envName = patchVars(wrangler, args.pairs, args.envName);
		fs.writeFileSync(args.file, JSON.stringify(wrangler, null, '\t') + '\n');
		console.log(
			`patch-wrangler-vars: set ${args.pairs.map(([key]) => key).join(', ')} in env.${envName}`
		);
	} catch (err) {
		console.error(`patch-wrangler-vars failed: ${err.message}`);
		process.exit(1);
	}
}

module.exports = { parseJsonc, stripJsoncComments, resolvePegasusEnv, patchVars };
