// src/core/explicitRememberKey.js
// STAGE 7.4 V1.5 — explicit remember key classification (broader buckets)
//
// Goal:
// - keep deterministic no-AI classification
// - support wider range of topics, not only car facts
// - preserve current known specific keys where they are already useful
// - unknown => fallback user_explicit_memory
//
// IMPORTANT:
// - keep logic predictable
// - do not rewrite user value
// - only derive rememberKey
// - this is still NOT full semantic memory V2
// - this is a safer intermediate step: broader categories + existing precise keys

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
  // TASK / SCHEDULE / REMINDER
  // ==========================================================
  if (
    (hasAny(text, [
      "каждый день",
      "каждое утро",
      "каждый вечер",
      "ежедневно",
      "каждую неделю",
      "каждый понедельник",
      "каждый вторник",
      "каждую среду",
      "каждый четверг",
      "каждую пятницу",
      "каждую субботу",
      "каждое воскресенье",
      "every day",
      "daily",
      "weekly",
      "every week",
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
        "напомни",
        "задача",
        "task",
      ])) ||
    (hasAny(text, [
      "в 6 утра",
      "в 7 утра",
      "в 8 утра",
      "в 9 утра",
      "в 10 утра",
      "в 11 утра",
      "утром",
      "вечером",
      "ночью",
      "at 6",
      "at 7",
      "at 8",
      "at 9",
      "at 10",
      "at 11",
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
        "задача",
        "task",
      ])) ||
    (hasAny(text, ["расписание", "schedule"]) &&
      hasAny(text, [
        "доклад",
        "отчёт",
        "отчет",
        "report",
        "напоминание",
        "напоминать",
        "задача",
        "task",
      ]))
  ) {
    return "task_schedule";
  }

  // ==========================================================
  // PREFERENCE / LIKES / DISLIKES
  // ==========================================================
  if (
    hasAny(text, [
      "мне нравится",
      "мне не нравится",
      "люблю",
      "не люблю",
      "предпочитаю",
      "мой любимый",
      "моё любимое",
      "моя любимая",
      "i like",
      "i don't like",
      "i prefer",
      "my favorite",
    ])
  ) {
    return "preference";
  }

  // ==========================================================
  // PROJECT / WORK / SG / DEVELOPMENT
  // ==========================================================
  if (
    hasAny(text, [
      "сг",
      "sg",
      "советник",
      "advisor",
      "проект",
      "project",
      "репозитор",
      "github",
      "render",
      "workflow",
      "roadmap",
      "decisions",
      "memory",
      "бот",
      "telegram bot",
      "агент",
      "agent",
      "stage ",
      "этап ",
      "модуль",
      "module",
      "архитектур",
      "architecture",
    ])
  ) {
    if (
      hasAny(text, [
        "правило",
        "rule",
        "запрещено",
        "нельзя",
        "обязательно",
        "must",
        "always",
      ])
    ) {
      return "project_rule";
    }

    if (
      hasAny(text, [
        "идея",
        "idea",
        "план",
        "plan",
        "хочу сделать",
        "нужно сделать",
        "надо сделать",
      ])
    ) {
      return "project_plan";
    }

    return "project_fact";
  }

  // ==========================================================
  // PERSON / PROFILE FACT
  // ==========================================================
  if (
    hasAny(text, [
      "меня зовут",
      "моё имя",
      "мое имя",
      "я живу",
      "мой город",
      "моя страна",
      "мне ",
      "мой возраст",
      "я работаю",
      "я учусь",
      "my name",
      "i live",
      "my city",
      "my country",
      "my age",
      "i work",
      "i study",
    ])
  ) {
    return "profile_fact";
  }

  // ==========================================================
  // CONTACT / RELATION FACT
  // ==========================================================
  if (
    hasAny(text, [
      "мой друг",
      "моя подруга",
      "мой брат",
      "моя сестра",
      "мой отец",
      "моя мама",
      "мой знакомый",
      "мой коллега",
      "контакт",
      "contact",
      "друг зовут",
      "brother",
      "sister",
      "friend",
      "colleague",
      "mother",
      "father",
    ])
  ) {
    return "contact_fact";
  }

  // ==========================================================
  // FINANCE / MONEY FACT
  // ==========================================================
  if (
    hasAny(text, [
      "деньги",
      "бюджет",
      "доход",
      "расход",
      "зарплата",
      "кошелек",
      "кошелёк",
      "usdt",
      "грн",
      "uah",
      "usd",
      "eur",
      "bitcoin",
      "btc",
      "eth",
      "финансы",
      "finance",
      "budget",
      "income",
      "expense",
      "salary",
      "wallet",
    ])
  ) {
    return "finance_fact";
  }

  // ==========================================================
  // HEALTH / BODY FACT
  // ==========================================================
  if (
    hasAny(text, [
      "здоровье",
      "health",
      "болит",
      "боль",
      "аллерг",
      "давление",
      "температура",
      "лекарство",
      "таблетки",
      "сон",
      "сплю",
      "вес",
      "рост",
    ])
  ) {
    return "health_fact";
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
      "car",
      "vehicle",
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

    if (
      hasAny(text, [
        "поломка",
        "неисправ",
        "ошибка",
        "ремонт",
        "repair",
        "fault",
        "issue",
        "problem",
      ])
    ) {
      return "car_issue";
    }

    return "car";
  }

  // ==========================================================
  // CAR SERVICE — OIL LAST CHANGE
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
  // CAR SERVICE — OIL INTERVAL
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
  // CAR SERVICE — FUEL FILTER LAST CHANGE
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
  // CAR SERVICE — FUEL FILTER INTERVAL
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
  // CAR SERVICE — HALDEX
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

  // ==========================================================
  // DEVICE / TECH FACT
  // ==========================================================
  if (
    hasAny(text, [
      "ноутбук",
      "телефон",
      "смартфон",
      "android",
      "iphone",
      "компьютер",
      "пк",
      "pc",
      "laptop",
      "device",
    ])
  ) {
    return "device_fact";
  }

  // ==========================================================
  // GENERAL FACT / IDEA / MISC
  // ==========================================================
  if (
    hasAny(text, [
      "важно",
      "запомни это",
      "remember this",
      "мой факт",
      "это факт",
      "идея",
      "мысль",
      "заметка",
      "note",
      "fact",
    ])
  ) {
    return "general_fact";
  }

  return "user_explicit_memory";
}

export default classifyExplicitRememberKey;