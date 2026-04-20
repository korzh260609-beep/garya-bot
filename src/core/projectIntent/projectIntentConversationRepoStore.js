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