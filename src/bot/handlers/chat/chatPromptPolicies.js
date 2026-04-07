// src/bot/handlers/chat/chatPromptPolicies.js

export function buildMediaResponsePolicy(mediaResponseMode) {
  if (mediaResponseMode === "short_object_answer") {
    return [
      "MEDIA:",
      "- short answer about image/object",
      "- 1-2 short sentences",
      "- direct answer first",
      "- if unsure: 'Похоже на ...'",
    ].join("\n");
  }

  if (mediaResponseMode === "document_summary_answer") {
    return [
      "MEDIA:",
      "- short document summary",
      "- 1 short line of essence + 2-4 short points",
      "- do not output full text unless explicitly asked",
    ].join("\n");
  }

  if (mediaResponseMode === "document_full_text_answer") {
    return [
      "MEDIA:",
      "- user wants document text, not summary",
      "- output the text",
      "- if too long, give only part 1 and say it clearly",
    ].join("\n");
  }

  return "";
}

export function truncateReplyText(value, maxChars = 220) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars).trimEnd()} ...[reply truncated]`;
}

export function buildReplyContextSystemMessage(replyContext) {
  if (!replyContext?.exists) return null;

  const authorLabel = String(replyContext?.authorLabel || "unknown_user").trim();
  const replyText = truncateReplyText(replyContext?.replyText || "");

  return {
    role: "system",
    content: [
      "REPLY CONTEXT:",
      "- current user replied to an earlier message",
      "- if user asks about 'this message' / 'этого сообщения' / 'этого текста', first interpret it as the replied message",
      `- replied message author: ${authorLabel}`,
      replyText
        ? `- replied message text: ${replyText}`
        : "- replied message text: [not available]",
      "- do not confuse replied-message author with current sender",
    ].join("\n"),
  };
}

export function buildAuxPolicySystemMessage({
  monarchNow,
  stablePersonalFactMode,
  recallCtx,
  likelyContextualReaction,
  needsClarificationFirst,
  mediaResponseMode,
}) {
  const blocks = [];

  if (!monarchNow) {
    blocks.push(
      [
        "ROLE:",
        "- current user is not monarch",
        "- do not address as Monarch / Ваше Величество / Государь",
        "- use neutral addressing",
      ].join("\n")
    );
  }

  if (stablePersonalFactMode) {
    blocks.push(
      [
        "STABLE FACT:",
        "- LONG-TERM MEMORY is primary source",
        "- do not replace saved fact with guess or recent chat",
        "- reproduce saved name/fact exactly",
        "- answer directly, without decorative addressing",
      ].join("\n")
    );
  }

  if (!stablePersonalFactMode && recallCtx) {
    blocks.push(
      [
        "RECALL:",
        "- use this as prior chat context when relevant",
        "- if user asks what was discussed before, rely on RECALL",
        "- if data is missing, say so honestly",
        "",
        recallCtx,
      ].join("\n")
    );
  }

  if (!stablePersonalFactMode && likelyContextualReaction) {
    blocks.push(
      [
        "REACTION:",
        "- current message looks like a short reaction to prior answer",
        "- do not ask generic clarification",
        "- briefly acknowledge and continue naturally",
      ].join("\n")
    );
  }

  if (!stablePersonalFactMode && !likelyContextualReaction && needsClarificationFirst) {
    blocks.push(
      [
        "CLARIFY FIRST:",
        "- request is too vague",
        "- do not guess object from nearby context",
        "- ask one short neutral clarifying question",
      ].join("\n")
    );
  }

  const mediaPolicy = buildMediaResponsePolicy(mediaResponseMode);
  if (mediaPolicy) {
    blocks.push(mediaPolicy);
  }

  if (!blocks.length) return null;

  return {
    role: "system",
    content: blocks.join("\n\n"),
  };
}

export default {
  buildMediaResponsePolicy,
  truncateReplyText,
  buildReplyContextSystemMessage,
  buildAuxPolicySystemMessage,
};
