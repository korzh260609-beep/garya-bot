export * from './createProductionAICore.js';
import { createProductionAI as createProductionAICore } from './createProductionAICore.js';
import { publishProductionAIRouter } from './runtimeAIRouterBinding.js';
import { createGitHubDevelopmentMeaningInterpreter } from '../githubDevelopment/githubDevelopmentMeaningInterpreter.js';

export function createProductionAI(options = {}) {
  const productionAI = createProductionAICore(options);
  const meaningInterpreter = createGitHubDevelopmentMeaningInterpreter({ baseInterpreter: productionAI.meaningInterpreter, aiRouter: productionAI.aiRouter });
  publishProductionAIRouter(productionAI.aiRouter);
  return Object.freeze({ ...productionAI, meaningInterpreter });
}
