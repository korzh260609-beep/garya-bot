// src/core/projectIntent/scope/projectIntentScopeConstants.js
// ============================================================================
// LEGACY PROJECT INTENT SCOPE MARKER
//
// INTERFACE MODE NOTE:
// - This module is part of the old projectIntent scope classifier.
// - It uses deterministic phrase/token/prefix/path signals.
// - Under hard Human Mode / Technical Mode separation, this is NOT full Human Mode.
// - Treat this as legacy Technical Mode support until a clean structured meaning
//   layer replaces it.
// - Do not add new phrase-bound hacks here.
// ============================================================================

// ----------------------------------------------------------------------------
// SG CORE — INTERNAL IDENTITY / STRONG ANCHORS
// ----------------------------------------------------------------------------

export const SG_CORE_STRONG_ANCHORS = Object.freeze([
  "garya-bot",
  "советник garya",
  "sg core",
  "core sg",
  "core project sg",
  "проект sg",
  "sg project",
  "мой проект sg",
  "my sg project",
  "мой репозиторий sg",
  "my sg repo",
  "workflow",
  "roadmap",
  "decisions.md",
  "sg_behavior.md",
  "sg_entity.md",
  "pillars/",
  "/workflow_check",
  "/stage_check",
  "workflow_check",
  "stage_check",
  "repo_status",
  "repo_tree",
  "repo_file",
  "repo_search",
  "repo_analyze",
  "code_output_status",
]);

export const SG_CORE_IDENTITY_TOKENS = Object.freeze([
  "sg",
  "сг",
]);

export const SG_CORE_IDENTITY_PHRASES = Object.freeze([
  "project sg",
  "sg project",
  "проект sg",
  "sg repo",
  "repo sg",
  "репо sg",
  "github sg",
  "репозиторий sg",
]);

// ----------------------------------------------------------------------------
// CANONICAL SG GOVERNANCE LAYER
// ----------------------------------------------------------------------------

export const SG_CANONICAL_PILLAR_PHRASES = Object.freeze([
  "workflow",
  "roadmap",
  "decisions.md",
  "repoindex.md",
  "project.md",
  "kingdom.md",
  "sg_behavior.md",
  "sg_entity.md",
  "code_insert_rules.md",
  "pillars/",
]);

export const SG_CANONICAL_PILLAR_TOKENS = Object.freeze([
  "workflow",
  "roadmap",
  "decisions",
  "repoindex",
  "pillars",
  "pillar",
  "пилларс",
  "пиллары",
]);

// ----------------------------------------------------------------------------
// OBJECT / DOMAIN SIGNALS
// ----------------------------------------------------------------------------

export const SG_CORE_OBJECT_PHRASES = Object.freeze([
  "workflow sg",
  "roadmap sg",
  "architecture sg",
  "sg architecture",
  "core architecture",
  "архитектура sg",
  "архитектура советника garya",
  "код sg",
  "repo sg",
  "github sg",
  "репозиторий проекта sg",
  "github проекта sg",
  "дерево репозитория sg",
  "структура репозитория sg",
]);

export const SG_CORE_OBJECT_TOKENS_STRONG = Object.freeze([
  "workflow",
  "roadmap",
  "architecture",
  "github",
  "repository",
  "repo",
  "pillars",
  "decisions",
  "root",
  "tree",
  "structure",
]);

export const SG_CORE_OBJECT_TOKENS_WEAK = Object.freeze([
  "project",
  "projects",
  "code",
  "проект",
  "проекта",
  "проекту",
  "код",
  "репо",
  "репозиторий",
  "архитектура",
  "воркфлоу",
  "гитхаб",
  "корень",
  "дерево",
  "структура",
  "файлы",
  "папки",
]);

export const SG_CORE_OBJECT_PREFIXES = Object.freeze([
  "репозитор",
  "архитектур",
  "гитхаб",
  "воркфлоу",
  "структур",
  "дерев",
  "корен",
  "файл",
  "папк",
  "src",
  "module",
  "handler",
]);

// ----------------------------------------------------------------------------
// REPO ACCESS / VISIBILITY / CONNECTION META SIGNALS
// ----------------------------------------------------------------------------

export const SG_REPO_META_ACCESS_PHRASES = Object.freeze([
  "do you have access to the repo",
  "do you have access to repository",
  "do you have access to github",
  "can you read the repo",
  "can you see the repo",
  "can you access the repo",
  "can you access github",
  "are you connected to github",
  "repo access",
  "repository access",
  "github access",

  "у тебя есть доступ к репозиторию",
  "у тебя есть доступ к github",
  "ты видишь репозиторий",
  "ты видишь github",
  "ты можешь читать репозиторий",
  "ты можешь открыть репозиторий",
  "ты подключен к github",
  "есть доступ к репозиторию",
  "есть доступ к github",
  "доступ к репозиторию",
  "доступ к github",
  "подключение к github",
  "подключение к репозиторию",
]);

