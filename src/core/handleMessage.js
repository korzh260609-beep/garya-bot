// AGENT NOTE:
// SG 2.0 minimal core message handler.
// Purpose: route normalized messages through identity, access checks, prompt boundary, and AI without putting logic into transport.
// Do not turn this into a monolith; split capabilities as soon as new responsibilities appear.

import { callAI } from "../ai/callAI.js";
import { buildSgSystemPrompt } from "./sgSystemPrompt.js";
import { checkEarlyAccess } from "../permissions/monarchGate.js";
import { resolveIdentity } from "../users/identityResolver.js";

function extractGithubApprovalIdFromReply(reply = "") {
  const match = String(reply || "").match(/\bSG-WRITE-[A-F0-9]{8,16}\b/i);
  return match ? match[0].toUpperCase() : null;
}

export async function handleMessage(context = {}) {
  const text = String(context.text || "").trim();
  const identity = resolveIdentity(context);

  if (!text) {
    return {
      ok: true,
      reply: "Я получил сообщение, но в нём нет текста для ответа.",
      identity,
    };
  }

  const access = checkEarlyAccess({ userId: identity.platformUserId });

  if (!access.allowed) {
    return {
      ok: false,
      reply: "Сейчас я доступен только монарху на этапе основания SG 2.0.",
      reason: access.reason,
      identity,
    };
  }

  const aiResult = await callAI(
    [
      { role: "system", content: buildSgSystemPrompt(identity) },
      { role: "user", content: text },
    ],
    {
      maxOutputTokens: 500,
      identity,
      latestUserText: text,
      returnMetadata: true,
    }
  );

  const reply = aiResult.text;
  const githubApprovalId =
    aiResult?.metadata?.githubApproval?.approvalId || extractGithubApprovalIdFromReply(reply);

  return {
    ok: true,
    reply: aiResult?.metadata?.githubApproval?.warning || reply,
    identity,
    githubApproval: githubApprovalId
      ? {
          approvalId: githubApprovalId,
          requestHash: aiResult?.metadata?.githubApproval?.requestHash || null,
          summary: aiResult?.metadata?.githubApproval?.summary || null,
          expiresAt: aiResult?.metadata?.githubApproval?.expiresAt || null,
        }
      : null,
  };
}
