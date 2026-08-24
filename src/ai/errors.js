export class AIError extends Error {
  constructor(message, { code = 'AI_ERROR', retryable = false, cause, metadata = {} } = {}) {
    super(message, { cause });
    this.name = this.constructor.name;
    this.code = code;
    this.retryable = retryable;
    this.metadata = Object.freeze({ ...metadata });
  }
}

export class AIConfigurationError extends AIError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'AI_CONFIGURATION_ERROR' });
  }
}

export class AITimeoutError extends AIError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'AI_TIMEOUT', retryable: true });
  }
}

export class AIProviderError extends AIError {
  constructor(message, options = {}) {
    super(message, { ...options, code: options.code ?? 'AI_PROVIDER_ERROR' });
  }
}

export class AIOutputValidationError extends AIError {
  constructor(message, options = {}) {
    super(message, { ...options, code: 'AI_OUTPUT_INVALID', retryable: false });
  }
}
