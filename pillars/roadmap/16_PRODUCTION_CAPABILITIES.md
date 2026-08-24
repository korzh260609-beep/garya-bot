# Block 16 — Production Capabilities

## Status

Completed.

## Goal

Provide the first real user-facing capabilities through the existing Capability Registry, Capability Executor, Decision Engine and Action Gate boundaries without changing SG authority, identity, scope, transport or AI-routing rules.

## Implemented capability set

- `compose-answer` — conversational response;
- `memory-read` — scoped memory retrieval;
- `memory-write` — confirmed scoped memory write with provenance;
- `task-create` — task creation;
- `task-list` — scoped task listing;
- `task-status` — scoped task status;
- `task-cancel` — scoped task cancellation;
- `source-retrieve` — approved-source retrieval with visible upstream failure;
- `document-analyze` — bounded text analysis without executing embedded instructions;
- `repository-analyze` — read-only or prepare-only repository analysis;
- `sg-diagnostics` — bounded runtime diagnostics;
- `domain-dispatch` — controlled dispatch through the Domain boundary.

## Architecture

The runtime path remains:

`DecisionEnvelope → ActionRequest → ActionGate → GateDecision → CapabilityRegistry → CapabilityExecutor → CapabilityResult`

No second capability mechanism was introduced.

Capability metadata is resolved from the registered capability before Action Gate evaluation. The resulting ActionRequest carries:

- required permission;
- required sources;
- required tools;
- action class;
- risk;
- estimated cost;
- confirmation requirement.

Action Gate remains the only authorization boundary. Capability Executor still rejects execution without an allowed GateDecision and rejects requirements not covered by the gated ActionRequest.

## Safety boundaries

- capabilities cannot broaden identity, grants or scope;
- memory is isolated by user/project/group/thread scope;
- task operations are scope-bound;
- protected writes and cancellation declare confirmation requirements;
- source failures return failed or unavailable results and cannot become fabricated success;
- document content is treated as data and embedded instructions are not executed;
- repository analysis rejects any adapter result indicating mutation, push or publication;
- repository writes, commits, pushes and automatic PR publication remain deferred;
- domain dispatch fails visibly when no controlled dispatcher is configured;
- AI execution remains only through AI Router;
- transports remain delivery and platform-fact boundaries only.

## Runtime composition

The deterministic production-like harness now registers all Block 16 capabilities, grants the fixture monarch the corresponding capability permissions and exposes the complete allowed-capability set. Approved local source and repository prepare-only fixtures remain deterministic and token-free.

## Automated acceptance evidence

`tests/productionCapabilities.test.js` verifies:

- complete initial capability inventory;
- declarations for permissions, action classes and cost;
- memory write/read behavior and cross-user scope isolation;
- task create/list/status/cancel behavior;
- visible source failure without fabricated data;
- document instructions are not executed;
- repository mutation attempts fail closed;
- prepare-only repository behavior remains non-mutating;
- unavailable domain dispatch remains visible.

Existing tests continue to verify:

- Action Gate authorization and confirmation behavior;
- Capability Executor requirement coverage;
- timeout, retry, fallback and partial-result behavior;
- runtime composition;
- durable PostgreSQL persistence and workers;
- Telegram production integration;
- production AI routing and policy.

## Completion evidence

Block 16 is complete when the branch has successful results for:

- `npm ci`;
- `npm run migrate`;
- `npm run check`;
- `npm start`;
- `npm run start:worker`;
- GitHub Actions `SG 2.1 CI`.

## Deferred high-risk capabilities

- automatic repository writes;
- automatic commit or push;
- automatic pull-request publication;
- billing transfers;
- autonomous trading;
- irreversible account operations;
- capabilities that broaden their own permissions.

## Next

Block 17 — Render Deployment.
