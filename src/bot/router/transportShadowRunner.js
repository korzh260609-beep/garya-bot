// src/bot/router/transportShadowRunner.js
// STAGE split — extracted from messageRouter.js
// Responsibility:
// 1) build transport unified/core context
// 2) run trace-only transport shadow
// 3) keep fallback/enforced legacy shadow behavior unchanged
// NOTE:
// - no behavior change
// - no reply logic here
// - router remains authoritative

export async function runTransportShadowFlow({
  createUnifiedContext,
  toCoreContextFromUnified,
  isTransportEnforced,
  isTransportTraceEnabled,
  handleMessageCore,

  chatIdStr,
  senderIdStr,
  transportChatTypeRaw,
  isPrivate,
  trimmed,
  msg,
  globalUserId,
}) {
  // =========================================================================
  // STAGE 6 — Transport skeleton wiring (NO behavior change)
  // =========================================================================
  // eslint/linters may complain about unused import; read once (no side-effects beyond env read)
  const _transportEnforced = isTransportEnforced();
  void _transportEnforced;

  // ✅ Stage 6.6 — trace flag exists in transportConfig; read once for lint/clarity
  const _transportTraceEnabled = isTransportTraceEnabled();
  void _transportTraceEnabled;

  const telegramAdapterContext = createUnifiedContext({
    transport: "telegram",
    chatId: chatIdStr,
    senderId: senderIdStr,
    chatType: transportChatTypeRaw,
    isPrivate,
    text: trimmed,
    raw: msg,
    meta: {
      // Stage 6.8: idempotency signal (multi-instance safety skeleton)
      messageId: String(msg.message_id ?? ""),
    },
  });

  const coreContextFromTransport = toCoreContextFromUnified(
    telegramAdapterContext,
    {
      messageId: msg.message_id,
      globalUserId,
      transportChatTypeOverride: transportChatTypeRaw,
    }
  );

  // ✅ STAGE 6 — trace only (under TRACE flag), NO behavior change
  // IMPORTANT:
  // - Must NOT call handleMessageCore() second time
  // - Log should be minimal (no full text dump) to avoid leaking payloads
  if (isTransportTraceEnabled()) {
    try {
      const trace = {
        transport: coreContextFromTransport?.transport || null,
        chatId: coreContextFromTransport?.chatId || null,
        senderId: coreContextFromTransport?.senderId || null,
        transportChatType: coreContextFromTransport?.transportChatType || null,
        messageId: coreContextFromTransport?.messageId || null,
        dedupeKey: coreContextFromTransport?.dedupeKey || null, // ✅ Stage 6.8 (trace-only)
        globalUserId: coreContextFromTransport?.globalUserId || null,
        textLen:
          typeof coreContextFromTransport?.text === "string"
            ? coreContextFromTransport.text.length
            : 0,
      };
      console.log("[TRANSPORT_TRACE] coreContextFromTransport:", trace);
    } catch (e) {
      // swallow
    }
  }

  // ✅ STAGE 6.8 — SHADOW uses transport-built core context (single path)
  // Goal:
  // - Always use coreContextFromTransport for the shadow call.
  // - Keep old Stage 6.7 branch as fallback-only to respect "no deletions".
  // - Never block Telegram flow.
  let __shadowWasHandledByTransport = false;

  try {
    await handleMessageCore(coreContextFromTransport);
    __shadowWasHandledByTransport = true;
  } catch (e) {
    console.error("handleMessageCore(SHADOW_TRANSPORT_V1) failed:", e);
  }

  // NOTE:
  // - NOT used yet as main flow
  // - Existing fallback shadow call below remains only if transport-shadow fails
  // - Future switch will use isTransportEnforced()

  // ✅ FIX: keep fallback branch fully inside this if-block (was closing early and breaking try/catch)
  if (!__shadowWasHandledByTransport) {
    // ✅ CHANGE: warn only when TRACE enabled (no prod log spam)
    if (isTransportTraceEnabled()) {
      console.warn("[TRANSPORT_FALLBACK] legacy shadow activated");
    }

    // ✅ STAGE 6.7 — enforced routing SKELETON (fallback-only)
    // Goal:
    // - Prepare branch for "enforced routing" WITHOUT switching the real reply flow.
    // - When TRANSPORT_ENFORCED=true, we ONLY change the SHADOW input context source
    //   to the transport-built coreContextFromTransport.
    // - We DO NOT early-return and we DO NOT call handleMessageCore twice.
    const __useEnforcedShadowContext = isTransportEnforced() === true;

    if (__useEnforcedShadowContext) {
      // ✅ STAGE 6.7: SHADOW (enforced context) — still shadow-only, router remains authoritative
      try {
        await handleMessageCore(coreContextFromTransport);
      } catch (e) {
        // Never block Telegram flow on Stage 6 skeleton
        console.error("handleMessageCore(SHADOW_ENFORCED) failed:", e);
      }
    } else {
      // ✅ STAGE 6 shadow wiring: call core handleMessage(context) WITHOUT affecting replies
      // ✅ STAGE 6.6: DO NOT pass derived chatType/isPrivateChat from router into core
      try {
        await handleMessageCore({
          transport: "telegram",
          chatId: chatIdStr,
          senderId: senderIdStr,
          transportChatType: transportChatTypeRaw, // raw-ish transport hint; core derives chat meta
          text: trimmed,
          messageId: msg.message_id, // ✅ STAGE 7.2 — activate memory shadow
          globalUserId,
        });
      } catch (e) {
        // Never block Telegram flow on Stage 6 skeleton
        console.error("handleMessageCore(SHADOW) failed:", e);
      }
    }
  }
}