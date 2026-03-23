// src/core/handleMessage/inboundBinary.js

export function getBinaryAttachmentKinds(raw = null) {
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

export function buildInboundStorageText(text = "", raw = null) {
  const original = typeof text === "string" ? text : String(text ?? "");
  const trimmed = original.trim();
  const binaryKinds = getBinaryAttachmentKinds(raw);

  if (binaryKinds.length === 0) {
    return {
      content: original,
      hasBinaryAttachment: false,
      attachmentKinds: [],
    };
  }

  const marker = `[binary_attachment:${binaryKinds.join(",")}]`;

  if (!trimmed) {
    return {
      content: marker,
      hasBinaryAttachment: true,
      attachmentKinds: binaryKinds,
    };
  }

  return {
    content: `${marker}\n${original}`,
    hasBinaryAttachment: true,
    attachmentKinds: binaryKinds,
  };
}