// AGENT NOTE:
// SG 2.0 server startup boundary.
// Purpose: start the HTTP server from prepared app/runtime config.
// Do not add route definitions, Telegram setup, AI calls, memory, tasks, sources, permissions, or GitHub write logic here.

export function startServer(app, { port } = {}) {
  return app.listen(port, () => {
    console.log(`SG 2.0 foundation server listening on port ${port}`);
  });
}
