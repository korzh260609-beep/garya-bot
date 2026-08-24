# SG 2.2 — OpenClaw Migration Checklist

Canonical checklist for building SG 2.2 on top of a clean OpenClaw base.

Status flow: NOT STARTED → IN PROGRESS → IMPLEMENTED → VERIFIED → CLOSED

1. OpenClaw base — IMPLEMENTED / VERIFIED
2. SG entity — IMPLEMENTED
3. Identity / Global ID / roles — CLOSED
3A. Telegram Test Runtime — NOT STARTED
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

## Point 3 — Identity / Global ID / roles

Status: CLOSED.

Canonical implementation and closure evidence: `pillars/roadmap/SG22_IDENTITY_GLOBAL_PROFILE_INTEGRATION.md`.

Point 3 is synchronized with the implemented runtime: SG Global ID, global profile, domain roles, cross-channel identity binding, runtime context integration, tests and documentation are complete.

## Point 3A — Telegram Test Runtime

Purpose: provide an early test transport immediately after Identity so every later SG 2.2 block can be tested through Telegram while it is developed.

Scope:
- deploy SG 2.2 on Render using the OpenClaw gateway;
- provision the OpenClaw configuration non-interactively;
- connect Telegram through the existing OpenClaw Telegram channel using `TELEGRAM_BOT_TOKEN`;
- configure the provider credentials required for test replies;
- bind the Render port, health check and persistent state correctly;
- resolve the existing SG 2.1 webhook versus OpenClaw update-delivery mode;
- restrict test access to the intended Telegram operator;
- verify startup, health, inbound message, SG identity context and outbound reply.

Point 3A is a test-enablement block only. It must reuse OpenClaw Telegram and gateway mechanisms and must not create a second Telegram transport, webhook runtime, identity path or routing system.

Exit criteria:
- SG 2.2 deploys successfully on Render;
- the selected Telegram bot receives a message and returns a reply;
- the request contains the implemented Point 3 SG identity context;
- persistent OpenClaw/SG state survives restart;
- rollback to SG 2.1 remains possible.

## Point 12 — Telegram and future interfaces

Point 12 remains the full production transport integration block: complete Telegram behavior, groups, commands, buttons, files, access behavior and consistent SG semantics across Telegram and future interfaces.

Point 3A does not close or replace Point 12.
