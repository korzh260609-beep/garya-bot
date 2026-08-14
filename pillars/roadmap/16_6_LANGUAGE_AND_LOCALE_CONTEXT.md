# Block 16.6 — Language & Locale Context

## Status

Completed. Implemented in the shared SG runtime after Block 16.5 Temporal Context and before Block 17 Render Deployment.

## Goal

Give SG one transport-independent multilingual interaction layer so users can communicate naturally in any language the connected AI model can understand, without separate SG versions, command-based language switching, transport-specific language logic or mandatory pre-translation.

The user message remains the semantic source of truth. Language detection and response-language policy enrich canonical context; they do not replace Semantic Kernel interpretation.

## 16.6.1 — Language Detection

Implemented as a bounded fast-path detector plus controlled AI fallback:

- Unicode-script detection for strongly identifiable scripts;
- lexical/script markers for common Latin and Cyrillic languages;
- `message_language`, confidence and detection source;
- `und` when deterministic evidence is insufficient;
- low-confidence fallback through the existing AI Router only when production AI is enabled;
- no direct AI-provider calls and no business-intent keyword routing.

## 16.6.2 — Language Context

The runtime resolves one canonical Language Context containing:

- `messageLanguage`;
- `preferredLanguage`;
- `conversationLanguage`;
- `platformLocale`;
- `locale`;
- `responseLanguage`;
- `confidence`;
- `detectionSource`;
- `responseLanguageSource`.

Language Context is runtime context, not identity, authorization, capability selection or transport business logic.

## 16.6.3 — Preferred Language

Preferred language is persisted through `global_user_id` in the existing `users.profile` JSONB record under `languageSettings`.

Properties:

- transport-independent after identity linking;
- durable across process restarts;
- language and locale stored separately;
- source/provenance and update timestamp retained;
- no new duplicate language-user table and no transport-specific authoritative profile.

## 16.6.4 — Automatic Response Language

Implemented priority:

1. explicit user instruction for the current response;
2. confidently detected language of the current message;
3. current scoped conversation language;
4. stored preferred language;
5. platform locale;
6. configured bounded fallback (`SG_FALLBACK_LANGUAGE`, default `en`).

## 16.6.5 — Dynamic Language Switching

Users can switch languages naturally between messages. The detected language updates conversation language for the current scoped conversation without modifying identity, permissions or other conversations.

Conversation language is isolated by:

`global_user_id + project + group/private + thread/root`.

Short or language-free follow-ups such as `OK` therefore continue in the established conversation language instead of arbitrarily switching.

## 16.6.6 — Mixed-Language Input

Mixed-language technical text is preserved unchanged for Semantic Kernel. English code/product/technical tokens inside a Russian or Ukrainian message do not automatically force English response selection.

## 16.6.7 — Semantic Preservation

No mandatory pre-translation was introduced.

Implemented path:

`Original Message → Transport facts/locale hint → Identity & Scope → Language Context → CanonicalInput → Semantic Kernel → Decision Engine → Action Gate → Capability/AI execution → language-aware response → transport delivery`

Original user text remains available to Meaning Interpretation.

## 16.6.8 — Translation Capability Boundary

Explicit translation remains ordinary semantic/capability work and must use approved capability/model paths through AI Router. Block 16.6 does not silently replace source text with a translation.

## 16.6.9 — Transport Integration

Locale/language hints are supported through the shared transport adapters:

- Telegram uses `from.language_code` when available;
- Discord accepts event/guild locale hints;
- Web/API accepts request locale or `Accept-Language` hint;
- Email and Voice accept their locale/language metadata;
- Local transport supports explicit locale for deterministic testing.

Transports do not own final response-language policy.

## 16.6.10 — Memory Integration

Language does not create separate memory silos. Existing memory remains scoped by user/project/group/thread, not by language. Context resolution loads requested memory layers independently of input-language wording, then Semantic Kernel receives the resulting `ContextBundle` for enriched interpretation.

This preserves cross-language recall through the existing semantic/context architecture without creating a competing multilingual memory system.

## 16.6.11 — Group Context

Conversation language is scoped per global user plus project/group/thread. Different group participants can therefore use different languages without the last speaker changing another user's language context.

