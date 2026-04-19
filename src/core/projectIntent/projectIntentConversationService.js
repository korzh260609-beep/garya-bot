// src/core/projectIntent/projectIntentConversationService.js
// ============================================================================
// STAGE 12A.0 — repo conversation layer (human-first, read-only)
// Purpose:
// - keep natural dialogue separate from raw command handlers
// - use repo only when meaning really requires it
// - preserve active repo context across follow-up turns
// - never answer in raw technical command language by default
// IMPORTANT:
// - READ-ONLY only
// - NO repo writes
// - NO side effects outside reply + memory metadata
// ============================================================================

import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";
import { RepoSource } from "../../repo/RepoSource.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeText(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function tokenizeText(value) {
  const normalized = normalizeText(value)
    .replace(/[.,!?;:()[\]{}<>\\|"'`~@#$%^&*+=]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return [];
  return normalized.split(" ").filter(Boolean);
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function collectPrefixHits(tokens, prefixes) {
  const hits = [];
  for (const token of tokens) {
    for (const prefix of prefixes) {
      if (token.startsWith(prefix)) {
        hits.push(token);
        break;
      }
    }
  }
  return unique(hits);
}

const FOLLOWUP_REFERENCE_TOKENS = Object.freeze([
  "это",
  "этот",
  "эту",
  "эти",
  "this",
  "it",
  "that",
  "теперь",
  "now",
]);

const EXPLAIN_PREFIXES = Object.freeze([
  "объяс",
  "опис",
  "анализ",
  "проанализ",
  "разбор",
  "review",
  "inspect",
  "analy",
  "explain",
]);

const TRANSLATE_PREFIXES = Object.freeze([
  "перев",
  "русск",
  "англ",
  "english",
  "translate",
]);

const SUMMARY_PREFIXES = Object.freeze([
  "кратк",
  "коротк",
  "прощ",
  "summary",
  "brief",
  "short",
  "simple",
]);

function normalizePath(raw) {
  const p = safeText(raw).replace(/^\/+/, "");
  if (!p) return "";
  if (p.includes("..")) return "";
  return p;
}

function resolveDisplayMode(text = "", readPlan = {}) {
  const normalized = normalizeText(text);
  const tokens = tokenizeText(text);

  if (normalized.includes("на русском") || normalized.includes("по-русски")) {
    return "translate_ru";
  }

  if (collectPrefixHits(tokens, TRANSLATE_PREFIXES).length > 0) {
    return "translate";
  }

  if (collectPrefixHits(tokens, SUMMARY_PREFIXES).length > 0) {
    return "summary";
  }

  if (collectPrefixHits(tokens, EXPLAIN_PREFIXES).length > 0) {
    return "explain";
  }

  if (safeText(readPlan?.displayMode)) {
    return safeText(readPlan.displayMode);
  }

  return "explain";
}

function looksLikeRepoFollowupRequest(text = "") {
  const normalized = normalizeText(text);
  const tokens = tokenizeText(text);

  if (!normalized) return false;

  const hasReferenceToken = tokens.some((token) => FOLLOWUP_REFERENCE_TOKENS.includes(token));
  const hasExplain = collectPrefixHits(tokens, EXPLAIN_PREFIXES).length > 0;
  const hasTranslate = collectPrefixHits(tokens, TRANSLATE_PREFIXES).length > 0;
  const hasSummary = collectPrefixHits(tokens, SUMMARY_PREFIXES).length > 0;

  if (normalized.includes("на русском")) return true;
  if (normalized.includes("по-русски")) return true;
  if (normalized.includes("explain this")) return true;
  if (normalized.includes("translate this")) return true;

  return hasReferenceToken || hasExplain || hasTranslate || hasSummary;
}

export function buildProjectIntentRoutingText(trimmed, followupContext = null) {
  const base = safeText(trimmed);
  if (!followupContext?.isActive) return base;
  if (!looksLikeRepoFollowupRequest(base)) return base;

  const additions = [
    "repo sg",
    safeText(followupContext.targetPath),
    safeText(followupContext.targetEntity),
    safeText(followupContext.targetKind),
  ].filter(Boolean);

  return `${base} ${additions.join(" ")}`.trim();
}

export async function getLatestProjectIntentRepoContext(memory, {
  chatIdStr,
  globalUserId,
  chatType,
}) {
  try {
    const recent = await memory.recent({
      chatId: chatIdStr,
      globalUserId: globalUserId || null,
      chatType,
      limit: 24,
    });

    const rows = Array.isArray(recent) ? recent : [];

    for (let i = rows.length - 1; i >= 0; i -= 1) {
      const item = rows[i] || {};
      const meta = item?.metadata || {};

      if (meta?.projectIntentRepoContextActive === true) {
        return {
          isActive: true,
          handlerKey: safeText(meta.projectIntentBridgeHandlerKey),
          planKey: safeText(meta.projectIntentPlanKey),
          targetKind: safeText(meta.projectIntentTargetKind),
          targetEntity: safeText(meta.projectIntentTargetEntity),
          targetPath: safeText(meta.projectIntentTargetPath),
          canonicalPillarPath: safeText(meta.projectIntentCanonicalPillarPath),
          commandArg: safeText(meta.projectIntentBridgeCommandArg),
          displayMode: safeText(meta.projectIntentDisplayMode),
          sourceText: safeText(meta.projectIntentSourceText),
          largeDocument: meta?.projectIntentLargeDocument === true,
        };
      }
    }
  } catch (_) {}

  return {
    isActive: false,
    handlerKey: "",
    planKey: "",
    targetKind: "",
    targetEntity: "",
    targetPath: "",
    canonicalPillarPath: "",
    commandArg: "",
    displayMode: "",
    sourceText: "",
    largeDocument: false,
  };
}

async function loadLatestSnapshot() {
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH;

  const store = new RepoIndexStore({ pool });
  const latest = await store.getLatestSnapshot({ repo, branch });

  if (!latest) {
    return {
      ok: false,
      repo,
      branch,
      latest: null,
      filesCount: 0,
    };
  }

  const countRes = await pool.query(
    `SELECT COUNT(*)::int AS cnt FROM repo_index_files WHERE snapshot_id = $1`,
    [latest.id]
  );

  return {
    ok: true,
    repo,
    branch,
    latest,
    filesCount: countRes?.rows?.[0]?.cnt ?? 0,
  };
}

async function pathExistsInSnapshot(snapshotId, path) {
  const res = await pool.query(
    `SELECT 1 FROM repo_index_files WHERE snapshot_id = $1 AND path = $2 LIMIT 1`,
    [snapshotId, path]
  );
  return Array.isArray(res?.rows) && res.rows.length > 0;
}

async function searchSnapshotPaths(snapshotId, query, limit = 8) {
  const q = safeText(query);
  if (!q) return [];

  const like = `%${q}%`;
  const res = await pool.query(
    `
      SELECT path
      FROM repo_index_files
      WHERE snapshot_id = $1
        AND path ILIKE $2
      ORDER BY path ASC
      LIMIT $3
    `,
    [snapshotId, like, limit]
  );

  return Array.isArray(res?.rows) ? res.rows.map((row) => safeText(row.path)).filter(Boolean) : [];
}

async function fetchRepoFileText({ path, repo, branch, token }) {
  const source = new RepoSource({ repo, branch, token });
  const item = await source.fetchTextFile(path);
  if (!item || typeof item.content !== "string") {
    return null;
  }
  return item.content;
}

function pickLikelyTargetPath(readPlan = {}, searchMatches = []) {
  const targetPath = normalizePath(readPlan?.targetPath);
  if (targetPath) return targetPath;

  const canonical = normalizePath(readPlan?.canonicalPillarPath);
  if (canonical) return canonical;

  if (Array.isArray(searchMatches) && searchMatches.length > 0) {
    return normalizePath(searchMatches[0]);
  }

  return "";
}

function buildRepoStatusReply({ snapshot, filesCount }) {
  return [
    "Я вижу репозиторий проекта и могу читать его в режиме только чтения.",
    `Сейчас у меня есть доступ к снимку репозитория ${safeText(snapshot?.repo)} на ветке ${safeText(snapshot?.branch)}.`,
    `В индексе сейчас примерно ${filesCount} файлов.`,
    "Можешь просить меня найти файл, открыть документ, объяснить его смысл или разобрать нужный раздел.",
  ].join("\n");
}

function buildSearchReply({ entity, matches, readPlan }) {
  const targetName = safeText(entity) || safeText(readPlan?.targetEntity) || "нужный объект";

  if (!Array.isArray(matches) || matches.length === 0) {
    return `Я поискал ${targetName} в репозитории, но ничего подходящего не нашёл. Попробуй уточнить имя файла, раздел или путь.`;
  }

  if (matches.length === 1) {
    return [
      `Я нашёл ${targetName} в репозитории.`,
      `Путь: \`${matches[0]}\`.`,
      "Могу открыть файл, кратко пересказать его смысл или объяснить простыми словами.",
    ].join("\n");
  }

  const lines = matches.slice(0, 8).map((path) => `- \`${path}\``);
  return [
    `Я нашёл несколько вариантов для ${targetName}:`,
    ...lines,
    "",
    "Скажи, какой открыть, или напиши: «открой первый» / «объясни первый».",
  ].join("\n");
}

function buildLargeDocumentReply({ path }) {
  const name = safeText(path).split("/").pop() || safeText(path) || "этот документ";
  return [
    `Я нашёл документ ${name}.`,
    "Он большой и целиком в одно сообщение нормально не поместится.",
    "Как поступить дальше?",
    "- кратко пересказать",
    "- объяснить простыми словами",
    "- показать первую часть",
    "- разобрать конкретный раздел",
  ].join("\n");
}

function buildSmallDocumentReply({ path, content }) {
  const name = safeText(path).split("/").pop() || safeText(path) || "документ";
  return [
    `Я открыл ${name}.`,
    "Вот содержимое:",
    "",
    "```",
    content,
    "```",
  ].join("\n");
}

function buildClarificationReply(readPlan = {}) {
  return safeText(readPlan?.clarificationQuestion) || "Уточни, что именно нужно сделать с репозиторием.";
}

function buildAiMessages({
  userText,
  path,
  content,
  displayMode,
}) {
  let taskInstruction = "Объясни смысл документа простым человеческим языком.";
  if (displayMode === "translate_ru") {
    taskInstruction = "Переведи и объясни содержание на русском языке простыми словами.";
  } else if (displayMode === "translate") {
    taskInstruction = "Переведи содержание на язык запроса пользователя и коротко объясни смысл.";
  } else if (displayMode === "summary") {
    taskInstruction = "Сделай короткое и понятное summary простыми словами.";
  } else if (displayMode === "simplify") {
    taskInstruction = "Объясни очень просто, как ребёнку, без техничного языка.";
  }

  return [
    {
      role: "system",
      content:
        "Ты — SG, помощник по репозиторию проекта.\n" +
        "Говори нормальным человеческим языком.\n" +
        "Не упоминай route, planKey, bridge, handler, snapshotId, внутренние команды и другую техничку.\n" +
        "Опирайся только на предоставленный текст файла.\n" +
        "Если в тексте не хватает данных для ответа, честно скажи об этом.\n" +
        "Не придумывай того, чего нет в документе.",
    },
    {
      role: "user",
      content:
        `Запрос пользователя:\n${safeText(userText)}\n\n` +
        `Путь файла:\n${safeText(path)}\n\n` +
        `Задача:\n${taskInstruction}\n\n` +
        `Текст файла:\n<<<FILE_START>>>\n${content}\n<<<FILE_END>>>`,
    },
  ];
}

async function replyHuman(replyAndLog, text, meta = {}) {
  if (typeof replyAndLog !== "function") return;
  await replyAndLog(text, {
    read_only: true,
    ...meta,
  });
}

function buildContextMeta({
  readPlan,
  targetPath,
  targetEntity,
  targetKind,
  displayMode,
  sourceText,
  handlerKey,
  largeDocument = false,
}) {
  return {
    projectIntentRepoContextActive: true,
    projectIntentPlanKey: safeText(readPlan?.planKey),
    projectIntentBridgeHandlerKey: safeText(handlerKey),
    projectIntentBridgeCommandArg: safeText(targetPath || targetEntity),
    projectIntentCanonicalPillarPath: safeText(readPlan?.canonicalPillarPath),
    projectIntentTargetKind: safeText(targetKind),
    projectIntentTargetEntity: safeText(targetEntity),
    projectIntentTargetPath: safeText(targetPath),
    projectIntentDisplayMode: safeText(displayMode),
    projectIntentSourceText: safeText(sourceText),
    projectIntentLargeDocument: largeDocument === true,
  };
}

export async function runProjectIntentConversationFlow({
  trimmed,
  route,
  readPlan,
  followupContext,
  replyAndLog,
  callAI,
}) {
  if (route?.routeKey !== "sg_core_internal_read_allowed") {
    return { handled: false, reason: "not_internal_repo_read" };
  }

  if (readPlan?.needsClarification === true) {
    await replyHuman(
      replyAndLog,
      buildClarificationReply(readPlan),
      {
        event: "repo_conversation_clarification",
        ...buildContextMeta({
          readPlan,
          targetPath: safeText(readPlan?.targetPath),
          targetEntity: safeText(readPlan?.targetEntity),
          targetKind: safeText(readPlan?.targetKind),
          displayMode: safeText(readPlan?.displayMode),
          sourceText: trimmed,
          handlerKey: "repoConversationClarification",
          largeDocument: false,
        }),
      }
    );

    return { handled: true, reason: "clarification_replied" };
  }

  const snapshotState = await loadLatestSnapshot();
  if (!snapshotState.ok || !snapshotState.latest) {
    await replyHuman(
      replyAndLog,
      "Я пока не могу читать репозиторий, потому что индекс ещё не подготовлен. Сначала нужен актуальный снимок репозитория.",
      {
        event: "repo_conversation_no_snapshot",
      }
    );
    return { handled: true, reason: "no_snapshot" };
  }

  const latest = snapshotState.latest;
  const repo = snapshotState.repo;
  const branch = snapshotState.branch;
  const token = process.env.GITHUB_TOKEN;

  const displayMode = resolveDisplayMode(trimmed, readPlan);

  if (readPlan?.planKey === "repo_status") {
    await replyHuman(
      replyAndLog,
      buildRepoStatusReply({
        snapshot: latest,
        filesCount: snapshotState.filesCount,
      }),
      {
        event: "repo_conversation_status",
      }
    );

    return { handled: true, reason: "repo_status_human" };
  }

  if (readPlan?.planKey === "repo_search") {
    const query = safeText(readPlan?.targetEntity || readPlan?.targetPath || readPlan?.primaryPathHint);
    const matches = await searchSnapshotPaths(latest.id, query, 8);

    const pickedPath = pickLikelyTargetPath(readPlan, matches);

    if (readPlan?.intentType === "find_and_analyze" && pickedPath) {
      const exists = await pathExistsInSnapshot(latest.id, pickedPath);
      if (!exists) {
        await replyHuman(
          replyAndLog,
          `Я понял, что нужно найти и объяснить ${safeText(readPlan?.targetEntity || "документ")}, но не смог безопасно подтвердить путь в индексе репозитория.`,
          {
            event: "repo_conversation_find_analyze_not_confirmed",
          }
        );
        return { handled: true, reason: "find_and_analyze_not_confirmed" };
      }

      const content = await fetchRepoFileText({ path: pickedPath, repo, branch, token });
      if (!content) {
        await replyHuman(
          replyAndLog,
          `Я нашёл путь \`${pickedPath}\`, но не смог прочитать сам файл.`,
          {
            event: "repo_conversation_find_analyze_fetch_failed",
          }
        );
        return { handled: true, reason: "find_and_analyze_fetch_failed" };
      }

      const AI_SAFE_DOC_CHARS = 12000;
      if (content.length > AI_SAFE_DOC_CHARS) {
        await replyHuman(
          replyAndLog,
          buildLargeDocumentReply({ path: pickedPath }),
          {
            event: "repo_conversation_find_analyze_large_doc",
            ...buildContextMeta({
              readPlan,
              targetPath: pickedPath,
              targetEntity: safeText(readPlan?.targetEntity),
              targetKind: "path",
              displayMode,
              sourceText: trimmed,
              handlerKey: "repoConversationFindAnalyzeLargeDoc",
              largeDocument: true,
            }),
          }
        );
        return { handled: true, reason: "find_and_analyze_large_doc" };
      }

      const aiReply = await callAI(
        buildAiMessages({
          userText: trimmed,
          path: pickedPath,
          content,
          displayMode,
        }),
        "high",
        {
          max_completion_tokens: 500,
          temperature: 0.4,
        }
      );

      await replyHuman(
        replyAndLog,
        safeText(aiReply) || "Я нашёл документ, но не смог нормально сформулировать объяснение.",
        {
          event: "repo_conversation_find_analyze_ai",
          ...buildContextMeta({
            readPlan,
            targetPath: pickedPath,
            targetEntity: safeText(readPlan?.targetEntity),
            targetKind: "path",
            displayMode,
            sourceText: trimmed,
            handlerKey: "repoConversationFindAnalyzeAI",
            largeDocument: false,
          }),
        }
      );

      return { handled: true, reason: "find_and_analyze_ai" };
    }

    await replyHuman(
      replyAndLog,
      buildSearchReply({
        entity: query,
        matches,
        readPlan,
      }),
      {
        event: "repo_conversation_search",
        ...buildContextMeta({
          readPlan,
          targetPath: matches.length === 1 ? matches[0] : "",
          targetEntity: safeText(readPlan?.targetEntity || query),
          targetKind: matches.length === 1 ? "path" : safeText(readPlan?.targetKind || "entity"),
          displayMode,
          sourceText: trimmed,
          handlerKey: "repoConversationSearch",
          largeDocument: false,
        }),
      }
    );

    return { handled: true, reason: "repo_search_human" };
  }

  if (readPlan?.planKey === "repo_file") {
    const targetPath = normalizePath(readPlan?.targetPath || readPlan?.canonicalPillarPath || readPlan?.primaryPathHint);
    if (!targetPath) {
      await replyHuman(replyAndLog, buildClarificationReply(readPlan), {
        event: "repo_conversation_file_clarification",
      });
      return { handled: true, reason: "repo_file_clarification" };
    }

    const exists = await pathExistsInSnapshot(latest.id, targetPath);
    if (!exists) {
      await replyHuman(
        replyAndLog,
        `Я понял, какой файл ты имеешь в виду, но не нашёл его в текущем индексе репозитория: \`${targetPath}\`.`,
        {
          event: "repo_conversation_file_missing",
        }
      );
      return { handled: true, reason: "repo_file_missing" };
    }

    const content = await fetchRepoFileText({ path: targetPath, repo, branch, token });
    if (!content) {
      await replyHuman(
        replyAndLog,
        `Я нашёл путь \`${targetPath}\`, но не смог прочитать содержимое файла.`,
        {
          event: "repo_conversation_file_fetch_failed",
        }
      );
      return { handled: true, reason: "repo_file_fetch_failed" };
    }

    const INLINE_LIMIT = 2600;
    if (content.length > INLINE_LIMIT) {
      await replyHuman(
        replyAndLog,
        buildLargeDocumentReply({ path: targetPath }),
        {
          event: "repo_conversation_large_doc",
          ...buildContextMeta({
            readPlan,
            targetPath,
            targetEntity: safeText(readPlan?.targetEntity),
            targetKind: safeText(readPlan?.targetKind || "path"),
            displayMode,
            sourceText: trimmed,
            handlerKey: "repoConversationOpenLargeDoc",
            largeDocument: true,
          }),
        }
      );
      return { handled: true, reason: "repo_file_large_doc" };
    }

    await replyHuman(
      replyAndLog,
      buildSmallDocumentReply({
        path: targetPath,
        content,
      }),
      {
        event: "repo_conversation_small_doc",
        ...buildContextMeta({
          readPlan,
          targetPath,
          targetEntity: safeText(readPlan?.targetEntity),
          targetKind: safeText(readPlan?.targetKind || "path"),
          displayMode,
          sourceText: trimmed,
          handlerKey: "repoConversationOpenSmallDoc",
          largeDocument: false,
        }),
      }
    );

    return { handled: true, reason: "repo_file_human" };
  }

  if (readPlan?.planKey === "repo_analyze") {
    const targetPath = normalizePath(
      readPlan?.targetPath ||
      readPlan?.canonicalPillarPath ||
      followupContext?.targetPath ||
      readPlan?.primaryPathHint
    );

    if (!targetPath) {
      await replyHuman(replyAndLog, buildClarificationReply(readPlan), {
        event: "repo_conversation_analyze_clarification",
      });
      return { handled: true, reason: "repo_analyze_clarification" };
    }

    const exists = await pathExistsInSnapshot(latest.id, targetPath);
    if (!exists) {
      await replyHuman(
        replyAndLog,
        `Я понял, что нужно объяснить файл \`${targetPath}\`, но не нашёл его в текущем индексе репозитория.`,
        {
          event: "repo_conversation_analyze_missing",
        }
      );
      return { handled: true, reason: "repo_analyze_missing" };
    }

    const content = await fetchRepoFileText({ path: targetPath, repo, branch, token });
    if (!content) {
      await replyHuman(
        replyAndLog,
        `Я нашёл путь \`${targetPath}\`, но не смог прочитать сам файл.`,
        {
          event: "repo_conversation_analyze_fetch_failed",
        }
      );
      return { handled: true, reason: "repo_analyze_fetch_failed" };
    }

    const AI_SAFE_DOC_CHARS = 12000;
    if (content.length > AI_SAFE_DOC_CHARS) {
      await replyHuman(
        replyAndLog,
        buildLargeDocumentReply({ path: targetPath }),
        {
          event: "repo_conversation_analyze_large_doc",
          ...buildContextMeta({
            readPlan,
            targetPath,
            targetEntity: safeText(readPlan?.targetEntity || followupContext?.targetEntity),
            targetKind: safeText(readPlan?.targetKind || followupContext?.targetKind || "path"),
            displayMode,
            sourceText: trimmed,
            handlerKey: "repoConversationAnalyzeLargeDoc",
            largeDocument: true,
          }),
        }
      );
      return { handled: true, reason: "repo_analyze_large_doc" };
    }

    const aiReply = await callAI(
      buildAiMessages({
        userText: trimmed,
        path: targetPath,
        content,
        displayMode,
      }),
      "high",
      {
        max_completion_tokens: 550,
        temperature: 0.35,
      }
    );

    await replyHuman(
      replyAndLog,
      safeText(aiReply) || "Я прочитал документ, но не смог нормально сформулировать объяснение.",
      {
        event: "repo_conversation_analyze_ai",
        ...buildContextMeta({
          readPlan,
          targetPath,
          targetEntity: safeText(readPlan?.targetEntity || followupContext?.targetEntity),
          targetKind: safeText(readPlan?.targetKind || followupContext?.targetKind || "path"),
          displayMode,
          sourceText: trimmed,
          handlerKey: "repoConversationAnalyzeAI",
          largeDocument: false,
        }),
      }
    );

    return { handled: true, reason: "repo_analyze_human" };
  }

  return {
    handled: false,
    reason: "conversation_layer_skipped",
  };
}

export default {
  buildProjectIntentRoutingText,
  getLatestProjectIntentRepoContext,
  runProjectIntentConversationFlow,
};