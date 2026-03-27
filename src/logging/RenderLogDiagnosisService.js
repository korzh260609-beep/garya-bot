// ============================================================================
// src/logging/RenderLogDiagnosisService.js
// STAGE SKELETON — orchestrate log fingerprint + repo correlation + short report
// Purpose:
// - accept raw log text
// - produce short diagnosis
// - keep honest confidence
// - optionally store diagnosis into ring buffer
// ============================================================================

import RenderLogFingerprintService from "./RenderLogFingerprintService.js";
import RepoCorrelationService from "./RepoCorrelationService.js";
import { LogRingBuffer } from "./LogRingBuffer.js";

function safeStr(v) {
  return v === null || v === undefined ? "" : String(v);
}

function cut(v, max = 240) {
  const s = safeStr(v).trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function buildWhereBlock(correlation) {
  if (!correlation?.topCandidate) {
    return {
      file: "не определён",
      lineText: "не определено",
    };
  }

  const file = correlation.topCandidate.path;
  const lineWindow = correlation.lineWindow || {};

  if (Number.isFinite(lineWindow.exactLine) && lineWindow.exactLine > 0) {
    return {
      file,
      lineText: `примерно строка ${lineWindow.exactLine} (проверить диапазон ${lineWindow.startLine}-${lineWindow.endLine})`,
    };
  }

  return {
    file,
    lineText: "точная строка не определена",
  };
}

function buildFirstCheckAdvice(fingerprint, correlation) {
  const kind = safeStr(fingerprint?.kind);
  const file = safeStr(correlation?.topCandidate?.path);

  if (kind === "try_catch_structure_error" || kind === "syntax_error") {
    return "сначала проверь баланс фигурных скобок, try/catch/finally и соседние блоки вокруг указанной строки";
  }

  if (
    kind === "type_error" ||
    kind === "undefined_property_access" ||
    kind === "undefined_destructure"
  ) {
    return "сначала проверь места, где читается поле/метод у объекта без null/undefined guard";
  }

  if (kind === "reference_error") {
    return "сначала проверь импорт, имя переменной и область видимости";
  }

  if (kind === "db_unique_violation") {
    return "сначала проверь insert/upsert и наличие проверки на дубликат перед записью";
  }

  if (kind === "db_fk_violation") {
    return "сначала проверь порядок записи связанных сущностей и корректность foreign key";
  }

  if (file.includes("messageRouter")) {
    return "сначала проверь последний изменённый блок рядом с router fallback / try-catch";
  }

  if (file.includes("MemoryService")) {
    return "сначала проверь чтение/запись памяти и обязательные поля payload";
  }

  return "сначала проверь ближайший изменённый участок к указанному файлу и строкам";
}

function buildShortDiagnosisText({ fingerprint, correlation }) {
  const where = buildWhereBlock(correlation);

  return [
    `Ошибка: ${cut(fingerprint?.errorHeadline || "unknown", 220)}`,
    `Тип: ${fingerprint?.kind || "unknown"}`,
    `Где проблема: ${where.file}`,
    `Где смотреть: ${where.lineText}`,
    `Почему: ${cut(fingerprint?.likelyCause || "нужна дополнительная проверка", 220)}`,
    `Что проверить первым: ${cut(buildFirstCheckAdvice(fingerprint, correlation), 220)}`,
    `Уверенность: ${correlation?.confidence || fingerprint?.confidence || "very_low"}`,
  ].join("\n");
}

export class RenderLogDiagnosisService {
  constructor(opts = {}) {
    this.fingerprintService =
      opts.fingerprintService || new RenderLogFingerprintService(opts);
    this.repoCorrelationService =
      opts.repoCorrelationService || new RepoCorrelationService(opts);
    this.ringBuffer =
      opts.ringBuffer ||
      new LogRingBuffer({
        errorLimit: 100,
        deployLimit: 10,
        diagnosisLimit: 30,
      });
  }

  async diagnose(logText = "", meta = {}) {
    const fingerprint = this.fingerprintService.buildFingerprint(logText, meta);
    const correlation = await this.repoCorrelationService.correlate(fingerprint);

    const diagnosis = {
      ok: true,
      createdAt: new Date().toISOString(),
      source: meta?.source || "unknown",
      fingerprint,
      correlation,
      shortText: buildShortDiagnosisText({ fingerprint, correlation }),
      diagnosisVersion: "render_diag_v1",
    };

    try {
      this.ringBuffer.pushDiagnosis({
        createdAt: diagnosis.createdAt,
        source: diagnosis.source,
        errorHeadline: fingerprint.errorHeadline,
        kind: fingerprint.kind,
        confidence: correlation.confidence,
        topPath: correlation?.topCandidate?.path || null,
        exactLine: correlation?.lineWindow?.exactLine || null,
        shortText: diagnosis.shortText,
      });
    } catch (_) {
      // never fail diagnosis because of local buffer failure
    }

    return diagnosis;
  }

  async diagnoseAndFormat(logText = "", meta = {}) {
    const diagnosis = await this.diagnose(logText, meta);
    return diagnosis.shortText;
  }

  getLatestDiagnoses(count = 10) {
    return this.ringBuffer.getLatestDiagnoses(count);
  }
}

export default RenderLogDiagnosisService;