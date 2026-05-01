# SAVEPOINT — Living SG Repo Source Capability Skeleton CI

Saved at: `2026-05-01T15:36:00Z`
Saved by: `SG-advisor`
Scope: `Living SG read-only repository source capability skeleton + CI smoke coverage`

---

## Current confirmed repo state

```text
Repository: korzh260609-beep/garya-bot
Branch: main
Goal: Continue safe transition of SG to Living SG behavior.
Current focus: Define a read-only Repo Source capability skeleton for Living SG without connecting runtime repo-read.
```

---

## Confirmed principle

```text
Living SG can request repository facts only through an explicit source/capability boundary.
Missing source result must produce source-honest behavior, not hallucinated repo status.
Repository read and repository write are separated.
Repository write remains blocked in this skeleton.
Verified repository/source claims require actual runtime source/tool confirmation.
```

---

## Important commits in this block

```text
acaa0791851165af3bdfa3be392d9dd8ef346ad3
- Added src/core/living-sg/LivingRepoSourceCapability.js.
- Defined read-only repository source capability contract.
- Explicitly blocked repository writes.
- Kept runtime repository read disconnected.

5f135a3ced6fae481045b16fee97e35c72bc9e89
- Added scripts/smokeLivingSGRepoSourceCapabilitySkeleton.js.
- Smoke verifies source-honest read-only behavior and blocked writes.
- Smoke verifies no runtime repo-read, executor, RepoStateAgent runtime, Technical Mode expansion, or slash commands.

16f5b540c848c23533c3989f5513d56d9792e3dc
- Added npm script smoke:living-sg-repo-source-capability.

cc01afa4a908c164a1f79aef42ac820faaed2b63
- Added GitHub Actions workflow Smoke Living SG Repo Source Capability.

d1b9591d0c249c8e336abf01417a3d825828562f
- Merged PR #26 into main.
```

---

## PR

```text
PR: #26
Title: Add Living SG repo source capability skeleton
Status: merged
Merge commit: d1b9591d0c249c8e336abf01417a3d825828562f
```

---

## Verified CI behavior

Monarch visually confirmed in GitHub Actions that PR #26 / merge commit is green.

Meaning:

```text
- LivingRepoSourceCapability skeleton imports successfully.
- Read-only repo facts require runtime source confirmation.
- Missing runtime source cannot produce verified repo claims.
- Repo write remains blocked.
- No runtime repo-read was connected.
- No executor was created.
- No RepoStateAgent runtime was connected.
- No Technical Mode expansion happened.
- No slash commands were added.
```

---

## Safe status

```text
executor: not created
repo-read runtime: not connected
Human Meaning Provider: not connected
RepoStateAgent runtime: not connected
Technical Mode: not expanded
new slash commands: not added
runtime: not changed
deploy: not performed
```

---

## Current completed microstep

```text
Living SG read-only Repo Source capability skeleton and CI smoke guard are complete and green.
```

---

## Next safe microstep

```text
Design the source-proof prompt/runtime boundary for future Living SG repo work:
- repo source result must be passed as explicit sourceResult/system message;
- Living SG must distinguish requested repo facts from verified repo facts;
- missing repo source result must produce a source-honest answer;
- do not connect runtime repo-read yet;
- do not create executor;
- do not connect RepoStateAgent runtime yet.
```

Recommended check:

```text
- Verified repo claims require sourceResultConfirmed=true and actual source payload.
- Skeleton metadata cannot itself prove repo facts.
- Repo write remains blocked until explicit executor design and monarch approval.
```

---

## Warnings

```text
Do not connect Human Meaning Provider yet.
Do not connect RepoStateAgent runtime yet.
Do not add executor.
Do not add repo-read runtime yet.
Do not expand Technical Mode.
Do not add slash commands.
Do not deploy unless explicitly requested by Monarch.
```