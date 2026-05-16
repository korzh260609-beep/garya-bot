# Coding Agent Workflows / Workflow по каждому coding agent

> AGENT NOTE:
> This file defines the step-by-step creation workflow for each future coding agent.
> It is documentation only. It does not implement runtime agents and does not enable autonomy.

## 1. Purpose

This file explains how each agent must be created step by step.

Use together with:

```text
CODING_AGENTS_TEAM.md
CODING_AGENT_ROLES.md
CODING_AGENT_CREATION.md
IMPLEMENTATION_WORKFLOW.md
```

## 2. Universal workflow for every agent

Every agent must be created through the same safe pattern:

```text
1. create agent folder
2. create contract/spec file
3. create permission definition
4. create prompt/spec placeholder
5. create runtime definition stub
6. create smoke check
7. register in CodingAgentRegistry
8. verify permissions
9. document limitations
10. include in PR report
```

Every agent must start narrow.

No agent may be created with merge, deploy, secret, or protected branch permissions.

---

# CONTROL LAYER WORKFLOWS

## 3. RepoStateAgent workflow

### Goal

Create a read-only agent that reports repository state.

### Steps

```text
1. create runtime/roles/repoStateAgent.definition.js
2. create runtime/prompts/repoStateAgent.prompt.md
3. create read-only permission definition
4. define input: repo, branch, requestedScope, questionOrTask
5. define output: relevantFiles, relevantFolders, missingEvidence, uncertainty
6. register as control-layer agent
7. add smoke check: cannot write files
8. add smoke check: cannot create branch or PR
9. add smoke check: reports uncertainty instead of inventing paths
```

### Must not do

```text
write files
create branches
create PRs
make architecture decisions
```

### Done when

RepoStateAgent can be loaded from registry and is read-only.

## 4. RequirementsAgent workflow

### Goal

Create an agent that converts Monarch commands into clear requirements.

### Steps

```text
1. create runtime/roles/requirementsAgent.definition.js
2. create runtime/prompts/requirementsAgent.prompt.md
3. create plan-only permission definition
4. define input: originalCommand, projectContext, restrictions
5. define output: goals, nonGoals, mustHave, mustNotDo, assumptions, acceptanceCriteria
6. register as control-layer agent
7. add smoke check: preserves original command
8. add smoke check: does not add unrequested features
9. add smoke check: marks assumptions clearly
```

### Must not do

```text
change the idea
invent product direction
write code
create PRs
```

### Done when

RequirementsAgent produces requirements without changing Monarch intent.

## 5. TaskPlannerAgent workflow

### Goal

Create an agent that turns requirements into ordered implementation stages.

### Steps

```text
1. create runtime/roles/taskPlannerAgent.definition.js
2. create runtime/prompts/taskPlannerAgent.prompt.md
3. create planning permission definition
4. define input: requirementsReport, repoStateReport, architectureRules
5. define output: stages, filePlan, testPlan, riskCheckpoints, approvalCheckpoints
6. register as control-layer agent
7. add smoke check: splits task into skeleton/config/logic/check stages
8. add smoke check: blocks too-large one-PR plan
9. add smoke check: includes approval points
```

### Must not do

```text
write code
skip skeleton stage
hide risky parts
```

### Done when

TaskPlannerAgent produces safe staged plans.

## 6. ArchitectureGuardAgent workflow

### Goal

Create an agent that protects SG architecture boundaries.

### Steps

```text
1. create runtime/roles/architectureGuardAgent.definition.js
2. create runtime/prompts/architectureGuardAgent.prompt.md
3. create architecture-review permission definition
4. define input: taskPlan, repoStateReport, changedFiles, architectureRules
5. define output: status, affectedLayers, violations, risks, requiredFixes
6. register as control-layer agent
7. add smoke check: blocks module logic inside SG Core
8. add smoke check: marks unclear impact as needs approval
9. add smoke check: detects missing skeleton
```

### Must not do

```text
approve architecture changes alone
change scope silently
allow core to become a dump
```

### Done when

ArchitectureGuardAgent can return allowed, blocked, or needs approval.

## 7. PermissionGuardAgent workflow

### Goal

Create an agent that blocks forbidden actions before they happen.

### Steps

```text
1. create runtime/roles/permissionGuardAgent.definition.js
2. create runtime/prompts/permissionGuardAgent.prompt.md
3. create permission-check definition
4. define input: actor, role, requestedAction, branch, files, approvalEvidence
5. define output: allowed, reason, requiredApproval, blockedTargets
6. register as control-layer agent
7. add smoke check: blocks main writes
8. add smoke check: blocks dev/v2-start-clean-copy writes
9. add smoke check: blocks merge without approval
10. add smoke check: blocks deploy without approval
```

