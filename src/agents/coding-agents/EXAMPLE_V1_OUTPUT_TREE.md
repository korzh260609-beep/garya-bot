# Example V1 Output Tree

> AGENT NOTE:
> This file shows the expected file tree for Coding Agents Team runtime skeleton V1.
> It is documentation only. It does not implement runtime agents and does not enable autonomy.

## 1. Purpose

This file gives the coding operator a concrete target tree.

The final implementation does not have to be byte-for-byte identical, but any difference must be explained in the PR.

## 2. Expected root

Runtime skeleton must live under:

```text
src/agents/coding-agents/runtime/
```

Do not create a root-level `agents/` folder.

Do not place runtime skeleton under SG Core unless explicitly approved.

## 3. Expected V1 tree

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
    repoStateAgent.definition.js
    requirementsAgent.definition.js
    taskPlannerAgent.definition.js
    architectureGuardAgent.definition.js
    permissionGuardAgent.definition.js
    skeletonAgent.definition.js
    docsAgent.definition.js
    prReportAgent.definition.js
    reviewAgent.definition.js
    codePatchAgent.definition.js

  prompts/
    repoStateAgent.prompt.md
    requirementsAgent.prompt.md
    taskPlannerAgent.prompt.md
    architectureGuardAgent.prompt.md
    permissionGuardAgent.prompt.md
    skeletonAgent.prompt.md
    docsAgent.prompt.md
    prReportAgent.prompt.md
    reviewAgent.prompt.md
    codePatchAgent.prompt.md

  tests/
    smokeCodingAgentRegistry.js
    smokeCodingAgentPermissions.js
    smokeCodingAgentDefinitions.js
```

## 4. Optional later tree

Only after V1 is stable, later PRs may add:

```text
configAgent.definition.js
integrationAgent.definition.js
apiContractAgent.definition.js
uiClientAgent.definition.js
dependencyAgent.definition.js
migrationAgent.definition.js
testAgent.definition.js
securityGuardAgent.definition.js
memoryImpactAgent.definition.js
costControlAgent.definition.js
rollbackAgent.definition.js
releaseObservationAgent.definition.js
```

Do not add these as active runtime behavior in V1 unless explicitly requested.

## 5. Required naming rule

Use clear names.

Prefer:

```text
repoStateAgent.definition.js
```

Avoid vague names:

```text
agent1.js
helper.js
misc.js
worker.js
```

## 6. Required file note

Every new markdown file must include an `AGENT NOTE` near the top.

Every JavaScript file should include a short comment near the top explaining whether it is:

```text
contract
permission
registry
role definition
smoke check
```

## 7. What must not appear in V1 tree

V1 tree must not include:

```text
deploy scripts
secret files
production env files
auto-merge logic
protected branch write logic
full autonomous task runner
paid provider integration
```

## 8. Final rule

If the implementation tree differs from this file, the PR must explain:

```text
what changed
why it changed
why it is still safe
what was not implemented
```
