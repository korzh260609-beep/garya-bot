# SEMANTIC_ROUTING.md — SG Semantic Routing Architecture

> This document defines the global semantic routing rule for SG.
> It applies to all SG communication, commands, actions, tools, reports and agents.
> If code or prompts contradict this file, the code/prompt is wrong.

---

## 1) Core principle

SG must not work by hardcoded words or fixed phrases.

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

## 1A) Universal input rule

All user input must pass through the same meaning-first principle.

There must not be two different SG personalities:

```text
normal chat = semantic conversation
commands/actions = phrase-bound robot
```

Forbidden split:

```text
casual chat understands meaning,
but commands, repo work, memory, agents or reports depend on exact wording.
```

Required unified behavior:

```text
any input from user
→ understand meaning
→ check context
→ check role/permissions
→ select source/tool/action
→ answer or execute safely
```

Slash commands, buttons and aliases are allowed only as interface shortcuts.
They do not replace semantic validation.

The same user meaning should route to the same intent even when expressed with different wording.

---

## 1B) Human language outside, protocol inside

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

## 1C) Language matching rule

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

This rule applies to:

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

This is not only a RepoStateAgent rule.
This is a global SG behavior and architecture rule.

---

## 3) Lexical signals are weak signals only

Words, prefixes, regex, phrases and command aliases may exist only as weak diagnostic signals.

They may help SG guess candidates, but they must not be the final decision engine.

Allowed:

```text
text contains a useful signal
→ add candidate intent
→ verify with context/source/tool
```

Forbidden:

```text
text contains phrase X
→ answer Y immediately
```

---

## 4) Meaning object contract

Every serious request should be reduced to a meaning object before action.

Minimum shape:

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

---

## 6) Legacy layers

Old keyword/phrase systems must be adapted into fallback layers only.

Examples:

```text
old phrase detector → LexicalSignalExtractor
old repo index → LegacySnapshotBrowser
old fixed reply → fallback human-readable explanation
```

Legacy layers must never pretend to be the main intelligence or project truth.

---

## 7) Project/repo rule

For project and repo questions:

```text
repo/project-state question
→ RepoStateAgent or ProjectMap/SemanticMap agent
→ exact answer
```

Legacy snapshot may be used only for quick browsing:

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

Commands must not be rigid phrases only.

A slash command is allowed as an explicit user interface shortcut, but SG must still validate:

- user role
- permissions
- target
- required source/tool
- risk
- expected action

The same meaning expressed without slash command should be routable when safe.

---

## 9) Replies

SG replies must not be template-reflexes.

A reply must show what it is based on:

- exact source
- active context
- selected tool/agent
- limitation or uncertainty

If SG cannot verify, it must not sound certain.

---

## 10) Implementation path

Do not delete old code blindly.

Correct migration path:

1. Create SemanticRouter skeleton.
2. Add MeaningEngineV2 contract.
3. Add ToolSelectionEngineV2 contract.
4. Convert hardcoded phrase logic into weak signal extraction.
5. Route exact questions to exact agents/sources.
6. Add tests with different wording but same meaning.

---

## 11) Test rule

For every semantic route, test at least 3 different phrasings with the same meaning.

Example:

```text
Ты видишь репозиторий?
Ты понимаешь текущее состояние проекта?
Что сейчас реально есть в коде?
```

These must not depend on exact words.
They must route by meaning.

---

## 12) Canonical formula

```text
meaning → logic → context → source/tool → verified answer/action
```
