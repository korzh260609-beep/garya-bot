// core/projectContext.js
// Хелпер для загрузки проектного контекста (ROADMAP + WORKFLOW)
// из projectMemory (ЭТАП 3A).

import { getProjectSection } from "../projectMemory.js";

// === PROJECT MEMORY HELPERS (3A) ===
export async function loadProjectContext() {
  try {
    const roadmap = await getProjectSection(undefined, "roadmap");
    const workflow = await getProjectSection(undefined, "workflow");

    const parts = [];

    if (roadmap?.content) {
      parts.push(`ROADMAP:\n${roadmap.content}`);
    }

    if (workflow?.content) {
      parts.push(`WORKFLOW:\n${workflow.content}`);
    }

    if (parts.length === 0) {
      return "";
    }

    const fullText = parts.join("\n\n");
    // ограничиваем длину, чтобы не раздуть системный промпт
    return fullText.slice(0, 4000);
  } catch (err) {
    console.error("❌ loadProjectContext error:", err);
    return "";
  }
}

