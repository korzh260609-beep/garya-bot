// src/media/fileIntakeProcess.js
// ==================================================
// FILE-INTAKE PROCESS
// Purpose:
// - process downloaded intake file
// - bridge vision/document services
// - return effective result for caller
// ==================================================

import {
  getVisionServiceStatus,
  extractTextWithVisionFromIntake,
  extractVisibleFactsWithVisionFromIntake,
  canRunVisionForIntake,
} from "../vision/visionService.js";
import {
  getDocumentTextServiceStatus,
  extractTextFromDocumentIntake,
  canRunDocumentTextForIntake,
} from "../documents/documentTextService.js";
import {
  makeMeta,
  pushLog,
  safeStr,
} from "./fileIntakeCore.js";
import {
  safeDocumentMeta,
  buildAutoSummaryRequestText,
  saveDocumentSessionCache,
} from "./fileIntakeDocumentSession.js";
import {
  buildStubMessage,
  buildCombinedDirectHint,
  buildDocumentHintForUser,
} from "./fileIntakeHints.js";

export async function processIncomingFile(intake) {
  const meta = intake?.meta || makeMeta();

  pushLog(meta, "info", "process", "Start processing intake.", {
    kind: intake?.kind,
    fileName: intake?.downloaded?.fileName || intake?.fileName || null,
    specializedRoute: intake?.lifecycle?.routing?.specializedRoute || null,
    genericAiMode: intake?.lifecycle?.routing?.genericAiMode || null,
  });

  let directUserHint = buildStubMessage(intake);
  let processedText = (() => {
    if (!intake) return "";
    const kind = intake.kind || "unknown";
    const fileName = intake?.downloaded?.fileName || intake?.fileName || "";
    const mime = intake?.mimeType || "";
    const route = intake?.lifecycle?.routing?.specializedRoute || "n/a";
    return `File-Intake stub: kind=${kind}; file=${fileName}; mime=${mime || "n/a"}; route=${route}.`;
  })();

  let extractedText = "";
  let extractionAvailable = false;
  let extractionError = null;
  let extractionProviderKey = null;

  let visibleFactsText = "";
  let visibleFactsAvailable = false;
  let visibleFactsError = null;
  let visibleFactsProviderKey = null;

  let documentBlocks = [];
  let documentTitle = null;
  let documentStats = null;
  let documentHeadings = [];
  let documentStructureVersion = null;
  let documentStructureSource = null;

  let shouldCallAI = false;
  let effectiveUserText = "";

  if (canRunVisionForIntake(intake)) {
    const visionStatus = getVisionServiceStatus({
      kind: intake?.kind || "unknown",
      mimeType: intake?.mimeType || null,
    });

    pushLog(meta, "info", "vision", "Vision service status checked.", {
      provider: visionStatus?.provider || "n/a",
      requestedProvider: visionStatus?.requestedProvider || "n/a",
      selectedProviderKey: visionStatus?.selectedProviderKey || "n/a",
      enabled: visionStatus?.enabled === true,
      providerAvailable: visionStatus?.providerAvailable === true,
      ocrEnabled: visionStatus?.ocrEnabled === true,
      extractOnly: visionStatus?.extractOnly === true,
      reason: visionStatus?.reason || "n/a",
    });

    if (intake?.lifecycle?.processing) {
      intake.lifecycle.processing.visionAttempted = true;
    }

    const visionResult = await extractTextWithVisionFromIntake(intake);

    if (visionResult?.ok === true) {
      if (intake?.lifecycle?.processing) {
        intake.lifecycle.processing.visionOk = true;
        intake.lifecycle.processing.visionReason = "extract_ok";
      }

      extractedText = safeStr(visionResult.text).trim();
      extractionAvailable = Boolean(extractedText);
      extractionError = null;
      extractionProviderKey = visionResult.providerKey || null;

      processedText += ` vision=ok; provider=${visionResult.providerKey || "n/a"}; textLen=${extractedText.length}.`;

      pushLog(meta, "info", "vision", "Vision OCR result available.", {
        provider: visionResult?.providerKey || "n/a",
        textLen: extractedText.length,
        textPreview: extractedText.slice(0, 200),
      });
    } else {
      if (intake?.lifecycle?.processing) {
        intake.lifecycle.processing.visionOk = false;
        intake.lifecycle.processing.visionReason =
          visionResult?.error || "vision_unavailable";
      }

      extractedText = "";
      extractionAvailable = false;
      extractionError = visionResult?.error || "unknown";
      extractionProviderKey = visionResult?.providerKey || null;

      processedText += ` vision=unavailable; reason=${visionResult?.error || "unknown"}.`;

      pushLog(meta, "info", "vision", "Vision OCR unavailable/noop result.", {
        reason: visionResult?.error || "unknown",
        provider: visionResult?.providerKey || "n/a",
      });
    }

    if (intake?.lifecycle?.processing) {
      intake.lifecycle.processing.factsAttempted = true;
    }

    const factsResult = await extractVisibleFactsWithVisionFromIntake(intake);

    if (factsResult?.ok === true) {
      if (intake?.lifecycle?.processing) {
        intake.lifecycle.processing.factsOk = true;
        intake.lifecycle.processing.factsReason = "facts_ok";
      }

      visibleFactsText = safeStr(factsResult.text).trim();
      visibleFactsAvailable = Boolean(visibleFactsText);
      visibleFactsError = null;
      visibleFactsProviderKey = factsResult.providerKey || null;

      processedText += ` facts=ok; provider=${factsResult.providerKey || "n/a"}; factsLen=${visibleFactsText.length}.`;

      pushLog(meta, "info", "vision", "Visible facts result available.", {
        provider: factsResult?.providerKey || "n/a",
        factsLen: visibleFactsText.length,
        factsPreview: visibleFactsText.slice(0, 200),
      });
    } else {
      if (intake?.lifecycle?.processing) {
        intake.lifecycle.processing.factsOk = false;
        intake.lifecycle.processing.factsReason =
          factsResult?.error || "facts_unavailable";
      }

      visibleFactsText = "";
      visibleFactsAvailable = false;
      visibleFactsError = factsResult?.error || "unknown";
      visibleFactsProviderKey = factsResult?.providerKey || null;

      processedText += ` facts=unavailable; reason=${factsResult?.error || "unknown"}.`;

      pushLog(meta, "info", "vision", "Visible facts unavailable/noop result.", {
        reason: factsResult?.error || "unknown",
        provider: factsResult?.providerKey || "n/a",
      });
    }

    directUserHint =
      buildCombinedDirectHint({
        visionResult,
        factsResult,
      }) || directUserHint;
  }

  if (canRunDocumentTextForIntake(intake)) {
    const documentStatus = getDocumentTextServiceStatus({
      fileName: intake?.downloaded?.fileName || intake?.fileName || "",
      mimeType: intake?.mimeType || null,
    });

    pushLog(meta, "info", "document", "Document text service status checked.", {
      enabled: documentStatus?.enabled === true,
      extractOnly: documentStatus?.extractOnly === true,
      extension: documentStatus?.extension || "",
      mimeType: documentStatus?.mimeType || null,
      pdfReady: documentStatus?.pdfReady === true,
      docxReady: documentStatus?.docxReady === true,
      structuringReady: documentStatus?.structuringReady === true,
    });

    const documentResult = await extractTextFromDocumentIntake(intake);

    if (documentResult?.ok === true) {
      extractedText = safeStr(documentResult.text).trim();
      extractionAvailable = Boolean(extractedText);
      extractionError = null;
      extractionProviderKey = documentResult.providerKey || null;

      const docMeta = safeDocumentMeta(documentResult?.meta || {});
      documentBlocks = Array.isArray(documentResult?.blocks)
        ? documentResult.blocks
        : [];
      documentTitle = docMeta.title;
      documentStats = docMeta.stats;
      documentHeadings = docMeta.headings;
      documentStructureVersion = docMeta.structureVersion;
      documentStructureSource = docMeta.structureSource;

      processedText += ` document=ok; provider=${documentResult.providerKey || "n/a"}; textLen=${extractedText.length}.`;

      if (documentStats) {
        processedText += ` documentBlocks=${documentStats.blockCount}; documentHeadings=${documentStats.headingCount}; documentWords=${documentStats.wordCount}.`;
      }

      pushLog(meta, "info", "document", "Document extraction result available.", {
        provider: documentResult?.providerKey || "n/a",
        textLen: extractedText.length,
        textPreview: extractedText.slice(0, 200),
        title: documentTitle,
        structureVersion: documentStructureVersion,
        structureSource: documentStructureSource,
        blockCount: documentStats?.blockCount ?? 0,
        headingCount: documentStats?.headingCount ?? 0,
        wordCount: documentStats?.wordCount ?? 0,
      });

      saveDocumentSessionCache({
        chatId: intake?.chatId ?? intake?.lifecycle?.identity?.chatId ?? null,
        fileName: intake?.downloaded?.fileName || intake?.fileName || "document",
        text: extractedText,
        title: documentTitle,
        stats: documentStats,
        headings: documentHeadings,
        blocks: documentBlocks,
        structureVersion: documentStructureVersion,
        structureSource: documentStructureSource,
      });

      shouldCallAI = true;
      effectiveUserText = buildAutoSummaryRequestText(
        intake?.downloaded?.fileName || intake?.fileName || "document"
      );
      directUserHint = null;
    } else {
      extractedText = "";
      extractionAvailable = false;
      extractionError = documentResult?.error || "unknown";
      extractionProviderKey = documentResult?.providerKey || null;

      processedText += ` document=unavailable; reason=${documentResult?.error || "unknown"}.`;

      pushLog(meta, "info", "document", "Document extraction unavailable/noop result.", {
        reason: documentResult?.error || "unknown",
        provider: documentResult?.providerKey || "n/a",
      });

      directUserHint = buildDocumentHintForUser(documentResult, intake) || directUserHint;
    }
  }

  pushLog(meta, "info", "process", "Processing complete.", {
    processedText,
    documentTitle,
    documentStats,
    documentStructureVersion,
    documentStructureSource,
    shouldCallAI,
  });

  if (intake?.lifecycle?.processing) {
    intake.lifecycle.processing.processed = true;
  }

  return {
    ok: true,
    processedText,
    directUserHint,

    shouldCallAI,
    effectiveUserText,

    extractedText,
    extractionAvailable,
    extractionError,
    extractionProviderKey,

    visibleFactsText,
    visibleFactsAvailable,
    visibleFactsError,
    visibleFactsProviderKey,

    documentBlocks,
    documentTitle,
    documentStats,
    documentHeadings,
    documentStructureVersion,
    documentStructureSource,

    lifecycle: intake?.lifecycle || null,
    meta,
  };
}

export async function processFile(intake) {
  return processIncomingFile(intake);
}

export default {
  processIncomingFile,
  processFile,
};