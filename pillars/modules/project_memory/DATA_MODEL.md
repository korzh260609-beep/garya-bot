# project_memory DATA_MODEL

> AGENT NOTE:
> This file defines the Project Memory V1 data model for SG 2.0.
> It describes intended data shapes and boundaries, not a live deployment proof.
> Verify current branch files and runtime / DB diagnostics before claiming what is enabled or deployed.
> Do not add automatic memory writes, Telegram commands, AI auto-write, raw logs, raw env dumps, or secret storage here without explicit Monarch approval.

---

## 1. Implementation surface to verify

When working on Project Memory, verify the active branch directly.

Expected implementation areas:

```text
src/memory/project/
src/core/message/
src/app/
```

Module docs live in:

```text
pillars/modules/project_memory/
```

The Project Memory V1 data model is organized around these boundaries:

```text
ProjectMemoryOwnership            -> SG vs user-project ownership/scope boundary
ProjectMemoryService              -> prepare-only / validate-only helper
ProjectMemoryStore                -> durable storage boundary
ProjectMemoryConfirmation         -> explicit confirmation boundary
ProjectMemoryRuntimeContext       -> confirmed read-only context bridge
MessageProjectMemoryContextGate   -> message-time feature gate for read/injection
ProjectMemorySchemaBootstrap      -> startup-time feature gate for storage schema ensure
```

Do not treat this list as proof that each boundary is currently enabled in runtime.

---

## 2. Capability boundaries

The model allows these capability families when their matching code, flags, and runtime state are verified:

- define SG project memory separately from user project memory;
- support many user projects per global user through deterministic project keys;
- check if an actor may read/write candidate memory for a project reference;
- build memory candidates;
- validate candidates;
- normalize provided memory items;
- select bounded context items from provided items;
- expose diagnostics;
- block obvious secrets/raw dumps;
- ensure Project Memory storage schema when explicitly enabled;
- create durable candidate entries;
- confirm pending candidates explicitly;
- list confirmed entries through the storage boundary;
- read confirmed active entries for runtime context;
- convert confirmed entries to bounded project memory facts/context items;
- optionally include confirmed Project Memory in message context pack behind a feature flag;
- optionally inject formatted context into AI messages behind a separate feature flag.

The model forbids these behavior families unless separately designed and explicitly approved:

- auto-write from chat;
- auto-write from AI;
- sync from sources;
- call AI from memory modules;
- infer user project ownership from natural-language phrases;
- inject prompt context by default;
- connect memory modules to Telegram;
- mutate repository/runtime files;
- store raw logs/env/provider dumps;
- store secrets.

---

## 3. Ownership model

Ownership boundary source:

```text
src/memory/project/projectMemoryOwnership.js
```

Owner types:

```text
sg_project
user_project
```

Visibility values:

```text
system_internal
private_user_project
shared_user_project
```

Deterministic project keys:

```text
sg
user_project:<globalUserId>:<userProjectId>
```

Meaning:

```text
project_key = sg
```

is reserved for SG itself: architecture, workflow, decisions, rules, module boundaries, runtime design.

```text
project_key = user_project:<globalUserId>:<userProjectId>
```

is reserved for a concrete project owned by a concrete user.

One user may own many user projects:

```text
user_project:global-user-1:alpha-client
user_project:global-user-1:beta-shop
user_project:global-user-1:school-research
```

These are different memory scopes and must not be mixed.

Hard rules:

```text
SG project memory is not user project memory.
User project memory is not global SG memory.
Different user projects of the same user are separate.
Different users' projects are separate even if project names match.
No ownership is inferred from chat text or magic phrases.
Ownership must come from explicit project ref / userProjectId / globalUserId.
```

---

## 4. Item model

Project memory item shape:

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

Source file to verify:

```text
src/memory/project/projectMemoryTypes.js
```

---

## 5. Types

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

## 6. Scopes

Allowed `scope` values:

```text
global_project
module
workflow
runtime
repository
```

Scope means where the memory item applies.

It is not sufficient as an ownership boundary.

Ownership and project isolation must use `project_key` + ownership boundary.

---

## 7. Trust labels

Allowed `trust` values:

```text
confirmed
candidate
deprecated
needs_review
```

V1 rules:

