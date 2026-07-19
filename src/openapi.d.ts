declare module 'virtual:openapi-spec' {
	const spec: Record<string, unknown>;
	export default spec;
}

declare module 'swagger-ui-dist' {
	interface SwaggerUIBundleFn {
		(config: Record<string, unknown>): unknown;
		presets: { apis: unknown };
	}
	export const SwaggerUIBundle: SwaggerUIBundleFn;
	export const SwaggerUIStandalonePreset: unknown;
	/** CJS default — the module.exports object (NOT the bundle function) */
	interface SwaggerUIModule {
		SwaggerUIBundle: SwaggerUIBundleFn;
		SwaggerUIStandalonePreset: unknown;
		absolutePath: () => string;
		getAbsoluteFSPath: () => string;
	}
	const _default: SwaggerUIModule;
	export default _default;
}
