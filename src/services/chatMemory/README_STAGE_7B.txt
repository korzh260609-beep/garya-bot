STAGE 7B FOUNDATION

What is implemented:
- safe storage foundation for chat messages
- redaction before storage
- text truncation protection
- sha256 hash
- idempotent insert via unique(chat_id, platform_message_id)

What is NOT implemented yet:
- retention cleanup
- chat_meta
- source flags
- recall
- cross-group restrictions logic
- quote policies in retrieval layer

Integration rule:
1. Save incoming Telegram message BEFORE AI call
2. If duplicate=true -> stop processing that update
3. Save outgoing SG message AFTER successful send and real platform_message_id received