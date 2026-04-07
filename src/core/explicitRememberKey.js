// src/core/explicitRememberKey.js
// STAGE 7.5 — explicit remember key + value extraction
//
// Goal:
// - deterministic only
// - no AI
// - classify narrow known cases
// - extract normalized value for known patterns
// - fallback to raw value for unknown cases
//
// STAGE 11.x additive layer:
// - preserve existing key/value behavior
// - expose structured memory mapping in parallel:
//   domain -> slot -> value
// - DO NOT break current runtime callers

import { deriveExplicitRememberStructure } from "./explicitRememberStructure.js";

function normalizeRememberText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function safeStr(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function cleanValue(v) {
  return safeStr(v)
    .replace(/^[\s:=-]+/, "")
    .replace(/[\s.]+$/, "")
    .trim();
}

function hasAny(text, parts = []) {
  return parts.some((part) => text.includes(part));
}

function hasAll(text, parts = []) {
  return parts.every((part) => text.includes(part));
}

// ==========================================================
// VALUE EXTRACTORS
// ==========================================================

function extractNameValue(raw) {
  const text = safeStr(raw);

  const patterns = [
    /м[оё]е имя\s+(.+)/i,
    /меня зовут\s+(.+)/i,
    /my name is\s+(.+)/i,
    /my name\s+(.+)/i,
    /i am\s+(.+)/i,
    /i'm\s+(.+)/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const value = cleanValue(m[1]);
      if (value) return value;
    }
  }

  return null;
}

function isCommunicationStylePreference(text) {
  const styleWords = [
    "интонаци",
    "тон",
    "настроени",
    "стиль общения",
    "стиль ответа",
    "манера общения",
    "стиль спілкування",
    "манера спілкування",
    "общайся",
    "спілкуйся",
    "разговаривай",
    "веди разговор",
    "отвечай со мной",
    "как я",
    "в моем стиле",
    "в моём стиле",
    "в моєму стилі",
    "подстраивайся",
    "підлаштовуйся",
    "уловливай",
    "вловлюй",
    "официально",
    "официоз",
    "канцеляр",
    "коротко",
    "по делу",
    "без воды",
    "як для дитини",
    "как для ребенка",
    "как для ребёнка",
    "tone",
    "mood",
    "communication style",
    "response style",
    "speak to me",
    "talk to me",
    "reply to me",
    "adapt to my tone",
    "same tone",
    "same mood",
    "same style",
    "formal",
    "formal tone",
    "concise",
    "brief",
    "direct",
  ];

  const instructionWords = [
    "должен",
    "нужно",
    "хочу",
    "прошу",
    "запомни",
    "remember",
    "must",
    "should",
    "need to",
    "i want",
    "please",
  ];

  const hasStyleSignal = hasAny(text, styleWords);
  const hasInstructionSignal = hasAny(text, instructionWords);

  if (
    hasAll(text, ["такой же", "тон"]) ||
    hasAll(text, ["такой же", "интонаци"]) ||
    hasAll(text, ["такое же", "настроени"]) ||
    hasAll(text, ["same", "tone"]) ||
    hasAll(text, ["same", "mood"]) ||
    hasAll(text, ["same", "style"])
  ) {
    return true;
  }

  // важно: shadow/normalized input часто приходит уже без "запомни"
  if (
    text.startsWith("мой стиль общения ") ||
    text.startsWith("мій стиль спілкування ") ||
    text.startsWith("стиль общения ") ||
    text.startsWith("стиль спілкування ")
  ) {
    return true;
  }

  return hasStyleSignal && hasInstructionSignal;
}

function extractCommunicationStyleValue(raw) {
  const text = safeStr(raw).replace(/\s+/g, " ").trim();
  if (!text) return null;

  const patterns = [
    /(?:запомни|remember)\s+мой\s+стиль\s+общения\s+(.+)/i,
    /(?:запомни|remember)\s+мій\s+стиль\s+спілкування\s+(.+)/i,
    /мой\s+стиль\s+общения\s+(.+)/i,
    /мій\s+стиль\s+спілкування\s+(.+)/i,
    /стиль\s+общения\s+(.+)/i,
    /стиль\s+спілкування\s+(.+)/i,
    /(?:запомни|remember)\s+отвечай\s+(.+)/i,
    /(?:запомни|remember)\s+відповідай\s+(.+)/i,
    /(?:запомни|remember)\s+общайся\s+(.+)/i,
    /(?:запомни|remember)\s+спілкуйся\s+(.+)/i,
    /(?:запомни|remember)\s+разговаривай\s+(.+)/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const value = cleanValue(m[1]);
      if (value) return value;
    }
  }

  const simplified = text.replace(/^(запомни|remember)\s+/i, "").trim();

  return cleanValue(simplified || text);
}

