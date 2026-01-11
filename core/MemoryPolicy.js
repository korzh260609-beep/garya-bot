// ============================================================================
// === core/MemoryPolicy.js — POLICY ONLY (NO DB, NO SIDE EFFECTS)
// ============================================================================
// Определяет, ЧТО МОЖЕТ быть кандидатом в память.
// НЕ пишет в память. НЕ принимает решений. Только флаги.
// Истина: SG = decision-support, память хранит РЕЗУЛЬТАТЫ, не разговоры.
// ============================================================================

const ALLOWED_PILLARS_PREFIX = "pillars/";

const ALLOWED_PILLARS_FILES = new Set([
  "pillars/DECISIONS.md",
  "pillars/KINGDOM.md",
  "pillars/PROJECT.md",
  "pillars/ROADMAP.md",
  "pillars/SG_BEHAVIOR.md",
  "pillars/WORKFLOW.md",
]);

export const MemoryPolicy = {
  /**
   * Backward-compatible alias (НЕ ИСПОЛЬЗОВАТЬ НОВОЙ ЛОГИКОЙ)
   */
  canPersist(entry) {
    return this.isAllowed(entry);
  },

  /**
   * Единственная актуальная точка проверки
   * Возвращает TRUE, если файл МОЖЕТ быть кандидатом в память
   */
  isAllowed(entry) {
    if (!entry) return false;

    const { path, content } = entry;

    if (!path || typeof path !== "string") return false;
    if (!content || typeof content !== "string") return false;

    // 1) Pillars — всегда кандидаты (НО НЕ АВТОЗАПИСЬ)
    if (path.startsWith(ALLOWED_PILLARS_PREFIX)) {
      return ALLOWED_PILLARS_FILES.has(path);
    }

    // 2) Любой код — НИКОГДА
    if (
      path.startsWith("src/") ||
      path.endsWith(".js") ||
      path.endsWith(".ts") ||
      path.endsWith(".json")
    ) {
      return false;
    }

    // 3) Конфиги, env, секреты — НИКОГДА
    if (
      path.includes(".env") ||
      path.toLowerCase().includes("secret") ||
      path.toLowerCase().includes("token") ||
      path.toLowerCase().includes("key")
    ) {
      return false;
    }

    // 4) Документы вне pillars — ПОКА НЕТ
    // (расширяется позже осознанно)
    return false;
  },
};
