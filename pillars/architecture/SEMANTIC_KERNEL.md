# SG 2.1 — SEMANTIC KERNEL

## Responsibility
The Semantic Kernel converts natural-language input and available context into a structured decision. It is the earliest functional core of SG 2.1.

## Flow

```text
input
→ meaning interpretation
→ goal and intent model
→ uncertainty detection
→ context requirements
→ candidate actions
→ selected safe next step
→ response plan
```

## DecisionEnvelope
- goal
- intent
- entities
- context_needs
- evidence_needs
- candidate_actions
- selected_action
- requires_clarification
- confidence
- risk_level
- response_plan

## Rules
- Meaning must not be reduced to keyword, phrase or regex routing.
- At most one concise clarification question is used when essential.
- Semantic interpretation is independent from Telegram, commands, database schema and specific tools.
- The kernel requests context, memory and evidence through contracts; it does not directly query storage or external services.
- The kernel selects an intended action, but cannot authorize protected execution.
