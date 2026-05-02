# LIVING SG LEGACY SNAPSHOT OUTPUT SHAPE AUDIT

Date: `2026-05-02`
Status: `AUDIT / NO RUNTIME CHANGES`
Owner: `Monarch Gary`
Base: `main @ 5eb976d38da3ab5b618bab4ccc6f89e913cfaae6`

---

## 0. Simple purpose

This file records what the old repo snapshot system returns.

Main goal:

```text
Do not mix old database snapshot data with real GitHub file reading.
```

This audit changes nothing in runtime.

It does not:

```text
read GitHub
read repo files
connect repo-read runtime
connect RepoStateAgent runtime
use GITHUB_TOKEN
create executor
add slash commands
deploy
```

---

## 1. What the old snapshot is

The old snapshot is stored in the project database.

Main file:

```text
src/core/projectIntent/repoStore/projectIntentRepoStoreSnapshot.js
```

It uses:

```text
process.env.GITHUB_REPO
process.env.GITHUB_BRANCH
RepoIndexStore
PostgreSQL pool
repo_index_files table
```

Important meaning:

```text
Snapshot data is not direct GitHub reading.
But it is still runtime data from DB and ENV.
```

---

## 2. Snapshot functions and output shape

### 2.1 loadLatestSnapshot()

Reads latest indexed repo snapshot from DB.

Returns when snapshot exists:

```js
{
  ok: true,
  repo,
  branch,
  latest,
  filesCount
}
```

Returns when snapshot is missing:

```js
{
  ok: false,
  repo,
  branch,
  latest: null,
  filesCount: 0
}
```

Use later only as raw provider input, not proof.

---

### 2.2 pathExistsInSnapshot(snapshotId, path)

Checks if a file or folder exists in `repo_index_files`.

Returns:

```js
true | false
```

Use later only as raw provider input, not proof.

---

### 2.3 pathKindInSnapshot(snapshotId, path)

Checks what the path is.

Returns:

```js
"file" | "folder" | "unknown"
```

Use later only as raw provider input, not proof.

---

### 2.4 fetchPathsByPrefix(snapshotId, prefix)

Reads matching paths from `repo_index_files`.

Returns:

```js
[
  "path/one.js",
  "path/two.js"
]
```

Use later only as raw provider input, not proof.

---

### 2.5 fetchAllSnapshotPaths(snapshotId)

Reads all paths from `repo_index_files`.

Returns:

```js
[
  "src/index.js",
  "package.json"
]
```

Use later only as raw provider input, not proof.

---

### 2.6 computeImmediateChildren(paths, prefix)

Pure helper. Does not read DB or GitHub.

Input:

```js
[
  "src/core/a.js",
  "src/bot/b.js"
]
```

Returns:

```js
{
  directories: ["core", "bot"],
  files: []
}
```

This can be reused later as a pure helper if needed.

---

## 3. Real GitHub/file reading path

Main file:

```text
src/core/projectIntent/repoStore/projectIntentRepoStoreFileReader.js
```

Function:

```text
fetchRepoFileText({ path, repo, branch, token })
```

It creates:

```js
new RepoSource({ repo, branch, token })
```

Then calls:

```js
source.fetchTextFile(normalized)
```

Important meaning:

```text
This is real repo/file reading.
This must NOT be connected directly to Living SG source proof path.
This must only be used later behind a provider boundary, if Monarch approves.
```

---

## 4. Old repo actions use two data types

Main file:

```text
src/core/projectIntent/modes/technical/conversation/projectIntentTechnicalRepoActions.js
```

### 4.1 Snapshot-only actions

These use DB snapshot data:

```text
repo_status
show_tree
browse_folder
find_target
```

They are safer than direct GitHub read, but still runtime DB reads.

They are not Living SG proof by themselves.

---

### 4.2 Mixed actions

These start with snapshot/search and may later read file content:

```text
find_and_explain
```

Risk:

```text
This can move from DB snapshot into real file reading.
It must not be copied into Living SG directly.
```

---

### 4.3 File-content actions

Other legacy object/explain flows may read actual file text through `RepoSource`.

Risk:

```text
This uses token-backed repo access.
Future Living SG must put this behind provider boundary + result adapter + sourceResultEnvelope.
```

---

## 5. What can be adapted later

Safe future candidates for a legacy snapshot provider result skeleton:

```text
repo_status from latest snapshot
repo tree from fetchPathsByPrefix + computeImmediateChildren
search result list from searchSnapshotPaths
path kind from pathKindInSnapshot
path existence from pathExistsInSnapshot
```

These are DB snapshot outputs.

They still must become:

```text
raw snapshot output
-> providerResult
-> LivingRepoSourceProviderResultAdapter
-> sourceResultEnvelope
```

---

## 6. What must not be adapted directly

Do not directly adapt:

```text
fetchRepoFileText output
RepoSource output
GITHUB_TOKEN-backed reads
AI explanations over fetched file text
```

These need a separate future provider design.

Reason:

```text
File content reading is real repo-read runtime.
It is more dangerous than reading old snapshot metadata.
```

---

## 7. Simple rule for next work

Do not do this:

```text
legacy snapshot -> sourceResultEnvelope
```

Do this instead:

```text
legacy snapshot output
-> providerResult shape
-> adapter validation
-> sourceResultEnvelope
```

And for file content later:

```text
repo file read provider
-> providerResult shape
-> adapter validation
-> sourceResultEnvelope
```

---

## 8. Recommended next skeleton

Next safe skeleton:

```text
src/core/living-sg/LivingLegacySnapshotProviderResultShape.js
```

Purpose:

```text
Describe safe providerResult shapes for old DB snapshot data.
Do not read DB.
Do not call loadLatestSnapshot().
Do not call fetchRepoFileText().
Do not use GITHUB_TOKEN.
Do not connect runtime.
```

It should define shapes for:

```text
repo_status
repo_tree
repo_search
path_kind
path_exists
```

It should not include:

```text
file content
GitHub token reads
AI explanations
executor
```

---

## 9. Current conclusion

The old repo system has two layers:

```text
1. DB snapshot metadata
2. real GitHub/file content reading
```

Living SG must not mix them.

Next safe move is a shape-only skeleton for DB snapshot provider results.
