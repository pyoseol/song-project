import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSqlDriver, loadSqlState, saveSqlState } from './sqliteState.mjs';
import {
  loadSessionRecruitMysqlState,
  saveSessionRecruitMysqlState,
} from './mysqlTables.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SESSION_RECRUIT_LEGACY_DATA_PATH = join(__dirname, 'session-recruit-data.json');

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeText(value, fallback = '') {
  const trimmed = String(value || '').trim();
  return trimmed || fallback;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRoles(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed = new Set([
    'vocal',
    'guitar',
    'bass',
    'drums',
    'keys',
    'producer',
    'mix',
  ]);

  return Array.from(
    new Set(
      value
        .map((item) => String(item || '').trim())
        .filter((item) => allowed.has(item))
    )
  );
}

function normalizeTags(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 6)
    )
  );
}

function normalizeRegion(value) {
  const allowed = new Set(['seoul', 'gyeonggi', 'incheon', 'busan', 'online']);
  return allowed.has(value) ? value : 'online';
}

function normalizeMeetingType(value) {
  const allowed = new Set(['오프라인', '온라인', '온/오프 병행']);
  return allowed.has(value) ? value : '온라인';
}

function normalizeStatus(value) {
  const allowed = new Set(['open', 'closing', 'closed']);
  return allowed.has(value) ? value : 'open';
}

