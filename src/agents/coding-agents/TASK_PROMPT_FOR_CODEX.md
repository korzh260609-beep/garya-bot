# Task Prompt for Coding Operator

> AGENT NOTE:
> This file provides a ready-to-use task prompt for a code-generation operator.
> It is documentation only. It does not implement runtime agents and does not enable autonomy.

## 1. Purpose

Use this prompt when asking a coding operator to create the Coding Agents Team runtime skeleton V1.

The prompt is intentionally strict.

It should prevent uncontrolled broad implementation.

## 2. Ready prompt

```text
TASK:
Create Coding Agents Team Runtime Skeleton V1 for SG 2.0.

REPOSITORY:
korzh260609-beep/garya-bot

BASE BRANCH:
dev/v2-start

READ FIRST:
1. src/agents/coding-agents/CODING_AGENTS_TEAM.md
2. src/agents/coding-agents/CODING_AGENT_ROLES.md
3. src/agents/coding-agents/CODING_AGENT_CREATION.md
4. src/agents/coding-agents/IMPLEMENTATION_WORKFLOW.md
5. src/agents/coding-agents/CODING_AGENT_WORKFLOWS.md
6. src/agents/coding-agents/ACCEPTANCE_CRITERIA.md
7. src/agents/coding-agents/RUNTIME_SKELETON_CHECKLIST.md
8. src/agents/coding-agents/PR_REVIEW_CHECKLIST.md
9. src/agents/coding-agents/EXAMPLE_V1_OUTPUT_TREE.md
10. src/agents/coding-agents/RISKS_AND_STOP_CONDITIONS.md

GOAL:
Create only the safe runtime skeleton V1 under:
src/agents/coding-agents/runtime/

CREATE:
- registry skeleton
- shared contracts
- permission definitions
- permission guard
- V1 agent definitions
- prompt/spec placeholders
- smoke checks
- runtime README

V1 AGENTS:
- RepoStateAgent
- RequirementsAgent
- TaskPlannerAgent
- ArchitectureGuardAgent
- PermissionGuardAgent
- SkeletonAgent
- DocsAgent
- PRReportAgent
- ReviewAgent
- CodePatchAgent

DO NOT:
- do not write to main
- do not write to dev/v2-start-clean-copy
- do not push directly to dev/v2-start
- do not enable auto-merge
- do not merge PRs
- do not deploy
- do not change Render settings
- do not change secrets
- do not rewrite SG Core
- do not change pillars/laws
- do not create full autonomy
- do not create real production actions
- do not create paid provider integration
- do not create unlimited AI/tool loops

DANGEROUS PERMISSIONS:
These must default to false for every V1 agent:
- canMerge
- canDeploy
- canChangeSecrets
- canChangeProtectedBranches

REQUIRED SMOKE CHECKS:
- registry loads all V1 agents
- agent ids are unique
- required fields exist
- dangerous permissions are false
- PermissionGuardAgent blocks main writes
- PermissionGuardAgent blocks dev/v2-start-clean-copy writes
- RepoStateAgent is read-only
- CodePatchAgent cannot merge
- CodePatchAgent cannot deploy

IMPLEMENTATION ORDER:
1. folder skeleton
2. shared contracts
3. permission model
4. registry
5. V1 agent definitions
6. prompt/spec placeholders
7. smoke checks
8. README
9. PR report

STOP IF:
- task requires SG Core changes
- task requires pillar/law changes
- task requires secrets
- task requires Render production changes
- task requires database destructive changes
- task requires merge/deploy
- task requires protected branch write
- task cannot follow skeleton -> config -> logic order

PR REQUIREMENTS:
Open a PR into dev/v2-start.
List created files.
List what is skeleton only.
List what is not implemented.
List smoke checks.
List risks.
Add rollback note.
Include this exact line:
Merge status: blocked until explicit Monarch approval.
```

## 3. Expected result

The expected result is a PR with skeleton files only.

The result is not expected to be a fully autonomous coding system.

## 4. Reviewer warning

If the produced PR enables merge, deploy, protected branch writes, or real autonomous execution, the PR must be blocked.
