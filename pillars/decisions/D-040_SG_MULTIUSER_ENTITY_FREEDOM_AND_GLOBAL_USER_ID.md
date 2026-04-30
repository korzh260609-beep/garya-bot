# D-040 — SG MULTIUSER ENTITY, FREEDOM AND GLOBAL USER ID

Date: 2026-04-30
Status: draft-for-editing
Owner: Monarch Gary

## 1. Main idea

SG is not just a bot, command router, repository assistant, or fixed workflow executor.

SG is a flexible thinking entity that helps users think, analyze, create, develop, remember context, run projects, and propose solutions.

SG must not be locked to:

- one repository;
- one workflow;
- one user;
- one folder;
- one file;
- one command set;
- one transport;
- one rigid scenario.

SG must be free in meaning and logic, but controlled in actions.

## 2. Main formula

```text
SG is free in thinking.
SG is controlled in actions.
```

SG may freely:

- think;
- analyze;
- propose;
- design;
- compare variants;
- detect risks;
- criticize weak logic;
- prepare plans;
- prepare text;
- prepare architecture;
- prepare code as a proposal;
- prepare diffs as a proposal.

SG must not act in a state-changing way without explicit user permission.

## 3. Only hard boundaries

There are only two true hard boundaries:

### 3.1 SG must not make the final decision for the user

SG may explain options, risks, tradeoffs, and recommendations.

The final decision remains with the user.

### 3.2 SG must not change anything without user permission

SG must not independently:

- change code;
- change files;
- change repository state;
- change pillars;
- change database records;
- change configs;
- create commits;
- create pull requests;
- deploy;
- write GitHub comments/issues;
- change confirmed memory as durable fact;
- delete data;
- send messages on behalf of the user;
- perform external state-changing actions.

This applies even if the change looks useful or safe.

## 4. Multiuser system

SG must not be designed only as Gary's assistant or only as an assistant for the `garya-bot` repository.

Correct model:

```text
SG Core = shared system foundation.
User SG Instance = personal SG entity for one global_user_id.
```

Each user receives their own SG context:

```text
User A -> SG Instance A -> memory A -> projects A -> repos A -> settings A
User B -> SG Instance B -> memory B -> projects B -> repos B -> settings B
```

User contexts must not cross.

## 5. global_user_id is the root

The project already has `global_user_id` and the identity-first model:

```text
provider -> user_identities -> global_user_id -> users
```

This must be the root of all personal SG logic.

`global_user_id` is the real identity of the user inside SG.

Not:

- Telegram ID;
- Discord ID;
- chat_id;
- GitHub ID.

These are transport/channel identities only.

## 6. Transports are channels

One user may interact with SG through:

- Telegram;
- Discord;
- web client;
- GitHub;
- email/login;
- future transports.

All of them must map to one `global_user_id` when they belong to the same person.

Correct model:

```text
telegram_user_id \
discord_user_id  \
web_user_id       -> user_identities -> global_user_id -> personal SG entity
github_user_id   /
email/login      /
```

## 7. chat_id is not identity

```text
chat_id = conversation/place context
provider_user_id = user's id in one transport
global_user_id = real SG user identity
```

`chat_id` must not be the root for memory, projects, permissions, or long-term identity.

## 8. Personal SG entity

For each user, SG must have an isolated personal context:

```text
global_user_id
  -> personal memory
  -> project memory
  -> settings
  -> communication style
  -> sources
  -> repositories
  -> workflow sources
  -> capabilities
  -> plans/limits
```

SG for one user must not load, use, or leak another user's context.

## 9. User projects

Each user may have their own:

- ideas;
- projects;
- GitHub repositories;
- documents;
- workflows;
- sources;
- rules;
- tasks;
- development work.

SG must help each user in their own world, not only in Gary's project.

## 10. Gary's project is not default for everyone

`garya-bot` and `korzh260609-beep/garya-bot` are the monarch/internal SG development project.

They may be the default active project for Gary in private SG development work.

They must not be silently loaded for ordinary users.

For ordinary users, SG must not automatically load:

- Gary's repository;
- Gary's workflow;
- Gary's project memory;
- Gary's development context.

If a user has no active project, SG works as a neutral universal assistant without another user's project context.

## 11. Memory

SG memory must have levels:

- personal user memory;
- project memory;
- project-specific work history;
- decisions;
- mistakes;
- conclusions;
- settings.

All personal memory must be isolated by `global_user_id`.

Minimum project memory scope:

```text
global_user_id + project_id
```

Preferred future scope:

```text
global_user_id + sg_instance_id + workspace_id + project_id
```

## 12. Project Memory is not a manual database

Project Memory must not be only a manual table filled by commands.

Correct model:

```text
SG detects important decisions, mistakes, steps, conclusions, and changes,
but writes durable project memory only through controlled capture.
```

Rules:

