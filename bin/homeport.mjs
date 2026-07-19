#!/usr/bin/env node
// Homeport CLI — first-run developer experience.
//
// Zero runtime deps: node stdlib only, so a fresh clone can run this
// BEFORE `pnpm install`. Subcommands: run (default), doctor, help.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// On Windows, globally-resolved pnpm/corepack binaries are .cmd shims,
// which Node's spawn/spawnSync cannot execute directly — pass shell:true
// so cmd.exe resolves the shim. Harmless on POSIX.
const IS_WINDOWS = process.platform === 'win32';

// ------------------------------- ANSI ----------------------------------

const NO_COLOR = process.env.NO_COLOR || !process.stdout.isTTY;
const c = (code) => (s) => (NO_COLOR ? s : `\x1b[${code}m${s}\x1b[0m`);
const dim = c('2');
const bold = c('1');
const cyan = c('36');
const yellow = c('38;5;220');
const green = c('32');
const red = c('31');
const gray = c('90');

// Cyan → purple gradient for a single string.
function gradient(str) {
	if (NO_COLOR) return str;
	const stops = [51, 45, 39, 99, 135, 141, 177];
	const chars = [...str];
	return chars
		.map((ch, i) => {
			const idx = Math.floor((i / Math.max(1, chars.length - 1)) * (stops.length - 1));
			return `\x1b[38;5;${stops[idx]}m${ch}\x1b[0m`;
		})
		.join('');
}

// ------------------------------- args ----------------------------------

function parseArgs(argv) {
	const args = { _: [], port: 8080, host: false, install: true };
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '-p' || a === '--port') {
			args.port = Number(argv[++i]);
		} else if (a.startsWith('--port=')) {
			args.port = Number(a.slice('--port='.length));
		} else if (a === '--host') {
			args.host = true;
		} else if (a === '--no-install') {
			args.install = false;
		} else if (a === '-h' || a === '--help') {
			args._.unshift('help');
		} else {
			args._.push(a);
		}
	}
	if (!Number.isFinite(args.port) || args.port <= 0 || args.port > 65535) {
		die(`invalid --port: ${args.port}`);
	}
	return args;
}

function die(msg, code = 1) {
	console.error(`${red('✗')} ${msg}`);
	process.exit(code);
}

// ----------------------------- helpers ---------------------------------

function which(cmd) {
	const res = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], {
		encoding: 'utf8'
	});
	if (res.status === 0) return res.stdout.trim().split('\n')[0];
	return null;
}

function version(cmd, args = ['--version']) {
	try {
		const res = spawnSync(cmd, args, { encoding: 'utf8', shell: IS_WINDOWS });
		if (res.status === 0) return res.stdout.trim().split('\n')[0];
	} catch {
		// fall through — treat as missing
	}
	return null;
}

function parseSemver(v) {
	const m = String(v)
		.trim()
		.replace(/^v/, '')
		.match(/^(\d+)\.(\d+)\.(\d+)/);
	if (!m) return null;
	return { major: +m[1], minor: +m[2], patch: +m[3] };
}

function semverGte(a, b) {
	if (!a || !b) return false;
	if (a.major !== b.major) return a.major > b.major;
	if (a.minor !== b.minor) return a.minor > b.minor;
	return a.patch >= b.patch;
}

function readRequiredNode() {
	const p = join(ROOT, '.node-version');
	if (!existsSync(p)) return { major: 20, minor: 19, patch: 0, source: 'default' };
	const raw = readFileSync(p, 'utf8').trim();
	const m = raw.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?$/);
	if (!m) return { major: 20, minor: 19, patch: 0, source: '.node-version (unparsed)' };
	return {
		major: +m[1],
		minor: +(m[2] || 0),
		patch: +(m[3] || 0),
		source: '.node-version'
	};
}

async function confirm(prompt) {
	if (!process.stdin.isTTY) return false;
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((res) => {
		rl.question(`${cyan('?')} ${prompt} ${dim('[y/N] ')}`, (ans) => {
			rl.close();
			res(/^y(es)?$/i.test(ans.trim()));
		});
	});
}

// ------------------------------- banner --------------------------------

