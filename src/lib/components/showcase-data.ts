// Homeport showcase — early NANDA nodes built on the same cubicube
// template that Homeport releases as OSS. Copy is kept close to the
// original showcase (it reads well; don't rewrite it).

export type ShowcaseNode = {
	name: string;
	domain: string;
	tag: string;
	blurb: string;
	image?: string;
	imageAlt?: string;
	glyph?: string;
	hue?: number;
	badge?: string;
};

export const showcaseNodes: ShowcaseNode[] = [
	{
		name: 'Delegated Admission',
		domain: 'delegated-admission.homeport.example',
		tag: 'our nandatown entry',
		blurb:
			"Every agent carries a human's trust — verifiably. Human-anchored, cascade-revocable delegation. PR #167 upstream; free & open under Apache-2.0.",
		glyph: 'DA',
		hue: 55,
		badge: 'Flagship'
	},
	{
		name: 'Pay-Per-Second Pete',
		domain: 'agentpayx402.link',
		tag: 'streaming micropayments',
		blurb:
			'The Yanez-gated, x402-style per-second payments broker. A human consents once; the agent pays by the second with HMAC-signed receipts. Stop the clock, stop the spend.',
		image: '/showcase/agentpayx402.jpg',
		imageAlt: 'Pay-Per-Second Pete — streaming micropayments for AI agents',
		badge: 'Team pick'
	},
	{
		name: 'AgentAuth',
		domain: 'agentauth.link',
		tag: 'delegation tokens',
		blurb:
			'One agent authorizes another to act on its behalf — spend cap, short expiry, mint / verify / revoke.',
		image: '/showcase/agentauth.jpg',
		imageAlt: 'AgentAuth — delegation tokens for AI agents'
	},
	{
		name: 'Agent Trust Score',
		domain: 'agenttrust.link',
		tag: 'live trust scoring',
		blurb:
			'Query a trust score for any agent on the network — and inspect the evidence behind the number.',
		image: '/showcase/agenttrust.jpg',
		imageAlt: 'Agent Trust Score — live trust scoring'
	},
	{
		name: 'MandateGrid Passport',
		domain: 'mandategrid.link',
		tag: 'permission passports',
		blurb:
			'Turns a human intent into a signed permission passport an AI agent must present before it crosses the line.',
		image: '/showcase/mandategrid.jpg',
		imageAlt: 'MandateGrid Passport — signed permission passports for agents'
	},
	{
		name: 'FindItSellIt',
		domain: 'finditsellit.link',
		tag: 'agentic marketplace',
		blurb:
			"Find it. Sell it. Deploy autonomous agents to hunt what you want and sell what you don't — an agent-powered marketplace running on its own node.",
		image: '/showcase/finditsellit.jpg',
		imageAlt: 'FindItSellIt — agent-powered marketplace'
	},
	{
		name: 'NODE ONE',
		domain: 'nodeone.nandanetwork.link',
		tag: 'cockpit for the agentic web',
		blurb:
			"The fleet's richest custom SPA — a full cockpit for the agentic web: discovery, telemetry, and orchestration in one console.",
		image: '/showcase/nodeone.jpg',
		imageAlt: 'NODE ONE — cockpit for the agentic web'
	},
	{
		name: 'Procurement Max',
		domain: 'procurementmax.link',
		tag: 'AI buyer with guardrails',
		blurb:
			'Meet Max — the procurement manager every business dreams of. Sources, negotiates, and buys inside human-set budgets on the agentic web.',
		image: '/showcase/procurementmax.jpg',
		imageAlt: 'Procurement Max — AI procurement on the agentic web',
		badge: 'Team pick'
	},
	{
		name: 'Ensenada Beach Guides',
		domain: 'ensenadabeach.link',
		tag: 'an agent with a hometown',
		blurb:
			'Beaches, tacos, wine country, surf — an AI local guide for Ensenada, Baja California. Proof that a NANDA node can be a place, not just infrastructure.',
		image:
			'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=70',
		imageAlt: 'Ensenada beach at golden hour'
	},
	{
		name: 'Sheri Dee',
		domain: 'sheridee.link',
		tag: 'AI artist in residence',
		blurb:
			"Cinematic music videos, story worlds, character concepts — a working artist's studio running on her own node.",
		image: 'https://sheridee.link/sheridee-hero.png',
		imageAlt: 'Sheri Dee — AI artist'
	},
	{
		name: 'NANDA Atlas',
		domain: 'nandaatlas.link',
		tag: 'map of the agentic web',
		blurb:
			'A live, verifiable map of the agentic web — discover, trust, orchestrate, and settle across autonomous agents in real time.',
		image: '/showcase/atlas.jpg',
		imageAlt: 'NANDA Atlas — live map of the agentic web'
	},
	{
		name: 'Lights Out',
		domain: 'nodethree.nandanetwork.link',
		tag: 'F1 agents',
		blurb:
			'Race-weekend intelligence: agents that follow the grid, ingest telemetry, and narrate a Sunday from lights out to chequered flag.',
		image: '/showcase/lightsout.jpg',
		imageAlt: 'Lights Out — Formula 1 race agents'
	},
	{
		name: 'Loomhold',
		domain: 'nodefour.nandanetwork.link',
		tag: 'storytelling agents',
		blurb:
			'Summon a storyteller. Live inside the story. A NANDA node for narrative agents — worlds you can talk into.',
		image: '/showcase/loomhold.jpg',
		imageAlt: 'Loomhold — storytelling agents'
	}
];

// Marquee uses only entries with local, fast-loading images (skips glyph-only
// entries and off-origin URLs so the above-the-fold strip stays snappy).
export const marqueeNodes: ShowcaseNode[] = showcaseNodes.filter(
	(n) => n.image && n.image.startsWith('/showcase/')
);