```text
ProjectMemoryOwnership separates SG memory from user project memory.
ProjectMemoryService.buildCandidate() creates candidate memory.
ProjectMemoryStore.createCandidate() stores trust='candidate' + status='pending_confirmation'.
ProjectMemoryConfirmation.confirmCandidate() is the confirmation boundary.
ProjectMemoryRuntimeContext reads only trust='confirmed' + status='active'.
MessageProjectMemoryContextGate must default to no read and no prompt injection unless flags say otherwise.
ProjectMemorySchemaBootstrap must default to no schema ensure unless flags say otherwise.
```

Confirmed durable memory must pass:

1. source check;
2. policy check;
3. conflict check when available;
4. secret check;
5. ownership/scope check;
6. explicit approval / confirmation path;
7. trace/audit write.

---

## 8. Source types

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

## 9. Storage schema

Storage boundary files to verify:

```text
src/memory/project/projectMemorySchema.js
src/memory/project/projectMemoryStore.js
```

Storage tables:

```text
sg_project_memory_entries
sg_project_memory_write_audit
```

`sg_project_memory_entries` fields:

```text
id
project_key
item_type
title
content
scope
trust
status
source_type
source_ref
tags jsonb
metadata jsonb
created_by
created_at
updated_at
confirmed_by
confirmed_at
supersedes_id
trace_id
```

`sg_project_memory_write_audit` fields:

```text
trace_id
action
entry_id
decision
reason
actor_ref
created_at
metadata jsonb
```

Storage rules:

- `project_key='sg'` is SG project memory;
- `project_key='user_project:<globalUserId>:<userProjectId>'` is user project memory;
- candidates are durable but not confirmed;
- confirmation changes `trust` from `candidate` to `confirmed`;
- confirmation changes `status` from `pending_confirmation` to `active`;
- failed confirmation returns `candidate_not_found_or_not_pending`;
- audit trace is appended for candidate creation and confirmation decisions.

---

## 10. Schema bootstrap boundary

Schema bootstrap boundary to verify:

```text
src/app/projectMemoryBootstrap.js
```

Public actions:

```text
getProjectMemorySchemaBootstrapOptionsFromEnv()
bootstrapProjectMemorySchema()
```

Environment flags:

```text
SG_PROJECT_MEMORY_SCHEMA_BOOTSTRAP_ENABLED=false
SG_PROJECT_MEMORY_SCHEMA_BOOTSTRAP_FAIL_STARTUP=false
```

Modes:

```text
disabled      -> no DB call, no schema ensure
ensure_schema -> ensureProjectMemorySchema() runs only when enabled and DATABASE_URL is configured
```

Hard boundary rules:

```text
disabled by default
no memory entries written
no candidate confirmation
no Project Memory context read
no AI calls
no Telegram logic
no source sync
no runtime generated file edits
startup does not fail by default on bootstrap failure
```

Meaning:

```text
Schema bootstrap only prepares Project Memory tables.
It does not enable memory writes, memory reads, or prompt injection.
```

---

## 11. Confirmation boundary

Confirmation boundary to verify:

```text
src/memory/project/projectMemoryConfirmation.js
```

Public actions:

```text
status()
getDiagnostics()
prepareCandidateForConfirmation()
confirmCandidate()
listConfirmedEntries()
```

Hard boundary rules:

```text
auto_write_from_chat = false
ai_auto_write = false
source_sync = false
telegram_command = false
cron_confirmation = false
```

Meaning:

```text
Only an explicit caller may create a durable candidate or confirm a candidate.
This does not connect Project Memory to chat, Telegram, AI, cron, or source ingestion.
```

---

## 12. Runtime read context bridge

Runtime read bridge to verify:

```text
src/memory/project/projectMemoryRuntimeContext.js
```

Public actions:

```text
status()
getDiagnostics()
loadConfirmedProjectMemoryFacts()
buildConfirmedProjectMemoryContextItems()
```

Read rule:

```text
project_key = requested project
trust = confirmed
status = active
limit = bounded limit
```

Output fact shape:

```text
content
source
metadata.projectMemoryId
metadata.projectKey
metadata.projectMemoryType
metadata.title
metadata.scope
metadata.trust
metadata.sourceType
metadata.sourceRef
metadata.tags
metadata.status
metadata.confirmedBy
metadata.confirmedAt
metadata.traceId
metadata.runtimeContextBridgeVersion
```

