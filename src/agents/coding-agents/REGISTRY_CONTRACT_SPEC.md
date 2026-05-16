# Registry Contract Specification

> AGENT NOTE:
> This file defines the expected contract for the Coding Agents Team registry.
> It is documentation only. It does not implement runtime agents and does not enable autonomy.

## 1. Purpose

The registry is the controlled entry point for coding agent definitions.

It must prevent random agent imports, duplicate ids, missing required fields, and unsafe permissions.

## 2. Registry responsibility

The registry must:

```text
register agent definitions
validate agent definitions
reject duplicate ids
return agent by id
list agents by layer
list safe metadata
block unsafe definitions
```

The registry must not:

```text
merge PRs
deploy
change secrets
write protected branches
execute uncontrolled autonomy
bypass PermissionGuardAgent
```

## 3. Required functions

### register(agentDefinition)

Registers one agent definition.

Must validate before registration.

Must reject duplicate agentId.

Expected behavior:

```text
valid definition -> registered
duplicate agentId -> error
missing required field -> error
dangerous permission true in V1 -> error
```

### get(agentId)

Returns one registered agent definition by id.

Expected behavior:

```text
known id -> agent definition
unknown id -> null or controlled error
```

Must not invent fallback agents.

### list()

Returns all registered agents.

Must return safe metadata or definitions without secrets.

### listByLayer(layer)

Returns agents from one layer:

```text
control
execution
verification
```

Unknown layer must return empty list or controlled error.

### validate(agentDefinition)

Checks definition shape.

Must verify:

```text
required fields exist
agentId is string
agentName is string
agentLayer is valid
allowedActions is array
forbiddenActions is array
inputSchema exists
outputSchema exists
failureRules exists
requiredPermissions is array
dangerous permission fields are booleans
dangerous permissions are false in V1
```

### getSafeMetadata(agentId)

Returns safe public metadata:

```text
agentId
agentName
agentLayer
purpose
status
riskLevel
allowedActions
forbiddenActions
```

Must not expose secrets, hidden config, or internal approval tokens.

## 4. Required registry state

Registry may store agents in memory as a controlled map:

```text
agentId -> agentDefinition
```

No database is required for V1.

No external service is required for V1.

## 5. Required validation fields

Every registered agent must include:

```text
agentId
agentName
agentLayer
agentVersion
purpose
status
allowedActions
forbiddenActions
inputSchema
outputSchema
failureRules
requiredPermissions
riskLevel
canReadRepo
canWriteRepo
canCreateBranch
canCreatePR
canMerge
canDeploy
canChangeSecrets
canChangeProtectedBranches
requiresAdvisorReview
requiresMonarchApproval
```

## 6. Dangerous permission rule

For V1, registry must reject any agent with:

```text
canMerge === true
canDeploy === true
canChangeSecrets === true
canChangeProtectedBranches === true
```

This applies even if the agent is otherwise valid.

## 7. Protected branch awareness

Registry itself does not decide branch access.

Branch access belongs to PermissionGuardAgent.

However, registry must not register an agent that claims protected branch write permission.

Protected branches include:

```text
main
dev/v2-start
dev/v2-start-clean-copy
any branch described as clean copy or chistovik
```

## 8. Error style

Registry errors must be clear.

Examples:

```text
Missing required field: agentId
Duplicate agent id: repo_state_agent
Invalid agentLayer: unknown
Dangerous permission not allowed in V1: canMerge
```

Do not fail silently.

## 9. Smoke checks required

Registry smoke checks must prove:

```text
valid agents register successfully
duplicate agent ids are rejected
missing required fields are rejected
dangerous permissions are rejected
listByLayer returns expected agents
get unknown id does not invent an agent
```

## 10. Minimal V1 registration order

Register minimal slice first:

```text
RepoStateAgent
PermissionGuardAgent
```

Then, after the minimal slice passes:

```text
RequirementsAgent
TaskPlannerAgent
ArchitectureGuardAgent
SkeletonAgent
DocsAgent
PRReportAgent
ReviewAgent
CodePatchAgent
```

## 11. No execution rule

V1 registry may register definitions.

V1 registry must not run full autonomous agent tasks unless a later approved runtime execution layer is created.

Allowed in V1:

```text
load definition
validate definition
list definition
return metadata
```

Not allowed in V1:

```text
execute repository writes
execute PR actions
execute merge
deploy
self-run coding loop
```

## 12. Final rule

If an agent cannot pass registry validation, it must not be available to SG, Advisor, or any future runtime layer.
