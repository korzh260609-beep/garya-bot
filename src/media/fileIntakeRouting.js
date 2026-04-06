// src/media/fileIntakeRouting.js
// ==================================================
// FILE-INTAKE ROUTING + LIFECYCLE
// Purpose:
// - specialized routing skeleton
// - lifecycle skeleton
// - compact debug helpers
// ==================================================

import { nowIso } from "./fileIntakeCore.js";
import { summarizeMediaAttachment } from "./fileIntakeSummary.js";

export function buildSpecializedAIRoutingRule(summary) {
  const kind = summary?.kind || "unknown";

  switch (kind) {
    case "photo":
      return {
        routeVersion: "11F.12-skeleton",
        kind,
        specializedRoute: "vision_candidate",
        specializedProviderRequired: true,
        specializedProviderActive: false,
        genericAiAllowedToSeeBinary: false,
        genericAiMode: "text_fallback_only",
        fallbackMode: "stub_or_caption_text_only",
        notes:
          "Photo should route to Vision-class handler; current runtime may return OCR and visible facts if provider is active.",
      };

    case "document":
      return {
        routeVersion: "11F.12-skeleton",
        kind,
        specializedRoute: "document_parse_candidate",
        specializedProviderRequired: true,
        specializedProviderActive: false,
        genericAiAllowedToSeeBinary: false,
        genericAiMode: "text_fallback_only",
        fallbackMode: "stub_or_caption_text_only",
        notes:
          "Document should route to parser/extract-class handler; current runtime may extract text and lightweight structure from supported formats.",
      };

    case "voice":
    case "audio":
      return {
        routeVersion: "11F.12-skeleton",
        kind,
        specializedRoute: "stt_candidate",
        specializedProviderRequired: true,
        specializedProviderActive: false,
        genericAiAllowedToSeeBinary: false,
        genericAiMode: "text_fallback_only",
        fallbackMode: "stub_or_caption_text_only",
        notes:
          "Voice/audio must go to STT-class handler in future; current runtime allows only text fallback.",
      };

    case "video":
      return {
        routeVersion: "11F.12-skeleton",
        kind,
        specializedRoute: "video_extract_candidate",
        specializedProviderRequired: true,
        specializedProviderActive: false,
        genericAiAllowedToSeeBinary: false,
        genericAiMode: "text_fallback_only",
        fallbackMode: "stub_or_caption_text_only",
        notes:
          "Video must go to frame/audio extraction handler in future; current runtime allows only text fallback.",
      };

    default:
      return {
        routeVersion: "11F.12-skeleton",
        kind,
        specializedRoute: "unknown_candidate",
        specializedProviderRequired: false,
        specializedProviderActive: false,
        genericAiAllowedToSeeBinary: false,
        genericAiMode: "text_fallback_only",
        fallbackMode: "stub_or_caption_text_only",
        notes:
          "Unknown file kind has no active specialized handler; current runtime allows only text fallback.",
      };
  }
}

export function compactRoutingRuleForDebug(rule) {
  return {
    routeVersion: rule?.routeVersion || "n/a",
    kind: rule?.kind || "n/a",
    specializedRoute: rule?.specializedRoute || "n/a",
    specializedProviderRequired: rule?.specializedProviderRequired === true,
    specializedProviderActive: rule?.specializedProviderActive === true,
    genericAiAllowedToSeeBinary: rule?.genericAiAllowedToSeeBinary === true,
    genericAiMode: rule?.genericAiMode || "n/a",
    fallbackMode: rule?.fallbackMode || "n/a",
  };
}

function buildRetentionPolicySkeleton(kind = "unknown") {
  return {
    enabled: false,
    policyVersion: 1,
    retentionDays: null,
    archiveEnabled: false,
    binaryPersistenceAllowed: false,
    cleanupMode: "tmp_delete_after_processing",
    notes: `Retention not active yet for kind=${kind}.`,
  };
}

function buildDataLifecycleSkeleton(summary) {
  const kind = summary?.kind || "unknown";

  return {
    schemaVersion: 1,
    lifecycleVersion: "11F.11-skeleton",
    sourceType: "telegram_media",
    kind,
    createdAt: nowIso(),

    identity: {
      chatId: summary?.chatId ?? null,
      messageId: summary?.messageId ?? null,
      fileId: summary?.fileId || null,
      fileUniqueId: summary?.fileUniqueId || null,
    },

    descriptor: {
      fileName: summary?.fileName || null,
      mimeType: summary?.mimeType || null,
      fileSize: summary?.fileSize ?? null,
      width: summary?.width ?? null,
      height: summary?.height ?? null,
      duration: summary?.duration ?? null,
      captionPresent: Boolean(summary?.caption),
    },

    storage: {
      binaryPersisted: false,
      persistedBinaryLocation: null,
      tempLocalPath: null,
      tempExists: false,
      extractedTextPersisted: false,
      extractedTextLocation: null,
      structuredDataPersisted: false,
      structuredDataLocation: null,
      policy: "meta_only_no_binary_persistence",
    },

    routing: buildSpecializedAIRoutingRule(summary),

    processing: {
      summaryDone: false,
      downloaded: false,
      processed: false,
      cleanupAttempted: false,
      cleanupRemoved: false,
      cleanupReason: null,

      visionAttempted: false,
      visionOk: false,
      visionReason: null,

      factsAttempted: false,
      factsOk: false,
      factsReason: null,
    },

    retention: buildRetentionPolicySkeleton(kind),
  };
}

export function buildFileLifecycleRecord(msg) {
  const summary = summarizeMediaAttachment(msg);
  if (!summary) return null;
  return buildDataLifecycleSkeleton(summary);
}

export function compactLifecycleForDebug(lifecycle) {
  return {
    lifecycleVersion: lifecycle?.lifecycleVersion || "n/a",
    kind: lifecycle?.kind || "n/a",
    binaryPersisted: lifecycle?.storage?.binaryPersisted === true,
    tempLocalPath: lifecycle?.storage?.tempLocalPath || null,
    tempExists: lifecycle?.storage?.tempExists === true,
    downloaded: lifecycle?.processing?.downloaded === true,
    processed: lifecycle?.processing?.processed === true,
    cleanupAttempted: lifecycle?.processing?.cleanupAttempted === true,
    cleanupRemoved: lifecycle?.processing?.cleanupRemoved === true,
    cleanupReason: lifecycle?.processing?.cleanupReason || null,
    visionAttempted: lifecycle?.processing?.visionAttempted === true,
    visionOk: lifecycle?.processing?.visionOk === true,
    visionReason: lifecycle?.processing?.visionReason || null,
    factsAttempted: lifecycle?.processing?.factsAttempted === true,
    factsOk: lifecycle?.processing?.factsOk === true,
    factsReason: lifecycle?.processing?.factsReason || null,
    retentionEnabled: lifecycle?.retention?.enabled === true,
    archiveEnabled: lifecycle?.retention?.archiveEnabled === true,
    binaryPersistenceAllowed: lifecycle?.retention?.binaryPersistenceAllowed === true,
    policy: lifecycle?.storage?.policy || "n/a",
    routing: compactRoutingRuleForDebug(lifecycle?.routing || null),
  };
}

export default {
  buildSpecializedAIRoutingRule,
  compactRoutingRuleForDebug,
  buildFileLifecycleRecord,
  compactLifecycleForDebug,
};