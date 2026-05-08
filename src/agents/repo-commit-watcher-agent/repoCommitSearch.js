// AGENT NOTE:
// RepoCommitWatcherAgent commit search capability.
// Purpose: search GitHub commit history by intent using message, changed files, and patch text.
// Do not store full commit history here. GitHub remains the source of truth.

import { executeGitHubApiRequest } from "../../tools/github/githubApiClient.js";
import {
  getCurrentProjectBranch,
  getCurrentProjectRepository,
} from "../../tools/github/githubProjectDefaults.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_DETAILED_COMMITS = 12;
const MAX_RETURNED_MATCHES = 3;
const MAX_RETURNED_FILES = 5;

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function firstLine(value) {
  return normalizeString(value).split("\n")[0] || "";
}

function clampLimit(value, fallback = DEFAULT_LIMIT) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(MAX_LIMIT, Math.trunc(n)));
}

function tokenize(value) {
  return normalizeString(value)
    .toLowerCase()
    .split(/[^a-z0-9а-яіїєґ_-]+/iu)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2);
}

function uniqueTokens(tokens) {
  return [...new Set(Array.isArray(tokens) ? tokens : [])];
}

function textIncludesToken(text, token) {
  const haystack = normalizeString(text).toLowerCase();
  const needle = normalizeString(token).toLowerCase();
  return Boolean(haystack && needle && haystack.includes(needle));
}

function scoreCommitDetail(detail, queryTokens) {
  const commit = detail?.commit || {};
  const message = normalizeString(commit?.message);
  const files = Array.isArray(detail?.files) ? detail.files : [];
  const fileText = files.map((file) => normalizeString(file?.filename)).join("\n");
  const patchText = files.map((file) => normalizeString(file?.patch)).join("\n");

  let score = 0;
  const reasons = [];

  for (const token of queryTokens) {
    if (textIncludesToken(message, token)) {
      score += 5;
      reasons.push(`message:${token}`);
    }

    if (textIncludesToken(fileText, token)) {
      score += 4;
      reasons.push(`file:${token}`);
    }

    if (textIncludesToken(patchText, token)) {
      score += 2;
      reasons.push(`patch:${token}`);
    }
  }

  const changedFiles = files.map((file) => ({
    filename: file?.filename || "",
    status: file?.status || "modified",
    additions: Number(file?.additions || 0),
    deletions: Number(file?.deletions || 0),
    changes: Number(file?.changes || 0),
  }));

  return {
    score,
    reasons: uniqueTokens(reasons).slice(0, 6),
    changed_files: changedFiles,
  };
}

function compactMatch(match) {
  const changedFiles = Array.isArray(match?.changed_files) ? match.changed_files : [];

  return {
    sha: match.sha,
    short_sha: match.short_sha,
    date: match.date ? match.date.slice(0, 10) : "",
    message: firstLine(match.message),
    score: match.score,
    files: changedFiles.slice(0, MAX_RETURNED_FILES).map((file) => file.filename),
    files_count: changedFiles.length,
    url: match.html_url,
    reasons: Array.isArray(match.reasons) ? match.reasons.slice(0, 6) : [],
  };
}

function buildSummary({ query, matches }) {
  const top = matches[0] ? compactMatch(matches[0]) : null;

  if (!top) {
    return {
      found: false,
      text: `Комит по запросу не найден: ${query}`,
    };
  }

  return {
    found: true,
    text: [
      `Найден комит: ${top.short_sha}`,
      `Дата: ${top.date}`,
      `Сообщение: ${top.message}`,
      `Файлы: ${top.files.join(", ")}${top.files_count > top.files.length ? ` +${top.files_count - top.files.length}` : ""}`,
      `Ссылка: ${top.url}`,
    ].join("\n"),
    top_match: top,
  };
}

async function listCommits({ repo, branch, limit }) {
  const result = await executeGitHubApiRequest({
    method: "GET",
    path: `/repos/${repo}/commits`,
    query: {
      sha: branch,
      per_page: clampLimit(limit),
    },
  });

  if (!result.ok) {
    throw new Error(`commit_search_list_failed:${result.status}:${result.error || "unknown"}`);
  }

  return Array.isArray(result.data) ? result.data : [];
}

async function fetchCommitDetail({ repo, sha }) {
  const result = await executeGitHubApiRequest({
    method: "GET",
    path: `/repos/${repo}/commits/${encodeURIComponent(sha)}`,
  });

  if (!result.ok) {
    throw new Error(`commit_search_detail_failed:${result.status}:${result.error || "unknown"}`);
  }

  return result.data || null;
}

export async function findCommitsByIntent({ text, repo, branch, limit } = {}) {
  const safeText = normalizeString(text);
  const safeRepo = normalizeString(repo || getCurrentProjectRepository());
  const safeBranch = normalizeString(branch || getCurrentProjectBranch());
  const safeLimit = clampLimit(limit);
  const queryTokens = uniqueTokens(tokenize(safeText));

  if (!safeText) throw new Error("commit_search_text_missing");
  if (!safeRepo) throw new Error("commit_search_repo_missing");
  if (!safeBranch) throw new Error("commit_search_branch_missing");

  const commits = await listCommits({ repo: safeRepo, branch: safeBranch, limit: safeLimit });
  const detailed = [];

  for (const commit of commits.slice(0, MAX_DETAILED_COMMITS)) {
    const sha = normalizeString(commit?.sha);
    if (!sha) continue;

    const detail = await fetchCommitDetail({ repo: safeRepo, sha });
    const scored = scoreCommitDetail(detail, queryTokens);

    detailed.push({
      sha,
      short_sha: sha.slice(0, 12),
      message: normalizeString(detail?.commit?.message || commit?.commit?.message),
      author: normalizeString(detail?.author?.login || detail?.commit?.author?.name),
      date: normalizeString(detail?.commit?.author?.date || detail?.commit?.committer?.date),
      html_url: normalizeString(detail?.html_url || commit?.html_url),
      score: scored.score,
      reasons: scored.reasons,
      changed_files: scored.changed_files,
    });
  }

  const matches = detailed
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || String(b.date).localeCompare(String(a.date)));
  const compactMatches = matches.slice(0, MAX_RETURNED_MATCHES).map(compactMatch);
  const summary = buildSummary({ query: safeText, matches });

  return {
    ok: true,
    type: "repo_commit_search",
    compact: true,
    repo: safeRepo,
    branch: safeBranch,
    query: safeText,
    searched_commits: detailed.length,
    matches_count: matches.length,
    summary,
    matches: compactMatches,
  };
}

export default {
  findCommitsByIntent,
};
