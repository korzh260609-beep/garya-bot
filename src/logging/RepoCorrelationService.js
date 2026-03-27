// ============================================================================
// src/logging/RepoCorrelationService.js
// STAGE SKELETON — correlate log fingerprint with probable repo locations
// Purpose:
// - convert path/module hints into probable repo file candidates
// - optionally enrich with repo search/fetch callbacks
// IMPORTANT:
// - no fake certainty
// - if repo search is unavailable, return probable hints only
// - exact line numbers are only reliable when stack/path hints exist
// ============================================================================

import {
  getRenderLogDiagConfig,
} from "./renderLogConfig.js";

function safeStr(v) {
  return v === null || v === undefined ? "" : String(v);
}

function uniqueNonEmpty(values = []) {
  const out = [];
  const seen = new Set();

  for (const value of values) {
    const v = safeStr(value).trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }

  return out;
}

function fileNameOnly(pathValue) {
  const s = safeStr(pathValue).trim();
  if (!s) return "";
  const parts = s.split("/");
  return parts[parts.length - 1] || s;
}

function normalizeRepoPathHint(pathValue) {
  let s = safeStr(pathValue).trim();
  if (!s) return "";

  s = s.replace(/^file:\/\//, "");
  s = s.replace(/\\/g, "/");

  const srcIndex = s.indexOf("src/");
  if (srcIndex >= 0) {
    s = s.slice(srcIndex);
  }

  s = s.replace(/\/+/g, "/");

  while (s.startsWith("src/src/")) {
    s = s.slice(4);
  }

  return s;
}

function inferCandidatesFromFingerprint(fp = {}) {
  const out = [];

  for (const pathHint of fp.pathHints || []) {
    const normalized = normalizeRepoPathHint(pathHint);
    if (normalized) {
      out.push({
        path: normalized,
        reason: "stack_path_hint",
        score: 100,
      });
    }
  }

  for (const moduleHint of fp.moduleHints || []) {
    const mh = safeStr(moduleHint);

    if (!mh) continue;

    if (/Service$/.test(mh)) {
      out.push({
        path: `src/logging/${mh}.js`,
        reason: "service_name_hint",
        score: 55,
      });
      out.push({
        path: `src/core/${mh}.js`,
        reason: "service_name_hint",
        score: 50,
      });
    }

    if (/Core$/.test(mh)) {
      out.push({
        path: `src/core/${mh}.js`,
        reason: "core_name_hint",
        score: 60,
      });
    }

    if (/Handler$/i.test(mh)) {
      out.push({
        path: `src/bot/handlers/${mh}.js`,
        reason: "handler_name_hint",
        score: 55,
      });
    }

    if (mh === "messageRouter") {
      out.push({
        path: "src/bot/messageRouter.js",
        reason: "well_known_module_hint",
        score: 70,
      });
    }

    if (mh === "handleMessage") {
      out.push({
        path: "src/core/handleMessage.js",
        reason: "well_known_module_hint",
        score: 65,
      });
    }

    if (mh === "MemoryService") {
      out.push({
        path: "src/core/MemoryService.js",
        reason: "well_known_module_hint",
        score: 70,
      });
    }

    if (mh === "BehaviorEventsService") {
      out.push({
        path: "src/logging/BehaviorEventsService.js",
        reason: "well_known_module_hint",
        score: 70,
      });
    }
  }

  return out;
}

function mergeCandidates(items = []) {
  const map = new Map();

  for (const item of items) {
    const path = safeStr(item?.path).trim();
    if (!path) continue;

    const current = map.get(path);
    if (!current) {
      map.set(path, {
        path,
        score: Number(item?.score || 0),
        reasons: [safeStr(item?.reason).trim()].filter(Boolean),
      });
      continue;
    }

    current.score = Math.max(current.score, Number(item?.score || 0));

    const reason = safeStr(item?.reason).trim();
    if (reason && !current.reasons.includes(reason)) {
      current.reasons.push(reason);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}

function buildLineWindow(lineHints = [], radius = 8) {
  const valid = (lineHints || []).filter((n) => Number.isFinite(n) && n > 0);
  if (valid.length === 0) {
    return {
      exactLine: null,
      startLine: null,
      endLine: null,
    };
  }

  const exactLine = valid[0];
  return {
    exactLine,
    startLine: Math.max(1, exactLine - radius),
    endLine: exactLine + radius,
  };
}

function confidenceFromCorrelation(fp = {}, topCandidate) {
  if (
    fp.confidence === "high" &&
    topCandidate &&
    topCandidate.score >= 90 &&
    Array.isArray(fp.lineHints) &&
    fp.lineHints.length > 0
  ) {
    return "high";
  }

  if (topCandidate && topCandidate.score >= 70) {
    return "medium";
  }

  if (topCandidate) {
    return "low";
  }

  return "very_low";
}

export class RepoCorrelationService {
  constructor(opts = {}) {
    this.config = {
      ...getRenderLogDiagConfig(),
      ...(opts.config || {}),
    };

    // Optional hooks for future real repo correlation:
    // - searchRepo({ query, limit })
    // - fetchFileContext({ path, startLine, endLine })
    this.searchRepo = typeof opts.searchRepo === "function" ? opts.searchRepo : null;
    this.fetchFileContext =
      typeof opts.fetchFileContext === "function" ? opts.fetchFileContext : null;
  }

  async correlate(fingerprint = {}) {
    const inferred = inferCandidatesFromFingerprint(fingerprint);
    const merged = mergeCandidates(inferred).slice(
      0,
      this.config.maxFileCandidates
    );

    let enriched = merged;

    // Future extension point:
    // if searchRepo exists and path hints are weak, use module/file-name hints.
    if (this.searchRepo && merged.length === 0) {
      const queryHints = uniqueNonEmpty([
        ...(fingerprint.pathHints || []).map(fileNameOnly),
        ...(fingerprint.moduleHints || []),
        ...(fingerprint.functionHints || []),
      ]).slice(0, 3);

      for (const query of queryHints) {
        try {
          const repoResults = await this.searchRepo({
            query,
            limit: this.config.maxFileCandidates,
          });

          if (Array.isArray(repoResults) && repoResults.length > 0) {
            const mapped = repoResults.map((r) => ({
              path: safeStr(r?.path || "").trim(),
              reason: "repo_search_hint",
              score: 45,
            }));

            enriched = mergeCandidates([...merged, ...mapped]).slice(
              0,
              this.config.maxFileCandidates
            );
            break;
          }
        } catch (_) {
          // no crash on optional correlation hook failure
        }
      }
    }

    const topCandidate = enriched[0] || null;
    const lineWindow = buildLineWindow(fingerprint.lineHints || []);
    let codeContext = null;

    if (
      topCandidate &&
      this.fetchFileContext &&
      lineWindow.startLine &&
      lineWindow.endLine
    ) {
      try {
        codeContext = await this.fetchFileContext({
          path: topCandidate.path,
          startLine: lineWindow.startLine,
          endLine: lineWindow.endLine,
        });
      } catch (_) {
        codeContext = null;
      }
    }

    return {
      ok: true,
      confidence: confidenceFromCorrelation(fingerprint, topCandidate),
      topCandidate,
      candidates: enriched,
      lineWindow,
      codeContext,
      correlationVersion: "repo_corr_v1",
    };
  }
}

export default RepoCorrelationService;