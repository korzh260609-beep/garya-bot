import { createRenderWebApplication } from './renderWebApplication.js';

const application = await createRenderWebApplication();
let stopping = false;

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  try {
    await application.stop();
    process.stdout.write(`${JSON.stringify({ status: 'render-web-stopped', signal })}\n`);
  } catch (error) {
    console.error('render web shutdown failed', error?.message ?? 'unknown');
    process.exitCode = 1;
  }
}

process.once('SIGTERM', () => shutdown('SIGTERM').then(() => process.exit(process.exitCode ?? 0)));
process.once('SIGINT', () => shutdown('SIGINT').then(() => process.exit(process.exitCode ?? 0)));

const started = await application.start();
process.stdout.write(`${JSON.stringify({ status: 'render-web-ready', ...started })}\n`);
