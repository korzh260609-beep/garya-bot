'use strict';

const { deps } = require('../deps');
const guardIncomingChatMessage = require('../services/chatMemory/guardIncomingChatMessage.js');
const insertWebhookDedupeEvent = require('../db/chatMessagesRepo.js');
const touchChatMeta = require('../db/chatMeta.js');

async function handleMessage({ transport, chatId, chatType, globalUserId, senderId, messageId, trimmed, raw }) {
    // Existing logic...

    if (!isCommandMessage) {
        // New fail-open insert-first guard for telegram non-command messages with numeric messageId
        const content = buildInboundStorageText(trimmed, raw);
        // Additional variables
        const textHash = sha256Text(trimmed);
        const metadata = {
            senderIdStr: senderId || null,
            chatIdStr: chatIdStr,
            messageId,
            globalUserId
        };
        const rawMeta = buildRawMeta(raw || {});

        const guardResult = await guardIncomingChatMessage({
            transport,
            chatId: chatIdStr,
            chatType,
            globalUserId,
            senderId,
            messageId,
            textHash,
            content,
            truncated,
            metadata,
            raw: rawMeta,
            schemaVersion: 1,
        });

        if (guardResult.duplicate) {
            await deps.logInteraction(chatIdStr, {
                taskType: 'chat',
                aiCostLevel: 'none',
                event: 'WEBHOOK_DEDUPE_HIT'
            });
            await insertWebhookDedupeEvent({
                transport,
                chatId: chatIdStr,
                messageId,
                globalUserId: globalUserId || null,
                reason: 'retry_duplicate',
                metadata: { handler: 'core', stage: '7B.7' }
            });
            return { ok: true, stage: '7B.7', result: 'dup_chat_drop' };
        } else {
            await touchChatMeta({
                transport,
                chatId: String(chatIdStr),
                chatType,
                title: raw?.chat?.title || null,
                role: 'user',
            });
        }
    }
    // Existing logic...
}

module.exports = { handleMessage };