## 16.6.12 — Locale

Language and locale remain separate. Preferred locale can be persisted independently from language, and platform locale remains a hint/fallback. Temporal timezone/date arithmetic remains owned by Block 16.5 Temporal Context.

## 16.6.13 — Unknown Language / Low Confidence

If deterministic detection is insufficient:

- the bounded result remains low-confidence/`und` unless another source resolves it;
- when production AI is enabled, only the low-confidence case may call the routed AI language detector;
- if that fails, conversation/preference/platform/fallback policy is used;
- no language is invented as high-confidence evidence.

## 16.6.14 — AI Router Integration

Two routed AI uses are implemented where applicable:

- low-confidence language detection;
- final language-aware conversational response composition.

Both use AI Router with explicit reason/metadata. AI Router/model remains executor; SG owns response-language policy.

## 16.6.15 — Observability

A dedicated `language_context_resolved` telemetry event records bounded diagnostic evidence:

- detected language;
- confidence;
- selected response language;
- detection source;
- response-language source;
- locale.

Full user message content is not duplicated into this language telemetry event.

## 16.6.16 — Capabilities and Configuration

Implemented capabilities:

- `language-preference-set`;
- `language-preference-get`.

They use the existing Capability Registry/Executor and Action Gate. A permanent preferred-language change is state-changing and therefore remains subject to the existing Action Gate confirmation policy; Block 16.6 does not weaken that global safety rule.

Configuration added:

- `SG_MONARCH_LANGUAGE` — optional initial monarch preferred language;
- `SG_FALLBACK_LANGUAGE` — bounded system fallback.

## Required Tests / Coverage

Automated coverage includes:

- Russian, Ukrainian, English, Polish and German;
- Arabic, Japanese, Korean and Chinese script detection;
- low-confidence routed fallback for another language;
- no AI-detector spend for high-confidence deterministic input;
- natural language switching and scoped conversation continuity;
- explicit one-message language override without unwanted preference persistence;
- mixed-language technical text;
- short ambiguous and emoji-only input;
- per-user preference isolation;
- PostgreSQL preference persistence;
- Telegram `language_code` transport hint;
- language capability read/write behavior;
- Language Context before Semantic Kernel;
- privacy-bounded observability;
- compatibility with existing runtime, persistence, Temporal Context, Render composition and workers.

## Architecture and Safety Boundaries

- No separate SG instance/version per language.
- No required `/language_*` commands or phrase-based business routing.
- No transport owns final language policy.
- No language subsystem assigns identity, roles, grants or permissions.
- No language subsystem bypasses Semantic Kernel, Decision Engine or Action Gate.
- Ordinary multilingual input is not forcibly translated before Semantic Kernel.
- AI providers do not become the authoritative language-policy owner.
- Existing user/project/group/thread memory and scope isolation remains unchanged.
- Language and locale do not override Temporal Context timezone semantics.

## Acceptance Criteria

- SG accepts multilingual natural-language input through the same runtime and architecture — met.
- SG selects appropriate response language without requiring language commands — met.
- Users can switch languages naturally — met.
- Mixed-language technical text does not cause uncontrolled switching — met.
- Preferred language is durable through `global_user_id` — met.
- Group/user conversation language is isolated — met.
- Memory remains reusable across languages through existing semantic ContextBundle flow — met.
- Locale is separate and interoperates with Temporal Context — met.
- Original text reaches semantic interpretation without mandatory translation — met.
- AI calls remain behind AI Router — met.
- Language decisions are observable without copying full messages into language telemetry — met.
- Full repository CI including runtime/worker verification passes — met.

## Completion Evidence

Block 16.6 is implemented through code, PostgreSQL-backed preference persistence, transport integration, AI Router integration, capabilities, observability and automated tests.

Verified on the active `dev/sg2.1-semantic` branch by GitHub Actions SG 2.1 CI run #6397:

- `npm ci` — success;
- `npm run migrate` — success;
- `npm run check` — success;
- `npm start` — success;
- `npm run start:worker` — success.

The final documentation/CI-revision synchronization is validated by a subsequent CI run before the block is treated as final repository state.
