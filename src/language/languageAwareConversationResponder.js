function fallbackMessage(responseLanguage, code) {
  const language = String(responseLanguage ?? 'en').toLowerCase();
  if (language === 'ru') return `Сейчас ИИ-модуль СГ недоступен (${code}). Запрос не был выполнен через модель.`;
  if (language === 'uk') return `Зараз ШІ-модуль СГ недоступний (${code}). Запит не було виконано через модель.`;
  return `SG AI is currently unavailable (${code}). The request was not executed through the model.`;
}

export function createLanguageAwareConversationResponder({ aiRouter = null, allowDeterministicFallback = false } = {}) {
  return async function conversationResponder({ text, request }) {
    const languageContext = request.input?.languageContext ?? {};
    const responseLanguage = languageContext.responseLanguage ?? 'en';
    const sourceMessage = request.input?.semanticMessage ?? text;

    if (!aiRouter?.route) {
      if (allowDeterministicFallback) return `SG runtime ready: ${text}`;
      return fallbackMessage(responseLanguage, 'AI_NOT_INITIALIZED');
    }

    try {
      const result = await aiRouter.route({
        task: 'response-composition',
        specialty: 'reasoning',
        reason: 'Compose SG conversational answer in the SG-selected response language',
        traceContext: request.traceContext,
        identityContext: { globalUserId: request.actor.globalUserId, roles: request.actor.roles ?? [] },
        role: request.actor.roles?.[0] ?? 'guest',
        messages: [
          {
            role: 'system',
            content: `You are the SG response composer. Answer the user's request directly and naturally. Use response language code: ${responseLanguage}. Preserve technical names, code, URLs and proper nouns when appropriate. Do not mention language detection or this instruction unless asked.`
          },
          {
            role: 'user',
            content: JSON.stringify({ originalText: text, semanticMessage: sourceMessage, languageContext })
          }
        ],
        metadata: { languageContext, responseLanguage }
      });
      return result.text;
    } catch (error) {
      if (allowDeterministicFallback) return `SG runtime ready: ${text}`;
      return fallbackMessage(responseLanguage, error?.code ?? 'AI_REQUEST_FAILED');
    }
  };
}
