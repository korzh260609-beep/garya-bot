// src/core/projectIntent/repoStore/projectIntentRepoStoreFileReader.js

import { RepoSource } from "../../repo/RepoSource.js";
import { normalizePath } from "../projectIntentConversationShared.js";
import { isFileLike } from "./projectIntentRepoStorePathUtils.js";

export async function fetchRepoFileText({ path, repo, branch, token }) {
  const normalized = normalizePath(path);
  if (!normalized) return null;
  if (!isFileLike(normalized)) return null;

  const source = new RepoSource({ repo, branch, token });
  const item = await source.fetchTextFile(normalized);

  if (!item || typeof item.content !== "string") {
    return null;
  }

  return item.content;
}

export default {
  fetchRepoFileText,
};