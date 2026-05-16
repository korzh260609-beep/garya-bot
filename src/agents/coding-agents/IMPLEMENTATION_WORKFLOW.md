# Coding Agents Implementation Workflow

> AGENT NOTE:
> This file defines the step-by-step workflow for creating the Coding Agents Team runtime skeleton.
> It is documentation only. It does not implement runtime agents and does not enable autonomy.

## 1. Purpose

This workflow explains how a coding operator must create the first safe runtime skeleton for the Coding Agents Team.

Use it together with:

```text
CODING_AGENTS_TEAM.md
CODING_AGENT_ROLES.md
CODING_AGENT_CREATION.md
CODING_AGENT_WORKFLOWS.md
```

The goal is a controlled skeleton, not a free autonomous swarm.

## 2. Mandatory read order

Read first:

```text
1. CODING_AGENTS_TEAM.md
2. CODING_AGENT_ROLES.md
3. CODING_AGENT_CREATION.md
4. CODING_AGENT_WORKFLOWS.md
```

Then inspect the current repository structure before creating files.

## 3. Target result for V1

Create only:

```text
- registry skeleton
- shared contracts
- permission definitions
- V1 agent definitions
- prompt/spec placeholders
- smoke checks
- README
```

Do not create full autonomy in V1.

## 4. Branch rules

Use this route:

```text
new work branch -> PR into dev/v2-start -> review -> merge only after explicit Monarch approval
```

Do not write to:

```text
main
dev/v2-start-clean-copy
dev/v2-start directly
```

## 5. Required implementation order

Follow this order:

```text
1. folder skeleton
2. shared contracts
3. permission model
4. agent registry
5. base runner stub
6. V1 agent definitions
7. prompt/spec placeholders
8. smoke checks
9. README
10. PR report
```

Do not start with a complex runner.

## 6. Recommended runtime structure

```text
src/agents/coding-agents/runtime/
  registry/
  contracts/
  permissions/
  roles/
  prompts/
  tests/
  README.md
```

Recommended files:

```text
registry/CodingAgentRegistry.js
registry/CodingAgentRegistry.contract.js
contracts/CodingAgentTask.contract.js
contracts/CodingAgentResult.contract.js
contracts/CodingAgentPermission.contract.js
permissions/codingAgentPermissions.js
permissions/codingAgentPermissionGuard.js
```

## 7. V1 agents to create first

Create only these first:

```text
RepoStateAgent
RequirementsAgent
TaskPlannerAgent
ArchitectureGuardAgent
PermissionGuardAgent
SkeletonAgent
DocsAgent
PRReportAgent
ReviewAgent
CodePatchAgent
```

Extended agents must wait until V1 is stable.

## 8. Shared task contract

Every task must include:

```text
id
requestedBy
actorRole
agentId
repo
baseBranch
workBranch
scope
allowedFiles
forbiddenFiles
goal
nonGoals
constraints
status
createdAt
updatedAt
```

## 9. Shared result contract

Every agent result must include:

```text
taskId
agentId
status
summary
evidence
filesRead
filesChanged
risks
nextStep
requiresAdvisorReview
requiresMonarchApproval
```

## 10. Shared permission contract

Every agent permission definition must include:

```text
agentId
canReadRepo
canWritePatch
canCreateBranch
canCreatePR
canMerge
canDeploy
canChangeSecrets
canChangeProtectedBranches
allowedActions
forbiddenActions
```

Dangerous permissions must default to false.

## 11. Registry requirements

The registry must:

```text
- register agent definitions
- return agent by id
- list agents by layer
- validate required fields
- reject duplicate agent ids
- expose safe metadata
```

The registry must not execute risky actions by itself.

## 12. Permission guard requirements

Before any action, check:

```text
actor role
branch
requested action
allowed files
forbidden files
agent permission level
explicit approval when required
```

High-risk actions default to blocked.

## 13. Prompt placeholder requirements

Each prompt/spec placeholder must include:

```text
role
purpose
allowed actions
forbidden actions
required input
required output
failure behavior
```

## 14. Smoke check requirements

Add smoke checks for:

```text
registry loads V1 agents
agent ids are unique
required fields exist
risky permissions default to false
PermissionGuardAgent blocks main writes
PermissionGuardAgent blocks dev/v2-start-clean-copy writes
RepoStateAgent is read-only
CodePatchAgent cannot merge or deploy
```

## 15. Stop conditions

Stop and report if the task requires:

```text
SG Core changes
pillar/law changes
production settings
protected branch writes
database destructive changes
merge/deploy actions
paid provider setup
```

## 16. PR requirements

PR must include:

```text
summary
created files
changed files
what is skeleton only
what is not implemented
tests/checks
risks
rollback note
merge status
```

Required merge status:

```text
Merge status: blocked until explicit Monarch approval.
```

## 17. Definition of done

V1 is complete only when:

```text
runtime skeleton exists
V1 agent definitions exist
contracts exist
permissions exist
registry exists
smoke checks exist
README exists
no autonomy is enabled
no protected branch is touched
no merge/deploy permission exists
```

## 18. Final rule

Create the system slowly.

First make the controlled skeleton work.

Then add real behavior agent by agent after review.
