# Transport Layer — Stage 6

Current state:
- TelegramAdapter is production entry point (TRANSPORT_ENFORCED=true).
- messageRouter.js is NOT attached in production (kept as fallback only).
- Transport layer remains Stage 6 SKELETON: migration is not considered complete.

Architecture:

Telegram webhook
  → TelegramAdapter.toContext()
  → handleMessage(context)
  → Core routing / permissions / AI
  → Adapter.reply()

IMPORTANT:
Switching flows must be done in a controlled step.
No partial rewiring.