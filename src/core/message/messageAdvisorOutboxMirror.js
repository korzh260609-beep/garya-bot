// AGENT NOTE:
// SG 2.0 automatic Advisor Outbox mirror.
// Purpose: mirror diagnostic/test/runtime replies into agent_workspace/OUTBOX.md after SG forms a final reply.
// Do not add Telegram handling, AI calls, DB calls, source fetching, or broad repository writes here.

const DIAGNOSTIC_PATTERNS = [
  /\bworkflow\b/i,
  /\bsg2-smoke\b/i,
  /\bgithub actions\b/i,
  /\bgithub\b/i,
  /\brender\b/i,
  /\bdeploy\b/i,
  /\blogs?\b/i,
  /\bci\b/i,
  /\bcheck(s)?\b/i,
  /\bstatus\b/i,
  /\btest(s|ing)?\b/i,
  /\bdiagnos(tic|tics|is|e|e)?\b/i,
  /\bпроверь\b/i,
  /\bперевір\b/i,
  /\bпроверка\b/i,
  /\bперевірка\b/i,
  /\bтест(ы|ов|ування|и)?\b/i,
  /\bдиагностик(а|у|и)?\b/i,
  /\bдіагностик(а|у|и)?\b/i,
  /\bдеплой\b/i,
  /\bлоги\b/i,
  /\bстатус\b/i,
];

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function hasDiagnosticIntent(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  return DIAGNOSTIC_PATTERNS.some((pattern) => pattern.test(normalized));
}

function shouldMirrorAdvisorOutbox({ text, result, identity }) {
  if (!identity?.isMonarch) return false;
  if (!result?.ok) return false;
  if (!normalizeText(result?.reply)) return false;
  if (result?.githubApproval?.approvalId) return false;
  return hasDiagnosticIntent(text);
}

export async function mirrorAdvisorOutboxIfNeeded({ text, result, identity, context } = {}) {
  if (!shouldMirrorAdvisorOutbox({ text, result, identity })) {
    return {
      mirrored: false,
      reason: "not_diagnostic_or_not_allowed",
    };
  }

  try {
    const { runAdvisorOutboxAgent } = await import("../../agents/advisor-outbox-agent/advisorOutboxAgent.js");
    const writeResult = await runAdvisorOutboxAgent(
      {
        replyText: result.reply,
        commandText: text,
        source: context?.transport || "unknown",
        taskId: "auto-diagnostic",
      },
      {
        isMonarch: true,
        latestUserText: text,
        transport: context?.transport || "unknown",
      }
    );

    return {
      mirrored: Boolean(writeResult?.ok),
      result: writeResult,
    };
  } catch (error) {
    return {
      mirrored: false,
      error: error?.message || String(error),
    };
  }
}

export default {
  mirrorAdvisorOutboxIfNeeded,
};
