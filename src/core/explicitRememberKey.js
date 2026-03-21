// src/core/explicitRememberKey.js
// STAGE 7.4 V1 — explicit remember key classification
//
// Goal:
// - keep deterministic no-AI classification
// - keep current useful exact keys
// - do NOT try to classify every topic in the world
// - unknown => fallback user_explicit_memory
//
// IMPORTANT:
// - keep logic narrow and predictable
// - do not rewrite user value broadly
// - only derive rememberKey + narrow normalized value where explicitly safe
// - broad universal memory must be solved later by Memory V2,
//   not by endless if/else growth here

function normalizeRememberText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeOriginalText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function hasAny(text, parts = []) {
  return parts.some((part) => text.includes(part));
}

function hasAll(text, parts = []) {
  return parts.every((part) => text.includes(part));
}

function extractExplicitNameValue(value) {
  const original = normalizeOriginalText(value);
  if (!original) return "";

  const patterns = [
    /^(?:мое|моё)\s+имя\s+(.+)$/i,
    /^меня\s+зовут\s+(.+)$/i,
    /^my\s+name\s+is\s+(.+)$/i,
    /^my\s+name\s+(.+)$/i,
    /^i\s+am\s+(.+)$/i,
    /^i'm\s+(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(original);
    if (!match || !match[1]) continue;

    const extracted = String(match[1] || "").replace(/\s+/g, " ").trim();
    if (extracted) return extracted;
  }

  return "";
}

export function classifyExplicitRemember(value) {
  const original = normalizeOriginalText(value);
  const text = normalizeRememberText(value);

  if (!text) {
    return {
      key: "user_explicit_memory",
      value: original,
    };
  }

  // ==========================================================
  // USER PROFILE — NAME
  // IMPORTANT:
  // - keep narrow and deterministic
  // - detect only explicit self-name statements
  // - avoid broad guessing
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
    const extractedName = extractExplicitNameValue(original);

    return {
      key: "name",
      value: extractedName || original,
    };
  }

  // ==========================================================
  // TASK / SCHEDULE
  // IMPORTANT:
  // - keep BEFORE maintenance checks
  // - require stronger schedule intent to avoid false positives
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
      value: original,
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
        value: original,
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
        value: original,
      };
    }

    return {
      key: "car",
      value: original,
    };
  }

  // ==========================================================
  // MAINTENANCE — OIL LAST CHANGE
  // IMPORTANT:
  // - keep BEFORE oil interval
  // - detect factual statement about last replacement
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
      value: original,
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
      value: original,
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
      value: original,
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
      value: original,
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
        value: original,
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
        value: original,
      };
    }

    return {
      key: "car_service_fact",
      value: original,
    };
  }

  return {
    key: "user_explicit_memory",
    value: original,
  };
}

export function classifyExplicitRememberKey(value) {
  return classifyExplicitRemember(value).key;
}

export default classifyExplicitRememberKey;