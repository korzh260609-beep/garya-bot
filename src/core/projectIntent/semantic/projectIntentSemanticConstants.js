// src/core/projectIntent/semantic/projectIntentSemanticConstants.js

export const KNOWN_CANONICAL_TARGETS = Object.freeze([
  { entity: "workflow", path: "pillars/WORKFLOW.md" },
  { entity: "decisions", path: "pillars/DECISIONS.md" },
  { entity: "decision", path: "pillars/DECISIONS.md" },
  { entity: "roadmap", path: "pillars/ROADMAP.md" },
  { entity: "project", path: "pillars/PROJECT.md" },
  { entity: "kingdom", path: "pillars/KINGDOM.md" },
  { entity: "sg_behavior", path: "pillars/SG_BEHAVIOR.md" },
  { entity: "sg_entity", path: "pillars/SG_ENTITY.md" },
  { entity: "repoindex", path: "pillars/REPOINDEX.md" },
  { entity: "code_insert_rules", path: "pillars/CODE_INSERT_RULES.md" },
  { entity: "readme", path: "README.md" },
  { entity: "project_description", path: "README.md" },
]);

export const SEARCH_PREFIXES = Object.freeze([
  "найд",
  "ищ",
  "поиск",
  "find",
  "search",
  "locat",
  "where",
]);

export const OPEN_PREFIXES = Object.freeze([
  "отк",
  "покаж",
  "прочит",
  "show",
  "open",
  "read",
  "display",
  "просмотр",
]);

export const EXPLAIN_PREFIXES = Object.freeze([
  "объяс",
  "смысл",
  "разбор",
  "проанализ",
  "анализ",
  "explain",
  "analy",
  "review",
  "inspect",
  "описан",
  "зачем",
]);

export const TRANSLATE_PREFIXES = Object.freeze([
  "перев",
  "русск",
  "англ",
  "translate",
]);

export const SUMMARY_PREFIXES = Object.freeze([
  "общ",
  "кратк",
  "коротк",
  "прост",
  "summary",
  "brief",
  "short",
  "simple",
]);

export const TREE_PREFIXES = Object.freeze([
  "дерев",
  "структур",
  "ветк",
  "tree",
  "root",
  "корен",
]);

export const STATUS_PREFIXES = Object.freeze([
  "доступ",
  "стат",
  "состоя",
  "status",
  "access",
  "connected",
]);

export const CONTINUE_PREFIXES = Object.freeze([
  "дальш",
  "продол",
  "continue",
  "next",
  "ещ",
]);

export const FIRST_PART_PREFIXES = Object.freeze([
  "перв",
  "част",
  "начал",
  "first",
  "part",
  "begin",
]);

export const PRONOUN_FOLLOWUP_PREFIXES = Object.freeze([
  "он",
  "она",
  "оно",
  "это",
  "его",
  "её",
  "ее",
  "them",
  "it",
  "this",
  "that",
  "там",
  "тут",
  "этот",
  "эта",
  "это",
]);

export const FOLDER_PREFIXES = Object.freeze([
  "папк",
  "директор",
  "каталог",
  "folder",
  "director",
  "dir",
]);

export const FILE_PREFIXES = Object.freeze([
  "файл",
  "документ",
  "file",
  "doc",
]);

export const LISTING_PREFIXES = Object.freeze([
  "спис",
  "содерж",
  "внутр",
  "внутри",
  "что",
  "какие",
  "list",
  "content",
  "inside",
  "покаж",
]);

export const GENERIC_TARGET_WORDS = new Set([
  "файл",
  "файла",
  "файле",
  "файлы",
  "документ",
  "документа",
  "документе",
  "папка",
  "папку",
  "папке",
  "папки",
  "раздел",
  "раздела",
  "разделе",
  "репозиторий",
  "репозитории",
  "репо",
  "project",
  "repo",
  "file",
  "files",
  "folder",
  "directory",
  "document",
  "section",
  "contents",
  "content",
]);