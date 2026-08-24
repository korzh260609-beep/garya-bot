export function createOwnerSecurityActionGate({ actionGate, ownerSecurityGateway } = {}) {
  if (!actionGate?.evaluate) throw new TypeError('actionGate.evaluate is required');
  if (!ownerSecurityGateway?.evaluate) throw new TypeError('ownerSecurityGateway.evaluate is required');

  return Object.freeze({
    name: `${ownerSecurityGateway.name ?? 'owner-security'}→${actionGate.name ?? 'action-gate'}`,
    evaluate(actionRequest, context = {}) {
      const ownerSecurityDecision = ownerSecurityGateway.evaluate(actionRequest);
      return actionGate.evaluate(actionRequest, { ...context, ownerSecurityDecision });
    }
  });
}
