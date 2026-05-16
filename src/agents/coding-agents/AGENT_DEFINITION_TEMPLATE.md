# Agent Definition Template

> AGENT NOTE:
> This file defines the required template for every Coding Agents Team agent definition.
> It is documentation only. It does not implement runtime agents and does not enable autonomy.

## 1. Purpose

Every coding agent must use one consistent definition shape.

This prevents vague agent files and hidden permissions.

## 2. Required template

Every agent definition must include these fields:

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

## 3. Field meanings

### agentId

Stable machine-readable id.

Example:

```text
repo_state_agent
```

### agentName

Human-readable name.

Example:

```text
RepoStateAgent
```

### agentLayer

One of:

```text
control
execution
verification
```

### agentVersion

Start with:

```text
v1
```

### purpose

Short explanation of why the agent exists.

### status

For skeleton V1, use:

```text
definition_only
```

or:

```text
skeleton_only
```

Do not mark as production-ready.

### allowedActions

List only allowed actions.

Example:

```text
read_repo
report_repo_state
mark_uncertainty
```

### forbiddenActions

List actions this agent must never do.

Example:

```text
write_patch
create_branch
create_pr
merge_pr
deploy_production
```

### inputSchema

Describe required input fields.

### outputSchema

Describe required output fields.

### failureRules

Describe when the agent must stop or return failure.

### requiredPermissions

List permission keys required to run the agent.

### riskLevel

One of:

```text
low
medium
high
critical
```

### canReadRepo

Boolean.

### canWriteRepo

Boolean.

### canCreateBranch

Boolean.

### canCreatePR

Boolean.

### canMerge

Boolean. Must be false in V1.

### canDeploy

Boolean. Must be false in V1.

### canChangeSecrets

Boolean. Must be false in V1.

### canChangeProtectedBranches

Boolean. Must be false in V1.

### requiresAdvisorReview

Boolean.

Usually true for anything that can affect code or PRs.

### requiresMonarchApproval

Boolean.

Must be true for high-risk actions.

## 4. Example definition shape

```js
export const repoStateAgentDefinition = {
  agentId: "repo_state_agent",
  agentName: "RepoStateAgent",
  agentLayer: "control",
  agentVersion: "v1",
  purpose: "Read repository state and report verified facts without editing files.",
  status: "definition_only",
  allowedActions: ["read_repo", "report_repo_state", "mark_uncertainty"],
  forbiddenActions: ["write_patch", "create_branch", "create_pr", "merge_pr", "deploy_production"],
  inputSchema: {
    repo: "string",
    branch: "string",
    requestedScope: "string",
    questionOrTask: "string"
  },
  outputSchema: {
    status: "string",
    summary: "string",
    evidence: "array",
    filesRead: "array",
    filesChanged: "array",
    risks: "array",
    nextStep: "string",
    requiresAdvisorReview: "boolean",
    requiresMonarchApproval: "boolean"
  },
  failureRules: [
    "Do not invent missing paths.",
    "Report uncertainty if repository evidence is incomplete."
  ],
  requiredPermissions: ["read_repo"],
  riskLevel: "low",
  canReadRepo: true,
  canWriteRepo: false,
  canCreateBranch: false,
  canCreatePR: false,
  canMerge: false,
  canDeploy: false,
  canChangeSecrets: false,
  canChangeProtectedBranches: false,
  requiresAdvisorReview: true,
  requiresMonarchApproval: false
};
```

## 5. Forbidden template shortcuts

Do not use vague fields like:

```text
permissions: all
mode: auto
canDoEverything: true
admin: true
```

Do not omit dangerous permission fields.

Do not leave dangerous permissions undefined.

## 6. Required validation

Registry or smoke checks must validate:

```text
all required fields exist
agentId is unique
dangerous permissions are explicit booleans
dangerous permissions are false in V1
allowedActions and forbiddenActions are arrays
inputSchema and outputSchema exist
```

## 7. Final rule

If an agent does not match this template, it must not be registered.
