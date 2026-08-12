# SG 2.1 — TWM1.15 COMMUNITY OPERATIONS, ENGAGEMENT & ANALYTICS

## Status
**PLANNED / NOT IMPLEMENTED.**

TWM1.15 extends Telegram Workspace Manager 1.0 beyond configuration and content publication into a workspace-scoped community operations layer for Telegram groups, supergroups and channels.

It reuses the existing TWM workspace root, canonical `global_user_id`, Memory 2.0, Session & Conversation Context, Resource Authority, Action Gate, PostgreSQL, Durable Automation, Delivery Router, AI Router and Observability. It must not create a second identity, memory, task, scheduler, moderation or analytics authority system.

## Goal
An authorized workspace owner/manager should be able to operate a Telegram community through ordinary language and Telegram-native UI:

```text
owner request
→ workspace resolution
→ actor/resource authority
→ structured operation proposal
→ validation / policy / confirmation
→ Action Gate where state-changing
→ deterministic domain service
→ Telegram / SG execution
→ durable workspace state
→ audit / diagnostics / reporting
```

## Functional packages
TWM1.15 is divided into five canonical functional packages.

### 1. TWM Content
Builds on TWM1.14 and owns recurring/editorial operation rather than raw Telegram transport.

Capabilities:
- content calendar and content plan;
- recurring rubrics/series such as question of the day, weekly quiz, weekly summary or project news;
- draft queues and editorial status;
- publication review/approval workflow;
- schedule/cancel/reschedule via existing Durable Automation;
- publication history and outcome linkage;
- owner-requested summaries of planned/published content.

TWM Content must reuse `WorkspaceContentService` and TWM1.14 media/poll/test infrastructure rather than creating a parallel publisher.

### 2. TWM Engagement
Owns structured participation mechanics.

Capabilities:
- multi-step forms and questionnaires;
- event registration / RSVP;
- capacity limits and waitlists;
- competitions/challenges;
- transparent prize-draw participant registry and deterministic/random-selection evidence where such a feature is allowed by policy;
- feedback forms;
- idea collection;
- ratings;
- surveys beyond a single Telegram poll;
- follow-up questions based on deterministic result state.

A form may collect several fields in sequence and produce one workspace-scoped submission record. Private fields must never be promoted to Group Shared Memory automatically.

### 3. TWM Community
Owns member-facing community assistance and bounded moderation workflows.

Capabilities:
- FAQ / approved workspace knowledge base;
- newcomer onboarding;
- welcome flow;
- rules presentation;
- required/optional acknowledgement;
- navigation/help links;
- unanswered-question detection;
- feedback/complaint/idea intake;
- bounded moderation workflows;
- warnings, escalation and owner notifications according to configured policy and actual Telegram permissions.

FAQ answers must use approved workspace knowledge and bounded memory/context. Model output must not invent workspace policy as fact.

Onboarding must not infer sensitive traits or create hidden profiles. Any persistent user-specific onboarding state remains scoped to `global_user_id + workspace_id` and applicable privacy policy.

### 4. TWM Operations
Owns operational work objects generated from Telegram activity.

Capabilities:
- workspace requests/tickets/cases;
- category, status, priority and assignee;
- owner/operator queues;
- tasks created from group discussion;
- deadlines and reminders;
- responsibility assignment to verified users;
- event/action follow-up;
- approval workflows;
- role-bounded operator actions;
- shared decision records;
- decision → task/action linkage;
- status summaries.

TWM Operations must reuse SG's existing task/automation primitives where compatible. Telegram presentation must not become a second task engine.

A canonical request lifecycle may be:

```text
OPEN
→ TRIAGED
→ IN_PROGRESS
→ WAITING
→ RESOLVED
→ CLOSED
```

A canonical event registration lifecycle may be:

```text
REGISTERED
→ CONFIRMED
→ WAITLISTED
→ CANCELLED
→ ATTENDED / NO_SHOW where evidence exists
```

### 5. TWM Analytics
Owns deterministic workspace metrics and evidence-backed summaries.

Capabilities:
- message/activity counts where Telegram/runtime evidence is available;
- active participant counts using explicit deterministic definitions;
- new-member/join/leave trends where events are available;
- poll/quiz/test participation and result metrics from TWM1.14;
- form/submission counts;
- request/ticket throughput and status distribution;
- unanswered-question counts;
- content publication counts;
- reaction/engagement metrics where Telegram exposes reliable evidence;
- owner daily/weekly/monthly summaries;
- trend comparison between bounded time windows;
- exportable reports.

Canonical analytics rule:

```text
structured workspace events
→ normalize / deduplicate
→ deterministic metric definitions
→ deterministic aggregates
→ versioned AnalyticsSnapshot
→ optional AI Router interpretation
```

AI may explain, summarize or identify patterns in an `AnalyticsSnapshot`, but may not invent counts, percentages, rankings, participant identities or causal conclusions unsupported by evidence.

## Shared decision workflow
TWM1.15 may support community decision flows:

```text
proposal
→ bounded discussion
→ poll/vote when requested
→ deterministic result
→ authorized decision confirmation
→ Group Shared Memory decision record where policy permits
→ optional task/action creation
```

A poll result is not automatically an authoritative workspace decision. Decision confirmation remains a separate authorized step unless workspace policy explicitly defines a deterministic rule that is itself allowed by SG policy.

## Discussion summarization
SG may summarize long discussions into:
- agreed points;
- unresolved questions;
- proposed actions;
- assigned tasks;
- referenced evidence.

