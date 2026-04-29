// src/core/projectIntent/modes/technical/conversation/projectIntentTechnicalTargetResolver.js
// ============================================================================
// TECHNICAL MODE TARGET RESOLVER
//
// INTERFACE MODE NOTE:
// - This module resolves repo targets for legacy Technical Mode semantic plans
//   and follow-up contexts.
// - This is not Human Mode intelligence.
// - Future Human Mode target resolution must live behind a separate boundary and
//   use meaning/context/permissions with RepoStateAgent-backed facts.
// ============================================================================

import {
  pathExistsInSnapshot,
  pathKindInSnapshot,
  pickLikelyTargetPath,
} from "../../../projectIntentConversationRepoStore.js";
import { safeText } from "../../../projectIntentConversationShared.js";
import { inferObjectKindFromPath } from "../../../conversation/projectIntentConversationHelpers.js";

export async function resolveTargetObject({
  latestSnapshotId,
  semanticPlan,
  followupContext,
  pendingChoiceContext,
  rawTarget,
  searchMatches,
}) {
  const targetPath = pickLikelyTargetPath({
    semanticPlan,
    searchMatches,
    followupContext,
    pendingChoiceContext,
  });

  if (!targetPath) {
    return {
      ok: false,
      targetPath: "",
      objectKind: "unknown",
      exists: false,
    };
  }

  const exists = await pathExistsInSnapshot(latestSnapshotId, targetPath);
  if (!exists) {
    return {
      ok: false,
      targetPath,
      objectKind: "unknown",
      exists: false,
    };
  }

  const snapshotKind = await pathKindInSnapshot(latestSnapshotId, targetPath);
  const objectKind =
    safeText(snapshotKind) ||
    safeText(semanticPlan?.objectKind) ||
    inferObjectKindFromPath(targetPath) ||
    inferObjectKindFromPath(rawTarget);

  return {
    ok: true,
    targetPath,
    objectKind: safeText(objectKind || "unknown"),
    exists: true,
  };
}

export default {
  resolveTargetObject,
};
