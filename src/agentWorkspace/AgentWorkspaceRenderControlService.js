// UPDATED PART ONLY (rest unchanged)

  buildArgs(command = {}) {
    const payload = parsePayload(command.payload || "");
    const bridgeCfg = getRenderBridgeConfig();

    return {
      taskId: command.taskId || "manual",
      workflowPoint: command.workflowPoint || "-",
      service: normalizeString(payload.service || payload.serviceName || payload.serviceSlug || ""),
      level: safeLevel(payload.level || bridgeCfg.defaultLogLevel || "error"),
      minutes: clampInt(payload.minutes, bridgeCfg.defaultLogWindowMinutes || 60, 1, 1440),
      limit: clampInt(payload.limit, bridgeCfg.defaultLogLimit || 100, 1, 300),
      maxLineChars: clampInt(payload.maxLineChars, 700, 120, 1200),
      deployId: normalizeString(payload.deployId || command.deployId || ""),
      target: normalizeString(payload.target || "time"),
    };
  }

  async collectLogs(command = {}) {
    const args = this.buildArgs(command);
    const collectedAt = nowIso();
    const state = await this.ensureServiceSelected("global");

    let logs = [];

    // === NEW: target logic ===
    if (args.target === "latest_deploy" || args.target === "previous_deploy" || args.deployId) {
      const deploys = await renderBridge.listDeploys({
        serviceId: state.selected_service_id,
        limit: 5,
      });

      let selectedDeploy = null;

      if (args.deployId) {
        selectedDeploy = deploys.find(d => d.id === args.deployId);
      } else if (args.target === "latest_deploy") {
        selectedDeploy = deploys[0];
      } else if (args.target === "previous_deploy") {
        selectedDeploy = deploys[1];
      }

      if (selectedDeploy && selectedDeploy.createdAt) {
        const start = new Date(selectedDeploy.createdAt).getTime();
        const end = selectedDeploy.finishedAt
          ? new Date(selectedDeploy.finishedAt).getTime()
          : Date.now();

        const minutes = Math.max(1, Math.ceil((end - start) / 60000));

        logs = await renderBridge.listRecentLogs({
          ownerId: state.selected_owner_id,
          serviceId: state.selected_service_id,
          level: args.level,
          minutes,
          limit: args.limit,
        });
      }
    } else {
      // default: time-based
      logs = await renderBridge.listRecentLogs({
        ownerId: state.selected_owner_id,
        serviceId: state.selected_service_id,
        level: args.level,
        minutes: args.minutes,
        limit: args.limit,
      });
    }

    const write = await this.writeMarkdown(
      "RENDER_LOGS_REPORT.md",
      buildLogsReport({ taskId: args.taskId, workflowPoint: args.workflowPoint, state, logs, args, collectedAt }),
      `update render logs report for ${args.taskId}`
    );

    return {
      ok: true,
      taskId: args.taskId,
      workflowPoint: args.workflowPoint,
      logs: logs.length,
      write,
    };
  }
