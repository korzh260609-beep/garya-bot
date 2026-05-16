# Coding Agent Creation Requirements / Как создавать кодинг-агентов

> AGENT NOTE:
> This file defines how each future coding agent should be created.
> It is a documentation/specification file only. It does not implement runtime agents, does not enable autonomy, and does not grant merge/deploy permissions.

## 1. Purpose

This file complements `CODING_AGENT_ROLES.md`.

It answers one question for every agent:

```text
How must this agent be created so it stays narrow, safe, testable, and controlled by SG, Advisor, and the Monarch?
```

## 2. Universal creation rule

Every coding agent must be created as a narrow controlled module.

No agent may be created as a vague prompt, hidden automation, or free autonomous worker.

Required creation order:

```text
1. role spec
2. interface contract
3. permission limits
4. input schema
5. output schema
6. failure rules
7. tests/smoke checks
8. registry connection
9. controlled SG access
```

## 3. Universal agent module shape

When runtime implementation begins, every agent should have a structure similar to:

```text
src/agents/coding-agents/<agentName>/
  <agentName>.js
  <agentName>.contract.js
  <agentName>.permissions.js
  <agentName>.prompt.md
  <agentName>.test.js or smoke script
  README.md
```

This shape may be adjusted later, but the boundaries must stay clear.

## 4. Universal required fields

Every agent must define:

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

Default dangerous permissions:

```text
canMerge = false
canDeploy = false
canChangeSecrets = false
canChangeProtectedBranches = false
```

## 5. Universal output rule

Every agent must return structured output.

Minimum output:

