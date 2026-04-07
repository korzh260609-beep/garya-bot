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

function isAddressingQuestion(text) {
  const t = normalizeText(text);
  if (!t) return false;

  return (
    includesAny(t, [
      "как меня называть",
      "как ко мне обращаться",
      "как меня лучше называть",
      "как ты должен меня называть",
      "как до мене звертатися",
      "як мене називати",
      "як ти маєш мене називати",
      "call me",
      "address me as",
      "what should you call me",
    ]) ||
    t.startsWith("как меня называть") ||
    t.startsWith("як мене називати") ||
    t.startsWith("как ко мне обращаться") ||
    t.startsWith("як до мене звертатися")
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
    "mоя машина",
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
      rememberKeys: ["communication_style", "preferred_address"],
      rememberTypes: ["user_preference"],
      rememberDomains: ["user_preference"],
      rememberSlots: ["communication_style", "preferred_address"],
      domainSlots: [
        {
          rememberDomain: "user_preference",
          rememberSlot: "communication_style",
        },
        {
          rememberDomain: "user_preference",
          rememberSlot: "preferred_address",
        },
      ],
      perKeyLimit: 1,
      perTypeLimit: 1,
      perDomainLimit: 1,
      perSlotLimit: 1,
      perDomainSlotLimit: 1,
      totalLimit: 2,
    });
  }

  if (isAddressingQuestion(effective)) {
    return buildLongTermPromptSelector({
      rememberKeys: ["preferred_address", "name"],
      rememberTypes: ["user_preference", "identity_profile", "user_profile"],
      rememberDomains: ["user_preference", "identity"],
      rememberSlots: ["preferred_address", "name"],
      domainSlots: [
        {
          rememberDomain: "user_preference",
          rememberSlot: "preferred_address",
        },
        {
          rememberDomain: "identity",
          rememberSlot: "name",
        },
      ],
      perKeyLimit: 1,
      perTypeLimit: 1,
      perDomainLimit: 1,
      perSlotLimit: 1,
      perDomainSlotLimit: 1,
      totalLimit: 2,
    });
  }

  if (isNameQuestion(effective)) {
    return buildLongTermPromptSelector({
      rememberKeys: ["name", "preferred_address"],
      rememberTypes: ["identity_profile", "user_profile", "user_preference"],
      rememberDomains: ["identity", "user_preference"],
      rememberSlots: ["name", "preferred_address"],
      domainSlots: [
        {
          rememberDomain: "identity",
          rememberSlot: "name",
        },
        {
          rememberDomain: "user_preference",
          rememberSlot: "preferred_address",
        },
      ],
      perKeyLimit: 1,
      perTypeLimit: 1,
      perDomainLimit: 1,
      perSlotLimit: 1,
      perDomainSlotLimit: 1,
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
      rememberDomains: [
        "vehicle_profile",
        "vehicle_maintenance",
      ],
      rememberSlots: [
        "vehicle",
        "engine",
        "trim",
        "service_fact",
        "oil_last_change",
        "oil_interval",
        "fuel_filter_last_change",
        "fuel_filter_interval",
        "haldex_last_change",
        "haldex_interval",
      ],
      domainSlots: [
        { rememberDomain: "vehicle_profile", rememberSlot: "vehicle" },
        { rememberDomain: "vehicle_profile", rememberSlot: "engine" },
        { rememberDomain: "vehicle_profile", rememberSlot: "trim" },
        { rememberDomain: "vehicle_maintenance", rememberSlot: "service_fact" },
        { rememberDomain: "vehicle_maintenance", rememberSlot: "oil_last_change" },
        { rememberDomain: "vehicle_maintenance", rememberSlot: "oil_interval" },
        {
          rememberDomain: "vehicle_maintenance",
          rememberSlot: "fuel_filter_last_change",
        },
        {
          rememberDomain: "vehicle_maintenance",
          rememberSlot: "fuel_filter_interval",
        },
        {
          rememberDomain: "vehicle_maintenance",
          rememberSlot: "haldex_last_change",
        },
        {
          rememberDomain: "vehicle_maintenance",
          rememberSlot: "haldex_interval",
        },
      ],
      perKeyLimit: 1,
      perTypeLimit: 2,
      perDomainLimit: 2,
      perSlotLimit: 1,
      perDomainSlotLimit: 1,
      totalLimit: 6,
    });
  }

  if (isTaskIntentQuestion(effective)) {
    return buildLongTermPromptSelector({
      rememberKeys: [],
      rememberTypes: ["task_intent", "user_profile"],
      rememberDomains: ["task"],
      rememberSlots: ["schedule"],
      domainSlots: [
        {
          rememberDomain: "task",
          rememberSlot: "schedule",
        },
      ],
      perKeyLimit: 1,
      perTypeLimit: 2,
      perDomainLimit: 2,
      perSlotLimit: 1,
      perDomainSlotLimit: 1,
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
      "user_preference",
    ],
    rememberKeys: ["communication_style", "preferred_address"],
    rememberDomains: [
      "identity",
      "user_preference",
      "vehicle_profile",
      "vehicle_maintenance",
      "task",
    ],
    rememberSlots: [
      "name",
      "communication_style",
      "preferred_address",
      "vehicle",
      "engine",
      "trim",
      "service_fact",
      "oil_last_change",
      "oil_interval",
      "fuel_filter_last_change",
      "fuel_filter_interval",
      "haldex_last_change",
      "haldex_interval",
      "schedule",
    ],
    domainSlots: [
      { rememberDomain: "identity", rememberSlot: "name" },
      {
        rememberDomain: "user_preference",
        rememberSlot: "communication_style",
      },
      {
        rememberDomain: "user_preference",
        rememberSlot: "preferred_address",
      },
      { rememberDomain: "vehicle_profile", rememberSlot: "vehicle" },
      { rememberDomain: "vehicle_profile", rememberSlot: "engine" },
      { rememberDomain: "vehicle_profile", rememberSlot: "trim" },
      { rememberDomain: "vehicle_maintenance", rememberSlot: "service_fact" },
      { rememberDomain: "vehicle_maintenance", rememberSlot: "oil_last_change" },
      { rememberDomain: "vehicle_maintenance", rememberSlot: "oil_interval" },
      {
        rememberDomain: "vehicle_maintenance",
        rememberSlot: "fuel_filter_last_change",
      },
      {
        rememberDomain: "vehicle_maintenance",
        rememberSlot: "fuel_filter_interval",
      },
      {
        rememberDomain: "vehicle_maintenance",
        rememberSlot: "haldex_last_change",
      },
      {
        rememberDomain: "vehicle_maintenance",
        rememberSlot: "haldex_interval",
      },
      { rememberDomain: "task", rememberSlot: "schedule" },
    ],
    perTypeLimit: 3,
    perKeyLimit: 2,
    perDomainLimit: 2,
    perSlotLimit: 1,
    perDomainSlotLimit: 1,
    totalLimit: 12,
  });
}

export default buildDefaultChatLongTermSelector;
