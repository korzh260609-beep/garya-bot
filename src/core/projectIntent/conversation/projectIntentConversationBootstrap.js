// src/core/projectIntent/conversation/projectIntentConversationBootstrap.js

import { loadLatestSnapshot } from "../projectIntentConversationRepoStore.js";
import { replyHuman } from "../projectIntentConversationReplies.js";

export async function prepareRepoConversationRuntime({
  route,
  replyAndLog,
}) {
  if (route?.routeKey !== "sg_core_internal_read_allowed") {
    return {
      ok: false,
      handled: false,
      reason: "not_internal_repo_read",
    };
  }

  const snapshotState = await loadLatestSnapshot();

  if (!snapshotState.ok || !snapshotState.latest) {
    await replyHuman(
      replyAndLog,
      "Индекс репозитория пока не готов. Нужен актуальный снимок репозитория.",
      {
        event: "repo_conversation_no_snapshot",
      }
    );

    return {
      ok: false,
      handled: true,
      reason: "no_snapshot",
    };
  }

  return {
    ok: true,
    handled: false,
    reason: "runtime_ready",
    snapshotState,
    latest: snapshotState.latest,
    repo: snapshotState.repo,
    branch: snapshotState.branch,
    token: process.env.GITHUB_TOKEN,
  };
}

export default {
  prepareRepoConversationRuntime,
};