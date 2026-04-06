// src/media/fileIntakeSummary.js

function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function summarizeMediaAttachment(msg) {
  if (!msg || typeof msg !== "object") return null;

  const chatId = msg.chat?.id ?? null;
  const messageId = msg.message_id ?? null;

  if (Array.isArray(msg.photo) && msg.photo.length > 0) {
    const photo = msg.photo[msg.photo.length - 1];
    return {
      kind: "photo",
      chatId,
      messageId,
      fileId: photo.file_id,
      fileUniqueId: photo.file_unique_id,
      width: photo.width,
      height: photo.height,
      fileSize: photo.file_size,
      caption: msg.caption || null,
    };
  }

  if (msg.document) {
    const d = msg.document;
    return {
      kind: "document",
      chatId,
      messageId,
      fileId: d.file_id,
      fileUniqueId: d.file_unique_id,
      fileName: d.file_name || null,
      mimeType: d.mime_type || null,
      fileSize: d.file_size,
      caption: msg.caption || null,
    };
  }

  if (msg.audio) {
    const a = msg.audio;
    return {
      kind: "audio",
      chatId,
      messageId,
      fileId: a.file_id,
      fileUniqueId: a.file_unique_id,
      mimeType: a.mime_type || null,
      fileSize: a.file_size,
      duration: a.duration,
      title: a.title || null,
      performer: a.performer || null,
      caption: msg.caption || null,
    };
  }

  if (msg.voice) {
    const v = msg.voice;
    return {
      kind: "voice",
      chatId,
      messageId,
      fileId: v.file_id,
      fileUniqueId: v.file_unique_id,
      mimeType: v.mime_type || null,
      fileSize: v.file_size,
      duration: v.duration,
      caption: msg.caption || null,
    };
  }

  if (msg.video) {
    const v = msg.video;
    return {
      kind: "video",
      chatId,
      messageId,
      fileId: v.file_id,
      fileUniqueId: v.file_unique_id,
      mimeType: v.mime_type || null,
      fileSize: v.file_size,
      width: v.width,
      height: v.height,
      duration: v.duration,
      caption: msg.caption || null,
    };
  }

  return null;
}

export function detectIncomingFileType(msg) {
  return summarizeMediaAttachment(msg);
}

export function buildCompactSummaryDebug(summary) {
  if (!summary) {
    return {
      ok: false,
      reason: "no_media_summary",
    };
  }

  return {
    ok: true,
    kind: safeStr(summary.kind || "unknown"),
    chatId: summary.chatId ?? null,
    messageId: summary.messageId ?? null,
    fileId: summary.fileId || null,
    fileUniqueId: summary.fileUniqueId || null,
    fileName: summary.fileName || null,
    mimeType: summary.mimeType || null,
    fileSize: summary.fileSize ?? null,
    width: summary.width ?? null,
    height: summary.height ?? null,
    duration: summary.duration ?? null,
    title: summary.title || null,
    performer: summary.performer || null,
    hasCaption: Boolean(summary.caption),
  };
}

export default {
  summarizeMediaAttachment,
  detectIncomingFileType,
  buildCompactSummaryDebug,
};