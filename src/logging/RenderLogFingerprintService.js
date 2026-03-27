// ============================================================================
// src/logging/RenderLogFingerprintService.js
// STAGE SKELETON — parse raw log text into structured error fingerprint
// Purpose:
// - extract probable error type/message
// - extract file path / line hints from stack trace
// - classify confidence honestly
// IMPORTANT:
// - this is not a fixer
// - this is not semantic certainty
// - if logs are weak, confidence must stay low
// ============================================================================

import {
  getRenderLogDiagConfig,
} from "./renderLogConfig.js";

function safeStr(v) {
  return v === null || v === undefined ? "" : String(v);
}

function normalizeNewlines(text) {
  return safeStr(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function trimToMaxChars(text, maxChars) {
  const s = normalizeNewlines(text);
  if (s.length <= maxChars) return s;
  return s.slice(-maxChars);
}

function uniqueNonEmpty(values = []) {
  const out = [];
  const seen = new Set();

  for (const value of values) {
    const v = safeStr(value).trim();
    if (!v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }

  return out;
}

function inferErrorKind(text) {
  const t = safeStr(text);

  if (/SyntaxError/i.test(t)) return "syntax_error";
  if (/TypeError/i.test(t)) return "type_error";
  if (/ReferenceError/i.test(t)) return "reference_error";
  if (/RangeError/i.test(t)) return "range_error";
  if (/UnhandledPromiseRejection|unhandled rejection/i.test(t)) {
    return "unhandled_rejection";
  }
  if (/uncaught exception/i.test(t)) return "uncaught_exception";
  if (/duplicate key value violates unique constraint/i.test(t)) {
    return "db_unique_violation";
  }
  if (/violates foreign key constraint/i.test(t)) {
    return "db_fk_violation";
  }
  if (/ECONNREFUSED|connect ECONNREFUSED/i.test(t)) return "network_refused";
  if (/ETIMEDOUT|timeout/i.test(t)) return "timeout";
  if (/Cannot read properties of undefined/i.test(t)) {
    return "undefined_property_access";
  }
  if (/Cannot destructure property .* of .* as it is undefined/i.test(t)) {
    return "undefined_destructure";
  }
  if (/Missing catch or finally after try/i.test(t)) {
    return "try_catch_structure_error";
  }

  return "unknown";
}

function extractErrorHeadline(lines = []) {
  for (const line of lines) {
    const s = safeStr(line).trim();
    if (!s) continue;

    if (
      /(?:SyntaxError|TypeError|ReferenceError|RangeError|Error|Exception|UnhandledPromiseRejection|unhandled rejection)/i.test(
        s
      )
    ) {
      return s;
    }

    if (/duplicate key value violates unique constraint/i.test(s)) {
      return s;
    }
  }

  return "";
}

function extractStackPathHints(lines = []) {
  const pathHints = [];
  const fnHints = [];
  const lineHints = [];

  const patterns = [
    /\bat\s+(?<fn>[A-Za-z0-9_$<>\.\[\]-]+)?\s*\((?<path>(?:file:\/\/)?[^():\s]+(?:\/[^():\s]+)+):(?<line>\d+):(?<col>\d+)\)/,
    /\bat\s+(?<path>(?:file:\/\/)?[^():\s]+(?:\/[^():\s]+)+):(?<line>\d+):(?<col>\d+)/,
    /(?<path>src\/[^:\s]+):(?<line>\d+):(?<col>\d+)/,
    /(?<path>[^:\s]+\.js):(?<line>\d+):(?<col>\d+)/,
  ];

  for (const line of lines) {
    const s = safeStr(line).trim();
    if (!s) continue;

    for (const re of patterns) {
      const m = s.match(re);
      if (!m || !m.groups) continue;

      const rawPath = safeStr(m.groups.path).replace(/^file:\/\//, "");
      const cleanPath = rawPath.replace(/^.*?(src\/)/, "src/");

      pathHints.push(cleanPath || rawPath);

      if (m.groups.fn) {
        fnHints.push(safeStr(m.groups.fn));
      }

      const ln = Number(m.groups.line);
      if (Number.isFinite(ln)) {
        lineHints.push(ln);
      }

      break;
    }
  }

  return {
    pathHints: uniqueNonEmpty(pathHints),
    fnHints: uniqueNonEmpty(fnHints),
    lineHints: lineHints.filter((n) => Number.isFinite(n)),
  };
}

function extractModuleHints(text, lines = []) {
  const out = [];

  for (const line of lines) {
    const s = safeStr(line);

    const serviceLike = s.match(/\b([A-Z][A-Za-z0-9]+Service)\b/g);
    if (Array.isArray(serviceLike)) {
      out.push(...serviceLike);
    }

    const handlerLike = s.match(/\b([A-Za-z0-9]+Handler)\b/g);
    if (Array.isArray(handlerLike)) {
      out.push(...handlerLike);
    }

    const coreLike = s.match(/\b([A-Z][A-Za-z0-9]+Core)\b/g);
    if (Array.isArray(coreLike)) {
      out.push(...coreLike);
    }
  }

  if (/messageRouter/i.test(text)) out.push("messageRouter");
  if (/handleMessage/i.test(text)) out.push("handleMessage");
  if (/MemoryService/i.test(text)) out.push("MemoryService");
  if (/BehaviorEventsService/i.test(text)) out.push("BehaviorEventsService");

  return uniqueNonEmpty(out);
}

function detectSeverity(text) {
  const t = safeStr(text);

  if (/SyntaxError|uncaught exception|UnhandledPromiseRejection|unhandled rejection/i.test(t)) {
    return "high";
  }

  if (/TypeError|ReferenceError|RangeError|duplicate key value|violates .* constraint/i.test(t)) {
    return "high";
  }

  if (/warn|warning/i.test(t)) return "medium";

  return "unknown";
}

function buildConfidence({ errorHeadline, pathHints, lineHints }) {
  if (errorHeadline && pathHints.length > 0 && lineHints.length > 0) {
    return "high";
  }

  if (errorHeadline && pathHints.length > 0) {
    return "medium";
  }

  if (errorHeadline) {
    return "low";
  }

  return "very_low";
}

function summarizeLikelyCause(errorKind, errorHeadline) {
  const headline = safeStr(errorHeadline);

  switch (errorKind) {
    case "try_catch_structure_error":
    case "syntax_error":
      return "вероятна синтаксическая ошибка: нарушен баланс скобок, try/catch/finally или структура блока";
    case "type_error":
    case "undefined_property_access":
      return "вероятен доступ к полю/методу у undefined/null без проверки";
    case "reference_error":
      return "вероятно используется переменная или импорт, который не определён";
    case "db_unique_violation":
      return "вероятна попытка вставить дубликат в БД без upsert/проверки";
    case "db_fk_violation":
      return "вероятно нарушена ссылка на связанную запись в БД";
    case "timeout":
      return "вероятен таймаут внешнего запроса, БД или сети";
    case "network_refused":
      return "вероятно сервис/порт недоступен или env/host указан неверно";
    default:
      if (headline) {
        return `нужна проверка по тексту ошибки: ${headline}`;
      }
      return "лог недостаточно конкретен, нужен более подробный stack trace";
  }
}

export class RenderLogFingerprintService {
  constructor(opts = {}) {
    this.config = {
      ...getRenderLogDiagConfig(),
      ...(opts.config || {}),
    };
  }

  buildFingerprint(logText = "", meta = {}) {
    const trimmed = trimToMaxChars(logText, this.config.maxInputChars);
    const lines = normalizeNewlines(trimmed)
      .split("\n")
      .map((x) => x.trimEnd());

    const nonEmptyLines = lines.filter(Boolean);
    const errorHeadline = extractErrorHeadline(nonEmptyLines);
    const errorKind = inferErrorKind(trimmed);
    const severity = detectSeverity(trimmed);

    const { pathHints, fnHints, lineHints } = extractStackPathHints(
      nonEmptyLines.slice(0, Math.min(nonEmptyLines.length, this.config.maxStackLines))
    );

    const moduleHints = extractModuleHints(trimmed, nonEmptyLines);
    const confidence = buildConfidence({
      errorHeadline,
      pathHints,
      lineHints,
    });

    return {
      ok: true,
      kind: errorKind,
      severity,
      confidence,
      errorHeadline: errorHeadline || "unknown",
      likelyCause: summarizeLikelyCause(errorKind, errorHeadline),
      pathHints: pathHints.slice(0, this.config.maxPathHints),
      functionHints: fnHints.slice(0, this.config.maxPathHints),
      lineHints: lineHints.slice(0, this.config.maxPathHints),
      moduleHints: moduleHints.slice(0, this.config.maxPathHints),
      rawSummary: nonEmptyLines.slice(0, this.config.maxStackLines),
      meta: {
        source: meta?.source || "unknown",
        fingerprintVersion: "render_log_fp_v1",
      },
    };
  }
}

export default RenderLogFingerprintService;