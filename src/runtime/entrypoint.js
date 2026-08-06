import { createLocalProductionHarness } from './localProductionHarness.js';

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
