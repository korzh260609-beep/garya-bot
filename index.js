// AGENT NOTE:
// Minimal SG 2.0 Render-compatible health server.
// Purpose: keep dev/v2-start deployable while the real modular SG Core is designed.
// Do not turn this file into a monolith.
// Do not add Telegram, AI, memory, tasks, sources, or permissions here without approved module structure.

import express from 'express';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.status(200).json({
    ok: true,
    project: 'SG 2.0 / Советник GARYA',
    branch: process.env.RENDER_GIT_BRANCH || 'unknown',
    stage: 'v0-foundation',
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'sg2-foundation',
    status: 'healthy',
  });
});

app.listen(port, () => {
  console.log(`SG 2.0 foundation server listening on port ${port}`);
});
