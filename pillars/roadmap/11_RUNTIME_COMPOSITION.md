# Block 11 — Runtime Composition

## Scope

Compose the completed Blocks 0–10 into one executable runtime without changing approved architecture or trust order.

## Contracts

- One canonical request handler receives only validated `CanonicalInput`.
- Dependencies are explicit and validated before readiness.
- The runtime owns lifecycle and orchestration, not semantic or authorization policy.
- Action Gate remains the sole authorization boundary for protected execution.
- Capability and Domain Runtime remain replaceable execution boundaries.

## Implementation slice

- `src/runtime/config.js` — validated environment configuration and fail-fast rules.
- `src/runtime/createProductionRuntime.js` — composition root, canonical handler, lifecycle, health and readiness.
- `src/runtime/localProductionHarness.js` — deterministic production-like local transport path.
- `src/runtime/entrypoint.js` — executable startup and graceful shutdown entrypoint.
- `tests/runtimeComposition.test.js` — full-path, fail-fast, observability and protected-action integration evidence.
- `pillars/architecture/RUNTIME_COMPOSITION.md` — runtime architecture boundary.

## Acceptance evidence

Completion is derived from repository evidence, not manual status labels:

- `npm ci` succeeds;
- `npm run check` succeeds;
- `npm start` prints `runtime-ready` and a successful full-path response;
- integration tests prove Transport → Identity/Scope → CanonicalInput → Context/Memory → Semantic Kernel → Decision Engine → Action Gate → Capability → Response → Delivery;
- protected intent does not execute before an allowed GateDecision;
- invalid mandatory configuration fails before readiness;
- shutdown rejects new requests and closes after in-flight work drains;
- GitHub Actions records successful PR merge-ref evidence that includes the reviewed `dev/sg2.1-semantic` HEAD. This is valid integration evidence but is not described as a separate branch-push run.

## Exclusions

Block 11 does not add PostgreSQL persistence, durable workers, real Telegram Bot API delivery, production AI credentials, Render deployment or pilot users. Those remain Blocks 12–19 and Pilot Launch.
