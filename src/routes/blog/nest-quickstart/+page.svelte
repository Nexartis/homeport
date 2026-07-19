<script lang="ts">
	import { page } from '$app/state';
	import { Terminal, Calendar, Clock, Rocket, Code, Network, Cpu, Server } from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { browser } from '$app/environment';
</script>

<svelte:head>
	<title>NEST Quickstart: Deploy Your First NANDA Agent | Blog — Homeport</title>
	<meta
		name="description"
		content="A step-by-step tutorial for deploying AI agents with NEST — the NANDA Sandbox and Testbed. From zero to a discoverable, communicating agent in minutes."
	/>
	<meta property="og:title" content="NEST Quickstart — Homeport" />
	<meta
		property="og:description"
		content="Deploy your first NANDA agent with the NEST framework — from zero to discoverable agent in minutes."
	/>
	<meta property="og:url" content="{page.data.registryUrl}/blog/nest-quickstart" />
	<meta property="og:image" content="{page.data.registryUrl}/og/blog-nest-quickstart.png" />
	<meta name="twitter:image" content="{page.data.registryUrl}/og/blog-nest-quickstart.png" />
</svelte:head>

<article class="mx-auto max-w-3xl px-4 py-8">
	<header class="mb-10" in:fade={{ duration: browser ? 300 : 0 }}>
		<div class="flex items-center gap-3 mb-4">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-success/20 px-2.5 py-0.5 text-[10px] font-medium text-nanda-success"
				>Published</span
			>
			<span class="flex items-center gap-1 text-sm text-nanda-text-dim"
				><Calendar class="h-4 w-4" />February 2026</span
			>
			<span class="flex items-center gap-1 text-sm text-nanda-text-dim"
				><Clock class="h-4 w-4" />7 min read</span
			>
		</div>
		<h1 class="text-3xl font-bold text-nanda-text sm:text-4xl mb-4">
			NEST Quickstart: Deploy Your First NANDA Agent
		</h1>
		<p class="text-lg text-nanda-text-muted leading-relaxed">
			A step-by-step tutorial for deploying AI agents with NEST — the NANDA Sandbox and Testbed.
			From zero to a discoverable, communicating agent in minutes.
		</p>
		<div class="mt-6 flex flex-wrap gap-2">
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-primary-500/10 px-2.5 py-1 text-xs font-medium text-nanda-primary-400"
				><Terminal class="h-3 w-3" /> Tutorial</span
			>
			<span
				class="inline-flex items-center gap-1 rounded-full bg-nanda-accent/10 px-2.5 py-1 text-xs font-medium text-nanda-accent"
				><Rocket class="h-3 w-3" /> Hands-On</span
			>
		</div>
	</header>

	<div class="prose max-w-none">
		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 100 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Rocket class="h-5 w-5 text-nanda-primary" />What is NEST?
			</h2>
			<p>
				<a href="https://nest.projectnanda.org" target="_blank" rel="noopener"
					><strong>NEST</strong></a
				>
				(NANDA Sandbox and Testbed) is the official framework for deploying and managing AI agents within
				the NANDA ecosystem. Built as part of
				<a href="https://nanda.mit.edu/" target="_blank" rel="noopener">Project NANDA</a>, NEST
				provides:
			</p>
			<ul>
				<li>
					<strong>One-command deployment</strong> to AWS EC2 — single agents or multi-agent clusters
				</li>
				<li>
					<strong>Built-in A2A communication</strong> — agents find and talk to each other using
					<code>@agent-id</code> syntax
				</li>
				<li>
					<strong>MCP integration</strong> — agents discover and execute tools from MCP servers
				</li>
				<li>
					<strong>Automatic NANDA Index registration</strong> — agents are discoverable globally as soon
					as they're deployed
				</li>
				<li>
					<strong>Claude-powered reasoning</strong> — agents use Anthropic's Claude for intelligent task
					handling
				</li>
			</ul>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 200 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Code class="h-5 w-5 text-nanda-accent" />Prerequisites
			</h2>
			<p>Before you start, you'll need:</p>
			<div class="not-prose grid gap-3 my-6 sm:grid-cols-3">
				<div class="nanda-card text-center">
					<Cpu class="h-6 w-6 text-nanda-primary mx-auto mb-2" />
					<h4 class="font-semibold text-nanda-text text-sm mb-1">AWS CLI</h4>
					<p class="text-xs text-nanda-text-muted">Configured with valid credentials</p>
				</div>
				<div class="nanda-card text-center">
					<Terminal class="h-6 w-6 text-nanda-accent mx-auto mb-2" />
					<h4 class="font-semibold text-nanda-text text-sm mb-1">Anthropic API Key</h4>
					<p class="text-xs text-nanda-text-muted">For Claude-powered reasoning</p>
				</div>
				<div class="nanda-card text-center">
					<Server class="h-6 w-6 text-nanda-primary-400 mx-auto mb-2" />
					<h4 class="font-semibold text-nanda-text text-sm mb-1">Python 3.8+</h4>
					<p class="text-xs text-nanda-text-muted">For local development</p>
				</div>
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 300 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Terminal class="h-5 w-5 text-nanda-primary" />Step 1: Deploy a Single Agent
			</h2>
			<p>Clone the NEST repository and deploy your first agent with a single command:</p>
			<pre><code
					># See nest.projectnanda.org for install instructions
