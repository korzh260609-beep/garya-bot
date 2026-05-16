# Orchestrator Integration Map

> AGENT NOTE:
> This file binds CodingOrchestratorAgent into the whole Coding Agents Team documentation set.
> It is documentation only. It does not implement runtime agents, does not enable autonomy, and does not grant merge/deploy permissions.

## 1. Purpose

This file defines how the orchestrator rule applies across all Coding Agents Team files.

If another file describes agent order, stage order, workflow, creation, smoke checks, acceptance, or prompts, it must be interpreted through this rule:

```text
All coding agents are coordinated through CodingOrchestratorAgent.
No role-specific agent works independently.
```

## 2. Files affected by this rule

This rule applies to:

```text
CODING_AGENTS_TEAM.md
CODING_AGENT_ROLES.md
CODING_AGENT_CREATION.md
IMPLEMENTATION_WORKFLOW.md
CODING_AGENT_WORKFLOWS.md
ACCEPTANCE_CRITERIA.md
RUNTIME_SKELETON_CHECKLIST.md
PR_REVIEW_CHECKLIST.md
EXAMPLE_V1_OUTPUT_TREE.md
TASK_PROMPT_FOR_CODEX.md
RISKS_AND_STOP_CONDITIONS.md
MINIMAL_IMPLEMENTATION_SLICE.md
SMOKE_TEST_SPEC.md
AGENT_DEFINITION_TEMPLATE.md
REGISTRY_CONTRACT_SPEC.md
STAGED_IMPLEMENTATION_PLAN.md
ORCHESTRATOR_AGENT_SPEC.md
```

## 3. Global orchestration rule

Every task must flow through:

```text
SG / Advisor
  -> CodingOrchestratorAgent
  -> selected role-specific agent
  -> report/result
  -> CodingOrchestratorAgent
  -> Advisor review
  -> Monarch approval when required
```

Direct uncontrolled agent-to-agent execution is forbidden.

## 4. Stage rule update

Wherever a file says that a stage uses RepoStateAgent, PermissionGuardAgent, TaskPlannerAgent, or any other role-specific agent, it means:

```text
CodingOrchestratorAgent selects and coordinates that agent according to the active stage.
```

## 5. Minimal slice update

Stage 1 / Minimal Safety Slice must include CodingOrchestratorAgent as definition-only.

Stage 1 safe base is therefore:

```text
registry
shared contracts
permission model
CodingOrchestratorAgent definition
RepoStateAgent definition
PermissionGuardAgent definition
minimal prompt/spec placeholders
minimal smoke checks
runtime README
```

## 6. V1 agent list update

V1 core list becomes:

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

CodePatchAgent remains definition-only until explicitly approved for real write behavior.

## 7. Prompt/read-order update

Any implementation prompt must read this file and `ORCHESTRATOR_AGENT_SPEC.md` before starting implementation.

Required read order extension:

```text
ORCHESTRATOR_AGENT_SPEC.md
ORCHESTRATOR_INTEGRATION_MAP.md
```

## 8. Registry update

The registry must register CodingOrchestratorAgent before role-specific agents.

Minimal registration order:

```text
CodingOrchestratorAgent
RepoStateAgent
PermissionGuardAgent
```

## 9. Smoke test update

Smoke checks must prove:

```text
CodingOrchestratorAgent is registered
CodingOrchestratorAgent dangerous permissions are false
CodingOrchestratorAgent cannot bypass PermissionGuardAgent
CodingOrchestratorAgent cannot approve its own work
CodingOrchestratorAgent cannot move to the next stage without required evidence
```

## 10. Acceptance update

A runtime skeleton is not accepted unless CodingOrchestratorAgent is present in the registry and included in smoke checks.

## 11. Stop condition update

Stop if any agent is invoked directly in a way that bypasses CodingOrchestratorAgent.

Required response:

```text
Orchestration bypass detected. Stop and route through CodingOrchestratorAgent.
```

## 12. Final rule

CodingOrchestratorAgent coordinates execution.

It does not create authority.

It cannot merge, deploy, change protected branches, change secrets, change pillars, or bypass Monarch approval.
