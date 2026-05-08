// src/core/message/messageContextInjection.js
// SG 2.0 — Message Context Injection Boundary
//
// Purpose:
// - Provide a single controlled boundary for optional AI context injection.
// - Keep context injection disabled by default.
// - Prevent direct prompt modification from scattered runtime modules.
//
// Hard rules:
// - No DB reads/writes.
// - No Telegram or transport logic.
// - No source fetching.
// - No AI calls.
// - No repository writes.
// - Do not enable context injection here without explicit Monarch approval.

import { formatContextPackForPrompt } from "../../memory/index.js";

export const MESSAGE_CONTEXT_INJECTION_VERSION = 1;

export const MESSAGE_CONTEXT_INJECTION_MODES = Object.freeze({
  DISABLED: "disabled_by_default",
  FORMAT_ONLY: "format_only",
  INJECT_SYSTEM_CONTEXT: "inject_system_context",
});

function normalizeOptions(options = {}) {
  return {
    enabled: Boolean(options.enabled),
    mode: options.mode || MESSAGE_CONTEXT_INJECTION_MODES.DISABLED,
    formatterOptions: options.formatterOptions || {},
  };
}

function normalizeMessages(messages = []) {
  return Array.isArray(messages) ? messages : [];
}

export function prepareMessageContextInjection({ messages = [], contextPack = null, options = {} } = {}) {
  const normalizedMessages = normalizeMessages(messages);
  const normalizedOptions = normalizeOptions(options);

  if (!normalizedOptions.enabled) {
    return {
      ok: true,
      version: MESSAGE_CONTEXT_INJECTION_VERSION,
      mode: MESSAGE_CONTEXT_INJECTION_MODES.DISABLED,
      injected: false,
      messages: normalizedMessages,
      formattedContext: null,
      warnings: [],
    };
  }

  const formatted = formatContextPackForPrompt(contextPack || {}, normalizedOptions.formatterOptions);

  if (normalizedOptions.mode === MESSAGE_CONTEXT_INJECTION_MODES.FORMAT_ONLY) {
    return {
      ok: true,
      version: MESSAGE_CONTEXT_INJECTION_VERSION,
      mode: MESSAGE_CONTEXT_INJECTION_MODES.FORMAT_ONLY,
      injected: false,
      messages: normalizedMessages,
      formattedContext: formatted,
      warnings: formatted?.warnings || [],
    };
  }

  if (normalizedOptions.mode !== MESSAGE_CONTEXT_INJECTION_MODES.INJECT_SYSTEM_CONTEXT) {
    return {
      ok: false,
      version: MESSAGE_CONTEXT_INJECTION_VERSION,
      mode: normalizedOptions.mode,
      injected: false,
      messages: normalizedMessages,
      formattedContext: formatted,
      warnings: [
        {
          code: "unsupported_context_injection_mode",
          message: "Context injection mode is not supported by this boundary.",
        },
      ],
    };
  }

  const contextText = formatted?.text || "";

  if (!contextText) {
    return {
      ok: false,
      version: MESSAGE_CONTEXT_INJECTION_VERSION,
      mode: MESSAGE_CONTEXT_INJECTION_MODES.INJECT_SYSTEM_CONTEXT,
      injected: false,
      messages: normalizedMessages,
      formattedContext: formatted,
      warnings: [
        {
          code: "empty_formatted_context",
          message: "Context injection was requested but formatted context text is empty.",
        },
      ],
    };
  }

  return {
    ok: true,
    version: MESSAGE_CONTEXT_INJECTION_VERSION,
    mode: MESSAGE_CONTEXT_INJECTION_MODES.INJECT_SYSTEM_CONTEXT,
    injected: true,
    messages: [
      ...normalizedMessages,
      {
        role: "system",
        content: contextText,
      },
    ],
    formattedContext: formatted,
    warnings: formatted?.warnings || [],
  };
}

export default {
  MESSAGE_CONTEXT_INJECTION_VERSION,
  MESSAGE_CONTEXT_INJECTION_MODES,
  prepareMessageContextInjection,
};