function createSeedState() {
  return {
    posts: [
      {
        id: 'session-1',
        title: '홍대 인디팝 밴드 보컬/드럼 구합니다',
        genre: 'Indie Pop',
        hostName: 'seoulgroove',
        hostEmail: 'seoulgroove@songmaker.app',
        summary:
          '주 1회 합주 가능한 분 찾고 있습니다. 자작곡과 커버를 반반씩 준비하고 있고, 공연 목표는 6월 소규모 쇼케이스입니다.',
        location: '서울 마포구 합주실',
        region: 'seoul',
        meetingType: '오프라인',
        status: 'open',
        wantedRoles: ['vocal', 'drums'],
        tags: ['공연', '자작곡', '주 1회'],
        currentMembers: 3,
        maxMembers: 5,
        schedule: '매주 토요일 오후 3시',
        createdAt: Date.parse('2026-03-22T11:00:00+09:00'),
        updatedAt: Date.parse('2026-03-22T11:00:00+09:00'),
        urgent: true,
      },
      {
        id: 'session-2',
        title: '시티팝 프로젝트 건반/베이스 세션 모집',
        genre: 'City Pop',
        hostName: 'nightdrive',
        hostEmail: 'nightdrive@songmaker.app',
        summary:
          'EP 제작을 목표로 하는 온라인/오프라인 병행 팀입니다. 데모 정리와 합주 둘 다 가능한 분이면 더 잘 맞습니다.',
        location: '성남 판교 + 디스코드',
        region: 'gyeonggi',
        meetingType: '온/오프 병행',
        status: 'closing',
        wantedRoles: ['keys', 'bass'],
        tags: ['EP 제작', '온라인 병행', '데모'],
        currentMembers: 4,
        maxMembers: 6,
        schedule: '평일 저녁 협의',
        createdAt: Date.parse('2026-03-22T08:00:00+09:00'),
        updatedAt: Date.parse('2026-03-22T08:00:00+09:00'),
        urgent: true,
      },
      {
        id: 'session-3',
        title: '온라인 작곡 세션, 프로듀서/믹스 모집',
        genre: 'R&B / Lo-fi',
        hostName: 'cloudmaker',
        hostEmail: 'cloudmaker@songmaker.app',
        summary:
          '원격 협업 중심 팀입니다. 보컬 데모와 코드 진행은 준비되어 있고, 편곡과 믹스 파트를 같이 정리할 분을 찾고 있어요.',
        location: '온라인',
        region: 'online',
        meetingType: '온라인',
        status: 'open',
        wantedRoles: ['producer', 'mix'],
        tags: ['원격 협업', '편곡', '믹스'],
        currentMembers: 2,
        maxMembers: 4,
        schedule: '디스코드 상시',
        createdAt: Date.parse('2026-03-21T18:00:00+09:00'),
        updatedAt: Date.parse('2026-03-21T18:00:00+09:00'),
        urgent: false,
      },
      {
        id: 'session-4',
        title: '부산 펑크 밴드 기타/베이스 구해요',
        genre: 'Pop Punk',
        hostName: 'busanwave',
        hostEmail: 'busanwave@songmaker.app',
        summary:
          '합주 빈도 높은 팀입니다. 공연 경험 있으면 좋지만 필수는 아니고, 톤 메이킹과 라이브 합에 자신 있는 분이면 잘 맞습니다.',
        location: '부산 서면 합주실',
        region: 'busan',
        meetingType: '오프라인',
        status: 'open',
        wantedRoles: ['guitar', 'bass'],
        tags: ['라이브', '공연 준비', '주 2회'],
        currentMembers: 2,
        maxMembers: 4,
        schedule: '주 2회 저녁',
        createdAt: Date.parse('2026-03-20T20:00:00+09:00'),
        updatedAt: Date.parse('2026-03-20T20:00:00+09:00'),
        urgent: false,
      },
      {
        id: 'session-5',
        title: '보컬 세션 모집, 발라드 커버 팀',
        genre: 'Ballad',
        hostName: 'roomstudio',
        hostEmail: 'roomstudio@songmaker.app',
        summary:
          '커버 영상과 숏폼 업로드를 같이 할 팀원을 찾습니다. 여성/남성 보컬 모두 열려 있고, 녹음 장비가 있으면 더 좋습니다.',
        location: '인천 부평 스튜디오',
        region: 'incheon',
        meetingType: '온/오프 병행',
        status: 'closing',
        wantedRoles: ['vocal'],
        tags: ['커버', '숏폼', '녹음'],
        currentMembers: 4,
        maxMembers: 5,
        schedule: '주말 오후',
        createdAt: Date.parse('2026-03-20T14:00:00+09:00'),
        updatedAt: Date.parse('2026-03-20T14:00:00+09:00'),
        urgent: false,
      },
      {
        id: 'session-6',
        title: '드럼 세션 구인, 재즈 합주 프로젝트',
        genre: 'Jazz',
        hostName: 'bluequartet',
        hostEmail: 'bluequartet@songmaker.app',
        summary:
          '즉흥 연주를 좋아하는 드러머를 찾고 있습니다. 스탠더드 곡 위주로 진행하고 월 1회 작은 공연도 계획 중입니다.',
        location: '서울 성수',
        region: 'seoul',
        meetingType: '오프라인',
        status: 'closed',
        wantedRoles: ['drums'],
        tags: ['재즈', '즉흥', '공연'],
        currentMembers: 4,
        maxMembers: 4,
        schedule: '매주 수요일 밤',
        createdAt: Date.parse('2026-03-19T22:00:00+09:00'),
        updatedAt: Date.parse('2026-03-19T22:00:00+09:00'),
        urgent: false,
      },
    ],
  };
}

async function loadLegacyState() {
  return await loadSqlState('session-recruit', createSeedState, {
    legacyFilePath: SESSION_RECRUIT_LEGACY_DATA_PATH,
    normalize: (parsed) => ({
      posts: Array.isArray(parsed.posts) ? parsed.posts : createSeedState().posts,
    }),
  });
}

async function loadState() {
  if (getSqlDriver() === 'mysql') {
    return await loadSessionRecruitMysqlState(loadLegacyState);
  }

  return await loadLegacyState();
}

let state = await loadState();

function saveState() {
  if (getSqlDriver() === 'mysql') {
    saveSessionRecruitMysqlState(state);
    return;
  }

  saveSqlState('session-recruit', state);
}

