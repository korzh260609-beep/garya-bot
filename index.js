// AGENT NOTE:
// Minimal SG 2.0 Render-compatible startup file.
// Purpose: start HTTP health routes and attach approved modular transports.
// Do not turn this file into a monolith.
// Do not put Telegram, AI, memory, tasks, sources, or permissions logic here.

import express from 'express';
import { getRuntimeConfig } from './src/config/env.js';
import { initTelegramTransport } from './src/transport/telegram.js';

const app = express();
const runtimeConfig = getRuntimeConfig();
const port = runtimeConfig.port;

app.use(express.json({ limit: '256kb' }));

const telegramBot = initTelegramTransport(app);

app.get('/', (req, res) => {
  res.status(200).json({
    ok: true,
    project: 'SG 2.0 / Советник GARYA',
    branch: process.env.RENDER_GIT_BRANCH || 'unknown',
    stage: 'v0-foundation-speaking-minimal',
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    ok: true,
    service: 'sg2-foundation',
    status: 'healthy',
    telegram: Boolean(telegramBot),
  });
});

app.listen(port, () => {
  console.log(`SG 2.0 foundation server listening on port ${port}`);
});
