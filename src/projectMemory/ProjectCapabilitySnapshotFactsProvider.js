// src/projectMemory/ProjectCapabilitySnapshotFactsProvider.js
// ============================================================================
// PROJECT CAPABILITY SNAPSHOT FACTS PROVIDER
// Stage: 7A.13 Project Capability Snapshot
//
// Purpose:
// - provide verified repo/runtime/test facts for read-only capability snapshots
// - keep dispatcher thin
// - keep capability facts outside Telegram command routing
//
// Important:
// - This file has no DB writes.
// - This file has no Telegram command wiring.
// - This file has no runtime side effects.
// - Snapshot facts are advisory and must be regenerated/updated from repo/runtime/tests.
// ============================================================================

export const PROJECT_CAPABILITY_SNAPSHOT_FACTS_PROVIDER_VERSION =
  "project-capability-snapshot-facts-provider-7A13-2026-04-26-01";

export function getProjectCapabilitySnapshotFacts() {
  return {
    projectKey: "SG",
    projectName: "Советник GARYA",
    stageKey: "7A.13",
    repoRef: "main",
    verifiedFiles: [
      "pillars/workflow/02_STAGE_07_MEMORY.md",
      "pillars/workflow/00_RULES_AND_ORDER.md",
      "src/bot/dispatchers/dispatchProjectMemoryBasicCommands.js",
      "src/bot/handlers/pmWiringDiag.js",
      "src/bot/handlers/pmList.js",
      "src/bot/handlers/pmCapabilities.js",
      "src/projectMemory/ProjectCapabilitySnapshotShape.js",
      "src/projectMemory/ProjectCapabilitySnapshotBuilder.js",
      "src/projectMemory/ProjectCapabilitySnapshotValidator.js",
      "src/projectMemory/ProjectCapabilitySnapshotFactory.js",
      "src/projectMemory/ProjectCapabilitySnapshotFactsProvider.js",
    ],
    verifiedCommands: [
      "/pm_wiring_diag",
      "/pm_list",
      "/pm_set",
      "/pm_show",
      "/pm_confirmed_write",
      "/pm_confirmed_latest",
      "/pm_session",
      "/pm_sessions",
      "/pm_capabilities",
    ],
    verifiedCommits: [
      "adfed4d7dd091e39f89c5dd9b8721d95553dd171",
      "d4880014bc2e082bf2375ed76f4d788401d49b0f",
      "33c9416488cd4966394ec6ebfc66498606b2c389",
      "ca7567c2b9e1c5ee1a528ce17e99bdf8c8be6e8c",
      "70e858c857a604f36a208b3614f6694e5a029ee5",
      "a7c6f6368bd117d5230b127279eb2a3f5dca3abe",
      "ed96d8b051db16dd5332b2cf3e5c7df7b9c06e31",
      "0f443dbe941facb649388254ed99aefc22222d37",
      "7aaa9f242aa39e122e3ab0104b4886f45fb51cdb",
      "a68860f61460c0bd8bf04e26ab933f5fcee77c96",
      "2bf9d5fad55df321a42d1e88f509de4e70486964",
      "a66db196f54b9dd8ec2f9400e6359869d93e2fb1",
    ],
    facts: {
      sourceOfTruth: "repo/runtime/tests",
      snapshotRole: "advisory_status_view",
      manualPillarStatusMarkersAllowed: false,
      legacyProjectMemoryRouterLivePath: false,
    },
    runtime: {
      transportPath:
        "core/TelegramAdapter -> handleMessage -> commandDispatcher",
      transportEnforced: true,
      dispatcherPath: "src/bot/dispatchers/dispatchProjectMemoryBasicCommands.js",
      handlerPath: "src/bot/handlers/pmCapabilities.js",
      factsProviderPath:
        "src/projectMemory/ProjectCapabilitySnapshotFactsProvider.js",
      dbWrites: false,
    },
    tests: {
      projectMemoryReadWriteCommandsManualTelegramVerified: true,
      pmCapabilitiesRuntimeVerified: true,
    },
    capabilities: [
      {
        key: "project_memory_core_commands",
        title: "Project Memory core commands",
        status: "runtime_verified",
        userBenefit:
          "Монарх может вручную читать, писать и проверять Project Memory через Telegram-команды.",
        evidenceRefs: [
          "/pm_wiring_diag",
          "/pm_list",
          "/pm_set",
          "/pm_show",
        ],
        limitations: [
          "Snapshot не является источником истины.",
          "Источник истины остаётся repo/runtime/tests.",
        ],
      },
      {
        key: "capability_snapshot_read_only",
        title: "Project Capability Snapshot read-only view",
        status: "runtime_verified",
        userBenefit:
          "СГ может показать понятный статус своих текущих возможностей без записи в память.",
        evidenceRefs: [
          "src/projectMemory/ProjectCapabilitySnapshotFactory.js",
          "src/bot/handlers/pmCapabilities.js",
          "/pm_capabilities",
        ],
        limitations: [
          "Автоматическая запись snapshot в project_memory пока запрещена.",
          "Facts provider нужно обновлять только после repo/runtime/test-проверки.",
        ],
      },
    ],
    limitations: [
      "Capability snapshot advisory only.",
      "No automatic DB writes.",
      "No manual pillar completion marks.",
      "No raw chat as uncontrolled prompt memory.",
    ],
    nextSafeStep:
      "Verify /pm_capabilities after facts-provider refactor, then consider optional ProjectMemoryService-only snapshot write later.",
  };
}

export default {
  PROJECT_CAPABILITY_SNAPSHOT_FACTS_PROVIDER_VERSION,
  getProjectCapabilitySnapshotFacts,
};
