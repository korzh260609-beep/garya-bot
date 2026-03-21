// src/core/explicitRememberKey.js
// STAGE 7.4 V1 — explicit remember key classification
//
// Goal:
// - classify explicit remember payload into a small safe set of keys
// - no AI
// - deterministic rules only
// - unknown => fallback user_explicit_memory
//
// IMPORTANT:
// - keep logic narrow and predictable
// - do not rewrite user value
// - only derive rememberKey

function normalizeRememberText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hasAny(text, parts = []) {
  return parts.some((part) => text.includes(part));
}

export function classifyExplicitRememberKey(value) {
  const text = normalizeRememberText(value);

  if (!text) {
    return "user_explicit_memory";
  }

  // ==========================================================
  // TASK / SCHEDULE
  // IMPORTANT:
  // - keep BEFORE maintenance checks
  // - otherwise phrases like "каждый день" may be mistaken for service interval
  // ==========================================================
  if (
    hasAny(text, [
      "каждый день",
      "каждое утро",
      "каждый вечер",
      "ежедневно",
      "every day",
      "daily",
      "в 9 утра",
      "в 10 утра",
      "в 11 утра",
      "утра",
      "вечера",
      "доклад",
      "отчёт",
      "отчет",
      "report",
      "присылать",
      "отправлять",
      "напоминать",
      "напоминание",
      "schedule",
      "расписание",
    ])
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
  // - "последняя замена масла..." is a fact, not interval
  // ==========================================================
  if (
    hasAny(text, ["масло", "oil"]) &&
    hasAny(text, [
      "последняя замена",
      "последний раз",
      "заменил",
      "заменена",
      "была на",
      "last change",
      "last oil change",
      "last replaced",
    ])
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

  return "user_explicit_memory";
}

export default classifyExplicitRememberKey;