```text
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

If an agent cannot complete its work, it must return a clear failure reason.

---

# CONTROL LAYER AGENTS

## 6. RepoStateAgent — creation requirements

### How to create

Create RepoStateAgent as a read-only repository inspection module.

It must use repository facts, file listings, known project maps, and verified file reads.

### Required module behavior

- read only;
- never write files;
- never create branches;
- never create PRs;
- never guess missing paths;
- always mark uncertainty.

### Required inputs

```text
repo
branch
requestedScope
questionOrTask
knownFiles
```

### Required outputs

```text
repoStateReport
relevantFiles
relevantFolders
missingEvidence
uncertainty
nextRecommendedAgent
```

### Required permissions

```text
read_repo
```

### Forbidden permissions

```text
write_patch
create_pr
merge_pr
deploy_production
```

### Creation test

It must be tested on a simple task: given a known folder, it reports existing files without inventing new ones.

## 7. RequirementsAgent — creation requirements

### How to create

Create RequirementsAgent as a text-to-requirements parser.

It must preserve the Monarch's original intent and convert it into clear engineering requirements.

### Required module behavior

- keep original command visible;
- extract goals;
- extract non-goals;
- extract restrictions;
- mark assumptions;
- never add product direction silently.

### Required inputs

```text
originalCommand
projectContext
currentTaskContext
knownRestrictions
```

### Required outputs

```text
requirementsReport
goals
nonGoals
mustHave
mustNotDo
assumptions
acceptanceCriteria
```

### Required permissions

```text
plan_task
```

### Forbidden permissions

```text
write_patch
create_pr
merge_pr
```

### Creation test

It must parse a broad command into requirements without adding unrequested features.

## 8. TaskPlannerAgent — creation requirements

### How to create

Create TaskPlannerAgent as a planner that converts requirements into ordered implementation stages.

### Required module behavior

- split large tasks into safe blocks;
- mark each block as skeleton/config/logic/test/docs;
- define file scope;
- define approval points;
- stop if scope is too broad.

### Required inputs

```text
requirementsReport
repoStateReport
architectureRules
taskSizeLimit
```

### Required outputs

```text
taskPlan
stages
filePlan
testPlan
riskCheckpoints
approvalCheckpoints
```

### Required permissions

```text
plan_task
```

### Forbidden permissions

```text
write_patch
merge_pr
deploy_production
```

### Creation test

It must take a large task and split it into at least skeleton/config/logic/check stages.

## 9. ArchitectureGuardAgent — creation requirements

### How to create

Create ArchitectureGuardAgent as a rules checker for SG architecture.

It must compare planned changes against pillars, module boundaries, core boundaries, and existing ownership.

### Required module behavior

- detect core pollution;
- detect mixed responsibility;
- detect direct coupling;
- detect missing skeleton;
- return allowed/blocked/needs approval.

### Required inputs

```text
taskPlan
repoStateReport
changedFiles
architectureRules
```

### Required outputs

```text
architectureGuardReport
status
affectedLayers
violations
risks
requiredFixes
```

### Required permissions

```text
review_architecture
```

### Forbidden permissions

```text
write_patch
merge_pr
```

### Creation test

It must block a fake plan that puts module-specific logic directly into SG Core.

## 10. PermissionGuardAgent — creation requirements

### How to create

Create PermissionGuardAgent as a pre-action gate.

It must run before any write, branch, PR, merge, deploy, secret, or protected branch action.

### Required module behavior

- check actor role;
- check requested action;
- check branch;
- check forbidden targets;
- require explicit Monarch approval for risky actions.

### Required inputs

```text
actor
role
requestedAction
branch
files
approvalEvidence
```

### Required outputs

```text
permissionReport
allowed
reason
requiredApproval
blockedTargets
```

### Required permissions

```text
check_permissions
```

### Forbidden permissions

```text
grant_permissions
merge_pr
deploy_production
```

### Creation test

It must deny writes to `main` and `dev/v2-start-clean-copy`.

---

# EXECUTION LAYER AGENTS

## 11. SkeletonAgent — creation requirements

### How to create

Create SkeletonAgent as a structure-only builder.

It must create folders, specs, interfaces, and placeholders before logic.

### Required module behavior

- create structure only;
- add AGENT NOTE where possible;
- define boundaries;
- avoid runtime side effects;
- report what is not implemented.

### Required inputs

```text
taskPlan
approvedSkeletonScope
repoStateReport
filePlan
```

### Required outputs

```text
skeletonReport
createdFiles
createdFolders
interfaces
boundaries
notImplemented
```

### Required permissions

```text
create_skeleton
write_patch
```

### Forbidden permissions

```text
merge_pr
deploy_production
change_core_architecture
```

### Creation test

It must create a sample module skeleton without runtime behavior.

## 12. ConfigAgent — creation requirements

### How to create

Create ConfigAgent as a safe configuration builder.

It must define editable configuration, defaults, limits, and feature flags without adding secrets.

### Required module behavior

- create config schema;
- define safe defaults;
- document env variables;
- avoid hardcoded secrets;
- avoid expensive default behavior.

### Required inputs

```text
featureScope
skeletonReport
configNeeds
costLimits
```

### Required outputs

```text
configReport
configFiles
defaults
envVars
featureFlags
risks
```

### Required permissions

```text
write_patch
create_config
```

### Forbidden permissions

```text
change_secrets
change_render_env
deploy_production
```

### Creation test

It must refuse to place API keys or secrets in committed files.

## 13. CodePatchAgent — creation requirements

### How to create

Create CodePatchAgent as a scoped code writer.

It must only write code inside an approved plan and approved file scope.

### Required module behavior

- implement only planned changes;
- keep diffs small;
- avoid unrelated refactors;
- preserve existing behavior unless explicitly changed;
- report assumptions and risks.

### Required inputs

```text
taskPlan
approvedFiles
forbiddenFiles
skeletonReport
configReport
```

### Required outputs

```text
codePatchReport
filesChanged
behaviorAdded
behaviorUnchanged
assumptions
risks
testInstructions
```

### Required permissions

```text
write_patch
```

### Forbidden permissions

```text
merge_pr
deploy_production
change_protected_branches
```

### Creation test

It must refuse to edit files outside `approvedFiles`.

## 14. IntegrationAgent — creation requirements

### How to create

Create IntegrationAgent as a connector through approved interfaces and registries.

It must not place module logic inside SG Core.

### Required module behavior

- connect modules through existing registries;
- add imports/exports only where approved;
- verify dependency direction;
- avoid hidden transport coupling.

### Required inputs

```text
codePatchReport
approvedInterfaces
moduleRegistryRules
repoStateReport
```

### Required outputs

```text
integrationReport
connectedModules
interfacePoints
dependencyDirection
rollbackPoint
```

### Required permissions

```text
write_patch
integrate_module
```

### Forbidden permissions

```text
change_core_architecture
merge_pr
deploy_production
```

### Creation test

It must reject direct coupling when a registry/interface should be used.

## 15. APIContractAgent — creation requirements

### How to create

Create APIContractAgent as an interface contract designer.

It must define input/output/error contracts before frontend/backend integration.

### Required module behavior

- define request shape;
- define response shape;
- define error shape;
- define compatibility notes;
- avoid changing behavior without docs.

### Required inputs

```text
featureRequirements
clientNeeds
backendNeeds
existingContracts
```

### Required outputs

```text
apiContractReport
inputShape
outputShape
errorShape
versionNotes
compatibilityRisks
```

### Required permissions

```text
plan_contract
write_docs
```

### Forbidden permissions

```text
merge_pr
deploy_production
break_existing_api
```

### Creation test

It must produce a contract before UIClientAgent writes UI code that depends on backend data.

## 16. UIClientAgent — creation requirements

### How to create

Create UIClientAgent as a frontend-only agent.

It must not change backend core logic or database internals.

### Required module behavior

- create UI structure;
- create components;
- create API client boundaries;
- keep secrets out of frontend;
- depend on documented API contracts.

### Required inputs

```text
uiRequirements
apiContractReport
clientFolderRules
approvedFiles
```

### Required outputs

```text
uiClientReport
screens
components
apiClientFiles
stateModel
missingBackendDependencies
```

### Required permissions

```text
write_patch
create_ui
```

### Forbidden permissions

```text
change_backend_core
change_database
store_secrets_in_frontend
```

### Creation test

It must refuse to place private keys, tokens, or server-only logic into frontend files.

## 17. DependencyAgent — creation requirements

### How to create

Create DependencyAgent as a dependency reviewer.

It must evaluate package additions before they are committed.

### Required module behavior

- inspect existing dependencies;
- prefer no new dependency when possible;
- explain why a dependency is needed;
- identify heavy or risky packages;
- require approval for paid/external SDKs.

### Required inputs

```text
packageFiles
requestedDependency
taskNeed
alternatives
```

### Required outputs

```text
dependencyReport
currentState
proposedDependency
reason
alternatives
risk
recommendation
```

### Required permissions

```text
review_dependencies
```

### Forbidden permissions

```text
install_paid_sdk_without_approval
upgrade_major_versions_casually
merge_pr
```

### Creation test

It must recommend no new dependency when existing code can solve the task.

## 18. MigrationAgent — creation requirements

### How to create

Create MigrationAgent as a database/schema planning agent.

It must never run production database operations by itself.

### Required module behavior

- plan schema changes;
- classify destructive/non-destructive changes;
- define rollback;
- protect user data;
- require approval for irreversible changes.

### Required inputs

```text
schemaChangeRequest
currentSchema
migrationScope
dataRisk
```

### Required outputs

```text
migrationReport
schemaChange
dataImpact
migrationType
rollbackPlan
approvalRequired
```

### Required permissions

```text
plan_migration
write_migration_draft
```

### Forbidden permissions

```text
run_production_db_operations
delete_user_data
change_balances_without_command
```

### Creation test

It must block a destructive migration unless explicit Monarch approval exists.

## 19. DocsAgent — creation requirements

### How to create

Create DocsAgent as a documentation synchronizer.

It must document actual behavior, not imaginary behavior.

### Required module behavior

- write or update related docs;
- add usage examples;
- list limitations;
- mark non-implemented parts clearly;
- avoid fake completion status.

### Required inputs

```text
changedFiles
codePatchReport
architectureReport
docsScope
```

### Required outputs

```text
docsReport
docsChanged
behaviorDocumented
limitations
missingDocs
```

### Required permissions

```text
write_docs
```

### Forbidden permissions

```text
change_pillars_without_command
mark_unimplemented_as_done
merge_pr
```

### Creation test

It must refuse to document a feature as working when only a skeleton exists.

---

# VERIFICATION LAYER AGENTS

## 20. TestAgent — creation requirements

### How to create

Create TestAgent as a verification module.

It must report evidence honestly.

### Required module behavior

- find test commands;
- run safe checks where tooling allows;
- add planned smoke tests when approved;
- report pass/fail/unknown;
- never hide failed checks.

### Required inputs

```text
changedFiles
testPlan
packageScripts
availableTooling
```

### Required outputs

```text
testReport
commandsUsed
result
failures
untestedAreas
recommendedFixes
```

### Required permissions

```text
run_checks
write_test_patch_when_approved
```

### Forbidden permissions

```text
delete_tests_to_pass
weaken_assertions_without_approval
merge_pr
```

### Creation test

It must say tests are not verified when no execution evidence exists.

## 21. SecurityGuardAgent — creation requirements

### How to create

Create SecurityGuardAgent as a safety checker for code and process.

It must focus on obvious project risks, permissions, secrets, user data, and external APIs.

### Required module behavior

- check secret exposure;
- check permission bypass;
- check unsafe file/tool access;
- check user data risk;
- block high-risk unresolved changes.

### Required inputs

```text
changedFiles
codePatchReport
permissionReport
sensitiveAreas
```

### Required outputs

```text
securityReport
riskLevel
affectedArea
issue
requiredFix
approvalNeeded
```

### Required permissions

```text
review_security
```

### Forbidden permissions

```text
expose_secrets
weaken_auth
approve_unsafe_production_operations
```

### Creation test

It must block a patch that exposes a token, key, or private config value.

## 22. MemoryImpactAgent — creation requirements

### How to create

Create MemoryImpactAgent as a memory/privacy boundary checker.

It must protect separation between project memory, user memory, group memory, and private context.

### Required module behavior

- identify memory type affected;
- check privacy boundary;
- check schema impact;
- check cross-user leakage risk;
- require guards if memory scope is unclear.

### Required inputs

```text
changedFiles
memoryScope
schemaImpact
privacyRules
```

### Required outputs

```text
memoryImpactReport
memoryTypeAffected
privacyImpact
schemaImpact
risk
requiredGuard
```

### Required permissions

```text
review_memory_impact
```

### Forbidden permissions

```text
mix_private_user_memory
expose_private_data
change_memory_ownership_silently
```

### Creation test

It must block a design that mixes different users' private memories.

## 23. CostControlAgent — creation requirements

### How to create

Create CostControlAgent as a token/API cost guard.

It must prevent uncontrolled AI/tool spending.

### Required module behavior

- estimate AI/tool usage;
- identify recurring loops;
- check model routing;
- recommend robot-layer alternatives;
- require cost limits for recurring tasks.

### Required inputs

```text
taskPlan
aiCallPlan
modelConfig
recurrencePlan
```

### Required outputs

```text
costReport
costRisk
expectedUsage
cheaperAlternative
requiredLimit
approvalNeeded
```

### Required permissions

```text
review_cost
```

### Forbidden permissions

```text
enable_expensive_defaults
bypass_cost_warning
create_unlimited_recurring_ai_calls
```

### Creation test

It must block a recurring AI task that has no limit or cost guard.

## 24. ReviewAgent — creation requirements

### How to create

Create ReviewAgent as a final independent reviewer.

It must not review its own generated patch as fully approved.

### Required module behavior

- inspect diff;
- compare against plan;
- check scope creep;
- check architecture warnings;
- check test evidence;
- return approve/request changes/block.

### Required inputs

```text
diff
allAgentReports
taskPlan
testReport
architectureReport
```

### Required outputs

```text
reviewReport
status
criticalIssues
nonCriticalIssues
requiredFixes
approvalReadiness
```

### Required permissions

```text
review_pr
```

### Forbidden permissions

```text
self_approve_full_flow
ignore_failed_tests
merge_pr
```

### Creation test

It must block a diff that changes files outside the approved scope.

## 25. RollbackAgent — creation requirements

### How to create

Create RollbackAgent as a rollback planner.

It must explain how to undo a change safely before merge.

### Required module behavior

- define rollback method;
- list affected files;
- check data impact;
- define post-rollback checks;
- mark irreversible risk.

### Required inputs

```text
changedFiles
migrationReport
integrationReport
releaseRisk
```

### Required outputs

```text
rollbackReport
rollbackMethod
affectedFiles
dataImpact
postRollbackChecks
limits
```

### Required permissions

```text
plan_rollback
```

### Forbidden permissions

```text
run_rollback_without_approval
hide_irreversible_changes
merge_pr
```

### Creation test

It must mark destructive migration rollback as risky if data cannot be restored.

## 26. PRReportAgent — creation requirements

### How to create

Create PRReportAgent as a PR summary builder.

It must create clear PR descriptions from agent reports.

### Required module behavior

- summarize purpose;
- list changed files;
- list tests/checks;
- list risks;
- list non-goals;
- include merge approval status.

### Required inputs

```text
taskPlan
changedFiles
allAgentReports
testReport
riskReports
```

### Required outputs

```text
prReport
summary
scope
nonGoals
filesChanged
architectureImpact
tests
risks
rollbackNote
mergeStatus
```

### Required permissions

```text
create_pr_report
create_pr_when_allowed
```

### Forbidden permissions

```text
hide_risks
claim_unverified_tests
request_merge_without_approval_notice
```

### Creation test

Every generated PR body must include:

```text
Merge status: blocked until explicit Monarch approval.
```

## 27. ReleaseObservationAgent — creation requirements

### How to create

Create ReleaseObservationAgent as a post-merge/post-deploy observer.

It must report real evidence, not assumptions.

### Required module behavior

- check merge status;
- check available CI status;
- check observation logs if available;
- check deployment status if available;
- report missing evidence clearly.

### Required inputs

```text
prNumber
mergeCommit
workflowRuns
observationSources
deployContext
```

### Required outputs

```text
releaseObservationReport
mergeStatus
checksStatus
deploymentStatus
observedIssues
missingEvidence
nextAction
```

### Required permissions

```text
observe_release
read_checks
read_logs_when_allowed
```

### Forbidden permissions

```text
deploy_without_approval
hide_failed_checks
claim_health_without_evidence
```

### Creation test

It must say exactly what evidence is missing when CI/log data is unavailable.

---

# 28. Registry creation rule

When runtime implementation starts, agents must be connected through a registry, not imported randomly everywhere.

Recommended registry shape:

```text
CodingAgentRegistry
- register(agentDefinition)
- get(agentId)
- listByLayer(layer)
- canRun(agentId, context)
- run(agentId, input)
```

The registry must enforce permissions before running an agent.

## 29. Prompt creation rule

If an agent uses an AI prompt, its prompt must be stored as a controlled prompt file or config entry.

Prompt must include:

```text
role
scope
allowed actions
forbidden actions
input format
output format
failure behavior
```

Prompt must not include hidden permission escalation.

## 30. Tool creation rule

If an agent uses tools, each tool must be explicitly allowed.

Tool access must be scoped by role.

Example:

```text
RepoStateAgent -> read-only repo tools
CodePatchAgent -> file patch tools only inside approved scope
PRReportAgent -> PR body creation tools only
ReleaseObservationAgent -> read-only status/log tools
```

## 31. Final creation rule

Create agents slowly.

Correct order:

```text
1. RepoStateAgent
2. RequirementsAgent
3. TaskPlannerAgent
4. ArchitectureGuardAgent
5. PermissionGuardAgent
6. SkeletonAgent
7. DocsAgent
8. PRReportAgent
9. ReviewAgent
10. CodePatchAgent
```

Only after this minimal safe loop works, add the advanced agents.

Never create the whole autonomous swarm at once.
