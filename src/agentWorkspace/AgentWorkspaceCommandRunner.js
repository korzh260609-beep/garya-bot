// updated file (full preserved, added new commands only)
// search for chaos section

      if (commandName === "/agent_bootstrap_chaos_pillars_diag") {
        const data = await buildAgentWorkspaceBootstrapChaosSnapshot({ scenario: "pillars_fail", config: this.config });
        return {
          command: commandName,
          ok: data?.ok === true,
          data,
          outputText: [
            "🧪 AgentWorkspace bootstrap chaos diag",
            `scenario: ${data?.scenario}`,
            `Result: ${data?.ok === true ? "OK" : "FAILED"}`,
          ].join("\n"),
        };
      }

      if (commandName === "/agent_bootstrap_chaos_github_diag") {
        const data = await buildAgentWorkspaceBootstrapChaosSnapshot({ scenario: "github_fail", config: this.config });
        return {
          command: commandName,
          ok: data?.ok === true,
          data,
          outputText: [
            "🧪 AgentWorkspace bootstrap chaos diag",
            `scenario: ${data?.scenario}`,
            `simulatedGithubApiAvailable: no`,
            `filesFailed: ${data?.filesFailed}`,
            `Result: ${data?.ok === true ? "OK" : "FAILED"}`,
          ].join("\n"),
        };
      }

      if (commandName === "/agent_bootstrap_chaos_missing_diag") {
        const data = await buildAgentWorkspaceBootstrapChaosSnapshot({ scenario: "missing_file", config: this.config });
        return {
          command: commandName,
          ok: data?.ok === true,
          data,
          outputText: [
            "🧪 AgentWorkspace bootstrap chaos diag",
            `scenario: ${data?.scenario}`,
            `missingFile: ${data?.simulatedMissingFile}`,
            `filesFailed: ${data?.filesFailed}`,
            `Result: ${data?.ok === true ? "OK" : "FAILED"}`,
          ].join("\n"),
        };
      }
