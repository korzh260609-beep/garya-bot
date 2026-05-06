// AGENT NOTE:
// Minimal SG 2.0 Render-compatible startup file.
// Purpose: start prepared HTTP app through the app startup boundary.
// Do not turn this file into a monolith.
// Do not put Telegram, AI, memory, tasks, sources, permissions, routes, or GitHub logic here.

import { getRuntimeConfig } from "./src/config/env.js";
import { createApp, startServer } from "./src/app/index.js";

const runtimeConfig = getRuntimeConfig();
const { app } = createApp();

startServer(app, { port: runtimeConfig.port });
