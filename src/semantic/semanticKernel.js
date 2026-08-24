import {
  createCanonicalInput,
  createSemanticInterpretation
} from '../contracts/semantic.js';
import { createDecisionEngine } from '../decision/decisionEngine.js';
import { assertMeaningInterpreter } from './meaningInterpreter.js';
import { createSemanticRequestResolver } from './semanticRequestResolver.js';

export function createSemanticKernel({
  meaningInterpreter,
  decisionEngine = createDecisionEngine(),
  semanticRequestResolver = createSemanticRequestResolver()
}) {
  const interpreter = assertMeaningInterpreter(meaningInterpreter);
  if (!decisionEngine?.decide) throw new TypeError('decisionEngine.decide must be a function');
  if (!semanticRequestResolver?.resolve) throw new TypeError('semanticRequestResolver.resolve must be a function');

  return Object.freeze({
    async process(input) {
      const canonicalInput = createCanonicalInput(input);
      const rawInterpretation = await interpreter.interpret(canonicalInput);
      const interpretation = createSemanticInterpretation(rawInterpretation);
      const canonicalSemanticModel = semanticRequestResolver.resolve({
        canonicalInput,
        interpretation,
        interpreterName: interpreter.name ?? 'anonymous'
      });
      const decision = decisionEngine.decide({
        canonicalInput,
        interpretation,
        canonicalSemanticModel,
        interpreterName: interpreter.name ?? 'anonymous'
      });

      return Object.freeze({
        canonicalInput,
        interpretation,
        canonicalSemanticModel,
        decisionEnvelope: decision.decisionEnvelope,
        responsePlan: decision.responsePlan,
        decisionDiagnostics: Object.freeze({
          candidateEvaluations: decision.candidateEvaluations
        })
      });
    }
  });
}
