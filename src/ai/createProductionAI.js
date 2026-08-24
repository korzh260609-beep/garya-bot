export * from './createProductionAICore.js';
import { createProductionAI as createProductionAICore } from './createProductionAICore.js';
import { publishProductionAIRouter } from './runtimeAIRouterBinding.js';

export function createProductionAI(options = {}) {
  const productionAI = createProductionAICore(options);
  publishProductionAIRouter(productionAI.aiRouter);
  return productionAI;
}
