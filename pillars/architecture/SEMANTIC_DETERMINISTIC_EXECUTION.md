# SG 2.1 — Semantic Deterministic Execution

Status: ACCEPTED ARCHITECTURE / PLANNED IMPLEMENTATION

## Purpose

Define one global SG behavior for natural-language requests: semantic understanding at the boundary, then deterministic canonical planning, authorization, execution, verification and delivery.

This is a core SG contract, not a Telegram feature. Telegram, Web, API, Discord, Email and the future native SG interface are transports only.

## Core invariant

AI/semantic reasoning may determine meaning. After meaning is canonicalized, execution logic must be deterministic.

```text
Transport Input
→ Transport Adapter
→ Unified SG Request
→ Semantic Request Resolver
→ Canonical Semantic Model
→ Deterministic Validation
→ Deterministic Execution Plan
→ Identity / Scope / Resource Authority as applicable
→ Action Gate as applicable
→ Deterministic Executor
→ Post-condition Verification
→ Unified Result
→ Delivery Router
→ Transport Adapter
```

No transport owns task, temporal, automation or action semantics.

## Stage 1 — Semantic Request Resolution

The resolver derives structured meaning from natural language and context instead of matching a fixed phrase list.

Minimum output:

- `intent`
- `target`
- `action`
- `timeExpression`
- `scope`
- `parameters`
- `delivery`
- `confidence`
- provenance/context references

Meaning must not be reduced to keyword, regex or exact-phrase routing. If one safe canonical meaning cannot be established from request + current context, fail closed and request one concise clarification.

## Stage 2 — Canonical Semantic Model

Semantic output is normalized into bounded typed values before execution.

Examples:

- task intents: `task-create`, `task-update`, `task-cancel`, `task-list`, `task-run`;
- report actions: `workspace-activity-report`, `group-activity-report`, `test-activity-report`, `participant-activity-report`;
- temporal values: `previous-calendar-day`, `current-calendar-day`, `rolling-24-hours`, `previous-week`, `current-week`, `custom-range`.

Different natural-language formulations may map to one canonical value when their meaning is equivalent. Different meanings must remain distinct.

Example:

```text
"за вчера" / "за прошедший день" / "за предыдущий день"
→ previous-calendar-day

"за последние сутки"
→ rolling-24-hours
```

The canonical model, not the source wording, becomes the execution contract.

## Stage 3 — Deterministic Temporal Resolution

After a canonical temporal type is selected, date/time boundaries are computed without AI reinterpretation.

Example:

```text
previous-calendar-day
→ [previous day 00:00, current day 00:00) in resolved canonical timezone

rolling-24-hours
→ [now - 24h, now]
```

Timezone resolution reuses the existing Temporal/Locale context and must remain explicit in execution evidence.

## Stage 4 — Structured Automation Plan

Scheduled requests must be persisted as executable structured plans, not as text to repeat later.

Canonical example:

```yaml
trigger:
  type: recurring
  recurrence: daily
  localTime: "07:00"
action:
  type: workspace-activity-report
scope:
  type: authorized-current-workspaces
period:
  type: previous-calendar-day
metrics:
  - messages-count
  - message-topics
  - polls-count
  - quizzes-count
  - poll-and-quiz-topics
  - active-participants
delivery:
  target: requester
```

The original user text may be retained as `sourceText` for provenance/audit, but runtime must not treat it as the action to execute unless the canonical action itself is an explicit static notification.

## Stage 5 — Deterministic Action Execution

Every canonical action maps to an explicit executor/capability contract.

Example task cancellation:

```text
task-cancel
→ resolve canonical task target in scope
→ current authorization
→ Action Gate
→ task-store cancellation
→ reload/verify state
→ unified result
```

Example activity report:

```text
workspace-activity-report
→ resolve authorized scope
→ resolve canonical period
→ collect fresh persisted/live evidence through approved capability
→ aggregate deterministic metrics
→ compose bounded report
→ deliver
```

AI may be used for explicitly non-authoritative analysis/composition through the AI Router, but must not replace canonical state transitions, authorization or post-conditions.

## Stage 6 — Post-condition Verification

An action is not successful merely because it was selected or authorized.

Success requires verification of the authoritative result.

Examples:

- `task-cancel`: task is no longer operational/active;
- automation mutation: same canonical automation has the expected new version/state;
- scheduled report: occurrence ran, report result exists, delivery outcome is recorded;
- failed/denied delivery or mutation must never be reported as completed.

## Transport-neutral contract

All transports normalize to `UnifiedSGRequest` and receive `UnifiedSGResult`.

A transport adapter may supply transport-specific metadata, but core semantics cannot depend on Telegram chat/message IDs.

Canonical delivery target is abstract:

```text
transport
destination
globalActorId
workspaceId (optional)
thread/conversation locator (optional)
```

Telegram IDs are adapter-owned locator values, never global SG identity or semantic authority.

## Required regression contract

Implementation must cover at minimum:

1. semantic equivalence of "за вчера", "за прошедший день", "за предыдущий день" → `previous-calendar-day`;
2. distinction of "за последние сутки" → `rolling-24-hours`;
3. `task-cancel` changes authoritative task state and disappears from default active listing;
4. scheduled report request creates a structured executable workflow rather than a self-notification containing the instruction text;
5. scheduled execution produces the requested fresh report and does not echo the original instruction as the result;
6. equivalent requests entering through different transports produce the same canonical intent/execution plan modulo transport/delivery metadata;
7. ambiguity or insufficient semantic confidence fails closed with clarification rather than guessing;
8. Action Gate authorization without completed authoritative mutation cannot become a success response.

## Non-negotiable boundaries

- no phrase-specific patches as the primary behavior;
- no Telegram-only implementation of semantic/task/temporal/automation logic;
- no second scheduler, Action Gate, identity, scope, temporal or task store;
- no direct AI authority over deterministic state changes;
- no success without post-condition evidence;
- reuse existing Semantic Kernel, Temporal Context, Automation 2.0, Capability System, Resource Authority, Action Gate, Delivery Router and Observability.
