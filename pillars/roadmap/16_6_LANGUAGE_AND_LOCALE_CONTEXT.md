# Block 16.6 — Language & Locale Context

## Status

Planned. This block is the next architecture/runtime-context block after completed Block 16.5 Temporal Context and before Block 17 Render Deployment.

## Goal

Give SG one transport-independent multilingual interaction layer so users can communicate naturally in any language the connected AI model can understand, without separate SG versions, command-based language switching, transport-specific language logic or mandatory pre-translation.

The user message must remain the semantic source of truth. Language detection and response-language policy enrich the canonical context; they do not replace Semantic Kernel interpretation.

## 16.6.1 — Language Detection

Determine the language of each incoming natural-language message and produce a bounded result such as:

- `message_language`;
- `confidence`;
- detection source/evidence;
- `und` when the language cannot be determined reliably.

Language detection must not depend on fixed command names, keywords or a closed list of business languages.

## 16.6.2 — Language Context

Introduce one canonical Language Context available to the SG runtime. It must distinguish at minimum:

- `message_language`;
- `preferred_language`;
- `conversation_language`;
- `platform_locale`;
- `response_language`;
- `confidence`;
- language-selection source/provenance.

Language Context is runtime context, not identity, authorization, capability selection or transport business logic.

## 16.6.3 — Preferred Language

Persist a user's preferred language through the existing global identity/user-settings boundary using `global_user_id`.

Requirements:

- preference is transport-independent;
- Telegram, Discord, Web/API, Email, Voice and future transports resolve the same user preference after identity linking;
- preference changes retain provenance where useful;
- no transport-specific duplicate user-language profile is authoritative.

## 16.6.4 — Automatic Response Language

Select the response language using deterministic policy and explicit context. Default priority:

1. explicit user instruction for the current response;
2. confidently detected language of the current message;
3. current conversation language;
4. stored preferred language;
5. platform locale;
6. bounded system fallback.

The policy must remain replaceable/configurable without moving language ownership into an AI provider or transport adapter.

## 16.6.5 — Dynamic Language Switching

Users may change language naturally during a conversation without commands or settings screens.

Examples:

- Russian message → Russian response;
- next Ukrainian message → Ukrainian response;
- explicit `Now answer in English` → English response.

A language change in one message must not corrupt durable identity, permissions, memory scopes or unrelated conversations.

## 16.6.6 — Mixed-Language Input

Support messages containing multiple languages, code, product names, proper nouns and technical terminology.

Examples such as `Проверь deployment status моего проекта` must not automatically be treated as a switch to English merely because English technical tokens are present.

Mixed-language handling must preserve the original text for semantic interpretation.

## 16.6.7 — Semantic Preservation

Do not require automatic translation of normal incoming messages before Semantic Kernel.

Required conceptual path:

`Original Message → Language Detection/Context → CanonicalInput → Semantic Kernel → Decision Engine → Capability/AI execution → Response Language Policy → User`

The original text remains available to Meaning Interpretation. Translation is optional capability work, not a mandatory semantic gateway.

## 16.6.8 — Translation Capability Boundary

Explicit translation requests may use a dedicated translation capability or specialized model path through AI Router.

Rules:

- explicit translation is distinct from ordinary multilingual conversation;
- no direct model calls outside AI Router;
- translation must not silently mutate stored source text;
- translation failures remain visible and bounded;
- translated text must not be treated as stronger evidence than the original source.

## 16.6.9 — Transport Integration

Telegram, Discord, Web/API, Email, Voice and future adapters may provide platform locale/language hints, but they must not own final language policy.

Transport responsibilities remain limited to platform facts and delivery.

SG Core resolves Language Context after transport normalization and global identity resolution.

## 16.6.10 — Memory Integration

Memory must remain semantically usable across languages.

A fact stored from one language must be retrievable when the same user asks about it in another language, subject to the existing memory scopes, trust, provenance and privacy rules.

Language must not create isolated duplicate memory silos for the same `global_user_id` unless a future explicitly approved memory policy requires that behavior.

