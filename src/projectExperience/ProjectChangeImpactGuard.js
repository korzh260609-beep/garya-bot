// src/projectExperience/ProjectChangeImpactGuard.js
// ============================================================================
// STAGE C.6A — Project Change Impact Guard (SKELETON / DRY-RUN)
// Purpose:
// - automatically run pre-change impact analysis before known change commands
// - keep the guard advisory/dry-run at this stage
// - prevent blind architecture/code changes later when enforcement is enabled
// IMPORTANT:
// - NO DB writes
// - NO Project Memory writes
// - NO GitHub calls
// - NO blocking in this skeleton unless explicitly configured later
// ============================================================================

import { PreChangeImpactAnalyzer } from "./PreChangeImpactAnalyzer.js";

export const CHANGE_COMMANDS = Object.freeze({
  CODE_FULLFILE: "/code_fullfile",
  CODE_INSERT: "/code_insert",
  PM_SET: "/pm_set",
  PM_SESSION: "/pm_session",
  PM_CONFIRMED_WRITE: "/pm_confirmed_write",
  PM_CONFIRMED_UPDATE: "/pm_confirmed_update",
  CONFIRM_PROJECT_ACTION: "/confirm_project_action",
});

const DEFAULT_CHANGE_COMMAND_SET = new Set(Object.values(CHANGE_COMMANDS));

function safeText(value) {
  return String(value ?? "").trim();
}

function inferTargetFilesFromText(text = "") {
  const source = safeText(text);
  if (!source) return [];

  const matches = source.match(/(?:src|core|migrations|pillars|db)\/[A-Za-z0-9_./-]+\.(?:js|md|sql|json)/g);
  return Array.isArray(matches) ? [...new Set(matches)] : [];
}

export class ProjectChangeImpactGuard {
  constructor({ analyzer = new PreChangeImpactAnalyzer(), enabled = true } = {}) {
    this.analyzer = analyzer;
    this.enabled = enabled;
  }

  isChangeCommand(cmd = "") {
    return DEFAULT_CHANGE_COMMAND_SET.has(safeText(cmd).split("@")[0]);
  }

  analyzeCommand({ cmd = "", rest = "", explicitTargetFiles = [] } = {}) {
    const cmd0 = safeText(cmd).split("@")[0];

    if (!this.enabled || !this.isChangeCommand(cmd0)) {
      return {
        needed: false,
        cmd: cmd0,
        impact: null,
      };
    }

    const inferredTargetFiles = inferTargetFilesFromText(rest);
    const targetFiles = [...new Set([...explicitTargetFiles, ...inferredTargetFiles].map(safeText).filter(Boolean))];

    const impact = this.analyzer.analyzeChangePlan({
      changeTitle: `Command ${cmd0}`,
      changeReason: safeText(rest).slice(0, 500),
      targetFiles,
      intendedEffects: [`Execute ${cmd0}`],
    });

    return {
      needed: true,
      cmd: cmd0,
      impact,
      advisoryOnly: true,
    };
  }
}

export default {
  CHANGE_COMMANDS,
  ProjectChangeImpactGuard,
};
