// src/core/projectIntent/semantic/projectIntentSemanticFallback.js

import { safeText, normalizeText, tokenizeText, pickFirstNonEmpty } from "./projectIntentSemanticText.js";
import {
  isLikelyPathOrFileToken,
  inferObjectKindFromTarget,
  extractTargetPhrase,
  extractTreePrefix,
  normalizeFolderTarget,
} from "./projectIntentSemanticTargetExtractors.js";
import { fuzzyCanonicalMatch } from "./projectIntentSemanticAliases.js";
import { detectActionMeaning } from "./projectIntentSemanticIntentDetector.js";
import { shouldPreferActiveFile } from "./projectIntentSemanticActiveFile.js";

export function heuristicFallback({
  text,
  followupContext = null,
  pendingChoiceContext = null,
}) {
  const normalized = normalizeText(text);
  const tokens = tokenizeText(text);

  const fuzzy = fuzzyCanonicalMatch(text);
  const extractedTarget = extractTargetPhrase(text);
  const treePrefix = extractTreePrefix(text);

  const targetEntity = pickFirstNonEmpty([
    extractedTarget,
    fuzzy.entity,
    followupContext?.targetEntity,
    pendingChoiceContext?.targetEntity,
  ]);

  const targetPath = pickFirstNonEmpty([
    isLikelyPathOrFileToken(extractedTarget) ? extractedTarget : "",
    fuzzy.path,
    followupContext?.targetPath,
    pendingChoiceContext?.targetPath,
  ]);

  const actionMeaning = detectActionMeaning({
    normalized,
    tokens,
    text,
    followupContext,
    pendingChoiceContext,
  });

  let displayMode = "raw";
  if (normalized.includes("на русском") || normalized.includes("по-русски")) {
    displayMode = "translate_ru";
  } else if (normalized.includes("кратко")) {
    displayMode = "summary";
  } else if (
    normalized.includes("объяс") ||
    normalized.includes("о чем") ||
    normalized.includes("о чём") ||
    normalized.includes("смысл")
  ) {
    displayMode = "explain";
  }

  if (normalized.includes("первая часть") || normalized.includes("покажи первую часть")) {
    displayMode = "raw_first_part";
  }

  if (
    displayMode === "raw" &&
    shouldPreferActiveFile({ text, normalized, followupContext, pendingChoiceContext })
  ) {
    displayMode = safeText(followupContext?.displayMode) || "explain";
  }

  const inferredObjectKind = inferObjectKindFromTarget(
    pickFirstNonEmpty([
      extractedTarget,
      targetPath,
      followupContext?.targetPath,
      followupContext?.targetEntity,
    ])
  );

  if (actionMeaning.intent === "continue_active") {
    return {
      intent: "continue_active",
      targetEntity: safeText(followupContext?.targetEntity),
      targetPath: safeText(followupContext?.continuation?.targetPath || followupContext?.targetPath),
      displayMode: safeText(followupContext?.continuation?.displayMode || followupContext?.displayMode || "explain"),
      treePrefix: safeText(followupContext?.treePrefix),
      objectKind: safeText(followupContext?.objectKind || inferredObjectKind),
      clarifyNeeded: false,
      clarifyQuestion: "",
      confidence: "high",
    };
  }

  if (actionMeaning.intent === "answer_pending_choice") {
    return {
      intent: "answer_pending_choice",
      targetEntity,
      targetPath,
      displayMode:
        displayMode === "raw"
          ? safeText(pendingChoiceContext?.displayMode || "summary")
          : displayMode,
      treePrefix: "",
      objectKind: inferObjectKindFromTarget(targetPath || targetEntity),
      clarifyNeeded: false,
      clarifyQuestion: "",
      confidence: "high",
    };
  }

  if (actionMeaning.intent === "show_tree") {
    return {
      intent: "show_tree",
      targetEntity: "",
      targetPath: "",
      displayMode: "raw",
      treePrefix,
      objectKind: treePrefix ? "folder" : "root",
      clarifyNeeded: false,
      clarifyQuestion: "",
      confidence: actionMeaning.confidence,
    };
  }

  if (actionMeaning.intent === "repo_status") {
    return {
      intent: "repo_status",
      targetEntity: "",
      targetPath: "",
      displayMode: "raw",
      treePrefix: "",
      objectKind: "repo",
      clarifyNeeded: false,
      clarifyQuestion: "",
      confidence: actionMeaning.confidence,
    };
  }

  if (actionMeaning.intent === "browse_folder") {
    const folderTarget = normalizeFolderTarget(
      extractedTarget || targetPath || targetEntity || treePrefix || followupContext?.targetPath || followupContext?.treePrefix
    );

    return {
      intent: "browse_folder",
      targetEntity: safeText(extractedTarget || targetEntity || folderTarget),
      targetPath: folderTarget,
      displayMode: "raw",
      treePrefix: folderTarget,
      objectKind: folderTarget ? "folder" : "unknown",
      clarifyNeeded: !folderTarget,
      clarifyQuestion: folderTarget ? "" : "Какую именно папку показать?",
      confidence: folderTarget ? "high" : "medium",
    };
  }

  if (actionMeaning.intent === "find_and_explain") {
    return {
      intent: "find_and_explain",
      targetEntity,
      targetPath,
      displayMode: displayMode === "raw" ? "summary" : displayMode,
      treePrefix: "",
      objectKind: inferObjectKindFromTarget(targetPath || targetEntity),
      clarifyNeeded: !targetEntity && !targetPath,
      clarifyQuestion: (!targetEntity && !targetPath) ? "Что именно искать и объяснить в репозитории?" : "",
      confidence: (targetEntity || targetPath) ? "high" : "low",
    };
  }

  if (actionMeaning.intent === "find_target") {
    return {
      intent: "find_target",
      targetEntity,
      targetPath,
      displayMode: "raw",
      treePrefix: "",
      objectKind: inferObjectKindFromTarget(targetPath || targetEntity),
      clarifyNeeded: !targetEntity && !targetPath,
      clarifyQuestion: (!targetEntity && !targetPath) ? "Что именно искать в репозитории?" : "",
      confidence: (targetEntity || targetPath) ? "high" : "low",
    };
  }

  if (actionMeaning.intent === "open_target") {
    return {
      intent: "open_target",
      targetEntity,
      targetPath,
      displayMode: "raw",
      treePrefix: "",
      objectKind: inferObjectKindFromTarget(targetPath || targetEntity),
      clarifyNeeded: !targetPath && !targetEntity,
      clarifyQuestion: (!targetPath && !targetEntity) ? "Какой именно файл или документ открыть?" : "",
      confidence: (targetEntity || targetPath) ? "high" : "low",
    };
  }

  if (actionMeaning.intent === "explain_active") {
    return {
      intent: "explain_active",
      targetEntity: safeText(followupContext?.targetEntity || targetEntity),
      targetPath: safeText(followupContext?.targetPath || targetPath),
      displayMode: displayMode === "raw" ? (safeText(followupContext?.displayMode) || "explain") : displayMode,
      treePrefix: "",
      objectKind: safeText(followupContext?.objectKind || inferObjectKindFromTarget(targetPath || targetEntity)),
      clarifyNeeded: !targetPath && !followupContext?.isActive,
      clarifyQuestion: (!targetPath && !followupContext?.isActive) ? "Что именно нужно объяснить?" : "",
      confidence: (targetPath || followupContext?.isActive) ? "high" : "medium",
    };
  }

  if (actionMeaning.intent === "explain_target") {
    return {
      intent: "explain_target",
      targetEntity,
      targetPath,
      displayMode: displayMode === "raw" ? "explain" : displayMode,
      treePrefix: "",
      objectKind: inferObjectKindFromTarget(targetPath || targetEntity),
      clarifyNeeded: !targetPath && !targetEntity && !followupContext?.isActive,
      clarifyQuestion: (!targetPath && !targetEntity && !followupContext?.isActive) ? "Что именно нужно объяснить?" : "",
      confidence: (targetEntity || targetPath || followupContext?.isActive) ? "high" : "low",
    };
  }

  return {
    intent: "unknown",
    targetEntity,
    targetPath,
    displayMode,
    treePrefix: "",
    objectKind: inferObjectKindFromTarget(targetPath || targetEntity),
    clarifyNeeded: false,
    clarifyQuestion: "",
    confidence: targetEntity || targetPath ? "medium" : "low",
  };
}