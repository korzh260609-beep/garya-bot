// src/services/chatMemory/buildInboundChatPayload.js
// STAGE 7B.next — inbound chat payload contract (SKELETON ONLY)
// IMPORTANT:
// - no runtime behavior change yet
// - no DB writes here
// - no AI calls here
// - used to unify future policy for storage text vs effective text

function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
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

function buildStorageContent(text = "", raw = null) {
  const original = safeStr(text);
  const trimmed = original.trim();
  const binaryKinds = getBinaryAttachmentKinds(raw);

  if (binaryKinds.length === 0) {
    return {
      storageContent: original,
      hasBinaryAttachment: false,
      attachmentKinds: [],
    };
  }

  const marker = `[binary_attachment:${binaryKinds.join(",")}]`;

  if (!trimmed) {
    return {
      storageContent: marker,
      hasBinaryAttachment: true,
      attachmentKinds: binaryKinds,
    };
  }

  return {
    storageContent: `${marker}\n${original}`,
    hasBinaryAttachment: true,
    attachmentKinds: binaryKinds,
  };
}

export function buildInboundChatPayload({ text = "", raw = null } = {}) {
  const originalText = safeStr(text);
  const trimmedText = originalText.trim();

  const storage = buildStorageContent(originalText, raw);

  return {
    originalText,
    trimmedText,

    // current Core-compatible storage contract
    storageContent: storage.storageContent,
    hasBinaryAttachment: storage.hasBinaryAttachment,
    attachmentKinds: storage.attachmentKinds,

    // future alignment fields (not authoritative yet)
    effectiveUserTextPreview: trimmedText,
    decisionMeta: {
      hasText: Boolean(trimmedText),
      hasBinaryAttachment: storage.hasBinaryAttachment,
      attachmentKinds: storage.attachmentKinds,
      source: "buildInboundChatPayload.skeleton",
    },
  };
}

export default buildInboundChatPayload;