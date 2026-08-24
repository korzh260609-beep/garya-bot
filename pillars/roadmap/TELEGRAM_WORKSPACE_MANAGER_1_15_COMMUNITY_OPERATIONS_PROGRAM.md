# SG 2.1 — TWM1.15 COMMUNITY OPERATIONS, ENGAGEMENT & ANALYTICS PROGRAM

## Status
**PLANNED / NOT IMPLEMENTED.**

TWM1.15 is a functional extension of Telegram Workspace Manager 1.0. It depends on the TWM workspace/authority/config/runtime foundation and on TWM1.14 for content, polls, quizzes, tests and media.

It adds five canonical packages:

```text
TWM Content
TWM Engagement
TWM Community
TWM Operations
TWM Analytics
```

## Goal
Enable an authorized Telegram workspace owner/manager to operate a real community without programming: plan content, run forms/events/competitions, onboard members, maintain FAQ, receive feedback/cases, create tasks/reminders, summarize discussions, record decisions and inspect deterministic analytics.

## Implementation order

### TWM1.15.1 — Domain Contracts & Scope
Implement contracts for forms, submissions, events, registrations, feedback, cases, FAQ, onboarding, content plans, community decisions and analytics snapshots.

Requirements:
- every entity has canonical `workspace_id`;
- actor/user identities use canonical `global_user_id` when identity is required;
- privacy/visibility/retention metadata is explicit;
- operational records are not Memory 2.0 records by default;
- invalid/cross-workspace references fail closed.

**Gate:** deterministic contract/scope/privacy tests.

### TWM1.15.2 — PostgreSQL Persistence
Add bounded workspace-scoped stores/migrations only where an existing canonical SG primitive cannot be reused.

Persist:
- forms/fields/submissions;
- events/registrations/waitlists;
- feedback;
- cases/requests;
- FAQ/onboarding state;
- content plans;
- community decision records/links;
- analytics snapshots.

Reuse existing canonical tasks, memory, conversations and durable automation instead of duplicating them.

**Gate:** restart durability, transactional integrity and cross-workspace isolation.

### TWM1.15.3 — Forms, Surveys & Feedback
Implement multi-step forms/questionnaires, named feedback and genuinely anonymous modes only where real transport/storage semantics support the claim.

Support:
- validation;
- required/optional fields;
- bounded free text;
- submission lifecycle;
- owner/operator review;
- export-ready deterministic records.

**Gate:** private fields remain private, anonymous claims are truthful, replay cannot duplicate submissions.

### TWM1.15.4 — Events, Registration & Participation
Implement event registration/RSVP, capacity limits, waitlists, cancellation and reminders.

Optional competition/challenge/draw flows must preserve participant eligibility evidence and deterministic/auditable selection mechanics appropriate to the feature.

**Gate:** capacity/waitlist transitions are deterministic and restart-safe.

### TWM1.15.5 — FAQ, Knowledge & Onboarding
Implement workspace FAQ and approved knowledge sources plus newcomer onboarding.

Support:
- approved rules/help items;
- newcomer welcome sequence;
- rules acknowledgement where configured;
- navigation links;
- FAQ answer retrieval;
- bounded escalation when no supported answer exists.

Reuse Memory 2.0/Context Resolver without exposing private user memory to other participants.

**Gate:** FAQ answers are workspace-scoped/evidence-backed and private memory never leaks.

### TWM1.15.6 — Community Assistance & Moderation Workflows
Implement unanswered-question candidates, moderation queues, warnings/escalations and owner notifications within configured policy and actual Telegram permissions.

AI Router may classify candidates; deterministic services own state transitions and action execution.

**Gate:** no model-only moderation action, no false success on missing Telegram rights, full audit trail.

### TWM1.15.7 — Cases, Requests & Operator Queues
Implement request/ticket/case lifecycle:

```text
OPEN → TRIAGED → IN_PROGRESS → WAITING → RESOLVED → CLOSED
```

Support categories, priority, assignee, notes, source-message linkage and owner/operator queues.

**Gate:** role-bounded access, restart durability and workspace isolation.

### TWM1.15.8 — Tasks, Reminders & Decisions
Allow authorized users to create SG tasks/reminders from Telegram discussions using existing task/automation primitives.

Implement decision workflow:

