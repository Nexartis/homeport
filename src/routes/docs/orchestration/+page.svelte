<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Orchestration — Homeport</title>
	<meta
		name="description"
		content="Multi-agent workflow orchestration with DAG engine, A2A routing, sub-agent delegation, streaming, and conflict resolution."
	/>
	<meta property="og:image" content="{page.data.registryUrl}/og/docs-orchestration.png" />
</svelte:head>

<div class="prose">
	<h1>Multi-Agent Orchestration</h1>
	<p>
		NANDA's orchestration layer enables you to compose <strong>multi-agent workflows</strong> as directed
		acyclic graphs (DAGs) — routing tasks to the best agents, delegating sub-tasks, streaming results,
		and resolving conflicts automatically.
	</p>

	<div class="callout callout-info">
		<strong>Key concepts:</strong> Workflows → Steps → Runs → Step Runs. Each step targets an agent
		and action, with optional dependencies forming the DAG. Workflows start in <code>draft</code>
		status and must be set to <code>active</code> before runs can be executed.
	</div>

	<h2>Creating a Workflow</h2>
	<pre><code class="language-bash"
			>{@html `curl -X POST https://your-node.example.com/api/orchestration \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Research &amp; Summarize",
    "ownerId": "my-app",
    "dag": {
      "nodes": [
        { "id": "search", "type": "task", "data": {
          "stepType": "agent_call", "agentId": "search-agent"
        }},
        { "id": "summarize", "type": "task", "data": {
          "stepType": "agent_call", "agentId": "summarize-agent"
        }}
      ],
      "edges": [
        { "source": "search", "target": "summarize" }
      ]
    }
  }'`}</code
		></pre>

	<h2>DAG Validation</h2>
	<p>
		All workflow DAGs are validated using <strong>Kahn's algorithm</strong> for topological sorting. The
		validator checks for:
	</p>
	<ul>
		<li><strong>No cycles</strong> — topological sort must include all nodes</li>
		<li><strong>No duplicate node IDs</strong></li>
		<li><strong>All edge references exist</strong> — source and target must be valid node IDs</li>
		<li><strong>At least one root node</strong> — nodes with no incoming edges</li>
	</ul>
	<p>
		The validation result includes the <code>executionOrder</code> (topological sort),
		<code>rootNodes</code>, and <code>leafNodes</code>.
	</p>

	<h2>Workflow Lifecycle</h2>
	<div class="grid grid-cols-2 sm:grid-cols-4 gap-2 my-4 not-prose text-center">
		<div class="nanda-card !py-2">
			<p class="text-xs font-bold text-amber-400">draft</p>
			<p class="text-[10px] text-nanda-text-muted">Created, not yet runnable</p>
		</div>
		<div class="nanda-card !py-2">
			<p class="text-xs font-bold text-green-400">active</p>
			<p class="text-[10px] text-nanda-text-muted">Ready for execution</p>
		</div>
		<div class="nanda-card !py-2">
			<p class="text-xs font-bold text-blue-400">running</p>
			<p class="text-[10px] text-nanda-text-muted">Run in progress</p>
		</div>
		<div class="nanda-card !py-2">
			<p class="text-xs font-bold text-nanda-text-muted">completed / failed / cancelled</p>
			<p class="text-[10px] text-nanda-text-muted">Terminal states</p>
		</div>
	</div>
	<p>
		Runs can be <strong>cancelled externally</strong> — the engine checks the run status before each step
		and at finalization to respect concurrent cancellation.
	</p>

	<h2>Step Execution</h2>
	<p>
		Steps are executed via a <strong>pluggable StepExecutor</strong> interface. Each step receives the
		workflow run input and a map of outputs from completed predecessor steps. Step configuration:
	</p>
	<table>
		<thead><tr><th>Field</th><th>Description</th></tr></thead>
		<tbody>
			<tr><td><code>stepType</code></td><td>Execution type (e.g. <code>agent_call</code>)</td></tr>
			<tr><td><code>agentId</code></td><td>Target agent for this step</td></tr>
			<tr><td><code>action</code></td><td>Action to invoke on the agent</td></tr>
			<tr><td><code>timeoutMs</code></td><td>Step timeout (default: 30000ms)</td></tr>
			<tr><td><code>retryCount</code></td><td>Number of retries on failure (default: 0)</td></tr>
			<tr><td><code>retryDelayMs</code></td><td>Delay between retries (default: 1000ms)</td></tr>
			<tr><td><code>condition</code></td><td>Optional conditional execution rules</td></tr>
		</tbody>
	</table>

	<h2>Workflow Features</h2>
	<div class="grid gap-4 my-6 not-prose">
		<div class="nanda-card border-l-[3px] !border-l-violet-500">
			<h3 class="font-semibold mb-1">DAG Engine</h3>
			<p class="text-sm text-nanda-text-muted">
				Kahn's algorithm for cycle detection and topological ordering. Parallel branches execute
				concurrently via <code>Promise.all</code>. All state persisted in D1.
			</p>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-amber-500">
			<h3 class="font-semibold mb-1">A2A Routing</h3>
			<p class="text-sm text-nanda-text-muted">
				Multi-strategy agent selection using trust scores, latency, capability match, and geographic
				proximity. <code>POST /api/orchestration/route</code>
			</p>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-green-500">
			<h3 class="font-semibold mb-1">Sub-Agent Delegation</h3>
			<p class="text-sm text-nanda-text-muted">
				Delegate tasks to specialized sub-agents with progress tracking and result aggregation.
				<code>POST /api/orchestration/delegate</code>
			</p>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-blue-500">
			<h3 class="font-semibold mb-1">Conflict Resolution</h3>
			<p class="text-sm text-nanda-text-muted">
				Automatic and manual conflict resolution when agents produce conflicting results.
				Strategies: first-wins, majority-vote, highest-trust, manual.
			</p>
		</div>
		<div class="nanda-card border-l-[3px] !border-l-rose-500">
			<h3 class="font-semibold mb-1">Patterns &amp; Templates</h3>
			<p class="text-sm text-nanda-text-muted">
				Pre-built orchestration patterns: fan-out, pipeline, consensus, map-reduce. Create custom
				patterns via <code>POST /api/orchestration/patterns</code>.
			</p>
		</div>
	</div>

	<h2>API Endpoints</h2>
	<table>
		<thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead>
		<tbody>
			<tr><td>POST</td><td><code>/api/orchestration</code></td><td>Create workflow</td></tr>
			<tr><td>GET</td><td><code>/api/orchestration</code></td><td>List workflows</td></tr>
			<tr><td>GET</td><td><code>/api/orchestration/:id</code></td><td>Get workflow details</td></tr>
			<tr><td>PATCH</td><td><code>/api/orchestration/:id</code></td><td>Update workflow</td></tr>
			<tr><td>DELETE</td><td><code>/api/orchestration/:id</code></td><td>Delete workflow</td></tr>
			<tr><td>POST</td><td><code>/api/orchestration/:id/runs</code></td><td>Start run</td></tr>
			<tr><td>GET</td><td><code>/api/orchestration/:id/runs</code></td><td>List runs</td></tr>
			<tr><td>GET</td><td><code>/api/orchestration/runs/:runId</code></td><td>Run details</td></tr>
			<tr
				><td>POST</td><td><code>/api/orchestration/route</code></td><td>Route to best agent</td></tr
			>
			<tr><td>POST</td><td><code>/api/orchestration/delegate</code></td><td>Delegate task</td></tr>
			<tr><td>POST</td><td><code>/api/orchestration/conflicts</code></td><td>Raise conflict</td></tr
			>
			<tr><td>GET</td><td><code>/api/orchestration/patterns</code></td><td>List patterns</td></tr>
		</tbody>
	</table>

	<h2>MCP Integration</h2>
	<p>
		Orchestration is available via MCP tools: <code>nanda_create_workflow</code> and
		<code>nanda_run_workflow</code>. Connect your AI assistant directly to the orchestration engine.
	</p>

	<div class="callout callout-tip">
		<strong>See also</strong>
		<a href="/docs/resolver">Resolution &amp; Discovery</a> for adaptive agent routing ·
		<a href="/docs/mcp">MCP Tools</a> for programmatic access ·
		<a href="/docs/trust">Trust &amp; Security</a> for agent trust scores used in routing
	</div>

	<div class="callout callout-info">
		<strong>Related reading</strong>
		<a href="/blog/self-improving-agents">Self-Improving Agents</a> — autonomous optimization
		through multi-agent workflows ·
		<a href="/series/agentic-web/new-architecture">A New Architecture</a> — the infrastructure vision
		powering agent orchestration
	</div>
</div>
