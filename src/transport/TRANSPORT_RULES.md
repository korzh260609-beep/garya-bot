# TRANSPORT RULES — HARD (Stage 6.9)

Transport layer must be THIN.

1) Transport normalizes raw events → UnifiedContext only.
2) Transport MUST NOT:
   - write memory
   - check permissions / roles
   - run tasks
   - call AI
   - touch business logic
3) All logic lives in Core (handleMessage) + Access + Memory + TaskEngine.
4) Transport resolves identity only as raw sender/chat ids; global_user_id resolution is Identity layer (Stage 4).
5) Any side-effects require idempotency signal (see idempotencyPolicy.js).
