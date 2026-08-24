# SG 2.1 MODULE DOCUMENTATION

This directory is intentionally empty at the start of SG 2.1 development.

Module documentation is created only when a new SG 2.1 module is introduced through the active roadmap and its architecture contract has been accepted.

Expected future module groups include:
- semantic-kernel
- context
- memory
- decision
- action-gate
- capabilities
- identity
- observability
- ai-routing
- transports
- automation
- lifecycle-activity
- telegram-workspace-manager

Lifecycle Activity (LA) is an accepted, planned cross-cutting module at the canonical architecture/roadmap/workflow level. LA1–LA3 are NOT IMPLEMENTED until code/tests/exact-head CI evidence exists. Its scope is a transport-independent append-only history of meaningful SG actions with scalable actor/workspace/transport/entity/correlation fields, semantic activity queries and human-readable summaries. LA remains non-authoritative and fail-open relative to the domain action it observes; it must not replace Memory, PDK4, Observability, Automation, AI Router or domain stores. Canonical documents: `../architecture/LIFECYCLE_ACTIVITY.md`, `../roadmap/LIFECYCLE_ACTIVITY_PROGRAM.md`, `../workflow/LIFECYCLE_ACTIVITY_WORKFLOW.md`.

Telegram Workspace Manager 1.0 is now an accepted and actively implemented cross-cutting module at the canonical architecture/roadmap/workflow level. TWM1.1–TWM1.2 are CLOSED / CI-verified and TWM1.3 is next. Its scope includes multi-user group/channel configuration; TWM1.14 content, polls, quizzes, user-supplied media publication, deterministic result statistics and bounded AI Router analysis; and TWM1.15 Community Operations, Engagement & Analytics covering forms, events, FAQ/onboarding, feedback, cases, tasks/reminders/decisions, content planning, summaries, workspace analytics, owner briefs and exports. Current implementation truth remains in `src/telegramWorkspace/`, canonical TWM architecture/roadmap/workflow and stage evidence; a separate module-detail document is added only when it provides new canonical information rather than duplicating those sources.

Historical SG 2.0 module documentation must not be restored here.
