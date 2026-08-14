export const IDENTITY_RESPONSE_INTENTS = Object.freeze({
  SELF: 'self_identity',
  USER: 'user_identity'
});

function normalizeIntent(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/gu, '_');
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function clean(value) {
  const text = value == null ? '' : String(value).trim();
  return text || null;
}

function findSelfFact(context, category, key) {
  return context?.selfKnowledge?.facts?.find((fact) =>
    fact?.category === category
    && fact?.key === key
    && fact?.status === 'implemented'
    && Number(fact?.confidence ?? 0) > 0
  ) ?? null;
}

function canonicalProfileAnchor(profile) {
  if (!profile) return null;
  return clean(profile.preferredName)
    ?? clean(profile.displayName)
    ?? clean([profile.firstName, profile.lastName].filter(Boolean).join(' '))
    ?? clean(profile.username);
}

function unique(values) {
  return Object.freeze([...new Set(values.map(clean).filter(Boolean))]);
}

function freezeContract(value) {
  return Object.freeze({
    ...value,
    requiredAnchors: unique(value.requiredAnchors ?? []),
    payload: Object.freeze(clone(value.payload ?? {}))
  });
}

export function createIdentityResponseContract({ semanticIntent, boundedResponseContext } = {}) {
  const intent = normalizeIntent(semanticIntent);
  if (![IDENTITY_RESPONSE_INTENTS.SELF, IDENTITY_RESPONSE_INTENTS.USER].includes(intent)) {
    return freezeContract({ active: false, available: false, intent: intent || null, reason: 'not-identity-intent', requiredAnchors: [], payload: {} });
  }

  if (intent === IDENTITY_RESPONSE_INTENTS.SELF) {
    const systemName = findSelfFact(boundedResponseContext, 'identity', 'system-name');
    const entityType = findSelfFact(boundedResponseContext, 'identity', 'entity-type');
    const purpose = findSelfFact(boundedResponseContext, 'purpose', 'core-purpose');
    const shortName = clean(systemName?.value?.short ?? (typeof systemName?.value === 'string' ? systemName.value : null));
    const fullName = clean(systemName?.value?.full ?? (typeof systemName?.value === 'string' ? systemName.value : null));
    const authoritative = systemName?.provenance?.sourceType === 'authority';

    if (!fullName || !authoritative) {
      return freezeContract({
        active: true,
        available: false,
        intent,
        reason: 'verified-self-identity-unavailable',
        requiredAnchors: [],
        payload: {
          selfKnowledgeValidationStatus: boundedResponseContext?.selfKnowledge?.validationStatus ?? 'invalid'
        }
      });
    }

    return freezeContract({
      active: true,
      available: true,
      intent,
      reason: 'verified-self-identity-resolved',
      requiredAnchors: [fullName],
      payload: {
        subject: 'sg',
        canonicalIdentity: {
          shortName,
          fullName,
          entityType: clone(entityType?.value ?? null),
          purpose: clone(purpose?.value ?? null)
        },
        verification: {
          sourceType: systemName.provenance.sourceType,
          sourceId: systemName.provenance.sourceId,
          sourceRevision: systemName.provenance.sourceRevision,
          selfKnowledgeValidationStatus: boundedResponseContext?.selfKnowledge?.validationStatus ?? 'unknown'
        }
      }
    });
  }

  const identity = boundedResponseContext?.identity ?? null;
  const globalUserId = clean(identity?.globalUserId);
  if (!globalUserId) {
    return freezeContract({
      active: true,
      available: false,
      intent,
      reason: 'verified-user-identity-unavailable',
      requiredAnchors: [],
      payload: {}
    });
  }

  const roles = unique(identity?.roles ?? []);
  const profile = clone(identity?.profile ?? null);
  const confirmedMemory = Object.freeze([...(boundedResponseContext?.confirmedUserMemory ?? [])]
    .filter((record) => record?.confirmed === true)
    .map((record) => Object.freeze({
      key: record.key ?? null,
      value: clone(record.value),
      trust: record.trust ?? null,
      privacyClass: record.privacyClass ?? null,
      scopeKind: record.scopeKind ?? null,
      provenance: clone(record.provenance ?? null)
    })));
  const profileAnchor = canonicalProfileAnchor(profile);

  return freezeContract({
    active: true,
    available: true,
    intent,
    reason: 'verified-user-identity-resolved',
    requiredAnchors: [globalUserId, ...roles, profileAnchor].filter(Boolean),
    payload: {
      subject: 'current-user',
      verifiedGlobalUserId: globalUserId,
      roles,
      canonicalProfile: profile,
      profileAuthority: identity?.profileAuthority ?? 'descriptive-only',
      authenticationLevel: identity?.authenticationLevel ?? null,
      permittedConfirmedMemory: confirmedMemory
    }
  });
}