### Must not do

```text
grant permissions
bypass Monarch approval
treat silence as approval
```

### Done when

PermissionGuardAgent blocks protected branch actions by default.

---

# EXECUTION LAYER WORKFLOWS

## 8. SkeletonAgent workflow

### Goal

Create an agent that creates structure before logic.

### Steps

```text
1. create runtime/roles/skeletonAgent.definition.js
2. create runtime/prompts/skeletonAgent.prompt.md
3. create skeleton/write-limited permission definition
4. define input: taskPlan, approvedSkeletonScope, repoStateReport, filePlan
5. define output: createdFiles, createdFolders, interfaces, boundaries, notImplemented
6. register as execution-layer agent
7. add smoke check: creates only skeleton files
8. add smoke check: adds AGENT NOTE where possible
9. add smoke check: reports notImplemented
```

### Must not do

```text
add runtime behavior without approval
connect to production
hide logic in placeholders
```

### Done when

SkeletonAgent can define structure without runtime side effects.

## 9. ConfigAgent workflow

### Goal

Create an agent that defines safe config after skeleton and before logic.

### Steps

```text
1. create runtime/roles/configAgent.definition.js
2. create runtime/prompts/configAgent.prompt.md
3. create config-write permission definition
4. define input: featureScope, skeletonReport, configNeeds, costLimits
5. define output: configFiles, defaults, envVars, featureFlags, risks
6. register as execution-layer agent
7. add smoke check: refuses secrets in committed files
8. add smoke check: uses safe defaults
9. add smoke check: does not enable expensive defaults
```

### Must not do

```text
add secrets
change Render env
turn on paid services by default
```

### Done when

ConfigAgent can create safe config skeletons only.

## 10. CodePatchAgent workflow

### Goal

Create an agent that writes scoped code only inside approved files.

### Steps

```text
1. create runtime/roles/codePatchAgent.definition.js
2. create runtime/prompts/codePatchAgent.prompt.md
3. create scoped write permission definition
4. define input: taskPlan, approvedFiles, forbiddenFiles, skeletonReport, configReport
5. define output: filesChanged, behaviorAdded, behaviorUnchanged, assumptions, risks, testInstructions
6. register as execution-layer agent
7. add smoke check: refuses files outside approvedFiles
8. add smoke check: cannot merge
9. add smoke check: cannot deploy
10. add smoke check: cannot edit protected branches
```

### Must not do

```text
broad rewrites
delete logic without command
change unrelated files
bypass permissions
```

### Done when

CodePatchAgent is scoped and cannot act outside approved file boundaries.

## 11. IntegrationAgent workflow

### Goal

Create an agent that connects modules through approved interfaces.

### Steps

```text
1. create runtime/roles/integrationAgent.definition.js
2. create runtime/prompts/integrationAgent.prompt.md
3. create integration permission definition
4. define input: codePatchReport, approvedInterfaces, moduleRegistryRules, repoStateReport
5. define output: connectedModules, interfacePoints, dependencyDirection, rollbackPoint
6. register as execution-layer agent
7. add smoke check: rejects direct coupling when registry is required
8. add smoke check: does not put module logic into SG Core
9. add smoke check: reports rollback point
```

### Must not do

```text
bypass Module Registry
connect unfinished module as live production behavior
hide transport coupling
```

### Done when

IntegrationAgent connects only through approved interfaces.

## 12. APIContractAgent workflow

### Goal

Create an agent that defines input/output/error contracts.

### Steps

```text
1. create runtime/roles/apiContractAgent.definition.js
2. create runtime/prompts/apiContractAgent.prompt.md
3. create contract-planning permission definition
4. define input: featureRequirements, clientNeeds, backendNeeds, existingContracts
5. define output: inputShape, outputShape, errorShape, versionNotes, compatibilityRisks
6. register as execution-layer agent
7. add smoke check: creates contract before dependent UI work
8. add smoke check: includes error format
9. add smoke check: includes compatibility notes
```

### Must not do

```text
break existing API silently
mix transport protocol with business logic
implement undocumented behavior
```

### Done when

APIContractAgent creates clear API/interface contracts.

## 13. UIClientAgent workflow

### Goal

Create a frontend-only agent.

### Steps

