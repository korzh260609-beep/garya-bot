// src/memory/project/projectMemoryExperienceLessons.js
// SG 2.0 — Project Memory Experience Lessons Skeleton.
// Purpose: prepare reviewed project-experience lesson candidates from provided lesson payloads only.
// Lessons must preserve source references and must not override pillars or Monarch decisions.
// This module does not read/write DB, confirm memory, fetch sources, call AI, or touch transports.
// Do not add raw chat summaries, Telegram logic, GitHub/Render/web fetching, runtime file writes,
// repository mutation, env changes, confirmed memory writes, auto-confirmation, or prompt injection here.

export const PROJECT_MEMORY_EXPERIENCE_LESSONS_VERSION = 1;

export const PROJECT_MEMORY_EXPERIENCE_LESSONS_MODES = Object.freeze({
  SKELETON_ONLY: "skeleton_only",
});

export const PROJECT_MEMORY_EXPERIENCE_LESSONS_DECISIONS = Object.freeze({
  LESSONS_PREPARED: "project_experience_lessons_prepared",
  REQUEST_REJECTED: "project_experience_lessons_request_rejected",
});

export const PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES = Object.freeze({
  SUCCESSFUL_ARCHITECTURE_PATTERN: "successful_architecture_pattern",
  FAILED_APPROACH: "failed_approach",
  RECURRING_ERROR: "recurring_error",
  SAFE_ROLLBACK_LESSON: "safe_rollback_lesson",
  WORKFLOW_IMPROVEMENT: "workflow_improvement",
  MODULE_BOUNDARY_LESSON: "module_boundary_lesson",
});

export const PROJECT_MEMORY_EXPERIENCE_LESSON_REVIEW_STATES = Object.freeze({
  NEEDS_REVIEW: "needs_review",
  REVIEWED: "reviewed",
  CONFIRMED: "confirmed",
});

const ALLOWED_LESSON_TYPES = new Set(Object.values(PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES));
const ALLOWED_REVIEW_STATES = new Set(Object.values(PROJECT_MEMORY_EXPERIENCE_LESSON_REVIEW_STATES));

const SECRET_PATTERNS = [
  /DATABASE_URL\s*=/i,
  /OPENAI_API_KEY\s*=/i,
  /TELEGRAM_BOT_TOKEN\s*=/i,
  /GITHUB_TOKEN\s*=/i,
  /GITHUB_PRIVATE_KEY\s*=/i,
  /RENDER_API_KEY\s*=/i,
  /sk-[a-z0-9_-]{16,}/i,
  /ghp_[a-z0-9_]{16,}/i,
  /github_pat_[a-z0-9_]{16,}/i,
  /postgres(?:ql)?:\/\//i,
];

function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeText(value) {
  return safeString(value).trim();
}

function normalizeComparisonText(value) {
  return normalizeText(value).toLowerCase();
}

function normalizePlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeLessonType(lesson = {}) {
  return normalizeComparisonText(lesson.lessonType || lesson.lesson_type || lesson.type);
}

function normalizeReviewState(lesson = {}) {
  const state = normalizeComparisonText(lesson.reviewState || lesson.review_state || lesson.status);
  return ALLOWED_REVIEW_STATES.has(state)
    ? state
    : PROJECT_MEMORY_EXPERIENCE_LESSON_REVIEW_STATES.NEEDS_REVIEW;
}

function normalizeLessonId(lesson = {}, fallbackIndex = 0) {
  return normalizeText(lesson.id || lesson.lessonId || lesson.lesson_id) || `lesson_${fallbackIndex}`;
}

function normalizeSourceRefs(lesson = {}) {
  const refs = normalizeArray(lesson.sourceRefs || lesson.source_refs);
  const singleRef = normalizeText(lesson.sourceRef || lesson.source_ref);
  const normalized = refs.map(normalizeText).filter(Boolean);
  if (singleRef) normalized.push(singleRef);
  return [...new Set(normalized)];
}

function containsSecretLikeText(value) {
  const text = normalizeText(value);
  if (!text) return false;
  return SECRET_PATTERNS.some((pattern) => pattern.test(text));
}

function containsForbiddenRawMaterial(value) {
  const text = normalizeText(value);
  if (!text) return false;
  return (
    containsSecretLikeText(text) ||
    /raw\s*chat/i.test(text) ||
    /chat\s*dump/i.test(text) ||
    /raw\s*logs?/i.test(text) ||
    /provider\s*id/i.test(text) ||
    /transport\s*id/i.test(text) ||
    /user[_-]?id\s*[:=]/i.test(text) ||
    /chat[_-]?id\s*[:=]/i.test(text)
  );
}

