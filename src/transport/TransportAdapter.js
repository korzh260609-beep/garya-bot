/**
 * TransportAdapter — abstract interface (Stage 6.1 SKELETON)
 *
 * Purpose:
 *   Normalizes incoming transport events (Telegram, future Web, etc.)
 *   into unified internal context object.
 *
 * IMPORTANT:
 *   This is a contract only. Not connected to production flow yet.
 */

export class TransportAdapter {
  /**
   * Should transform raw transport event into unified context.
   * @param {any} rawUpdate
   * @returns {object} context
   */
  toContext(rawUpdate) {
    throw new Error("TransportAdapter.toContext() not implemented");
  }

  /**
   * Optional hook for transport-level reply abstraction.
   * @param {object} context
   * @param {string} message
   */
  async reply(context, message) {
    throw new Error("TransportAdapter.reply() not implemented");
  }
}
