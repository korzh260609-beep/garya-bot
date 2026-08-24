import { parseStructuredAIOutput } from '../ai/contracts.js';

const LANGUAGE_DETECTION_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['language', 'confidence'],
  properties: {
    language: { type: 'string', minLength: 2, maxLength: 16 },
    confidence: { type: 'number', minimum: 0, maximum: 1 }
  }
});

function normalizeLanguage(value) {
  const raw = String(value ?? '').trim().replace('_', '-').toLowerCase();
  if (!raw) return 'und';
  return raw.split('-')[0] || 'und';
}

export function createAILanguageDetector({ aiRouter } = {}) {
  if (!aiRouter?.route) throw new TypeError('aiRouter.route is required');
  return Object.freeze({
    async detect(text, { traceContext, identityContext, role = 'guest' } = {}) {
      if (!traceContext?.traceId || !traceContext?.requestId) throw new TypeError('traceContext is required for AI language detection');
      const result = await aiRouter.route({
        task: 'language-detection',
        specialty: 'semantic-interpretation',
        reason: 'Resolve low-confidence natural-language code for SG Language Context',
        traceContext,
        identityContext,
        role,
        messages: [
          { role: 'system', content: 'Detect only the dominant natural language of the supplied text. Return schema-valid JSON only. Use the ISO/BCP-47 base language code such as en, uk, ru, pl, sv, fi, ka, hy. If no natural language can be determined, return und with low confidence. Do not interpret or answer the message.' },
          { role: 'user', content: String(text ?? '') }
        ],
        responseFormat: { name: 'language_detection', jsonSchema: LANGUAGE_DETECTION_SCHEMA },
        metadata: { purpose: 'language-context-low-confidence-fallback' }
      });
      const parsed = parseStructuredAIOutput(result);
      return Object.freeze({
        language: normalizeLanguage(parsed.language),
        confidence: Number(parsed.confidence ?? 0),
        source: 'ai-router-fallback'
      });
    }
  });
}
