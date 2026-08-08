# SG 2.1 — TRANSPORTS AND AI ROUTING

## Transports
Telegram, Web/API, Discord, email, voice and future interfaces are thin adapters.

Transport responsibilities:
- receive input
- resolve channel metadata
- expose available platform locale/language hints as platform facts
- resolve global identity through Identity service
- convert input to canonical request
- deliver response

Transport must not own semantic routing, permissions policy, durable memory logic, capability selection, domain business logic or final response-language policy.

Language detection and response-language selection belong to shared SG Language & Locale Context. Platform locale is a hint/fallback, not the authoritative user-language profile. Ordinary multilingual messages are passed to SG Core in their original text form; transports do not perform mandatory pre-translation or keyword/command-based language routing.

## AI routing
AI Router is a model-selection and cost-control component, not SG brain.

Responsibilities:
- model registry
- modality matching
- specialized-first policy
- fallback
- budget and cost metadata
- call logging
- propagation of approved language/locale metadata to providers when needed

All AI calls pass through the router/wrapper. Model replacement must not change SG architecture or ownership of decisions.

AI Router and providers do not own preferred language or response-language policy. SG resolves `message_language`, `response_language` and locale context before/around model execution, while AI executes the requested reasoning or specialized work within that context.
