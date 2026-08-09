# SG 2.1 — MEMORY 2.0 WORKFLOW

## Purpose

Define the required implementation sequence and verification procedure for Memory 2.0 M1–M9 without changing the approved SG authority model.

## Global execution rule

Every M-block follows the existing SG development procedure:

```text
scope
→ contracts
→ skeleton
→ config/policy
→ minimal implementation
→ persistence/migrations
→ tests
→ observability
→ safety/privacy checks
→ architecture verification
→ reversible commit
→ evidence
```

No M-block is complete because documentation exists. Completion requires implementation and evidence.

## Program order

```text
M1 Scope Model
→ M2 Shared Group Memory
→ M7 Permissions & Privacy
→ M3 Automatic Capture
→ M4 Consolidation
→ M5 Intelligent Recall
→ M6 Cross-Platform Global Memory
→ M8 Lifecycle
→ M9 Control / Diagnostics / Final Verification
```

M7 precedes automatic capture because shared/private boundaries must exist before SG begins writing more memory automatically.

---

## M1 workflow — Memory Scope Model

1. Audit existing `memory_records`, memory contracts/providers/repositories and all memory call sites.
2. Define canonical owner/scope representation for personal and shared memory.
3. Add schema migration(s) without destructive rewrite of legacy SG 2.1 memory.
4. Extend contracts/provider/repository scope validation.
5. Add user × group, group-shared and thread/topic scope tests.
6. Verify existing personal/project memory remains compatible.
7. Add observability for scope mismatch/migration failures.
8. Run full check and persistence integration tests.

Exit gate: shared group memory can be represented correctly without fake user ownership and no existing scope isolation regresses.

---

## M2 workflow — Shared Group Memory

1. Add first-class shared group memory repository/provider path.
2. Bind group memory to canonical group/resource identity and optional thread.
3. Preserve creator/actor provenance separately.
4. Add authorized read/write capability path.
5. Add restart persistence tests.
6. Add cross-group and cross-thread leakage tests.
7. Verify private user memory cannot be returned through shared group read.

Exit gate: two authorized users in the same group can share a group fact while another group/user context cannot access unauthorized data.

---

## M7 workflow — Memory Permissions & Privacy

1. Define privacy classifications and operation permissions.
2. Implement fail-closed authorization before memory read/write/promotion.
3. Integrate membership/resource authority only where the operation genuinely requires it.
4. Implement explicit private → shared promotion rules.
5. Protect System Self Knowledge from ordinary memory mutation.
6. Add audit events for sensitive/admin operations without raw content.
7. Add adversarial cross-scope tests.

Exit gate: unauthorized data cannot enter ContextBundle or persistence mutation paths.

---

## M3 workflow — Automatic Memory Capture

1. Define capture candidate contract.
2. Add memory-worthiness and sensitivity classification path.
3. Add target-layer/scope classifier.
4. Apply M7 policy before every automatic proposal/write.
5. Add duplicate/conflict preflight.
6. Keep automatic derived/raw-dialogue records non-verified unless confirmation/evidence rules justify stronger trust.
7. Add capture observability and suppression reasons.
8. Test ordinary chatter/noise rejection.

Exit gate: automatic capture is useful, bounded and cannot silently turn conversation into confirmed/private-to-shared memory.

---

## M4 workflow — Memory Consolidation Engine

1. Define duplicate/conflict/supersession contracts.
2. Implement deterministic exact duplicate handling first.
3. Add semantic duplicate/conflict analysis through approved AI Router only where reasoning is needed.
4. Implement supersession chains and archival.
5. Add topic/session digest generation with source links.
6. Make jobs idempotent/restart-safe.
7. Add conflict and rollback diagnostics.
8. Verify trust cannot increase without evidence/confirmation.

Exit gate: repeated/evolving facts produce a compact current representation while history/provenance remain recoverable.

---

## M5 workflow — Intelligent Recall Engine

1. Audit current layer/key recall behavior.
2. Define recall candidate/ranking contract.
3. Apply scope and M7 privacy authorization before semantic ranking.
4. Implement exact key/entity/topic signals.
5. Add relevance ranking and trust/freshness/lifecycle weighting.
6. Add conflict-aware result construction.
7. Enforce ContextBundle count/size limits.
8. Add selection/exclusion diagnostics without content leakage.
9. Test ambiguous and cross-scope queries.

Exit gate: SG retrieves the smallest relevant authorized memory set rather than arbitrary layer records.

---

## M6 workflow — Cross-Platform Global Memory

1. Audit identity-link resolution at all transport boundaries.
2. Ensure personal memory ownership always resolves to verified `global_user_id`.
3. Remove platform-specific personal memory ownership assumptions.
4. Add multi-transport personal-memory tests.
5. Add unlinked/conflicting identity denial tests.
6. Verify group/resource memory stays local to its resource scope.

Exit gate: linked identities share authorized personal memory; unrelated platform/group contexts do not.

---

## M8 workflow — Memory Lifecycle

1. Define lifecycle states and transitions.
2. Add timestamps/relations needed for expiry, supersession and archive.
3. Implement normal-recall exclusion rules.
4. Add cleanup/reconciliation jobs with retention policy.
5. Protect permanent/confirmed memory from generic cleanup.
6. Make lifecycle jobs idempotent/restart-safe.
7. Add history/audit retrieval where authorized.

Exit gate: stale/expired memory cannot masquerade as current knowledge and retention is deterministic.

---

## M9 workflow — Memory Control, Diagnostics & Tests

1. Add bounded statistics for authorized scopes.
2. Add capture/recall/conflict/consolidation/lifecycle diagnostics.
3. Add provenance/history administrative inspection path.
4. Add repair/integrity checks for scope/lifecycle chains.
5. Run unit tests for all M1–M8 contracts.
6. Run PostgreSQL integration/restart/concurrency tests.
7. Run Telegram group/topic E2E tests where production transport is available.
8. Run cross-platform tests for every implemented additional transport.
9. Run privacy/redaction/adversarial leakage suite.
10. Run repository-wide audit for competing/bypass memory paths.
11. Run `npm run check` and applicable production checks.
12. Record final evidence only after all failures are resolved.

Exit gate: Memory 2.0 is observable, auditable, privacy-safe and implementation-verified end to end.

## Mandatory regression invariants

At every M-block:

- existing Identity/Scope semantics remain authoritative;
- no secret word/phrase/command identifies a person or grants access;
- no memory result can grant roles, permissions or resource ownership;
- Action Gate remains mandatory for protected state changes;
- raw secrets never enter memory, prompts or telemetry;
- Conversation Context remains distinct from confirmed memory;
- System Self Knowledge remains distinct from user/group/project memory;
- all persistence changes are migration-safe and reversible at code level;
- new memory behavior remains transport-independent.

Architecture: `../architecture/MEMORY_2_0.md`.
Roadmap: `../roadmap/MEMORY_2_0_ROADMAP.md`.
