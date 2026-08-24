# SG 2.2 — OpenClaw Migration Checklist

Status model for every block:

`NOT STARTED → IN PROGRESS → IMPLEMENTED → VERIFIED → CLOSED`

## Core principle

OpenClaw is the technical base/runtime. SG remains the authoritative identity, memory, semantic, policy, safety, routing and product logic layer. OpenClaw must not replace or redefine SG's core behavior.

## Migration checklist

1. [ ] **OpenClaw base**
   - Prepare OpenClaw as the clean technical foundation for SG 2.2.
   - Keep upstream structure as intact as practical to simplify future updates.

2. [ ] **SG Entity**
   - Restore SG identity, role, governing principles, behavioral rules and owner/monarch relationship.
   - SG entity remains authoritative above OpenClaw runtime behavior.

3. [ ] **Identity / Global ID / Roles**
   - Global user identity.
   - Monarch/citizen/guest and future roles.
   - Cross-transport identity binding.

4. [ ] **Memory 2.0**
   - Durable user facts and conversational memory.
   - Existing isolation, trust and lifecycle behavior.

5. [ ] **Project Memory 3.0**
   - Project state, decisions, incidents, temporal history and supersession.

6. [ ] **PDK4**
   - Project development knowledge.
   - Repository/commit/diff/PR/workflow development evidence.

7. [ ] **Historical & Semantic Memory Search**
   - Historical query planning.
   - Hybrid retrieval.
   - Ranking, deduplication, conflict/supersession handling.
   - Timeline, first/last occurrence, provenance and human-readable presentation.

8. [ ] **Semantic Kernel / Canonical Semantic Model**
   - Raw request → semantic resolution → canonical model → deterministic execution.
   - Avoid phrase-specific hacks and parallel semantic systems.

9. [ ] **Action Gate / Security / Permissions**
   - Preserve global authorization rules.
   - Role- and resource-based checks.
   - No capability bypass through OpenClaw tools.

10. [ ] **AI Router / Cost Accounting**
    - Model selection and routing policies.
    - Cost logging and accounting.
    - Specialized-first / deterministic-first behavior where applicable.

11. [ ] **Tasks / Automation**
    - Task creation, execution, update, cancellation and semantic lookup.
    - One-shot and recurring automation behavior.

12. [ ] **Transports / Interfaces**
    - Telegram integration.
    - Preserve architecture for future SG native UI and other transports.
    - Business logic must not be Telegram-only.

13. [ ] **Sources**
    - Source ingestion and retrieval.
    - Existing source capability behavior and extensibility.

14. [ ] **GitHub Capability**
    - Repository read/search/change/commit/push/CI access through the chosen SG 2.2 architecture.
    - Keep GitHub access universal and transport-independent.

15. [ ] **Groups / Users / Membership / Subscription**
    - Group participation rules.
    - Membership lifecycle.
    - Subscription-ready architecture.

16. [ ] **Observability**
    - Runtime health, runs, errors, diagnostics and execution evidence.

17. [ ] **OpenClaw Boundary Verification**
    - Verify OpenClaw is the execution foundation, not the source of SG identity or policy.
    - Prevent duplicate memory, semantic, permission, AI-routing or executor systems.

18. [ ] **SG 2.2 End-to-End Verification**
    - Regression tests for retained SG behavior.
    - Integration tests for OpenClaw + SG layers.
    - Exact-HEAD CI verification before closing migration blocks.

## Working rule

This document is the canonical migration checklist for SG 2.2. New migration blocks should be added here before implementation, and their status should be updated only after implementation and verification.
