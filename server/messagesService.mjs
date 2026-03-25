import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthServiceError } from './authService.mjs';
import { getSqlDriver, loadSqlState, saveSqlState } from './sqliteState.mjs';
import { loadMessagesMysqlState, saveMessagesMysqlState } from './mysqlTables.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MESSAGES_LEGACY_DATA_PATH = join(__dirname, 'messages-data.json');

const SUGGESTED_FRIENDS = [
  { name: 'loopmaker', email: 'loopmaker@songmaker.dev' },
  { name: 'groovepark', email: 'groovepark@songmaker.dev' },
  { name: 'chordnote', email: 'chordnote@songmaker.dev' },
  { name: 'beatnova', email: 'beatnova@songmaker.dev' },
  { name: 'arranger', email: 'arranger@songmaker.dev' },
];

const SAMPLE_DIRECT_CONTACTS = [
  {
    name: 'loopmaker',
    email: 'loopmaker@songmaker.dev',
    opener: '이번 벌스 아이디어가 좋아서 메시지 남겼어요. 같이 한 번 정리해보면 좋을 것 같아요.',
    reply: '좋아요. 오늘 저녁에 버전 하나 더 올려볼게요.',
    createdAt: new Date('2026-03-22T19:20:00+09:00').getTime(),
  },
  {
    name: 'groovepark',
    email: 'groovepark@songmaker.dev',
    opener: '베이스 라인이 좋아서 메시지 보냈어요. 협업도 열려 있나요?',
    reply: '네. 이번 주 안에 정리해서 같이 들어보면 좋겠어요.',
    createdAt: new Date('2026-03-21T15:45:00+09:00').getTime(),
  },
];

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSeedState() {
  return {
    friendsByEmail: {},
    threads: [],
    messagesByThread: {},
  };
}

async function loadLegacyState() {
  return await loadSqlState('messages', createSeedState, {
    legacyFilePath: MESSAGES_LEGACY_DATA_PATH,
    normalize: (parsed) => ({
      friendsByEmail:
        parsed && typeof parsed.friendsByEmail === 'object' && parsed.friendsByEmail
          ? parsed.friendsByEmail
          : {},
      threads: Array.isArray(parsed.threads) ? parsed.threads : [],
      messagesByThread:
        parsed && typeof parsed.messagesByThread === 'object' && parsed.messagesByThread
          ? parsed.messagesByThread
          : {},
    }),
  });
}

async function loadState() {
  if (getSqlDriver() === 'mysql') {
    return await loadMessagesMysqlState(loadLegacyState);
  }

  return await loadLegacyState();
}

let state = await loadState();

