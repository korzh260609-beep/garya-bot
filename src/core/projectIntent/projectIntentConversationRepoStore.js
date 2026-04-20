// src/core/projectIntent/projectIntentConversationRepoStore.js

export {
  basenameOf,
  hasPathSeparator,
  isFileLike,
  isFolderLike,
  normalizeFolderPath,
  isBareBasenameLike,
  resolveCanonicalPathFromBasename,
} from "./repoStore/projectIntentRepoStorePathUtils.js";

export {
  loadLatestSnapshot,
  pathExistsInSnapshot,
  pathKindInSnapshot,
  fetchPathsByPrefix,
  fetchAllSnapshotPaths,
  computeImmediateChildren,
} from "./repoStore/projectIntentRepoStoreSnapshot.js";

export {
  scoreBasenameMatch,
  sortByScoreThenPath,
  rankPathCandidate,
  searchSnapshotPaths,
} from "./repoStore/projectIntentRepoStoreSearch.js";

export {
  fetchRepoFileText,
} from "./repoStore/projectIntentRepoStoreFileReader.js";

export {
  pickLikelyTargetPathFromKnownEntity,
  pickBestSearchMatch,
  pickLikelyTargetPath,
} from "./repoStore/projectIntentRepoStoreTargetPicker.js";

import {
  basenameOf,
  hasPathSeparator,
  isFileLike,
  isFolderLike,
  normalizeFolderPath,
  isBareBasenameLike,
  resolveCanonicalPathFromBasename,
} from "./repoStore/projectIntentRepoStorePathUtils.js";

import {
  loadLatestSnapshot,
  pathExistsInSnapshot,
  pathKindInSnapshot,
  fetchPathsByPrefix,
  fetchAllSnapshotPaths,
  computeImmediateChildren,
} from "./repoStore/projectIntentRepoStoreSnapshot.js";

import {
  scoreBasenameMatch,
  sortByScoreThenPath,
  rankPathCandidate,
  searchSnapshotPaths,
} from "./repoStore/projectIntentRepoStoreSearch.js";

import {
  fetchRepoFileText,
} from "./repoStore/projectIntentRepoStoreFileReader.js";

import {
  pickLikelyTargetPathFromKnownEntity,
  pickBestSearchMatch,
  pickLikelyTargetPath,
} from "./repoStore/projectIntentRepoStoreTargetPicker.js";

export default {
  basenameOf,
  hasPathSeparator,
  isFileLike,
  isFolderLike,
  normalizeFolderPath,
  isBareBasenameLike,
  resolveCanonicalPathFromBasename,
  loadLatestSnapshot,
  pathExistsInSnapshot,
  pathKindInSnapshot,
  fetchPathsByPrefix,
  fetchAllSnapshotPaths,
  computeImmediateChildren,
  scoreBasenameMatch,
  sortByScoreThenPath,
  rankPathCandidate,
  searchSnapshotPaths,
  fetchRepoFileText,
  pickLikelyTargetPathFromKnownEntity,
  pickBestSearchMatch,
  pickLikelyTargetPath,
};