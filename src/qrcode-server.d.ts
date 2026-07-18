// The `qrcode` package ships a browser build at its main entry (canvas-based,
// unusable in the Workers runtime) and a server build at `qrcode/lib/server.js`
// (zlib-based PNG rendering, works under nodejs_compat). `@types/qrcode` only
// declares the main entry, so we map the server subpath to the same typed API.
declare module 'qrcode/lib/server.js' {
	import QRCode from 'qrcode';
	export = QRCode;
}
