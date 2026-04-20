// src/core/projectIntent/semantic/projectIntentSemanticIntentDetector.js

import {
  SEARCH_PREFIXES,
  OPEN_PREFIXES,
  EXPLAIN_PREFIXES,
  TRANSLATE_PREFIXES,
  SUMMARY_PREFIXES,
  TREE_PREFIXES,
  STATUS_PREFIXES,
  CONTINUE_PREFIXES,
  FIRST_PART_PREFIXES,
  PRONOUN_FOLLOWUP_PREFIXES,
  FOLDER_PREFIXES,
  FILE_PREFIXES,
  LISTING_PREFIXES,
} from "./projectIntentSemanticConstants.js";
import { collectPrefixHits } from "./projectIntentSemanticText.js";
import { shouldPreferActiveFile } from "./projectIntentSemanticActiveFile.js";

export function detectActionMeaning({ normalized, tokens, text, followupContext, pendingChoiceContext }) {
  const searchHits = collectPrefixHits(tokens, SEARCH_PREFIXES);
  const openHits = collectPrefixHits(tokens, OPEN_PREFIXES);
  const explainHits = collectPrefixHits(tokens, EXPLAIN_PREFIXES);
  const translateHits = collectPrefixHits(tokens, TRANSLATE_PREFIXES);
  const summaryHits = collectPrefixHits(tokens, SUMMARY_PREFIXES);
  const treeHits = collectPrefixHits(tokens, TREE_PREFIXES);
  const statusHits = collectPrefixHits(tokens, STATUS_PREFIXES);
  const continueHits = collectPrefixHits(tokens, CONTINUE_PREFIXES);
  const firstPartHits = collectPrefixHits(tokens, FIRST_PART_PREFIXES);
  const folderHits = collectPrefixHits(tokens, FOLDER_PREFIXES);
  const fileHits = collectPrefixHits(tokens, FILE_PREFIXES);
  const listingHits = collectPrefixHits(tokens, LISTING_PREFIXES);
  const pronounHits = collectPrefixHits(tokens, PRONOUN_FOLLOWUP_PREFIXES);

  void fileHits;

  const wantsContinuation =
    continueHits.length > 0 ||
    normalized.includes("следующ") ||
    normalized.includes("ещё") ||
    normalized.includes("еще") ||
    normalized.includes("дальше");

  const wantsTree =
    treeHits.length > 0 ||
    normalized.includes("дерево репозитория") ||
    normalized.includes("какие папки в корне");

  const wantsStatus =
    (statusHits.length > 0 && normalized.includes("репозитор")) ||
    normalized.includes("видишь репозиторий") ||
    normalized.includes("есть доступ к репозиторию");

  const wantsSummary = summaryHits.length > 0 || normalized.includes("кратко");
  const wantsTranslate = translateHits.length > 0 || normalized.includes("на русском") || normalized.includes("по-русски");
  const wantsExplain =
    explainHits.length > 0 ||
    normalized.includes("о чем") ||
    normalized.includes("о чём") ||
    normalized.includes("что это за файл") ||
    normalized.includes("в чем смысл") ||
    normalized.includes("зачем он");

  const wantsOpen = openHits.length > 0;
  const wantsSearch = searchHits.length > 0;
  const wantsFolderListing =
    folderHits.length > 0 ||
    listingHits.length > 0 ||
    normalized.includes("что внутри") ||
    normalized.includes("содержимое папки") ||
    normalized.includes("inside folder") ||
    normalized.includes("contents");

  const wantsFirstPart =
    firstPartHits.length > 0 && normalized.includes("част");

  if (followupContext?.continuation?.isActive === true && wantsContinuation) {
    return {
      intent: "continue_active",
      confidence: "high",
    };
  }

  if (pendingChoiceContext?.isActive === true && (wantsSummary || wantsExplain || wantsTranslate || wantsFirstPart || wantsContinuation)) {
    return {
      intent: "answer_pending_choice",
      confidence: "high",
    };
  }

  if (shouldPreferActiveFile({ text, normalized, followupContext, pendingChoiceContext })) {
    return {
      intent: "explain_active",
      confidence: "high",
    };
  }

  if (wantsTree) {
    return {
      intent: "show_tree",
      confidence: "medium",
    };
  }

  if (wantsStatus) {
    return {
      intent: "repo_status",
      confidence: "medium",
    };
  }

  if (wantsFolderListing) {
    return {
      intent: "browse_folder",
      confidence: "medium",
    };
  }

  if (wantsSearch && (wantsExplain || wantsSummary || wantsTranslate)) {
    return {
      intent: "find_and_explain",
      confidence: "medium",
    };
  }

  if (wantsSearch) {
    return {
      intent: "find_target",
      confidence: "medium",
    };
  }

  if (wantsExplain || wantsTranslate || wantsSummary || wantsFirstPart) {
    return {
      intent: "explain_target",
      confidence: "medium",
    };
  }

  if (wantsOpen) {
    return {
      intent: "open_target",
      confidence: "medium",
    };
  }

  if (
    followupContext?.isActive === true &&
    pronounHits.length > 0 &&
    (wantsExplain || wantsSummary || wantsTranslate || wantsOpen)
  ) {
    return {
      intent: "explain_active",
      confidence: "medium",
    };
  }

  return {
    intent: "unknown",
    confidence: "low",
  };
}