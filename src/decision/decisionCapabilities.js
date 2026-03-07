import { DECISION_KIND } from "./decisionTypes.js";

export const DECISION_CAPABILITIES = [
  {
    name: "price_command",
    match(context = {}) {
      const command = typeof context.command === "string" ? context.command.trim().toLowerCase() : "";
      return command === "/price";
    },
    route: {
      kind: DECISION_KIND.SOURCE_QUERY,
      needsAI: false,
      workerType: "source_query",
      judgeRequired: false,
      reason: "capability_price_command",
    },
  },

  {
    name: "repo_command",
    match(context = {}) {
      const command = typeof context.command === "string" ? context.command.trim().toLowerCase() : "";
      return command === "/repo";
    },
    route: {
      kind: DECISION_KIND.REPO_ANALYSIS,
      needsAI: false,
      workerType: "repo_analysis",
      judgeRequired: true,
      reason: "capability_repo_command",
    },
  },

  {
    name: "diag_command",
    match(context = {}) {
      const command = typeof context.command === "string" ? context.command.trim().toLowerCase() : "";
      return command === "/diag";
    },
    route: {
      kind: DECISION_KIND.SYSTEM_DIAG,
      needsAI: false,
      workerType: "system_diag",
      judgeRequired: true,
      reason: "capability_diag_command",
    },
  },

  {
    name: "task_command_fallback",
    match(context = {}) {
      const command = typeof context.command === "string" ? context.command.trim() : "";
      return Boolean(command);
    },
    route: {
      kind: DECISION_KIND.TASK_EXECUTION,
      needsAI: false,
      workerType: "command",
      judgeRequired: false,
      reason: "capability_generic_command",
    },
  },

  {
    name: "text_repo_analysis",
    match(context = {}) {
      const text = typeof context.text === "string" ? context.text.toLowerCase() : "";
      return text.includes("repo") || text.includes("repository") || text.includes("github");
    },
    route: {
      kind: DECISION_KIND.REPO_ANALYSIS,
      needsAI: false,
      workerType: "repo_analysis",
      judgeRequired: true,
      reason: "capability_text_repo_analysis",
    },
  },

  {
    name: "text_source_query",
    match(context = {}) {
      const text = typeof context.text === "string" ? context.text.toLowerCase() : "";
      return text.includes("price") || text.includes("coin") || text.includes("coingecko");
    },
    route: {
      kind: DECISION_KIND.SOURCE_QUERY,
      needsAI: false,
      workerType: "source_query",
      judgeRequired: false,
      reason: "capability_text_source_query",
    },
  },

  {
    name: "text_complex_chat",
    match(context = {}) {
      const text = typeof context.text === "string" ? context.text.trim() : "";
      return text.length > 280;
    },
    route: {
      kind: DECISION_KIND.CHAT_COMPLEX,
      needsAI: true,
      workerType: "chat",
      judgeRequired: true,
      reason: "capability_text_complex_chat",
    },
  },
];