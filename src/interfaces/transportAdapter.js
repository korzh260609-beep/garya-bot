import { randomUUID } from 'node:crypto';
import { createCanonicalInput } from '../contracts/semantic.js';

function requiredString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function requiredFunction(value, field) {
  if (typeof value !== 'function') throw new TypeError(`${field} must be a function`);
  return value;
}

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${field} must be an object`);
  return value;
}

export function normalizeTransportResponse(result) {
  if (typeof result === 'string') return Object.freeze({ status: 'success', message: requiredString(result, 'response message'), data: null });
  object(result, 'transport response');
  return Object.freeze({
    status: requiredString(result.status ?? 'success', 'response status'),
    message: requiredString(result.message, 'response message'),
    data: result.data == null ? null : Object.freeze({ ...object(result.data, 'response data') })
  });
}

export function createTransportAdapter({
  name,
  metadataResolver,
  identityResolver,
  requestHandler,
  responseDeliverer,
  idFactory = randomUUID,
  environment = 'production',
  revision = 'unknown'
} = {}) {
  const transportName = requiredString(name, 'transport name');
  requiredFunction(metadataResolver, 'metadataResolver');
  requiredFunction(identityResolver, 'identityResolver');
  requiredFunction(requestHandler, 'requestHandler');
  requiredFunction(responseDeliverer, 'responseDeliverer');
  requiredFunction(idFactory, 'idFactory');

  async function receive(platformInput) {
    object(platformInput, 'platform input');
    const metadata = object(await metadataResolver(platformInput), 'transport metadata');
    const resolution = object(await identityResolver(Object.freeze({
      transport: transportName,
      platformFacts: Object.freeze({ ...(metadata.platformFacts ?? {}) }),
      scopeFacts: Object.freeze({ ...(metadata.scopeFacts ?? {}) })
    })), 'identity resolution');

    const traceContext = Object.freeze({
      traceId: metadata.traceId ?? idFactory(),
      requestId: metadata.requestId ?? idFactory(),
      parentSpanId: metadata.parentSpanId ?? null,
      environment,
      revision
    });

    const canonicalInput = createCanonicalInput({
      text: requiredString(metadata.text, 'metadata.text'),
      locale: metadata.locale ?? 'ru',
      identityContext: object(resolution.identityContext, 'identityContext'),
      scopeContext: object(resolution.scopeContext, 'scopeContext'),
      traceContext,
      metadata: {
        transport: transportName,
        channel: metadata.channel ?? null,
        platformMessageId: metadata.platformMessageId ?? null,
        replyToMessageId: metadata.replyToMessageId ?? null,
        attachments: Object.freeze([...(metadata.attachments ?? [])])
      }
    });

    const response = normalizeTransportResponse(await requestHandler(canonicalInput));
    await responseDeliverer(Object.freeze({ response, canonicalInput, platformInput }));
    return Object.freeze({ canonicalInput, response });
  }

  return Object.freeze({ name: transportName, receive });
}
