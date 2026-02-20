# Transport Layer — Stage 6

Current state:
- messageRouter.js remains production entry point.
- New transport layer is SKELETON only.
- Not connected to production flow.

Target architecture (future switch):

Telegram webhook
  → TelegramAdapter.toContext()
  → handleMessage(context)
  → Core routing / permissions / AI
  → Adapter.reply()

IMPORTANT:
Switch to new flow must be done in controlled step.
No partial rewiring.
