// AGENT NOTE:
// SG 2.0 health HTTP route module.
// Purpose: keep health response shape separate from server startup.
// Do not add Telegram, AI, memory, tasks, sources, permissions, or GitHub write logic here.

export function buildHealthStatus({ telegramBot } = {}) {
  return {
    ok: true,
    service: "sg2-foundation",
    status: "healthy",
    telegram: Boolean(telegramBot),
  };
}

export function attachHealthRoutes(app, { telegramBot } = {}) {
  app.get("/health", (req, res) => {
    res.status(200).json(buildHealthStatus({ telegramBot }));
  });

  return app;
}
