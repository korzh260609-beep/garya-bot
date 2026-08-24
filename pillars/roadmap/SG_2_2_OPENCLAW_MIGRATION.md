# SG 2.2 — OpenClaw Migration Checklist

Canonical checklist for building SG 2.2 on top of a clean OpenClaw base.

Status flow: NOT STARTED → IN PROGRESS → IMPLEMENTED → VERIFIED → CLOSED

1. OpenClaw base — IMPLEMENTED / VERIFIED
2. SG entity — IMPLEMENTED
3. Identity / Global ID / roles — NOT STARTED
4. Memory 2.0 — NOT STARTED
5. Project Memory 3.0 — NOT STARTED
6. PDK4 — NOT STARTED
7. Historical & Semantic Memory Search — NOT STARTED
8. Semantic Kernel / Canonical Semantic Model — NOT STARTED
9. Action Gate and security — NOT STARTED
10. AI Router and cost accounting — NOT STARTED
11. Tasks / Automation — NOT STARTED
12. Telegram and future interfaces — NOT STARTED
13. Sources — NOT STARTED
14. GitHub capability — NOT STARTED
15. Groups / users / subscriptions — NOT STARTED
16. Observability — NOT STARTED
17. Verify OpenClaw does not replace SG logic — NOT STARTED
18. Full SG 2.2 test suite — NOT STARTED

## Point 2 — SG entity

Canonical definition: `pillars/entity/SG_ENTITY.md`

OpenClaw-native SG workspace overlay:
- `sg/workspace/IDENTITY.md`
- `sg/workspace/SOUL.md`
- `sg/workspace/AGENTS.md`

Point 2 defines who SG is. It intentionally does not implement user identity, Global ID, roles, memory, security gates, AI routing, capabilities or transport-specific behavior.
