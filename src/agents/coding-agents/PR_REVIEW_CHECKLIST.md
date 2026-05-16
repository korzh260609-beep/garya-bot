# PR Review Checklist for Coding Agents

> AGENT NOTE:
> This file defines how Advisor, SG, ReviewAgent, or a human reviewer should review a Coding Agents Team PR.
> It is documentation only. It does not implement runtime agents and does not enable autonomy.

## 1. Purpose

Use this checklist before approving any PR that creates or changes the Coding Agents Team runtime skeleton.

A PR that fails critical checks must not be merged.

## 2. Scope check

```text
[ ] PR targets dev/v2-start
[ ] PR does not target main
[ ] PR does not target dev/v2-start-clean-copy
[ ] PR uses a separate work branch
[ ] PR scope matches the requested task
[ ] PR does not include unrelated refactors
[ ] PR does not delete existing logic without explicit command
```

## 3. Architecture check

```text
[ ] SG Core is not rewritten
[ ] Pillars/laws are not changed
[ ] Module boundaries are preserved
[ ] Runtime skeleton stays under src/agents/coding-agents/runtime/
[ ] Registry is used instead of random imports everywhere
[ ] Permissions are centralized
[ ] No module logic is dumped into core
```

## 4. File structure check

```text
[ ] registry files exist
[ ] contract files exist
[ ] permission files exist
[ ] V1 role definition files exist
[ ] prompt/spec placeholders exist
[ ] smoke checks exist
[ ] runtime README exists
[ ] files have clear names
[ ] files have AGENT NOTE where useful
```

## 5. V1 agent check

```text
[ ] RepoStateAgent exists
[ ] RequirementsAgent exists
[ ] TaskPlannerAgent exists
[ ] ArchitectureGuardAgent exists
[ ] PermissionGuardAgent exists
[ ] SkeletonAgent exists
[ ] DocsAgent exists
[ ] PRReportAgent exists
[ ] ReviewAgent exists
[ ] CodePatchAgent exists
```

## 6. Permission check

```text
[ ] canMerge is false for all V1 agents
[ ] canDeploy is false for all V1 agents
[ ] canChangeSecrets is false for all V1 agents
[ ] canChangeProtectedBranches is false for all V1 agents
[ ] main writes are blocked
[ ] dev/v2-start-clean-copy writes are blocked
[ ] missing approval is treated as blocked
```

## 7. Runtime safety check

```text
[ ] no autonomous execution is enabled
[ ] no auto-merge exists
[ ] no deploy action exists
[ ] no production secret access exists
[ ] no Render production mutation exists
[ ] no database destructive action exists
[ ] no paid provider setup exists
[ ] no uncontrolled recurring AI/tool loop exists
```

## 8. Smoke check review

```text
[ ] smoke checks are present
[ ] smoke checks are runnable or clearly documented
[ ] smoke checks cover registry loading
[ ] smoke checks cover duplicate id rejection
[ ] smoke checks cover dangerous permissions
[ ] smoke checks cover protected branch blocking
[ ] smoke checks cover read-only RepoStateAgent
[ ] smoke checks cover CodePatchAgent no merge/deploy
```

## 9. Documentation check

```text
[ ] README explains purpose
[ ] README explains limitations
[ ] README states skeleton only
[ ] README lists V1 agents
[ ] README explains smoke checks
[ ] PR body lists non-goals
[ ] PR body lists risks
[ ] PR body includes rollback note
```

## 10. Red flags

Block the PR if any item is true:

```text
[ ] PR changes main directly
[ ] PR changes dev/v2-start-clean-copy
[ ] PR enables merge permission
[ ] PR enables deploy permission
[ ] PR hides production action
[ ] PR rewrites SG Core
[ ] PR changes pillars/laws without command
[ ] PR removes safety checks
[ ] PR claims tests passed without evidence
[ ] PR creates active autonomy in V1
```

## 11. Required review decision

Review result must be one of:

```text
approve
request changes
block
```

Use `approve` only when all critical checks pass.

Use `request changes` when issues are fixable.

Use `block` when protected branches, secrets, deployment, SG Core, or autonomy rules are violated.
