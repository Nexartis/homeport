/**
 * Structured JSON Logger — P3-2
 *
 * Emits JSON lines for Cloudflare Logpush compatibility.
 * Respects LOG_LEVEL from env (debug < info < warn < error).
 *
 * Usage:
 *   const log = createLogger(env, 'compliance');
 *   log.info('evaluatePolicy', 'Policy evaluated', { decision: 'ALLOW' });
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3
};

export interface Logger {
	debug(fn: string, msg: string, meta?: Record<string, unknown>): void;
	info(fn: string, msg: string, meta?: Record<string, unknown>): void;
	warn(fn: string, msg: string, meta?: Record<string, unknown>): void;
	error(fn: string, msg: string, meta?: Record<string, unknown>): void;
}

/**
 * Create a structured logger bound to a service name.
 *
 * @param env - Worker env (reads LOG_LEVEL)
 * @param service - Service name (e.g. 'compliance', 'certifier')
 * @returns Logger with level-filtered JSON output
 */
export function createLogger(env?: { LOG_LEVEL?: string }, service?: string): Logger {
	const minLevel = LEVEL_ORDER[(env?.LOG_LEVEL as LogLevel) ?? 'info'] ?? LEVEL_ORDER.info;

	function emit(level: LogLevel, fn: string, msg: string, meta?: Record<string, unknown>): void {
		if (LEVEL_ORDER[level] < minLevel) return;
		const entry = {
			ts: new Date().toISOString(),
			level,
			service: service ?? 'unknown',
			fn,
			msg,
			...meta
		};
		// Use the appropriate console method for Workers log levels
		switch (level) {
			case 'debug':
				console.debug(JSON.stringify(entry));
				break;
			case 'warn':
				console.warn(JSON.stringify(entry));
				break;
			case 'error':
				console.error(JSON.stringify(entry));
				break;
			default:
				console.log(JSON.stringify(entry));
		}
	}

	return {
		debug: (fn, msg, meta) => emit('debug', fn, msg, meta),
		info: (fn, msg, meta) => emit('info', fn, msg, meta),
		warn: (fn, msg, meta) => emit('warn', fn, msg, meta),
		error: (fn, msg, meta) => emit('error', fn, msg, meta)
	};
}
