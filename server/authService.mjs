import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSqlDriver, loadSqlState, saveSqlState } from './sqliteState.mjs';
import { loadAuthMysqlState, saveAuthMysqlState } from './mysqlTables.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const AUTH_LEGACY_DATA_PATH = join(__dirname, 'auth-data.json');

export class AuthServiceError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'AuthServiceError';
    this.statusCode = statusCode;
  }
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSeedState() {
  return {
    users: [],
    resetRequests: [],
    sessions: [],
  };
}

async function loadLegacyState() {
  return await loadSqlState('auth', createSeedState, {
    legacyFilePath: AUTH_LEGACY_DATA_PATH,
    normalize: (parsed) => ({
      users: Array.isArray(parsed.users) ? parsed.users : [],
      resetRequests: Array.isArray(parsed.resetRequests) ? parsed.resetRequests : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
    }),
  });
}

async function loadState() {
  if (getSqlDriver() === 'mysql') {
    return await loadAuthMysqlState(loadLegacyState);
  }

  return await loadLegacyState();
}

let state = await loadState();

function saveState() {
  if (getSqlDriver() === 'mysql') {
    saveAuthMysqlState(state);
    return;
  }

  saveSqlState('auth', state);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeName(name, email) {
  const trimmedName = String(name || '').trim();

  if (trimmedName) {
    return trimmedName.slice(0, 24);
  }

  const [localPart] = normalizeEmail(email).split('@');
  return localPart || 'user';
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const passwordHash = scryptSync(password, salt, 64).toString('hex');
  return { salt, passwordHash };
}

function verifyPassword(password, salt, passwordHash) {
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(passwordHash, 'hex');

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}

function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function createSession(user) {
  const token = randomBytes(32).toString('hex');
  const timestamp = Date.now();

  state = {
    ...state,
    sessions: [
      {
        id: createId('session'),
        tokenHash: hashSessionToken(token),
        email: user.email,
        userId: user.id,
        createdAt: timestamp,
        lastUsedAt: timestamp,
      },
      ...state.sessions.filter((session) => session.email !== user.email).slice(0, 49),
    ],
  };
  saveState();

  return token;
}

function requireSessionToken(sessionToken) {
  const normalized = String(sessionToken || '').trim();

  if (!normalized) {
    throw new AuthServiceError(401, '로그인이 필요한 요청입니다.');
  }

  const tokenHash = hashSessionToken(normalized);
  const index = state.sessions.findIndex((session) => session.tokenHash === tokenHash);

  if (index < 0) {
    throw new AuthServiceError(401, '세션이 만료되었거나 유효하지 않습니다.');
  }

  const session = state.sessions[index];
  const nextSessions = [...state.sessions];
  nextSessions[index] = {
    ...session,
    lastUsedAt: Date.now(),
  };

  state = {
    ...state,
    sessions: nextSessions,
  };
  saveState();

  return requireUser(session.email);
}

export function requireSessionUser(sessionToken, expectedEmail) {
  const user = requireSessionToken(sessionToken);

  if (expectedEmail && normalizeEmail(expectedEmail) !== user.email) {
    throw new AuthServiceError(403, '다른 사용자 정보에는 접근할 수 없습니다.');
  }

  return sanitizeUser(user);
}

function assertEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new AuthServiceError(400, '이메일을 입력해주세요.');
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(normalizedEmail)) {
    throw new AuthServiceError(400, '올바른 이메일 형식으로 입력해주세요.');
  }

  return normalizedEmail;
}

function assertPassword(password) {
  const trimmedPassword = String(password || '');

  if (!trimmedPassword.trim()) {
    throw new AuthServiceError(400, '비밀번호를 입력해주세요.');
  }

  if (trimmedPassword.length < 6) {
    throw new AuthServiceError(400, '비밀번호는 6자 이상 입력해주세요.');
  }

  return trimmedPassword;
}