// A tiny lighthouse. The lantern (o) is yellow; the tower is a
// cyan→purple gradient. Keep it small; big ASCII art dates badly.
function banner() {
	const tower = [
		'         ',
		'    _    ',
		'   /_\\   ',
		'  |═══|  ',
		'  |[◉]|  ',
		'  |═══|  ',
		' /|   |\\ ',
		'/_|___|_\\',
		'|_______|'
	];
	const out = [];
	out.push('');
	for (const line of tower) {
		// Colorize just the lantern character in yellow, tower in gradient.
		if (line.includes('◉')) {
			const before = line.slice(0, line.indexOf('◉'));
			const after = line.slice(line.indexOf('◉') + 1);
			out.push('  ' + gradient(before) + yellow('◉') + gradient(after));
		} else {
			out.push('  ' + gradient(line));
		}
	}
	out.push('');
	out.push('  ' + bold(gradient('Welcome to Homeport')));
	out.push('  ' + dim('Every agent needs a homeport.'));
	out.push('');
	return out.join('\n');
}

// ------------------------------ commands -------------------------------

function showHelp() {
	const usage = `
${bold(gradient('homeport'))} ${dim('— self-hostable NANDA node')}

${bold('Usage:')}
  ${cyan('homeport')} ${dim('[command]')} ${dim('[options]')}

${bold('Commands:')}
  ${cyan('run')}       Start the local dev node (default)
  ${cyan('doctor')}    Diagnose your environment
  ${cyan('help')}      Show this message

${bold('Options for run:')}
  ${cyan('-p, --port')} ${dim('<n>')}    Port to bind ${dim('(default 8080)')}
  ${cyan('    --host')}         Bind 0.0.0.0 so other devices can reach it
  ${cyan('    --no-install')}   Skip the auto-install step

${bold('First-run examples:')}
  ${dim('$')} ${cyan('./homeport run -p 8080')}          ${dim('# fresh clone, one command')}
  ${dim('$')} ${cyan('pnpm exec homeport run -p 8080')}  ${dim('# after pnpm install')}
  ${dim('$')} ${cyan('homeport doctor')}                 ${dim('# what is missing?')}

${dim('Managed Homeport:')} ${cyan('https://cubicube.com')}
`;
	process.stdout.write(usage);
}

function checkNode(required) {
	const current = parseSemver(process.versions.node);
	if (semverGte(current, required)) {
		return { ok: true, current, required };
	}
	return { ok: false, current, required };
}

function nodeUpgradeWalkthrough(current, required) {
	const req = `${required.major}.${required.minor}.${required.patch}`;
	const cur = current ? `${current.major}.${current.minor}.${current.patch}` : 'unknown';
	console.error('');
	console.error(
		`${red('✗')} Node.js ${bold(cur)} is too old — Homeport needs ${bold('>= ' + req)}.`
	);
	console.error('');
	console.error(`  ${bold('Pick one:')}`);
	console.error('');
	console.error(`  ${dim('# nvm')}`);
	console.error(`  ${cyan(`nvm install ${required.major} && nvm use ${required.major}`)}`);
	console.error('');
	console.error(`  ${dim('# fnm')}`);
	console.error(`  ${cyan(`fnm install ${required.major} && fnm use ${required.major}`)}`);
	console.error('');
	console.error(`  ${dim('# Homebrew (macOS)')}`);
	console.error(`  ${cyan(`brew install node@${required.major}`)}`);
	console.error('');
	console.error(`  ${dim('# Anything else:')} ${cyan('https://nodejs.org/en/download')}`);
	console.error('');
	console.error(`  ${dim('Then re-run:')} ${cyan('./homeport run')}`);
	console.error('');
}

