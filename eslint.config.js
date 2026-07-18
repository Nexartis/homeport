import prettier from 'eslint-config-prettier';
import { fileURLToPath } from 'node:url';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

export default defineConfig(
	// Ignore CommonJS helper scripts in scripts/ — the one place Pegasus/AI
	// creates .cjs files (e.g. scripts/patch-*.cjs wrangler patchers). Narrowed
	// from a blanket '**/*.cjs' so stray CJS elsewhere in src/ still gets linted.
	{ ignores: ['scripts/**/*.cjs'] },
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: { globals: { ...globals.browser, ...globals.node } }
	},
	{
		// typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
		// Scoped to TS/Svelte files only so plain .js files still benefit from no-undef checks.
		// see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
		files: ['**/*.ts', '**/*.tsx', '**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
		rules: {
			'no-undef': 'off'
		}
	},
	{
		// ── AI-tuned rules ──────────────────────────────────────────────────
		// Scoped to files where @typescript-eslint plugin is active.
		// These relaxations reduce unnecessary repair-loop cycles for
		// AI-generated code while keeping rules that catch real bugs.
		files: ['**/*.ts', '**/*.tsx', '**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],

		rules: {
			// AI frequently over-imports; warn instead of error so the quality
			// gate still reports them but they don't trigger a full repair cycle.
			// Allow _-prefixed args (common callback convention).
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_'
				}
			],

			// Empty functions are legitimate in AI-generated event handlers,
			// callbacks, and placeholder implementations.
			'@typescript-eslint/no-empty-function': 'off',

			// AI often adds explicit types for clarity (e.g., `const x: number = 5`).
			// This is harmless and improves readability of generated code.
			'@typescript-eslint/no-inferrable-types': 'off',

			// Enforce const for variables that are never reassigned.
			// Auto-fixable — the auto-fix pipeline handles this before the quality gate.
			// Safe with Svelte 5 runes: eslint-plugin-svelte's parser marks $state(),
			// $derived(), and $props() declarations as mutable, so prefer-const won't
			// flag or auto-fix them. Verified in eslint-plugin-svelte ≥3.x.
			'prefer-const': 'error'
		}
	},
	{
		// ── AI-tuned Svelte rules ─────────────────────────────────────────
		// Tier 2 (Best Practice) rules: important for code quality but NOT
		// runtime-breaking. Downgraded to 'warn' so the quality gate still
		// reports them but they don't trigger expensive AI repair loops.
		//
		// Tier 1 (Correctness) rules like infinite-reactive-loop,
		// no-dom-manipulating, no-reactive-reassign, valid-each-key, etc.
		// remain at 'error' (their recommended defaults).
		//
		// See: ../cubicube-insta-noc/PEGASUS-SYSTEM-AUDIT.md for rationale.
		files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],

		languageOptions: {
			parserOptions: {
				projectService: true,
				extraFileExtensions: ['.svelte'],
				parser: ts.parser,
				svelteConfig
			}
		},

		rules: {
			// Missing {#each} keys = slower DOM diffing, can cause UI glitches on reorder.
			// AI consistently forgets keys at scale (67% of errors in production).
			'svelte/require-each-key': 'warn',

			// Redundant $state() around reactive classes (SvelteSet, SvelteMap).
			// Harmless — just an unnecessary wrapper. #1 cause of cascading repairs.
			'svelte/no-unnecessary-state-wrap': 'warn',

			// Stale svelte-ignore comments from Svelte 4→5 migration.
			// Dead comments, zero runtime impact.
			'svelte/no-unused-svelte-ignore': 'warn',

			// Style preference: $derived vs $state+$effect. Both are correct.
			'svelte/prefer-writable-derived': 'warn',

			// Context engineering has eliminated this error category.
			// Keep as warn for visibility without triggering repair loops.
			// ignoreGoto: goto() calls with resolve() + query concatenation
			// (e.g. goto(resolve('/path') + '?' + params)) are valid but the
			// rule's static analysis can't see through BinaryExpression.
			// href checks remain fully enforced — those are the primary vector
			// for AI pattern-copying errors.
			'svelte/no-navigation-without-resolve': ['warn', { ignoreGoto: true }],

			// Unnecessary mustache interpolation (e.g. {'static text'} vs static text).
			// Pure style issue, auto-fixable.
			'svelte/no-useless-mustaches': 'warn',

			// Explicit children snippet where default slot suffices.
			// Style preference, no runtime impact.
			'svelte/no-useless-children-snippet': 'warn',

			// Defined but unused props — code smell, not a bug.
			'svelte/no-unused-props': 'warn'
		}
	},
	{
		// ── Frozen-file pragma ────────────────────────────────────────────
		// CLAUDE.md forbids AI edits to service modules, tests, admin infra,
		// docs pages, and generated .d.ts files. Any lint errors reported
		// against those paths are pre-existing and outside the Pegasus repair
		// surface. Downgrade the specific error rules that fire there to
		// warnings so the quality gate can still surface them, but they
		// don't block the deploy pipeline.
		files: [
			'tests/**/*.ts',
			'src/routes/docs/**/*.svelte',
			'src/routes/admin/+layout.svelte',
			'src/routes/admin/+layout.server.ts',
			'src/routes/admin/settings/audit/+page.svelte',
			'src/lib/services/**/*.ts',
			'src/lib/components/admin/AdminTabBar.svelte',
			'src/cloudflare-test.d.ts'
		],
		rules: {
			'svelte/no-at-html-tags': 'warn',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-empty-object-type': 'warn',
			'@typescript-eslint/no-unused-expressions': 'warn',
			'no-empty': 'warn',
			'no-useless-escape': 'warn',
			'svelte/prefer-svelte-reactivity': 'warn'
		}
	}
);
