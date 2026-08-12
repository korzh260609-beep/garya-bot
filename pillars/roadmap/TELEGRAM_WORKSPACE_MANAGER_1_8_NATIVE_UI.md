# TWM1.8 — Telegram Native UI & Setup Wizard

## Status
IMPLEMENTED / CODE-CI-VERIFIED. Final CLOSED status requires the documentation-synchronized HEAD to pass SG 2.1 CI.

## Delivered
- private-chat `/workspace` and `/workspaces` management entrypoints;
- Telegram inline keyboards through the existing Bot API client;
- authority-filtered workspace list and deterministic workspace selection;
- progressive quick setup instead of a flat settings matrix;
- response, moderation, publication, memory, AI, automation, notifications and members/roles surfaces;
- connect instructions for non-technical users;
- diagnostics with fresh authority/bot-capability reads;
- history browsing and explicit rollback;
- two-step preview/confirmation for state changes;
- all writes converge on TWM1.6 `WorkspaceConfigurationService` and TWM1.7 canonical Action Gate;
- production webhook routing for TWM commands/callbacks without hijacking ordinary natural-language messages;
- Render production composition using existing Identity, Resource Authority, PostgreSQL, Bot API client, Observability and Action Gate.

## Acceptance gate
A non-technical user can perform first setup through Telegram buttons without code, JSON, `.env` or database access. Automated acceptance additionally proves:
- unauthorized workspaces are not listed;
- cross-workspace callbacks are denied before mutation;
- preview writes nothing;
- confirmation is request-bound to the Telegram callback;
- rollback is separately confirmed and versioned;
- ordinary conversation remains on the existing SG runtime path;
- background Telegram acknowledgement preserves durable completion.

## Evidence
Code/runtime gate: HEAD `7f23ec429e10cfbd0a4eeeafd3c5995c249a2858`, SG 2.1 CI #7319 — SUCCESS.

Architecture: `../architecture/TELEGRAM_WORKSPACE_MANAGER_1_8_NATIVE_UI.md`.
Workflow: `../workflow/TELEGRAM_WORKSPACE_MANAGER_1_8_NATIVE_UI_WORKFLOW.md`.
Evidence: `../../evidence/TWM1_8_TELEGRAM_NATIVE_UI_SETUP_WIZARD.md`.

## Next
After final closure, the next canonical TWM stage is TWM1.9 — Natural-Language Configuration. TWM1.9 must reuse this UI/backend mutation boundary and cannot introduce keyword hacks or direct AI-owned writes.