function isPreferredAddressPreference(text) {
  if (!text) return false;

  if (
    hasAny(text, [
      "называй меня",
      "зови меня",
      "обращайся ко мне",
      "обращайся ко мне как",
      "называй меня так",
      "зови мене",
      "називай мене",
      "звертайся до мене",
      "звертайся до мене як",
      "call me",
      "address me as",
      "refer to me as",
    ])
  ) {
    return true;
  }

  if (
    hasAll(text, ["как", "меня", "называть"]) ||
    hasAll(text, ["как", "ко", "мне", "обращаться"]) ||
    hasAll(text, ["як", "мене", "називати"]) ||
    hasAll(text, ["як", "до", "мене", "звертатися"])
  ) {
    return true;
  }

  return false;
}

function extractPreferredAddressValue(raw) {
  const text = safeStr(raw).replace(/\s+/g, " ").trim();
  if (!text) return null;

  const patterns = [
    /(?:запомни|remember)\s+называй\s+меня\s+(.+)/i,
    /(?:запомни|remember)\s+зови\s+меня\s+(.+)/i,
    /(?:запомни|remember)\s+обращайся\s+ко\s+мне\s+как\s+(.+)/i,
    /(?:запомни|remember)\s+обращайся\s+ко\s+мне\s+(.+)/i,
    /(?:запомни|remember)\s+називай\s+мене\s+(.+)/i,
    /(?:запомни|remember)\s+зови\s+мене\s+(.+)/i,
    /(?:запомни|remember)\s+звертайся\s+до\s+мене\s+як\s+(.+)/i,
    /(?:запомни|remember)\s+звертайся\s+до\s+мене\s+(.+)/i,
    /(?:запомни|remember)\s+call\s+me\s+(.+)/i,
    /(?:запомни|remember)\s+address\s+me\s+as\s+(.+)/i,
    /называй\s+меня\s+(.+)/i,
    /зови\s+меня\s+(.+)/i,
    /обращайся\s+ко\s+мне\s+как\s+(.+)/i,
    /обращайся\s+ко\s+мне\s+(.+)/i,
    /називай\s+мене\s+(.+)/i,
    /зови\s+мене\s+(.+)/i,
    /звертайся\s+до\s+мене\s+як\s+(.+)/i,
    /звертайся\s+до\s+мене\s+(.+)/i,
    /call\s+me\s+(.+)/i,
    /address\s+me\s+as\s+(.+)/i,
    /refer\s+to\s+me\s+as\s+(.+)/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[1]) {
      const value = cleanValue(m[1]);
      if (value) return value;
    }
  }

  return null;
}

// ==========================================================
// MAIN CLASSIFIER
// ==========================================================

