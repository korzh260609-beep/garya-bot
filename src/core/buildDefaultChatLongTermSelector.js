// src/core/buildDefaultChatLongTermSelector.js

import buildLongTermPromptSelector from "./buildLongTermPromptSelector.js";

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function includesAny(text, parts = []) {
  if (!text || !Array.isArray(parts) || parts.length === 0) return false;
  return parts.some((part) => text.includes(part));
}

function isCommunicationStyleQuestion(text) {
  const t = normalizeText(text);
  if (!t) return false;

  return (
    includesAny(t, [
      "стиль общения",
      "стиль спілкування",
      "как со мной общаться",
      "як зі мною спілкуватися",
      "как со мною общаться",
      "как мне отвечать",
      "як мені відповідати",
      "мой стиль общения",
      "мій стиль спілкування",
    ]) ||
    t.startsWith("какой у меня стиль") ||
    t.startsWith("який у мене стиль") ||
    t.startsWith("какой мой стиль") ||
    t.startsWith("який мій стиль")
  );
}

function isNameQuestion(text) {
  const t = normalizeText(text);
  if (!t) return false;

  return includesAny(t, [
    "как меня зовут",
    "як мене звати",
    "кто я",
    "хто я",
    "мое имя",
    "моє ім'я",
    "моё имя",
    "мой ник",
    "мій нік",
  ]);
}

function isVehicleQuestion(text) {
  const t = normalizeText(text);
  if (!t) return false;

  return includesAny(t, [
    "моя машина",
    "мой автомобиль",
    "моё авто",
    "мое авто",
    "моя машина",
    "freelander",
    "фрилендер",
    "автомобиль",
    "авто",
    "машина",
    "haldex",
    "халдекс",
    "грм",
    "топливный фильтр",
    "паливний фільтр",
    "обслуживание машины",
    "обслуговування машини",
  ]);
}

function isMaintenanceQuestion(text) {
  const t = normalizeText(text);
  if (!t) return false;

  return includesAny(t, [
    "когда менять",
    "коли міняти",
    "когда следующая замена",
    "коли наступна заміна",
    "следующая замена",
    "наступна заміна",
    "интервал",
    "інтервал",
    "обслуживание",
    "обслуговування",
    "пробег",
    "пробіг",
    "масло",
    "фильтр",
    "фільтр",
    "haldex",
    "халдекс",
    "грм",
  ]);
}

function isTaskIntentQuestion(text) {
  const t = normalizeText(text);
  if (!t) return false;

  return includesAny(t, [
    "что я хочу",
    "чого я хочу",
    "какая у меня задача",
    "яка у мене задача",
    "мой проект",
    "мій проєкт",
    "моя цель",
    "моя ціль",
    "что мы делаем",
    "що ми робимо",
  ]);
}

export function buildDefaultChatLongTermSelector(input = {}) {
  const effective =
    typeof input === "string"
      ? input
      : typeof input?.effective === "string"
        ? input.effective
        : typeof input?.text === "string"
          ? input.text
          : "";

  if (isCommunicationStyleQuestion(effective)) {
    return buildLongTermPromptSelector({
      rememberKeys: ["communication_style"],
      rememberTypes: ["user_preference"],
      perKeyLimit: 1,
      perTypeLimit: 1,
      totalLimit: 2,
    });
  }

  if (isNameQuestion(effective)) {
    return buildLongTermPromptSelector({
      rememberKeys: ["name"],
      rememberTypes: ["identity_profile", "user_profile"],
      perKeyLimit: 1,
      perTypeLimit: 1,
      totalLimit: 2,
    });
  }

  if (isVehicleQuestion(effective) || isMaintenanceQuestion(effective)) {
    return buildLongTermPromptSelector({
      rememberKeys: [],
      rememberTypes: [
        "vehicle_profile",
        "maintenance_fact",
        "maintenance_interval",
      ],
      perKeyLimit: 1,
      perTypeLimit: 2,
      totalLimit: 4,
    });
  }

  if (isTaskIntentQuestion(effective)) {
    return buildLongTermPromptSelector({
      rememberKeys: [],
      rememberTypes: ["task_intent", "user_profile"],
      perKeyLimit: 1,
      perTypeLimit: 2,
      totalLimit: 4,
    });
  }

  return buildLongTermPromptSelector({
    rememberTypes: [
      "user_profile",
      "vehicle_profile",
      "maintenance_fact",
      "maintenance_interval",
      "task_intent",
    ],
    rememberKeys: ["communication_style"],
    perTypeLimit: 3,
    perKeyLimit: 3,
    totalLimit: 12,
  });
}

export default buildDefaultChatLongTermSelector;