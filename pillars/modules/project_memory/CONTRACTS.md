# project_memory CONTRACTS

> AGENT NOTE:
> This file defines Project Memory interface contracts for SG 2.0.
> Keep these contracts transport-agnostic and source-first.
> Do not add runtime implementation, Telegram commands, AI calls, automatic writes, raw logs, raw provider IDs, timers, cron, or secret handling here without explicit Monarch approval.

Статус: SKELETON / DOCS-ONLY

---

## 1. Contract principles

Project Memory contracts must follow these principles:

1. Source-first.
2. Confirmed facts only for durable memory.
3. Fail closed on ambiguous writes.
4. Read operations are bounded.
5. Write operations are controlled.
6. Project Memory never outranks pillars, verified repo facts, verified runtime facts, or current Monarch instruction.
7. All write attempts are traceable.
8. Transport logic must stay outside this module.
9. AI may suggest memory candidates later, but AI must not write durable Project Memory directly.

---

## 2. Shared entry shape

Every durable Project Memory entry should use a stable shape.

Minimum conceptual fields:

```text
id
project_key
module_key
stage_key
entry_type
entry_key
entry_value
summary
status
confidence
source_type
source_ref
created_by
created_at
updated_at
metadata
```

Recommended `entry_type` values:

```text
decision
constraint
next_step
risk
module_boundary
workflow_rule
session_summary
capability_snapshot
project_experience
```

Recommended `status` values:

```text
active
superseded
archived
pending_confirmation
rejected
stale
conflicted
```

---

## 3. Read contract

Purpose:

Read confirmed Project Memory without mutating state.

Conceptual interface:

```text
readProjectMemory(query) -> ProjectMemoryReadResult
```

Input should support:

```text
project_key
module_key
stage_key
entry_type
entry_key
status
limit
include_archived
```

Output should include:

```text
ok
entries
warnings
source_summary
```

Rules:

- Must return bounded results.
- Must label stale/conflicted entries.
- Must not silently convert raw chat into memory.
- Must not fetch external sources by itself unless routed through approved source interfaces.
- Must not expose secrets, raw logs, raw provider IDs, or private transport identifiers.

---

## 4. Write contract

Purpose:

Write confirmed project-level memory through a controlled path.

Conceptual interface:

```text
writeProjectMemory(entry, writeContext) -> ProjectMemoryWriteResult
```

Required checks before write:

```text
permission_check
source_check
confirmation_check
conflict_check
duplicate_check
secret_scan
scope_check
```

Output should include:

```text
ok
entry_id
status
warnings
rejected_reason
trace_id
```

Rules:

- Must fail closed if confirmation is missing where required.
- Must fail closed if source is ambiguous.
- Must fail closed if the entry contains secrets or raw logs.
- Must not overwrite active entries blindly.
- Must archive/supersede instead of destructive replacement.
- Must record every write attempt in a trace/audit path when runtime exists.

---

## 5. Confirm contract

Purpose:

Convert a pending memory candidate into confirmed Project Memory only after explicit approval or trusted command path.

Conceptual interface:

```text
confirmProjectMemory(candidate_id, confirmationContext) -> ProjectMemoryConfirmResult
```

Confirmation context should include:

```text
confirmed_by
confirmation_source
confirmation_ref
confirmation_time
allowed_scope
```

Rules:

- Raw chat does not equal confirmation by default.
- AI-generated candidates require explicit confirmation unless the path is explicitly trusted.
- Confirmation must preserve source metadata.
- Confirmation must re-run conflict and secret checks.
- Confirmation must not bypass permissions.

---

## 6. Sync contract

Purpose:

Synchronize Project Memory from approved sources without turning sync into uncontrolled self-writing.

Conceptual interface:

```text
syncProjectMemory(sourceDescriptor, syncContext) -> ProjectMemorySyncResult
```

Allowed future source families:

```text
pillars
repo_evidence
runtime_observation
approved_session_summary
manual_monarch_command
```

Rules:

- Sync must be allowlisted by source type.
- Sync must prefer source references over copied raw content.
- Sync must not import raw logs.
- Sync must not import secrets.
- Sync must not run as autonomous cron/timer without explicit approval.
- Sync output should create candidates first unless the source path is trusted.

---

## 7. Context build contract

Purpose:

Build bounded project context for project work.

Conceptual interface:

```text
buildProjectMemoryContext(requestContext) -> ProjectMemoryContextResult
```

Input should support:

```text
project_key
active_task
module_key
stage_key
requested_depth
max_entries
max_chars
include_risks
include_next_steps
include_decisions
include_constraints
```

Output should include:

```text
ok
context_pack
included_entries
omitted_entries
warnings
source_priority_note
```

Rules:

- Must be bounded by count and size.
- Must clearly label memory as support context.
- Must not inject raw unlimited history.
- Must not override current source evidence.
- Must warn when context may be stale.
- Must include enough metadata for traceability.

---

## 8. Conflict contract

Purpose:

Detect when a new or existing Project Memory entry conflicts with higher authority or active memory.

Conceptual interface:

```text
detectProjectMemoryConflicts(entry, evidenceContext) -> ConflictResult
```

Conflict classes:

```text
pillar_conflict
repo_fact_conflict
runtime_fact_conflict
monarch_instruction_conflict
memory_entry_conflict
stale_snapshot_conflict
scope_conflict
```

Rules:

- Higher authority wins.
- Conflict must be reported, not hidden.
- Conflicted entries must not be used as clean context.
- Fixing a conflict requires explicit update/supersede action.

---

## 9. Diagnostics contract

Purpose:

Expose safe diagnostics about Project Memory health.

Conceptual interface:

```text
getProjectMemoryDiagnostics(scope) -> ProjectMemoryDiagnosticsResult
```

Diagnostics should include:

```text
entry_counts_by_type
stale_entries
conflicted_entries
pending_candidates
last_write_attempts
last_confirmed_entries
source_coverage
warnings
```

Rules:

- Diagnostics must not expose secrets.
- Diagnostics must not expose raw logs.
- Diagnostics must not expose private transport identifiers.
- Diagnostics must be readable without mutating memory.

---

## 10. Forbidden contracts

These contracts are forbidden in this module skeleton:

```text
telegramWriteProjectMemory()
aiAutoWriteProjectMemory()
cronSyncProjectMemory()
storeRawLogsInProjectMemory()
storeSecretsInProjectMemory()
overridePillarsFromMemory()
readUnlimitedRawChatAsProjectMemory()
```

If such behavior is ever proposed, it requires a separate architecture review and explicit Monarch approval.

---

## 11. Current implementation gate

This file is documentation only.

Before runtime implementation, SG must define:

1. Storage schema.
2. Permission gates.
3. Write confirmation policy.
4. Conflict policy.
5. Secret/redaction policy.
6. Context size limits.
7. Diagnostics shape.
8. Tests/smokes.

No runtime Project Memory writes should be added before these gates are accepted.
