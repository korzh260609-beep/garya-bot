# SG Automation 2.0 — Executable Workflows Architecture

Status: ACCEPTED ARCHITECTURE / PLANNED IMPLEMENTATION

## Purpose

Automation 2.0 upgrades SG automation from scheduled static notifications into durable, editable, multi-step executable workflows. A user instruction may create or modify a workflow that performs fresh authorized work at execution time, composes a result and delivers it through the existing Delivery Router.

Automation 2.0 is transport-neutral. Telegram is one origin/delivery transport, not the owner of workflow semantics.

## Core invariant

A task is an executable plan, not merely a stored message.

Canonical flow:

```text
User intent
→ semantic task/workflow selection
→ create or patch existing automation
→ versioned workflow definition
→ Scheduler / Durable Worker
→ execution-time Identity + Access + Resource Authority
→ per-step Action Gate / Credential checks
→ capability execution
→ dynamic composition
→ delivery
→ audit + execution history
```

## Workflow contract

A workflow definition contains:

- `automationId` — stable public/internal automation identity;
- `version` — monotonically increasing workflow version;
- `trigger` — one-shot or recurring temporal trigger;
- `steps` — ordered executable steps;
- `inputs` — bounded immutable or runtime-resolved inputs;
- `delivery` — authorized destination policy;
- `executionPolicy` — retry, partial failure, confirmation and state-change policy;
- `scope` — canonical user/project/group/thread bounds;
- `createdBy`, `updatedBy`, timestamps and provenance.

Existing `self-notification` remains supported as the simplest workflow profile: compose/static-message → deliver.

## Step model

Initial canonical step classes:

- `collect` — read fresh authorized data;
- `retrieve` — retrieve from an approved source/capability;
- `analyze` — deterministic or routed analysis;
- `compose` — build the execution-time result;
- `invoke-capability` — invoke an explicitly allowed SG capability;
- `deliver` — route the final result through Delivery Router.

Step outputs may become bounded inputs to following steps. Step data must preserve provenance and scope.

## Execution-time authorization

Creation-time permission is never permanent authority.

Before protected execution, SG re-evaluates the current actor/scope and, as applicable:

1. Identity / Global ID;
2. SG Access/entitlement policy;
3. Resource Ownership & Authority;
4. Action Gate;
5. Credential Manager / connection availability;
6. capability availability and current resource permissions.

Loss of authority after task creation must deny or skip the affected step according to policy; it must never be silently bypassed.

## Read-only autonomous work

Read-only workflows may autonomously perform allowed fresh collection, retrieval, analysis and report composition when the workflow owner remains entitled and the target resources remain authorized.

Examples:
- collect workspace activity;
- read approved source state;
- inspect task/project status;
- aggregate metrics;
- produce a fresh daily report.

## State-changing autonomous work

State-changing/external actions are not implicitly authorized because they are scheduled. Every such step carries an explicit execution envelope including action class, resource scope, capability, risk and confirmation/delegation policy.

A workflow cannot use a prior confirmation to grant broader future authority than explicitly approved.

## Workflow mutation

SG must be able to modify an existing automation by natural-language instruction without requiring the user to know internal IDs.

Supported mutations include:
- add/remove/replace steps;
- change message/content;
- change data sources or target resources;
- change output format;
- change delivery policy;
- change schedule/recurrence/timezone;
- change allowed execution policy;
- pause/resume/cancel;
- restore a previous safe version where supported.

Mutation is a patch of the same automation, not creation of a duplicate, unless the user explicitly requests a copy/new automation.

When zero or multiple workflows semantically match, SG fails closed and asks one clarification rather than guessing.

## Versioning and history

Every successful mutation creates a new workflow version. Execution records bind to the exact version that ran.

Required history:
- version number;
- previous version;
- patch/delta summary;
- actor;
- timestamp;
- request/trace provenance;
- validation and gate result.

## Dynamic data collection

Fresh-data steps execute at run time. A daily report must not reuse yesterday's stored report as if it were current.

For workspace activity, the collector must enumerate only authorized workspaces, re-check each workspace separately, read persisted/live evidence through approved capabilities, and aggregate only evidence actually available.

## Partial failure

Workflow execution distinguishes:
- `completed`;
- `partial`;
- `failed`;
- `denied`;
- `cancelled`.

Examples:
- one workspace unavailable → partial result with explicit omission;
- temporary source/transport failure → retry according to bounded policy;
- lost permission → denied/skip affected resource and audit;
- final delivery failure → execution result retained, delivery marked failed/retryable as appropriate.

False success is forbidden.

## Idempotency

Each scheduled occurrence receives a stable occurrence identity. Retries, worker restart and duplicate scheduler materialization must not duplicate an externally visible result.

## Observability

Each execution records:
- automation/version/occurrence IDs;
- started/completed timestamps;
- step transitions;
- source/capability evidence;
- gate decisions;
- output status;
- AI Router calls/cost/reason when used;
- retries/errors;
- delivery outcome.

Secrets and private data remain bounded by existing redaction/privacy policy.

## Non-negotiable boundaries

- no keyword/phrase hacks for task selection or mutation;
- AI interprets meaning but cannot directly grant access or bypass deterministic gates;
- no parallel scheduler, identity, memory, credential or authorization stack;
- existing Durable Automation, Temporal Context, Capability System, Action Gate, Resource Authority, Access Control, Credential Manager, Delivery Router and Observability are reused;
- dynamic reports use fresh execution-time evidence;
- state-changing automation requires explicit bounded authority;
- automation cannot self-expand its permissions, scope, resources or capabilities.

## Canonical example

User intent:

`Add group activity information to my daily 07:00 task that sends me a greeting.`

Expected behavior:

1. semantically resolve the existing daily automation in the current scope;
2. patch the same workflow;
3. preserve 07:00 unless the user changes it;
4. add fresh workspace-activity collection and aggregation steps;
5. create a new workflow version;
6. at each occurrence, re-authorize current accessible workspaces;
7. collect fresh activity;
8. compose greeting + current report;
9. deliver once;
10. persist execution/audit evidence.
