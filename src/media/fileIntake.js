// src/media/fileIntake.js
// ==================================================
// FILE-INTAKE FACADE
// Purpose:
// - stable public API for media intake
// - re-export split modules
// - no monolith logic here
// ==================================================

export * from "./fileIntakeCore.js";
export * from "./fileIntakeDocumentSession.js";
export * from "./fileIntakeRouting.js";
export * from "./fileIntakeSummary.js";
export * from "./fileIntakeDownload.js";
export * from "./fileIntakeHints.js";
export * from "./fileIntakeProcess.js";
export * from "./fileIntakeDecision.js";

import * as FileIntakeCore from "./fileIntakeCore.js";
import * as FileIntakeDocumentSession from "./fileIntakeDocumentSession.js";
import * as FileIntakeRouting from "./fileIntakeRouting.js";
import * as FileIntakeSummary from "./fileIntakeSummary.js";
import * as FileIntakeDownload from "./fileIntakeDownload.js";
import * as FileIntakeHints from "./fileIntakeHints.js";
import * as FileIntakeProcess from "./fileIntakeProcess.js";
import * as FileIntakeDecision from "./fileIntakeDecision.js";

export default {
  ...FileIntakeCore,
  ...FileIntakeDocumentSession,
  ...FileIntakeRouting,
  ...FileIntakeSummary,
  ...FileIntakeDownload,
  ...FileIntakeHints,
  ...FileIntakeProcess,
  ...FileIntakeDecision,
};