# Coding Agents Team / Команда кодинг-агентов

> AGENT NOTE:
> This file defines the skeleton and operating rules for a future coding-agents team.
> It is a specification only: it does not grant autonomy, does not enable auto-merge, and does not change SG Core behavior by itself.

## 1. Purpose

The Coding Agents Team is a controlled set of simple development agents that help SG 2.0 perform larger engineering tasks without turning the project into uncontrolled autonomous code generation.

Primary goal:

```text
Monarch gives a large development task -> SG understands and plans it -> coding agents split and prepare the work -> Advisor reviews -> Monarch approves -> merge only after explicit permission.
```

The team exists to speed up work on large blocks such as:

- client application skeletons;
- new modules;
- tests and smoke checks;
- documentation updates;
- repository diagnostics;
- integration review;
- pull request preparation.

The team does not replace the Monarch, the Advisor, the SG architecture, or the project pillars.

## 2. Core principle

Coding agents are executors, not rulers.

They may help with analysis, planning, code patches, tests, documentation, and PR preparation.

They must not decide strategic architecture, modify SG laws/pillars, merge PRs, deploy, change production configuration, or bypass approval.

The mandatory order remains:

```text
skeleton -> config -> logic
```

For every new module or large feature:

1. first define the skeleton;
2. then define configuration boundaries;
3. only then implement behavior and runtime logic.

## 3. Required command chain

The correct chain is:

```text
Monarch
  -> Advisor in ChatGPT chat
  -> SG through approved bridge/tooling
  -> Coding Agents Team
  -> branch + patch + PR
  -> Advisor review
  -> Monarch approval
  -> merge only after explicit “можно”
```

No coding agent may skip the Advisor or the Monarch.

## 4. Required repository rules

Coding agents must follow these repository rules:

- work only against `dev/v2-start` unless the Monarch explicitly says otherwise;
- never write to `main`;
- never write to `dev/v2-start-clean-copy`;
- never push directly to `dev/v2-start`;
- always use a separate work branch;
- always create a PR into `dev/v2-start`;
- never merge without explicit Monarch approval;
- never enable auto-merge;
- never change production secrets;
- never change Render configuration unless the task explicitly allows it;
- never rewrite history;
- never delete files unless explicitly ordered;
- never change SG Core architecture without explicit permission;
- never modify pillars/laws unless the task explicitly says so.

## 5. Required safety mode

Default mode is controlled execution.

Allowed by default:

- read repository files;
- inspect project structure;
- propose plans;
- create isolated branches;
- create or update files required by the task;
- prepare PRs;
- run available safe checks if tooling exists;
- write review reports;
- explain risks.

Forbidden by default:

- direct merge;
- direct deployment;
- direct production changes;
- secret rotation;
- destructive database operations;
- destructive user-data operations;
- adding paid external services without Monarch approval;
- adding new AI providers without Monarch approval;
- bypassing permission checks;
- hiding generated changes;
- making architecture decisions silently.

## 6. Roles inside the Coding Agents Team

### 6.1 RepoStateAgent

Purpose:

- read repository state;
- map folders, files, modules, entrypoints, tests, and docs;
- identify relevant files for a task;
- prevent invented paths and fake assumptions.

Allowed:

- repository read-only inspection;
- structure reports;
- dependency/path discovery;
- risk notes about missing files or unclear ownership.

Forbidden:

- code changes;
- branch creation;
- PR creation;
- architecture modification.

Output:

```text
RepoState Report:
- relevant files
- existing modules
- missing pieces
- risks
- suggested next agent
```

### 6.2 TaskPlannerAgent

Purpose:

- convert a large Monarch task into an executable engineering plan;
- split large tasks into safe blocks;
- define dependencies between blocks;
- decide whether a task is skeleton, config, or logic.

Allowed:

- task decomposition;
- acceptance criteria;
- sequencing;
- risk classification.

Forbidden:

- writing code;
- changing repository state;
- approving its own plan as final.

Output:

```text
Task Plan:
- goal
- non-goals
- files to create/update
- execution order
- tests/checks
- risks
- required approval points
```

### 6.3 ArchitectureGuardAgent

Purpose:

- protect SG architecture;
- check whether the task violates pillars, SG Core boundaries, modular structure, permissions, memory design, sources layer, or task engine rules.

Allowed:

- architectural review;
- boundary checks;
- warnings;
- blocking recommendations.

Forbidden:

- silent architecture changes;
- approving changes that modify core principles without Monarch approval.

