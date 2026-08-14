# TWM1.9 — Natural-Language Configuration

## Status
CLOSED / IMPLEMENTED / CI-VERIFIED.

## Delivered
- ordinary-language Telegram configuration through the existing AI Router;
- no keyword/phrase command hacks for intent resolution;
- strict structured outputs limited to `configure`, `history-query`, `not-twm`;
- workspace ids schema-bounded to currently authorized candidates;
- exact group/supergroup/channel scope overrides model workspace selection;
- private-chat ambiguity asks for selection instead of guessing;
- configuration uses bounded patches merged deterministically into current namespace state;
- existing settings not named by the user are preserved;
- TWM1.6 remains the only proposal/config mutation service;
- exact proposal is persisted as a TTL-bound actor-bound pending action;
- Telegram confirmation reuses the original request id and exact stored proposal;
- TWM1.7 Action Gate remains mandatory before the atomic write;
- replay, expiry and actor mismatch do not execute;
- history answers use stored config history facts rather than AI-invented actor/version/time;
- classification failures/pass-through keep the ordinary SG runtime path intact;
- protected TWM1.9 callbacks fail closed;
- ordinary Telegram webhook success contract remains backward-compatible.

## Acceptance
Automated tests cover proposal-without-write, safe deep merge, exact confirmation, replay rejection, group scope, private ambiguity, deterministic history, production routing, classifier fallback, callback fail-closed behavior, PostgreSQL restart, actor privacy, TTL expiry and legacy Telegram/persistence compatibility.

## Verified gates
Code HEAD `80863ce9dc5ec7db70a1f00389bf5a41caaa7265`, SG 2.1 CI #7343 — SUCCESS.
Documentation-synchronized HEAD `ee4cffb0c9263395dc61426941219a0b650d7dd9`, SG 2.1 CI #7345 — SUCCESS.

## Architecture
`../architecture/TELEGRAM_WORKSPACE_MANAGER_1_9_NATURAL_LANGUAGE_CONFIGURATION.md`

## Workflow
`../workflow/TELEGRAM_WORKSPACE_MANAGER_1_9_NATURAL_LANGUAGE_CONFIGURATION_WORKFLOW.md`

## Evidence
`../../evidence/TWM1_9_NATURAL_LANGUAGE_CONFIGURATION.md`

## Next
TWM1.10 — Workspace Runtime Wiring.
