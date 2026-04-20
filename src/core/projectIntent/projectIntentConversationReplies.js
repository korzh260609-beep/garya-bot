// src/core/projectIntent/projectIntentConversationReplies.js

export {
  humanRepoStatusReply,
  humanSearchReply,
  humanTreeReply,
  humanFolderBrowseReply,
  humanLargeDocumentReply,
  humanSmallDocumentReply,
  humanFirstPartDocumentReply,
  humanClarificationReply,
} from "./conversation/projectIntentConversationHumanReplies.js";

export {
  buildAiMessages,
} from "./conversation/projectIntentConversationAiMessages.js";

export {
  replyHuman,
  buildRepoContextMeta,
} from "./conversation/projectIntentConversationContextMeta.js";

import {
  humanRepoStatusReply,
  humanSearchReply,
  humanTreeReply,
  humanFolderBrowseReply,
  humanLargeDocumentReply,
  humanSmallDocumentReply,
  humanFirstPartDocumentReply,
  humanClarificationReply,
} from "./conversation/projectIntentConversationHumanReplies.js";

import {
  buildAiMessages,
} from "./conversation/projectIntentConversationAiMessages.js";

import {
  replyHuman,
  buildRepoContextMeta,
} from "./conversation/projectIntentConversationContextMeta.js";

export default {
  humanRepoStatusReply,
  humanSearchReply,
  humanTreeReply,
  humanFolderBrowseReply,
  humanLargeDocumentReply,
  humanSmallDocumentReply,
  humanFirstPartDocumentReply,
  humanClarificationReply,
  buildAiMessages,
  replyHuman,
  buildRepoContextMeta,
};