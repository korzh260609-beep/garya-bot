# Coding Agents Acceptance Criteria

> AGENT NOTE:
> This file defines the acceptance criteria for the Coding Agents Team runtime skeleton.
> It is documentation only. It does not implement runtime agents and does not enable autonomy.

## 1. Purpose

This file defines when the Coding Agents Team V1 skeleton can be considered correctly created.

If a result does not satisfy this file, it is not done.

## 2. Required input specs

Before implementation, the coding operator must read:

```text
CODING_AGENTS_TEAM.md
CODING_AGENT_ROLES.md
CODING_AGENT_CREATION.md
IMPLEMENTATION_WORKFLOW.md
CODING_AGENT_WORKFLOWS.md
ORCHESTRATOR_AGENT_SPEC.md
ORCHESTRATOR_INTEGRATION_MAP.md
STAGED_IMPLEMENTATION_PLAN.md
MINIMAL_IMPLEMENTATION_SLICE.md
```

## 3. Required V1 files

A correct V1 skeleton must create files under:

```text
src/agents/coding-agents/runtime/
```

Required groups:

```text
registry
contracts
permissions
roles
prompts
tests
README.md
```

## 4. Required contracts

The skeleton must include contracts for:

```text
CodingAgentTask
CodingAgentResult
CodingAgentPermission
```

Each contract must be explicit and reusable.

## 5. Required registry

The registry must support:

```text
register agent
get agent by id
list agents by layer
validate required fields
reject duplicate agent ids
expose safe metadata
```

The registry must not perform merge, deploy, protected branch write, or secret operations.

The registry must register CodingOrchestratorAgent before role-specific agents.

## 6. Required permission model

Every agent, including CodingOrchestratorAgent, must define dangerous permissions as false by default:

```text
canMerge = false
canDeploy = false
canChangeSecrets = false
canChangeProtectedBranches = false
```

Any exception requires explicit Monarch approval and must not be part of V1.

## 7. Required V1 agents

V1 must define these agents:

```text
CodingOrchestratorAgent
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

Extended agents must not be implemented as active runtime behavior in V1.

## 8. Required orchestration behavior

V1 must enforce this rule:

```text
SG / Advisor -> CodingOrchestratorAgent -> selected role-specific agent -> report -> CodingOrchestratorAgent -> Advisor/Monarch gate
```

No role-specific agent may operate as an uncontrolled independent worker.

CodingOrchestratorAgent must not bypass PermissionGuardAgent.

CodingOrchestratorAgent must not approve its own work.

## 9. Required prompts/spec placeholders

Each V1 agent must have a prompt/spec placeholder that includes:

```text
role
purpose
allowed actions
forbidden actions
required input
required output
failure behavior
```

CodingOrchestratorAgent prompt/spec must also include:

```text
stage selection
agent selection
stop conditions
evidence requirements
no self-approval rule
PermissionGuardAgent enforcement rule
```

## 10. Required smoke checks

V1 must include smoke checks proving:

```text
registry loads all V1 agents
CodingOrchestratorAgent is registered
agent ids are unique
required fields exist
dangerous permissions are false
CodingOrchestratorAgent cannot bypass PermissionGuardAgent
CodingOrchestratorAgent cannot approve its own work
CodingOrchestratorAgent cannot move to next stage without required evidence
PermissionGuardAgent blocks main writes
PermissionGuardAgent blocks dev/v2-start-clean-copy writes
RepoStateAgent is read-only
CodePatchAgent cannot merge
CodePatchAgent cannot deploy
```

## 11. Required README

Runtime README must explain:

```text
what the skeleton is
what it is not
how CodingOrchestratorAgent coordinates agents
how to run smoke checks
which agents are V1
which permissions are blocked
how future agents are added
```

## 12. Non-goals for V1

V1 must not include:

```text
full autonomous coding
real production deployment
real secret access
auto-merge
protected branch writes
SG Core rewrite
pillar/law changes
paid provider setup
unlimited AI/tool loops
direct agent-to-agent execution that bypasses CodingOrchestratorAgent
```

## 13. Definition of done

The V1 skeleton is done only if:

```text
all required files exist
CodingOrchestratorAgent exists and is registered
all V1 agents are registered
contracts are present
permissions are explicit
smoke checks exist
README exists
no dangerous permission is enabled
no protected branch was touched
PR clearly states limitations
```

## 14. Required PR statement

The PR must include:

```text
Merge status: blocked until explicit Monarch approval.
```

## 15. Failure rule

If any criterion cannot be satisfied, the coding operator must stop and report what is missing instead of inventing a shortcut.
