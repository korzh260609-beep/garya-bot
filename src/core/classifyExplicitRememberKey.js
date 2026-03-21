// src/core/classifyExplicitRememberKey.js
// STAGE 7.4 V1 — explicit remember key classification
// Rule:
// - deterministic only
// - no AI
// - safe fallback to user_explicit_memory

function norm(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function hasAny(text, variants = []) {
  return variants.some((v) => text.includes(v));
}

export function classifyExplicitRememberKey(value = "") {
  const text = norm(value);

  if (!text) return "user_explicit_memory";

  // --- car base
  if (
    hasAny(text, [
      "freelander 2",
      "фрилендер 2",
      "land rover",
      "лэнд ровер",
      "моя машина",
      "у меня есть машина",
      "мой автомобиль",
      "мое авто",
      "моё авто",
    ])
  ) {
    if (
      hasAny(text, [
        "2.2",
        "td4",
        "турбодизель",
        "дизель",
        "двигатель",
        "engine",
        "motor",
      ])
    ) {
      return "car_engine";
    }

    if (
      hasAny(text, [
        "комплектация",
        "trim",
        "комплектация s",
        "версия s",
      ])
    ) {
      return "car_trim";
    }

    return "car";
  }

  // --- engine even without explicit car mention
  if (
    hasAny(text, [
      "2.2 td4",
      "2.2 турбодизель",
      "дизель 2.2",
      "мой двигатель",
      "двигатель 2.2",
    ])
  ) {
    return "car_engine";
  }

  // --- trim even without explicit car mention
  if (
    hasAny(text, [
      "комплектация s",
      "trim s",
      "версия s",
    ])
  ) {
    return "car_trim";
  }

  // --- maintenance intervals
  if (
    hasAny(text, [
      "меняю масло каждые",
      "замена масла каждые",
      "масло каждые",
      "oil every",
      "oil interval",
    ])
  ) {
    return "maintenance_oil_interval";
  }

  if (
    hasAny(text, [
      "топливного фильтра каждые",
      "топливный фильтр каждые",
      "fuel filter every",
      "fuel filter interval",
    ])
  ) {
    return "maintenance_fuel_filter_interval";
  }

  return "user_explicit_memory";
}

export default classifyExplicitRememberKey;