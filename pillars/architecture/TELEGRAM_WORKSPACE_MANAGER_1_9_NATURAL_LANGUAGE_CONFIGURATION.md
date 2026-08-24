# TWM1.9 — Natural-Language Configuration Architecture

## Boundary
TWM1.9 adds an ordinary-language control surface over the existing Telegram Workspace Manager backend. It does not create a second configuration store, authority system, Action Gate, Telegram transport, AI provider path or runtime.

## Canonical path

```text
addressed Telegram message
→ existing Telegram invocation boundary
→ TWM1.9 semantic classification through existing AI Router
→ not-twm: unchanged ordinary SG runtime
→ configure/history intent: resolve exact authorized workspace
→ bounded structured output
→ deterministic backend operation
```

Configuration mutation continues as:

```text
NL config patch
→ current namespace config read
→ deterministic deep merge
→ TWM1.6 proposeChange
→ fresh Resource Authority / workspace authority
→ validation + risk
→ durable TTL-bound pending proposal
→ explicit Telegram confirmation
→ exact stored proposal
→ TWM1.7 canonical Action Gate
→ atomic PostgreSQL config/history write
```

## Authority rules
- group/supergroup/channel chat scope is authoritative for `this group/channel` semantics;
- model output cannot redirect a group-context request to another workspace;
- private-chat workspace selection is limited to authority-filtered candidate workspaces;
- ambiguous private requests ask for workspace selection rather than guessing;
- AI output cannot grant authority or bypass validation/confirmation/Action Gate.

## Structured proposal contract
AI Router returns only a strict bounded classification:
- `configure`;
- `history-query`;
- `not-twm`.

Workspace id is schema-bounded to currently authorized candidates. Configuration output is a JSON patch string, not an authoritative final state. The service parses it, reads current configuration, deterministically merges only explicitly supplied fields, and sends the resulting full object into the existing TWM1.6 validator/proposal service.

This prevents a request such as `enable anti-spam` from silently deleting unrelated moderation configuration.

## Confirmation durability
A generated TWM1.6 proposal is persisted in `telegram_workspace_pending_actions` with:
- opaque token;
- exact workspace;
- exact canonical actor and Telegram identity;
- request/trace ids;
- exact structured proposal;
- bounded expiry;
- one-way pending/processing/completed/cancelled/failed lifecycle.

The confirmation callback contains only the opaque token. SG does not call AI again after confirmation. Actor mismatch, expiry and replay cannot create an executable second proposal.

## History questions
Questions such as `who disabled links in Witch?` are interpreted only to choose an authorized workspace, namespace and optional path. Actor/version/time facts come from deterministic configuration history, never from model output.

## Failure behavior
- ordinary-message NL classification failure falls through to the pre-existing ordinary SG runtime;
- `not-twm` also falls through unchanged;
- protected TWM1.9 confirmation callbacks fail closed and never enter ordinary conversation runtime;
- production TWM1.9 is composed only when TWM backend, PostgreSQL and production AI Router are available;
- TWM1.8 native UI remains usable independently of TWM1.9.
