export class SGError extends Error {
  constructor({ code, message, stage, traceId = null, cause = null }) {
    if (!code || !message || !stage) throw new TypeError('code, message and stage are required');
    super(message, { cause });
    this.name = 'SGError';
    this.code = code;
    this.stage = stage;
    this.traceId = traceId;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      stage: this.stage,
      traceId: this.traceId
    };
  }
}