```text
1. create runtime/roles/uiClientAgent.definition.js
2. create runtime/prompts/uiClientAgent.prompt.md
3. create UI write permission definition
4. define input: uiRequirements, apiContractReport, clientFolderRules, approvedFiles
5. define output: screens, components, apiClientFiles, stateModel, missingBackendDependencies
6. register as execution-layer agent
7. add smoke check: cannot edit backend core
8. add smoke check: cannot store secrets in frontend
9. add smoke check: requires API contract when backend data is needed
```

### Must not do

```text
change backend core
change database
put private keys in frontend
```

### Done when

UIClientAgent can create UI skeletons without backend/core changes.

## 14. DependencyAgent workflow

### Goal

Create an agent that reviews dependency changes.

### Steps

```text
1. create runtime/roles/dependencyAgent.definition.js
2. create runtime/prompts/dependencyAgent.prompt.md
3. create dependency-review permission definition
4. define input: packageFiles, requestedDependency, taskNeed, alternatives
5. define output: currentState, proposedDependency, reason, alternatives, risk, recommendation
6. register as execution-layer agent
7. add smoke check: prefers no new dependency when possible
8. add smoke check: blocks paid SDK without approval
9. add smoke check: flags major version upgrades
```

### Must not do

```text
add heavy dependency without reason
add paid SDK without approval
change package strategy casually
```

### Done when

DependencyAgent can explain dependency risk before code changes.

## 15. MigrationAgent workflow

### Goal

Create an agent that plans database/schema changes safely.

### Steps

```text
1. create runtime/roles/migrationAgent.definition.js
2. create runtime/prompts/migrationAgent.prompt.md
3. create migration-planning permission definition
4. define input: schemaChangeRequest, currentSchema, migrationScope, dataRisk
5. define output: schemaChange, dataImpact, migrationType, rollbackPlan, approvalRequired
6. register as execution-layer agent
7. add smoke check: blocks destructive migration without approval
8. add smoke check: never runs production DB operations
9. add smoke check: requires rollback plan
```

### Must not do

```text
run production DB operations
delete user data
change balances without command
```

### Done when

MigrationAgent plans migrations without executing destructive actions.

## 16. DocsAgent workflow

### Goal

Create an agent that documents actual behavior only.

### Steps

```text
1. create runtime/roles/docsAgent.definition.js
2. create runtime/prompts/docsAgent.prompt.md
3. create docs-write permission definition
4. define input: changedFiles, codePatchReport, architectureReport, docsScope
5. define output: docsChanged, behaviorDocumented, limitations, missingDocs
6. register as execution-layer agent
7. add smoke check: does not mark skeleton as working feature
8. add smoke check: documents limitations
9. add smoke check: refuses fake status
```

### Must not do

```text
write fake completion status
change pillars without command
document behavior code does not support
```

### Done when

DocsAgent keeps docs honest and scoped.

---

# VERIFICATION LAYER WORKFLOWS

## 17. TestAgent workflow

### Goal

Create an agent that verifies changes honestly.

### Steps

```text
1. create runtime/roles/testAgent.definition.js
2. create runtime/prompts/testAgent.prompt.md
3. create check-running permission definition
4. define input: changedFiles, testPlan, packageScripts, availableTooling
5. define output: commandsUsed, result, failures, untestedAreas, recommendedFixes
6. register as verification-layer agent
7. add smoke check: says not verified when no execution evidence exists
8. add smoke check: cannot delete tests
9. add smoke check: cannot weaken assertions without approval
```

### Must not do

```text
hide failures
claim tests passed without evidence
delete tests to pass
```

### Done when

TestAgent reports pass/fail/unknown honestly.

## 18. SecurityGuardAgent workflow

### Goal

Create an agent that checks security-sensitive risks.

### Steps

```text
1. create runtime/roles/securityGuardAgent.definition.js
2. create runtime/prompts/securityGuardAgent.prompt.md
3. create security-review permission definition
4. define input: changedFiles, codePatchReport, permissionReport, sensitiveAreas
5. define output: riskLevel, affectedArea, issue, requiredFix, approvalNeeded
6. register as verification-layer agent
7. add smoke check: blocks exposed token/key/private config
8. add smoke check: blocks permission bypass
9. add smoke check: blocks unresolved high-risk change
```

### Must not do

```text
expose secrets
weaken auth
approve unsafe production operations
```

### Done when

SecurityGuardAgent can block obvious security risks.

## 19. MemoryImpactAgent workflow

### Goal

Create an agent that protects memory/privacy boundaries.

### Steps

