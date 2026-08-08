# SG 2.1 Semantic

This branch contains the active SG 2.1 architecture and completed executable production foundation through Block 16.16. Repository-wide audit hardening has also wired the Internal Event Bus, Contract Versioning and Domain Runtime into production composition and closed cross-module observability, feature-result and Render-startup compatibility defects. Block 17 — Render Deployment is next.

## Requirements
- Node.js 22
- npm 10+

## Start
```bash
npm ci
npm test
npm run check
npm start
npm run start:worker
```

By default, `npm start` runs the deterministic production-like runtime fixture and does not spend AI tokens.

To enable the Block 15 production AI path, configure the deployment secret and explicit controls:

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
- Block 11 — Runtime Composition
- Block 12 — PostgreSQL Persistence
- Block 13 — Durable Automation and Workers
- Block 14 — Telegram Production Integration
- Block 15 — Production AI Integration
- Block 16 — Production Capabilities
- Block 16.5 — Temporal Context
- Block 16.6 — Language & Locale Context
- Block 16.7 — Configuration & Policy Layer
- Block 16.8 — Secrets & Credentials Management
- Block 16.9 — External Connections Registry
- Block 16.10 — Resource Ownership & Authority Model
- Block 16.11 — Session & Conversation Context
- Block 16.12 — User Settings & Preferences
- Block 16.13 — Notification & Delivery Router
- Block 16.14 — Internal Event Bus
- Block 16.15 — Schema & Contract Versioning
- Block 16.16 — Feature Flags & Controlled Rollout

### Next
- Block 17 — Render Deployment
- Block 18 — End-to-End Verification
- Block 19 — Security and Operations
- Pilot Launch

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
- canonical outer Action Gate evidence is bound to the same actor/project/group/thread before domain execution
- fail-closed source and permission validation
- domains cannot own or redefine Semantic Kernel, Identity, Action Gate or trust order
- production composition includes the Domain Runtime; source-backed domains remain fail-closed until their approved source resolvers are configured
- cross-domain namespace and scope-isolation tests

### Block 11 — Runtime Composition
- one executable runtime entrypoint with explicit dependency injection
- validated environment configuration and lifecycle management
- health, readiness and graceful shutdown
- complete deterministic production-like request path

### Block 12 — PostgreSQL Persistence
- PostgreSQL pool and transaction boundary
- versioned repeatable migrations
- durable scoped repositories for identity, access, conversations, memory, automation, idempotency, observability and domain data
- durable runtime observability with shutdown flushing

### Block 13 — Durable Automation and Workers
- persistent PostgreSQL task queue and scheduler
- separate worker runtime with atomic claiming
- leases, heartbeat and abandoned-work recovery
- bounded retry, exponential backoff and dead-letter queue
- persisted approval, cancellation and idempotency
- Action Gate immediately before protected execution
- worker health and durable observability

### Block 14 — Telegram Production Integration
- production webhook endpoint with constant-time secret verification
- durable Telegram update deduplication in PostgreSQL
- Bot API client with `sendMessage`, webhook management, timeout and bounded retry
- flood-control handling using Telegram `retry_after`
- private chats, groups, supergroups and topic isolation
- group addressing through reply, mention and Telegram metadata only
- arbitrary natural-language messages passed unchanged into SG runtime
- full `TelegramTransportAdapter → SG runtime → Telegram delivery` path
- normalized bounded Telegram failures and sandbox configuration

### Block 15 — Production AI Integration
- production OpenAI Responses API composition only through AI Router
- specialized-first registry and configured fallback
- emergency disable switch and explicit enablement
- sensitive-context rejection and defensive prompt boundary
- strict structured output validation
- hard timeout, bounded retry and output-token limit
- estimated and actual cost enforcement by role
- provider, model, reason, latency, usage and cost telemetry
- deterministic analysis-only failure fallback
- default deterministic runtime remains token-free

### Block 16 — Production Capabilities
- conversational response through `compose-answer`
- scoped memory read and confirmed memory write
- task create, list, status and cancellation
- approved source retrieval with visible failures
- bounded document analysis with embedded instructions treated as data
- repository analysis restricted to read-only or prepare-only behavior
- bounded SG diagnostics
- controlled domain dispatch
- capability requirements resolved before Action Gate evaluation
- protected capabilities remain permission-, scope-, risk-, cost- and confirmation-bound

### Block 16.5 — Temporal Context
- canonical UTC and user-local temporal context
- IANA timezone persistence through global identity/user settings
- deterministic relative-date/time resolution
- normalized task and schedule times
- temporal memory recall and DST-aware recurrence support

