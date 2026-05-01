# SAVEPOINT — Living SG Source Proof Boundary CI

Saved at: `2026-05-01T15:43:00Z`
Saved by: `SG-advisor`
Scope: `Living SG source-proof boundary skeleton + prompt policy + CI smoke coverage`

---

## Current confirmed repo state

```text
Repository: korzh260609-beep/garya-bot
Branch: main
Goal: Continue safe transition of SG to Living SG behavior.
Current focus: Separate requested source facts from verified source facts before connecting any repo-work runtime.
```

---

## Confirmed principle

```text
Requested source facts are not verified source facts.
A source request, source plan, capability plan, metadata flag, or bridge signal cannot prove repository/source facts.
Verified repository/source claims require an actual runtime source/tool result passed into the prompt as sourceResult/system evidence.
If sourceResultSystemMessage is missing, empty, stale, or not explicitly confirmed, SG must state that repo/source facts are not verified in the current runtime.
Requested repo facts, planned repo facts, project memory, projectIntent metadata, or Living SG metadata must not be presented as verified repository state.
Repository read and repository write are separate.
Read proof cannot authorize write.
Write remains blocked without explicit permission plus executor design.
```

---

## Important commits in this block

```text
e5cbaaf3377b678bc4cb2619c2111db58d3da874
- Added src/core/living-sg/LivingSourceProofBoundary.js.
- Defined requested_not_verified vs verified source proof states.
- Kept all runtime/source/repo calls disconnected.

8b1752d5d8c973b1c5fa10c87d8a9e6f35d4fd9e
- Added LIVING SG SOURCE PROOF POLICY to promptAssembly.js.
- Added prompt diagnostics for source proof policy.
- Ensures missing sourceResultSystemMessage remains source-honest.

c2ad3a32c8d8043384cb12637c285df84d1bdbba
- Added scripts/smokeLivingSGSourceProofBoundary.js.
- Smoke verifies requested facts are not verified facts.
- Smoke verifies verified claims require sourceResultConfirmed=true and source payload.
- Smoke verifies prompt policy is present.

139d456514bc2100885a17c4403bb79878da88b1
- Added npm script smoke:living-sg-source-proof.

686617a5f50c70d39861c0864d46eeb8389e348d
- Added GitHub Actions workflow Smoke Living SG Source Proof.

30d56965189e7d633f93d6874171ae93776459ac
- Merged PR #27 into main.
```

---

## PR

```text
PR: #27
Title: Add Living SG source proof boundary skeleton
Status: merged
Merge commit: 30d56965189e7d633f93d6874171ae93776459ac
```

---

## Verified CI behavior

Monarch visually confirmed in GitHub Actions that PR #27 / merge commit is green.

Meaning:

```text
- LivingSourceProofBoundary skeleton imports successfully.
- Requested source facts are not treated as verified source facts.
- Source proof skeleton does not call repo/runtime/tools.
- Verified claims require sourceResultConfirmed=true and source payload.
- promptAssembly includes LIVING SG SOURCE PROOF POLICY.
- Missing sourceResultSystemMessage cannot be treated as verified proof.
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
Living SG source-proof boundary skeleton, prompt policy, and CI smoke guard are complete and green.
```

---

## Next safe microstep

```text
Design the future Living SG repo-read request planner contract:
- it may decide that repo facts are needed;
- it must not read the repository itself;
- it must output a read-only source request plan;
- it must require source proof before verified claims;
- repo write must remain blocked.
```

Recommended check:

```text
- Repo-read request plan is separate from repo-read execution.
- Planner output cannot prove repo status.
- Planner output cannot authorize writes.
- Missing source result stays source-honest.
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