```text
1. create runtime/roles/memoryImpactAgent.definition.js
2. create runtime/prompts/memoryImpactAgent.prompt.md
3. create memory-review permission definition
4. define input: changedFiles, memoryScope, schemaImpact, privacyRules
5. define output: memoryTypeAffected, privacyImpact, schemaImpact, risk, requiredGuard
6. register as verification-layer agent
7. add smoke check: blocks mixed private user memory
8. add smoke check: blocks unclear memory ownership
9. add smoke check: reports schema impact
```

### Must not do

```text
mix private user memory
expose private data
change memory ownership silently
```

### Done when

MemoryImpactAgent blocks unsafe memory designs.

## 20. CostControlAgent workflow

### Goal

Create an agent that prevents uncontrolled token/API cost.

### Steps

```text
1. create runtime/roles/costControlAgent.definition.js
2. create runtime/prompts/costControlAgent.prompt.md
3. create cost-review permission definition
4. define input: taskPlan, aiCallPlan, modelConfig, recurrencePlan
5. define output: costRisk, expectedUsage, cheaperAlternative, requiredLimit, approvalNeeded
6. register as verification-layer agent
7. add smoke check: blocks recurring AI task without limits
8. add smoke check: blocks expensive defaults
9. add smoke check: recommends robot-layer alternative when possible
```

### Must not do

```text
enable expensive defaults
bypass cost warnings
create unlimited recurring AI calls
```

### Done when

CostControlAgent blocks uncontrolled cost patterns.

## 21. ReviewAgent workflow

### Goal

Create an independent final reviewer.

### Steps

```text
1. create runtime/roles/reviewAgent.definition.js
2. create runtime/prompts/reviewAgent.prompt.md
3. create review permission definition
4. define input: diff, allAgentReports, taskPlan, testReport, architectureReport
5. define output: status, criticalIssues, nonCriticalIssues, requiredFixes, approvalReadiness
6. register as verification-layer agent
7. add smoke check: blocks files outside approved scope
8. add smoke check: blocks failed tests
9. add smoke check: blocks hidden scope changes
```

### Must not do

```text
approve its own work
ignore failed tests
approve architecture drift
```

### Done when

ReviewAgent can return approve, request changes, or block.

## 22. RollbackAgent workflow

### Goal

Create an agent that defines rollback before merge.

### Steps

```text
1. create runtime/roles/rollbackAgent.definition.js
2. create runtime/prompts/rollbackAgent.prompt.md
3. create rollback-planning permission definition
4. define input: changedFiles, migrationReport, integrationReport, releaseRisk
5. define output: rollbackMethod, affectedFiles, dataImpact, postRollbackChecks, limits
6. register as verification-layer agent
7. add smoke check: marks irreversible changes as risky
8. add smoke check: requires data impact notes
9. add smoke check: does not run rollback itself
```

### Must not do

```text
run rollback without approval
hide irreversible changes
pretend risky rollback is safe
```

### Done when

RollbackAgent can describe safe undo steps.

## 23. PRReportAgent workflow

### Goal

Create an agent that writes clear PR reports.

### Steps

```text
1. create runtime/roles/prReportAgent.definition.js
2. create runtime/prompts/prReportAgent.prompt.md
3. create PR-report permission definition
4. define input: taskPlan, changedFiles, allAgentReports, testReport, riskReports
5. define output: summary, scope, nonGoals, filesChanged, architectureImpact, tests, risks, rollbackNote, mergeStatus
6. register as verification-layer agent
7. add smoke check: includes merge status
8. add smoke check: lists risks
9. add smoke check: does not claim unverified tests
```

### Must not do

```text
hide risks
claim unverified checks
say PR is deployed
```

### Done when

Every PR report includes:

```text
Merge status: blocked until explicit Monarch approval.
```

## 24. ReleaseObservationAgent workflow

### Goal

Create an agent that observes post-merge/post-deploy evidence.

### Steps

```text
1. create runtime/roles/releaseObservationAgent.definition.js
2. create runtime/prompts/releaseObservationAgent.prompt.md
3. create observation permission definition
4. define input: prNumber, mergeCommit, workflowRuns, observationSources, deployContext
5. define output: mergeStatus, checksStatus, deploymentStatus, observedIssues, missingEvidence, nextAction
6. register as verification-layer agent
7. add smoke check: reports missing CI/log data clearly
8. add smoke check: does not deploy
9. add smoke check: does not claim health without evidence
```

### Must not do

```text
deploy without approval
hide failed checks
claim release is healthy without evidence
```

### Done when

ReleaseObservationAgent reports only evidence-backed status.

---

# 25. Final sequencing rule

Build V1 first:

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

Then test the registry and permissions.

Only after V1 is reviewed and merged, add advanced agents one by one.

Never implement all agents with full behavior in one uncontrolled step.
