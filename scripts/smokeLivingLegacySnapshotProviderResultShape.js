// scripts/smokeLivingLegacySnapshotProviderResultShape.js
// ============================================================================
// Smoke — Living SG Legacy Snapshot Provider Result Shape
//
// Checks that old DB snapshot data can be shaped into providerResult objects
// without reading DB, reading GitHub, using tokens, calling providers or running
// any executor/runtime.
// ============================================================================

import assert from "node:assert/strict";

import {
  LIVING_LEGACY_SNAPSHOT_RESULT_KIND,
  LIVING_LEGACY_SNAPSHOT_RESULT_STATUS,
  createBlockedLegacySnapshotFileContentProviderResult,
  createLegacySnapshotPathExistsProviderResult,
  createLegacySnapshotPathKindProviderResult,
  createLegacySnapshotProviderResultShape,
  createLegacySnapshotRepoSearchProviderResult,
  createLegacySnapshotRepoStatusProviderResult,
  createLegacySnapshotRepoTreeProviderResult,
} from "../src/core/living-sg/LivingLegacySnapshotProviderResultShape.js";
import {
  LIVING_REPO_SOURCE_PROVIDER_KIND,
} from "../src/core/living-sg/LivingRepoSourceProviderBoundary.js";
import {
  LIVING_SOURCE_RESULT_FRESHNESS_STATUS,
} from "../src/core/living-sg/LivingSourceResultEnvelope.js";

function assertSafe(result) {
  assert.equal(result.dryRun, true);
  assert.equal(result.canReadDb, false);
  assert.equal(result.canReadRepo, false);
  assert.equal(result.canWriteRepo, false);
  assert.equal(result.canExecute, false);
  assert.equal(result.metadata.noDbRead, true);
  assert.equal(result.metadata.noRuntimeRepoRead, true);
  assert.equal(result.metadata.noRuntimeRepoWrite, true);
  assert.equal(result.metadata.noSourceCall, true);
  assert.equal(result.metadata.noProviderCall, true);
  assert.equal(result.metadata.noLoadLatestSnapshotCall, true);
  assert.equal(result.metadata.noFetchRepoFileTextCall, true);
  assert.equal(result.metadata.noGitHubTokenUsage, true);
  assert.equal(result.metadata.noExecutor, true);
  assert.equal(result.metadata.noRepoStateAgentRuntime, true);
  assert.equal(result.metadata.noHumanMeaningProvider, true);
  assert.equal(result.metadata.noTechnicalModeExpansion, true);
  assert.equal(result.metadata.noSlashCommandsAdded, true);
  assert.equal(result.metadata.cannotAuthorizeWrites, true);
}

function assertProviderResultSafe(providerResult) {
  assert.equal(providerResult.providerKind, LIVING_REPO_SOURCE_PROVIDER_KIND.LEGACY_SNAPSHOT_ADAPTER);
  assert.equal(providerResult.readOnly, true);
  assert.equal(providerResult.canAuthorizeWrite, false);
  assert.equal(providerResult.canExecute, false);
}

const common = {
  repository: "korzh260609-beep/garya-bot",
  ref: "main",
  confirmed: true,
  freshnessStatus: LIVING_SOURCE_RESULT_FRESHNESS_STATUS.FRESH,
  checkedAt: "2026-05-02T09:10:00+03:00",
  sourceUpdatedAt: "2026-05-02T09:00:00+03:00",
};

const status = createLegacySnapshotRepoStatusProviderResult({
  ...common,
  latest: { id: 123, sha: "abc" },
  filesCount: 99,
});
assert.equal(status.ok, true);
assert.equal(status.status, LIVING_LEGACY_SNAPSHOT_RESULT_STATUS.BUILT);
assert.equal(status.resultKind, LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_STATUS);
assert.equal(status.providerResult.payload.filesCount, 99);
assertProviderResultSafe(status.providerResult);
assertSafe(status);