### Block 16.6 — Language & Locale Context
- automatic per-message language detection with deterministic fast path
- low-confidence language detection fallback only through AI Router
- transport-independent preferred language persisted through `global_user_id`
- scoped conversation language continuity by user/project/group/thread
- deterministic response-language priority and natural language switching
- mixed-language input handling without mandatory pre-translation
- separate language and locale context with Temporal Context interoperability
- Telegram/Discord/Web/API/Email/Voice locale hints through thin adapters
- language-aware AI response composition through AI Router
- safe language preference read/write capabilities through existing Action Gate
- cross-language memory reuse through the existing ContextBundle path
- privacy-bounded `language_context_resolved` observability
- PostgreSQL persistence and multilingual CI coverage

Detailed specification and acceptance evidence: `pillars/roadmap/16_6_LANGUAGE_AND_LOCALE_CONTEXT.md`.

### Block 16.7 — Configuration & Policy Layer
- one typed, transport-independent configuration and policy resolver
- centralized defaults for action, AI, capability, source, autonomy, automation, delivery, memory and repository policy inputs
- explicit precedence `defaults → environment → project → role` with stable role ordering
- immutable effective-policy snapshots with per-value provenance
- validated environment-specific overrides without new mandatory Render variables
- safe hot reload limited to an explicit operational allowlist; authorization-sensitive policy cannot hot-reload
- Action Gate consumes resolved risk, cost, confirmation and source-limit policy while core permission/scope/capability boundaries remain fail-closed
- Capability Executor consumes policy only as a tightening bound on retries/timeouts
- Production AI operational timeout/retry inputs are composed through the policy layer while AI Router remains mandatory
- `policy_context_resolved` observability is secret-free and durable
- invalid/unknown policy values fail validation instead of being guessed
- unit, integration, PostgreSQL runtime, startup and worker CI coverage

Detailed specification and acceptance evidence: `pillars/roadmap/16_7_CONFIGURATION_AND_POLICY_LAYER.md`.

### Blocks 16.8–16.16 — Foundational control layers
The completed dependency chain is:
`Secrets → Connections → Resource Authority → Conversation Context → User Settings → Delivery Router → Event Bus → Contract Versioning → Feature Flags`.

The repository-wide audit after Block 16.16 additionally verified and hardened the cross-module composition:
- legacy operational observability event names are normalized into the canonical observability contract instead of crashing producers;
- Internal Event Bus is a live production resource with PostgreSQL-backed delivery where persistence is enabled;
- Contract Versioning validates canonical input and capability input/result boundaries and retains PostgreSQL quarantine support;
- Feature Flag disabled execution returns the canonical `CapabilityResult` contract;
- Domain Runtime consumes the canonical GateDecision for the same actor/scope and cannot create an independent authority path;
- Render startup rolls back the HTTP server and runtime if webhook registration fails after partial startup.

Individual implementation and acceptance evidence remains in `pillars/roadmap/16_8_*.md` through `16_16_FEATURE_FLAGS_AND_CONTROLLED_ROLLOUT.md`.

## Runtime direction
Current production-composed path is:
`Platform Input → Transport Adapter → Identity/Scope → User Settings/Conversation/Language Context → Contract Version Check → Semantic Kernel → Context Resolution → Decision Engine → Capability Selection → Connection/Resource Authority where required → Action Gate → Feature/Contract-gated Capability or Domain Runtime → Delivery Router where required → Response → Observability/Internal Events`.

The production interpretation route remains:
`ProductionMeaningInterpreter → AIRouter → ProductionAiPolicy → ModelRegistry → AIProvider`

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
- Transports provide platform facts but cannot assign roles, grants, final scopes or final response-language policy.
- Configuration/policy cannot silently become authorization.
- Raw secrets cannot enter ordinary memory, prompts or telemetry.
- Connections are not identities and do not prove resource ownership.
- Resource authority is explicit and complements Identity, Scope and Access.
- Conversation state is not confirmed memory.
- User preferences cannot weaken mandatory safety/authorization.
- Delivery cannot target unauthorized users/resources.
- Internal events cannot bypass protected execution paths.
- Contract adapters cannot broaden trust, scope or permissions.
- Feature flags can restrict availability but cannot grant access or authority.
- Observability records facts but does not change architecture or business logic.
- Domain modules consume platform contracts and cannot redefine the SG core.
- Production AI is disabled by default to avoid accidental cost.
- Original natural-language text remains available to Semantic Kernel; multilingual support does not require mandatory pre-translation.

## Current boundary
Blocks 0–16.16 provide the completed executable SG 2.1 foundation. Block 17 Render Deployment is the next roadmap stage, followed by Block 18 End-to-End Verification, Block 19 Security and Operations, and Pilot Launch.

## Authority
Read in this order:
1. `pillars/DECISIONS.md`
2. `pillars/README.md`
3. `pillars/architecture/README.md`
4. `pillars/roadmap/README.md`
5. `pillars/workflow/README.md`
