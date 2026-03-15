// src/bot/router/sourceDomainCommands.js

import { handleSourcesList } from "../handlers/sourcesList.js";
import { handleSourcesDiag } from "../handlers/sources_diag.js";
import { handleSource } from "../handlers/source.js";
import { handleDiagSource } from "../handlers/diagSource.js";
import { handleTestSource } from "../handlers/testSource.js";

export async function handleSourceDomainCommands({
  cmdBase,
  bot,
  chatId,
  rest,
  userRole,
  userPlan,
  bypass,
}) {
  if (cmdBase === "/sources") {
    await handleSourcesList({
      bot,
      chatId,
      listSources: async ({ userRole, userPlan }) => {
        const { getAllSourcesSafe } = await import("../sources/sources.js");
        return await getAllSourcesSafe({ userRole, userPlan });
      },
      userRole,
      userPlan,
      bypass,
    });
    return true;
  }

  if (cmdBase === "/sources_diag") {
    await handleSourcesDiag({
      bot,
      chatId,
      userRole,
      userPlan,
      bypass,
    });
    return true;
  }

  if (cmdBase === "/source") {
    await handleSource({
      bot,
      chatId,
      rest,
      userRole,
      userPlan,
      bypass,
    });
    return true;
  }

  if (cmdBase === "/diag_source") {
    await handleDiagSource({
      bot,
      chatId,
      rest,
      userRole,
      userPlan,
      bypass,
    });
    return true;
  }

  if (cmdBase === "/test_source") {
    await handleTestSource({
      bot,
      chatId,
      rest,
      userRole,
      userPlan,
      bypass,
    });
    return true;
  }

  return false;
}