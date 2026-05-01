# SAVEPOINT — Living SG Repo Read Planner Envelope Contract CI

Saved at: `2026-05-01T19:00:00Z`
Saved by: `SG-advisor`
Scope: `Living SG repo-read request planner + sourceResult envelope/source-proof planning contract`

---

## Current confirmed repo state

```text
Repository: korzh260609-beep/garya-bot
Base branch: main
Work branch: sg-planner-envelope-01
Goal: Continue safe transition of SG to Living SG behavior.
Current focus: Connect repo-read request planner output to sourceResult envelope/source-proof contract at planning level only.
```

---

## Confirmed principle

```text
RepoReadRequestPlan may declare expected sourceResult envelope format.
RepoReadRequestPlan may pass provided envelope to SourceProofBoundary.
RepoReadRequestPlan still does not execute sources.
RepoReadRequestPlan still does not read repository runtime.
RepoReadRequestPlan still cannot authorize writes.
Confirmed envelope may allow sourceProof verified status, but planner remains planning-only.
```

---

## Important commits in this block

```text
36295fb82fc8bf534164e46eff79987fc70e4f9a
- Updated src/core/living-sg/LivingRepoReadRequestPlan.js.
- Added LIVING_REPO_READ_PROOF_FORMAT.SOURCE_RESULT_ENVELOPE.
- Added expectedSourceResultEnvelope contract.
- Passed optional sourceResultEnvelope/sourceResult into SourceProofBoundary.
- Kept runtime repo-read disconnected.
- Kept writes blocked.

b356a6bd136c0bc2420f6b6d4a520c8e7f1863e0
- Added scripts/smokeLivingSGRepoReadPlannerEnvelopeContract.js.
- Smoke verifies planner envelope expectation, envelope pass-through, no runtime reads, no source calls, write blocked.

1dab24d132ef783bb2b82cfc9acf54f6e21c1741
- Added npm script smoke:living-sg-repo-read-planner-envelope-contract.

38b03d55744417afeb8c3f0f0d7911dc80a199d3
- Added GitHub Actions workflow Smoke Living SG Repo Read Planner Envelope Contract.
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
Repo-read planner now declares sourceResult envelope proof format and can pass provided envelope to SourceProofBoundary at planning level only.
```

---

## Expected check

```bash
npm run smoke:living-sg-repo-read-planner-envelope-contract
```

Expected result:

```text
Smoke Living SG Repo Read Planner Envelope Contract — OK
```

---

## Next safe microstep after merge

```text
Add promptAssembly/source-result system message guard for envelope evidence:
- sourceResultSystemMessage may describe envelope confirmation status;
- missing/invalid/stale/unconfirmed envelope must force source-honest wording;
- confirmed envelope can support verified repo/source claims;
- no runtime source calls yet;
- no repo-read runtime yet;
- no executor yet;
- no writes.
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