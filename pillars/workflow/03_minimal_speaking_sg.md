# Workflow Block 3 — Minimal Speaking SG

> AGENT NOTE:
> This workflow block defines the first minimal speaking SG runtime.
> Read this before adding Telegram chat behavior, AI calls, prompt behavior, delivery, or early access checks.
> Do not turn the minimal speaking SG into a monolith, technical mode, keyword-bot, or old `main` copy without explicit Monarch approval.

Branch: `dev/v2-start`.

---

## Goal

Make SG 2.0 answer in Telegram through a clean modular path.

The goal is not to rebuild the old bot.
The goal is the smallest real speaking SG with correct architecture.

---

## 3.1 Required flow

```text
Telegram update
-> Telegram transport
-> Telegram adapter
-> Core message handler
-> Identity resolver
-> Early access gate
-> SG system prompt boundary
-> AI wrapper
-> Delivery boundary
-> Telegram reply
```

---

## 3.2 No technical external mode

SG speaks as:

```text
Living SG / Советник GARYA
```

Forbidden:

- separate technical mode;
- raw developer console personality;
- debug persona;
- command-first behavior;
- hardcoded fake intelligence.

Allowed:

- clear technical explanations when the Monarch asks;
- honest runtime error messages;
- short critical answers;
- source-first repo analysis in project work.

---

## 3.3 No model hacks

The first speaking SG must use a real AI wrapper.

Forbidden:

- fake fallback answers pretending AI worked;
- keyword-router as the main brain;
- canned responses replacing reasoning;
- direct OpenAI calls scattered across transport/core;
- hidden mode switches.

Required:

- one AI entrypoint;
- one model config boundary before full Model Router exists;
- honest error if `OPENAI_API_KEY` is missing;
- minimal system prompt boundary for Living SG behavior;
- state-changing actions remain blocked.

---

## 3.4 Early access limit

During foundation, Telegram runtime is limited to the Monarch.

Required env:

```text
MONARCH_USER_ID
```

If not configured, SG must not open access by accident.

---

## 3.5 Runtime env

Required for Telegram speaking runtime:

```text
TELEGRAM_BOT_TOKEN
BOT_TOKEN
OPENAI_API_KEY
MONARCH_USER_ID
```

`BOT_TOKEN` exists as a compatibility fallback. `TELEGRAM_BOT_TOKEN` is the clearer Telegram-specific name.

Recommended for webhook setup:

```text
BASE_URL
```

Render-provided public URL or hostname may be used if available.

---

## 3.6 Minimal implementation boundary

Expected minimal runtime boundaries:

```text
index.js
src/config/env.js
src/transport/telegram.js
src/transport/telegram/initTelegramTransport.js
src/transport/telegram/telegramAdapter.js
src/delivery/telegramDelivery.js
src/core/handleMessage.js
src/core/sgSystemPrompt.js
src/users/identityResolver.js
src/permissions/monarchGate.js
src/ai/callAI.js
src/ai/modelConfig.js
```

Forbidden at this stage:

- memory module implementation;
- task engine implementation;
- sources layer implementation;
- billing implementation;
- old debug routes;
- old messageRouter;
- RepoStateAgent;
- AgentWorkspace;
- large prompt framework.
