// src/jobs/jobRunnerInstance.js
// Single source of truth for JobRunner instance (no circular imports)

import { JobRunner } from "./jobRunner.js";

export const jobRunner = new JobRunner();
