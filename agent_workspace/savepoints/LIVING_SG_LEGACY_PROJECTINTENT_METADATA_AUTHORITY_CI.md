# SAVEPOINT — Living SG Legacy ProjectIntent Metadata Authority CI

Saved at: `2026-05-01T15:30:00Z`
Saved by: `SG-advisor`
Scope: `Living SG / legacy projectIntent metadata authority boundary + CI smoke coverage`

---

## Current confirmed repo state

```text
Repository: korzh260609-beep/garya-bot
Branch: main
Goal: Continue safe transition of SG to Living SG behavior.
Current focus: Prevent legacy projectIntent metadata from becoming proof, permission, or execution authority for Living SG.
```

---

## Confirmed principle

```text
Legacy projectIntent metadata is transitional legacy context only.
Legacy projectIntent metadata cannot prove repository status.
Legacy projectIntent metadata cannot prove file contents.
Legacy projectIntent metadata cannot prove runtime state.
Legacy projectIntent metadata cannot prove implementation state.
Legacy projectIntent metadata cannot authorize repository read/write.
Legacy projectIntent metadata cannot authorize memory write, deploy, external actions, or any state-changing operation.
Legacy projectIntent metadata cannot bypass Living SG gates, permissions, source checks, risk checks, cost checks, or confirmations.
Ordinary user text must not be converted into technical action by bridge metadata.
Actual runtime source/tool confirmation is required before verified repository/source claims.
```

---

## Important commits in this block

```text
b908e620cce4306b8fd4bd262570b5f6f8b920d1
- Strengthened promptAssembly.js with LEGACY PROJECTINTENT METADATA POLICY.
- Added explicit boundary that projectIntent metadata is transitional legacy context only.
- Added explicit boundary that projectIntent metadata cannot become proof, permission, or execution authority.

ff756521e584a73d07c2d4bbfd349c91dd6b7e19
- Added scripts/smokeLegacyProjectIntentMetadataAuthority.js.
- Smoke verifies legacy projectIntent metadata remains transitional context only.
- Smoke verifies it cannot prove repo status, authorize actions, bypass gates, or convert ordinary text into technical action.

89f5d5d773333c726d4a4cf0d384bd7a5a3d1ae4
- Added npm script smoke:legacy-project-intent-metadata-authority.

5e00f2be422fa47dc124a53c4af890d663a0eb65
- Added GitHub Actions workflow Smoke Legacy ProjectIntent Metadata Authority.

8bcdfe256ba5d3ce0f08530181c9e27fdeb100c1
- Merged PR #25 into main.
```

---

## PR

```text
PR: #25
Title: Add legacy projectIntent metadata authority smoke guard
Status: merged
Merge commit: 8bcdfe256ba5d3ce0f08530181c9e27fdeb100c1
```

---

## Verified CI behavior

Monarch visually confirmed in GitHub Actions that the merge commit `8bcdfe2` is green.

Visible green checks included:

```text
Smoke Living SG Isolation — green
Smoke Living SG Metadata Authority — green
Smoke System Prompt Source Honesty — green
Smoke Living SG Meaning Logic — green
Smoke Legacy ProjectIntent Metadata Authority — green
Smoke Living SG Boundary Safety — green
```

Meaning:

```text
- Living SG metadata remains read-only answer-shaping signal.
- Legacy projectIntent metadata remains transitional context only.
- projectIntent metadata does not grant execution authority.
- projectIntent metadata does not bypass gates.
- projectIntent metadata does not prove source/tool execution or repo status.
- projectIntent metadata does not convert ordinary user text into technical action.
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
Legacy projectIntent metadata authority prompt boundary and CI smoke guard are complete and green.
```

---

## Next safe microstep

```text
Review the next Living SG boundary needed before real repo-work capability:
- define a read-only Repo Source capability skeleton for Living SG;
- do not connect runtime repo-read yet;
- do not create executor;
- do not connect RepoStateAgent runtime;
- first specify source/tool proof requirements and permission gate contract.
```

Recommended check:

```text
- Living SG can request repo facts only through an explicit source/capability boundary.
- Missing source result must produce source-honest answer, not hallucinated repo state.
- Repo read and repo write must be separated.
- Repo write remains blocked until explicit permission + executor design.
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