function sanitizeText(value, fallback = "") {
  const text = normalizeText(value);
  if (!text) return fallback;
  if (containsForbiddenRawMaterial(text)) return "redacted";
  return text.slice(0, 500);
}

function createError(code, message, extra = {}) {
  return { code, message, ...extra };
}

function createWarning(code, message, extra = {}) {
  return { code, message, ...extra };
}

function lessonContainsForbiddenMaterial(lesson = {}) {
  const metadata = normalizePlainObject(lesson.metadata);
  return [
    lesson.title,
    lesson.summary,
    lesson.lesson,
    lesson.details,
    lesson.rawChatSummary,
    lesson.raw_chat_summary,
    lesson.rawLog,
    lesson.raw_log,
    metadata.summary,
    metadata.details,
  ].some(containsForbiddenRawMaterial);
}

function validateLessonInput(lesson = {}, index = 0) {
  const lessonId = normalizeLessonId(lesson, index);
  const lessonType = normalizeLessonType(lesson);
  const sourceRefs = normalizeSourceRefs(lesson);
  const title = normalizeText(lesson.title);
  const summary = normalizeText(lesson.summary || lesson.lesson);
  const errors = [];
  const warnings = [];

  if (!ALLOWED_LESSON_TYPES.has(lessonType)) {
    errors.push(
      createError("lesson_type_not_allowlisted", "Project experience lesson type is not allowlisted.", {
        lessonId,
        lessonType,
      }),
    );
  }

  if (!sourceRefs.length) {
    errors.push(
      createError("missing_source_ref", "Project experience lessons require at least one source reference.", {
        lessonId,
        lessonType,
      }),
    );
  }

  if (!title) {
    errors.push(createError("missing_title", "Project experience lessons require a title.", { lessonId }));
  }

  if (!summary) {
    errors.push(createError("missing_summary", "Project experience lessons require a summary/lesson.", { lessonId }));
  }

  if (lessonContainsForbiddenMaterial(lesson)) {
    errors.push(
      createError("forbidden_raw_or_secret_material_rejected", "Lesson payload contains forbidden raw/secret material.", {
        lessonId,
        lessonType,
      }),
    );
  }

  if (lesson.overridePillars === true || lesson.override_pillars === true) {
    errors.push(
      createError("pillar_override_rejected", "Project experience lessons must not override pillars.", {
        lessonId,
      }),
    );
  }

  if (lesson.overrideMonarchDecision === true || lesson.override_monarch_decision === true) {
    errors.push(
      createError("monarch_decision_override_rejected", "Project experience lessons must not override Monarch decisions.", {
        lessonId,
      }),
    );
  }

  const reviewState = normalizeReviewState(lesson);
  if (reviewState === PROJECT_MEMORY_EXPERIENCE_LESSON_REVIEW_STATES.NEEDS_REVIEW) {
    warnings.push(
      createWarning("lesson_requires_review", "Lesson candidate remains needs_review and must not become confirmed memory automatically.", {
        lessonId,
      }),
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}

function buildLessonCandidate(lesson = {}, index = 0) {
  const lessonId = normalizeLessonId(lesson, index);
  const lessonType = normalizeLessonType(lesson);
  const reviewState = normalizeReviewState(lesson);
  const sourceRefs = normalizeSourceRefs(lesson);
  const metadata = normalizePlainObject(lesson.metadata);

  return {
    id: `project_experience_lesson_candidate_${lessonId}`,
    trust: "candidate",
    status: "pending_confirmation",
    reviewState,
    lessonType,
    title: sanitizeText(lesson.title, "Untitled lesson"),
    summary: sanitizeText(lesson.summary || lesson.lesson, "No summary provided."),
    sourceRefs,
    scope: sanitizeText(lesson.scope || metadata.scope || "project_memory"),
    sourceMetadata: {
      sourceRefs,
      importedRawChat: false,
      importedRawLogs: false,
      importedSecrets: false,
      overridesPillars: false,
      overridesMonarchDecisions: false,
    },
  };
}

export function getProjectMemoryExperienceLessonsBoundaries() {
  return {
    transportIndependent: true,
    providedLessonsOnly: true,
    reviewedOrConfirmationPathRequired: true,
    preservesSourceReferences: true,
    rawChatSummariesAllowed: false,
    rawLogsAllowed: false,
    secretsAllowed: false,
    overridesPillars: false,
    overridesMonarchDecisions: false,
    createsCandidateDrafts: true,
    createsDurableCandidates: false,
    confirmsCandidates: false,
    writesConfirmedMemory: false,
    readsStorage: false,
    writesStorage: false,
    callsAI: false,
    fetchesGitHub: false,
    fetchesRender: false,
    fetchesWeb: false,
    fetchesSources: false,
    touchesTelegram: false,
    readsRawChat: false,
    autoWritesFromChat: false,
    autoWritesFromAI: false,
    promptInjection: false,
    modifiesRepository: false,
    writesRuntimeFiles: false,
    changesEnvironment: false,
  };
}

export function buildProjectMemoryExperienceLessonsStatus() {
  return {
    ok: true,
    module: "project_memory",
    service: "ProjectMemoryExperienceLessons",
    version: PROJECT_MEMORY_EXPERIENCE_LESSONS_VERSION,
    mode: PROJECT_MEMORY_EXPERIENCE_LESSONS_MODES.SKELETON_ONLY,
    allowedLessonTypes: Object.values(PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES),
    reviewStates: Object.values(PROJECT_MEMORY_EXPERIENCE_LESSON_REVIEW_STATES),
    canPrepareLessonCandidates: true,
    canCreateDurableCandidates: false,
    canConfirmCandidate: false,
    canWriteStorage: false,
    canFetchSources: false,
    callsAI: false,
    boundaries: getProjectMemoryExperienceLessonsBoundaries(),
  };
}

export function prepareProjectMemoryExperienceLessons({ lessons = [], options = {} } = {}) {
  const boundaries = getProjectMemoryExperienceLessonsBoundaries();
  const safeOptions = normalizePlainObject(options);

  if (!Array.isArray(lessons)) {
    return {
      ok: false,
      version: PROJECT_MEMORY_EXPERIENCE_LESSONS_VERSION,
      mode: PROJECT_MEMORY_EXPERIENCE_LESSONS_MODES.SKELETON_ONLY,
      decision: PROJECT_MEMORY_EXPERIENCE_LESSONS_DECISIONS.REQUEST_REJECTED,
      reason: "invalid_lessons_input",
      summary: {
        lessonsChecked: 0,
        acceptedLessons: 0,
        rejectedLessons: 0,
        candidateDraftsCreated: 0,
      },
      candidates: [],
      warnings: [],
      errors: [
        createError("invalid_lessons_input", "Project experience lessons requires lessons to be an array."),
      ],
      boundaries,
    };
  }

  const candidates = [];
  const warnings = [];
  const errors = [];

  if (safeOptions.autoConfirm === true || safeOptions.auto_confirm === true) {
    warnings.push(
      createWarning("auto_confirm_ignored", "Skeleton lessons never auto-confirm candidates."),
    );
  }

  lessons.forEach((lessonInput, index) => {
    const lesson = normalizePlainObject(lessonInput);
    const validation = validateLessonInput(lesson, index);
    warnings.push(...validation.warnings);

    if (!validation.ok) {
      errors.push(...validation.errors);
      return;
    }

    candidates.push(buildLessonCandidate(lesson, index));
  });

  return {
    ok: true,
    version: PROJECT_MEMORY_EXPERIENCE_LESSONS_VERSION,
    mode: PROJECT_MEMORY_EXPERIENCE_LESSONS_MODES.SKELETON_ONLY,
    decision: PROJECT_MEMORY_EXPERIENCE_LESSONS_DECISIONS.LESSONS_PREPARED,
    summary: {
      lessonsChecked: lessons.length,
      acceptedLessons: candidates.length,
      rejectedLessons: errors.length,
      candidateDraftsCreated: candidates.length,
    },
    candidates,
    warnings,
    errors,
    boundaries,
  };
}

export default {
  PROJECT_MEMORY_EXPERIENCE_LESSONS_VERSION,
  PROJECT_MEMORY_EXPERIENCE_LESSONS_MODES,
  PROJECT_MEMORY_EXPERIENCE_LESSONS_DECISIONS,
  PROJECT_MEMORY_EXPERIENCE_LESSON_TYPES,
  PROJECT_MEMORY_EXPERIENCE_LESSON_REVIEW_STATES,
  buildProjectMemoryExperienceLessonsStatus,
  getProjectMemoryExperienceLessonsBoundaries,
  prepareProjectMemoryExperienceLessons,
};
