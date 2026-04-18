# Stage Check Real Profiles — Migration Plan Draft

This file is a non-runtime migration plan.

## Current stable runtime
Stable checkpoint:
- 2 = PARTIAL
- 5 = OPEN
- 14A = OPEN

Do not break this checkpoint.

## Migration strategy

### Phase 1 — Skeleton only
Add non-runtime files:
- profile families
- profile contracts
- default profile drafts
- resolver draft

No imports from runtime evaluator/collector.

### Phase 2 — Diagnostics only
Expose draft profile resolution in diagnostics only:
- profileKey
- family
- resolver score

Still do not use it for status decisions.

### Phase 3 — Evidence shadow mode
Run old evidence collector + draft profile collector in parallel.
Compare outputs in diagnostics only.

### Phase 4 — Exact evaluator shadow mode
Compute:
- current runtime exact status
- draft profile-based exact status

Do not replace runtime result yet.

### Phase 5 — Aggregate evaluator shadow mode
Compute:
- current runtime aggregate status
- draft profile-based aggregate status

Compare across multiple workflow revisions.

### Phase 6 — Controlled switch
Switch runtime only after:
- no regressions on stable checkpoints
- no new false PARTIAL spikes
- profile contracts reviewed

## Hard rules
- no stage-number hacks
- no exact title dependency
- workflow changes must not require code rewrites
- contracts first, runtime later