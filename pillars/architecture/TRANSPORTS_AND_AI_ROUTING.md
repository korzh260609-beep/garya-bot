# SG 2.1 — TRANSPORTS AND AI ROUTING

## Transports
Telegram, Web/API, Discord, email, voice and future interfaces are thin adapters.

Transport responsibilities:
- receive input
- resolve channel metadata
- resolve global identity through Identity service
- convert input to canonical request
- deliver response

Transport must not own semantic routing, permissions policy, durable memory logic, capability selection or domain business logic.

## AI routing
AI Router is a model-selection and cost-control component, not SG brain.

Responsibilities:
- model registry
- modality matching
- specialized-first policy
- fallback
- budget and cost metadata
- call logging

All AI calls pass through the router/wrapper. Model replacement must not change SG architecture or ownership of decisions.