async function ensurePnpm() {
	const found = which('pnpm');
	if (found) {
		return { ok: true, path: found, version: version('pnpm') };
	}
	// Try corepack.
	const corepack = which('corepack');
	if (!corepack) {
		console.error('');
		console.error(`${red('✗')} pnpm not found, and corepack is missing too.`);
		console.error('');
		console.error(`  ${dim('Install pnpm 10:')}`);
		console.error(`  ${cyan('npm install -g pnpm@10')}`);
		console.error(`  ${dim('or:')} ${cyan('brew install pnpm')}`);
		console.error('');
		return { ok: false };
	}

	console.log('');
	console.log(`${yellow('!')} pnpm is not installed.`);
	console.log(`  ${dim('corepack ships with Node and can enable pnpm for you.')}`);
	console.log('');

	const yes = await confirm(`Run ${cyan('corepack enable pnpm')} now?`);
	if (!yes) {
		console.log('');
		console.log(`  ${dim('No worries. Run one of these when ready:')}`);
		console.log(`  ${cyan('corepack enable pnpm')}`);
		console.log(`  ${cyan('npm install -g pnpm@10')}`);
		console.log('');
		return { ok: false };
	}

	const res = spawnSync('corepack', ['enable', 'pnpm'], {
		stdio: 'inherit',
		shell: IS_WINDOWS
	});
	if (res.status !== 0) {
		console.error(`${red('✗')} corepack enable pnpm failed (exit ${res.status}).`);
		return { ok: false };
	}
	const nowFound = which('pnpm');
	return { ok: !!nowFound, path: nowFound, version: version('pnpm') };
}

function ensureGitignoreStamp() {
	const gi = join(ROOT, '.gitignore');
	if (!existsSync(gi)) return;
	const contents = readFileSync(gi, 'utf8');
	if (contents.split('\n').some((l) => l.trim() === '.homeport-installed')) return;
	appendFileSync(gi, (contents.endsWith('\n') ? '' : '\n') + '.homeport-installed\n');
}

async function ensureInstalled({ install }) {
	const nm = join(ROOT, 'node_modules');
	const stamp = join(ROOT, '.homeport-installed');
	const need = !existsSync(nm) || !existsSync(stamp);
	if (!need) return true;

	if (!install) {
		console.log(dim('  (skipping install — --no-install)'));
		return true;
	}

	console.log('');
	console.log(`${cyan('›')} First run — installing dependencies with ${bold('pnpm install')}...`);
	console.log(dim('  (this happens once; subsequent runs are instant)'));
	console.log('');

	const started = Date.now();
	const res = spawnSync('pnpm', ['install'], { stdio: 'inherit', cwd: ROOT, shell: IS_WINDOWS });
	if (res.status !== 0) {
		die(`pnpm install failed (exit ${res.status}).`);
	}
	const secs = ((Date.now() - started) / 1000).toFixed(1);
	writeFileSync(stamp, `installed ${new Date().toISOString()} in ${secs}s\n`);
	ensureGitignoreStamp();
	console.log('');
	console.log(`${green('✓')} Installed in ${bold(secs + 's')}.`);
	return true;
}

function infoBlock(port, host) {
	const url = `http://${host ? '0.0.0.0' : 'localhost'}:${port}`;
	console.log('');
	console.log(`  ${bold('Local:')}   ${cyan(url)}`);
	console.log(`  ${bold('Docs:')}    ${cyan(url + '/docs')}`);
	console.log(`  ${bold('Admin:')}   ${cyan(url + '/admin')}`);
	console.log(`  ${bold('Health:')}  ${cyan(url + '/health')}`);
	console.log('');
	console.log(`  ${dim('Where next:')}`);
	console.log(`    • Deploy to your Cloudflare account:  ${cyan('docs/OPERATIONS.md')}`);
	console.log(`    • Diagnose your environment:          ${cyan('homeport doctor')}`);
	console.log(`    • Prefer a managed node?              ${cyan('https://cubicube.com')}`);
	console.log('');
	console.log(gray('  Press Ctrl+C to stop.'));
	console.log('');
}

// ------------------------------ run ------------------------------------

async function cmdRun(args) {
	const required = readRequiredNode();
	const nodeCheck = checkNode(required);
	if (!nodeCheck.ok) {
		nodeUpgradeWalkthrough(nodeCheck.current, required);
		process.exit(1);
	}

	const pnpm = await ensurePnpm();
	if (!pnpm.ok) process.exit(1);

	await ensureInstalled({ install: args.install });

	// Banner + info.
	console.log(banner());
	infoBlock(args.port, args.host);

	// Hand off to vite.
	const viteArgs = ['exec', 'vite', 'dev', '--port', String(args.port), '--strictPort'];
	if (args.host) viteArgs.push('--host');

	const child = spawn('pnpm', viteArgs, {
		stdio: 'inherit',
		cwd: ROOT,
		env: process.env,
		shell: IS_WINDOWS
	});

	const forward = (sig) => {
		if (!child.killed) child.kill(sig);
	};
	process.on('SIGINT', () => forward('SIGINT'));
	process.on('SIGTERM', () => forward('SIGTERM'));

	child.on('exit', (code, sig) => {
		if (sig) process.kill(process.pid, sig);
		else process.exit(code ?? 0);
	});
}

