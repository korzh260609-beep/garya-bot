# repo — SG 2.0 Repository Module

> AGENT NOTE:
> This file defines the SG 2.0 repository module boundary.
> Read it before adding repo read, repo facts, repo audit, code proposal, GitHub integration, repo runtime snapshots, or repo write workflows.
> Do not allow repo writes, commits, PRs, deploys, or destructive actions without explicit Monarch approval.

Статус: SKELETON

---

## Purpose

`repo` provides controlled repository access and repo facts.

---

## Owns

- repo read boundary;
- repo facts provider;
- project map source policy;
- code analysis input;
- repo audit helpers;
- patch proposal boundary;
- repo runtime snapshot interpretation rules.

---

## Must not own

- applying changes without approval;
- core orchestration;
- AI model calls directly;
- transport handling;
- deployment.

---

## Hard rule

Repo work is read/analyze/prepare by default.
Write actions require explicit Monarch approval.

---

## Runtime state HEAD contract

`runtime/repo/latest/latest-commit-state.json` is a generated snapshot.

It is useful for showing the last observed repository event, changed files, and watcher output.

It must not be treated as the authoritative live branch HEAD.

Reason:

```text
A committed file cannot reliably contain the SHA of the commit that contains it.
Git commit SHA is calculated from commit content.
Generated runtime commits can therefore make the snapshot appear one commit behind the live branch ref.
```

Correct rule:

```text
Use Git ref / compare results as source of truth for live branch HEAD.
Use latest-commit-state.json as last observed watcher snapshot only.
```

When checking whether a copy branch is current, SG must compare refs directly:

```text
base: dev/v2-start
head: <copy-or-working-branch>
expected: status=identical, ahead_by=0, behind_by=0
```

Incorrect:

```text
Assume current_head_sha inside latest-commit-state.json is always equal to the real branch HEAD.
Manually edit latest-commit-state.json to chase branch HEAD.
Use runtime snapshot staleness as proof that branch copy is stale.
```

If watcher/runtime-state needs stronger precision later, design a separate runtime-state V2 instead of manually editing generated JSON.
