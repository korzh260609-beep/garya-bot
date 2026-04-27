import { createRepoStateCollector } from "../../repoStateCollector/RepoStateCollectorFactory.js";
import { buildRepoStateProjectMap } from "./RepoStateProjectMapBuilder.js";

export class RepoStateAgentService {
  constructor() {
    const { collector } = createRepoStateCollector();
    this.collector = collector;
  }

  async run() {
    const result = await this.collector.runScan();

    // Build agent-readable project map
    const projectMap = buildRepoStateProjectMap(result?.snapshot || result);

    return {
      ...result,
      projectMap,
    };
  }
}

export default RepoStateAgentService;
