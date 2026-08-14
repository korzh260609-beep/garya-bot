# SG 2.1 ROADMAP — BLOCK 1: SEMANTIC KERNEL

## Goal
Build a platform-independent core that understands a natural-language request and produces a structured decision without depending on Telegram, commands, database schema or external tools.

## Deliverables
1. Canonical Input contract
2. Meaning interpretation contract
3. Goal and intent representation
4. Entity and constraint extraction
5. Uncertainty and clarification policy
6. Context-needs request model
7. Evidence-needs request model
8. Candidate-action model
9. DecisionEnvelope
10. ResponsePlan
11. Semantic diagnostics
12. Contract and behavior tests

## First vertical slice

```text
text input
→ semantic interpretation
→ DecisionEnvelope
→ safe no-op capability
→ response composition
```

## Acceptance criteria
- Equivalent wording produces equivalent intent structures.
- Meaning is not decided by keyword, phrase or regex routes.
- Missing essential information produces at most one concise clarification question.
- The kernel does not directly call storage, transports or external tools.
- The output is deterministic enough to validate through contract tests.

## Non-goals
- Telegram integration
- durable memory
- database schema
- external actions
- domain-specific business logic