A generated summary is derived content and must preserve provenance/confidence. It must not silently become confirmed Group Shared Memory or a binding decision.

## Unanswered-question detection
SG may identify likely unanswered questions from bounded conversation context and workspace event state.

The detector may:
- mark a candidate unanswered question;
- resolve it when a reply/accepted answer is observed;
- notify allowed operators;
- include it in owner summaries.

AI classification can assist through AI Router, but state transitions and counts must remain deterministic and auditable.

## FAQ and knowledge base
Workspace FAQ/knowledge items are separate from personal user memory.

Sources may include:
- owner/admin-approved text;
- workspace rules;
- approved documents;
- approved Group Shared Memory facts;
- explicitly registered knowledge resources.

Recall order remains permission-first and workspace-scoped. A user's private memory must not be used to answer another member merely because both are in the same group.

## Feedback and submissions
TWM1.15 supports named or intentionally anonymous feedback modes only when the channel/UI can actually preserve the requested anonymity semantics.

SG must not promise anonymity when transport metadata or configured storage makes identity available. Stored submissions need explicit scope, provenance, privacy class, retention state and visibility policy.

## Tasks and reminders
Tasks/reminders created from Telegram must preserve:
- workspace id;
- creator actor;
- assignee identity when verified;
- due time/timezone;
- source conversation/message where allowed;
- lifecycle state;
- audit trail.

Scheduling uses the existing durable scheduler/worker system. Execution-time authority is rechecked for external actions where policy requires it.

## Reports and exports
Authorized users may request bounded exports for supported workspace data, for example CSV/XLSX/PDF or structured JSON where implementation capability exists.

Exports must:
- apply the same Resource Authority/privacy filters as interactive views;
- avoid cross-workspace data;
- exclude secrets;
- distinguish raw deterministic metrics from AI-generated narrative;
- be auditable as a data-access event when sensitive data is included.

## Proposed persistence
TWM1.15 should reuse existing entities where possible and introduce only bounded workspace-scoped records such as:
- `telegram_workspace_forms`;
- `telegram_workspace_form_fields`;
- `telegram_workspace_submissions`;
- `telegram_workspace_events`;
- `telegram_workspace_registrations`;
- `telegram_workspace_feedback`;
- `telegram_workspace_cases`;
- `telegram_workspace_faq_items`;
- `telegram_workspace_onboarding_state`;
- `telegram_workspace_content_plans`;
- `telegram_workspace_decisions` where not represented by an existing canonical decision object;
- `telegram_workspace_analytics_snapshots`.

Do not duplicate canonical SG tasks, users, memories, conversations or automation jobs merely to make Telegram-specific copies.

## Proposed services
- `WorkspaceFormService`;
- `WorkspaceEventService`;
- `WorkspaceFeedbackService`;
- `WorkspaceCaseService`;
- `WorkspaceFaqService`;
- `WorkspaceOnboardingService`;
- `WorkspaceContentPlanService`;
- `WorkspaceCommunityDecisionService`;
- deterministic `WorkspaceAnalyticsService`;
- `WorkspaceSummaryService` using deterministic facts plus AI Router for narrative when needed.

Each write-capable service must receive already resolved canonical actor/workspace context and still enforce its own invariant checks. UI/model layers never write tables directly.

## Authority model
Effective action permission remains:

```text
Telegram resource permission
∩ SG workspace grant/policy
∩ SG bot capability
∩ action-specific privacy/visibility policy
∩ Action Gate policy
```

Representative bounded workspace roles may be mapped to functions:
- OWNER/ADMIN — configure and approve broad workspace operations;
- EDITOR — content/draft/publication within granted bounds;
- MODERATOR — moderation/community queues within granted bounds;
- OPERATOR — cases/forms/events/tasks within granted bounds;
- ANALYST — read allowed aggregate analytics, not unrestricted raw private data;
- VIEWER — read only explicitly permitted views.

These are workspace roles only and cannot create SG-global authority.

## Memory and context integration
TWM1.15 reuses existing Memory 2.0 and Session & Conversation Context.

```text
personal user memory
≠ user × workspace/group memory
≠ group shared memory
≠ conversation context
≠ TWM operational records
```

Operational records are not automatically memory. A resolved case, form submission, event registration or analytics snapshot is stored in its domain table; only policy-approved facts may later be promoted into Memory 2.0 with provenance.

## Privacy
Hard requirements:
- no cross-user private-memory leakage;
- no cross-workspace leakage;
- private form/case/feedback fields are not group memory;
- anonymous mode is never claimed without real transport/storage semantics;
- analytics views must use least-privilege data;
- member rankings/identifiable analytics require explicit policy and visibility justification;
- retention and deletion rules remain observable and policy-controlled.

## Non-negotiable boundaries
- no second Telegram transport;
- no second identity root;
- no second memory/context subsystem;
- no second durable scheduler/task engine when existing primitives suffice;
- no AI direct database writes;
- no AI-created authority;
- no model-invented statistics;
- no hidden deanonymization;
- no implicit private→shared memory promotion;
- no moderation/publication/task execution without actual Telegram/SG capability and required Action Gate path;
- no claim of successful external action without execution evidence.

## Architectural Definition of Success
TWM1.15 is architecturally satisfied when the same secure workspace backend can support content planning, forms/events/engagement, FAQ/onboarding/moderation assistance, cases/tasks/decisions and deterministic analytics while preserving user/workspace privacy, reusing existing SG memory/context/tasks/automation, keeping AI non-authoritative, and allowing an ordinary authorized workspace owner to operate the community without programming.
