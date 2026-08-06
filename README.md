# SG 2.1 Semantic

This branch contains the active SG 2.1 architecture and executable platform core through Block 4.

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

## Runtime path
`CanonicalInput → MeaningInterpreter → SemanticInterpretation → DecisionEngine → DecisionEnvelope → ActionRequest → ActionGate → GateDecision → ResponsePlan`

The production interpretation route remains:
`ProductionMeaningInterpreter → AIRouter → ModelRegistry → AIProvider`

## Core rules
- SG modules do not call AI providers directly.
- Every production model call passes through AI Router.
- Model output is validated before it enters semantic contracts.
- Decision Engine decides but does not authorize or execute.
- Action Gate authorizes, blocks, requests confirmation or downgrades; it never interprets meaning or executes capabilities.
- Protected actions cannot bypass Action Gate.
- Production AI is disabled by default to avoid accidental cost.

## Current boundary
The in-memory memory and idempotency providers are working reference implementations, not durable production storage. Database persistence and migrations are intentionally deferred. The branch still contains no Capability System, Telegram transport, production identity linking or protected execution.

## Authority
Read in this order:
1. `pillars/DECISIONS.md`
2. `pillars/README.md`
3. `pillars/architecture/README.md`
4. `pillars/roadmap/README.md`
5. `pillars/workflow/README.md`
