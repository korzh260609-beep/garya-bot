// sources.js
// Скелет реестра источников данных (Sources Layer)
// ESM-вариант: используем export, а не module.exports

// Пока просто хранение в памяти. Потом заменим на таблицу в БД.
const registry = [];

/**
 * Вернуть список активных источников.
 * Сейчас вернёт пустой массив, но уже БЕЗ ошибок в логах.
 */
export async function listActiveSources() {
  // фильтр на будущее: только включённые источники
  return registry.filter((s) => s.enabled !== false);
}

/**
 * Вспомогательная функция — регистрация источника (на будущее).
 * Сейчас она нам не обязательна, но пусть будет.
 */
export async function addSource({ name, type, config = {} }) {
  const id = registry.length + 1;

  const src = {
    id,
    name,
    type,
    config,
    enabled: true,
    created_at: new Date(),
  };

  registry.push(src);
  return src;
}
