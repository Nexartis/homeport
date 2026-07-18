#!/usr/bin/env node
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import pngToIco from 'png-to-ico';
import { writeFileSync, mkdirSync, readFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATIC = join(__dirname, '..', 'static');
const OG_DIR = join(STATIC, 'og');
mkdirSync(OG_DIR, { recursive: true });

const C = {
	bg: '#0a0a0f',
	surface: '#12121a',
	primary: '#6942e6',
	accent: '#0cd3da',
	text: '#fafafa',
	muted: '#94a3b8',
	dim: '#71717a'
};

const SECTION_CLR = {
	Home: C.primary,
	About: C.primary,
	Agents: C.accent,
	Research: C.primary,
	Docs: '#3b82f6',
	Blog: C.accent,
	'Case Studies': '#f59e0b',
	'Case Study': '#f59e0b',
	Series: '#10b981'
};

const PAGES = [
	{
		slug: 'default',
		title: 'Homeport',
		section: 'Home',
		subtitle: 'The open-source, self-hostable NANDA node — every agent needs a homeport'
	},
	{
		slug: 'home',
		title: 'Homeport',
		section: 'Home',
		subtitle: 'Every agent needs a homeport — identity, trust, and settlement at the edge'
	},
	{
		slug: 'about',
		title: 'About Nexartis NANDA Node',
		section: 'About',
		subtitle: 'Open infrastructure for the agentic web'
	},
	{
		slug: 'agents',
		title: 'Agent Registry',
		section: 'Agents',
		subtitle: 'Discover and register AI agents on the NANDA network'
	},
	{
		slug: 'research',
		title: 'Research',
		section: 'Research',
		subtitle: 'Academic foundations of the NANDA protocol'
	},
	{
		slug: 'docs',
		title: 'Documentation',
		section: 'Docs',
		subtitle: 'Complete technical documentation for NANDA'
	},
	{
		slug: 'docs-nanda',
		title: 'Project NANDA',
		section: 'Docs',
		subtitle: 'The DNS for AI Agents'
	},
	{
		slug: 'docs-agentfacts',
		title: 'AgentFacts',
		section: 'Docs',
		subtitle: 'Verifiable credential protocol for AI agents'
	},
	{
		slug: 'docs-a2a',
		title: 'A2A Protocol',
		section: 'Docs',
		subtitle: 'Agent-to-Agent communication standard'
	},
	{
		slug: 'docs-quickstart',
		title: 'Quickstart',
		section: 'Docs',
		subtitle: 'Deploy your first NANDA agent in minutes'
	},
	{
		slug: 'docs-federation',
		title: 'Federation',
		section: 'Docs',
		subtitle: 'Multi-node NANDA network federation'
	},
	{
		slug: 'docs-api',
		title: 'API Reference',
		section: 'Docs',
		subtitle: 'Complete REST API documentation'
	},
	{
		slug: 'docs-trust',
		title: 'Trust & Security',
		section: 'Docs',
		subtitle: 'Zero-trust agent authentication framework'
	},
	{
		slug: 'docs-infrastructure',
		title: 'Infrastructure',
		section: 'Docs',
		subtitle: 'Edge-native deployment architecture'
	},
	{
		slug: 'blog',
		title: 'Blog',
		section: 'Blog',
		subtitle: 'Insights on the NANDA protocol and the agentic web'
	},
	{
		slug: 'blog-adaptive-resolution',
		title: 'Adaptive Resolution',
		section: 'Blog',
		subtitle: 'Smart Routing for the Agentic Web'
	},
	{
		slug: 'blog-building-agent-dns',
		title: 'Building DNS for AI Agents',
		section: 'Blog',
		subtitle: 'Our NANDA Index Implementation'
	},
	{
		slug: 'blog-crdt-gossip',
		title: 'CRDT Gossip',
		section: 'Blog',
		subtitle: 'How NANDA Nodes Stay in Sync'
	},
	{
		slug: 'blog-cross-platform-trust',
		title: 'Cross-Platform Trust Signals',
		section: 'Blog',
		subtitle: 'How Reputation Flows Between KYM and NANDA'
	},
	{
		slug: 'blog-developer-api-keys',
		title: 'Developer API Keys',
		section: 'Blog',
		subtitle: 'For Decentralized Infrastructure'
	},
	{
		slug: 'blog-protocol-bridge',
		title: 'The Protocol Bridge',
		section: 'Blog',
		subtitle: 'Making Every Agent Discoverable'
	},
	{
		slug: 'blog-self-improving-agents',
		title: 'The Self-Improving Agent Stack',
		section: 'Blog',
		subtitle: 'Agents that get better without human intervention'
	},
	{
		slug: 'blog-nanda-a2a-mcp',
		title: 'NANDA, A2A, and MCP',
		section: 'Blog',
		subtitle: 'Complementary Layers of the Agentic Stack'
	},
	{
		slug: 'blog-agentfacts',
		title: 'AgentFacts: Verifiable Credentials',
		section: 'Blog',
		subtitle: 'How agents prove identity and capability'
	},
	{
		slug: 'blog-quilt-architecture',
		title: 'The Quilt Architecture',
		section: 'Blog',
		subtitle: 'Decentralized Agent Discovery'
	},
	{
		slug: 'blog-privacy-dual-path',
		title: 'Privacy-Preserving Discovery',
		section: 'Blog',
		subtitle: 'The dual-path resolution model'
	},
	{
		slug: 'blog-zero-trust-agents',
		title: 'Zero Trust for AI Agents',
		section: 'Blog',
		subtitle: 'Building trust without central authority'
	},
	{
		slug: 'blog-why-dns-fails',
		title: 'Why DNS Fails for AI Agents',
		section: 'Blog',
		subtitle: "Static records can't describe dynamic capabilities"
	},
	{
		slug: 'blog-paradigm-shift',
		title: 'From Web Pages to AI Agents',
		section: 'Blog',
		subtitle: 'The Paradigm Shift'
	},
	{
		slug: 'blog-nest-quickstart',
		title: 'NEST Quickstart',
		section: 'Blog',
		subtitle: 'Deploy Your First NANDA Agent'
	},
	{
		slug: 'case-studies',
		title: 'Case Studies',
		section: 'Case Studies',
		subtitle: 'Real-world NANDA deployments'
	},
	{
		slug: 'case-studies-nexartis-nanda-node',
		title: 'Nexartis NANDA Node',
		section: 'Case Study',
		subtitle: 'Operating a federated NANDA node at scale'
	},
	{
		slug: 'case-studies-kym-nanda-integration',
		title: 'KYM + NANDA Integration',
		section: 'Case Study',
		subtitle: 'Know Your Model meets the agent registry'
	},
	{
		slug: 'series-agentic-web',
		title: 'The Agentic Web',
		section: 'Series',
		subtitle: 'A six-part deep dive into agent infrastructure'
	},
	{
		slug: 'series-agentic-web-new-architecture',
		title: 'A New Architecture for a New Web',
		section: 'Series',
		subtitle: 'Part 1 — The Agentic Web'
	},
	{
		slug: 'series-agentic-web-agent-identity',
		title: 'Agent Identity — Beyond DNS',
		section: 'Series',
		subtitle: 'Part 2 — The Agentic Web'
	},
	{
		slug: 'series-agentic-web-trust-without-borders',
		title: 'Trust Without Borders',
		section: 'Series',
		subtitle: 'Part 3 — The Agentic Web'
	},
	{
		slug: 'series-agentic-web-agent-privacy',
		title: 'Agent Privacy',
		section: 'Series',
		subtitle: 'Part 4 — Discovery Without Exposure'
	},
	{
		slug: 'series-agentic-web-security-blueprint',
		title: 'The Security Blueprint',
		section: 'Series',
		subtitle: 'Part 5 — The Agentic Web'
	},
	{
		slug: 'series-agentic-web-governance-at-scale',
		title: 'Governance at Scale',
		section: 'Series',
		subtitle: 'Part 6 — The Agentic Web'
	},
	{
		slug: 'contact',
		title: 'Contact',
		section: 'Contact',
		subtitle: 'Get in touch with the Homeport team — enterprise, support, partnerships'
	},
	{
		slug: 'developers',
		title: 'Developers',
		section: 'Developers',
		subtitle: 'Build on Homeport — API keys, docs, and tools for AI agent registration and discovery'
	},
	{
		slug: 'docs-billing',
		title: 'Billing & Payments',
		section: 'Docs',
		subtitle: 'Subscriptions, invoices, revenue sharing, and the Universal Checkout Protocol'
	},
	{
		slug: 'docs-data-model',
		title: 'Data Model',
		section: 'Docs',
		subtitle: '53-table Drizzle ORM schema across 21 domains — the NANDA node data architecture'
	},
	{
		slug: 'docs-developers',
		title: 'Developer API Keys',
		section: 'Docs',
		subtitle: 'Authentication, rate limits, tiers, and endpoint access for the developer program'
	},
	{
		slug: 'docs-mcp',
		title: 'MCP Integration',
		section: 'Docs',
		subtitle: 'Model Context Protocol server with 21 tools for AI assistant integration'
	},
	{
		slug: 'docs-orchestration',
		title: 'Orchestration',
		section: 'Docs',
		subtitle: 'Multi-agent workflow orchestration with a DAG engine, A2A routing, and streaming'
	},
	{
		slug: 'docs-resolver',
		title: 'Resolution & Discovery',
		section: 'Docs',
		subtitle: 'Adaptive multi-strategy resolution with composite scoring and SafeSearch filtering'
	},
	{
		slug: 'docs-toip',
		title: 'ToIP Alignment',
		section: 'Docs',
		subtitle: 'Trust over IP framework registration and DIF trust graph model for AI agents'
	},
	{
		slug: 'docs-webhooks',
		title: 'Webhooks',
		section: 'Docs',
		subtitle: 'Real-time event notifications with HMAC-SHA256 signing and circuit breaker protection'
	},
	{
		slug: 'sdk',
		title: 'SDK',
		section: 'Docs',
		subtitle: 'The official Homeport TypeScript SDK — registration, A2A discovery, and orchestration'
	},
	{
		slug: 'self-hosting',
		title: 'Self-Hosting a NANDA Node',
		section: 'Docs',
		subtitle: 'Run your own NANDA node on Cloudflare Workers — fork, configure bindings, deploy'
	}
];

async function loadFonts() {
	console.log('Loading fonts...');
	const fonts = await Promise.all(
		[400, 700].map(async (weight) => {
			const url = `https://cdn.jsdelivr.net/npm/@fontsource/inter/files/inter-latin-${weight}-normal.woff`;
			const res = await fetch(url);
			if (!res.ok) throw new Error(`Font fetch failed: ${url} (${res.status})`);
			const data = await res.arrayBuffer();
			console.log(`  ✓ Inter ${weight} (${(data.byteLength / 1024).toFixed(0)} KB)`);
			return { name: 'Inter', data, weight, style: 'normal' };
		})
	);
	return fonts;
}

function ogElement(page) {
	const sc = SECTION_CLR[page.section] || C.primary;
	const fs = page.title.length > 35 ? 48 : 56;
	return {
		type: 'div',
		props: {
			style: {
				display: 'flex',
				flexDirection: 'column',
				width: '100%',
				height: '100%',
				backgroundColor: C.bg,
				padding: '60px',
				fontFamily: 'Inter'
			},
			children: [
				{
					type: 'div',
					props: {
						style: {
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center',
							marginBottom: '40px'
						},
						children: [
							{
								type: 'div',
								props: {
									style: {
										fontSize: '28px',
										fontWeight: 700,
										letterSpacing: '0.1em',
										color: C.primary
									},
									children: 'Nexartis · NANDA Node'
								}
							},
							{
								type: 'div',
								props: {
									style: {
										fontSize: '16px',
										fontWeight: 700,
										color: sc,
										backgroundColor: sc + '20',
										padding: '8px 20px',
										borderRadius: '20px',
										border: `1px solid ${sc}40`,
										letterSpacing: '0.05em',
										textTransform: 'uppercase'
									},
									children: page.section
								}
							}
						]
					}
				},
				{
					type: 'div',
					props: {
						style: { display: 'flex', flex: 1, alignItems: 'center' },
						children: [
							{
								type: 'div',
								props: {
									style: {
										fontSize: `${fs}px`,
										fontWeight: 700,
										color: C.text,
										lineHeight: 1.2,
										maxWidth: '900px'
									},
									children: page.title
								}
							}
						]
					}
				},
				{
					type: 'div',
					props: {
						style: { display: 'flex', flexDirection: 'column', gap: '16px' },
						children: [
							{
								type: 'div',
								props: {
									style: { fontSize: '22px', color: C.muted, lineHeight: 1.4 },
									children: page.subtitle
								}
							},
							{
								type: 'div',
								props: {
									style: {
										width: '100%',
										height: '4px',
										borderRadius: '2px',
										backgroundImage: `linear-gradient(to right, ${C.primary}, ${C.accent})`
									}
								}
							},
							{
								type: 'div',
								props: {
									style: {
										fontSize: '16px',
										color: C.dim,
										letterSpacing: '0.02em',
										marginTop: '4px'
									},
									children: 'github.com/Nexartis/homeport'
								}
							}
						]
					}
				}
			]
		}
	};
}

async function renderOg(page, fonts) {
	const svg = await satori(ogElement(page), { width: 1200, height: 630, fonts });
	const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
	return resvg.render().asPng();
}

async function generateFaviconVariants() {
	console.log('\nGenerating favicon variants...');
	const faviconSvg = readFileSync(join(STATIC, 'favicon.svg'), 'utf-8');
	const sizes = [
		{ name: 'favicon-32.png', size: 32 },
		{ name: 'apple-touch-icon.png', size: 180 },
		{ name: 'icon-192.png', size: 192 },
		{ name: 'icon-512.png', size: 512 }
	];
	for (const { name, size } of sizes) {
		const resvg = new Resvg(faviconSvg, { fitTo: { mode: 'width', value: size } });
		const png = resvg.render().asPng();
		writeFileSync(join(STATIC, name), png);
		console.log(`  ✓ ${name} (${size}×${size}, ${(png.length / 1024).toFixed(1)} KB)`);
	}
	const png32 = readFileSync(join(STATIC, 'favicon-32.png'));
	const ico = await pngToIco([png32]);
	writeFileSync(join(STATIC, 'favicon.ico'), ico);
	console.log('  ✓ favicon.ico');
	unlinkSync(join(STATIC, 'favicon-32.png'));
}

async function main() {
	console.log('🎨 Nexartis NANDA Node — OG Image & Favicon Generator\n');
	const fonts = await loadFonts();
	console.log(`\nGenerating ${PAGES.length} OG images...`);
	for (const page of PAGES) {
		const png = await renderOg(page, fonts);
		writeFileSync(join(OG_DIR, `${page.slug}.png`), png);
		console.log(`  ✓ og/${page.slug}.png (${(png.length / 1024).toFixed(1)} KB)`);
	}
	await generateFaviconVariants();
	console.log(`\n✅ Done! Generated ${PAGES.length} OG images + favicon variants.`);
}

main().catch((err) => {
	console.error('❌ Error:', err);
	process.exit(1);
});
