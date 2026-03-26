// src/bot/handlers/chat/isStablePersonalFactQuestion.js

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function includesAny(text, parts = []) {
  if (!text || !Array.isArray(parts) || parts.length === 0) return false;
  return parts.some((part) => text.includes(part));
}

function startsWithAny(text, parts = []) {
  if (!text || !Array.isArray(parts) || parts.length === 0) return false;
  return parts.some((part) => text.startsWith(part));
}

function hasVehicleWord(text) {
  return includesAny(text, [
    "машин",
    "авто",
    "автомоб",
    "freelander",
    "фрилендер",
    "land rover",
    "лэнд ровер",
    "ровер",
    "haldex",
    "халдекс",
    "грм",
    "ремень",
    "масл",
    "фильтр",
    "фільтр",
    "топливн",
    "паливн",
    "пробег",
    "пробіг",
  ]);
}

function isCommunicationStyleQuestion(text) {
  return (
    includesAny(text, [
      "стиль общения",
      "стиль спілкування",
      "как со мной общаться",
      "як зі мною спілкуватися",
      "как мне отвечать",
      "як мені відповідати",
      "мой стиль общения",
      "мій стиль спілкування",
    ]) ||
    startsWithAny(text, [
      "какой у меня стиль",
      "який у мене стиль",
      "какой мой стиль",
      "який мій стиль",
    ])
  );
}

function isNameQuestion(text) {
  return includesAny(text, [
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

function isVehicleFactQuestion(text) {
  if (!hasVehicleWord(text)) return false;

  return (
    includesAny(text, [
      "какая у меня машина",
      "яка у мене машина",
      "что у меня за машина",
      "яке у мене авто",
      "какой у меня автомобиль",
      "какое у меня авто",
      "какой у меня мотор",
      "який у мене мотор",
      "какой у меня двигатель",
      "який у мене двигун",
      "какая у меня комплектация",
      "яка у мене комплектація",
      "что у меня за двигатель",
      "який у мене двигун",
      "какой у меня freelander",
      "який у мене freelander",
    ]) ||
    startsWithAny(text, [
      "какая у меня машина",
      "какой у меня двигатель",
      "какой у меня мотор",
      "какая у меня комплектация",
      "яка у мене машина",
      "який у мене двигун",
      "який у мене мотор",
      "яка у мене комплектація",
    ])
  );
}

function isMaintenanceFactQuestion(text) {
  const maintenanceWords = [
    "масло",
    "халдекс",
    "haldex",
    "грм",
    "ремень грм",
    "топливный фильтр",
    "паливний фільтр",
    "фильтр",
    "фільтр",
  ];

  const factualIntentWords = [
    "когда следующая замена",
    "коли наступна заміна",
    "когда менять",
    "коли міняти",
    "какой интервал",
    "який інтервал",
    "через сколько менять",
    "через скільки міняти",
    "когда я менял",
    "коли я міняв",
    "когда была замена",
    "коли була заміна",
    "какой у меня пробег замены",
    "який у мене пробіг заміни",
    "последняя замена",
    "остання заміна",
    "следующая замена",
    "наступна заміна",
    "мой интервал",
    "мій інтервал",
  ];

  return includesAny(text, maintenanceWords) && includesAny(text, factualIntentWords);
}

function isStablePersonalFactQuestion(text) {
  const t = normalizeText(text);
  if (!t) return false;

  if (isCommunicationStyleQuestion(t)) return true;
  if (isNameQuestion(t)) return true;
  if (isVehicleFactQuestion(t)) return true;
  if (isMaintenanceFactQuestion(t)) return true;

  return false;
}

export {
  isCommunicationStyleQuestion,
  isNameQuestion,
  isVehicleFactQuestion,
  isMaintenanceFactQuestion,
  isStablePersonalFactQuestion,
};

export default isStablePersonalFactQuestion;