// ------------------------------ doctor ---------------------------------

function cmdDoctor() {
	const required = readRequiredNode();
	const rows = [];

	// Node.
	const nc = checkNode(required);
	rows.push({
		name: 'Node.js',
		ok: nc.ok,
		detail: `${process.versions.node} ${dim('(need >= ' + required.major + '.' + required.minor + '.' + required.patch + ')')}`,
		fix: nc.ok
			? null
			: `Install Node ${required.major}: ${cyan('nvm install ' + required.major)} or ${cyan('brew install node@' + required.major)}`
	});

	// pnpm.
	const pnpmPath = which('pnpm');
	const pnpmVer = pnpmPath ? version('pnpm') : null;
	const pnpmOk = !!pnpmPath && semverGte(parseSemver(pnpmVer), { major: 10, minor: 0, patch: 0 });
	rows.push({
		name: 'pnpm',
		ok: pnpmOk,
		detail: pnpmVer ? `${pnpmVer} ${dim('at ' + pnpmPath)}` : dim('not found'),
		fix: pnpmOk ? null : `Enable via corepack: ${cyan('corepack enable pnpm')}`
	});

	// node_modules.
	const nm = existsSync(join(ROOT, 'node_modules'));
	rows.push({
		name: 'node_modules',
		ok: nm,
		detail: nm ? 'present' : dim('missing'),
		fix: nm ? null : `Run ${cyan('./homeport run')} — it will install for you.`
	});

	// wrangler.
	let wranglerAuth = null;
	if (pnpmOk) {
		const res = spawnSync('pnpm', ['exec', 'wrangler', 'whoami'], {
			cwd: ROOT,
			encoding: 'utf8',
			timeout: 10_000,
			shell: IS_WINDOWS
		});
		if (res.status === 0) {
			const m = res.stdout.match(/associated with the email\s+([^\s]+)/i);
			wranglerAuth = { ok: true, email: m ? m[1] : 'ok' };
		} else {
			wranglerAuth = { ok: false };
		}
	}
	rows.push({
		name: 'wrangler auth',
		ok: !!wranglerAuth?.ok,
		detail: wranglerAuth?.ok
			? wranglerAuth.email
			: dim('not authenticated (only needed for deploy)'),
		fix: wranglerAuth?.ok
			? null
			: `When you are ready to deploy: ${cyan('pnpm exec wrangler login')}`
	});

	console.log('');
	console.log(`  ${bold(gradient('homeport doctor'))}`);
	console.log('');
	const nameWidth = Math.max(...rows.map((r) => r.name.length));
	for (const r of rows) {
		const mark = r.ok ? green('✓') : yellow('!');
		console.log(`  ${mark}  ${r.name.padEnd(nameWidth)}   ${r.detail}`);
		if (!r.ok && r.fix) console.log(`     ${dim('→')} ${r.fix}`);
	}
	console.log('');

	const anyFail = rows.some((r) => !r.ok && r.name !== 'wrangler auth');
	process.exit(anyFail ? 1 : 0);
}

// ------------------------------ main -----------------------------------

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const cmd = args._[0] || 'run';
	switch (cmd) {
		case 'help':
		case '-h':
		case '--help':
			showHelp();
			return;
		case 'doctor':
			cmdDoctor();
			return;
		case 'run':
			await cmdRun(args);
			return;
		default:
			console.error(`${red('✗')} Unknown command: ${cmd}`);
			showHelp();
			process.exit(1);
	}
}

main().catch((err) => {
	console.error(`${red('✗')} ${err?.stack || err?.message || String(err)}`);
	process.exit(1);
});
