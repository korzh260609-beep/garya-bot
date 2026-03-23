// src/core/explicitRememberKey.js
// STAGE 7.5 — explicit remember key + value extraction
//
// Goal:
// - deterministic only
// - no AI
// - classify narrow known cases
// - extract normalized value for known patterns
// - fallback to raw value for unknown cases

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
    "общайся",
    "разговаривай",
    "веди разговор",
    "отвечай со мной",
    "как я",
    "в моем стиле",
    "в моём стиле",
    "подстраивайся",
    "уловливай",
    "официально",
    "официоз",
    "канцеляр",
    "коротко",
    "по делу",
    "без воды",
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

  return hasStyleSignal && hasInstructionSignal;
}

function extractCommunicationStyleValue(_raw) {
  return "Отвечай коротко, прямо, по делу и естественно. Улавливай мою интонацию и подстраивайся под мой тон общения. Не уходи в официоз.";
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
  // USER PREFERENCE — COMMUNICATION STYLE
  // ==========================================================
  if (isCommunicationStylePreference(text)) {
    return {
      key: "communication_style",
      value: extractCommunicationStyleValue(raw),
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
      hasAny(text, ["доклад", "отчёт", "отчет", "report", "напоминание", "напоминать"])) ||
    (hasAny(text, ["в 9 утра", "в 10 утра", "в 11 утра"]) &&
      hasAny(text, ["доклад", "отчёт", "отчет", "report", "присылать", "отправлять"]))
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
    (
      hasAny(text, [
        "последняя замена",
        "последний раз",
        "last change",
        "last oil change",
      ]) ||
      hasAll(text, ["замена", "масла", "была"]) ||
      hasAll(text, ["замена", "масло", "была"]) ||
      hasAll(text, ["замена", "масла", "на"]) ||
      hasAll(text, ["замена", "масло", "на"]) ||
      hasAny(text, [
        "заменил масло",
        "заменили масло",
        "масло заменено",
      ])
    )
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
    (
      hasAny(text, [
        "последняя замена",
        "последний раз",
        "last change",
        "last replaced",
      ]) ||
      hasAny(text, [
        "заменил",
        "заменили",
        "была на",
      ])
    )
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
  if (
    hasAny(text, [
      "haldex",
      "халдекс",
      "муфта",
      "муфте",
      "муфты",
    ])
  ) {
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
// PUBLIC EXPORTS
// ==========================================================

export function classifyExplicitRememberKey(value) {
  return classifyExplicitRemember(value).key;
}

export function extractExplicitRememberValue(value) {
  return classifyExplicitRemember(value).value;
}

export default classifyExplicitRememberKey;