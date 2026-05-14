# project_memory STORAGE_STRATEGY

> AGENT NOTE:
> This file defines stable storage strategy for SG 2.0 Project Memory.
> It is not a progress tracker and must not be used as proof of live DB state.
> Verify active branch files and runtime / DB diagnostics before claiming what exists or is enabled.

---

## 1. Purpose

Project Memory storage must separate four concerns:

```text
schema definition
schema bootstrap
formal migration workflow
live DB verification
```

These concerns must not be collapsed into one hidden runtime behavior.

---

## 2. Storage authority rule

Documentation may describe the intended model.

Repository files define available code.

Runtime / DB diagnostics prove what exists in live infrastructure.

Therefore:

```text
docs != DB proof
schema helper != production migration history
bootstrap flag != confirmed live tables
```

---

## 3. Schema definition

Project Memory schema definition belongs in the Project Memory module boundary.

Expected boundary file:

```text
src/memory/project/projectMemorySchema.js
```

Schema definition may expose SQL builders and schema ensure helpers.

It must not:

```text
write memory entries
confirm candidates
read project memory context
call AI
touch Telegram
fetch sources
perform autonomous sync
```

---

## 4. Runtime schema bootstrap

Runtime schema bootstrap may exist only as a gated helper.

Expected boundary file:

```text
src/app/projectMemoryBootstrap.js
```

Rules:

```text
disabled by default
explicit env flag required
safe to skip when DB is not configured
must not write memory entries
must not enable prompt injection
must not claim production readiness
```

Runtime bootstrap is useful for:

```text
dev
staging
manual controlled setup
smoke tests
safe initial schema ensure
```

Runtime bootstrap is not a replacement for production migration governance.

---

## 5. Formal migration workflow

If Project Memory needs production-grade DB change management, add a formal migration workflow.

Formal migrations should become the production DB change path.

Rules:

```text
migrations must be explicit
migrations must be reviewable in PRs
migrations must be ordered
migrations must be idempotent or safely tracked
migrations must not run secretly from memory modules
migrations must not live inside postgresClient.js
```

The PostgreSQL client boundary must stay generic and must not own migration orchestration.

---

## 6. Recommended production model

Recommended model:

```text
Formal migrations = production source of DB changes
Runtime schema bootstrap = gated helper for dev/staging/manual setup
Live DB diagnostics = proof of actual deployed state
```

This gives SG:

```text
clear production governance
safe local/staging setup
no hidden startup mutations by default
no false claims about live DB readiness
```

---

## 7. Live DB verification

Before claiming Project Memory storage is production-ready, verify live DB state from runtime / DB diagnostics.

Minimum checks:

```text
DATABASE_URL configured
connection works
sg_project_memory_entries exists
sg_project_memory_write_audit exists
expected indexes exist
expected constraints exist
candidate creation can be tested safely or through a dry/smoke path
confirmed read can be tested safely or through a dry/smoke path
```

Do not expose secrets or raw connection strings in diagnostics.

---

## 8. Forbidden shortcuts

Do not:

```text
claim tables exist because schema code exists
claim production readiness because bootstrap code exists
enable schema bootstrap by default without approval
put migration orchestration in postgresClient.js
let Project Memory auto-migrate secretly during normal message handling
let Telegram commands mutate schema directly
store DB/env/raw logs in Project Memory
```

---

## 9. Next safe implementation order

When the Monarch approves storage work, proceed in this order:

1. Verify current branch files.
2. Decide whether to introduce formal migrations now or keep bootstrap-only temporarily.
3. If migrations are introduced, design migration runner boundary first.
4. Keep `postgresClient.js` generic.
5. Add smoke tests for migration/bootstrap behavior.
6. Verify live DB state through safe diagnostics before production claims.
7. Only after storage proof, continue to candidate/confirmation command surfaces.

---

## 10. Final rule

Project Memory storage must be explicit, reviewable, gated, and verifiable.

Correct:

```text
schema definition -> reviewed migration/bootstrap -> diagnostics -> verified state
```

Incorrect:

```text
hidden startup mutation -> assumed live DB -> unverified production claim
```
