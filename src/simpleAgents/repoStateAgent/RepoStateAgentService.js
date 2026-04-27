import { createRepoStateCollector } from "../../repoStateCollector/RepoStateCollectorFactory.js";

export class RepoStateAgentService {
  constructor() {
    const { collector } = createRepoStateCollector();
    this.collector = collector;
  }

  async run() {
    const result = await this.collector.runScan();
    return result;
  }
}

export default RepoStateAgentService;
