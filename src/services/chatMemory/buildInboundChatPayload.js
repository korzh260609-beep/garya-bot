// src/services/chatMemory/buildInboundChatPayload.js
// STAGE 7B.x — inbound chat payload contract (SKELETON ONLY)
//
// IMPORTANT:
// - contract only
// - NO runtime wiring yet
// - NO behavior changes in production
// - does NOT call FileIntake
// - does NOT replace buildInboundStorageText()
// - does NOT replace dedupe/storage logic
//
// Purpose:
// define one future normalized payload shape for inbound chat/media messages,
// so Core storage semantics and AI-facing semantics can be aligned later
// through an explicit contract instead of ad-hoc branching.

function toSafeString(value) {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function getBinaryAttachmentKinds(raw = null) {
  if (!raw || typeof raw !== "object") return [];

  const kinds = [];

  if (Array.isArray(raw.photo) && raw.photo.length > 0) kinds.push("photo");
  if (raw.document) kinds.push("document");
  if (raw.voice) kinds.push("voice");
  if (raw.audio) kinds.push("audio");
  if (raw.video) kinds.push("video");
  if (raw.video_note) kinds.push("video_note");
  if (raw.sticker) kinds.push("sticker");
  if (raw.animation) kinds.push("animation");

  return kinds;
}

function buildStorageContent(originalText = "", binaryKinds = []) {
  const original = toSafeString(originalText);
  const trimmed = original.trim();

  if (!binaryKinds.length) {
    return original;
  }

  const marker = `[binary_attachment:${binaryKinds.join(",")}]`;

  if (!trimmed) {
    return marker;
  }

  return `${marker}\n${original}`;
}

function buildEffectiveUserTextPreview({
  originalText = "",
  raw = null,
  binaryKinds = [],
} = {}) {
  const original = toSafeString(originalText);
  const trimmed = original.trim();
  const caption = toSafeString(raw?.caption).trim();

  // SKELETON ONLY:
  // preview tries to show what future unified AI-facing text may look like,
  // but MUST NOT be treated as authoritative runtime output yet.
  //
  // IMPORTANT:
  // this preview is conceptually closer to current chat.js AI-facing behavior,
  // but it is NOT guaranteed to be a 1:1 equivalent of:
  // FileIntake.buildEffectiveUserTextAndDecision(...)
  //
  // Current production semantics for AI-facing media/text decisions
  // still live in src/media/fileIntake.js.

  if (!binaryKinds.length) {
    return trimmed;
  }

  const effectiveBase = trimmed || caption;

  if (!effectiveBase) {
    return "";
  }

  const primaryKind = binaryKinds[0] || "file";

  const mediaNote = (() => {
    if (primaryKind === "photo") {
      return "Вложение: фото (preview only; OCR/Vision пока не активен).";
    }
    if (primaryKind === "document") {
      return "Вложение: документ (preview only; parsing пока не активен).";
    }
    if (primaryKind === "voice") {
      return "Вложение: голосовое (preview only; STT пока не активен).";
    }
    if (primaryKind === "audio") {
      return "Вложение: аудио (preview only; STT пока не активен).";
    }
    if (primaryKind === "video") {
      return "Вложение: видео (preview only; analysis пока не активен).";
    }
    if (primaryKind === "video_note") {
      return "Вложение: video_note (preview only; analysis пока не активен).";
    }
    if (primaryKind === "sticker") {
      return "Вложение: sticker (preview only; analysis пока не активен).";
    }
    if (primaryKind === "animation") {
      return "Вложение: animation (preview only; analysis пока не активен).";
    }
    return "Вложение: файл (preview only; analysis пока не активен).";
  })();

  return `${effectiveBase}\n\n(${mediaNote})`;
}

export function buildInboundChatPayload(text = "", raw = null) {
  const originalText = toSafeString(text);
  const trimmedText = originalText.trim();
  const attachmentKinds = getBinaryAttachmentKinds(raw);
  const hasBinaryAttachment = attachmentKinds.length > 0;

  const storageContent = buildStorageContent(originalText, attachmentKinds);

  const effectiveUserTextPreview = buildEffectiveUserTextPreview({
    originalText,
    raw,
    binaryKinds: attachmentKinds,
  });

  const decisionMeta = {
    contractVersion: 1,
    skeletonOnly: true,

    // Explicit bridge markers for current legacy semantics.
    // These fields document which production paths are authoritative TODAY.
    storagePreviewSource: "buildInboundStorageText_legacy",
    aiPreviewSource: "FileIntake.buildEffectiveUserTextAndDecision_legacy",

    // More explicit authority markers for future migration planning.
    storageAuthorityNow: {
      file: "src/core/handleMessage.js",
      function: "buildInboundStorageText",
      authoritativeRuntimeNow: true,
      purpose: "storage_facing_inbound_content",
    },
    aiAuthorityNow: {
      file: "src/media/fileIntake.js",
      function: "buildEffectiveUserTextAndDecision",
      authoritativeRuntimeNow: true,
      purpose: "ai_facing_effective_user_text_and_media_decision",
    },

    // IMPORTANT:
    // current repo intentionally has semantic divergence between
    // storage-facing content and AI-facing effective text for media/caption flows.
    semanticDivergenceExpected: true,
    migrationBlocked: true,

    // CONTRACT OWNERSHIP NOTE:
    // - this file is NOT yet the approved runtime source of truth
    // - contract owner for future unified inbound semantics is still NOT approved
    // - this file must remain documentation/skeleton only until that owner is explicitly chosen
    // - do NOT treat this file as authoritative over Core storage logic
    // - do NOT treat this file as authoritative over FileIntake AI-facing logic
    contractOwnerApproved: false,
    runtimeSourceOfTruthNow: false,

    // Future contract intent only — these fields describe target shape,
    // not active runtime behavior.
    futureUnifiedFields: {
      originalText: "raw user-visible input text before normalization",
      trimmedText: "normalized text-only value",
      storageContent: "future storage-facing content candidate",
      effectiveUserText: "future AI-facing content candidate",
      hasBinaryAttachment: "boolean binary/media flag",
      attachmentKinds: "normalized attachment kind list",
      hasCaption: "caption presence flag",
      semanticMode: "planned storage/ai semantic descriptor",
    },

    // Preconditions are documentation only at this stage.
    // They MUST be satisfied before any runtime switch is allowed.
    migrationPreconditions: [
      "explicit approved micro-step for runtime migration",
      "repo verification of handleMessage.js and chat.js before wiring",
      "decision on single authoritative inbound contract owner",
      "alignment of storage semantics vs AI-facing semantics",
      "separate verification for media-only, text+media, caption+media flows",
      "no silent replacement of FileIntake runtime behavior",
      "no silent replacement of buildInboundStorageText runtime behavior",
    ],

    hasText: Boolean(trimmedText),
    hasBinaryAttachment,
    attachmentKinds,
    hasCaption: Boolean(toSafeString(raw?.caption).trim()),
    previewReason:
      hasBinaryAttachment
        ? trimmedText
          ? "text_plus_binary_preview"
          : toSafeString(raw?.caption).trim()
            ? "caption_plus_binary_preview"
            : "binary_only_preview"
        : trimmedText
          ? "text_only_preview"
          : "empty_preview",
  };

  return {
    originalText,
    trimmedText,

    // storage-facing preview only
    storageContent,

    hasBinaryAttachment,
    attachmentKinds,

    // AI-facing preview only
    effectiveUserTextPreview,

    decisionMeta,
  };
}

export default buildInboundChatPayload;