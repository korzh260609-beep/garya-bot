import { boundedText, enumValue } from './workspaceOperationsContract.js';
import { hashKey, uid } from './workspaceOperationsCore.js';

function optionalText(value, name, maxLength) {
  if (value == null || value === '') return null;
  return boundedText(String(value), name, maxLength);
}

export function createWorkspaceMediaPublicationOperation({ core, botClient = null } = {}) {
  if (!core?.store || typeof core?.gate !== 'function' || typeof core?.workspace !== 'function' || typeof core?.capabilities !== 'function') {
    throw new TypeError('workspace operations core is required');
  }

  const { store, gate, workspace, capabilities } = core;

  async function publish(ctx, {
    mediaType,
    fileId,
    fileUniqueId = null,
    fileName = null,
    mimeType = null,
    caption = '',
    provenance = null
  } = {}) {
    const type = enumValue(mediaType, ['photo', 'video', 'document'], 'mediaType');
    const telegramFileId = boundedText(fileId, 'fileId', 512);
    const normalizedCaption = boundedText(caption ?? '', 'caption', 1024, { allowEmpty: true });

    return gate(ctx, {
      operation: 'media.publish',
      domain: 'media',
      risk: 'medium',
      confirmationRequired: true,
      authorityAction: 'workspace:publish',
      requiredPermission: 'workspace:publish'
    }, async () => {
      if (!botClient) throw Object.assign(new Error('Telegram publication client unavailable'), { code: 'twm-publication-unavailable' });
      const target = await workspace(ctx.workspaceId);
      await capabilities(ctx.workspaceId, ['telegram.media.send']);

      const content = await store.createRecord({
        workspaceId: ctx.workspaceId,
        domain: 'content',
        recordId: uid('content'),
        status: 'draft',
        visibility: 'workspace',
        privacyClass: 'workspace',
        actorGlobalUserId: ctx.actorGlobalUserId,
        payload: { kind: type, text: '', caption: normalizedCaption, metadata: {} },
        idempotencyKey: ctx.idempotencyKey ?? null
      });

      const media = await store.createRecord({
        workspaceId: ctx.workspaceId,
        domain: 'media',
        recordId: uid('media'),
        status: 'ready',
        visibility: 'operators',
        privacyClass: 'workspace',
        actorGlobalUserId: ctx.actorGlobalUserId,
        payload: {
          mediaType: type,
          fileId: telegramFileId,
          fileUniqueId: optionalText(fileUniqueId, 'fileUniqueId', 512),
          fileName: optionalText(fileName, 'fileName', 512),
          mimeType: optionalText(mimeType, 'mimeType', 128),
          provenance: provenance == null ? null : structuredClone(provenance)
        }
      });

      const attached = await store.updateRecord({
        workspaceId: ctx.workspaceId,
        domain: 'content',
        recordId: content.recordId,
        actorGlobalUserId: ctx.actorGlobalUserId,
        status: content.status,
        payload: { ...content.payload, mediaId: media.recordId },
        expectedVersion: content.version
      });

      const common = { chatId: target.telegramChatId, caption: normalizedCaption || null };
      let message;
      if (type === 'photo') {
        if (typeof botClient.sendPhoto !== 'function') throw Object.assign(new Error('Telegram photo API unavailable'), { code: 'twm-publication-unavailable' });
        message = await botClient.sendPhoto({ ...common, photo: telegramFileId });
      } else if (type === 'video') {
        if (typeof botClient.sendVideo !== 'function') throw Object.assign(new Error('Telegram video API unavailable'), { code: 'twm-publication-unavailable' });
        message = await botClient.sendVideo({ ...common, video: telegramFileId });
      } else {
        if (typeof botClient.sendDocument !== 'function') throw Object.assign(new Error('Telegram document API unavailable'), { code: 'twm-publication-unavailable' });
        message = await botClient.sendDocument({ ...common, document: telegramFileId });
      }

      const publishedAt = new Date().toISOString();
      const published = await store.updateRecord({
        workspaceId: ctx.workspaceId,
        domain: 'content',
        recordId: attached.recordId,
        actorGlobalUserId: ctx.actorGlobalUserId,
        status: 'published',
        payload: {
          ...attached.payload,
          telegramMessageId: message?.message_id ?? null,
          publishedAt,
          executionKey: null
        },
        expectedVersion: attached.version
      });

      await store.appendEvent({
        workspaceId: ctx.workspaceId,
        eventKey: hashKey(['content.published', published.recordId, message?.message_id ?? null, 'media.publish']),
        eventType: 'content.published',
        recordDomain: 'content',
        recordId: published.recordId,
        actorGlobalUserId: ctx.actorGlobalUserId,
        evidence: { telegramMessageId: message?.message_id ?? null, mediaType: type }
      });

      return published;
    });
  }

  return Object.freeze({ publish });
}