export const SG_REPO_META_ACCESS_TOKENS = Object.freeze([
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

export const SG_REPO_META_ACCESS_PREFIXES = Object.freeze([
  "доступ",
  "подключ",
  "вид",
  "чит",
  "access",
  "connect",
  "read",
  "see",
]);

export const SG_REPO_TARGET_PREFIXES = Object.freeze([
  "репозитор",
  "репо",
  "github",
  "гитхаб",
  "repo",
  "repositor",
]);

// ----------------------------------------------------------------------------
// REPO STRUCTURE / TREE SIGNALS
// ----------------------------------------------------------------------------

export const SG_REPO_STRUCTURE_PHRASES = Object.freeze([
  "repo tree",
  "repository tree",
  "repo root",
  "repository root",
  "root of repository",
  "root of repo",
  "show repo tree",
  "show repository tree",

  "дерево репозитория",
  "структура репозитория",
  "корень репозитория",
  "какие папки в корне репозитория",
  "какие файлы в корне репозитория",
  "покажи корень репозитория",
  "покажи дерево репозитория",
  "покажи структуру репозитория",
]);

export const SG_REPO_STRUCTURE_TOKENS = Object.freeze([
  "tree",
  "root",
  "structure",
  "корень",
  "дерево",
  "структура",
  "файлы",
  "папки",
]);

export const SG_REPO_STRUCTURE_PREFIXES = Object.freeze([
  "tree",
  "root",
  "struct",
  "корен",
  "дерев",
  "структур",
  "файл",
  "папк",
]);

// ----------------------------------------------------------------------------
// USER PROJECT SIGNALS
// ----------------------------------------------------------------------------

export const USER_PROJECT_PHRASES = Object.freeze([
  "my project",
  "мой проект",
  "мой бот",
  "my bot",
  "my repo",
  "мой репозиторий",
  "мой github",
  "my github",
  "мой код",
  "my code",
  "мой сервис",
  "my service",
]);

export const USER_PROJECT_TOKENS = Object.freeze([
  "my",
  "мой",
  "моя",
  "моё",
  "мои",
]);

// ----------------------------------------------------------------------------
// ACTIONS
// ----------------------------------------------------------------------------

export const PROJECT_READ_ACTION_PHRASES = Object.freeze([
  "check repo",
  "check my repo",
  "look into my repo",
  "analyze my repo",
  "check workflow",
  "check stage",
  "open workflow",
  "open decisions",
  "open roadmap",
  "show workflow",
  "show decisions",
  "show roadmap",
  "read workflow",
  "read decisions",
  "read roadmap",
  "show repo tree",
  "show repository tree",
  "show repo root",
  "open repo file",

  "проверь код",
  "проверь репо",
  "проверь репозиторий",
  "посмотри репо",
  "посмотри репозиторий",
  "проверь workflow",
  "проверь архитектуру",
  "открой workflow",
  "открой decisions",
  "открой roadmap",
  "покажи workflow",
  "покажи decisions",
  "покажи roadmap",
  "прочитай workflow",
  "прочитай decisions",
  "прочитай roadmap",
  "покажи дерево репозитория",
  "покажи корень репозитория",
  "открой файл из репозитория",
]);

export const PROJECT_READ_ACTION_TOKENS = Object.freeze([
  "check",
  "analyze",
  "inspect",
  "review",
  "read",
  "show",
  "look",
  "compare",
  "verify",
  "scan",
  "find",
  "open",

  "посмотри",
  "проверь",
  "проверить",
  "проверка",
  "показать",
  "открой",
  "сравни",
  "сравнить",
  "найди",
  "прочитай",
  "анализ",
  "проанализируй",
  "объясни",
  "поясни",
]);

export const PROJECT_WRITE_ACTION_PHRASES = Object.freeze([
  "open pr",
  "create pr",
  "pull request",
  "write to repo",
  "edit repo",
  "modify repo",
  "change repo",
  "rewrite file",
  "replace file",
  "delete file",
  "remove file",
  "update file",
  "create file",
  "apply patch",
  "apply diff",
  "auto deploy",

  "сделай коммит",
  "создай pr",
  "создай пулл реквест",
  "измени файл",
  "измени код",
  "запиши в репо",
  "удали файл",
  "перепиши файл",
  "обнови файл",
  "сделай деплой",
]);

export const PROJECT_WRITE_ACTION_TOKENS = Object.freeze([
  "commit",
  "push",
  "merge",
  "deploy",
  "release",
  "edit",
  "modify",
  "change",
  "rewrite",
  "replace",
  "delete",
  "remove",
  "update",
  "create",
  "write",
  "apply",
  "patch",
  "diff",
  "pr",

  "закоммить",
  "запушь",
  "смёрджи",
  "смерджи",
  "задеплой",
  "деплой",
  "обнови",
  "измени",
  "удали",
  "создай",
  "запиши",
  "перепиши",
]);
