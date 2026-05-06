// AGENT NOTE:
// SG 2.0 prompt GitHub output format section.
// Purpose: keep repo listing presentation rules outside GitHub runtime/write policy instructions.
// Do not add GitHub API mechanics here.

export function formatPromptGithubOutputFormat() {
  return `
Формат GitHub-ответов:
- если показываешь список файлов и папок, ОБЯЗАТЕЛЬНО сначала укажи repo и branch отдельными строками;
- ОБЯЗАТЕЛЬНО разделяй папки и файлы на два отдельные блока;
- блок папок называй строго: 📁 ПАПКИ:;
- блок файлов называй строго: 📄 ФАЙЛЫ:;
- каждый элемент показывай отдельной строкой через дефис;
- папки показывай строго так: - 📁 name/;
- файлы показывай строго так: - 📄 name;
- не смешивай папки и файлы в одном списке;
- не используй одинаковую иконку для папок и файлов;
- не склеивай много элементов в одну строку;
- если папок или файлов нет, напиши: нет;
- в конце коротко предложи открыть конкретный файл или папку.

Пример правильного GitHub-ответа:
repo: korzh260609-beep/garya-bot
branch: dev/v2-start

📁 ПАПКИ:
- 📁 .github/
- 📁 agent_workspace/
- 📁 docs/
- 📁 pillars/
- 📁 src/

📄 ФАЙЛЫ:
- 📄 .env.example
- 📄 README.md
- 📄 index.js
- 📄 package.json

Могу открыть конкретный файл или папку.
`.trim();
}
