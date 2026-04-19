// src/core/projectIntent/projectIntentConversationService.js
// ============================================================================
// STAGE 12A.0 — human-first repo conversation layer
// Purpose:
// - understand internal repo dialogue by meaning
// - keep human responses non-technical
// - support active repo context + pending choices
// - handle large docs safely
// - show repo tree root-first
// IMPORTANT:
// - READ-ONLY only
// - NO repo writes
// ============================================================================

import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";
import { RepoSource } from "../../repo/RepoSource.js";
import { resolveProjectIntentSemanticPlan } from "./projectIntentSemanticResolver.js";

function safeText(value) {
  return String(value ?? "").trim();
}

function normalizeText(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function unique(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
}

function normalizePath(raw) {
  const p = safeText(raw).replace(/^\/+/, "");
  if (!p) return "";
  if (p.includes("..")) return "";
  return p;
}

export function buildProjectIntentRoutingText(trimmed, followupContext = null, pendingChoiceContext = null) {
  const base = safeText(trimmed);

  const parts = [base];

  if (followupContext?.isActive) {
    parts.push("repo");
    parts.push(safeText(followupContext.targetEntity));
    parts.push(safeText(followupContext.targetPath));
  }

  if (pendingChoiceContext?.isActive) {
    parts.push("repo_pending_choice");
    parts.push(safeText(pendingChoiceContext.targetEntity));
    parts.push(safeText(pendingChoiceContext.targetPath));
  }

  return parts.filter(Boolean).join(" ").trim();
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

async function fetchPathsByPrefix(snapshotId, prefix = "") {
  const p = safeText(prefix);
  if (!p) {
    const res = await pool.query(
      `SELECT path FROM repo_index_files WHERE snapshot_id = $1 ORDER BY path ASC`,
      [snapshotId]
    );
    return Array.isArray(res?.rows) ? res.rows.map((r) => safeText(r.path)).filter(Boolean) : [];
  }

  const prefixLike = p.endsWith("/") ? `${p}%` : `${p}/%`;
  const res = await pool.query(
    `SELECT path FROM repo_index_files WHERE snapshot_id = $1 AND path ILIKE $2 ORDER BY path ASC`,
    [snapshotId, prefixLike]
  );
  return Array.isArray(res?.rows) ? res.rows.map((r) => safeText(r.path)).filter(Boolean) : [];
}

function computeImmediateChildren(paths = [], prefix = "") {
  const normalizedPrefix = safeText(prefix)
    ? (safeText(prefix).endsWith("/") ? safeText(prefix) : `${safeText(prefix)}/`)
    : "";

  const dirs = new Set();
  const files = new Set();

  for (const fullPathRaw of paths) {
    const fullPath = safeText(fullPathRaw);
    if (!fullPath) continue;

    const rest = normalizedPrefix
      ? fullPath.startsWith(normalizedPrefix)
        ? fullPath.slice(normalizedPrefix.length)
        : ""
      : fullPath;

    if (!rest) continue;

    const parts = rest.split("/").filter(Boolean);
    if (!parts.length) continue;

    if (parts.length === 1) {
      files.add(parts[0]);
    } else {
      dirs.add(parts[0]);
    }
  }

  return {
    directories: [...dirs].sort(),
    files: [...files].sort(),
  };
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

function pickLikelyTargetPathFromKnownEntity(entity = "") {
  const e = safeText(entity).toLowerCase();

  if (!e) return "";

  if (e === "workflow") return "pillars/WORKFLOW.md";
  if (e === "decisions") return "pillars/DECISIONS.md";
  if (e === "roadmap") return "pillars/ROADMAP.md";
  if (e === "project") return "pillars/PROJECT.md";
  if (e === "kingdom") return "pillars/KINGDOM.md";
  if (e === "sg_behavior") return "pillars/SG_BEHAVIOR.md";
  if (e === "sg_entity") return "pillars/SG_ENTITY.md";
  if (e === "repoindex") return "pillars/REPOINDEX.md";
  if (e === "code_insert_rules") return "pillars/CODE_INSERT_RULES.md";

  return "";
}

function pickLikelyTargetPath({ semanticPlan, searchMatches = [], followupContext = null, pendingChoiceContext = null }) {
  const directPath = normalizePath(semanticPlan?.targetPath);
  if (directPath) return directPath;

  const knownPath = pickLikelyTargetPathFromKnownEntity(semanticPlan?.targetEntity);
  if (knownPath) return knownPath;

  const followupPath = normalizePath(followupContext?.targetPath);
  if (followupPath) return followupPath;

  const pendingPath = normalizePath(pendingChoiceContext?.targetPath);
  if (pendingPath) return pendingPath;

  if (Array.isArray(searchMatches) && searchMatches.length > 0) {
    return normalizePath(searchMatches[0]);
  }

  return "";
}

function humanRepoStatusReply({ snapshot, filesCount }) {
  return [
    "Я вижу репозиторий проекта и могу читать его в режиме только чтения.",
    `Сейчас у меня есть доступ к актуальному снимку репозитория ${safeText(snapshot?.repo)} на ветке ${safeText(snapshot?.branch)}.`,
    `В индексе сейчас примерно ${filesCount} файлов.`,
    "Можешь попросить меня найти файл, открыть документ, объяснить его смысл, показать дерево или разобрать конкретный раздел.",
  ].join("\n");
}

function humanSearchReply({ targetEntity, matches }) {
  const target = safeText(targetEntity) || "нужный объект";

  if (!Array.isArray(matches) || matches.length === 0) {
    return `Я поискал ${target} в репозитории, но ничего подходящего не нашёл. Попробуй уточнить название файла или раздел.`;
  }

  if (matches.length === 1) {
    return [
      `Я нашёл ${target}.`,
      `Это файл \`${matches[0]}\`.`,
      "Могу открыть его, кратко пересказать или объяснить простыми словами.",
    ].join("\n");
  }

  const lines = matches.slice(0, 6).map((path) => `- \`${path}\``);
  return [
    `Я нашёл несколько вариантов для ${target}:`,
    ...lines,
    "",
    "Скажи, какой открыть, или напиши: «открой первый» / «объясни первый».",
  ].join("\n");
}

function humanTreeReply({ prefix, directories, files, hiddenCount }) {
  const isRoot = !safeText(prefix);
  const title = isRoot
    ? "Я показал корень репозитория."
    : `Я показал верхний уровень папки \`${safeText(prefix)}\`.`;

  const lines = [title];

  if (directories.length > 0) {
    lines.push("");
    lines.push("Папки:");
    for (const dir of directories) {
      lines.push(`- ${dir}/`);
    }
  }

  if (files.length > 0) {
    lines.push("");
    lines.push("Файлы:");
    for (const file of files) {
      lines.push(`- ${file}`);
    }
  }

  lines.push("");
  if (hiddenCount > 0) {
    lines.push(`Я показал только верхний уровень, а ещё ${hiddenCount} элементов глубже не раскрывал, чтобы не завалить тебя длинной простынёй.`);
  } else {
    lines.push("Я специально показал только верхний уровень, чтобы было удобно углубляться дальше по папкам.");
  }

  lines.push("Можешь написать, какую папку раскрыть дальше, например: `покажи src/` или `раскрой pillars/`.");

  return lines.join("\n");
}

function humanLargeDocumentReply({ path }) {
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

function humanSmallDocumentReply({ path, content, wasTrimmed }) {
  const name = safeText(path).split("/").pop() || safeText(path) || "документ";
  const lines = [
    `Я открыл ${name}.`,
  ];

  if (wasTrimmed) {
    lines.push("Документ длинный, поэтому здесь только первая часть.");
    lines.push("Могу продолжить дальше, кратко пересказать или объяснить смысл.");
  }

  lines.push("");
  lines.push("```");
  lines.push(content);
  lines.push("```");

  return lines.join("\n");
}

function humanClarificationReply(question) {
  return safeText(question) || "Уточни, что именно нужно сделать с репозиторием.";
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
  } else if (displayMode === "summary") {
    taskInstruction = "Сделай короткое и понятное summary простыми словами.";
  } else if (displayMode === "explain") {
    taskInstruction = "Объясни смысл документа простым человеческим языком.";
  }

  return [
    {
      role: "system",
      content:
        "Ты — SG, помощник по репозиторию проекта.\n" +
        "Говори нормальным человеческим языком.\n" +
        "Не упоминай route, handler, bridge, snapshotId, команды и другую техничку.\n" +
        "Опирайся только на текст файла.\n" +
        "Если данных не хватает — честно скажи.\n" +
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

function buildRepoContextMeta({
  targetEntity,
  targetPath,
  displayMode,
  sourceText,
  largeDocument = false,
  pendingChoice = null,
  treePrefix = "",
}) {
  return {
    projectIntentRepoContextActive: true,
    projectIntentTargetEntity: safeText(targetEntity),
    projectIntentTargetPath: safeText(targetPath),
    projectIntentDisplayMode: safeText(displayMode),
    projectIntentSourceText: safeText(sourceText),
    projectIntentLargeDocument: largeDocument === true,
    projectIntentTreePrefix: safeText(treePrefix),

    projectIntentPendingChoiceActive: !!pendingChoice?.isActive,
    projectIntentPendingChoiceKind: safeText(pendingChoice?.kind),
    projectIntentPendingChoiceTargetEntity: safeText(pendingChoice?.targetEntity),
    projectIntentPendingChoiceTargetPath: safeText(pendingChoice?.targetPath),
    projectIntentPendingChoiceDisplayMode: safeText(pendingChoice?.displayMode),
  };
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
          targetEntity: safeText(meta.projectIntentTargetEntity),
          targetPath: safeText(meta.projectIntentTargetPath),
          displayMode: safeText(meta.projectIntentDisplayMode),
          sourceText: safeText(meta.projectIntentSourceText),
          largeDocument: meta?.projectIntentLargeDocument === true,
          treePrefix: safeText(meta.projectIntentTreePrefix),
        };
      }
    }
  } catch (_) {}

  return {
    isActive: false,
    targetEntity: "",
    targetPath: "",
    displayMode: "",
    sourceText: "",
    largeDocument: false,
    treePrefix: "",
  };
}

export async function getLatestProjectIntentPendingChoice(memory, {
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

      if (meta?.projectIntentPendingChoiceActive === true) {
        return {
          isActive: true,
          kind: safeText(meta.projectIntentPendingChoiceKind),
          targetEntity: safeText(meta.projectIntentPendingChoiceTargetEntity),
          targetPath: safeText(meta.projectIntentPendingChoiceTargetPath),
          displayMode: safeText(meta.projectIntentPendingChoiceDisplayMode),
        };
      }
    }
  } catch (_) {}

  return {
    isActive: false,
    kind: "",
    targetEntity: "",
    targetPath: "",
    displayMode: "",
  };
}

export async function runProjectIntentConversationFlow({
  trimmed,
  route,
  followupContext,
  pendingChoiceContext,
  replyAndLog,
  callAI,
}) {
  if (route?.routeKey !== "sg_core_internal_read_allowed") {
    return { handled: false, reason: "not_internal_repo_read" };
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

  const semanticPlan = await resolveProjectIntentSemanticPlan({
    text: trimmed,
    callAI,
    followupContext,
    pendingChoiceContext,
  });

  if (semanticPlan?.clarifyNeeded === true) {
    const text = humanClarificationReply(semanticPlan?.clarifyQuestion);
    await replyHuman(replyAndLog, text, {
      event: "repo_conversation_clarification",
      ...buildRepoContextMeta({
        targetEntity: semanticPlan?.targetEntity,
        targetPath: semanticPlan?.targetPath,
        displayMode: semanticPlan?.displayMode,
        sourceText: trimmed,
      }),
    });
    return {
      handled: true,
      reason: "clarification_replied",
      contextMeta: buildRepoContextMeta({
        targetEntity: semanticPlan?.targetEntity,
        targetPath: semanticPlan?.targetPath,
        displayMode: semanticPlan?.displayMode,
        sourceText: trimmed,
      }),
    };
  }

  if (semanticPlan.intent === "repo_status") {
    const text = humanRepoStatusReply({
      snapshot: latest,
      filesCount: snapshotState.filesCount,
    });

    await replyHuman(replyAndLog, text, {
      event: "repo_conversation_status",
      ...buildRepoContextMeta({
        targetEntity: "",
        targetPath: "",
        displayMode: "raw",
        sourceText: trimmed,
      }),
    });

    return {
      handled: true,
      reason: "repo_status_human",
      contextMeta: buildRepoContextMeta({
        targetEntity: "",
        targetPath: "",
        displayMode: "raw",
        sourceText: trimmed,
      }),
    };
  }

  if (semanticPlan.intent === "show_tree") {
    const prefix = normalizePath(semanticPlan.treePrefix || followupContext?.treePrefix || "");
    const allPaths = await fetchPathsByPrefix(latest.id, prefix);
    const { directories, files } = computeImmediateChildren(allPaths, prefix);

    const maxDirs = 20;
    const maxFiles = 20;

    const shownDirectories = directories.slice(0, maxDirs);
    const shownFiles = files.slice(0, maxFiles);
    const hiddenCount =
      Math.max(0, directories.length - shownDirectories.length) +
      Math.max(0, files.length - shownFiles.length);

    const text = humanTreeReply({
      prefix,
      directories: shownDirectories,
      files: shownFiles,
      hiddenCount,
    });

    await replyHuman(replyAndLog, text, {
      event: "repo_conversation_tree",
      ...buildRepoContextMeta({
        targetEntity: "",
        targetPath: "",
        displayMode: "raw",
        sourceText: trimmed,
        treePrefix: prefix,
      }),
    });

    return {
      handled: true,
      reason: "repo_tree_human",
      contextMeta: buildRepoContextMeta({
        targetEntity: "",
        targetPath: "",
        displayMode: "raw",
        sourceText: trimmed,
        treePrefix: prefix,
      }),
    };
  }

  if (semanticPlan.intent === "find_target") {
    const query = safeText(semanticPlan.targetEntity || semanticPlan.targetPath);
    const matches = await searchSnapshotPaths(latest.id, query, 8);

    const text = humanSearchReply({
      targetEntity: query,
      matches,
    });

    const singlePath = matches.length === 1 ? matches[0] : "";

    await replyHuman(replyAndLog, text, {
      event: "repo_conversation_search",
      ...buildRepoContextMeta({
        targetEntity: semanticPlan.targetEntity || query,
        targetPath: singlePath,
        displayMode: "raw",
        sourceText: trimmed,
      }),
    });

    return {
      handled: true,
      reason: "repo_search_human",
      contextMeta: buildRepoContextMeta({
        targetEntity: semanticPlan.targetEntity || query,
        targetPath: singlePath,
        displayMode: "raw",
        sourceText: trimmed,
      }),
    };
  }

  if (semanticPlan.intent === "find_and_explain") {
    const query = safeText(semanticPlan.targetEntity || semanticPlan.targetPath);
    const matches = await searchSnapshotPaths(latest.id, query, 8);
    const targetPath = pickLikelyTargetPath({
      semanticPlan,
      searchMatches: matches,
      followupContext,
      pendingChoiceContext,
    });

    if (!targetPath) {
      const text = humanSearchReply({
        targetEntity: query,
        matches,
      });

      await replyHuman(replyAndLog, text, {
        event: "repo_conversation_find_and_explain_search_only",
        ...buildRepoContextMeta({
          targetEntity: semanticPlan.targetEntity || query,
          targetPath: "",
          displayMode: semanticPlan.displayMode,
          sourceText: trimmed,
        }),
      });

      return {
        handled: true,
        reason: "find_and_explain_search_only",
        contextMeta: buildRepoContextMeta({
          targetEntity: semanticPlan.targetEntity || query,
          targetPath: "",
          displayMode: semanticPlan.displayMode,
          sourceText: trimmed,
        }),
      };
    }

    const exists = await pathExistsInSnapshot(latest.id, targetPath);
    if (!exists) {
      await replyHuman(
        replyAndLog,
        `Я понял, что нужно найти и объяснить \`${query || targetPath}\`, но не смог безопасно подтвердить путь в текущем индексе репозитория.`,
        {
          event: "repo_conversation_find_and_explain_missing",
        }
      );

      return {
        handled: true,
        reason: "find_and_explain_missing",
      };
    }

    const content = await fetchRepoFileText({ path: targetPath, repo, branch, token });
    if (!content) {
      await replyHuman(
        replyAndLog,
        `Я нашёл файл \`${targetPath}\`, но не смог прочитать его содержимое.`,
        {
          event: "repo_conversation_find_and_explain_fetch_failed",
        }
      );
      return {
        handled: true,
        reason: "find_and_explain_fetch_failed",
      };
    }

    const AI_SAFE_DOC_CHARS = 12000;
    if (content.length > AI_SAFE_DOC_CHARS) {
      const text = humanLargeDocumentReply({ path: targetPath });

      const contextMeta = buildRepoContextMeta({
        targetEntity: semanticPlan.targetEntity || query,
        targetPath,
        displayMode: semanticPlan.displayMode,
        sourceText: trimmed,
        largeDocument: true,
        pendingChoice: {
          isActive: true,
          kind: "large_doc_action",
          targetEntity: semanticPlan.targetEntity || query,
          targetPath,
          displayMode: semanticPlan.displayMode,
        },
      });

      await replyHuman(replyAndLog, text, {
        event: "repo_conversation_find_and_explain_large_doc",
        ...contextMeta,
      });

      return {
        handled: true,
        reason: "find_and_explain_large_doc",
        contextMeta,
      };
    }

    const aiReply = await callAI(
      buildAiMessages({
        userText: trimmed,
        path: targetPath,
        content,
        displayMode: semanticPlan.displayMode || "explain",
      }),
      "high",
      {
        max_completion_tokens: 550,
        temperature: 0.35,
      }
    );

    const contextMeta = buildRepoContextMeta({
      targetEntity: semanticPlan.targetEntity || query,
      targetPath,
      displayMode: semanticPlan.displayMode || "explain",
      sourceText: trimmed,
      largeDocument: false,
    });

    await replyHuman(
      replyAndLog,
      safeText(aiReply) || "Я нашёл документ, но не смог нормально сформулировать объяснение.",
      {
        event: "repo_conversation_find_and_explain_ai",
        ...contextMeta,
      }
    );

    return {
      handled: true,
      reason: "find_and_explain_ai",
      contextMeta,
    };
  }

  if (semanticPlan.intent === "open_target") {
    const targetPath = pickLikelyTargetPath({
      semanticPlan,
      followupContext,
      pendingChoiceContext,
    });

    if (!targetPath) {
      const text = humanClarificationReply("Какой именно файл или документ открыть?");
      await replyHuman(replyAndLog, text, {
        event: "repo_conversation_open_clarification",
      });
      return { handled: true, reason: "open_clarification" };
    }

    const exists = await pathExistsInSnapshot(latest.id, targetPath);
    if (!exists) {
      await replyHuman(
        replyAndLog,
        `Я понял, какой файл ты имеешь в виду, но не нашёл его в текущем индексе репозитория: \`${targetPath}\`.`,
        {
          event: "repo_conversation_open_missing",
        }
      );
      return { handled: true, reason: "open_missing" };
    }

    const content = await fetchRepoFileText({ path: targetPath, repo, branch, token });
    if (!content) {
      await replyHuman(
        replyAndLog,
        `Я нашёл путь \`${targetPath}\`, но не смог прочитать содержимое файла.`,
        {
          event: "repo_conversation_open_fetch_failed",
        }
      );
      return { handled: true, reason: "open_fetch_failed" };
    }

    const INLINE_LIMIT = 2600;
    if (content.length > INLINE_LIMIT) {
      const text = humanLargeDocumentReply({ path: targetPath });

      const contextMeta = buildRepoContextMeta({
        targetEntity: semanticPlan.targetEntity,
        targetPath,
        displayMode: "raw",
        sourceText: trimmed,
        largeDocument: true,
        pendingChoice: {
          isActive: true,
          kind: "large_doc_action",
          targetEntity: semanticPlan.targetEntity,
          targetPath,
          displayMode: "summary",
        },
      });

      await replyHuman(replyAndLog, text, {
        event: "repo_conversation_open_large_doc",
        ...contextMeta,
      });

      return {
        handled: true,
        reason: "open_large_doc",
        contextMeta,
      };
    }

    const preview = content.length > INLINE_LIMIT ? content.slice(0, INLINE_LIMIT) : content;
    const wasTrimmed = content.length > INLINE_LIMIT;

    const contextMeta = buildRepoContextMeta({
      targetEntity: semanticPlan.targetEntity,
      targetPath,
      displayMode: "raw",
      sourceText: trimmed,
      largeDocument: false,
    });

    await replyHuman(
      replyAndLog,
      humanSmallDocumentReply({
        path: targetPath,
        content: preview,
        wasTrimmed,
      }),
      {
        event: "repo_conversation_open_small_doc",
        ...contextMeta,
      }
    );

    return {
      handled: true,
      reason: "open_small_doc",
      contextMeta,
    };
  }

  if (
    semanticPlan.intent === "explain_target" ||
    semanticPlan.intent === "explain_active" ||
    semanticPlan.intent === "answer_pending_choice"
  ) {
    const effectiveDisplayMode =
      safeText(semanticPlan.displayMode) ||
      safeText(pendingChoiceContext?.displayMode) ||
      safeText(followupContext?.displayMode) ||
      "explain";

    const targetPath = pickLikelyTargetPath({
      semanticPlan,
      followupContext,
      pendingChoiceContext,
    });

    if (!targetPath) {
      const text = humanClarificationReply("Что именно нужно объяснить?");
      await replyHuman(replyAndLog, text, {
        event: "repo_conversation_explain_clarification",
      });
      return { handled: true, reason: "explain_clarification" };
    }

    const exists = await pathExistsInSnapshot(latest.id, targetPath);
    if (!exists) {
      await replyHuman(
        replyAndLog,
        `Я понял, что нужно объяснить файл \`${targetPath}\`, но не нашёл его в текущем индексе репозитория.`,
        {
          event: "repo_conversation_explain_missing",
        }
      );
      return { handled: true, reason: "explain_missing" };
    }

    const content = await fetchRepoFileText({ path: targetPath, repo, branch, token });
    if (!content) {
      await replyHuman(
        replyAndLog,
        `Я нашёл путь \`${targetPath}\`, но не смог прочитать сам файл.`,
        {
          event: "repo_conversation_explain_fetch_failed",
        }
      );
      return { handled: true, reason: "explain_fetch_failed" };
    }

    const AI_SAFE_DOC_CHARS = 12000;
    if (content.length > AI_SAFE_DOC_CHARS) {
      const text = humanLargeDocumentReply({ path: targetPath });

      const contextMeta = buildRepoContextMeta({
        targetEntity: semanticPlan.targetEntity || followupContext?.targetEntity || pendingChoiceContext?.targetEntity,
        targetPath,
        displayMode: effectiveDisplayMode,
        sourceText: trimmed,
        largeDocument: true,
        pendingChoice: {
          isActive: true,
          kind: "large_doc_action",
          targetEntity: semanticPlan.targetEntity || followupContext?.targetEntity || pendingChoiceContext?.targetEntity,
          targetPath,
          displayMode: effectiveDisplayMode,
        },
      });

      await replyHuman(replyAndLog, text, {
        event: "repo_conversation_explain_large_doc",
        ...contextMeta,
      });

      return {
        handled: true,
        reason: "explain_large_doc",
        contextMeta,
      };
    }

    const aiReply = await callAI(
      buildAiMessages({
        userText: trimmed,
        path: targetPath,
        content,
        displayMode: effectiveDisplayMode,
      }),
      "high",
      {
        max_completion_tokens: 550,
        temperature: 0.35,
      }
    );

    const contextMeta = buildRepoContextMeta({
      targetEntity: semanticPlan.targetEntity || followupContext?.targetEntity || pendingChoiceContext?.targetEntity,
      targetPath,
      displayMode: effectiveDisplayMode,
      sourceText: trimmed,
      largeDocument: false,
    });

    await replyHuman(
      replyAndLog,
      safeText(aiReply) || "Я прочитал документ, но не смог нормально сформулировать объяснение.",
      {
        event: "repo_conversation_explain_ai",
        ...contextMeta,
      }
    );

    return {
      handled: true,
      reason: "explain_ai",
      contextMeta,
    };
  }

  return {
    handled: false,
    reason: "conversation_layer_skipped",
  };
}

export default {
  buildProjectIntentRoutingText,
  getLatestProjectIntentRepoContext,
  getLatestProjectIntentPendingChoice,
  runProjectIntentConversationFlow,
};