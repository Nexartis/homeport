import type { GossipMessage, FederationPeer } from '$lib/types/federation-v2';
import type { PeerService } from './peers';

export class PeerAuthError extends Error {
	readonly status: 401 | 403;

	constructor(message: string, status: 401 | 403) {
		super(message);
		this.name = 'PeerAuthError';
		this.status = status;
	}
}

export async function verifySignedPeerRequest(opts: {
	message: GossipMessage;
	peers: PeerService;
	verifySignature: (message: GossipMessage, publicKeyBase64?: string) => Promise<boolean>;
}): Promise<FederationPeer> {
	const peer = await opts.peers.getPeer(opts.message.node_id);
	if (!peer) {
		throw new PeerAuthError('Unknown federation peer', 401);
	}
	if (!peer.public_key_spki) {
		throw new PeerAuthError('Peer public key not enrolled', 403);
	}
	const ok = await opts.verifySignature(opts.message, peer.public_key_spki);
	if (!ok) {
		throw new PeerAuthError('Invalid or missing gossip signature', 401);
	}
	return peer;
}
