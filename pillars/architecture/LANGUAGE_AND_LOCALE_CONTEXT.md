# SG 2.1 — LANGUAGE AND LOCALE CONTEXT

## Purpose

Language & Locale Context is a shared SG runtime-context subsystem for multilingual interaction across Telegram, Discord, Web/API, Email, Voice and future transports.

It enriches canonical user context with language and locale facts without becoming a second semantic engine, identity system, permission layer or transport-specific policy.

## Core responsibilities

The subsystem owns:

- per-message language detection;
- preferred language lookup through `global_user_id`;
- conversation language state;
- response-language resolution;
- platform locale normalization;
- low-confidence/unknown-language handling;
- language metadata for AI Router and observability;
- integration boundaries for cross-language memory retrieval and explicit translation.

## Canonical Language Context

The normalized context must be able to represent at minimum:

- `message_language`;
- `preferred_language`;
- `conversation_language`;
- `platform_locale`;
- `response_language`;
- `confidence`;
- provenance/source for the selected language and locale.

Language and locale are separate concepts. Example: `en` is a language; `en-US` and `en-GB` are locales.

## Processing boundary

Conceptual flow:

```text
Platform Input
→ Transport Adapter
→ Platform Facts
→ Identity and Scope Resolution
→ Language & Locale Context
→ CanonicalInput / Semantic Kernel
→ Decision and Action boundaries
→ Capability / AI execution
→ Response Language Policy
→ Transport Delivery
```

The original user text remains available to Semantic Kernel. Ordinary multilingual conversation does not require translation before semantic interpretation.

## Response-language policy

Default policy priority:

1. explicit user request for the current response;
2. confidently detected language of the current message;
3. current conversation language;
4. stored preferred language;
5. platform locale;
6. bounded system fallback.

The policy is SG-owned and replaceable/configurable. AI providers and transport adapters do not become authoritative owners of this decision.

## Identity boundary

Preferred language belongs to the global user context, not a platform-local account.

After identity linking, the same `global_user_id` may retain one preferred-language setting across Telegram, Discord, Web/API, Email, Voice and later interfaces.

The language subsystem cannot assign or modify identity, roles, grants, authentication level or scope.

## Transport boundary

Transports may supply:

- platform locale;
- platform language hint;
- original input text;
- channel-specific metadata.

Transports must not:

- force a final response language;
- maintain an authoritative duplicate preferred-language profile;
- perform command/keyword language routing;
- translate every incoming message before SG Core;
- alter identity, grants or semantic intent because of language.

## Semantic boundary

Language detection is context enrichment, not meaning interpretation.

The Semantic Kernel receives the original text plus bounded language context. It remains responsible for semantic interpretation through the approved MeaningInterpreter boundary.

Mixed-language input, code, proper nouns and technical terms must not be reduced to transport-level keyword logic.

## AI Router boundary

AI calls may receive:

- message language;
- response language;
- locale;
- explicit translation target when applicable.

Every production model call still passes through AI Router. AI Router selects a model/provider under existing policy; it does not own user-language preference or response-language policy.

## Translation boundary

Explicit translation is optional capability work and is distinct from ordinary multilingual conversation.

Translation must:

- pass through the existing Capability/AI Router architecture;
- preserve the original text and provenance;
- fail visibly when unavailable;
- never silently replace source evidence or authoritative stored content.

## Memory boundary

Memory scope, trust and provenance rules remain unchanged.

Language must not create independent memory silos for the same user. Semantic recall should be able to retrieve relevant stored facts across languages when the underlying retrieval capability supports it.

Cross-language retrieval does not relax user/project/group/thread isolation.

## Group behavior

Language is resolved per participant/message.

One user's language must not become the authoritative language of another user in the same group. A group default may exist only as a bounded fallback.

## Locale and Temporal Context

Locale may affect presentation such as:

- date formatting;
- time formatting;
- numbers;
- currency display;
- units and other regional conventions.

Timezone, relative-date arithmetic and scheduling remain owned by Block 16.5 Temporal Context. Language & Locale Context must consume/reuse Temporal Context rather than implement competing time logic.

## Observability

Language observability may record bounded metadata such as:

- detected language;
- confidence;
- selected response language;
- selection source;
- locale;
- detection/policy failure class.

Observability must not duplicate full private messages solely for language telemetry.

## Non-negotiable boundaries

- One SG Core, not separate SG variants per language.
- Natural language remains primary; no required language commands.
- Original text remains available to Semantic Kernel.
- No mandatory pre-translation for normal conversation.
- No transport-owned language business logic.
- No AI-provider-owned language policy.
- No language-based identity, role or permission mutation.
- No bypass of Decision Engine, Action Gate or Capability System.
- No weakening of memory scope isolation.
- Locale does not replace timezone.

## Roadmap reference

Implementation scope, tests and acceptance criteria are defined by `pillars/roadmap/16_6_LANGUAGE_AND_LOCALE_CONTEXT.md`.
