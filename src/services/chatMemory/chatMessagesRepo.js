// src/services/chatMemory/chatMessagesRepo.js
// DEPRECATED INTERNAL SHIM
// IMPORTANT:
// - this file remains only as a compatibility bridge for old internal imports
// - new internal canonical foundation file is: ./chatMessagesStore.js
// - runtime/public canonical entry-point remains: src/db/chatMessagesRepo.js
// - handlers, router, core runtime modules must NOT import this file directly
//
// WHY THIS FILE STILL EXISTS:
// - minimal safe migration
// - avoids sudden breakage if any old internal import still points here
// - can be removed later after full repo-wide cleanup is verified

export { insertChatMessage } from "./chatMessagesStore.js";