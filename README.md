# SG 2.1 Semantic

This branch contains the active SG 2.1 architecture and the completed executable platform roadmap through Block 10.

## Requirements
- Node.js 22
- npm 10+

## Start
```bash
npm ci
npm test
npm run check
npm start
```

By default, `npm start` runs the deterministic Block 2 context-memory fixture and does not spend AI tokens.

To run the Block 2.5 production reasoning path, configure a deployment secret and enable it explicitly:

```bash
OPENAI_API_KEY=...
SG_AI_ENABLED=true
npm start
```

All non-secret options are documented in `.env.example`. Real API keys must be stored only in the deployment secret store.

## Roadmap status

### Completed
- Block 0 — Engineering Foundation
- Block 1 — Semantic Kernel
- Block 2 — Context and Memory
- Block 2.5 — AI Routing Foundation
- Block 3 — Decision Engine
- Block 4 — Action Gate
- Block 5 — Capability System
- Block 6 — Identity and Scope
- Block 7 — Observability
- Block 8 — Interfaces
- Block 9 — Automation and Agents
- Block 10 — Domain Modules

## Implemented
### Block 0 — Engineering Foundation
- project structure, contracts, local runner, tests and CI
- minimal identity, scope, trace and error contracts

### Block 1 — Semantic Kernel
- canonical input and semantic contracts
- injected MeaningInterpreter boundary
- DecisionEnvelope and ResponsePlan contracts

### Block 2 — Context and Memory
- seven memory layers
- ContextRequest and ContextBundle
- provenance, trust, confirmation and expiration
- strict user/project/group/thread isolation
- duplicate and conflict detection
- bounded deterministic context selection
- working in-memory provider
- integration with Semantic Kernel

### Block 2.5 — AI Routing Foundation
- replaceable AI Provider and AI Router contracts
- specialized-first model registry and configurable fallback
- bounded retry, hard timeout and explicit normalized failures
- OpenAI Responses API provider with structured JSON output
- production MeaningInterpreter connected only through AI Router
- trace, reason, provider, model, latency, usage and cost metadata
- secret-safe telemetry and environment configuration
- contract, provider, failure-mode and Semantic Kernel integration tests

### Block 3 — Decision Engine
- separate deterministic Decision Engine owned outside Semantic Kernel
- candidate evaluation and stable priority-based selection
- answer, clarification and prepare-only classification
- explicit uncertainty and evidence-needs handling
- structured rationale and decision diagnostics
- executable and protected intent represented without authorization
- no permission checks and no capability execution
- compatibility, boundary and deterministic-decision tests

### Block 4 — Action Gate
- explicit ActionRequest and GateDecision contracts
- action classification and deterministic authorization outcomes
- identity, permission, scope and availability checks
- risk, cost and confirmation policies
- idempotency protection and privacy-bounded audit output
- safe downgrade to analysis or prepare-only behavior
- DecisionEnvelope-to-ActionRequest integration boundary
- no meaning interpretation and no capability execution

### Block 5 — Capability System
- normalized Capability, CapabilityExecutionRequest and CapabilityResult contracts
- replaceable capability registry with deterministic discovery and selection
- execution allowed only after an authorized Action Gate decision
- declared permission, source and tool requirements cannot exceed the gated request
- explicit success, partial, failed, timeout and unavailable results
- hard timeout, bounded retry and ordered fallback capabilities
- source, tool, cost, duration, attempt and trace metadata propagation
- visible failures and partial results without transport-specific behavior

### Block 6 — Identity and Scope
- centralized identity linking and actor resolution
- `globalUserId` as the root identity
- role, grant and final scope resolution outside transports
- strict user, project, group and thread boundaries
- fail-closed identity and scope behavior

### Block 7 — Observability
- trace propagation across core requests and execution
- separate audit, telemetry and debug records
- privacy-bounded and secret-safe observability
- model, gate, capability and failure evidence
- observability that records facts without changing decisions or behavior

### Block 8 — Interfaces
- common replaceable `TransportAdapter` contract
- Local, Telegram, Web/API, Discord, Email and Voice adapters
- centralized `InterfaceRegistry` and local test harness
- platform facts passed to Identity and Scope resolution
- canonical input creation and normalized response delivery
- trace ID, request ID, environment and revision propagation
- transports cannot assign roles, grants or final scopes
- cross-transport, group, thread and response-delivery tests

### Block 9 — Automation and Agents
- scheduled and queued task contracts
- workers, bounded retry and dead-letter queue behavior
- approval and cancellation flows
- protected automated actions pass Action Gate
- delegated agents remain replaceable components, not SG identities
- code and PR capabilities remain prepare-only
- observable and recoverable task execution

### Block 10 — Domain Modules
- stable domain module, capability, request and result contracts
- centralized replaceable domain registry and runtime
- document, repository, market, billing, psychology and Kingdom GARYA modules
- domain permissions, sources, memory, identity, scope and trace propagation
- mandatory Action Gate boundary before domain handlers execute
- fail-closed source and permission validation
- domains cannot own or redefine Semantic Kernel, Identity, Action Gate or trust order
- cross-domain namespace and scope-isolation tests

## Runtime path
`Platform Input → Transport Adapter → Platform Facts → Identity and Scope Resolution → CanonicalInput → MeaningInterpreter → SemanticInterpretation → Context Resolution → DecisionEngine → DecisionEnvelope → ActionRequest → ActionGate → GateDecision → CapabilityRegistry → CapabilityExecutor → CapabilityResult → ResponsePlan → Transport Response Delivery`

The production interpretation route remains:
`ProductionMeaningInterpreter → AIRouter → ModelRegistry → AIProvider`

Optional product domains enter only through stable capability, identity, scope, memory, source, gate and observability boundaries.

## Core rules
- SG modules do not call AI providers directly.
- Every production model call passes through AI Router.
- Model output is validated before it enters semantic contracts.
- Decision Engine decides but does not authorize or execute.
- Action Gate authorizes, blocks, requests confirmation or downgrades; it never interprets meaning or executes capabilities.
- Capability execution requires an allowed GateDecision and cannot broaden permissions, scope, sources or tools.
- Capabilities exist independently from commands and transports.
- Protected actions cannot bypass Action Gate.
- Platform IDs are identity links, not independent users.
- Transports provide platform facts but cannot assign roles, grants or final scopes.
- Observability records facts but does not change architecture or business logic.
- Domain modules consume platform contracts and cannot redefine the SG core.
- Production AI is disabled by default to avoid accidental cost.

## Current boundary
Blocks 0–10 provide the complete executable SG 2.1 platform foundation defined by the active roadmap. In-memory memory, idempotency, automation and domain integrations remain reference implementations with injected provider boundaries. Durable databases, production network clients, real external billing, market, document and repository providers, and product-specific deployment configuration must be connected through those boundaries without changing the core contracts.

## Authority
Read in this order:
1. `pillars/DECISIONS.md`
2. `pillars/README.md`
3. `pillars/architecture/README.md`
4. `pillars/roadmap/README.md`
5. `pillars/workflow/README.md`
