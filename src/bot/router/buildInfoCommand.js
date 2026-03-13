// src/bot/router/buildInfoCommand.js

export async function handleBuildInfoCommand({
  ctxReply,
  getPublicEnvSnapshot,
  upsertProjectSection,
  cmdBase,
}) {
  const pub = getPublicEnvSnapshot();

  const commit =
    String(pub.RENDER_GIT_COMMIT || "").trim() ||
    String(pub.GIT_COMMIT || "").trim() ||
    "unknown";

  const serviceId = String(pub.RENDER_SERVICE_ID || "").trim() || "unknown";

  const instanceId =
    String(pub.RENDER_INSTANCE_ID || "").trim() ||
    String(pub.HOSTNAME || "").trim() ||
    "unknown";

  const nodeEnv = String(pub.NODE_ENV || "").trim() || "unknown";
  const nowIso = new Date().toISOString();

  if (typeof upsertProjectSection === "function") {
    const content = [
      `DEPLOY VERIFIED`,
      `ts: ${nowIso}`,
      `commit: ${commit}`,
      `service: ${serviceId}`,
      `instance: ${instanceId}`,
      `node_env: ${nodeEnv}`,
    ].join("\n");

    try {
      await upsertProjectSection({
        section: "deploy.last_verified",
        title: "DEPLOY VERIFIED",
        content,
        tags: ["deploy", "build_info"],
        meta: { commit, serviceId, instanceId, nodeEnv, ts: nowIso },
        schemaVersion: 1,
      });
    } catch (e) {
      console.error("build_info autosave failed:", e);
    }
  }

  await ctxReply(
    [
      "🧩 BUILD INFO",
      `commit: ${commit}`,
      `service: ${serviceId}`,
      `instance: ${instanceId}`,
      `node_env: ${nodeEnv}`,
    ].join("\n"),
    { cmd: cmdBase, handler: "messageRouter" }
  );
}