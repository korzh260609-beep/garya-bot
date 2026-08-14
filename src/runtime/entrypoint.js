import { createLocalProductionHarness } from './localProductionHarness.js';

function isExistingRenderService(env = process.env) {
  const truthy = (value) => ['1', 'true', 'yes', 'on'].includes(String(value ?? '').trim().toLowerCase());
  if (truthy(env.RENDER)) return true;
  if (String(env.RENDER_SERVICE_ID ?? '').trim()) return true;
  if (String(env.RENDER_EXTERNAL_URL ?? '').trim()) return true;
  if (String(env.RENDER_EXTERNAL_HOSTNAME ?? '').trim()) return true;
  return /\.onrender\.com(?::\d+)?\/?$/i.test(String(env.BASE_URL ?? '').trim());
}

if (isExistingRenderService(process.env)) {
  await import('./renderWebEntrypoint.js');
} else {
  const harness = createLocalProductionHarness({ env: process.env });
  let stopping = false;

  async function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    const state = await harness.runtime.stop();
    process.stdout.write(`${JSON.stringify({ status: 'runtime-stopped', signal, state })}\n`);
  }

  process.once('SIGINT', () => shutdown('SIGINT').catch((error) => { console.error(error); process.exitCode = 1; }));
  process.once('SIGTERM', () => shutdown('SIGTERM').catch((error) => { console.error(error); process.exitCode = 1; }));

  const state = await harness.runtime.start();
  const result = await harness.transport.send({ text: process.env.SG_RUNTIME_INPUT ?? 'Block 12 runtime verification', userId: 'developer', projectId: 'sg2.1' });
  process.stdout.write(`${JSON.stringify({
    status: 'runtime-ready',
    state,
    persistence: harness.persistence ? { mode: 'postgres', ...harness.persistence.health() } : { mode: 'memory' },
    response: result.response
  })}\n`);
  await shutdown('verification-complete');
}
