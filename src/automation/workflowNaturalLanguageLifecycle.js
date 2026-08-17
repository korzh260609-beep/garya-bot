import { createWorkflowStep } from './workflowContract.js';

export const WORKFLOW_NATURAL_LANGUAGE_OPERATIONS = Object.freeze([
  'add-step',
  'remove-step',
  'replace-workflow',
  'change-output-style',
  'change-trigger',
  'pause',
  'resume',
  'cancel',
  'restore-version'
]);

export class WorkflowLifecycleError extends Error {
  constructor(code, message, details = null) {
    super(message);
    this.name = 'WorkflowLifecycleError';
    this.code = code;
    this.details = details;
    this.retryable = false;
  }
}

function plainObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WorkflowLifecycleError('workflow_lifecycle_invalid', `${field} must be an object`);
  }
  return value;
}

function jsonClone(value, field) {
  try {
    return structuredClone(value);
  } catch {
    throw new WorkflowLifecycleError('workflow_lifecycle_invalid', `${field} must be JSON-compatible`);
  }
}

function exactKeys(value, allowed, field) {
  const unsupported = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unsupported.length) throw new WorkflowLifecycleError('workflow_lifecycle_invalid', `${field} has unsupported fields: ${unsupported.join(', ')}`);
}

export function normalizeWorkflowLifecycleOperation(value) {
  const operation = plainObject(value, 'operation');
  exactKeys(operation, ['type', 'data'], 'operation');
  const type = typeof operation.type === 'string' ? operation.type.trim() : '';
  if (!WORKFLOW_NATURAL_LANGUAGE_OPERATIONS.includes(type)) {
    throw new WorkflowLifecycleError('workflow_lifecycle_operation_unsupported', `unsupported workflow lifecycle operation: ${type || 'missing'}`);
  }
  const data = operation.data == null ? {} : plainObject(operation.data, 'operation.data');
  return Object.freeze({ type, data: Object.freeze(jsonClone(data, 'operation.data')) });
}

function targetIndex(steps, target, operation) {
  const normalized = plainObject(target, `${operation}.target`);
  exactKeys(normalized, ['index', 'type'], `${operation}.target`);
  if (normalized.index != null) {
    if (!Number.isInteger(normalized.index) || normalized.index < 0 || normalized.index >= steps.length) {
      throw new WorkflowLifecycleError('workflow_lifecycle_step_not_found', `${operation} step index is out of range`);
    }
    return normalized.index;
  }
  if (typeof normalized.type !== 'string' || normalized.type.trim() === '') {
    throw new WorkflowLifecycleError('workflow_lifecycle_invalid', `${operation}.target requires index or type`);
  }
  const matches = steps.flatMap((step, index) => step.type === normalized.type.trim() ? [index] : []);
  if (matches.length !== 1) {
    throw new WorkflowLifecycleError(
      matches.length === 0 ? 'workflow_lifecycle_step_not_found' : 'workflow_lifecycle_step_ambiguous',
      `${operation} target must resolve to exactly one step`,
      { matchCount: matches.length, clarificationRequired: true }
    );
  }
  return matches[0];
}

function addStep(current, data) {
  exactKeys(data, ['step', 'position'], 'add-step.data');
  const step = createWorkflowStep(data.step);
  const steps = current.steps.map((item) => jsonClone(item, 'workflow step'));
  let index = steps.findIndex((item) => item.type === 'deliver');
  if (index < 0) index = steps.length;
  if (data.position != null) {
    const position = plainObject(data.position, 'add-step.data.position');
    exactKeys(position, ['index', 'before', 'after'], 'add-step.data.position');
    if (position.index != null) {
      if (!Number.isInteger(position.index) || position.index < 0 || position.index > steps.length) {
        throw new WorkflowLifecycleError('workflow_lifecycle_position_invalid', 'add-step position index is out of range');
      }
      index = position.index;
    } else if (position.before != null) {
      index = targetIndex(steps, position.before, 'add-step.before');
    } else if (position.after != null) {
      index = targetIndex(steps, position.after, 'add-step.after') + 1;
    } else {
      throw new WorkflowLifecycleError('workflow_lifecycle_position_invalid', 'add-step position requires index, before or after');
    }
  }
  steps.splice(index, 0, jsonClone(step, 'add-step.step'));
  return { patch: { steps }, lifecycleAction: null };
}

function removeStep(current, data) {
  exactKeys(data, ['target'], 'remove-step.data');
  const steps = current.steps.map((item) => jsonClone(item, 'workflow step'));
  const index = targetIndex(steps, data.target, 'remove-step');
  steps.splice(index, 1);
  if (steps.length === 0) throw new WorkflowLifecycleError('workflow_lifecycle_empty_workflow', 'remove-step cannot remove the final workflow step');
  return { patch: { steps }, lifecycleAction: null };
}