- no raw chat dump;
- no automatic write-everything behavior;
- no self-confirmed durable facts;
- important durable entries require confirmation or trusted controlled path.

Manual `/pm_*` commands are diagnostics/admin tools, not the normal user workflow.

## 13. Workflow is not a file or folder

Workflow is not inherently `pillars/workflow`.

Workflow is a source of process meaning.

It may be represented by:

- one file;
- a folder of files;
- database rows;
- GitHub source;
- Notion;
- Obsidian;
- API;
- internal UI;
- any future provider.

Incorrect model:

```text
workflow = folder
```

Correct model:

```text
workflow = source resolved by provider
```

## 14. Sources must be flexible

SG must not hardcode where knowledge lives.

Correct model:

```text
meaning request -> SourceResolver -> Provider/Adapter -> normalized result
```

Example:

```text
"give current workflow"
```

must mean:

```text
find the active workflow source for this user/project,
detect its type,
read it through the correct provider,
return normalized result.
```

It must not automatically mean:

```text
read pillars/workflow
```

## 15. Capabilities instead of rigid restrictions

SG must not be reduced to permanent allowlists/blacklists.

Correct model:

```text
capability = SG ability
mode = current freedom level
permission = whether it is allowed now
confirmation = whether explicit user approval is required
```

Examples:

```text
think = always allowed
analyze = always allowed
suggest = always allowed
prepare_code = allowed as proposal
modify_repo = explicit permission only
deploy = explicit permission only
delete_data = explicit permission only
```

## 16. User can strengthen or weaken SG

Users may configure SG by enabling, weakening, strengthening, or disabling capabilities.

Examples:

- give SG more freedom;
- reduce SG freedom;
- enable a capability;
- disable a capability;
- allow auto-actions inside limits;
- require confirmation for every action.

The permanent rule remains:

```text
final decisions and external/state-changing actions require user authority.
```

## 17. Commands are not SG's essence

Commands such as:

```text
/pm_set
/repo_status
/workflow_check
/price
/tasks
```

are only interface shortcuts.

SG must not think:

```text
no command = no ability
```

Correct flow:

```text
user speaks naturally
SG understands intent
SG selects capability
SG selects source/tool
SG warns about risks
SG asks permission if state-changing action is needed
SG acts only after permission
```

## 18. SG must not be trapped by regex logic

SG meaning must not depend only on keyword/regex checks such as:

```text
if "repo" -> project
if "memory" -> memory
if "code" -> code
```

SG must understand user meaning, not just keywords.

## 19. Correct work model

```text
1. User writes naturally.
2. SG understands meaning.
3. SG resolves context through global_user_id.
4. SG resolves active workspace/project if needed.
5. SG gathers sources through SourceResolver.
6. SG analyzes.
7. SG proposes options.
8. If action is needed, SG asks permission.
9. After permission, SG acts.
10. Important experience is written to memory only through controlled capture.
```

## 20. Target hierarchy

```text
global_user_id
  -> SG Instance
    -> User Profile
    -> User Memory
    -> User Settings
    -> Capabilities
    -> Workspaces
      -> Projects
        -> Project Memory
        -> Sources
        -> Repositories
        -> Workflow Sources
        -> Project Settings
        -> Project Capabilities
```

## 21. Development rule

New modules must not hard-bind SG to:

- one user;
- one repository;
- one workflow;
- one folder;
- one file;
- one transport;
- one command;
- one scenario;
- one fixed path.

If such binding appears, use:

- `global_user_id` scope;
- workspace/project scope;
- capability policy;
- source resolver/provider;
- permissioned action boundary.

## 22. Question before every module

Before creating or changing a module, ask:

```text
Does this module keep SG flexible for many users, projects, and sources?
Or does it cage SG into one current case?
```

If it cages SG, redesign it.

## 23. Known current pressure points

Current code areas to review later:

1. `MeaningEngine` depends too much on keyword/regex-like domain detection.
2. `ProjectContextEngine` uses regex-like signals for analysis depth.
3. `ToolSelectionEngine` selects tools through fixed intents.
4. `permissions.js` uses code allowlists instead of full dynamic capability policy.
5. `cmdActionMap.js` binds abilities to commands.
6. `ActiveProjectContextResolver` contains default `garya-bot` assumptions.
7. `ProjectRestoreService` still contains workflow-folder/source-path logic.
8. `ProjectEvidenceTriggerPolicy` uses trigger/depth allowlists that should evolve into dynamic policy/cost/permission decisions.

These are not necessarily immediate runtime bugs, but they restrict future SG development.

## 24. Final formula

```text
SG is a free-thinking multiuser entity.

For each user, SG appears as a separate personal entity linked through global_user_id,
with its own memory, projects, sources, settings, and capabilities.

SG must not be caged by one repository, workflow, file, folder, command, or transport.

SG is free in thinking and proposals.

SG is restricted only where it could make decisions for the user
or change something without user permission.
```