## 16.6.11 — Group Context

Language is resolved per participant/message, not globally from the last message in a group.

Requirements:

- different users in one group may communicate with SG in different languages;
- personal language preference remains attached to global identity;
- group/thread context isolation remains unchanged;
- an optional group default language may exist only as fallback and must not override an explicit or confidently detected user language.

## 16.6.12 — Locale

Language and locale are related but separate.

Examples:

- language: `en`, locale: `en-US` or `en-GB`;
- language: `uk`, locale: `uk-UA`;
- language: `de`, locale: `de-DE`.

Locale may influence presentation of dates, time, numbers, currency, units and similar user-facing formatting.

Locale integration must reuse Block 16.5 Temporal Context for timezone/date/time semantics rather than creating competing temporal logic.

## 16.6.13 — Unknown Language / Low Confidence

When language cannot be determined reliably:

- use `message_language: und` or equivalent bounded state;
- do not invent a precise language;
- resolve response language through conversation/preference/platform/fallback policy;
- request clarification only when language ambiguity materially prevents a safe or useful answer.

## 16.6.14 — AI Router Integration

AI calls may receive language context metadata such as:

- `message_language`;
- `response_language`;
- `locale`.

AI Router does not become the owner of response-language policy. SG selects the intended language; the routed AI model executes within that instruction.

This preserves the rule: SG owns decisions and policy; connected AI executes controlled reasoning/specialized work.

## 16.6.15 — Observability

Record bounded language evidence sufficient for diagnosis, including at minimum:

- detected language;
- confidence;
- selected response language;
- language-selection source;
- locale when available;
- language-detection or response-language failures.

Logs must remain privacy-bounded and must not duplicate full message content merely for language telemetry.

## 16.6.16 — Required Tests

Automated coverage must include at minimum:

- Russian input/response;
- Ukrainian input/response;
- English input/response;
- Polish input/response;
- German input/response;
- another language supported by the connected model;
- natural language switching within one conversation;
- explicit response-language request;
- mixed-language technical text;
- short ambiguous input such as `OK`;
- emoji-only or nearly language-free input;
- unknown/low-confidence language fallback;
- multiple users in one group using different languages;
- one `global_user_id` across Telegram and Discord retaining preferred language;
- memory written in one language and recalled semantically from another;
- locale passed independently from language;
- Temporal Context interoperability;
- AI Router metadata propagation;
- observability evidence without sensitive-message duplication.

## Architecture and Safety Boundaries

- No separate SG instance/version per language.
- No required `/language_*` commands or phrase-based routing.
- No transport owns final language policy.
- No language subsystem assigns identity, roles, grants or permissions.
- No language subsystem bypasses Semantic Kernel, Decision Engine or Action Gate.
- Ordinary multilingual input is not forcibly translated before Semantic Kernel.
- AI providers do not become the authoritative language-policy owner.
- Existing user/project/group/thread memory and scope isolation remains unchanged.
- Language and locale must not silently override Temporal Context timezone semantics.

## Acceptance Criteria

- SG can receive ordinary natural-language input in multiple languages through the same runtime and architecture.
- SG selects and returns the appropriate response language without requiring language commands.
- Users can switch languages naturally during an ongoing conversation.
- Mixed-language technical text does not cause uncontrolled language switching.
- Preferred language is resolved through `global_user_id` and works across linked transports.
- Group participants may use different languages without cross-user contamination.
- Memory remains semantically reusable across supported languages while preserving existing scope and trust rules.
- Locale is represented separately from language and interoperates with Temporal Context.
- Original user text reaches semantic interpretation without mandatory translation.
- Every AI call still follows AI Router rules.
- Language decisions are observable and diagnostically explainable.
- All Block 16.6 tests pass in CI.

## Completion Evidence

When implemented, completion evidence must include code, tests, documentation, successful CI and runtime/E2E proof. Until that evidence exists, Block 16.6 must remain marked planned/in progress rather than completed.