git clone &lt;nest-repository-url&gt; nest
cd nest

bash scripts/aws-single-agent-deployment.sh \
  "my-first-agent" \
  "sk-ant-api03-YOUR_KEY" \
  "My First NANDA Agent" \
  "general assistant" \
  "helpful AI assistant" \
  "A general-purpose AI agent for testing" \
  "question-answering,summarization,analysis"</code
				></pre>
			<p>
				This command provisions an EC2 instance, installs dependencies, deploys the agent, registers
				it with the NANDA Index, and starts the health monitoring system. Your agent is globally
				discoverable within seconds.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 400 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Network class="h-5 w-5 text-nanda-accent" />Step 2: Test Agent Communication
			</h2>
			<p>Once deployed, test your agent directly:</p>
			<pre><code
					>curl -X POST http://AGENT_IP:6000/a2a \
  -H "Content-Type: application/json" \
  -d '&#123;
    "content": &#123;
      "text": "Hello! What can you help me with?",
      "type": "text"
    &#125;,
    "role": "user",
    "conversation_id": "test-001"
  &#125;'</code
				></pre>
			<p>
				To test <strong>agent-to-agent communication</strong>, deploy a second agent and use the
				<code>@agent-id</code> syntax:
			</p>
			<pre><code
					>curl -X POST http://AGENT_A_IP:6000/a2a \
  -H "Content-Type: application/json" \
  -d '&#123;
    "content": &#123;
      "text": "@my-second-agent Can you help analyze this data?",
      "type": "text"
    &#125;,
    "role": "user",
    "conversation_id": "a2a-test"
  &#125;'</code
				></pre>
			<p>
				Agent A will automatically discover Agent B through the NANDA registry, establish a
				communication channel, and relay the task — all via the <a href="/blog/nanda-a2a-mcp"
					>A2A protocol</a
				>.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 500 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Code class="h-5 w-5 text-nanda-primary-400" />Step 3: MCP Tool Integration
			</h2>
			<p>
				NEST agents can discover and execute tools from MCP servers using a simple hash syntax. Two
				registries are supported out of the box:
			</p>
			<p><strong>Smithery MCP servers</strong> — access the public Smithery registry:</p>
			<pre><code
					>curl -X POST http://AGENT_IP:6000/a2a \
  -H "Content-Type: application/json" \
  -d '&#123;
    "content": &#123;
      "text": "#smithery:@weather-server get current weather in NYC",
      "type": "text"
    &#125;,
    "role": "user",
    "conversation_id": "mcp-test"
  &#125;'</code
				></pre>
			<p><strong>NANDA MCP servers</strong> — access the NANDA ecosystem registry:</p>
			<pre><code
					>curl -X POST http://AGENT_IP:6000/a2a \
  -H "Content-Type: application/json" \
  -d '&#123;
    "content": &#123;
      "text": "#nanda:nanda-points get my current points balance",
      "type": "text"
    &#125;,
    "role": "user",
    "conversation_id": "nanda-test"
  &#125;'</code
				></pre>
			<p>
				The agent automatically discovers the MCP server from the appropriate registry, connects,
				uses Claude to select the right tools, and returns formatted results. This bridges NANDA's
				agent discovery with Anthropic's <a href="/blog/nanda-a2a-mcp">Model Context Protocol</a>.
			</p>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 600 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Server class="h-5 w-5 text-nanda-accent" />Step 4: Multi-Agent Deployment
			</h2>
			<p>
				Ready to scale? NEST supports deploying <strong>10+ agents per instance</strong> using pre-configured
				agent groups:
			</p>
			<pre><code
					>bash scripts/aws-multi-agent-deployment.sh \
  "sk-ant-api03-YOUR_KEY" \
  "scripts/agent_configs/group-01-business-and-finance-experts.json" \
  "smithery-key-xxxxx" \
  "https://nest.example.com" \
  "https://your-mcp-registry.ngrok-free.app" \
  "us-east-1" \
  "t3.xlarge"</code
				></pre>
			<p>
				NEST ships with pre-configured agent groups spanning Business &amp; Finance, Technology
				&amp; Engineering, Healthcare, Creative &amp; Design, Education, Media, Environmental, and
				more — up to <strong>100 agent personalities</strong> ready to deploy.
			</p>
			<div class="callout callout-tip">
				<strong>Production tip.</strong>
				Use <code>t3.micro</code> for cost-effective single-agent deployment and
				<code>t3.xlarge</code> or larger for multi-agent clusters. Deploy across multiple AWS regions
				for high availability.
			</div>
		</section>

		<section
			class="mb-12"
			in:fly={{ y: browser ? 20 : 0, duration: browser ? 400 : 0, delay: browser ? 700 : 0 }}
		>
			<h2 class="flex items-center gap-2">
				<Cpu class="h-5 w-5 text-nanda-primary" />Architecture at a Glance
			</h2>
			<p>NEST's modular architecture separates concerns cleanly:</p>
			<ul>
				<li>
					<strong><code>nanda_core/</code></strong> — Core framework: NANDA adapter, A2A agent bridge,
					and registry client
				</li>
				<li>
					<strong><code>nanda_core/discovery/</code></strong> — Agent discovery system for finding peers
					across the network
				</li>
				<li>
					<strong><code>nanda_core/telemetry/</code></strong> — Monitoring, health checks, and performance
					metrics
				</li>
				<li>
					<strong><code>examples/</code></strong> — Reference agent implementation and personality configurations
				</li>
				<li>
					<strong><code>scripts/</code></strong> — Deployment automation and agent group configs
				</li>
			</ul>
			<p>
				Every deployed agent includes automatic health checks, registry registration, process
				management via supervisor, individual logs, and performance metrics collection —
				production-ready out of the box.
			</p>
		</section>

		<section class="not-prose border-t border-nanda-border/40 pt-8">
			<h3 class="text-sm font-semibold text-nanda-text-dim uppercase tracking-wider mb-4">
				Continue Reading
			</h3>
			<div class="grid gap-3 sm:grid-cols-2">
				<a href="/blog/nanda-a2a-mcp" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						NANDA, A2A, and MCP
					</h4>
					<p class="text-xs text-nanda-text-dim">
						How the three protocols work together as complementary layers.
					</p>
				</a>
				<a href="/blog/quilt-architecture" class="nanda-card group block">
					<h4
						class="font-semibold text-nanda-text group-hover:text-nanda-accent transition-colors text-sm mb-1"
					>
						The Quilt Architecture
					</h4>
					<p class="text-xs text-nanda-text-dim">
						Decentralized registry federation that powers agent discovery.
					</p>
				</a>
			</div>
		</section>
	</div>
</article>
