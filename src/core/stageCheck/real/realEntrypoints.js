// ============================================================================
// === src/core/stageCheck/real/realEntrypoints.js
// === entrypoint discovery for real-evidence collector
// ============================================================================

import { safeFetchTextFile } from "../../../bot/handlers/stage-check/repoUtils.js";
import { uniq, stripQuotes, safeReadJson } from "./realEvidenceUtils.js";

export function parseNodeScriptEntrypoints(scriptText) {
  const text = String(scriptText || "");
  const matches = [];
  const regex = /node\s+(\.\/)?([A-Za-z0-9_./-]+\.(?:js|mjs|cjs|ts|mts|cts))/g;

  let m = null;
  while ((m = regex.exec(text))) {
    matches.push(stripQuotes(m[2] || ""));
  }

  return uniq(matches);
}

export async function discoverEntrypoints(evaluationCtx) {
  const entrypoints = [];

  if (evaluationCtx.fileSet.has("package.json")) {
    try {
      const pkg = await safeReadJson("package.json", evaluationCtx);
      if (pkg) {
        if (pkg?.main) {
          entrypoints.push(stripQuotes(pkg.main));
        }

        const scripts = pkg?.scripts || {};
        for (const value of Object.values(scripts)) {
          entrypoints.push(...parseNodeScriptEntrypoints(value));
        }
      }
    } catch (_) {}
  }

  for (const fallback of ["index.js", "src/index.js", "server.js", "app.js"]) {
    if (evaluationCtx.fileSet.has(fallback)) {
      entrypoints.push(fallback);
    }
  }

  return uniq(entrypoints).filter((x) => evaluationCtx.fileSet.has(x));
}

export default {
  parseNodeScriptEntrypoints,
  discoverEntrypoints,
};