Output:

```text
Architecture Guard Report:
- allowed / blocked / needs Monarch approval
- affected layers
- violated or protected rules
- safer alternative
```

### 6.4 SkeletonAgent

Purpose:

- create or update structural files for a new module or feature;
- define folders, placeholders, interfaces, docs, and contracts before implementation.

Allowed:

- create folders through placeholder/spec files;
- create interface stubs;
- create README/spec documents;
- add TODO markers only where useful;
- create non-runtime skeletons.

Forbidden:

- runtime logic without approval;
- hidden side effects;
- direct integration into core without approved interface.

Output:

```text
Skeleton Patch:
- created structure
- contracts
- ownership boundaries
- what remains unimplemented
```

### 6.5 CodePatchAgent

Purpose:

- implement approved small or medium code changes according to the plan and skeleton.

Allowed:

- code edits inside approved files;
- new module files when planned;
- small refactors required by the task;
- local validation instructions.

Forbidden:

- broad rewrites;
- deleting existing logic without explicit order;
- changing behavior outside task scope;
- mixing unrelated tasks;
- hardcoding temporary hacks.

Output:

```text
Code Patch Report:
- files changed
- behavior added
- behavior not changed
- risks
- how to test
```

### 6.6 IntegrationAgent

Purpose:

- connect completed pieces through existing interfaces and registries.

Allowed:

- wire modules through approved registries;
- add imports/exports;
- check dependency direction;
- ensure SG can call the new capability through a controlled interface.

Forbidden:

- bypassing Module Registry;
- creating direct coupling between unrelated modules;
- putting module logic into SG Core;
- adding hidden transport dependencies.

Output:

```text
Integration Report:
- connected interfaces
- dependency direction
- affected modules
- rollback point
```

### 6.7 TestAgent

Purpose:

- check whether the proposed change is safe and verifiable.

Allowed:

- identify existing test commands;
- add smoke tests if planned;
- run or describe checks through available tooling;
- report failures clearly.

Forbidden:

- hiding failing checks;
- deleting tests to pass CI;
- weakening assertions without approval;
- marking untested code as tested.

Output:

```text
Test Report:
- commands/checks
- pass/fail/unknown
- failures
- untested risks
```

### 6.8 ReviewAgent

Purpose:

- review the full diff before Advisor and Monarch approval.

Allowed:

- check scope;
- check architecture;
- check safety;
- check tests;
- check documentation;
- request changes.

Forbidden:

- approving its own code without external review;
- ignoring architecture warnings;
- accepting unexplained risk.

Output:

```text
Review Report:
- approve / request changes / block
- reasons
- critical risks
- suggested fixes
```

### 6.9 DocsAgent

Purpose:

- keep documentation aligned with the actual code and approved architecture.

Allowed:

- create or update docs directly related to the task;
- write usage examples;
- update workflow notes if explicitly required.

Forbidden:

- marking work as done if code does not prove it;
- modifying laws/pillars without explicit order;
- writing fake status reports.

Output:

```text
Docs Report:
- docs changed
- what the docs now define
- what remains undocumented
```

### 6.10 PRReportAgent

Purpose:

- prepare a clear PR description for the Monarch and Advisor.

Allowed:

- summarize changes;
- list affected files;
- list tests;
- list risks;
- list what was not changed.

Forbidden:

- hiding generated files;
- claiming tests passed if not verified;
- requesting merge without stating risks.

Output:

```text
PR Report:
- summary
- files changed
- tests/checks
- risks
- rollback note
- merge status: waiting for Monarch approval
```

## 7. How SG must use coding agents

SG must be able to use the Coding Agents Team as an internal controlled execution layer.

SG may ask coding agents to:

- inspect repository state;
- prepare a task plan;
- prepare a skeleton;
- prepare patch candidates;
- review a PR;
- summarize risks;
- generate a PR report.

SG must not allow coding agents to:

- override the Monarch;
- override the Advisor;
- skip permissions;
- write directly to protected branches;
- merge PRs automatically;
- deploy automatically;
- create hidden runtime behavior.

SG must always preserve this command hierarchy:

```text
Monarch authority > SG laws/pillars > Advisor review > agent execution
```

## 8. How Advisor must use coding agents through SG

Advisor in ChatGPT chat must be able to use the coding agents through SG or approved GitHub bridge/tooling.

Advisor may:

