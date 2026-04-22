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
import { buildProjectContextScopeFromRepoContext } from "../projectIntentProjectContextScope.js";

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeOptionalText(value) {
  const s = safeText(value).toLowerCase();
  return s || "";
}

function normalizeProjectContextScope(value) {
  const source = safeObject(value);
  const out = {};

  const projectKey = safeText(source.projectKey);
  if (projectKey) out.projectKey = projectKey;

  const projectArea = normalizeOptionalText(source.projectArea);
  if (projectArea) out.projectArea = projectArea;

  const repoScope = normalizeOptionalText(source.repoScope);
  if (repoScope) out.repoScope = repoScope;

  const linkedArea = normalizeOptionalText(source.linkedArea);
  if (linkedArea) out.linkedArea = linkedArea;

  const linkedRepo = normalizeOptionalText(source.linkedRepo);
  if (linkedRepo) out.linkedRepo = linkedRepo;

  if (typeof source.crossRepo === "boolean") {
    out.crossRepo = source.crossRepo;
  }

  return out;
}

function buildFallbackProjectContextScope({
  followupContext = null,
  pendingChoiceContext = null,
  targetEntity = "",
  targetPath = "",
  objectKind = "",
}) {
  const activeScope = normalizeProjectContextScope(followupContext?.projectContextScope);
  const pendingScope = normalizeProjectContextScope(pendingChoiceContext?.projectContextScope);

  const explicitTargetScope = normalizeProjectContextScope(
    buildProjectContextScopeFromRepoContext({
      isActive: true,
      targetEntity: safeText(targetEntity),
      targetPath: safeText(targetPath),
      objectKind: safeText(objectKind),
    })
  );

  return {
    ...activeScope,
    ...pendingScope,
    ...explicitTargetScope,
  };
}

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
    const effectiveTargetEntity = safeText(followupContext?.targetEntity);
    const effectiveTargetPath = safeText(
      followupContext?.continuation?.targetPath || followupContext?.targetPath
    );
    const effectiveObjectKind = safeText(followupContext?.objectKind || inferredObjectKind);

    return {
      intent: "continue_active",
      targetEntity: effectiveTargetEntity,
      targetPath: effectiveTargetPath,
      displayMode: safeText(
        followupContext?.continuation?.displayMode ||
        followupContext?.displayMode ||
        "explain"
      ),
      treePrefix: safeText(followupContext?.treePrefix),
      objectKind: effectiveObjectKind,
      clarifyNeeded: false,
      clarifyQuestion: "",
      confidence: "high",
      projectContextScope: buildFallbackProjectContextScope({
        followupContext,
        pendingChoiceContext,
        targetEntity: effectiveTargetEntity,
        targetPath: effectiveTargetPath,
        objectKind: effectiveObjectKind,
      }),
    };
  }

  if (actionMeaning.intent === "answer_pending_choice") {
    const effectiveObjectKind = inferObjectKindFromTarget(targetPath || targetEntity);

    return {
      intent: "answer_pending_choice",
      targetEntity,
      targetPath,
      displayMode:
        displayMode === "raw"
          ? safeText(pendingChoiceContext?.displayMode || "summary")
          : displayMode,
      treePrefix: "",
      objectKind: effectiveObjectKind,
      clarifyNeeded: false,
      clarifyQuestion: "",
      confidence: "high",
      projectContextScope: buildFallbackProjectContextScope({
        followupContext,
        pendingChoiceContext,
        targetEntity,
        targetPath,
        objectKind: effectiveObjectKind,
      }),
    };
  }

  if (actionMeaning.intent === "show_tree") {
    const effectiveObjectKind = treePrefix ? "folder" : "root";

    return {
      intent: "show_tree",
      targetEntity: "",
      targetPath: "",
      displayMode: "raw",
      treePrefix,
      objectKind: effectiveObjectKind,
      clarifyNeeded: false,
      clarifyQuestion: "",
      confidence: actionMeaning.confidence,
      projectContextScope: buildFallbackProjectContextScope({
        followupContext,
        pendingChoiceContext,
        targetEntity: "",
        targetPath: treePrefix,
        objectKind: effectiveObjectKind,
      }),
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
      projectContextScope: buildFallbackProjectContextScope({
        followupContext,
        pendingChoiceContext,
        targetEntity: "",
        targetPath: "",
        objectKind: "repo",
      }),
    };
  }

  if (actionMeaning.intent === "browse_folder") {
    const folderTarget = normalizeFolderTarget(
      extractedTarget || targetPath || targetEntity || treePrefix || followupContext?.targetPath || followupContext?.treePrefix
    );
    const effectiveObjectKind = folderTarget ? "folder" : "unknown";

    return {
      intent: "browse_folder",
      targetEntity: safeText(extractedTarget || targetEntity || folderTarget),
      targetPath: folderTarget,
      displayMode: "raw",
      treePrefix: folderTarget,
      objectKind: effectiveObjectKind,
      clarifyNeeded: !folderTarget,
      clarifyQuestion: folderTarget ? "" : "Какую именно папку показать?",
      confidence: folderTarget ? "high" : "medium",
      projectContextScope: buildFallbackProjectContextScope({
        followupContext,
        pendingChoiceContext,
        targetEntity: safeText(extractedTarget || targetEntity || folderTarget),
        targetPath: folderTarget,
        objectKind: effectiveObjectKind,
      }),
    };
  }

  if (actionMeaning.intent === "find_and_explain") {
    const effectiveObjectKind = inferObjectKindFromTarget(targetPath || targetEntity);

    return {
      intent: "find_and_explain",
      targetEntity,
      targetPath,
      displayMode: displayMode === "raw" ? "summary" : displayMode,
      treePrefix: "",
      objectKind: effectiveObjectKind,
      clarifyNeeded: !targetEntity && !targetPath,
      clarifyQuestion: (!targetEntity && !targetPath) ? "Что именно искать и объяснить в репозитории?" : "",
      confidence: (targetEntity || targetPath) ? "high" : "low",
      projectContextScope: buildFallbackProjectContextScope({
        followupContext,
        pendingChoiceContext,
        targetEntity,
        targetPath,
        objectKind: effectiveObjectKind,
      }),
    };
  }

  if (actionMeaning.intent === "find_target") {
    const effectiveObjectKind = inferObjectKindFromTarget(targetPath || targetEntity);

    return {
      intent: "find_target",
      targetEntity,
      targetPath,
      displayMode: "raw",
      treePrefix: "",
      objectKind: effectiveObjectKind,
      clarifyNeeded: !targetEntity && !targetPath,
      clarifyQuestion: (!targetEntity && !targetPath) ? "Что именно искать в репозитории?" : "",
      confidence: (targetEntity || targetPath) ? "high" : "low",
      projectContextScope: buildFallbackProjectContextScope({
        followupContext,
        pendingChoiceContext,
        targetEntity,
        targetPath,
        objectKind: effectiveObjectKind,
      }),
    };
  }

  if (actionMeaning.intent === "open_target") {
    const effectiveObjectKind = inferObjectKindFromTarget(targetPath || targetEntity);

    return {
      intent: "open_target",
      targetEntity,
      targetPath,
      displayMode: "raw",
      treePrefix: "",
      objectKind: effectiveObjectKind,
      clarifyNeeded: !targetPath && !targetEntity,
      clarifyQuestion: (!targetPath && !targetEntity) ? "Какой именно файл или документ открыть?" : "",
      confidence: (targetEntity || targetPath) ? "high" : "low",
      projectContextScope: buildFallbackProjectContextScope({
        followupContext,
        pendingChoiceContext,
        targetEntity,
        targetPath,
        objectKind: effectiveObjectKind,
      }),
    };
  }

  if (actionMeaning.intent === "explain_active") {
    const effectiveTargetEntity = safeText(followupContext?.targetEntity || targetEntity);
    const effectiveTargetPath = safeText(followupContext?.targetPath || targetPath);
    const effectiveObjectKind = safeText(
      followupContext?.objectKind || inferObjectKindFromTarget(targetPath || targetEntity)
    );

    return {
      intent: "explain_active",
      targetEntity: effectiveTargetEntity,
      targetPath: effectiveTargetPath,
      displayMode: displayMode === "raw" ? (safeText(followupContext?.displayMode) || "explain") : displayMode,
      treePrefix: "",
      objectKind: effectiveObjectKind,
      clarifyNeeded: !targetPath && !followupContext?.isActive,
      clarifyQuestion: (!targetPath && !followupContext?.isActive) ? "Что именно нужно объяснить?" : "",
      confidence: (targetPath || followupContext?.isActive) ? "high" : "medium",
      projectContextScope: buildFallbackProjectContextScope({
        followupContext,
        pendingChoiceContext,
        targetEntity: effectiveTargetEntity,
        targetPath: effectiveTargetPath,
        objectKind: effectiveObjectKind,
      }),
    };
  }

  if (actionMeaning.intent === "explain_target") {
    const effectiveObjectKind = inferObjectKindFromTarget(targetPath || targetEntity);

    return {
      intent: "explain_target",
      targetEntity,
      targetPath,
      displayMode: displayMode === "raw" ? "explain" : displayMode,
      treePrefix: "",
      objectKind: effectiveObjectKind,
      clarifyNeeded: !targetPath && !targetEntity && !followupContext?.isActive,
      clarifyQuestion: (!targetPath && !targetEntity && !followupContext?.isActive) ? "Что именно нужно объяснить?" : "",
      confidence: (targetEntity || targetPath || followupContext?.isActive) ? "high" : "low",
      projectContextScope: buildFallbackProjectContextScope({
        followupContext,
        pendingChoiceContext,
        targetEntity,
        targetPath,
        objectKind: effectiveObjectKind,
      }),
    };
  }

  const effectiveObjectKind = inferObjectKindFromTarget(targetPath || targetEntity);

  return {
    intent: "unknown",
    targetEntity,
    targetPath,
    displayMode,
    treePrefix: "",
    objectKind: effectiveObjectKind,
    clarifyNeeded: false,
    clarifyQuestion: "",
    confidence: targetEntity || targetPath ? "medium" : "low",
    projectContextScope: buildFallbackProjectContextScope({
      followupContext,
      pendingChoiceContext,
      targetEntity,
      targetPath,
      objectKind: effectiveObjectKind,
    }),
  };
}