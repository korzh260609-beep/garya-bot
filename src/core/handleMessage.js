/**
 * handleMessage — transport-agnostic entry point (Stage 6.3 SKELETON)
 *
 * IMPORTANT:
 *   Not wired to production yet.
 *   messageRouter remains active.
 */

export async function handleMessage(context) {
  if (!context) {
    throw new Error("handleMessage: context is required");
  }

  // future:
  // - permission layer
  // - command dispatch
  // - AI routing
  // - logging
  // - observability hooks

  return {
    handled: false,
    reason: "SKELETON_NOT_CONNECTED",
  };
}
