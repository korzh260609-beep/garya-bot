// AGENT NOTE:
// SG 2.0 app module public boundary.
// Purpose: provide stable app/server exports while implementation lives in focused modules.
// Do not add AI, memory, tasks, sources, permissions, or GitHub write logic here.

export * from "./appFactory.js";
export * from "./healthRoutes.js";
export * from "./rootRoutes.js";
export * from "./serverStartup.js";