```text
proposal → discussion → optional vote → deterministic result → authorized decision confirmation → optional Group Shared Memory fact → optional task/action
```

A poll outcome does not automatically become a binding decision unless an explicit allowed workspace policy says so.

**Gate:** task/decision authority, provenance and memory-promotion boundaries are enforced.

### TWM1.15.9 — Content Planning & Recurring Rubrics
Extend TWM1.14 with content calendar, draft queues, recurring rubrics and editorial approval.

Examples:
- question of the day;
- weekly quiz;
- weekly summary;
- project news;
- planned campaign sequence.

Reuse the existing content service and durable scheduler.

**Gate:** no second publisher/scheduler and scheduled actions remain authority/capability checked.

### TWM1.15.10 — Discussion Summaries & Unanswered Questions
Implement bounded discussion summarization and unanswered-question tracking.

Summary output can include:
- agreed points;
- open issues;
- proposed actions;
- tasks/owners when explicitly confirmed;
- evidence references.

AI-generated summaries remain derived content and do not become confirmed shared memory automatically.

**Gate:** no silent fact/decision promotion and deterministic unresolved/resolved state.

### TWM1.15.11 — Deterministic Workspace Analytics
Implement exact metric definitions over structured workspace events.

Metrics may include where evidence exists:
- messages/activity;
- active participants;
- joins/leaves;
- poll/quiz/test participation;
- form submissions;
- cases by status/throughput;
- unanswered questions;
- publications;
- reactions/engagement.

Pipeline:

```text
structured events → normalize/deduplicate → deterministic aggregates → versioned AnalyticsSnapshot → optional AI Router narrative
```

**Gate:** replay/restart cannot alter exact totals and AI cannot override metrics.

### TWM1.15.12 — Owner Briefs, Reports & Exports
Implement authorized daily/weekly/monthly workspace briefs and export paths for supported formats such as CSV/XLSX/PDF/JSON where the corresponding SG artifact capability is available.

Reports must distinguish:
- deterministic metrics;
- AI interpretation;
- unavailable/insufficient evidence.

**Gate:** privacy/resource authority applies equally to UI, brief and export.

### TWM1.15.13 — Production E2E & Live Acceptance
Prove real Telegram flows across at least two workspaces and multiple authority levels.

Required acceptance includes:

```text
owner creates form
→ member submits
→ private fields remain bounded
→ event registration + waitlist works
→ FAQ/onboarding works
→ case created/assigned/resolved
→ discussion summary produced but not auto-confirmed as memory
→ decision confirmed and optionally promoted under policy
→ task/reminder created through existing engine
→ content plan schedules a recurring publication
→ analytics snapshot computed
→ restart/replay leaves counts unchanged
→ owner brief generated
→ unauthorized/cross-workspace reads/writes denied
```

**Gate:** CI plus real Telegram runtime evidence appropriate to each production claim.

## UX principles
- natural language primary;
- native Telegram UI for structured workflows;
- progressive forms/wizards instead of raw JSON;
- owner sees queues, status and summaries;
- members see only their allowed operations/data;
- technical IDs hidden by default;
- exact metrics clearly separated from AI interpretation.

## Security and privacy boundaries
- no second identity/memory/task/scheduler stack;
- no cross-workspace leakage;
- no private user memory in FAQ/group answers;
- no private form/case fields in Group Shared Memory by default;
- no fake anonymity claims;
- no AI direct writes or authority;
- no model-invented analytics;
- no moderation/publication/task external effect without required Action Gate/resource capability;
- no silent poll-result→decision promotion.

## Dependencies
- TWM1 workspace contract/authority/config/runtime foundation;
- TWM1.14 Content, Polls, Quizzes & Media;
- Memory 2.0;
- Session & Conversation Context;
- Resource Authority;
- Action Gate;
- PostgreSQL;
- Durable Automation / Workers;
- Delivery Router;
- AI Router;
- Observability / Internal Event Bus;
- existing task/capability system.

## Definition of DONE
TWM1.15 is complete only when TWM1.15.1–TWM1.15.13 are implemented, tested, CI-verified and live-accepted, with evidence that community operations, engagement and analytics reuse SG's existing core systems, remain workspace/user scoped, survive restart/replay and cannot be controlled or fabricated by AI output.
