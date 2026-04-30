# SEMANTIC_ROUTING.md — SG Semantic Routing / Minimal Controller Architecture

> This document defines how SG understands user meaning and safely maps it to capabilities, sources, tools, answers, or permitted actions.
> It applies to SG communication, commands, actions, tools, reports and agents.
> If code or prompts contradict this file, the code/prompt is wrong.

This file must be interpreted together with:

- `pillars/DECISIONS.md`
- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`
- `pillars/architecture/SG_INTERFACE_LAYERS.md`
- `pillars/architecture/HUMAN_MODE_REPOSTATEAGENT_SKELETON.md`
- `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`

Current architecture warning:

```text
Do NOT build a heavy SemanticRouter that replaces reasoning model intelligence.
```

Current safe path:

```text
reasoning model / meaning provider understands meaning
-> minimal controller checks scope, permissions, capability, source/tool needs, risk, cost, confirmation
-> SG answers or performs only the permitted action
```

---

## 0) SG entity rule

SG is the global project entity and global intellectual system.

Semantic routing is not a separate SG brain.
It is a minimal control layer around meaning understanding and action safety.

A SemanticRouter, MeaningEngine, ToolSelectionEngine, controller, external AI model, or agent must never become a separate SG identity.

Correct model:

```text
SG = global project entity / global intellectual system
reasoning model = meaning understanding tool/operator
minimal controller/gate = action protection layer
Human Mode = normal meaning-first interface of SG
Technical Mode = explicit commands/tests/debug/legacy interface of SG
```

---

## 1) Core principle

SG must not work by hardcoded words or fixed phrases as the foundation of intelligence.

Correct order:

```text
user message
→ meaning
→ intent
→ context
→ capability
→ permissions
→ source/tool selection
→ action or answer
```

Forbidden order:

```text
keyword/phrase
→ fixed reply
```

The reasoning model may understand the meaning.
The controller must only protect system actions and select safe execution paths.

---

## 1A) Human Mode / Technical Mode boundary

SG has two separated interface modes:

```text
Human Mode = normal SG conversation by meaning
Technical Mode = explicit commands/tests/debug/legacy routes
```

Do not mix them as identities.

Technical Mode may contain slash commands, exact phrases, regex routes and legacy command surfaces.

Human Mode must be built by meaning/context/capabilities/permissions/source/risk, not by copying Technical Mode phrase logic.

Current rule:

```text
old slash/word/phrase/regex logic = Technical Mode
```

Forbidden shortcut:

```text
old phrase detector
→ renamed semantic router
→ treated as Human Mode intelligence
```

---

## 1B) Universal input rule

All user input should eventually follow the same meaning-first principle.

However, implementation must respect the Human/Technical split:

- Human Mode is the clean meaning-first path.
- Technical Mode keeps explicit commands, tests, debug routes, and legacy behavior.
- A heavy Global SemanticRouter is not the goal.
- A minimal controller/gate is allowed and required for safe action selection.

Slash commands, buttons and aliases are allowed only as interface shortcuts.
They do not replace semantic validation or permission checks.

The same user meaning should eventually route to the same intent even when expressed with different wording.

---

## 1C) Human language outside, protocol inside

SG must separate external human communication from internal system communication.

External layer:

```text
user ↔ SG = simple human language
```

Internal layer:

```text
SG ↔ agents/tools/sources = structured technical protocol
```

Users must not be forced to speak in internal commands, coded phrases, system tokens or agent protocol.

SG may translate a natural user request into internal commands, agent tasks, tool calls, source queries or structured payloads, but this translation is SG's responsibility, not the user's.

Required behavior:

```text
user says naturally what they want
→ SG understands meaning
→ SG creates internal technical task if needed
→ controller checks permissions/risk/scope if action is needed
→ SG returns result in human language
```

---

## 1D) Language matching rule

SG must answer the user in the language used by the user.

If the user writes in Ukrainian, SG answers in Ukrainian.
If the user writes in Russian, SG answers in Russian.
If the user writes in English, SG answers in English.
If the user mixes languages, SG should choose the dominant language or mirror the user's style when useful.

Internal agent/tool language may be technical English or structured JSON, but user-facing output must stay in the user's language unless the user asks otherwise.

Group chat exception:
- default group languages may be Ukrainian and English
- if a guest uses another language, SG answers that guest in that language and may duplicate in Ukrainian if configured

---

## 2) Global scope

This rule applies as a principle to:

- normal chat
- commands
- project work
- repo work
- memory
- reports
- sources
- agents
- moderation
- task creation
- future UI/client interactions

But implementation must follow stage gates and controlled-action rules.

This is not only a RepoStateAgent rule.
This is a global SG behavior and architecture rule.

---

## 3) Lexical signals are weak signals only

Words, prefixes, regex, phrases and command aliases may exist only as weak diagnostic signals or Technical Mode routes.

They may help SG identify candidate intents, but they must not be the final decision engine for Human Mode.

Allowed support pattern:

```text
text contains a useful signal
→ add candidate intent
→ reasoning/context verifies meaning
→ controller checks permission/source/risk before action
```

Forbidden:

```text
text contains phrase X
→ answer Y immediately as Human Mode intelligence
```

Lexical signals must never bypass:
- permissions
- capability checks
- source/tool checks
- privacy boundaries
- risk checks
- cost checks
- confirmations for state-changing actions

---

## 4) Meaning object / structured output contract

Serious Human Mode requests may be reduced to a meaning object or structured output before action.

This is not a requirement to build a heavy Global SemanticRouter.
It is a compact data shape that helps the minimal controller decide safely.

Useful future shape:

```text
meaning = {
  domain,
  intent,
  action_type,
  target,
  context_continuity,
  required_source,
  required_tool,
  required_capability,
  permission_level,
  risk_level,
  cost_level,
  confirmation_required,
  confidence,
  uncertainty,
  missing_information
}
```

A smaller contract is preferred when enough:

```text
intentKind
confidence
reason
requiredCapability
requiresSource
requiresConfirmation
```

Rule:
- expand the structured output only when a real capability, permission, source, risk, cost, or confirmation check needs it;
- do not expand it to duplicate the reasoning model's thinking in code;
- do not turn it into a separate SG brain.

If meaning is weak or ambiguous, SG should either:
- ask one concise clarification, or
- proceed with an explicit assumption when safe.

If the action is state-changing, sensitive, private, expensive, or external, SG must request confirmation or block until allowed.

---

## 5) Source-first is mandatory

Meaning-first does not replace source-first.

Correct chain:

```text
meaning understood
→ correct source/tool selected
→ source checked
→ answer/action
```

If a source/tool can provide a more exact answer, SG must not answer from an older fallback layer.

If exact source/tool is unavailable, SG must say so.

For current repo/project truth:

```text
RepoStateAgent
-> RepoStateCollector
-> RepoStateProjectMapBuilder
-> RepoStateSemanticMapBuilder
```

Old RepoIndex / old maps / old snapshots must not be used as current factual repo truth.

---

## 6) Legacy layers

Old keyword/phrase systems must be treated as Technical Mode or fallback/support layers only.

Examples:

```text
old phrase detector → Technical Mode / legacy route
old repo index → legacy/fallback browser, not current project truth
old fixed reply → fallback human-readable explanation, not SG intelligence
```

Legacy layers must never pretend to be the main intelligence or project truth.

Legacy layers may be reused internally only when:
- their identity as Technical Mode/fallback is clear;
- they do not bypass the minimal controller;
- they do not bypass permissions or source checks;
- they do not present template output as Human Mode intelligence.

---

## 7) Project/repo rule

For Human Mode project and repo questions:

```text
natural project/repo request
→ HumanModeEntry
→ meaning/intent/context
→ permissions/scope
→ RepoStateAgent-backed facts
→ capability selection
→ response/action risk check
→ SG answer
```

Legacy snapshot may be used only for explicit Technical Mode browsing if allowed:

```text
show folder
open file
find path
preview file
```

Legacy snapshot must not be presented as:

- full project map
- semantic map
- current architecture truth
- completion status truth

---

## 8) Commands

Commands must be understood as Technical Mode or explicit UI shortcuts.

A slash command is allowed as an explicit user interface shortcut, but SG must still validate:

- user role
- permissions
- target
- required source/tool
- required capability
- risk
- expected action
- confirmation requirement

The same meaning expressed without slash command should become routable in Human Mode only after the Human Mode path is explicitly connected, gated, and verified.

---

## 9) Replies

SG replies must not be template-reflexes.

A reply must show what it is based on when relevant:

- exact source
- active context
- selected tool/agent
- limitation or uncertainty

If SG cannot verify, it must not sound certain.

If SG cannot act because action is not permitted, it may still explain, analyze, warn, or prepare a non-applied plan.

---

## 10) Implementation path

Do not delete old code blindly.

Current safe path:

1. Keep Human Mode and Technical Mode separated.
2. Keep old slash/word/phrase/regex logic in Technical Mode.
3. Build/maintain Human Mode as a meaning-first path.
4. Use reasoning model / meaning provider for meaning understanding.
5. Use minimal controller/gate for permissions, scope, capabilities, sources, risk, cost and confirmations.
6. Use RepoStateAgent facts/runner contract for repo/project truth where available.
7. Add capability selector and response builder contracts only where needed.
8. Add smoke-checks for contracts.
9. Connect runtime paths only behind explicit gates.
10. Expand the controller only when a real safety/source/permission/capability need appears.

Forbidden path:

```text
create heavy SemanticRouter as separate brain
convert old phrase routes into fake Human Mode semantic signals
connect Human Mode runtime without gate
let routing/controller bypass permissions or source checks
```

---

## 11) Test rule

For every future semantic route or Human Mode capability, test at least 3 different phrasings with the same meaning.

Example:

```text
Ты видишь репозиторий?
Ты понимаешь текущее состояние проекта?
Что сейчас реально есть в коде?
```

These must not depend on exact words.
They must route by meaning.

Current Human Mode smoke-checks may be contract checks, not full semantic routing tests.

---

## 12) Canonical formula

```text
meaning → intent → context → capability → permission → source/tool → action/answer
```

Current implementation guardrail:

```text
Reasoning model understands meaning.
Minimal controller/gate protects actions.
No heavy router as separate brain.
No phrase-bound hacks as Human Mode intelligence.
No runtime connection without explicit gate.
```
