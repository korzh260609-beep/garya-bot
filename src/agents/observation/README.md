# SG Observation Agents Block

## Purpose

This folder describes the future SG Observation Agents block.

The goal is not to create a mirror chat for an external assistant. The goal is to give SG its own simple observation system so SG can understand its own work, detect failures, and support future self-diagnostics.

External operators, including the Advisor in ChatGPT, may read sanitized reports from this block, but the data is created for SG first.

## Core principle

Observation agents must be simple, narrow, and functional.

```text
1 agent = 1 responsibility
```

They must not become large autonomous systems at the first stage.

V1 agents observe, summarize, and report. They do not change code, modify infrastructure, restart services, alter Render env, or mutate GitHub settings.

## Why this block exists

SG will work across multiple transports and tools:

- Telegram now;
- future web client;
- future API/client interfaces;
- future external AI operators;
- future repository-working agents.

Without an observation layer, SG cannot reliably understand what happened in its own system. Screenshots from the Monarch are useful for humans, but they are not a scalable architecture.

This block is the beginning of SG self-awareness in a practical engineering sense:

```text
transport events -> sanitized observations -> observer agents -> runtime reports -> SG diagnostics / future memory
```

## What this block is not

This block is not:

- the old advisor outbox mirror experiment;
- a Telegram-only feature;
- a repo-folder chat mechanism;
- a second SG identity;
- an uncontrolled autonomous agent system;
- a way for guests to access Monarch private data;
- a direct code-changing system.

## Initial observer agents

### 1. Transport Observer Agent

Responsibility: observe transport-level events.

Sees:

- inbound user messages;
- outbound SG replies;
- delivery errors;
- fallback replies;
- transport name;
- sanitized chat/user identifiers;
- language metadata when available.

Does not:

- decide business logic;
- call AI by itself;
- change transport behavior;
- store raw secrets;
- expose full private identifiers.

### 2. Tool Observer Agent

Responsibility: observe tool usage.

Sees:

- tool name;
- tool success/failure;
- error code/message after sanitization;
- duration if available;
- whether finalText fallback was used;
- whether the tool was read-only or requested write approval.

Does not:

- execute tools by itself;
- approve writes;
- expose tokens or env values;
- retry dangerous actions automatically.

### 3. Runtime Observer Agent

Responsibility: observe infrastructure and runtime state.

Sees:

- Render status snapshots;
- Render logs summaries;
- GitHub Actions status;
- repo registry status;
- latest commit state;
- diagnostics results.

Does not:

- deploy;
- restart Render;
- edit Render env;
- change GitHub settings;
- mutate source code.

### 4. Conversation Audit Agent

Responsibility: check response quality and rule compliance.

Checks:

- did SG answer the actual user request;
- did SG answer in the correct language;
- did SG use the right tool when needed;
- did SG avoid empty output;
- did SG avoid leaking secrets;
- did SG respect role/access rules.

Does not:

- replace the main AI layer;
- argue with users;
- rewrite answers live in V1;
- store unnecessary personal details.

### 5. Supervisor Agent

Responsibility: combine observations from other observer agents.

V1 behavior:

- reads summarized observations;
- finds repeated failures;
- proposes next safe steps;
- reports to the Monarch;
- can produce diagnostics recommendations.

Does not:

- change production code;
- merge PRs;
- deploy;
- edit config;
- override Monarch authority.

The Supervisor Agent is a coordinator, not a ruler.

## Data rules

Allowed in V1:

- sanitized message snippets for the Monarch's own interactions;
- hashed or redacted user/chat identifiers;
- transport name;
- direction: inbound/outbound;
- tool names;
- success/failure;
- sanitized errors;
- timestamps;
- report paths;
- short summaries.

Forbidden in V1:

- raw Telegram bot token;
- env secret values;
- private keys;
- full raw user IDs for general storage;
- full raw chat IDs for general storage;
- private conversations of guests unless an explicit future policy allows it;
- unfiltered attachments;
- full personal memory dumps;
- credentials of any external service.

## Privacy and roles

V1 starts with the Monarch only.

Guest/citizen observation requires a separate policy before implementation.

Group chats must not be treated as one single private conversation. Personal memory and group memory must stay separated.

## Relationship to SG memory

Observation data is not automatically long-term memory.

Flow must be:

```text
raw event -> sanitized observation -> short report -> optional memory candidate -> policy approval -> memory write
```

The observation layer collects facts. Memory decides what is worth keeping.

## Relationship to diagnostics

SG Diagnostics V1 checks system state on demand.

Observation Agents should provide continuous or event-based facts that diagnostics can use later.

Diagnostics answers the question:

```text
What is broken now?
```

Observation answers:

```text
What happened before, during, and after the problem?
```

## Relationship to external AI operators

External AI operators may work with the repository in the future.

This block helps them understand:

- what SG is;
- which agents exist;
- what each agent may do;
- what each agent must not do;
- what data is safe to read;
- what data is forbidden.

External operators must not treat SG as a set of random scripts. SG is the whole project/system.

## Implementation path

### Stage 1 — documentation skeleton

Create this block and define responsibilities.

No runtime behavior changes.

### Stage 2 — event schema

Define a minimal sanitized observation event format.

No Telegram coupling yet.

### Stage 3 — writer/reader boundary

Create a narrow writer/reader for observation reports.

Writes only to allowed runtime paths.

### Stage 4 — Telegram V1 integration

Record Monarch-only inbound/outbound message summaries.

No guest/citizen transcript storage yet.

### Stage 5 — tool observation

Record tool call summaries and sanitized errors.

### Stage 6 — diagnostics integration

Let SG Diagnostics read observation summaries when investigating issues.

### Stage 7 — future supervisor reports

Generate compact reports for the Monarch and for future SG self-diagnostics.

## Hard boundaries

Observer agents must stay simple.

They must not become hidden decision-makers.

They must not change the architecture without Monarch approval.

They must not bypass the rule:

```text
skeleton -> config -> logic
```

They must not bypass PR workflow.

They must not touch `main` directly.

## Current status

Status: documentation skeleton only.

No code behavior is implemented by this document.
