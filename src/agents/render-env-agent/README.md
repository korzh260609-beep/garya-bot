# RenderEnvAgent

Simple SG agent for Render environment inventory.

Purpose:
- collect Render service environment variable names;
- show safe allowlisted values only;
- hide secret or unknown values;
- write one latest JSON report into `runtime/render/latest/latest-render-env.json`.

Rules:
- no env writes;
- no env deletes;
- no Render deploys;
- no Render restarts;
- no AI calls;
- no DB calls;
- no Telegram flow;
- secret values must never be written to GitHub, Telegram, logs, or reports.

Current mode:
- simple collector;
- collect facts -> sanitize -> write one JSON file.
