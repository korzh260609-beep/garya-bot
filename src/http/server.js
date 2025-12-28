import express from "express";

export function createApp() {
  const app = express();
  app.use(express.json());
  return app;
}

export function startHttpServer(app, port) {
  app.listen(port, async () => {
    console.log("🌐 HTTP-сервер запущен на порту:", port);
  });
}

