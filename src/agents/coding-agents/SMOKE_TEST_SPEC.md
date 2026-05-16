# Smoke Test Specification

> AGENT NOTE:
> This file defines the required smoke tests for the Coding Agents Team runtime skeleton.
> It is documentation only. It does not implement runtime agents and does not enable autonomy.

## 1. Purpose

This file explains exactly what smoke checks must verify.

Smoke checks are not full tests.

They prove that the skeleton is safe, loadable, and not dangerous by default.

## 2. Required smoke test files

Recommended files:

```text
src/agents/coding-agents/runtime/tests/smokeCodingAgentRegistry.js
src/agents/coding-agents/runtime/tests/smokeCodingAgentPermissions.js
src/agents/coding-agents/runtime/tests/smokeMinimalAgentDefinitions.js
```

## 3. Smoke test: registry loads V1/minimal agents

### Name

```text
smokeCodingAgentRegistry loads agents
```

### Checks

```text
- registry module can be imported
- registry has register function
- registry has get function
- registry has listByLayer function
- registry can load minimal agent definitions
```

### Expected result

```text
PASS when registry loads known agents without throwing.
```

### Must fail when

```text
- registry is missing
- register function is missing
- duplicate ids crash silently
- agent definitions are not loadable
```

## 4. Smoke test: agent ids are unique

### Name

```text
smokeCodingAgentRegistry rejects duplicate ids
```

### Checks

```text
- each agentId is unique
- duplicate agentId is rejected
- duplicate rejection is explicit
```

### Expected result

```text
PASS when duplicate ids are blocked.
```

### Must fail when

```text
- duplicate ids are accepted
- duplicate ids overwrite existing agents silently
```

## 5. Smoke test: required fields exist

### Name

```text
smokeMinimalAgentDefinitions required fields
```

### Checks

Every agent definition must include:

```text
agentId
agentName
agentLayer
purpose
allowedActions
forbiddenActions
inputSchema
outputSchema
failureRules
requiredPermissions
riskLevel
canWriteRepo
canCreateBranch
canCreatePR
canMerge
canDeploy
```

### Expected result

```text
PASS when every required field exists.
```

### Must fail when

```text
- any required field is missing
- dangerous fields are undefined
```

## 6. Smoke test: dangerous permissions are false

### Name

```text
smokeCodingAgentPermissions dangerous defaults
```

### Checks

For every V1/minimal agent:

```text
canMerge === false
canDeploy === false
canChangeSecrets === false
canChangeProtectedBranches === false
```

### Expected result

```text
PASS when all dangerous permissions are false.
```

### Must fail when

```text
- any dangerous permission is true
- any dangerous permission is missing/undefined
```

## 7. Smoke test: main writes are blocked

### Name

```text
smokePermissionGuard blocks main writes
```

### Example input

```text
actorRole: coding_agent
requestedAction: write_patch
branch: main
approvalEvidence: null
```

### Expected output

```text
allowed: false
reason includes protected branch or forbidden branch
```

### Must fail when

```text
allowed: true
```

## 8. Smoke test: clean-copy writes are blocked

### Name

```text
smokePermissionGuard blocks clean copy writes
```

### Example input

```text
actorRole: coding_agent
requestedAction: write_patch
branch: dev/v2-start-clean-copy
approvalEvidence: null
```

### Expected output

```text
allowed: false
reason includes clean-copy/chistovik/protected branch
```

### Must fail when

```text
allowed: true
```

## 9. Smoke test: RepoStateAgent is read-only

### Name

```text
smokeRepoStateAgent read only
```

### Checks

RepoStateAgent must have:

```text
canWriteRepo === false
canCreateBranch === false
canCreatePR === false
canMerge === false
canDeploy === false
```

### Expected result

```text
PASS when RepoStateAgent has read-only permissions.
```

### Must fail when

```text
RepoStateAgent can write, branch, PR, merge, or deploy.
```

## 10. Smoke test: CodePatchAgent cannot merge or deploy

### Name

```text
smokeCodePatchAgent no merge deploy
```

### Checks

CodePatchAgent definition must have:

```text
canMerge === false
canDeploy === false
canChangeProtectedBranches === false
```

### Expected result

```text
PASS when CodePatchAgent cannot merge/deploy/change protected branches.
```

### Must fail when

```text
CodePatchAgent has merge/deploy/protected branch permission.
```

## 11. Smoke test reporting rule

Every smoke script must print a clear final line:

```text
Smoke <name> — OK
```

or fail with a clear error.

## 12. No fake pass rule

Do not write smoke checks that always pass.

Each smoke check must assert at least one real condition.

## 13. Unknown tooling rule

If the repository test runner is unclear, create simple Node smoke scripts and document how to run them in runtime README.
