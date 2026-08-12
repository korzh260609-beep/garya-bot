# TWM1.10 — Workspace Runtime Wiring Evidence

## Status
**CLOSED / IMPLEMENTED / CI-VERIFIED.**

## Scope
TWM1.10 wires persisted Telegram workspace configuration into the existing SG production runtime without creating parallel Telegram transport, runtime, Memory 2.0, AI Router, authority or persistence stacks.

## Runtime wiring
Implementation paths:
- `src/telegramWorkspace/telegramWorkspaceRuntimeWiring.js`;
- `src/runtime/renderWebApplication.js`;
- `src/runtime/createProductionRuntime.js`;
- `src/response/boundedResponseContext.js`;
- `src/memory2/memory2Capabilities.js`.

Verified behavior:
- persisted workspace config is resolved for the exact Telegram chat on each request;
- `responses.mode=off` rejects otherwise accepted workspace invocations;
- `responses.mode=all` admits ordinary ambient group traffic while unrelated rejected update classes remain rejected;
- `responses.mode=mention_only` preserves the existing Telegram invocation boundary;
- `ai.enabled=false` fails closed before ordinary SG runtime/AI execution;
- effective configuration is propagated as immutable `workspaceRuntimePolicy` into canonical runtime metadata and response context;
- unmanaged Telegram chats remain on the existing SG runtime path;
- moderation/publication/automation/notifications/member configuration is propagated as bounded runtime policy for existing/later capability consumers.

## Memory read/write/capture isolation
When `workspace.memory.enabled=false`:
- response-context recall excludes shared `group-memory` and `thread-memory`;
- authorized personal `user-memory`, `user-group-memory` and `project-memory` reads remain governed by existing Memory 2.0 rules;
- explicit shared group/thread writes fail closed with `workspace-memory-disabled` before Memory 2.0 persistence;
- promotion into group/thread memory fails closed with the same policy;
- explicit shared-only recall returns no shared records and does not fall back to unrestricted recall;
- automatic capture from the disabled Telegram workspace is suppressed before Memory 2.0 persistence.

This preserves the existing Memory 2.0 personal/privacy model while making workspace-shared memory enablement an effective runtime boundary.

## Regression coverage
Primary TWM1.10 tests:
- `tests/telegramWorkspaceManager1RuntimeWiring.test.js`;
- `tests/telegramWorkspaceManager1MemoryIsolation.test.js`.

Existing response-context, Memory 2.0 and runtime suites remain part of the full SG 2.1 CI gate.

## CI incident and repair
### SG 2.1 CI #7363
HEAD: `a77c68aba90e27ed879de1a8ca69ac25bc8a2964`
Result: **FAILURE** at `npm run check`.

Root cause was a TWM1.10 regression-test contract mismatch: the test asserted nonexistent/legacy `memoryEnabled`, while the implemented canonical runtime policy field is `workspaceMemoryEnabled`. Production runtime logic already used the canonical field.

### Assertion repair
HEAD: `261d657b6b5a5cb54ceff25395e894dc4ae8e8d1`
SG 2.1 CI #7364: **SUCCESS**.

The test assertion was aligned to the canonical `workspaceMemoryEnabled` contract without changing valid runtime behavior.

## Isolation closure gate
HEAD: `3004dfe4665327db0d830d5ecc52c36cdb948307`
SG 2.1 CI #7368: **SUCCESS**.

Verified full foundation job included:
- `npm ci`;
- `npm run migrate`;
- Block 19 security gate;
- `npm run check`;
- `npm start`;
- `npm run start:worker`;
- independent diagnostics service verification.

This implementation HEAD contains the explicit memory read/write/promotion/capture isolation regression coverage described above.

## Documentation synchronization
TWM1.10 status and behavior are synchronized in:
- `pillars/architecture/TELEGRAM_WORKSPACE_MANAGER_1_0.md`;
- `pillars/roadmap/TELEGRAM_WORKSPACE_MANAGER_1_0_PROGRAM.md`;
- `pillars/workflow/TELEGRAM_WORKSPACE_MANAGER_1_0_WORKFLOW.md`;
- this evidence file.

## Closure rule
The implementation gate is green, but the exact documentation-synchronized closure HEAD must also pass the complete SG 2.1 CI before TWM1.10 is announced CLOSED externally. TWM1.11 — Audit, Rollback, Diagnostics & Observability — is the next canonical stage.