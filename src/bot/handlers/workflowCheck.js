// ============================================================================
// src/bot/handlers/workflowCheck.js
// Stage 5.3 — Workflow check (READ-ONLY, NO AI)
// V1: real file/path/search verification based on WORKFLOW_HINTS.json
// ============================================================================

import fs from "fs";
import path from "path";
import pool from "../../../db.js";
import { RepoIndexStore } from "../../repo/RepoIndexStore.js";
import { requireMonarchAccess } from "./handlerAccess.js";

function loadWorkflowHints() {
  const filePath = path.resolve("pillars/WORKFLOW_HINTS.json");
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function safeReadText(absPath) {
  try {
    if (!fs.existsSync(absPath)) return null;
    return fs.readFileSync(absPath, "utf8");
  } catch (_) {
    return null;
  }
}

function normalizeText(value) {
  return String(value || "").toLowerCase();
}

function checkPaths(pathsList = []) {
  const results = [];

  for (const relPath of pathsList) {
    const absPath = path.resolve(relPath);
    const exists = fs.existsSync(absPath);

    results.push({
      path: relPath,
      exists,
    });
  }

  return results;
}

function checkSearchTerms(pathsList = [], searchTerms = []) {
  const fileCache = new Map();

  for (const relPath of pathsList) {
    const absPath = path.resolve(relPath);
    const content = safeReadText(absPath);
    fileCache.set(relPath, normalizeText(content));
  }

  const results = [];

  for (const term of searchTerms) {
    const needle = normalizeText(term).trim();

    let found = false;
    let foundIn = null;

    for (const relPath of pathsList) {
      const pathText = normalizeText(relPath);
      const fileText = fileCache.get(relPath) || "";

      if (pathText.includes(needle) || fileText.includes(needle)) {
        found = true;
        foundIn = relPath;
        break;
      }
    }

    results.push({
      term,
      found,
      foundIn,
    });
  }

  return results;
}

function computeStatus(pathChecks = [], searchChecks = []) {
  const totalPaths = pathChecks.length;
  const foundPaths = pathChecks.filter((x) => x.exists).length;

  const totalSearch = searchChecks.length;
  const foundSearch = searchChecks.filter((x) => x.found).length;

  const allPathsOk = totalPaths === 0 ? true : foundPaths === totalPaths;
  const allSearchOk = totalSearch === 0 ? true : foundSearch === totalSearch;

  const anyPathOk = foundPaths > 0;
  const anySearchOk = foundSearch > 0;

  if (allPathsOk && allSearchOk) return "done";
  if (anyPathOk || anySearchOk) return "needs_review";
  return "todo";
}

function buildReply({
  step,
  cfg,
  status,
  pathChecks,
  searchChecks,
  repoSnapshotNote,
}) {
  const totalPaths = pathChecks.length;
  const foundPaths = pathChecks.filter((x) => x.exists).length;

  const totalSearch = searchChecks.length;
  const foundSearch = searchChecks.filter((x) => x.found).length;

  const missingPaths = pathChecks.filter((x) => !x.exists).map((x) => x.path);
  const missingTerms = searchChecks.filter((x) => !x.found).map((x) => x.term);

  const lines = [
    "WORKFLOW CHECK",
    `step: ${step}`,
    `title: ${cfg.title || "-"}`,
    "",
    `status: ${status}`,
    `paths: ${foundPaths}/${totalPaths}`,
    `search: ${foundSearch}/${totalSearch}`,
  ];

  if (repoSnapshotNote) {
    lines.push(repoSnapshotNote);
  }

  if (cfg.notes) {
    lines.push("");
    lines.push(`notes: ${cfg.notes}`);
  }

  if (missingPaths.length > 0) {
    lines.push("");
    lines.push("missing_paths:");
    for (const p of missingPaths.slice(0, 10)) {
      lines.push(`- ${p}`);
    }
  }

  if (missingTerms.length > 0) {
    lines.push("");
    lines.push("missing_search_terms:");
    for (const term of missingTerms.slice(0, 10)) {
      lines.push(`- ${term}`);
    }
  }

  const foundTermSamples = searchChecks.filter((x) => x.found).slice(0, 5);
  if (foundTermSamples.length > 0) {
    lines.push("");
    lines.push("found_search_terms:");
    for (const item of foundTermSamples) {
      lines.push(`- ${item.term} -> ${item.foundIn}`);
    }
  }

  return lines.join("\n").slice(0, 3900);
}

export async function handleWorkflowCheck(ctx = {}) {
  const ok = await requireMonarchAccess(ctx);
  if (!ok) return;

  const { bot, chatId, rest } = ctx;

  const step = String(rest || "").trim();
  if (!step) {
    await bot.sendMessage(chatId, "Usage: /workflow_check <step>");
    return;
  }

  let hints;
  try {
    hints = loadWorkflowHints();
  } catch (e) {
    await bot.sendMessage(chatId, "WorkflowCheck: failed to load WORKFLOW_HINTS.json");
    return;
  }

  const cfg = hints.steps?.[step];

  if (!cfg) {
    await bot.sendMessage(chatId, `WorkflowCheck: unknown step "${step}"`);
    return;
  }

  const pathsList = Array.isArray(cfg.paths) ? cfg.paths : [];
  const searchTerms = Array.isArray(cfg.search) ? cfg.search : [];

  const pathChecks = checkPaths(pathsList);
  const searchChecks = checkSearchTerms(pathsList, searchTerms);
  const status = computeStatus(pathChecks, searchChecks);

  let repoSnapshotNote = "";
  try {
    const repo = process.env.GITHUB_REPO;
    const branch = process.env.GITHUB_BRANCH;

    const store = new RepoIndexStore({ pool });
    const latest = await store.getLatestSnapshot({ repo, branch });

    if (latest?.id) {
      repoSnapshotNote = `repo_snapshot_id: ${latest.id}`;
    }
  } catch (_) {
    // fail-open
  }

  const reply = buildReply({
    step,
    cfg,
    status,
    pathChecks,
    searchChecks,
    repoSnapshotNote,
  });

  await bot.sendMessage(chatId, reply);
}