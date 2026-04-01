import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSqlDriver, loadSqlState, saveSqlState } from './sqliteState.mjs';
import { loadLearnMysqlState, saveLearnMysqlState } from './mysqlTables.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LEARN_LEGACY_DATA_PATH = join(__dirname, 'learn-progress-data.json');

function createSeedState() {
  return {
    completedByUser: {},
    favoriteByUser: {},
    quizAnswersByUser: {},
  };
}

async function loadLegacyState() {
  return await loadSqlState('learn-progress', createSeedState, {
    legacyFilePath: LEARN_LEGACY_DATA_PATH,
    normalize: (parsed) => ({
      completedByUser:
        parsed && typeof parsed.completedByUser === 'object' && parsed.completedByUser
          ? parsed.completedByUser
          : {},
      favoriteByUser:
        parsed && typeof parsed.favoriteByUser === 'object' && parsed.favoriteByUser
          ? parsed.favoriteByUser
          : {},
      quizAnswersByUser:
        parsed && typeof parsed.quizAnswersByUser === 'object' && parsed.quizAnswersByUser
          ? parsed.quizAnswersByUser
          : {},
    }),
  });
}

async function loadState() {
  if (getSqlDriver() === 'mysql') {
    return await loadLearnMysqlState(loadLegacyState);
  }

  return await loadLegacyState();
}

let state = await loadState();

function saveState() {
  if (getSqlDriver() === 'mysql') {
    saveLearnMysqlState(state);
    return;
  }

  saveSqlState('learn-progress', state);
}

function normalizeUserKey(userKey) {
  const normalized = String(userKey || '').trim().toLowerCase();
  return normalized || 'guest';
}

function normalizeLessonId(lessonId) {
  return String(lessonId || '').trim();
}

export function getLearnProgressSnapshot(userKey) {
  const safeUserKey = normalizeUserKey(userKey);

  return {
    userKey: safeUserKey,
    completedLessons: state.completedByUser[safeUserKey] ?? [],
    favoriteLessons: state.favoriteByUser[safeUserKey] ?? [],
    quizAnswers: state.quizAnswersByUser[safeUserKey] ?? {},
  };
}

export function toggleLearnCompleted(payload) {
  const userKey = normalizeUserKey(payload.userKey);
  const lessonId = normalizeLessonId(payload.lessonId);
  const current = state.completedByUser[userKey] ?? [];
  const hasLesson = current.includes(lessonId);

  state = {
    ...state,
    completedByUser: {
      ...state.completedByUser,
      [userKey]: hasLesson ? current.filter((id) => id !== lessonId) : [...current, lessonId],
    },
  };
  saveState();

  return getLearnProgressSnapshot(userKey);
}

export function toggleLearnFavorite(payload) {
  const userKey = normalizeUserKey(payload.userKey);
  const lessonId = normalizeLessonId(payload.lessonId);
  const current = state.favoriteByUser[userKey] ?? [];
  const hasLesson = current.includes(lessonId);

  state = {
    ...state,
    favoriteByUser: {
      ...state.favoriteByUser,
      [userKey]: hasLesson ? current.filter((id) => id !== lessonId) : [...current, lessonId],
    },
  };
  saveState();

  return getLearnProgressSnapshot(userKey);
}

export function answerLearnQuiz(payload) {
  const userKey = normalizeUserKey(payload.userKey);
  const lessonId = normalizeLessonId(payload.lessonId);

  state = {
    ...state,
    quizAnswersByUser: {
      ...state.quizAnswersByUser,
      [userKey]: {
        ...(state.quizAnswersByUser[userKey] ?? {}),
        [lessonId]: {
          selectedIndex: Number(payload.selectedIndex) || 0,
          isCorrect: Boolean(payload.isCorrect),
          answeredAt: Date.now(),
        },
      },
    },
  };
  saveState();

  return getLearnProgressSnapshot(userKey);
}
