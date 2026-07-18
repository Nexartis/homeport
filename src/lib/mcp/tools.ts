/**
 * MCP Tool Definitions for NANDA Infrastructure Services
 *
 * Each tool has a name, description, and JSON Schema inputSchema
 * that MCP clients use to discover and invoke tools.
 */

export interface McpToolDefinition {
	name: string;
	description: string;
	inputSchema: {
		type: 'object';
		properties: Record<string, unknown>;
		required?: string[];
	};
}

export const NANDA_MCP_TOOLS: McpToolDefinition[] = [
	{
		name: 'nanda_lookup_agent',
		description:
			'Look up a specific agent by its ID in the NANDA registry and return its full registration details.',
		inputSchema: {
			type: 'object',
			properties: {
				agent_id: { type: 'string', description: 'The agent ID to look up' }
			},
			required: ['agent_id']
		}
	},
	{
		name: 'nanda_search_agents',
		description:
			'Search for registered agents in the NANDA registry by query string, capabilities, or tags.',
		inputSchema: {
			type: 'object',
			properties: {
				query: { type: 'string', description: 'Free-text search query' },
				capabilities: {
					type: 'array',
					items: { type: 'string' },
					description: 'Filter by agent capabilities'
				},
				tags: {
					type: 'array',
					items: { type: 'string' },
					description: 'Filter by agent tags'
				}
			}
		}
	},
	{
		name: 'nanda_list_agents',
		description: 'List all registered agents in the NANDA registry with their IDs and URLs.',
		inputSchema: {
			type: 'object',
			properties: {}
		}
	},
	{
		name: 'nanda_get_reputation',
		description:
			'Get reputation and trust score data for agents, including availability, error rate, probe success, certification grade, and composite reputation score.',
		inputSchema: {
			type: 'object',
			properties: {
				agent_id: {
					type: 'string',
					description: 'Optional agent ID to filter results to a single agent'
				}
			}
		}
	},
	{
		name: 'nanda_check_cert',
		description:
			'Check whether a specific certificate has been revoked. Returns revocation status, reason, and timestamp if revoked.',
		inputSchema: {
			type: 'object',
			properties: {
				cert_id: { type: 'string', description: 'The certificate ID to check' }
			},
			required: ['cert_id']
		}
	},
	{
		name: 'nanda_check_health',
		description:
			'Check NANDA infrastructure service health, including database, R2 storage, and KV cache.',
		inputSchema: {
			type: 'object',
			properties: {}
		}
	},
	{
		name: 'nanda_register_agent',
		description: 'Register or update an agent in the NANDA registry. Upserts by agent_id.',
		inputSchema: {
			type: 'object',
			properties: {
				agent_id: { type: 'string', description: 'Unique agent identifier' },
				agent_url: { type: 'string', description: 'Primary URL of the agent' },
				api_url: { type: 'string', description: 'Optional API endpoint URL' },
				facts_url: { type: 'string', description: 'Optional AgentFacts URL' },
				capabilities: {
					type: 'array',
					items: { type: 'string' },
					description: 'Agent capabilities'
				},
				tags: { type: 'array', items: { type: 'string' }, description: 'Agent tags' }
			},
			required: ['agent_id', 'agent_url']
		}
	},
	{
		name: 'nanda_get_agentfacts',
		description:
			'Retrieve the AgentFacts metadata document for an agent, including skills, capabilities, trust scores, and compliance status.',
		inputSchema: {
			type: 'object',
			properties: {
				agent_id: { type: 'string', description: 'The agent ID to retrieve facts for' }
			},
			required: ['agent_id']
		}
	},
	{
		name: 'nanda_resolve_agent',
		description:
			'Resolve an agent to its best endpoint using the Lean Index AgentAddr system. Returns signed resolution record with trust score.',
		inputSchema: {
			type: 'object',
			properties: {
				agent_id: { type: 'string', description: 'The agent ID to resolve' }
			},
			required: ['agent_id']
		}
	},
	{
		name: 'nanda_federation_status',
		description:
			'Get federation status including v1 pull-sync peers, v2 CRDT gossip stats, quilt routes, and peer list.',
		inputSchema: {
			type: 'object',
			properties: {}
		}
	},
	{
		name: 'nanda_create_workflow',
		description: 'Create a multi-agent orchestration workflow with DAG-ordered steps.',
		inputSchema: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'Workflow name' },
				description: { type: 'string', description: 'Workflow description' },
				steps: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							step_id: { type: 'string' },
							agent_id: { type: 'string' },
							action: { type: 'string' },
							depends_on: { type: 'array', items: { type: 'string' } }
						}
					},
					description: 'Ordered workflow steps with dependencies'
				}
			},
			required: ['name', 'steps']
		}
	},
	{
		name: 'nanda_run_workflow',
		description:
			'Execute a previously created orchestration workflow. Returns the workflow run ID and initial status.',
		inputSchema: {
			type: 'object',
			properties: {
				workflow_id: { type: 'string', description: 'The workflow ID to execute' },
				input: { type: 'object', description: 'Input parameters for the workflow run' }
			},
			required: ['workflow_id']
		}
	},
	{
		name: 'nanda_trust_scores',
		description:
			'Get trust framework scores for agents, including federation trust, cross-registry scores, and behavior metrics.',
		inputSchema: {
			type: 'object',
			properties: {
				agent_id: { type: 'string', description: 'Optional agent ID to filter scores' }
			}
		}
	},
	{
		name: 'nanda_compliance_check',
		description:
			'Check compliance status for an agent, including policy evaluations, violations, and scan results.',
		inputSchema: {
			type: 'object',
			properties: {
				agent_id: { type: 'string', description: 'The agent ID to check compliance for' }
			},
			required: ['agent_id']
		}
	},
	{
		name: 'nanda_subscribe_webhook',
		description:
			'Create a webhook subscription to receive events for agent registrations, certification changes, reputation updates, and more.',
		inputSchema: {
			type: 'object',
			properties: {
				url: { type: 'string', description: 'Webhook delivery URL' },
				events: {
					type: 'array',
					items: { type: 'string' },
					description:
						'Event types to subscribe to (e.g., agent.registered, cert.issued, reputation.updated)'
				},
				secret: { type: 'string', description: 'Optional HMAC secret for payload signing' }
			},
			required: ['url', 'events']
		}
	},
	// ── Switchboard tools ──
	{
		name: 'nanda_discover_agent',
		description:
			'Auto-discover an agent by probing its URL for supported protocols (A2A, MCP, NLWeb, NANDA). Extracts metadata and registers protocol adapters.',
		inputSchema: {
			type: 'object',
			properties: {
				url: { type: 'string', description: 'Agent URL to probe for protocol discovery' }
			},
			required: ['url']
		}
	},
	{
		name: 'nanda_list_adapters',
		description:
			'List all protocol adapters registered for an agent, showing which protocols were detected and their metadata.',
		inputSchema: {
			type: 'object',
			properties: {
				agent_id: { type: 'string', description: 'The agent ID to list adapters for' }
			},
			required: ['agent_id']
		}
	},
	{
		name: 'nanda_export_agent',
		description:
			"Export an agent's metadata to a target protocol format (A2A Agent Card, MCP descriptor, or NLWeb descriptor).",
		inputSchema: {
			type: 'object',
			properties: {
				agent_id: { type: 'string', description: 'The agent ID to export' },
				target_protocol: {
					type: 'string',
					enum: ['a2a', 'mcp', 'nlweb'],
					description: 'Target protocol format'
				}
			},
			required: ['agent_id', 'target_protocol']
		}
	},
	// ── Payment tools ──
	{
		name: 'nanda_get_exchange_rates',
		description:
			'Get exchange rates between supported currencies (NP, USDC, USDT, DAI, EURC). Returns a single pair rate or all pairs.',
		inputSchema: {
			type: 'object',
			properties: {
				from: { type: 'string', description: 'Source currency code (e.g., NP, USDC)' },
				to: { type: 'string', description: 'Target currency code' }
			}
		}
	},
	{
		name: 'nanda_get_wallet_balance',
		description:
			'Get multi-currency wallet balances for an agent, showing holdings across all supported currencies.',
		inputSchema: {
			type: 'object',
			properties: {
				agent_id: { type: 'string', description: 'The agent ID to get balances for' }
			},
			required: ['agent_id']
		}
	},
	{
		name: 'nanda_convert_currency',
		description: 'Convert an amount between supported currencies using current exchange rates.',
		inputSchema: {
			type: 'object',
			properties: {
				from: { type: 'string', description: 'Source currency code' },
				to: { type: 'string', description: 'Target currency code' },
				amount: { type: 'number', description: 'Amount to convert' }
			},
			required: ['from', 'to', 'amount']
		}
	}
];
