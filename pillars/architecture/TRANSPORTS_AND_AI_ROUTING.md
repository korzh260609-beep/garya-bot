# SG 2.1 — TRANSPORTS AND AI ROUTING

## Transports
Telegram, Web/API, Discord, email, voice and future interfaces are thin adapters.

Transport responsibilities:
- receive input;
- resolve channel/platform metadata;
- expose available platform locale/language hints as platform facts;
- expose platform account/resource identifiers as facts for centralized identity/connection/resource resolution;
- resolve global identity through Identity service;
- convert input to canonical request;
- perform protocol-specific response or notification delivery when instructed by SG delivery logic.

Transport must not own semantic routing, permissions policy, durable memory logic, capability selection, resource ownership, external-connection authority, domain business logic, notification target policy or final response-language policy.

Language detection and response-language selection belong to shared SG Language & Locale Context. Platform locale is a hint/fallback, not the authoritative user-language profile. Ordinary multilingual messages are passed to SG Core in their original text form; transports do not perform mandatory pre-translation or keyword/command-based language routing.

Block 16.9 External Connections Registry owns durable knowledge of which service/account connections exist and their approved state. A transport instance is not itself proof that a user owns every resource visible through that platform.

Block 16.10 Resource Ownership & Authority owns verified user/project relationships to concrete groups, channels, repositories, documents and other resources.

Block 16.13 Notification & Delivery Router owns selection of authorized delivery target/channel for notifications and cross-transport delivery. Transports execute the final protocol call only.

## Discord production extension — Block 8.1

Block 8 already contains the generic Discord transport adapter contract. Block 8.1 is the production extension that connects this adapter to a live Discord bot without changing SG core ownership boundaries.

The production Discord path is:

```text
Discord Gateway / REST
→ thin Discord production integration
→ existing Discord TransportAdapter normalization
→ centralized Identity / Scope
→ canonical global_user_id
→ shared SG Core / Memory 2.0
→ existing Delivery Router
→ Discord delivery transport
```

Discord platform IDs, usernames, display names, nicknames, server roles and message text are platform facts only. They cannot create SG roles, grants, ownership or Monarch authority.

Cross-platform personal continuity is rooted in verified canonical `global_user_id` linking. Telegram and Discord accounts may share personal memory/settings/roles only after both resolve to the same verified Global ID. Descriptive profile similarity must never merge identities automatically.

Discord guild/channel/thread context must reuse existing Scope, Conversation Context and Resource Ownership & Authority boundaries. A new canonical scope dimension is introduced only if implementation evidence proves the current model is insufficient and a separate architecture decision is approved.

Discord delivery remains behind the existing Delivery Router. Discord server permissions determine only whether the bot can technically execute an already-approved platform action; they do not replace SG authorization.

Canonical implementation specification: `../roadmap/08_1_DISCORD_TRANSPORT_INTEGRATION.md`.

## AI routing
AI Router is a model-selection and cost-control component, not SG brain.

Responsibilities:
- model registry;
- modality matching;
- specialized-first policy;
- fallback;
- budget and cost metadata;
- call logging;
- propagation of approved language/locale and other bounded execution metadata to providers when needed.

All AI calls pass through the router/wrapper. Model replacement must not change SG architecture or ownership of decisions.

AI Router and providers do not own preferred language, resource authority, user settings, delivery policy or response-language policy. SG resolves those contexts through their approved layers, while AI executes the requested reasoning or specialized work within bounded context.

## Adaptive AI Routing 2.0

Adaptive AI Routing 2.0 (AR2) extends this existing router; it does not create a second router.

The shared cross-transport routing sequence is:

```text
canonical request
→ semantic/capability resolution
→ deterministic-vs-AI gate
→ task assessment when AI is required
→ minimum-sufficient tier selection
→ specialty/capability matching
→ reasoning-effort selection
→ existing AIRouter/provider boundary
→ deterministic/task-specific validation
→ bounded semantic escalation only when needed
```

Canonical tiers are:
- `L0`: deterministic execution without LLM;
- `L1`: low-cost AI for extraction/classification/normalization;
- `L2`: general AI for ordinary synthesis/conversation/planning;
- `L3`: advanced reasoning for difficult debugging/architecture/complex analysis.

Concrete provider model names are configuration. Telegram, Discord, Web/API, Email, voice or a future native interface cannot select or force a tier. The same request semantics under the same authorized context should produce the same routing class regardless of transport.

Provider fallback and semantic escalation are separate:
- fallback handles technical provider failure;
- escalation handles an insufficient but technically valid result according to validation/confidence policy.

A model cannot self-authorize escalation, broaden its minimum/maximum tier, bypass Access/Action Gate/Owner Security, or turn confidence into authority.

Canonical AR2 architecture: `ADAPTIVE_AI_ROUTING_2_0.md`.
Implementation stages and acceptance contract: `../roadmap/02_5_AI_ROUTING_FOUNDATION.md`.
