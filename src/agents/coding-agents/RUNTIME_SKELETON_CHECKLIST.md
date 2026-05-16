# Runtime Skeleton Checklist

> AGENT NOTE:
> This file is a checklist for creating the Coding Agents Team runtime skeleton.
> It is documentation only. It does not implement runtime agents and does not enable autonomy.

## 1. Purpose

Use this checklist before opening a PR for the Coding Agents Team runtime skeleton.

Every unchecked item must be explained in the PR.

## 2. Pre-work checklist

```text
[ ] Read CODING_AGENTS_TEAM.md
[ ] Read CODING_AGENT_ROLES.md
[ ] Read CODING_AGENT_CREATION.md
[ ] Read IMPLEMENTATION_WORKFLOW.md
[ ] Read CODING_AGENT_WORKFLOWS.md
[ ] Read ACCEPTANCE_CRITERIA.md
[ ] Inspected current repository structure
[ ] Confirmed base branch is dev/v2-start
[ ] Confirmed no work targets main
[ ] Confirmed no work targets dev/v2-start-clean-copy
```

## 3. Folder checklist

```text
[ ] src/agents/coding-agents/runtime/ created
[ ] runtime/registry/ created
[ ] runtime/contracts/ created
[ ] runtime/permissions/ created
[ ] runtime/roles/ created
[ ] runtime/prompts/ created
[ ] runtime/tests/ created
[ ] runtime/README.md created
```

## 4. Contract checklist

```text
[ ] CodingAgentTask contract exists
[ ] CodingAgentResult contract exists
[ ] CodingAgentPermission contract exists
[ ] Required fields are listed
[ ] Contract files are reusable
[ ] No runtime side effects in contract files
```

## 5. Registry checklist

```text
[ ] Registry can register agent definitions
[ ] Registry can get agent by id
[ ] Registry can list agents by layer
[ ] Registry validates required fields
[ ] Registry rejects duplicate ids
[ ] Registry exposes safe metadata only
[ ] Registry does not merge
[ ] Registry does not deploy
[ ] Registry does not write protected branches
```

## 6. Permission checklist

```text
[ ] Permission definitions exist
[ ] Permission guard exists
[ ] canMerge defaults to false
[ ] canDeploy defaults to false
[ ] canChangeSecrets defaults to false
[ ] canChangeProtectedBranches defaults to false
[ ] writes to main are blocked
[ ] writes to dev/v2-start-clean-copy are blocked
[ ] missing approval means blocked
```

## 7. V1 agent checklist

```text
[ ] RepoStateAgent definition exists
[ ] RequirementsAgent definition exists
[ ] TaskPlannerAgent definition exists
[ ] ArchitectureGuardAgent definition exists
[ ] PermissionGuardAgent definition exists
[ ] SkeletonAgent definition exists
[ ] DocsAgent definition exists
[ ] PRReportAgent definition exists
[ ] ReviewAgent definition exists
[ ] CodePatchAgent definition exists
```

## 8. Prompt/spec checklist

```text
[ ] Each V1 agent has prompt/spec placeholder
[ ] Each prompt/spec has role
[ ] Each prompt/spec has purpose
[ ] Each prompt/spec has allowed actions
[ ] Each prompt/spec has forbidden actions
[ ] Each prompt/spec has required input
[ ] Each prompt/spec has required output
[ ] Each prompt/spec has failure behavior
[ ] No prompt grants hidden permission escalation
```

## 9. Smoke check checklist

```text
[ ] Smoke check: registry loads V1 agents
[ ] Smoke check: agent ids are unique
[ ] Smoke check: required fields exist
[ ] Smoke check: dangerous permissions are false
[ ] Smoke check: PermissionGuardAgent blocks main writes
[ ] Smoke check: PermissionGuardAgent blocks dev/v2-start-clean-copy writes
[ ] Smoke check: RepoStateAgent is read-only
[ ] Smoke check: CodePatchAgent cannot merge
[ ] Smoke check: CodePatchAgent cannot deploy
```

## 10. README checklist

```text
[ ] README explains what runtime skeleton is
[ ] README explains what runtime skeleton is not
[ ] README lists V1 agents
[ ] README lists blocked permissions
[ ] README explains smoke checks
[ ] README explains how future agents are added
```

## 11. PR checklist

```text
[ ] PR lists created files
[ ] PR lists changed files
[ ] PR says skeleton only
[ ] PR says what is not implemented
[ ] PR lists tests/checks
[ ] PR lists risks
[ ] PR has rollback note
[ ] PR includes merge status blocked until Monarch approval
```

## 12. Blocker checklist

Do not continue if any of these happen:

```text
[ ] task requires SG Core rewrite
[ ] task requires pillar/law change
[ ] task requires production secret
[ ] task requires Render production change
[ ] task requires database destructive change
[ ] task requires merge/deploy permission
[ ] task creates autonomous execution without approval
```

If any blocker is checked, stop and report.
