// AGENT NOTE:
// SG 2.0 Render client skeleton.
// Purpose: define read-only Render client contracts before real API requests are connected.
// Do not perform network requests in this skeleton.

import { getRenderConfig, getRenderConfigForDiagnostics } from "./RenderConfig.js";

function buildNotConnectedResult({ operation, input = {} } = {}) {
  return {
    ok: false,
    skipped: true,
    reason: "render_client_not_connected",
    operation,
    input,
    renderReads: false,
  };
}

export class RenderClient {
  constructor({ config = getRenderConfig() } = {}) {
    this.config = config;
  }

  getDiagnostics() {
    return getRenderConfigForDiagnostics();
  }

  async listServices(input = {}) {
    return buildNotConnectedResult({
      operation: "list_services",
      input,
    });
  }

  async listDeploys(input = {}) {
    return buildNotConnectedResult({
      operation: "list_deploys",
      input,
    });
  }

  async getDeploy(input = {}) {
    return buildNotConnectedResult({
      operation: "get_deploy",
      input,
    });
  }

  async listLogs(input = {}) {
    return buildNotConnectedResult({
      operation: "list_logs",
      input,
    });
  }
}

export const renderClient = new RenderClient();

export default RenderClient;
