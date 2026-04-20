// src/core/projectIntent/semantic/projectIntentSemanticActiveFile.js

import { safeText, tokenizeText } from "./projectIntentSemanticText.js";
import { extractTargetPhrase, sanitizeTargetText } from "./projectIntentSemanticTargetExtractors.js";

export function mentionsInnerFileSubject(normalized = "") {
  return (
    normalized.includes("команд") ||
    normalized.includes("функц") ||
    normalized.includes("метод") ||
    normalized.includes("участ") ||
    normalized.includes("часть") ||
    normalized.includes("главн") ||
    normalized.includes("важн") ||
    normalized.includes("рандом") ||
    normalized.includes("случайн") ||
    normalized.includes("section") ||
    normalized.includes("function") ||
    normalized.includes("method") ||
    normalized.includes("command") ||
    normalized.includes("piece") ||
    normalized.includes("part") ||
    normalized.includes("important") ||
    normalized.includes("main") ||
    normalized.includes("random")
  );
}

export function mentionsCurrentContextAnchor(normalized = "") {
  return (
    normalized.includes("здесь") ||
    normalized.includes("тут") ||
    normalized.includes("в этом") ||
    normalized.includes("из этого") ||
    normalized.includes("этого файла") ||
    normalized.includes("в файле") ||
    normalized.includes("внутри файла") ||
    normalized.includes("inside this") ||
    normalized.includes("in this") ||
    normalized.includes("here")
  );
}

export function hasExplicitDifferentTarget(text = "", followupContext = null, pendingChoiceContext = null) {
  const extractedTarget = extractTargetPhrase(text);
  const normalizedExtracted = sanitizeTargetText(extractedTarget).toLowerCase();
  if (!normalizedExtracted) return false;

  const activePath = safeText(followupContext?.targetPath).toLowerCase();
  const activeEntity = safeText(followupContext?.targetEntity).toLowerCase();
  const pendingPath = safeText(pendingChoiceContext?.targetPath).toLowerCase();
  const pendingEntity = safeText(pendingChoiceContext?.targetEntity).toLowerCase();

  if (
    normalizedExtracted === activePath ||
    normalizedExtracted === activeEntity ||
    normalizedExtracted === pendingPath ||
    normalizedExtracted === pendingEntity
  ) {
    return false;
  }

  return true;
}

export function shouldPreferActiveFile({
  text,
  normalized,
  followupContext = null,
  pendingChoiceContext = null,
}) {
  if (followupContext?.isActive !== true) return false;
  if (safeText(followupContext?.objectKind) !== "file") return false;
  if (hasExplicitDifferentTarget(text, followupContext, pendingChoiceContext)) return false;

  const shortFollowup = tokenizeText(text).length <= 10;
  const innerSubject = mentionsInnerFileSubject(normalized);
  const currentAnchor = mentionsCurrentContextAnchor(normalized);
  const asksMeaning =
    normalized.includes("что делает") ||
    normalized.includes("что здесь") ||
    normalized.includes("расскажи") ||
    normalized.includes("объясни") ||
    normalized.includes("дай информацию") ||
    normalized.includes("покажи") ||
    normalized.includes("какая") ||
    normalized.includes("какой");

  return (innerSubject && (currentAnchor || shortFollowup || asksMeaning)) || (currentAnchor && shortFollowup);
}