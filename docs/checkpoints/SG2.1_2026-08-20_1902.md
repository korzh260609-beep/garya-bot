# SG 2.1 working rollback checkpoint — 2026-08-20 19:02 +03:00

## Immutable rollback reference

- Repository: `korzh260609-beep/garya-bot`
- Development branch at checkpoint: `dev/sg2.1-semantic`
- Rollback branch: `checkpoint/ar2-green-20260820-1901`
- Rollback commit: `a08ddd2a5dec9b6f366b3f208a112a2597dc61a0`
- SG 2.1 CI: run `32389070805`, run number `8633`, SUCCESS on the rollback commit.
- `main` is not part of this checkpoint and must not be used as the SG 2.1 working branch.

## State captured at this checkpoint

This checkpoint represents the last verified green SG 2.1 development state immediately after canonical Adaptive AI Routing 2.0 (AR2) documentation synchronization.

Verified at this checkpoint:
- `dev/sg2.1-semantic` exact HEAD `a08ddd2a5dec9b6f366b3f208a112a2597dc61a0` passed SG 2.1 CI #8633;
- existing SG runtime/code remains unchanged by AR2 documentation work;
- Block 2.5 AI Routing Foundation remains the implemented routing baseline;
- Adaptive AI Routing 2.0 is accepted/canonical but remains PLANNED / NOT IMPLEMENTED;
- AR2 is explicitly an extension of the single existing AI Router, not a second router;
- canonical AR2 design includes L0 deterministic/no-LLM, L1 low-cost AI, L2 general AI, L3 advanced reasoning;
- Minimum Sufficient Intelligence is the routing principle;
- provider fallback and semantic escalation are separate mechanisms;
- model tier and reasoning effort are separate controls;
- concrete provider/model product names are configuration, not SG business logic;
- routing remains transport-independent and cannot bypass Access, Resource Authority, Action Gate, Owner Security or Credential Manager;
- canonical documentation synchronization includes `DECISIONS.md`, `AI_MODEL_PRINCIPLE.md`, `architecture/ADAPTIVE_AI_ROUTING_2_0.md`, `architecture/TRANSPORTS_AND_AI_ROUTING.md`, architecture index, Block 2.5 roadmap and top-level pillars index.

## Next planned development

The next implementation stage after this checkpoint is:

`AR2.1 — Routing Contract`

AR2.1 and later AR2 stages must not be treated as implemented or closed until code, tests/regressions, `npm run check` and exact-HEAD SG 2.1 CI evidence exist.

## Rollback rule

If later AR2 implementation or other development introduces regressions that cannot be corrected safely, restore the SG 2.1 working branch to the immutable checkpoint branch/commit:

`checkpoint/ar2-green-20260820-1901`

or exact commit:

`a08ddd2a5dec9b6f366b3f208a112a2597dc61a0`

Do not use or rewrite `main` for SG 2.1 rollback.

A rollback restores code/repository state to this checkpoint; any external production data migrations or state changes performed after the checkpoint must be evaluated separately before rollback.
