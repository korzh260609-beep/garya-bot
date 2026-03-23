// src/core/memoryRulesCatalog.js
// MEMORY CLASSIFIER V2 — RULES CATALOG SKELETON
//
// Goal:
// - keep semantic intent definitions OUTSIDE hardcoded branching logic
// - catalog can later move to DB / JSON / admin-config
// - deterministic only at this stage
// - no side effects

function freezeRule(rule = {}) {
  return Object.freeze({
    id: String(rule.id || "").trim(),
    targetKey: String(rule.targetKey || "").trim(),
    targetType: String(rule.targetType || "").trim(),
    description: String(rule.description || "").trim(),
    examples: Array.isArray(rule.examples)
      ? rule.examples.map((x) => String(x || "").trim()).filter(Boolean)
      : [],
    canonicalValue:
      typeof rule.canonicalValue === "string" && rule.canonicalValue.trim()
        ? rule.canonicalValue.trim()
        : null,
    tags: Array.isArray(rule.tags)
      ? rule.tags.map((x) => String(x || "").trim()).filter(Boolean)
      : [],
  });
}

const MEMORY_RULES_CATALOG = Object.freeze([
  freezeRule({
    id: "user_profile.name",
    targetKey: "name",
    targetType: "user_profile",
    description: "Имя пользователя / self identity",
    examples: [
      "меня зовут Gary",
      "моё имя Гарик",
      "my name is Gary",
    ],
    tags: ["identity", "profile", "name"],
  }),

  freezeRule({
    id: "user_profile.communication_style",
    targetKey: "communication_style",
    targetType: "user_profile",
    description: "Предпочтительный стиль общения и ответа",
    examples: [
      "отвечай коротко и по делу",
      "не уходи в официоз",
      "улавливай мою интонацию",
      "подстраивайся под мой тон общения",
      "говори как со мной обычно",
    ],
    canonicalValue:
      "Отвечай коротко, прямо, по делу и естественно. Улавливай мою интонацию и подстраивайся под мой тон общения. Не уходи в официоз.",
    tags: ["style", "tone", "communication", "preference"],
  }),

  freezeRule({
    id: "task_intent.schedule",
    targetKey: "task_schedule",
    targetType: "task_intent",
    description: "Расписание регулярной задачи / отчёта / напоминания",
    examples: [
      "каждый день в 9 утра присылай отчёт",
      "daily report every morning",
    ],
    tags: ["task", "schedule", "report"],
  }),

  freezeRule({
    id: "vehicle_profile.car",
    targetKey: "car",
    targetType: "vehicle_profile",
    description: "Факт о машине пользователя",
    examples: [
      "у меня Land Rover Freelander 2",
      "моя машина Freelander 2",
    ],
    tags: ["vehicle", "car"],
  }),

  freezeRule({
    id: "vehicle_profile.car_engine",
    targetKey: "car_engine",
    targetType: "vehicle_profile",
    description: "Двигатель / мотор / тип топлива машины",
    examples: [
      "двигатель 2.2 TD4",
      "2.2 турбодизель",
    ],
    tags: ["vehicle", "engine", "diesel"],
  }),

  freezeRule({
    id: "vehicle_profile.car_trim",
    targetKey: "car_trim",
    targetType: "vehicle_profile",
    description: "Комплектация / trim / версия машины",
    examples: [
      "комплектация S",
      "trim HSE",
    ],
    tags: ["vehicle", "trim"],
  }),

  freezeRule({
    id: "maintenance_interval.oil",
    targetKey: "maintenance_oil_interval",
    targetType: "maintenance_interval",
    description: "Интервал замены масла",
    examples: [
      "меняю масло каждые 5 тысяч км",
      "oil interval every 5000 km",
    ],
    tags: ["maintenance", "oil", "interval"],
  }),

  freezeRule({
    id: "maintenance_fact.oil_last_change",
    targetKey: "maintenance_oil_last_change",
    targetType: "maintenance_fact",
    description: "Последняя замена масла",
    examples: [
      "последняя замена масла была на 239 тыс км",
    ],
    tags: ["maintenance", "oil", "last_change"],
  }),
]);

export function getMemoryRulesCatalog() {
  return MEMORY_RULES_CATALOG;
}

export function getMemoryRuleById(ruleId) {
  const id = String(ruleId || "").trim();
  if (!id) return null;
  return MEMORY_RULES_CATALOG.find((rule) => rule.id === id) || null;
}

export default getMemoryRulesCatalog;