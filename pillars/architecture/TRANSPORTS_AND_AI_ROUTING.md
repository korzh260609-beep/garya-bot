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
