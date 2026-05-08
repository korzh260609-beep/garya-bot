// AGENT NOTE:
// Advisor Outbox Agent public boundary.
// Purpose: expose only the minimal outbox writer agent.
// Do not add runtime wiring, Telegram logic, AI calls, DB calls, or broad repository writes here.

export * from "./advisorOutboxAgent.js";
