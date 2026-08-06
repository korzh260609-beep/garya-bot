# SG 2.1 ROADMAP — PRINCIPLES AND GATES

## Hard principles
- The connected reasoning model understands meaning.
- SG code organizes context, capabilities and controlled actions.
- Natural language is primary; commands are secondary.
- Semantic Kernel is transport- and storage-independent.
- Memory supports continuity but is not identity or truth by default.
- Action Gate protects execution and does not interpret meaning.
- Capabilities are replaceable and contract-driven.
- Transports are thin adapters.
- Domain modules cannot redefine core contracts.

## Gates
- No later block becomes a hidden dependency of an earlier block.
- The first vertical slice works without Telegram, PostgreSQL or external integrations.
- No protected action bypasses identity, permission, scope, risk, cost, confirmation, idempotency or audit checks where applicable.
- Interfaces contain no semantic, durable-memory, permission or domain logic.
- Completion is derived only from code, tests and verified runtime evidence.