function findUserIndex(email) {
  return state.users.findIndex((user) => user.email === email);
}

function requireUser(email) {
  const normalizedEmail = assertEmail(email);
  const user = state.users.find((entry) => entry.email === normalizedEmail);

  if (!user) {
    throw new AuthServiceError(404, '사용자를 찾을 수 없습니다.');
  }

  return user;
}

export function signupUser(payload) {
  const email = assertEmail(payload.email);
  const password = assertPassword(payload.password);
  const name = normalizeName(payload.name, email);

  const exists = state.users.some((user) => user.email === email);
  if (exists) {
    throw new AuthServiceError(409, '이미 가입된 이메일입니다.');
  }

  const timestamp = Date.now();
  const { salt, passwordHash } = hashPassword(password);

  const user = {
    id: createId('user'),
    email,
    name,
    avatarUrl: undefined,
    salt,
    passwordHash,
    createdAt: timestamp,
  };

  state = {
    ...state,
    users: [user, ...state.users],
  };
  saveState();

  return {
    user: sanitizeUser(user),
    sessionToken: createSession(user),
  };
}

export function loginUser(payload) {
  const email = assertEmail(payload.email);
  const password = assertPassword(payload.password);

  const user = state.users.find((entry) => entry.email === email);
  if (!user) {
    throw new AuthServiceError(401, '이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  if (!verifyPassword(password, user.salt, user.passwordHash)) {
    throw new AuthServiceError(401, '이메일 또는 비밀번호가 올바르지 않습니다.');
  }

  return {
    user: sanitizeUser(user),
    sessionToken: createSession(user),
  };
}

export function restoreUserSession(payload) {
  const user = requireSessionToken(payload.sessionToken);

  return {
    user: sanitizeUser(user),
    sessionToken: payload.sessionToken,
  };
}

export function logoutUserSession(payload) {
  const tokenHash = hashSessionToken(String(payload.sessionToken || '').trim());

  state = {
    ...state,
    sessions: state.sessions.filter((session) => session.tokenHash !== tokenHash),
  };
  saveState();

  return { ok: true };
}

export function getUserProfile(email) {
  return sanitizeUser(requireUser(email));
}

export function updateUserProfile(payload) {
  const email = assertEmail(payload.email);
  const index = findUserIndex(email);

  if (index < 0) {
    throw new AuthServiceError(404, '사용자를 찾을 수 없습니다.');
  }

  const currentUser = state.users[index];
  const nextUser = {
    ...currentUser,
    name: normalizeName(payload.name, email),
  };

  const nextUsers = [...state.users];
  nextUsers[index] = nextUser;

  state = {
    ...state,
    users: nextUsers,
  };
  saveState();

  return sanitizeUser(nextUser);
}

export function updateUserAvatar(payload) {
  const email = assertEmail(payload.email);
  const index = findUserIndex(email);

  if (index < 0) {
    throw new AuthServiceError(404, '사용자를 찾을 수 없습니다.');
  }

  const currentUser = state.users[index];
  const nextUser = {
    ...currentUser,
    avatarUrl: payload.avatarUrl || undefined,
  };

  const nextUsers = [...state.users];
  nextUsers[index] = nextUser;

  state = {
    ...state,
    users: nextUsers,
  };
  saveState();

  return sanitizeUser(nextUser);
}

export function requestPasswordReset(payload) {
  const email = assertEmail(payload.email);
  const timestamp = Date.now();
  const targetUser = state.users.find((entry) => entry.email === email);

  state = {
    ...state,
    resetRequests: [
      {
        id: createId('reset'),
        email,
        exists: Boolean(targetUser),
        createdAt: timestamp,
      },
      ...state.resetRequests,
    ].slice(0, 50),
  };
  saveState();

  return {
    ok: true,
    message:
      '비밀번호 재설정 요청을 접수했습니다. 데모 버전이라 실제 이메일 대신 서버에 요청 기록만 남깁니다.',
  };
}
