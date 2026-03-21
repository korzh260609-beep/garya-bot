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
// - do not rewrite user value
// - only derive rememberKey
// - broad universal memory must be solved later by Memory V2,
//   not by endless if/else growth here

function normalizeRememberText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text, parts = []) {
  return parts.some((part) => text.includes(part));
}

function hasAll(text, parts = []) {
  return parts.every((part) => text.includes(part));
}

export function classifyExplicitRememberKey(value) {
  const text = normalizeRememberText(value);

  if (!text) {
    return "user_explicit_memory";
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
    return "name";
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
    return "task_schedule";
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
      return "car_engine";
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
      return "car_trim";
    }

    return "car";
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
    return "maintenance_oil_last_change";
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
    return "maintenance_oil_interval";
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
    return "maintenance_fuel_filter_last_change";
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
    return "maintenance_fuel_filter_interval";
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
      return "maintenance_haldex_last_change";
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
      return "maintenance_haldex_interval";
    }

    return "car_service_fact";
  }

  return "user_explicit_memory";
}

export default classifyExplicitRememberKey;