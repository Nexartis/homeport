# Registry and Discovery — Current State

## Responsibility

This document owns current-state registry, public discovery, AgentFacts, AgentAddr, SafeSearch, and lookup behavior. Federation transport details live in [`FEDERATION_RESOLUTION.md`](FEDERATION_RESOLUTION.md); protocol contracts live in [`MCP_API_CONTRACTS.md`](MCP_API_CONTRACTS.md).

## Product role

The registry is the node's public directory. It answers “what agents exist, what can they do, how trustworthy are they, and how should clients reach them?”

## Current surfaces

| Surface                    | Purpose                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `/register`                | Register or update an agent. The route still logs unauthenticated transition-period usage. |
| `/lookup/:id`              | Look up a local registered agent by ID.                                                    |
| `/search`                  | Search agents with trust/SafeSearch-style filters.                                         |
| `/list`                    | List registered agents.                                                                    |
| `/stats`                   | Public network statistics.                                                                 |
| `/agents`, `/agents/:id`   | Browser directory and agent detail pages.                                                  |
| `/agentfacts/:id`          | AgentFacts metadata and update route.                                                      |
| `/.well-known/nanda-index` | Public AgentAddr index.                                                                    |
| `/trust/badges`            | Trust badge endpoint.                                                                      |

## Data responsibilities

- `agents`, `agent_facts`, `clients`, and `agent_versions` hold registry-facing records.
- `agent_addrs` holds signed AgentAddr records for Lean Index style resolution.
- Trust and reputation data come from observer/trust domains; registry docs should link to those domains rather than duplicate formulas.

## Discovery flow

```mermaid
flowchart TD
  Register[Agent registration] --> Registry[(agents and agent_facts)]
  Registry --> Search[/search and /list]
  Registry --> Lookup[/lookup and /agents/:id]
  Registry --> Facts[/agentfacts/:id]
  Registry --> AgentAddr[(agent_addrs)]
  AgentAddr --> Index[well-known nanda-index]
  Search --> Safe[SafeSearch and trust filters]
  Lookup --> Consumer[Client, developer, or assistant]
  Index --> Resolver[Resolver and federation]
```

## Boundaries

- Registry endpoints expose agent metadata and public discovery state; they must not expose private operator secrets.
- AgentFacts and AgentAddr signing depend on node key material. Key setup is an operations concern documented in [`OPERATIONS.md`](OPERATIONS.md).
- The migration from dual `agents` / `agent_addrs` state to a single AgentAddr source remains a current architectural gap.

## Current risks to monitor

- Some update paths are in a transition period before stricter API-key requirements.
- Historical planning docs include future migration plans for unifying `agents` and `agent_addrs`; those plans are not current-state behavior.
- OpenAPI coverage for public routes is partial; some SvelteKit routes are not yet annotated in `static/openapi.json`.
