// src/core/projectIntent/readPlan/projectIntentReadPlanTargets.js

import {
  PILLAR_FILE_RULES,
  ENTITY_RULES,
  PATH_HINT_PATTERNS,
} from "./projectIntentReadPlanConstants.js";
import {
  collectPhraseHits,
} from "./projectIntentReadPlanSignals.js";
import {
  unique,
} from "./projectIntentReadPlanText.js";

export function safeTargetKind(value) {
  const v = String(value || "").trim();
  return v || "unknown";
}

export function extractPathHints(text) {
  const raw = String(text || "");
  const hits = [];

  for (const pattern of PATH_HINT_PATTERNS) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      hits.push(String(match[1]).trim());
    }
  }

  return unique(hits);
}

export function resolvePillarFileMatch(normalized) {
  for (const rule of PILLAR_FILE_RULES) {
    const phraseHits = collectPhraseHits(normalized, rule.phrases || []);
    if (phraseHits.length > 0) {
      return {
        canonicalPillarPath: rule.path,
        canonicalPillarBasis: rule.basis,
        canonicalPillarPhraseHits: phraseHits,
        canonicalPillarTokenHits: [],
        canonicalPillarEntity: rule.entity,
      };
    }
  }

  return {
    canonicalPillarPath: "",
    canonicalPillarBasis: "",
    canonicalPillarPhraseHits: [],
    canonicalPillarTokenHits: [],
    canonicalPillarEntity: "",
  };
}

export function resolveSemanticTarget({
  normalized,
  pathHints,
  hasPillarsRootSignal,
  canonicalPillarPath,
  canonicalPillarEntity,
  followupContext = null,
}) {
  if (pathHints.length > 0) {
    return {
      targetKind: "path",
      targetEntity: pathHints[0],
      targetPath: pathHints[0],
      targetBasis: ["explicit_path_hint"],
    };
  }

  for (const rule of ENTITY_RULES) {
    const phraseHits = collectPhraseHits(normalized, rule.phrases || []);
    if (phraseHits.length > 0) {
      return {
        targetKind: rule.targetKind,
        targetEntity: rule.entity,
        targetPath: rule.path || "",
        targetBasis: [`entity:${rule.entity}`],
      };
    }
  }

  if (canonicalPillarPath) {
    return {
      targetKind: "canonical_doc",
      targetEntity: canonicalPillarEntity || canonicalPillarPath,
      targetPath: canonicalPillarPath,
      targetBasis: ["canonical_pillar_exact"],
    };
  }

  if (hasPillarsRootSignal) {
    return {
      targetKind: "repo_scope",
      targetEntity: "pillars",
      targetPath: "pillars/",
      targetBasis: ["pillars_root_scope"],
    };
  }

  if (followupContext?.isActive) {
    return {
      targetKind: safeTargetKind(followupContext.targetKind),
      targetEntity: String(followupContext.targetEntity || "").trim(),
      targetPath: String(followupContext.targetPath || "").trim(),
      targetBasis: ["followup_repo_context"],
    };
  }

  return {
    targetKind: "unknown",
    targetEntity: "",
    targetPath: "",
    targetBasis: [],
  };
}

export default {
  safeTargetKind,
  extractPathHints,
  resolvePillarFileMatch,
  resolveSemanticTarget,
};