const tree = createLegacySnapshotRepoTreeProviderResult({
  ...common,
  prefix: "src/core",
  directories: ["living-sg", "projectIntent", ""],
  files: ["index.js", " ", "README.md"],
  hiddenCount: 2,
});
assert.equal(tree.ok, true);
assert.equal(tree.status, LIVING_LEGACY_SNAPSHOT_RESULT_STATUS.BUILT);
assert.equal(tree.resultKind, LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_TREE);
assert.deepEqual(tree.providerResult.payload.directories, ["living-sg", "projectIntent"]);
assert.deepEqual(tree.providerResult.payload.files, ["index.js", "README.md"]);
assertProviderResultSafe(tree.providerResult);
assertSafe(tree);

const search = createLegacySnapshotRepoSearchProviderResult({
  ...common,
  query: "LivingRepo",
  matches: ["src/core/living-sg/LivingRepoSourceProviderBoundary.js", ""],
  objectKind: "file",
});
assert.equal(search.ok, true);
assert.equal(search.status, LIVING_LEGACY_SNAPSHOT_RESULT_STATUS.BUILT);
assert.equal(search.resultKind, LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_SEARCH);
assert.equal(search.providerResult.payload.matches.length, 1);
assertProviderResultSafe(search.providerResult);
assertSafe(search);

const pathKind = createLegacySnapshotPathKindProviderResult({
  ...common,
  path: "src/core/living-sg/LivingRepoSourceProviderBoundary.js",
  pathKind: "file",
});
assert.equal(pathKind.ok, true);
assert.equal(pathKind.resultKind, LIVING_LEGACY_SNAPSHOT_RESULT_KIND.PATH_KIND);
assert.equal(pathKind.providerResult.payload.pathKind, "file");
assertProviderResultSafe(pathKind.providerResult);
assertSafe(pathKind);

const pathExists = createLegacySnapshotPathExistsProviderResult({
  ...common,
  path: "package.json",
  exists: true,
});
assert.equal(pathExists.ok, true);
assert.equal(pathExists.resultKind, LIVING_LEGACY_SNAPSHOT_RESULT_KIND.PATH_EXISTS);
assert.equal(pathExists.providerResult.payload.exists, true);
assertProviderResultSafe(pathExists.providerResult);
assertSafe(pathExists);

const blockedFile = createBlockedLegacySnapshotFileContentProviderResult({
  ...common,
  path: "package.json",
});
assert.equal(blockedFile.ok, false);
assert.equal(blockedFile.status, LIVING_LEGACY_SNAPSHOT_RESULT_STATUS.BLOCKED_FILE_CONTENT);
assert.equal(blockedFile.providerResult, null);
assert.equal(blockedFile.metadata.blockedFileContent, true);
assertSafe(blockedFile);

const generic = createLegacySnapshotProviderResultShape({
  ...common,
  resultKind: LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_SEARCH,
  query: "source",
  matches: ["src/a.js"],
});
assert.equal(generic.ok, true);
assert.equal(generic.resultKind, LIVING_LEGACY_SNAPSHOT_RESULT_KIND.REPO_SEARCH);
assertProviderResultSafe(generic.providerResult);
assertSafe(generic);

const genericBlocked = createLegacySnapshotProviderResultShape({
  ...common,
  fileContentRequested: true,
  path: "package.json",
});
assert.equal(genericBlocked.ok, false);
assert.equal(genericBlocked.status, LIVING_LEGACY_SNAPSHOT_RESULT_STATUS.BLOCKED_FILE_CONTENT);
assertSafe(genericBlocked);

const unknown = createLegacySnapshotProviderResultShape({
  ...common,
  resultKind: "unknown_future_kind",
});
assert.equal(unknown.ok, false);
assert.equal(unknown.status, LIVING_LEGACY_SNAPSHOT_RESULT_STATUS.INVALID_INPUT);
assertSafe(unknown);

console.log("Smoke Living Legacy Snapshot Provider Result Shape — OK");