function replaceWorkflow(data) {
  exactKeys(data, ['steps', 'inputs', 'delivery', 'executionPolicy'], 'replace-workflow.data');
  if (!Array.isArray(data.steps) || data.steps.length === 0) {
    throw new WorkflowLifecycleError('workflow_lifecycle_invalid', 'replace-workflow.data.steps must be a non-empty array');
  }
  const patch = { steps: data.steps.map((step) => jsonClone(createWorkflowStep(step), 'replace-workflow step')) };
  for (const field of ['inputs', 'delivery', 'executionPolicy']) if (data[field] != null) patch[field] = jsonClone(plainObject(data[field], `replace-workflow.data.${field}`), field);
  return { patch, lifecycleAction: null };
}

function changeOutputStyle(current, data) {
  exactKeys(data, ['deliveryPatch', 'composePatch'], 'change-output-style.data');
  const patch = {};
  if (data.deliveryPatch != null) patch.delivery = { ...jsonClone(current.delivery, 'workflow.delivery'), ...jsonClone(plainObject(data.deliveryPatch, 'change-output-style.data.deliveryPatch'), 'deliveryPatch') };
  if (data.composePatch != null) {
    const composePatch = jsonClone(plainObject(data.composePatch, 'change-output-style.data.composePatch'), 'composePatch');
    const steps = current.steps.map((step) => jsonClone(step, 'workflow step'));
    const index = targetIndex(steps, { type: 'compose' }, 'change-output-style');
    steps[index] = { ...steps[index], ...composePatch, type: 'compose' };
    patch.steps = steps;
  }
  if (Object.keys(patch).length === 0) throw new WorkflowLifecycleError('workflow_lifecycle_invalid', 'change-output-style requires deliveryPatch or composePatch');
  return { patch, lifecycleAction: null };
}

function restoreVersion(current, data, history) {
  exactKeys(data, ['version'], 'restore-version.data');
  if (!Number.isInteger(data.version) || data.version < 1 || data.version >= current.version) {
    throw new WorkflowLifecycleError('workflow_lifecycle_restore_version_invalid', 'restore version must be an earlier positive workflow version');
  }
  const matches = history.filter((entry) => Number(entry.version) === data.version);
  if (matches.length !== 1) throw new WorkflowLifecycleError('workflow_lifecycle_restore_version_not_found', `workflow version ${data.version} is unavailable`);
  const snapshot = matches[0].workflow;
  return {
    patch: {
      trigger: jsonClone(snapshot.trigger, 'restore trigger'),
      steps: jsonClone(snapshot.steps, 'restore steps'),
      inputs: jsonClone(snapshot.inputs, 'restore inputs'),
      delivery: jsonClone(snapshot.delivery, 'restore delivery'),
      executionPolicy: jsonClone(snapshot.executionPolicy, 'restore executionPolicy')
    },
    lifecycleAction: null,
    restoredFromVersion: data.version
  };
}

export function workflowLifecycleOperationNeedsHistory(operation) {
  return normalizeWorkflowLifecycleOperation(operation).type === 'restore-version';
}

export function compileWorkflowLifecycleOperation({ currentWorkflow, operation, history = [] } = {}) {
  const current = plainObject(currentWorkflow, 'currentWorkflow');
  const normalized = normalizeWorkflowLifecycleOperation(operation);
  switch (normalized.type) {
    case 'add-step': return Object.freeze({ ...addStep(current, normalized.data), operation: normalized });
    case 'remove-step': return Object.freeze({ ...removeStep(current, normalized.data), operation: normalized });
    case 'replace-workflow': return Object.freeze({ ...replaceWorkflow(normalized.data), operation: normalized });
    case 'change-output-style': return Object.freeze({ ...changeOutputStyle(current, normalized.data), operation: normalized });
    case 'change-trigger': {
      exactKeys(normalized.data, ['trigger'], 'change-trigger.data');
      return Object.freeze({ patch: Object.freeze({ trigger: jsonClone(plainObject(normalized.data.trigger, 'change-trigger.data.trigger'), 'trigger') }), lifecycleAction: null, operation: normalized });
    }
    case 'pause':
    case 'resume':
    case 'cancel':
      exactKeys(normalized.data, [], `${normalized.type}.data`);
      return Object.freeze({ patch: Object.freeze({}), lifecycleAction: normalized.type, operation: normalized });
    case 'restore-version': return Object.freeze({ ...restoreVersion(current, normalized.data, history), operation: normalized });
    default: throw new WorkflowLifecycleError('workflow_lifecycle_operation_unsupported', `unsupported workflow lifecycle operation: ${normalized.type}`);
  }
}
