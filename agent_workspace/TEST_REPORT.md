# TEST_REPORT

SG repo state scan result after workspace command execution.

---

Task ID: `repo-state-agent-runtime-scan-check-2`
Deploy ID: `-`
Commit: `-`
Tested at: `2026-04-27T16:06:23.226Z`
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
files: 954
modules: 67
dependencies: 775
contentLoaded: 500
contentSkipped: 454
structureComplete: yes
hiddenFiles: 0
scanRunId: 5
error: -
```

## Raw

```json
{
  "ok": true,
  "status": "collected",
  "startedAt": "2026-04-27T16:04:44.619Z",
  "finishedAt": "2026-04-27T16:06:18.347Z",
  "repoFullName": "korzh260609-beep/garya-bot",
  "branch": "main",
  "filesCount": 954,
  "modulesCount": 67,
  "dependenciesCount": 775,
  "tree": {
    "ok": true,
    "repoFullName": "korzh260609-beep/garya-bot",
    "branch": "main",
    "files": [
      {
        "path": ".env.example",
        "sha": "1d74d7f70bfde8691343be11bfad4c5c03e569b6",
        "size": 347,
        "type": "blob",
        "extension": ".example",
        "content": "",
        "contentLoaded": false,
        "contentSkipped": true,
        "contentSkipReason": "extension_not_allowed",
        "visibleInRepoMap": true
      },
      {
        "path": ".github/workflows/ci.yml",
        "sha": "d27b40e95206afc0350712ad0c652c0de9a4ed98",
        "size": 612,
        "type": "blob",
        "extension": ".yml",
        "content": "name: SG Minimal CI\n\non:\n  push:\n    branches: [ \"main\" ]\n  pull_request:\n    branches: [ \"main\" ]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n\n    steps:\n      - name: Checkout repository\n        uses: actions/checkout@v4\n\n      - name: Setup Node.js\n        uses: actions/setup-node@v4\n        with:\n          node-version: 18\n\n      - name: Install dependencies\n        run: npm install\n\n      - name: Syntax check (node --check)\n        run: |\n          for file in $(git ls-files '*.js'); do\n            node --check \"$file\"\n          done\n\n      - name: CI success\n        run: echo \"SG minimal CI passed.\"\n",
        "contentLoaded": true,
        "contentSkipped": false,
        "contentSkipReason": null,
        "visibleInRepoMap": true,
        "contentError": null
      },
      {
        "path": ".github/workflows/render-log-ingest-dispatch.yml",
        "sha": "bae14e14c1bc13e3444efb8121732dbfb216f73a",
        "size": 5234,
        "type": "blob",
        "extension": ".yml",
        "content": "name: Render Log Ingest Dispatch\n\non:\n  workflow_dispatch:\n    inputs:\n      mode:\n        description: \"error or deploy\"\n        required: true\n        default: \"error\"\n        type: choice\n        options:\n          - error\n          - deploy\n      source_key:\n        description: \"sourceKey for SG storage\"\n        required: true\n        default: \"render_primary\"\n        type: string\n      deploy_id:\n        description: \"deployId (required for deploy mode)\"\n        required: false\n        default: \"\"\n        type: string\n      status:\n        description: \"deploy status for deploy mode\"\n        required: false\n        default: \"failed\"\n        type: choice\n        options:\n          - failed\n          - success\n          - building\n          - deploying\n          - running\n          - pending\n          - unknown\n      log_text:\n        description: \"Paste log snapshot text here\"\n        required: true\n        default: \"SyntaxError: Missing catch or finally after try at src/bot/messageRouter.js:420\"\n        type: string\n\njobs:\n  send-render-log:\n    runs-on: ubuntu-latest\n\n    steps:\n      - name: Validate inputs\n        shell: bash\n        run: |\n          set -euo pipefail\n\n          MODE=\"${{ github.event.inputs.mode }}\"\n          DEPLOY_ID=\"${{ github.event.inputs.deploy_id }}\"\n          LOG_TEXT=\"${{ github.event.inputs.log_text }}\"\n\n          if [ -z \"$LOG_TEXT\" ]; then\n            echo \"log_text is required\"\n            exit 1\n          fi\n\n          if [ \"$MODE\" = \"deploy\" ] && [ -z \"$DEPLOY_ID\" ]; then\n            echo \"deploy_id is required when mode=deploy\"\n            exit 1\n          fi\n\n      - name: Send snapshot to SG ingest route\n        uses: actions/github-script@v7\n        env:\n          INGEST_URL: ${{ secrets.RENDER_LOG_INGEST_URL }}\n          INGEST_TOKEN: ${{ secrets.RENDER_LOG_INGEST_TOKEN }}\n          MODE: ${{ github.event.inputs.mode }}\n          SOURCE_KEY: ${{ github.event.inputs.source_key }}\n          DEPLOY_ID: ${{ github.event.inputs.deploy_id }}\n          STATUS: ${{ github.event.inputs.status }}\n          LOG_TEXT: ${{ github.event.inputs.log_text }}\n        with:\n          script: |\n            const ingestUrl = process.env.INGEST_URL;\n            const ingestToken = process.env.INGEST_TOKEN;\n            const mode = process.env.MODE || \"error\";\n            const sourceKey = process.env.SOURCE_KEY || \"render_primary\";\n            const deployId = process.env.DEPLOY_ID || \"\";\n            const status = process.env.STATUS || \"failed\";\n            const logText = process.env.LOG_TEXT || \"\";\n\n            if (!ingestUrl) {\n              core.setFailed(\"Missing repo secret: RENDER_LOG_INGEST_URL\");\n              return;\n            }\n\n            if (!ingestToken) {\n              core.setFailed(\"Missing repo secret: RENDER_LOG_INGEST_TOKEN\");\n              return;\n            }\n\n            if (!logText.trim()) {\n              core.setFailed(\"log_text is empty\");\n              return;\n            }\n\n            if (mode === \"deploy\" && !deployId.trim()) {\n              core.setFailed(\"deploy_id is required for deploy mode\");\n              return;\n            }\n\n            const body = {\n              sourceKey,\n              mode,\n              meta: {\n                trigger: \"github_actions_workflow_dispatch\",\n                synthetic: false,\n                source: \"github_actions\",\n                repo: context.repo.owner + \"/\" + context.repo.repo,\n                workflow: context.workflow,\n                runId: String(context.runId),\n                actor: context.actor\n              }\n            };\n\n            if (mode === \"error\") {\n              body.logText = logText;\n            }\n\n            if (mode === \"deploy\") {\n              body.deployId = deployId;\n              body.status =…
```