- translate Monarch commands into precise engineering tasks;
- call or instruct RepoStateAgent-style inspection;
- request plans from TaskPlannerAgent;
- request skeletons from SkeletonAgent;
- request patch preparation from CodePatchAgent;
- request reviews from ReviewAgent;
- prepare final reports for the Monarch.

Advisor must:

- warn about risks early;
- keep changes scoped;
- enforce branch and PR rules;
- avoid silent architecture changes;
- never claim completion without evidence;
- clearly state what was changed and what was not changed.

Advisor must not:

- merge without “можно”;
- allow agents to self-approve;
- let Codex/agents rewrite SG architecture freely;
- hide uncertainty;
- present a draft as production-ready.

## 9. Big task lifecycle

For a large task such as “create SG client under key”, the required lifecycle is:

```text
1. Monarch gives task.
2. Advisor confirms scope and risks.
3. RepoStateAgent reads project state.
4. TaskPlannerAgent creates execution plan.
5. ArchitectureGuardAgent checks boundaries.
6. SkeletonAgent creates structure first.
7. CodePatchAgent implements approved parts.
8. IntegrationAgent connects through approved interfaces.
9. TestAgent verifies checks.
10. ReviewAgent reviews full diff.
11. PRReportAgent writes PR summary.
12. Advisor reports to Monarch.
13. Monarch says “можно” or requests changes.
14. Merge only after approval.
15. Post-merge observation/checks.
```

## 10. Required PR discipline

Every coding-agents PR must include:

- purpose;
- scope;
- non-goals;
- affected files;
- architecture impact;
- tests/checks;
- known risks;
- rollback note;
- merge status.

Required merge status text:

```text
Merge status: blocked until explicit Monarch approval.
```

## 11. Required file discipline

Every new file created by coding agents must include a short `AGENT NOTE` near the top when file type allows comments or Markdown.

The note must explain:

- why the file exists;
- whether it is skeleton/config/logic/docs;
- what it must not do.

Coding agents must avoid:

- giant files;
- mixed responsibilities;
- hidden coupling;
- duplicate logic;
- temporary hacks;
- vague names;
- undocumented public interfaces.

## 12. Creation requirements for future implementation

When this specification becomes runtime logic, coding agents must be created as controlled modules, not as random prompts.

Minimum future structure:

```text
src/agentWorkspace/
  registry/
  roles/
  tasks/
  reports/
  guards/
```

Minimum required interfaces:

```text
AgentRegistry
AgentTask
AgentResult
AgentReport
AgentGuard
AgentPermissionCheck
```

Minimum required fields for an agent task:

```text
id
requestedBy
role
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

Minimum required result fields:

```text
taskId
agentRole
status
summary
filesRead
filesChanged
risks
tests
nextStep
requiresMonarchApproval
```

## 13. Permission model

Coding agents must use explicit permissions.

Example permission levels:

```text
read_repo
plan_task
create_skeleton
write_patch
run_checks
create_pr
review_pr
```

Forbidden permission by default:

```text
merge_pr
deploy_production
change_secrets
change_pillars
change_core_architecture
```

Only the Monarch may authorize high-risk permissions.

## 14. Failure behavior

If any coding agent is unsure, it must stop and report uncertainty.

If the repo state is incomplete, it must not invent missing files.

If tests are unavailable, it must say:

```text
Tests not verified: no available test execution evidence.
```

If architecture impact is unclear, it must request ArchitectureGuardAgent review.

If a task requires production secrets, deployment, payments, user data, database destructive changes, or new AI providers, it must stop until explicit Monarch approval.

## 15. Anti-chaos rules

The Coding Agents Team must not become a swarm.

There must always be one active orchestrated task context.

Agents must not work independently on the same files unless the orchestrator controls order.

Agents must not create parallel conflicting PRs for one task.

Agents must not split a task so much that the final result becomes impossible to integrate.

Large tasks may be split, but each split must have:

- a clear goal;
- a clear dependency;
- a clear acceptance check;
- a clear integration point.

## 16. Definition of done

A coding-agents task is done only when:

- planned scope is complete;
- changed files are listed;
- architecture impact is explained;
- tests/checks are reported honestly;
- risks are listed;
- PR exists if repository changes were made;
- Advisor has reviewed;
- Monarch has approved merge if merge is requested.

Without Monarch approval, the task status is:

```text
implemented in PR, not merged
```

It must not be described as deployed, live, or final.

## 17. Current status

This document is the first specification file for the Coding Agents Team.

Current implementation status:

```text
specification only
runtime agents not implemented
no autonomous execution enabled
no merge permissions granted
```
