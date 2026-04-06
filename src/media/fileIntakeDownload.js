// src/media/fileIntakeDownload.js
// ==================================================
// FILE-INTAKE DOWNLOAD + CLEANUP
// Purpose:
// - Telegram file download
// - temp file cleanup
// - intake+download combined helper
// ==================================================

import fs from "fs";
import path from "path";
import { fetchWithTimeout } from "../core/fetchWithTimeout.js";
import {
  TMP_DIR,
  ensureTmpDir,
  makeMeta,
  pushLog,
} from "./fileIntakeCore.js";
import { summarizeMediaAttachment } from "./fileIntakeSummary.js";
import { buildFileLifecycleRecord } from "./fileIntakeRouting.js";

export async function downloadTelegramFile(botToken, fileId) {
  if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is missing");
  if (!fileId) throw new Error("fileId is missing");

  ensureTmpDir();

  const metaRes = await fetchWithTimeout(
    `https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(
      fileId
    )}`,
    { method: "GET" },
    8000
  );
  const metaJson = await metaRes.json();

  if (!metaJson.ok || !metaJson.result?.file_path) {
    throw new Error("Telegram getFile failed");
  }

  const telegramPath = metaJson.result.file_path;

  const fileUrl = `https://api.telegram.org/file/bot${botToken}/${telegramPath}`;
  const fileName = path.basename(telegramPath);
  const localPath = path.join(TMP_DIR, fileName);

  const fileRes = await fetchWithTimeout(fileUrl, { method: "GET" }, 12000);
  if (!fileRes.ok) throw new Error("File download failed");

  const buffer = await fileRes.arrayBuffer();
  fs.writeFileSync(localPath, Buffer.from(buffer));

  return {
    localPath,
    fileName,
    size: buffer.byteLength,
    telegramPath,
  };
}

export function cleanupDownloadedFile(intake, options = {}) {
  const meta = intake?.meta || makeMeta();
  const localPath = intake?.downloaded?.localPath || null;

  if (intake?.lifecycle?.processing) {
    intake.lifecycle.processing.cleanupAttempted = true;
  }

  if (!localPath) {
    pushLog(meta, "info", "cleanup", "No local file to cleanup.");

    if (intake?.lifecycle?.processing) {
      intake.lifecycle.processing.cleanupRemoved = false;
      intake.lifecycle.processing.cleanupReason = "no_local_path";
    }

    if (intake?.lifecycle?.storage) {
      intake.lifecycle.storage.tempExists = false;
    }

    return {
      ok: true,
      removed: false,
      reason: "no_local_path",
      localPath: null,
      meta,
    };
  }

  try {
    if (!fs.existsSync(localPath)) {
      pushLog(meta, "info", "cleanup", "Local file already missing.", {
        localPath,
      });

      if (intake?.lifecycle?.processing) {
        intake.lifecycle.processing.cleanupRemoved = false;
        intake.lifecycle.processing.cleanupReason = "already_missing";
      }

      if (intake?.lifecycle?.storage) {
        intake.lifecycle.storage.tempExists = false;
      }

      return {
        ok: true,
        removed: false,
        reason: "already_missing",
        localPath,
        meta,
      };
    }

    fs.unlinkSync(localPath);

    pushLog(meta, "info", "cleanup", "Temporary file removed.", {
      localPath,
    });

    if (intake?.lifecycle?.processing) {
      intake.lifecycle.processing.cleanupRemoved = true;
      intake.lifecycle.processing.cleanupReason = "removed";
    }

    if (intake?.lifecycle?.storage) {
      intake.lifecycle.storage.tempExists = false;
    }

    return {
      ok: true,
      removed: true,
      reason: "removed",
      localPath,
      meta,
    };
  } catch (error) {
    pushLog(meta, "error", "cleanup", "Temporary file cleanup failed.", {
      localPath,
      message: error?.message ? String(error.message) : "unknown_error",
    });

    if (intake?.lifecycle?.processing) {
      intake.lifecycle.processing.cleanupRemoved = false;
      intake.lifecycle.processing.cleanupReason = "cleanup_failed";
    }

    return {
      ok: false,
      removed: false,
      reason: "cleanup_failed",
      localPath,
      error: error?.message ? String(error.message) : "unknown_error",
      meta,
    };
  }
}

export function cleanupIntakeTempFiles(intake, options = {}) {
  return cleanupDownloadedFile(intake, options);
}

export async function intakeAndDownloadIfNeeded(msg, botToken) {
  const meta = makeMeta();

  const summary = summarizeMediaAttachment(msg);
  if (!summary) {
    pushLog(meta, "info", "summary", "No attachment in message.");
    return null;
  }

  const lifecycle = buildFileLifecycleRecord(msg);
  if (lifecycle?.processing) {
    lifecycle.processing.summaryDone = true;
  }

  pushLog(meta, "info", "summary", "Attachment summarized.", {
    kind: summary.kind,
    fileId: summary.fileId,
    fileName: summary.fileName || null,
    mimeType: summary.mimeType || null,
    fileSize: summary.fileSize || null,
    specializedRoute: lifecycle?.routing?.specializedRoute || null,
  });

  const downloaded = await downloadTelegramFile(botToken, summary.fileId);

  if (lifecycle?.storage) {
    lifecycle.storage.tempLocalPath = downloaded.localPath;
    lifecycle.storage.tempExists = true;
  }
  if (lifecycle?.processing) {
    lifecycle.processing.downloaded = true;
  }

  pushLog(meta, "info", "download", "Attachment downloaded.", {
    fileName: downloaded.fileName,
    size: downloaded.size,
    localPath: downloaded.localPath,
  });

  return {
    ...summary,
    downloaded,
    lifecycle,
    meta,
  };
}

export default {
  downloadTelegramFile,
  cleanupDownloadedFile,
  cleanupIntakeTempFiles,
  intakeAndDownloadIfNeeded,
};