# TEST_REPORT

SG repo state scan result after workspace command execution.

---

Task ID: `repo-state-scan-runtime-check`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-27T13:38:50.399Z`
Tested by: `SG AgentWorkspaceCommandRunner`

---

## Test command

```text
RUN_REPO_STATE_SCAN
```

## Result

- `REPO_STATE_SCAN_OK`

## Repo State

```text
ok: yes
persisted: yes
repo: korzh260609-beep/garya-bot
branch: main
files: 0
modules: 0
dependencies: 0
contentLoaded: 0
contentSkipped: 0
structureComplete: yes
hiddenFiles: 0
scanRunId: 2
error: -
```

## Raw

```json
{
  "ok": true,
  "status": "collected",
  "startedAt": "2026-04-27T13:38:49.549Z",
  "finishedAt": "2026-04-27T13:38:50.339Z",
  "repoFullName": "korzh260609-beep/garya-bot",
  "branch": "main",
  "filesCount": 0,
  "modulesCount": 0,
  "dependenciesCount": 0,
  "tree": {
    "ok": true,
    "repoFullName": "korzh260609-beep/garya-bot",
    "branch": "main",
    "files": [],
    "filesCount": 0,
    "rawFilesCount": 945,
    "contentFilesLoaded": 0,
    "contentFilesSkipped": 0,
    "structureComplete": true,
    "contentComplete": true,
    "hiddenFilesCount": 0,
    "truncated": false
  },
  "modules": [],
  "dependencies": [],
  "dependencyStats": {
    "internalCount": 0,
    "externalCount": 0,
    "unresolvedInternalCount": 0
  },
  "persisted": true,
  "persistence": {
    "ok": true,
    "saved": true,
    "scanRunId": 2,
    "filesSaved": 0,
    "modulesSaved": 0,
    "dependenciesSaved": 0
  }
}
```