export function classifyExplicitRemember(value) {
  const raw = safeStr(value).replace(/\s+/g, " ").trim();
  const text = normalizeRememberText(value);

  if (!text) {
    return {
      key: "user_explicit_memory",
      value: raw,
    };
  }

  // ==========================================================
  // USER PROFILE — NAME
  // ==========================================================
  if (
    hasAny(text, [
      "мое имя ",
      "моё имя ",
      "меня зовут ",
      "my name is ",
      "my name ",
      "i am ",
      "i'm ",
    ])
  ) {
    const extracted = extractNameValue(raw);

    return {
      key: "name",
      value: extracted || raw,
    };
  }

  // ==========================================================
  // USER PREFERENCE — PREFERRED ADDRESS
  // ==========================================================
  if (isPreferredAddressPreference(text)) {
    return {
      key: "preferred_address",
      value: extractPreferredAddressValue(raw) || raw,
    };
  }

  // ==========================================================
  // USER PREFERENCE — COMMUNICATION STYLE
  // ==========================================================
  if (isCommunicationStylePreference(text)) {
    return {
      key: "communication_style",
      value: extractCommunicationStyleValue(raw) || raw,
    };
  }

  // ==========================================================
  // TASK / SCHEDULE
  // ==========================================================
  if (
    (hasAny(text, [
      "каждый день",
      "каждое утро",
      "каждый вечер",
      "ежедневно",
      "every day",
      "daily",
    ]) &&
      hasAny(text, [
        "доклад",
        "отчёт",
        "отчет",
        "report",
        "присылать",
        "отправлять",
        "напоминать",
        "напоминание",
      ])) ||
    (hasAny(text, ["расписание", "schedule"]) &&
      hasAny(text, [
        "доклад",
        "отчёт",
        "отчет",
        "report",
        "напоминание",
        "напоминать",
      ])) ||
    (hasAny(text, ["в 9 утра", "в 10 утра", "в 11 утра"]) &&
      hasAny(text, [
        "доклад",
        "отчёт",
        "отчет",
        "report",
        "присылать",
        "отправлять",
      ]))
  ) {
    return {
      key: "task_schedule",
      value: raw,
    };
  }

  // ==========================================================
  // CAR / VEHICLE
  // ==========================================================
  if (
    hasAny(text, [
      "freelander",
      "фрилендер",
      "машина",
      "авто",
      "автомобиль",
      "land rover",
      "landrover",
      "лэнд ровер",
      "ровер",
    ])
  ) {
    if (
      hasAny(text, [
        "двигател",
        "engine",
        "мотор",
        "td4",
        "турбодиз",
        "diesel",
        "дизель",
        "бензин",
        "2.2",
        "2,2",
        "2.0",
        "2,0",
      ])
    ) {
      return {
        key: "car_engine",
        value: raw,
      };
    }

    if (
      hasAny(text, [
        "комплектац",
        "trim",
        "версия",
        "модификац",
        " s",
        "s ",
        "se",
        "hse",
      ])
    ) {
      return {
        key: "car_trim",
        value: raw,
      };
    }

    return {
      key: "car",
      value: raw,
    };
  }

  // ==========================================================
  // MAINTENANCE — OIL LAST CHANGE
  // ==========================================================
  if (
    hasAny(text, ["масла", "масло", "oil"]) &&
    (hasAny(text, [
      "последняя замена",
      "последний раз",
      "last change",
      "last oil change",
    ]) ||
      hasAll(text, ["замена", "масла", "была"]) ||
      hasAll(text, ["замена", "масло", "была"]) ||
      hasAll(text, ["замена", "масла", "на"]) ||
      hasAll(text, ["замена", "масло", "на"]) ||
      hasAny(text, ["заменил масло", "заменили масло", "масло заменено"]))
  ) {
    return {
      key: "maintenance_oil_last_change",
      value: raw,
    };
  }

  // ==========================================================
  // MAINTENANCE — OIL INTERVAL
  // ==========================================================
  if (
    hasAny(text, ["масло", "oil"]) &&
    hasAny(text, [
      "каждые",
      "кожні",
      "every",
      "интервал",
      "interval",
      "замена масла",
      "меняю масло",
    ])
  ) {
    return {
      key: "maintenance_oil_interval",
      value: raw,
    };
  }

  // ==========================================================
  // MAINTENANCE — FUEL FILTER LAST CHANGE
  // ==========================================================
  if (
    hasAny(text, [
      "топливн",
      "fuel filter",
      "fuel-filter",
      "фильтр топлива",
      "паливн",
    ]) &&
    (hasAny(text, [
      "последняя замена",
      "последний раз",
      "last change",
      "last replaced",
    ]) ||
      hasAny(text, ["заменил", "заменили", "была на"]))
  ) {
    return {
      key: "maintenance_fuel_filter_last_change",
      value: raw,
    };
  }

  // ==========================================================
  // MAINTENANCE — FUEL FILTER INTERVAL
  // ==========================================================
  if (
    hasAny(text, [
      "топливн",
      "fuel filter",
      "fuel-filter",
      "фильтр топлива",
      "паливн",
    ]) &&
    hasAny(text, [
      "фильтр",
      "filter",
      "замена",
      "меняю",
      "каждые",
      "кожні",
      "every",
      "интервал",
      "interval",
    ])
  ) {
    return {
      key: "maintenance_fuel_filter_interval",
      value: raw,
    };
  }

  // ==========================================================
  // MAINTENANCE — HALDEX
  // ==========================================================
  if (hasAny(text, ["haldex", "халдекс", "муфта", "муфте", "муфты"])) {
    if (
      hasAny(text, [
        "последняя замена",
        "последний раз",
        "была на",
        "заменил",
        "заменили",
      ])
    ) {
      return {
        key: "maintenance_haldex_last_change",
        value: raw,
      };
    }

    if (
      hasAny(text, [
        "каждые",
        "кожні",
        "every",
        "интервал",
        "interval",
      ])
    ) {
      return {
        key: "maintenance_haldex_interval",
        value: raw,
      };
    }

    return {
      key: "car_service_fact",
      value: raw,
    };
  }

  return {
    key: "user_explicit_memory",
    value: raw,
  };
}

// ==========================================================
// STRUCTURED LAYER (ADDITIVE, SAFE)
// ==========================================================

export function classifyExplicitRememberStructured(value) {
  const classified = classifyExplicitRemember(value);

  const structured = deriveExplicitRememberStructure({
    key: classified.key,
    value: classified.value,
  });

  return {
    ...classified,
    domain: structured.domain,
    slot: structured.slot,
    canonicalKey: structured.canonicalKey,
    structureSource: structured.source,
  };
}

export function classifyExplicitRememberDomain(value) {
  return classifyExplicitRememberStructured(value).domain;
}

export function classifyExplicitRememberSlot(value) {
  return classifyExplicitRememberStructured(value).slot;
}

export function classifyExplicitRememberCanonicalKey(value) {
  return classifyExplicitRememberStructured(value).canonicalKey;
}

// ==========================================================
// PUBLIC EXPORTS
// ==========================================================

export function classifyExplicitRememberKey(value) {
  return classifyExplicitRemember(value).key;
}

export function extractExplicitRememberValue(value) {
  return classifyExplicitRemember(value).value;
}

export default classifyExplicitRememberKey;