function normalized(value) {
  return String(value ?? '').normalize('NFKC').toLocaleLowerCase();
}

export function assessIdentityResponseContract({ contract, candidateText } = {}) {
  if (!contract?.active) return Object.freeze({ ok: true, reason: null, missingAnchors: Object.freeze([]) });
  if (!contract.available) return Object.freeze({ ok: false, reason: 'identity-contract-unavailable', missingAnchors: Object.freeze([]) });
  const candidate = normalized(candidateText);
  const missingAnchors = contract.requiredAnchors.filter((anchor) => !candidate.includes(normalized(anchor)));
  if (missingAnchors.length > 0) {
    return Object.freeze({ ok: false, reason: 'identity-contract-anchor-missing', missingAnchors: Object.freeze([...missingAnchors]) });
  }
  return Object.freeze({ ok: true, reason: null, missingAnchors: Object.freeze([]) });
}

function memorySummary(records) {
  if (!Array.isArray(records) || records.length === 0) return null;
  return records.slice(0, 8).map((record) => `${record.key}=${JSON.stringify(record.value)}`).join('; ');
}

function profileSummary(profile) {
  if (!profile) return null;
  const preferred = canonicalProfileAnchor(profile);
  const username = clean(profile.username);
  if (preferred && username && preferred !== username) return `${preferred} (@${username.replace(/^@/u, '')})`;
  return preferred ?? (username ? `@${username.replace(/^@/u, '')}` : null);
}

export function renderIdentityResponseFallback({ contract, responseLanguage = 'en' } = {}) {
  const language = String(responseLanguage ?? 'en').trim().toLowerCase();
  if (!contract?.active) throw new TypeError('active identity response contract is required');

  if (!contract.available) {
    if (language === 'ru') return 'Проверенная идентичность сейчас недоступна в контексте СГ, поэтому я не буду её придумывать.';
    if (language === 'uk') return 'Перевірена ідентичність зараз недоступна в контексті СГ, тому я не буду її вигадувати.';
    return 'Verified identity is unavailable in the current SG context, so I will not invent it.';
  }

  if (contract.intent === IDENTITY_RESPONSE_INTENTS.SELF) {
    const identity = contract.payload.canonicalIdentity ?? {};
    const fullName = identity.fullName;
    const shortName = identity.shortName;
    const entityType = clean(identity.entityType);
    const purpose = clean(identity.purpose);
    if (language === 'ru') {
      return `Я — ${fullName}${shortName ? ` (${shortName})` : ''}.${entityType ? ` Тип: ${entityType}.` : ''}${purpose ? ` Назначение: ${purpose}` : ''}`.trim();
    }
    if (language === 'uk') {
      return `Я — ${fullName}${shortName ? ` (${shortName})` : ''}.${entityType ? ` Тип: ${entityType}.` : ''}${purpose ? ` Призначення: ${purpose}` : ''}`.trim();
    }
    return `I am ${fullName}${shortName ? ` (${shortName})` : ''}.${entityType ? ` Type: ${entityType}.` : ''}${purpose ? ` Purpose: ${purpose}` : ''}`.trim();
  }

  const payload = contract.payload;
  const roles = payload.roles?.length ? payload.roles.join(', ') : null;
  const profile = profileSummary(payload.canonicalProfile);
  const memory = memorySummary(payload.permittedConfirmedMemory);
  if (language === 'ru') {
    return `Ваш verified Global ID: ${payload.verifiedGlobalUserId}. Роли: ${roles ?? 'нет подтверждённых ролей'}. Канонический профиль: ${profile ?? 'нет подтверждённых данных профиля'}.${memory ? ` Подтверждённая разрешённая память: ${memory}.` : ' Подтверждённой разрешённой памяти для ответа сейчас нет.'}`;
  }
  if (language === 'uk') {
    return `Ваш verified Global ID: ${payload.verifiedGlobalUserId}. Ролі: ${roles ?? 'немає підтверджених ролей'}. Канонічний профіль: ${profile ?? 'немає підтверджених даних профілю'}.${memory ? ` Підтверджена дозволена пам’ять: ${memory}.` : ' Підтвердженої дозволеної пам’яті для відповіді зараз немає.'}`;
  }
  return `Your verified Global ID: ${payload.verifiedGlobalUserId}. Roles: ${roles ?? 'no verified roles'}. Canonical profile: ${profile ?? 'no verified profile data'}.${memory ? ` Permitted confirmed memory: ${memory}.` : ' No permitted confirmed memory is currently available for this answer.'}`;
}