Context item shape:

```text
type: project_memory
content
source
priority: below_verified_sources
trust: confirmed
scope
owner: sg_project
metadata
```

Hard boundary rules:

```text
writesStorage = false
confirmsCandidates = false
autoWriteFromChat = false
autoWriteFromAI = false
sourceSync = false
callsAI = false
injectsPrompt = false
```

Meaning:

```text
The bridge may read confirmed Project Memory and prepare bounded context.
It does not inject that context into AI by itself.
Prompt injection remains controlled by messageContextInjection.
```

---

## 13. Message runtime injection gate

Message gate to verify:

```text
src/core/message/messageProjectMemoryContextGate.js
```

Public actions:

```text
buildMessageProjectMemoryContextGateDisabledOptions()
getMessageProjectMemoryContextGateOptionsFromEnv()
prepareMessageProjectMemoryContextGate()
```

Environment flags:

```text
SG_PROJECT_MEMORY_CONTEXT_ENABLED=false
SG_PROJECT_MEMORY_PROMPT_INJECTION_ENABLED=false
SG_PROJECT_MEMORY_CONTEXT_MAX_ENTRIES=5
SG_PROJECT_MEMORY_CONTEXT_MAX_CONTENT_CHARS=1200
SG_PROJECT_MEMORY_CONTEXT_MAX_TITLE_CHARS=160
SG_PROJECT_MEMORY_CONTEXT_PACK_MAX_ITEMS=14
SG_PROJECT_MEMORY_CONTEXT_PACK_MAX_CHARS=1200
```

Modes:

```text
disabled        -> no Project Memory read, no prompt injection
read_only       -> reads confirmed Project Memory into contextPack, no prompt injection
read_and_inject -> reads confirmed Project Memory and allows messageContextInjection to inject formatted context
```

Hard boundary rules:

```text
read disabled by default
prompt injection disabled by default
read and injection are separate flags
read failure disables prompt injection
no memory writes
no candidate confirmation
no source sync
no Telegram logic
no AI calls from gate
```

Meaning:

```text
callMessageAI may route context through MessageProjectMemoryContextGate when enabled.
Default env must preserve previous behavior: context injection disabled and no Project Memory read.
Live use requires explicit env enablement.
```

---

## 14. Context item output from service

`ProjectMemoryService.buildContextItems()` returns items shaped for controlled AI context packs from provided inputs only:

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

## 15. Secret and raw-data guard

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

## 16. Diagnostics model

`ProjectMemoryService.getDiagnostics()` should report:

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

`ProjectMemoryConfirmation.getDiagnostics()` should report:

```text
confirmation mode
storage boundary usage
transport independence
AI independence
source sync independence
blocked auto-write actions
```

`ProjectMemoryRuntimeContext.getDiagnostics()` should report:

```text
runtime read mode
confirmed-only read policy
storage boundary usage
transport independence
AI independence
source sync independence
prompt injection independence
blocked write/confirm/injection actions
```

Diagnostics must remain non-secret and side-effect-free except explicitly reported storage reads.

---

## 17. Final V1 rule

Correct:

```text
SG project fact -> project_key='sg'
user project fact -> project_key='user_project:<globalUserId>:<userProjectId>'
provided item -> normalize -> validate -> candidate/context item
explicit flag -> ProjectMemorySchemaBootstrap -> ensure storage schema only
explicit caller -> prepareCandidateForConfirmation -> pending durable candidate
explicit approval -> confirmCandidate -> confirmed durable memory
confirmed durable memory -> ProjectMemoryRuntimeContext -> bounded facts/context items
feature flag -> MessageProjectMemoryContextGate -> optional message context pack / optional prompt injection
```

Incorrect:

```text
all project memory -> project_key='sg'
one user -> one project only
same user projects -> shared memory by default
same project name across users -> shared memory
schema bootstrap -> automatic memory write
schema bootstrap -> automatic memory read
schema bootstrap -> prompt injection
chat text -> automatic confirmed memory
AI output -> automatic confirmed memory
raw logs -> memory
secrets -> memory
runtime context bridge -> prompt injection by itself
message gate default -> automatic memory read
message gate default -> automatic prompt injection
memory -> source of truth above pillars/repo/runtime
```
