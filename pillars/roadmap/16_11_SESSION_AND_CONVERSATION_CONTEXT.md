# Block 16.11 — Session & Conversation Context

## Status
Completed and CI-verified.

## Goal
Create a canonical model of active conversations, sessions, topics, reply chains and continuity so SG knows which dialogue is being continued independently from long-term memory.

## Implementation

Canonical conversation state extends the existing Block 12 `conversations` and `messages` persistence rather than creating a parallel dialogue archive.

Migration `171_session_conversation_context.sql` adds:
- conversation lifecycle state and continuation policy;
- active topic identity and last-activity/closure timestamps;
- durable `conversation_sessions` bound to global user, project, group/thread and transport;
- durable `conversation_topics` with explicit topic ancestry;
- message `session_id`, `topic_id`, reply relation, transport and external message identity;
- scoped indexes and external-message deduplication support.

`ConversationContextService` owns:
- deterministic conversation start/continuation;
- transport/session-bound automatic continuation;
- reply-chain continuation using scoped external message identity;
- explicit topic shifts with isolated recent-topic context;
- explicit conversation closure;
- explicitly approved private cross-transport continuation;
- bounded recent turns independent from confirmed memory;
- privacy-bounded transition audit data.

Production runtime resolves conversation context before semantic interpretation. The Semantic Kernel can therefore consume bounded recent turns while the existing Context Resolver remains authoritative for long-term memory layers. Responses are persisted back into the same conversation/session/topic chain.

Transport adapters expose facts such as platform message ID, reply ID, session ID and group/thread scope. They may expose explicit continuation/topic-shift controls, but do not decide semantic conversation identity.

## Required scope
- [x] conversation_id and optional session_id;
- [x] user/project/group/thread binding;
- [x] topic and reply-chain relationships;
- [x] explicit conversation start, continuation, topic shift and closure state;
- [x] cross-device and cross-transport continuation only after identity/scope rules allow it;
- [x] restart persistence for durable conversation state;
- [x] bounded recent-turn context separate from confirmed memory;
- [x] integration with Language Context and Semantic/Context processing;
- [x] observability for conversation transitions without unnecessary full-message duplication.

## Boundaries
- conversation state is not confirmed memory;
- a new transport session does not automatically merge unrelated conversations;
- automatic continuation is transport/session-bound;
- cross-transport continuation requires explicit prior approval and never broadens identity/project scope;
- group/thread boundaries remain authoritative;
- topic continuity cannot broaden identity, permissions or resource authority;
- transports expose reply/thread facts but do not own conversation semantics;
- full recent-turn content is kept in bounded semantic context and is not copied into ordinary capability payloads or transition telemetry.

## Acceptance criteria
- [x] SG distinguishes new conversation from continuation;
- [x] topic shifts do not corrupt unrelated context;
- [x] reply/thread chains remain correctly scoped;
- [x] restart continuation is deterministic;
- [x] approved cross-transport continuation is deterministic and fail-closed before approval;
- [x] two conversations for the same user can coexist without cross-contamination;
- [x] different users and threads cannot read each other's recent conversation context;
- [x] transition observability excludes full message content;
- [x] conversation context remains separate from confirmed long-term memory.

## Evidence
- `src/conversation/conversationContextService.js`
- `src/conversation/postgresConversationContextStore.js`
- `src/conversation/deploymentConversationContext.js`
- `src/persistence/migrations/171_session_conversation_context.sql`
- `src/runtime/createProductionRuntime.js`
- `src/runtime/localProductionHarness.js`
- `src/interfaces/transportAdapter.js`
- `src/interfaces/adapters.js`
- `tests/conversationContext.test.js`
- `tests/conversationContextPostgres.test.js`
- `tests/conversationRuntimeIntegration.test.js`
- `tests/postgresPersistence.test.js`

No new mandatory Render environment variables are introduced by Block 16.11.
