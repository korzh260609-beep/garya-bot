# SEMANTIC_ROUTING.md — SG Semantic Routing Architecture

> This document defines the semantic routing principle for SG.
> It applies to SG communication, commands, actions, tools, reports and agents.
> If code or prompts contradict this file, the code/prompt is wrong.

This file must be interpreted together with:

- `pillars/SG_ENTITY.md`
- `pillars/SG_BEHAVIOR.md`
- `pillars/PROJECT.md`
- `pillars/DECISIONS.md`
- `pillars/architecture/SG_INTERFACE_LAYERS.md`
- `pillars/architecture/HUMAN_MODE_REPOSTATEAGENT_SKELETON.md`
- `pillars/architecture/REPO_MAP_SOURCE_POLICY.md`

Current stage warning:

```text
Do NOT build a global SemanticRouter yet.
```

Current safe path:

```text
Human Mode skeleton
-> gated meaning provider contract
-> gated RepoStateAgent facts contract
-> capability selection
-> response builder
```

---

## 0) SG entity rule

SG is the global project entity.

Semantic routing is an intelligence/routing capability of SG.
It is not SG itself.

A SemanticRouter, MeaningEngine, ToolSelectionEngine, external AI model, or agent must never become a separate SG identity.

Correct model:

```text
SG = global project entity
semantic routing = future routing capability/component of SG
Human Mode = current meaning-first interface skeleton
Technical Mode = explicit commands/tests/debug/legacy interface
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
→ permissions
→ source/tool selection
→ action or answer
```

Forbidden order:

```text
keyword/phrase
→ fixed reply
```

---

## 1A) Human Mode / Technical Mode boundary

SG has two separated interface modes:

```text
Human Mode = normal SG conversation by meaning
Technical Mode = explicit commands/tests/debug/legacy routes
```

Do not mix them.

Technical Mode may contain slash commands, exact phrases, regex routes and legacy command surfaces.

Human Mode must be built by meaning/context/permissions/capabilities, not by copying Technical Mode phrase logic.

Current rule:

```text
old slash/word/phrase/regex logic = Technical Mode
```

Forbidden current-stage shortcut:

```text
old phrase detector
→ renamed semantic router
→ treated as Human Mode intelligence
```

---

## 1B) Universal input rule

All user input should eventually follow the same meaning-first principle.

However, current implementation must respect the Human/Technical split:

- Human Mode is being built separately as a clean meaning-first path.
- Technical Mode keeps explicit commands, tests, debug routes, and legacy behavior.
- A global SemanticRouter is future architecture, not the current implementation step.

Slash commands, buttons and aliases are allowed only as interface shortcuts.
They do not replace semantic validation.

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

But implementation must follow stage gates.

This is not only a RepoStateAgent rule.
This is a global SG behavior and architecture rule.

---

## 3) Lexical signals are weak signals only

Words, prefixes, regex, phrases and command aliases may exist only as weak diagnostic signals or Technical Mode routes.

They may help SG guess candidates in future semantic layers, but they must not be the final decision engine for Human Mode.

Allowed future semantic pattern:

```text
text contains a useful signal
→ add candidate intent
→ verify with context/source/tool
```

Forbidden:

```text
text contains phrase X
→ answer Y immediately as Human Mode intelligence
```

---

## 4) Meaning object contract

Every serious Human Mode request should eventually be reduced to a meaning object before action.

Minimum future shape:

```text
meaning = {
  domain,
  intent,
  action_type,
  target,
  context_continuity,
  required_source,
  required_tool,
  permission_level,
  confidence,
  uncertainty,
  missing_information
}
```

Current Human Mode skeleton uses a narrower safe contract:

```text
intentKind
confidence
reason
```

This current contract must not be expanded into a global SemanticRouter until explicitly approved.

If meaning is weak or ambiguous, SG should either:
- ask one concise clarification, or
- proceed with an explicit assumption when safe.

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

---

## 7) Project/repo rule

For Human Mode project and repo questions:

```text
natural project/repo request
→ HumanModeEntry
→ permissions
→ meaning
→ RepoStateAgent-backed facts
→ capability selection
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
- risk
- expected action

The same meaning expressed without slash command should become routable in Human Mode only after the Human Mode path is explicitly connected and verified.

---

## 9) Replies

SG replies must not be template-reflexes.

A reply must show what it is based on when relevant:

- exact source
- active context
- selected tool/agent
- limitation or uncertainty

If SG cannot verify, it must not sound certain.

---

## 10) Implementation path

Do not delete old code blindly.

Current safe path:

1. Keep Human Mode and Technical Mode separated.
2. Keep old slash/word/phrase/regex logic in Technical Mode.
3. Build Human Mode skeleton separately.
4. Add gated meaning provider contract.
5. Add gated RepoStateAgent facts/runner contract.
6. Add capability selector and response builder contracts.
7. Add smoke-checks for contracts.
8. Only later connect HumanModeEntry behind explicit runtime gate.
9. Only after that consider broader semantic routing architecture.
10. Build global SemanticRouter only after explicit Monarch approval and accepted architecture update.

Forbidden current path:

```text
create global SemanticRouter now
convert old phrase routes into weak Human Mode semantic signals now
connect Human Mode runtime without gate
```

---

## 11) Test rule

For every future semantic route, test at least 3 different phrasings with the same meaning.

Example:

```text
Ты видишь репозиторий?
Ты понимаешь текущее состояние проекта?
Что сейчас реально есть в коде?
```

These must not depend on exact words.
They must route by meaning.

Current Human Mode smoke-checks are contract checks, not full semantic routing tests.

---

## 12) Canonical formula

```text
meaning → logic → context → source/tool → verified answer/action
```

Current implementation guardrail:

```text
Human Mode skeleton first.
Global SemanticRouter later.
No phrase-bound hacks.
No runtime connection without explicit gate.
```
