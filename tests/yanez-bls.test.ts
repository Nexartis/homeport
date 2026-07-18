/**
 * Yanez BLS + encoding unit tests (pure, no DB).
 */
import { describe, it, expect } from 'vitest';
import { bls12_381 } from '@noble/curves/bls12-381';
import {
	verifyBls,
	BLS_DST,
	ethAddressFromG1PubkeyHex,
	verifyAddressBinding,
	looksLikeEthAddress
} from '../src/lib/crypto/yanez-bls';
import {
	bytesToHex,
	hexToBytes,
	b64url,
	b64urlDecode,
	utf8Bytes,
	utf8String
} from '../src/lib/crypto/yanez-encoding';

describe('yanez-encoding', () => {
	it('hex round-trips', () => {
		const bytes = new Uint8Array([0, 1, 15, 16, 255]);
		expect(hexToBytes(bytesToHex(bytes))).toEqual(bytes);
		expect(bytesToHex(bytes)).toBe('00010f10ff');
	});

	it('b64url round-trips without padding', () => {
		const msg = 'nanda-yanez:hello world';
		const encoded = b64url(utf8Bytes(msg));
		expect(encoded).not.toContain('=');
		expect(utf8String(b64urlDecode(encoded))).toBe(msg);
	});

	it('hexToBytes rejects malformed hex', () => {
		expect(() => hexToBytes('zz')).toThrow();
		expect(() => hexToBytes('abc')).toThrow();
	});
});

describe('yanez-bls', () => {
	it('verifies a valid BLS signature over the message', () => {
		const priv = bls12_381.utils.randomPrivateKey();
		const pub = bls12_381.getPublicKey(priv);
		const message = utf8Bytes('challenge-abc');
		const sig = bls12_381.sign(message, priv, { DST: BLS_DST });
		expect(verifyBls(bytesToHex(sig), bytesToHex(pub), message)).toBe(true);
	});

	it('rejects a signature over a different message', () => {
		const priv = bls12_381.utils.randomPrivateKey();
		const pub = bls12_381.getPublicKey(priv);
		const sig = bls12_381.sign(utf8Bytes('one'), priv, { DST: BLS_DST });
		expect(verifyBls(bytesToHex(sig), bytesToHex(pub), utf8Bytes('two'))).toBe(false);
	});

	it('rejects a signature from a different key', () => {
		const priv = bls12_381.utils.randomPrivateKey();
		const other = bls12_381.utils.randomPrivateKey();
		const pub = bls12_381.getPublicKey(priv);
		const message = utf8Bytes('challenge-abc');
		const sig = bls12_381.sign(message, other, { DST: BLS_DST });
		expect(verifyBls(bytesToHex(sig), bytesToHex(pub), message)).toBe(false);
	});

	it('derives a stable EIP-55 address and validates binding', () => {
		const priv = bls12_381.utils.randomPrivateKey();
		const pubHex = bytesToHex(bls12_381.getPublicKey(priv));
		const derived = ethAddressFromG1PubkeyHex(pubHex);
		expect(looksLikeEthAddress(derived)).toBe(true);
		expect(verifyAddressBinding(derived, pubHex).ok).toBe(true);
		expect(verifyAddressBinding('0x' + '00'.repeat(20), pubHex).ok).toBe(false);
	});
});
