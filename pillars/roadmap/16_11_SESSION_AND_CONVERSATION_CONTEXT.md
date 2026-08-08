# Block 16.11 — Session & Conversation Context

## Status
Planned.

## Goal
Create a canonical model of active conversations, sessions, topics, reply chains and continuity so SG knows which dialogue is being continued independently from long-term memory.

## Required scope
- conversation_id and optional session_id;
- user/project/group/thread binding;
- topic and reply-chain relationships;
- explicit conversation start, continuation, topic shift and closure state;
- cross-device and cross-transport continuation only after identity/scope rules allow it;
- restart persistence for durable conversation state;
- bounded recent-turn context separate from confirmed memory;
- integration with Language Context, Temporal Context and Context Resolver;
- observability for conversation transitions without unnecessary full-message duplication.

## Boundaries
- conversation state is not confirmed memory;
- a new transport session does not automatically merge unrelated conversations;
- group/thread boundaries remain authoritative;
- topic continuity cannot broaden identity, permissions or resource authority;
- transports expose reply/thread facts but do not own conversation semantics.

## Acceptance criteria
- SG distinguishes new conversation from continuation;
- topic shifts do not corrupt unrelated context;
- reply/thread chains remain correctly scoped;
- restart and approved cross-transport continuation work deterministically;
- two conversations for the same user can coexist without cross-contamination.
