// src/core/projectIntent/modes/technical/conversation/projectIntentTechnicalRepliesRuntime.js
// ============================================================================
// TECHNICAL MODE CONVERSATION REPLIES RUNTIME FACADE
//
// INTERFACE MODE NOTE:
// - This facade groups split legacy Technical Mode repo reply runtime blocks.
// - This is not Human Mode intelligence.
// - Do not add phrase-bound Human Mode behavior here.
// ============================================================================

export {
  replyPackedExplain,
  replyContinuation,
} from "./repliesRuntime/projectIntentTechnicalPackedReplies.js";

export {
  replyFolderBrowseFromPath,
  replyExplainFolderFromPath,
} from "./repliesRuntime/projectIntentTechnicalFolderReplies.js";

export {
  replyOpenFileFromPath,
  replyExplainFileFromPath,
} from "./repliesRuntime/projectIntentTechnicalFileReplies.js";

import {
  replyPackedExplain,
  replyContinuation,
} from "./repliesRuntime/projectIntentTechnicalPackedReplies.js";
import {
  replyFolderBrowseFromPath,
  replyExplainFolderFromPath,
} from "./repliesRuntime/projectIntentTechnicalFolderReplies.js";
import {
  replyOpenFileFromPath,
  replyExplainFileFromPath,
} from "./repliesRuntime/projectIntentTechnicalFileReplies.js";

export default {
  replyPackedExplain,
  replyContinuation,
  replyFolderBrowseFromPath,
  replyExplainFolderFromPath,
  replyOpenFileFromPath,
  replyExplainFileFromPath,
};