function saveState() {
  if (getSqlDriver() === 'mysql') {
    saveMessagesMysqlState(state);
    return;
  }

  saveSqlState('messages', state);
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeName(name, email) {
  const trimmed = String(name || '').trim();
  if (trimmed) {
    return trimmed.slice(0, 24);
  }

  const [localPart] = normalizeEmail(email).split('@');
  return localPart || 'mate';
}

function normalizeFriend(friendName, friendEmail) {
  const email = normalizeEmail(friendEmail);
  return {
    name: normalizeName(friendName, email),
    email,
  };
}

function assertOwnerEmail(ownerEmail) {
  const email = normalizeEmail(ownerEmail);
  if (!email) {
    throw new AuthServiceError(400, '메시지 데이터를 불러올 이메일이 필요합니다.');
  }

  return email;
}

function createSnapshot(ownerEmail) {
  const threads = state.threads
    .filter((thread) => thread.ownerEmail === ownerEmail)
    .sort((left, right) => right.lastMessageAt - left.lastMessageAt);

  return {
    friends: state.friendsByEmail[ownerEmail] ?? [],
    threads,
    messagesByThread: Object.fromEntries(
      threads.map((thread) => [thread.id, state.messagesByThread[thread.id] ?? []])
    ),
  };
}

function ensureSeedInbox(ownerEmail, ownerName) {
  let changed = false;

  if (!state.friendsByEmail[ownerEmail]?.length) {
    state = {
      ...state,
      friendsByEmail: {
        ...state.friendsByEmail,
        [ownerEmail]: SUGGESTED_FRIENDS.slice(0, 3),
      },
    };
    changed = true;
  }

  const existingThreads = state.threads.filter((thread) => thread.ownerEmail === ownerEmail);

  if (!existingThreads.length) {
    const directEntries = SAMPLE_DIRECT_CONTACTS.map((contact) => {
      const threadId = createId('thread');
      return {
        thread: {
          id: threadId,
          ownerEmail,
          type: 'direct',
          title: contact.name,
          participantName: contact.name,
          participantEmail: contact.email,
          members: [
            { name: ownerName, email: ownerEmail },
            { name: contact.name, email: contact.email },
          ],
          lastMessageAt: contact.createdAt + 1000 * 60 * 18,
          lastPreview: contact.reply,
        },
        messages: [
          {
            id: createId('message'),
            threadId,
            authorName: contact.name,
            authorEmail: contact.email,
            content: contact.opener,
            createdAt: contact.createdAt,
            isRead: false,
          },
          {
            id: createId('message'),
            threadId,
            authorName: ownerName,
            authorEmail: ownerEmail,
            content: contact.reply,
            createdAt: contact.createdAt + 1000 * 60 * 18,
            isRead: true,
          },
        ],
      };
    });

    const groupThreadId = createId('thread');
    const groupCreatedAt = new Date('2026-03-20T21:10:00+09:00').getTime();
    const groupEntry = {
      thread: {
        id: groupThreadId,
        ownerEmail,
        type: 'group',
        title: 'Weekend Jam Crew',
        members: [
          { name: ownerName, email: ownerEmail },
          { name: 'loopmaker', email: 'loopmaker@songmaker.dev' },
          { name: 'groovepark', email: 'groovepark@songmaker.dev' },
        ],
        lastMessageAt: groupCreatedAt + 1000 * 60 * 30,
        lastPreview: '이번 후렴 훅 같이 정리해봐요.',
      },
      messages: [
        {
          id: createId('message'),
          threadId: groupThreadId,
          authorName: 'loopmaker',
          authorEmail: 'loopmaker@songmaker.dev',
          content: '이번 주말에는 후렴 훅 먼저 같이 정리해보면 좋겠어요.',
          createdAt: groupCreatedAt,
          isRead: false,
        },
        {
          id: createId('message'),
          threadId: groupThreadId,
          authorName: ownerName,
          authorEmail: ownerEmail,
          content: '좋아요. 코드랑 멜로디 먼저 정리해둘게요.',
          createdAt: groupCreatedAt + 1000 * 60 * 12,
          isRead: true,
        },
        {
          id: createId('message'),
          threadId: groupThreadId,
          authorName: 'groovepark',
          authorEmail: 'groovepark@songmaker.dev',
          content: '이번 후렴 훅 같이 정리해봐요.',
          createdAt: groupCreatedAt + 1000 * 60 * 30,
          isRead: false,
        },
      ],
    };

    state = {
      ...state,
      threads: [...directEntries.map((entry) => entry.thread), groupEntry.thread, ...state.threads],
      messagesByThread: {
        ...Object.fromEntries(
          [...directEntries, groupEntry].map((entry) => [entry.thread.id, entry.messages])
        ),
        ...state.messagesByThread,
      },
    };
    changed = true;
  }

  if (changed) {
    saveState();
  }
}

export function getMessagesBootstrap(payload) {
  const ownerEmail = assertOwnerEmail(payload.ownerEmail);
  const ownerName = normalizeName(payload.ownerName, ownerEmail);
  ensureSeedInbox(ownerEmail, ownerName);
  return createSnapshot(ownerEmail);
}

export function addFriend(payload) {
  const ownerEmail = assertOwnerEmail(payload.ownerEmail);
  const friend = normalizeFriend(payload.friendName, payload.friendEmail);

  if (!friend.email || friend.email === ownerEmail) {
    throw new AuthServiceError(400, '올바른 친구 정보를 입력해주세요.');
  }

  ensureSeedInbox(ownerEmail, payload.ownerName || ownerEmail);
  const currentFriends = state.friendsByEmail[ownerEmail] ?? [];

  if (currentFriends.some((entry) => entry.email === friend.email)) {
    return createSnapshot(ownerEmail);
  }

  state = {
    ...state,
    friendsByEmail: {
      ...state.friendsByEmail,
      [ownerEmail]: [...currentFriends, friend].sort((left, right) =>
        left.name.localeCompare(right.name, 'ko-KR')
      ),
    },
  };
  saveState();

  return createSnapshot(ownerEmail);
}

export function removeFriend(payload) {
  const ownerEmail = assertOwnerEmail(payload.ownerEmail);
  ensureSeedInbox(ownerEmail, payload.ownerName || ownerEmail);

  state = {
    ...state,
    friendsByEmail: {
      ...state.friendsByEmail,
      [ownerEmail]: (state.friendsByEmail[ownerEmail] ?? []).filter(
        (friend) => friend.email !== normalizeEmail(payload.friendEmail)
      ),
    },
  };
  saveState();

  return createSnapshot(ownerEmail);
}

export function createDirectThread(payload) {
  const ownerEmail = assertOwnerEmail(payload.ownerEmail);
  const participant = normalizeFriend(payload.participantName, payload.participantEmail);
  const ownerName = normalizeName(payload.ownerName, ownerEmail);

  ensureSeedInbox(ownerEmail, ownerName);

  const existingThread = state.threads.find(
    (thread) =>
      thread.ownerEmail === ownerEmail &&
      thread.type === 'direct' &&
      thread.participantEmail === participant.email
  );

  if (existingThread) {
    return {
      threadId: existingThread.id,
      snapshot: createSnapshot(ownerEmail),
    };
  }

  const timestamp = Date.now();
  const threadId = createId('thread');
  const openingMessage = String(payload.openingMessage || '').trim();

  state = {
    ...state,
    threads: [
      {
        id: threadId,
        ownerEmail,
        type: 'direct',
        title: participant.name,
        participantName: participant.name,
        participantEmail: participant.email,
        members: [
          { name: ownerName, email: ownerEmail },
          { name: participant.name, email: participant.email },
        ],
        lastMessageAt: timestamp,
        lastPreview: openingMessage || '새 대화를 시작했습니다.',
      },
      ...state.threads,
    ],
    messagesByThread: {
      ...state.messagesByThread,
      [threadId]: openingMessage
        ? [
            {
              id: createId('message'),
              threadId,
              authorName: ownerName,
              authorEmail: ownerEmail,
              content: openingMessage,
              createdAt: timestamp,
              isRead: true,
            },
          ]
        : [],
    },
  };
  saveState();

  return {
    threadId,
    snapshot: createSnapshot(ownerEmail),
  };
}

export function createGroupThread(payload) {
  const ownerEmail = assertOwnerEmail(payload.ownerEmail);
  const ownerName = normalizeName(payload.ownerName, ownerEmail);
  const title = String(payload.title || '').trim();

  if (!title) {
    throw new AuthServiceError(400, '그룹 채팅 이름을 입력해주세요.');
  }

  const members = Array.isArray(payload.members)
    ? payload.members
        .map((member) => normalizeFriend(member?.name, member?.email))
        .filter((member) => member.email && member.email !== ownerEmail)
    : [];

  if (!members.length) {
    throw new AuthServiceError(400, '그룹 채팅에 초대할 친구를 1명 이상 선택해주세요.');
  }

  ensureSeedInbox(ownerEmail, ownerName);

  const timestamp = Date.now();
  const threadId = createId('thread');
  const openingMessage = String(payload.openingMessage || '').trim();

  state = {
    ...state,
    threads: [
      {
        id: threadId,
        ownerEmail,
        type: 'group',
        title,
        members: [{ name: ownerName, email: ownerEmail }, ...members],
        lastMessageAt: timestamp,
        lastPreview: openingMessage || '그룹 채팅을 시작했습니다.',
      },
      ...state.threads,
    ],
    messagesByThread: {
      ...state.messagesByThread,
      [threadId]: openingMessage
        ? [
            {
              id: createId('message'),
              threadId,
              authorName: ownerName,
              authorEmail: ownerEmail,
              content: openingMessage,
              createdAt: timestamp,
              isRead: true,
            },
          ]
        : [],
    },
  };
  saveState();

  return {
    threadId,
    snapshot: createSnapshot(ownerEmail),
  };
}

export function sendMessage(payload) {
  const ownerEmail = assertOwnerEmail(payload.ownerEmail);
  const content = String(payload.content || '').trim();

  if (!content) {
    throw new AuthServiceError(400, '메시지 내용을 입력해주세요.');
  }

  const thread = state.threads.find(
    (entry) => entry.id === payload.threadId && entry.ownerEmail === ownerEmail
  );

  if (!thread) {
    throw new AuthServiceError(404, '대화방을 찾을 수 없습니다.');
  }

  const timestamp = Date.now();

  state = {
    ...state,
    threads: state.threads
      .map((entry) =>
        entry.id === payload.threadId
          ? {
              ...entry,
              lastMessageAt: timestamp,
              lastPreview: content,
            }
          : entry
      )
      .sort((left, right) => right.lastMessageAt - left.lastMessageAt),
    messagesByThread: {
      ...state.messagesByThread,
      [payload.threadId]: [
        ...(state.messagesByThread[payload.threadId] ?? []),
        {
          id: createId('message'),
          threadId: payload.threadId,
          authorName: normalizeName(payload.authorName, ownerEmail),
          authorEmail: ownerEmail,
          content,
          createdAt: timestamp,
          isRead: true,
        },
      ],
    },
  };
  saveState();

  return createSnapshot(ownerEmail);
}

export function markThreadRead(payload) {
  const ownerEmail = assertOwnerEmail(payload.readerEmail);
  const thread = state.threads.find(
    (entry) => entry.id === payload.threadId && entry.ownerEmail === ownerEmail
  );

  if (!thread) {
    throw new AuthServiceError(404, '대화방을 찾을 수 없습니다.');
  }

  state = {
    ...state,
    messagesByThread: {
      ...state.messagesByThread,
      [payload.threadId]: (state.messagesByThread[payload.threadId] ?? []).map((message) =>
        message.authorEmail !== ownerEmail ? { ...message, isRead: true } : message
      ),
    },
  };
  saveState();

  return createSnapshot(ownerEmail);
}
