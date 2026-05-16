# Minimal Implementation Slice

> AGENT NOTE:
> This file defines the smallest safe first implementation slice for the Coding Agents Team runtime skeleton.
> It is documentation only. It does not implement runtime agents and does not enable autonomy.

## 1. Purpose

This file prevents the coding operator from trying to build the entire agent team at once.

The first implementation must be small, testable, orchestrated, and reversible.

## 2. First slice goal

The first slice must create only:

```text
registry
shared contracts
permission model
CodingOrchestratorAgent definition
RepoStateAgent definition
PermissionGuardAgent definition
minimal smoke checks
runtime README
```

Do not create the full V1 team in the first slice unless this minimal slice already passes review.

## 3. Why this slice comes first

CodingOrchestratorAgent, RepoStateAgent, and PermissionGuardAgent are the safety foundation.

CodingOrchestratorAgent answers:

```text
Which agent should work now, and is the next step allowed?
```

RepoStateAgent answers:

```text
What exists in the repository?
```

PermissionGuardAgent answers:

```text
Is this action allowed?
```

Without these three, other agents can act blindly, unsafely, or out of order.

## 4. Required first-slice tree

```text
src/agents/coding-agents/runtime/
  README.md

  registry/
    CodingAgentRegistry.js
    CodingAgentRegistry.contract.js

  contracts/
    CodingAgentTask.contract.js
    CodingAgentResult.contract.js
    CodingAgentPermission.contract.js

  permissions/
    codingAgentPermissions.js
    codingAgentPermissionGuard.js

  roles/
    codingOrchestratorAgent.definition.js
    repoStateAgent.definition.js
    permissionGuardAgent.definition.js

  prompts/
    codingOrchestratorAgent.prompt.md
    repoStateAgent.prompt.md
    permissionGuardAgent.prompt.md

  tests/
    smokeCodingAgentRegistry.js
    smokeCodingAgentPermissions.js
    smokeMinimalAgentDefinitions.js
    smokeCodingOrchestratorAgent.js
```

## 5. Required behavior

First slice must prove:

```text
registry can load agent definitions
CodingOrchestratorAgent is registered
agent ids are unique
required fields exist
CodingOrchestratorAgent dangerous permissions are false
CodingOrchestratorAgent cannot bypass PermissionGuardAgent
CodingOrchestratorAgent cannot approve its own work
CodingOrchestratorAgent cannot move to next stage without evidence
RepoStateAgent is read-only
PermissionGuardAgent blocks main writes
PermissionGuardAgent blocks dev/v2-start-clean-copy writes
dangerous permissions default to false
```

## 6. Forbidden in first slice

Do not add:

```text
CodePatchAgent runtime behavior
PR creation behavior
branch creation behavior
merge behavior
deploy behavior
secret access
Render mutation
paid provider integration
full autonomous runner
direct agent-to-agent execution bypassing CodingOrchestratorAgent
CodingOrchestratorAgent bypassing PermissionGuardAgent
```

## 7. Required PR statement

The PR must clearly state:

```text
This is the minimal implementation slice only.
It does not enable autonomous coding.
It does not enable merge/deploy/write actions.
All role-specific agents are coordinated through CodingOrchestratorAgent.
```

## 8. Expand only after review

After this slice is approved and merged, later slices may add:

```text
RequirementsAgent
TaskPlannerAgent
ArchitectureGuardAgent
SkeletonAgent
DocsAgent
PRReportAgent
ReviewAgent
CodePatchAgent definition only
```

Runtime behavior must be added even later and only after explicit approval.

## 9. Stop rule

If the first slice cannot be completed cleanly, stop and report.

Do not compensate by creating a larger uncontrolled implementation.
