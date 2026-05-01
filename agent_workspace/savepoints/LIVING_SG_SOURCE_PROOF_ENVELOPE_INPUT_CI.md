# SAVEPOINT — Living SG Source Proof Envelope Input CI

Saved at: `2026-05-01T18:45:00Z`
Saved by: `SG-advisor`
Scope: `Living SG sourceResult envelope input integration into source-proof boundary + CI smoke coverage`

---

## Current confirmed repo state

```text
Repository: korzh260609-beep/garya-bot
Base branch: main
Work branch: sg-source-proof-envelope-input-01
Goal: Continue safe transition of SG to Living SG behavior.
Current focus: Let SourceProofBoundary read sourceResult envelope status as contract input only.
```

---

## Confirmed principle

```text
sourceResult envelope may be read by SourceProofBoundary as proof input.
sourceResult envelope is not execution authority.
sourceResult envelope cannot authorize writes.
missing/invalid/stale/unconfirmed envelope keeps verified claims blocked.
confirmed/fresh/valid envelope may allow verified factual claims.
SourceProofBoundary still performs no source calls and no repo runtime reads.
```

---

## Important commits in this block

```text
5b174aabcbe61bcd9d50ba23ff9a467dd92659b4
- Updated src/core/living-sg/LivingSourceProofBoundary.js.
- Added sourceResultEnvelope/sourceResult input handling.
- Envelope confirmed status may set VERIFIED.
- Missing/invalid/stale/unconfirmed envelope keeps REQUESTED_NOT_VERIFIED.
- Legacy sourceResultConfirmed/sourcePayload fallback preserved.
- Write authorization remains false.

7288ffa0cf1e6131651965be9a3bee61995e9e6a
- Added scripts/smokeLivingSGSourceProofEnvelopeInput.js.
- Smoke verifies envelope input behavior and safety boundaries.

26e93c58ee567d42ba35518e714bc4f51d5786b4
- Added npm script smoke:living-sg-source-proof-envelope-input.

0d50f6866130cf1cecfc8f9c3a959a60264508f2
- Added GitHub Actions workflow Smoke Living SG Source Proof Envelope Input.
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
Living SG sourceResult envelope input integration into SourceProofBoundary is prepared in branch sg-source-proof-envelope-input-01.
```

---

## Expected check

```bash
npm run smoke:living-sg-source-proof-envelope-input
```

Expected result:

```text
Smoke Living SG Source Proof Envelope Input — OK
```

---

## Next safe microstep after merge

```text
Connect repo-read request planner output and source-proof/envelope contract at planning level only:
- planner can request sourceResult envelope as expected proof format;
- source-proof can consume envelope if provided;
- no runtime repo-read yet;
- no source execution yet;
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