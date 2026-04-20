// src/core/projectIntent/readPlan/projectIntentReadPlanConstants.js

export const PILLARS_ROOT_PHRASES = Object.freeze([
  "pillars",
  "pillars/",
  "pillar",
  "пилларс",
  "пиллары",
]);

export const PILLARS_ROOT_TOKENS = Object.freeze([
  "pillars",
  "pillar",
  "пилларс",
  "пиллары",
]);

export const PILLAR_FILE_RULES = Object.freeze([
  {
    path: "pillars/WORKFLOW.md",
    phrases: ["workflow.md", "документ workflow", "файл workflow", "workflow document"],
    basis: "pillar_workflow",
    entity: "workflow",
  },
  {
    path: "pillars/DECISIONS.md",
    phrases: ["decisions.md", "decision log", "журнал решений", "документ decisions"],
    basis: "pillar_decisions",
    entity: "decisions",
  },
  {
    path: "pillars/ROADMAP.md",
    phrases: ["roadmap.md", "документ roadmap", "дорожная карта"],
    basis: "pillar_roadmap",
    entity: "roadmap",
  },
  {
    path: "pillars/PROJECT.md",
    phrases: ["project.md", "описание проекта"],
    basis: "pillar_project",
    entity: "project",
  },
  {
    path: "pillars/KINGDOM.md",
    phrases: ["kingdom.md", "документ kingdom"],
    basis: "pillar_kingdom",
    entity: "kingdom",
  },
  {
    path: "pillars/SG_BEHAVIOR.md",
    phrases: ["sg_behavior.md", "поведение sg"],
    basis: "pillar_behavior",
    entity: "sg_behavior",
  },
  {
    path: "pillars/SG_ENTITY.md",
    phrases: ["sg_entity.md", "сущность sg"],
    basis: "pillar_entity",
    entity: "sg_entity",
  },
  {
    path: "pillars/REPOINDEX.md",
    phrases: ["repoindex.md", "repoindex"],
    basis: "pillar_repoindex",
    entity: "repoindex",
  },
  {
    path: "pillars/CODE_INSERT_RULES.md",
    phrases: ["code_insert_rules.md", "code insert rules", "правила вставки кода"],
    basis: "pillar_code_insert_rules",
    entity: "code_insert_rules",
  },
]);

export const ENTITY_RULES = Object.freeze([
  {
    entity: "workflow",
    targetKind: "canonical_doc",
    phrases: ["workflow", "воркфлоу", "workflow.md"],
    path: "pillars/WORKFLOW.md",
  },
  {
    entity: "decisions",
    targetKind: "canonical_doc",
    phrases: ["decisions", "decisions.md", "decision log", "журнал решений"],
    path: "pillars/DECISIONS.md",
  },
  {
    entity: "roadmap",
    targetKind: "canonical_doc",
    phrases: ["roadmap", "roadmap.md", "дорожная карта"],
    path: "pillars/ROADMAP.md",
  },
  {
    entity: "project",
    targetKind: "canonical_doc",
    phrases: ["project.md", "описание проекта"],
    path: "pillars/PROJECT.md",
  },
  {
    entity: "kingdom",
    targetKind: "canonical_doc",
    phrases: ["kingdom.md", "kingdom"],
    path: "pillars/KINGDOM.md",
  },
  {
    entity: "repoindex",
    targetKind: "canonical_doc",
    phrases: ["repoindex", "repoindex.md"],
    path: "pillars/REPOINDEX.md",
  },
  {
    entity: "pillars",
    targetKind: "repo_scope",
    phrases: ["pillars", "pillars/", "пилларс", "пиллары"],
    path: "pillars/",
  },
  {
    entity: "stage",
    targetKind: "stage",
    phrases: ["stage", "стадия", "этап"],
    path: "",
  },
]);

export const REPO_ACCESS_META_PHRASES = Object.freeze([
  "do you have access to the repo",
  "do you have access to repository",
  "do you have access to github",
  "can you read the repo",
  "can you see the repo",
  "can you access github",
  "repo access",
  "repository access",
  "github access",

  "у тебя есть доступ к репозиторию",
  "у тебя есть доступ к github",
  "ты видишь репозиторий",
  "ты можешь читать репозиторий",
  "есть доступ к репозиторию",
  "доступ к репозиторию",
  "доступ к github",
  "подключение к github",
  "подключение к репозиторию",
]);

export const REPO_ACCESS_META_TOKENS = Object.freeze([
  "access",
  "connected",
  "connection",
  "видишь",
  "доступ",
  "подключение",
  "подключен",
  "читать",
  "read",
  "see",
]);

export const REPO_ACCESS_META_PREFIXES = Object.freeze([
  "доступ",
  "подключ",
  "вид",
  "чит",
  "access",
  "connect",
  "read",
  "see",
]);

export const REPO_TARGET_PREFIXES = Object.freeze([
  "репозитор",
  "репо",
  "github",
  "гитхаб",
  "repo",
  "repositor",
]);

export const STATUS_PHRASES = Object.freeze([
  "repo status",
  "repository status",
  "статус репозитория",
  "состояние репозитория",
  "статус проекта",
  "состояние проекта",
]);

export const TREE_PHRASES = Object.freeze([
  "repo tree",
  "структура репозитория",
  "структура проекта",
  "дерево репозитория",
]);

export const DIFF_PHRASES = Object.freeze([
  "repo diff",
  "show diff",
  "покажи diff",
  "покажи изменения",
  "что изменилось",
]);

export const SEARCH_PREFIXES = Object.freeze([
  "найд",
  "ищ",
  "поиск",
  "find",
  "search",
  "where",
  "locat",
]);

export const READ_PREFIXES = Object.freeze([
  "отк",
  "покаж",
  "прочит",
  "show",
  "open",
  "read",
  "display",
]);

export const EXPLAIN_PREFIXES = Object.freeze([
  "объяс",
  "опис",
  "анализ",
  "проанализ",
  "разбор",
  "review",
  "inspect",
  "analy",
  "explain",
]);

export const TRANSLATE_PREFIXES = Object.freeze([
  "перев",
  "русск",
  "англ",
  "translate",
]);

export const SUMMARY_PREFIXES = Object.freeze([
  "кратк",
  "коротк",
  "прощ",
  "summary",
  "brief",
  "short",
  "simple",
]);

export const CHECK_PREFIXES = Object.freeze([
  "пров",
  "стат",
  "check",
  "state",
  "status",
]);

export const PATH_HINT_PATTERNS = [
  /(?:^|\s)(src\/[^\s]+)/i,
  /(?:^|\s)(pillars\/[^\s]+)/i,
  /(?:^|\s)(docs\/[^\s]+)/i,
  /(?:^|\s)([^()\s]+\.(?:js|mjs|cjs|json|md|txt|sql|yaml|yml))/i,
];

export default {
  PILLARS_ROOT_PHRASES,
  PILLARS_ROOT_TOKENS,
  PILLAR_FILE_RULES,
  ENTITY_RULES,
  REPO_ACCESS_META_PHRASES,
  REPO_ACCESS_META_TOKENS,
  REPO_ACCESS_META_PREFIXES,
  REPO_TARGET_PREFIXES,
  STATUS_PHRASES,
  TREE_PHRASES,
  DIFF_PHRASES,
  SEARCH_PREFIXES,
  READ_PREFIXES,
  EXPLAIN_PREFIXES,
  TRANSLATE_PREFIXES,
  SUMMARY_PREFIXES,
  CHECK_PREFIXES,
  PATH_HINT_PATTERNS,
};