export function getSessionRecruitSnapshot() {
  return {
    posts: [...state.posts].sort(
      (left, right) => right.updatedAt - left.updatedAt || right.createdAt - left.createdAt
    ),
  };
}

function findPostOrThrow(postId) {
  const post = state.posts.find((item) => item.id === postId);

  if (!post) {
    throw createHttpError(404, '세션 모집글을 찾을 수 없습니다.');
  }

  return post;
}

export function createSessionRecruitPost(payload) {
  const timestamp = Date.now();
  const nextPost = {
    id: createId('session'),
    title: normalizeText(payload.title, '새 세션 모집'),
    genre: normalizeText(payload.genre, '미정'),
    hostName: normalizeText(payload.hostName, 'guest'),
    hostEmail: normalizeEmail(payload.hostEmail) || 'guest@songmaker.local',
    summary: normalizeText(payload.summary),
    location: normalizeText(payload.location, '온라인'),
    region: normalizeRegion(payload.region),
    meetingType: normalizeMeetingType(payload.meetingType),
    status: normalizeStatus(payload.status),
    wantedRoles: normalizeRoles(payload.wantedRoles),
    tags: normalizeTags(payload.tags),
    currentMembers: Math.max(1, Number(payload.currentMembers) || 1),
    maxMembers: Math.max(1, Number(payload.maxMembers) || 4),
    schedule: normalizeText(payload.schedule, '일정 협의'),
    createdAt: timestamp,
    updatedAt: timestamp,
    urgent: Boolean(payload.urgent),
  };

  state = {
    ...state,
    posts: [nextPost, ...state.posts],
  };
  saveState();

  return {
    postId: nextPost.id,
    snapshot: getSessionRecruitSnapshot(),
  };
}

export function updateSessionRecruitPost(postId, payload) {
  const target = findPostOrThrow(postId);
  const userEmail = normalizeEmail(payload.userEmail);

  if (!userEmail || userEmail !== normalizeEmail(target.hostEmail)) {
    throw createHttpError(403, '이 모집글을 수정할 권한이 없습니다.');
  }

  state = {
    ...state,
    posts: state.posts.map((post) =>
      post.id === postId
        ? {
            ...post,
            title: normalizeText(payload.title, post.title),
            genre: normalizeText(payload.genre, post.genre),
            hostName: normalizeText(payload.hostName, post.hostName),
            summary: normalizeText(payload.summary, post.summary),
            location: normalizeText(payload.location, post.location),
            region: normalizeRegion(payload.region ?? post.region),
            meetingType: normalizeMeetingType(payload.meetingType ?? post.meetingType),
            status: normalizeStatus(payload.status ?? post.status),
            wantedRoles: normalizeRoles(payload.wantedRoles ?? post.wantedRoles),
            tags: normalizeTags(payload.tags ?? post.tags),
            currentMembers: Math.max(1, Number(payload.currentMembers) || post.currentMembers),
            maxMembers: Math.max(1, Number(payload.maxMembers) || post.maxMembers),
            schedule: normalizeText(payload.schedule, post.schedule),
            urgent:
              typeof payload.urgent === 'boolean' ? payload.urgent : Boolean(post.urgent),
            updatedAt: Date.now(),
          }
        : post
    ),
  };
  saveState();

  return {
    snapshot: getSessionRecruitSnapshot(),
  };
}

export function deleteSessionRecruitPost(postId, userEmail) {
  const target = findPostOrThrow(postId);
  const normalizedUserEmail = normalizeEmail(userEmail);

  if (!normalizedUserEmail || normalizedUserEmail !== normalizeEmail(target.hostEmail)) {
    throw createHttpError(403, '이 모집글을 삭제할 권한이 없습니다.');
  }

  state = {
    ...state,
    posts: state.posts.filter((post) => post.id !== postId),
  };
  saveState();

  return {
    snapshot: getSessionRecruitSnapshot(),
  };
}
