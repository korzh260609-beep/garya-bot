/**
 * Decision Context Contract
 *
 * This file defines the normalized structure that the Decision Layer
 * expects as input.
 *
 * IMPORTANT:
 * - This file contains NO logic
 * - Only structure helpers / normalization
 * - Not connected to production pipeline yet
 */

export function createDecisionContext(input = {}) {
  return {
    text: input.text || null,
    command: input.command || null,

    transport: input.transport || null,

    userId: input.userId || null,
    chatId: input.chatId || null,

    messageId: input.messageId || null,

    meta: input.meta || {},

    timestamp: Date.now(),
  };
}