// ============================================================================
// src/vision/providers/openaiVisionProvider.js
// STAGE 12.3 — OPENAI vision provider (real first provider)
// Purpose:
// - first real OCR-capable provider in SG
// - feature-flag controlled
// - safe fallback on config/auth/network/model failure
//
// IMPORTANT:
// - extract-only usage
// - no semantic long-form analysis
// - no provider is enabled by default
// - this provider only becomes usable when:
//   VISION_ENABLED=true
//   VISION_OCR_ENABLED=true
//   VISION_PROVIDER_OPENAI_ENABLED=true
//   OPENAI_API_KEY is present
// ============================================================================

import fs from "fs";
import OpenAI from "openai";
import {
  VISION_EXTRACT_ONLY,
  VISION_TIMEOUT_MS,
  OPENAI_VISION_MODEL,
  OPENAI_VISION_DETAIL,
  OPENAI_VISION_MAX_OUTPUT_TOKENS,
} from "../../core/config.js";

function nowIso() {
  return new Date().toISOString();
}

function normalizeKind(kind) {
  return String(kind || "").trim().toLowerCase() || "unknown";
}

function safeNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toDataUrl(filePath, mimeType = null) {
  const buffer = fs.readFileSync(filePath);
  const b64 = buffer.toString("base64");
  const mime = String(mimeType || "").trim() || "image/jpeg";
  return `data:${mime};base64,${b64}`;
}

function createClient() {
  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey) return null;

  return new OpenAI({
    apiKey,
    timeout: VISION_TIMEOUT_MS,
  });
}

function buildUnavailableExtractResult({
  providerKey,
  requestedKind,
  reason,
  filePath = null,
  mimeType = null,
  fileSize = null,
  extraMeta = {},
}) {
  return {
    ok: false,
    providerKey,
    providerActive: false,
    extractOnly: VISION_EXTRACT_ONLY === true,
    requestedKind: normalizeKind(requestedKind),
    startedAt: nowIso(),
    finishedAt: nowIso(),
    file: {
      filePath: filePath || null,
      mimeType: mimeType || null,
      fileSize: safeNumber(fileSize, null),
    },
    text: "",
    blocks: [],
    warnings: [reason || "openai_provider_unavailable"],
    error: reason || "openai_provider_unavailable",
    meta: {
      stage: "12.3-openai-first",
      providerType: "openai",
      mode: "unavailable",
      ...extraMeta,
    },
  };
}

function buildSuccessExtractResult({
  providerKey,
  requestedKind,
  filePath = null,
  mimeType = null,
  fileSize = null,
  text = "",
  extraMeta = {},
}) {
  const startedAt = nowIso();
  const finishedAt = nowIso();

  return {
    ok: true,
    providerKey,
    providerActive: true,
    extractOnly: VISION_EXTRACT_ONLY === true,
    requestedKind: normalizeKind(requestedKind),
    startedAt,
    finishedAt,
    file: {
      filePath: filePath || null,
      mimeType: mimeType || null,
      fileSize: safeNumber(fileSize, null),
    },
    text: String(text || "").trim(),
    blocks: [],
    warnings: [],
    error: null,
    meta: {
      stage: "12.3-openai-first",
      providerType: "openai",
      mode: "live_api_call",
      ...extraMeta,
    },
  };
}

function extractTextFromCompletionResponse(response) {
  const content = response?.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item.text === "string") return item.text;
        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
}

export function createOpenAIVisionProvider(baseStatus = {}) {
  const providerKey = "openai";
  const apiKeyPresent = Boolean(String(process.env.OPENAI_API_KEY || "").trim());

  return {
    key: providerKey,
    status: {
      ...baseStatus,
      key: providerKey,
      displayName: "OpenAI Vision Provider",
      supportsVision: true,
      supportsOcr: true,
      supportsDocs: true,
      providerAvailable: apiKeyPresent,
      model: OPENAI_VISION_MODEL,
      detail: OPENAI_VISION_DETAIL,
      notes: apiKeyPresent
        ? "OpenAI provider is credential-ready."
        : "OPENAI_API_KEY is missing.",
    },

    async extractTextFromFile({
      filePath,
      mimeType = null,
      fileSize = null,
      kind = "unknown",
    }) {
      const startedAt = nowIso();

      if (!filePath || !fs.existsSync(filePath)) {
        return buildUnavailableExtractResult({
          providerKey,
          requestedKind: kind,
          reason: "openai_file_missing",
          filePath,
          mimeType,
          fileSize,
        });
      }

      const client = createClient();
      if (!client) {
        return buildUnavailableExtractResult({
          providerKey,
          requestedKind: kind,
          reason: "openai_api_key_missing",
          filePath,
          mimeType,
          fileSize,
        });
      }

      let dataUrl;
      try {
        dataUrl = toDataUrl(filePath, mimeType);
      } catch (error) {
        return buildUnavailableExtractResult({
          providerKey,
          requestedKind: kind,
          reason: "openai_file_read_failed",
          filePath,
          mimeType,
          fileSize,
          extraMeta: {
            message: error?.message ? String(error.message) : "unknown_error",
          },
        });
      }

      try {
        const response = await client.chat.completions.create({
          model: OPENAI_VISION_MODEL,
          temperature: 0,
          max_tokens: OPENAI_VISION_MAX_OUTPUT_TOKENS,
          messages: [
            {
              role: "system",
              content:
                "You are an OCR extraction engine. Extract visible text faithfully and concisely. Do not add commentary. If text is unreadable, return the readable parts only.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text:
                    "Extract visible text from this image. Return plain text only. No markdown. No explanations.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: dataUrl,
                    detail: OPENAI_VISION_DETAIL,
                  },
                },
              ],
            },
          ],
        });

        const extractedText = extractTextFromCompletionResponse(response);
        const usage = response?.usage || null;

        return {
          ...buildSuccessExtractResult({
            providerKey,
            requestedKind: kind,
            filePath,
            mimeType,
            fileSize,
            text: extractedText,
            extraMeta: {
              model: OPENAI_VISION_MODEL,
              detail: OPENAI_VISION_DETAIL,
              startedAt,
              usage: usage
                ? {
                    prompt_tokens: safeNumber(usage.prompt_tokens, null),
                    completion_tokens: safeNumber(usage.completion_tokens, null),
                    total_tokens: safeNumber(usage.total_tokens, null),
                  }
                : null,
            },
          }),
        };
      } catch (error) {
        return buildUnavailableExtractResult({
          providerKey,
          requestedKind: kind,
          reason: "openai_api_call_failed",
          filePath,
          mimeType,
          fileSize,
          extraMeta: {
            model: OPENAI_VISION_MODEL,
            detail: OPENAI_VISION_DETAIL,
            startedAt,
            message: error?.message ? String(error.message) : "unknown_error",
          },
        });
      }
    },
  };
}

export default {
  createOpenAIVisionProvider,
};