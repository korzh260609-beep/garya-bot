# SG 2.1 ROADMAP — RULES AND ORDER

## Purpose
Define the dependency order for building SG 2.1 without allowing transports, databases, tools or domain modules to dictate the architecture.

## Hard rules
- SG is one global intellectual system.
- The reasoning layer understands meaning.
- Controllers and gates constrain actions; they do not become SG brain.
- Natural language is primary; commands are secondary technical shortcuts.
- Memory is context and continuity, not SG identity or philosophy.
- Capabilities are replaceable and contract-driven.
- Transports are thin adapters.
- Domain modules are optional consumers of the platform core.
- Architecture changes require explicit monarch approval and a decision entry.
- No protected action bypasses identity, permission, scope, risk, cost, confirmation, idempotency or audit checks where applicable.

## Canonical order

```text
Constitution
→ Semantic Kernel
→ Context and Memory
→ Decision and Safety
→ Capability System
→ Interfaces
→ Automation and Agents
→ Domain Modules
```

## Stage gates
- A later block may not become a hidden dependency of an earlier block.
- The first vertical slice must work without Telegram, PostgreSQL or external integrations.
- Interfaces may not contain semantic, memory, permission or domain logic.
- Automation may not execute protected actions without Action Gate approval.
- Domain modules may not redefine core contracts.

## Evidence rule
Roadmap files contain no manual status markers. Completion comes from code, tests and verified runtime evidence.
