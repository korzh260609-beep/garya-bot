import { createDiagnosticFinding } from './contracts.js';
import { eventNames } from './pathRegistry.js';

function hasName(evidence, name) {
  return eventNames(evidence).includes(name);
}

function outcome(evidence) {
  return String(evidence?.payload?.outcome ?? evidence?.payload?.data?.outcome ?? '').toLowerCase();
}

function firstIndex(evidence, predicate) {
  const index = evidence.findIndex(predicate);
  return index < 0 ? null : index;
}

export function evaluateTraceInvariants(trace) {
  const evidence = trace?.evidence ?? [];
  const findings = [];

  const gateAllowIndex = firstIndex(evidence, (item) => hasName(item, 'action_gate_decision') && ['allow', 'allowed'].includes(outcome(item)));
  const capabilityStartIndex = firstIndex(evidence, (item) => hasName(item, 'capability_started'));
  if (capabilityStartIndex != null && (gateAllowIndex == null || gateAllowIndex > capabilityStartIndex)) {
    const item = evidence[capabilityStartIndex];
    findings.push(createDiagnosticFinding({
      kind: 'invariant-violation', errorClass: 'AUTHORIZATION', component: 'action-gate', confidence: 'CONFIRMED',
      summary: 'Capability execution started without a preceding allowed Action Gate decision.',
      evidenceIds: [item.evidenceId], data: { invariant: 'capability-requires-prior-gate-allow' }
    }));
  }

  const deliveryCompletedIndex = firstIndex(evidence, (item) => hasName(item, 'delivery_completed') || hasName(item, 'telegram_update_completed'));
  const responseIndex = firstIndex(evidence, (item) => hasName(item, 'final_response_observed') || hasName(item, 'response_composed') || hasName(item, 'final_response_guard') || hasName(item, 'capability_completed'));
  if (deliveryCompletedIndex != null && (responseIndex == null || responseIndex > deliveryCompletedIndex)) {
    const item = evidence[deliveryCompletedIndex];
    findings.push(createDiagnosticFinding({
      kind: 'invariant-violation', errorClass: 'DELIVERY', component: 'delivery', confidence: 'CONFIRMED',
      summary: 'Delivery completed before any response/execution completion evidence.',
      evidenceIds: [item.evidenceId], data: { invariant: 'delivery-requires-response-completion' }
    }));
  }

  const observedResponse = evidence.find((item) => hasName(item, 'final_response_observed'));
  const observedData = observedResponse?.payload?.data ?? {};
  const hashesMatch = Boolean(observedData.inputHash && observedData.outputHash && observedData.inputHash === observedData.outputHash);
  if (observedResponse && (observedData.exactEcho === true || hashesMatch)) {
    findings.push(createDiagnosticFinding({
      kind: 'invariant-violation', errorClass: 'RESPONSE', component: 'final-response-delivery-boundary', confidence: 'CONFIRMED',
      summary: 'Final response exactly matches the normalized user input at the delivery boundary.',
      evidenceIds: [observedResponse.evidenceId],
      data: { invariant: 'final-response-must-not-exactly-echo-user', reason: 'exact-user-echo' }
    }));
  }

  const guardFailure = evidence.find((item) => hasName(item, 'final_response_guard') && ['failed', 'failure', 'error'].includes(outcome(item)));
  if (guardFailure) {
    findings.push(createDiagnosticFinding({
      kind: 'invariant-violation', errorClass: 'RESPONSE', component: 'final-response-guard', confidence: 'CONFIRMED',
      summary: 'Final response guard rejected the candidate response.', evidenceIds: [guardFailure.evidenceId],
      data: { invariant: 'final-response-must-pass-guard', reason: guardFailure.errorCode ?? guardFailure.payload?.data?.reason ?? null }
    }));
  }

  return Object.freeze(findings);
}
