# project_memory DATA_MODEL

> AGENT NOTE:
> This file defines the Project Memory V1 data model for SG 2.0.
> This is a model contract, not a database migration.
> Do not add DB writes, automatic memory writes, Telegram commands, AI auto-write, raw logs, raw env dumps, or secret storage here without explicit Monarch approval.

Статус: V1 RUNTIME SKELETON / NO DB WRITES

---

## 1. Current implementation layer

Current runtime code lives in:

```text
src/memory/project/
```

Current module docs live in:

```text
pillars/modules/project_memory/
```

Current V1 runtime skeleton is prepare-only and read-only.

It can:

- build memory candidates;
- validate candidates;
- normalize provided memory items;
- select bounded context items from provided items;
- expose diagnostics;
- block obvious secrets/raw dumps.

It cannot:

- read database storage;
- write database storage;
- sync from sources;
- auto-write from chat;
- call AI;
- connect to Telegram;
- mutate repository/runtime state.

---

## 2. Item model

Current project memory item shape:

```text
version
type
title
content
scope
trust
sourceType
sourceRef
tags
metadata
```

Source file:

```text
src/memory/project/projectMemoryTypes.js
```

---

## 3. Types

Allowed `type` values:

```text
architecture_decision
workflow_rule
module_boundary
implementation_status
rollback_point
known_risk
project_terminology
monarch_approved_principle
imported_main_idea
```

Purpose:

- classify project-level memory;
- prevent raw notes from becoming undifferentiated memory;
- help future context builder select only relevant entries.

---

## 4. Scopes

Allowed `scope` values:

```text
global_project
module
workflow
runtime
repository
```

Scope means where the memory item applies.

It is not a permission boundary yet.

Future storage must still include explicit ownership and access checks.

---

## 5. Trust labels

Allowed `trust` values:

```text
confirmed
candidate
deprecated
needs_review
```

V1 rule:

```text
ProjectMemoryService.buildCandidate() always creates candidate memory.
```

Confirmed durable memory is not enabled yet.

Future confirmed memory must pass:

1. source check;
2. policy check;
3. conflict check;
4. secret check;
5. Monarch approval or approved confirmation path;
6. trace/audit write.

---

## 6. Source types

Allowed source types:

```text
pillar
repository_file
runtime_report
commit
pull_request
actions_run
render_fact
monarch_approval
old_main_review
```

Blocked raw source types:

```text
raw_log
raw_logs
raw_env
env_dump
provider_raw
transport_raw
```

Reason:

```text
Project Memory may store confirmed project facts.
Project Memory must not store raw operational dumps.
```

---

## 7. Context item output

`ProjectMemoryService.buildContextItems()` returns items shaped for controlled AI context packs:

```text
type: project_memory
content
source
priority: below_verified_sources
trust
scope
owner: sg_project
metadata
```

This output is still from provided inputs only.

It does not fetch storage.

It does not prove source truth.

It must be treated as support context under pillars/repo/runtime facts.

---

## 8. Secret and raw-data guard

V1 blocks obvious secret patterns in:

- title;
- content;
- sourceRef;
- tags;
- metadata keys;
- metadata string values.

Examples of blocked/guarded material:

```text
OPENAI_API_KEY
TELEGRAM_BOT_TOKEN
DATABASE_URL
RENDER_API_KEY
GITHUB_APP_PRIVATE_KEY
*_TOKEN
*_SECRET
*_API_KEY
private key blocks
postgres://...
redis://...
mongodb://...
Bearer ...
```

This is not final DLP.

It is a safety guard for the skeleton.

---

## 9. V1 diagnostics model

`ProjectMemoryService.getDiagnostics()` reports:

```text
module
service
version
mode
storage capability
side effects
supported actions
blocked actions
```

It must remain non-secret and side-effect-free.

---

## 10. Future DB model placeholder

Future durable storage may use a table like:

```text
project_memory_entries
```

Candidate fields:

```text
id
project_key
item_type
title
content
scope
trust
source_type
source_ref
tags jsonb
metadata jsonb
created_by
created_at
updated_at
confirmed_by
confirmed_at
status
supersedes_id
trace_id
```

This is not approved as a migration yet.

Before DB implementation, create a separate PR for:

```text
storage schema
migration
read API
write API
confirmation API
diagnostics
smoke tests
```

---

## 11. Final V1 rule

Current Project Memory V1 is runtime-ready only as a safe helper layer.

Correct:

```text
provided item -> normalize -> validate -> candidate/context item
```

Incorrect:

```text
chat text -> automatic confirmed memory
raw logs -> memory
secrets -> memory
memory -> source of truth above pillars/repo/runtime
```
