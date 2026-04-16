import { create } from 'zustand';
import type { SongProject } from './songStore';
import { useSongStore, buildSongProjectSnapshot } from './songStore'; 
import { db } from '../firebase'; 
import { 
  collection, doc, setDoc, updateDoc, deleteDoc, getDoc, onSnapshot, increment, arrayUnion 
} from 'firebase/firestore';

// ============================================================================
// 🔥 0. 기존 Composer.tsx 호환용 에러 클래스 (Error 1, 2, 3 해결)
// ============================================================================
export class CollabRequestError extends Error {
  statusCode: number;
  payload?: any;
  constructor(message: string, statusCode: number = 500, payload?: any) {
    super(message);
    this.name = 'CollabRequestError';
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

// ============================================================================
// 1. 타입 정의
// ============================================================================
export type CollabStatus = 'planning' | 'working' | 'feedback';
export type CollabRole = 'owner' | 'editor' | 'viewer';
export type CollabConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export type CollabMember = { email: string; name: string; role: CollabRole; joinedAt: number; };
export type CollabProject = {
  id: string; title: string; summary: string; genre: string; bpm: number; steps: number;
  status: CollabStatus; createdAt: number; updatedAt: number; ownerEmail: string; ownerName: string;
  sourceProjectId: string | null; snapshot?: SongProject; snapshotRevision: number;
  snapshotUpdatedByEmail: string | null; snapshotUpdatedBySessionId: string | null;
  members: CollabMember[]; tags: string[];
};
export type CollabMessage = { id: string; projectId: string; authorEmail: string; authorName: string; content: string; createdAt: number; };
export type CollabTask = { id: string; projectId: string; content: string; completed: boolean; assigneeName: string; createdAt: number; };
export type CollabPresence = { sessionId: string; projectId: string; email: string; name: string; focus?: string; lastSeenAt: number; };
export type CollabComposerInstrument = 'melody' | 'guitar' | 'drums' | 'bass';
export type CollabComposerLock = { projectId: string; instrument: CollabComposerInstrument; barIndex: number; sessionId: string; email: string; name: string; lockedAt: number; expiresAt: number; };
export type CollabComposerHistoryEntry = { id: string; projectId: string; instrument: CollabComposerInstrument | 'transport'; barIndex: number | null; authorEmail: string; authorName: string; action: string; summary: string; createdAt: number; revision: number; };

type CreateCollabFromComposerPayload = { sourceProjectId: string; title: string; summary: string; genre: string; bpm: number; steps: number; ownerEmail: string; ownerName: string; snapshot: SongProject; sessionId?: string; };
type UpdateComposerPayload = { snapshot: SongProject; email: string; name: string; sessionId?: string; baseRevision?: number; };
export type CollabComposerOperation = 
  | { type: 'set-melody-note'; row: number; col: number; length: number; barIndex: number; }
  | { type: 'toggle-guitar-step'; row: number; col: number; nextValue: boolean; barIndex: number; }
  | { type: 'toggle-drum-step'; row: number; col: number; nextValue: boolean; barIndex: number; }
  | { type: 'toggle-bass-step'; row: number; col: number; nextValue: boolean; barIndex: number; }
  | { type: 'apply-chord'; chord: string; col: number; isBass: boolean; rows: number[]; barIndex: number; }
  | { type: 'set-volume'; instrument: CollabComposerInstrument; volume: number; };

type ApplyComposerOperationPayload = { operation: CollabComposerOperation; email: string; name: string; sessionId?: string; baseRevision?: number; };
type ComposerLockPayload = { instrument: CollabComposerInstrument; barIndex: number; email?: string; name?: string; sessionId?: string; lock: boolean; };

type CollabState = {
  version: number; projects: CollabProject[]; messages: CollabMessage[]; tasks: CollabTask[];
  presenceByProject: Record<string, CollabPresence[]>; composerLocksByProject: Record<string, CollabComposerLock[]>; composerHistoryByProject: Record<string, CollabComposerHistoryEntry[]>;
  connectionStatus: CollabConnectionStatus; connectionError: string | null;
  initializeRealtime: () => Promise<void>;
  createFromComposerProject: (payload: CreateCollabFromComposerPayload) => Promise<string>;
  joinProject: (projectId: string, payload: { email: string; name: string }) => Promise<void>;
  addMessage: (projectId: string, payload: { email: string; name: string; content: string }) => Promise<void>;
  addTask: (projectId: string, payload: { content: string; assigneeName: string }) => Promise<void>;
  toggleTask: (projectId: string, taskId: string) => Promise<void>;
  setStatus: (projectId: string, status: CollabStatus) => Promise<void>;
  updateComposerSnapshot: (projectId: string, payload: UpdateComposerPayload) => Promise<number>;
  applyComposerOperation: (projectId: string, payload: ApplyComposerOperationPayload) => Promise<number>;
  setComposerLock: (projectId: string, payload: ComposerLockPayload) => Promise<void>;
  touchPresence: (projectId: string, payload: { email: string; name: string; focus?: string }) => Promise<void>;
  leavePresence: (projectId: string) => Promise<void>;

  deleteProject: (projectId: string) => Promise<void>;
};

export const COLLAB_PRESENCE_TIMEOUT_MS = 20_000;
export const COLLAB_PRESENCE_PING_INTERVAL_MS = 8_000;

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId ? `${prefix}-${randomId}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const COLLAB_SESSION_ID = createId('collab-session');

// ============================================================================
// 🔥 2. 파이어베이스 2차원 배열 에러 방지용 "마법의 번역기"
// ============================================================================
function sanitizeForFirestore(data: any): any {
  if (Array.isArray(data)) {
    if (data.some(Array.isArray)) return { _isSerializedArray: true, data: JSON.stringify(data) };
    return data.map(sanitizeForFirestore);
  } else if (data !== null && typeof data === 'object') {
    const res: any = {};
    for (const key of Object.keys(data)) res[key] = sanitizeForFirestore(data[key]);
    return res;
  }
  return data;
}

// 꺼낼 때: 포장된 문자열을 발견하면 원래의 2차원 배열로 완벽하게 복구합니다.
function restoreFromFirestore(data: any): any {
  // ★ 수정됨: 배열(Array)인지 가장 먼저 확인해야 합니다!
  if (Array.isArray(data)) {
    return data.map(restoreFromFirestore);
  } 
  // 그 다음 일반 객체(Object)인지 확인합니다.
  else if (data !== null && typeof data === 'object') {
    if (data._isSerializedArray) {
      try {
        return JSON.parse(data.data);
      } catch (e) {
        return [];
      }
    }
    const res: any = {};
    for (const key of Object.keys(data)) {
      res[key] = restoreFromFirestore(data[key]);
    }
    return res;
  }
  return data;
}

// ============================================================================
// 🔥 3. 파이어베이스 실시간 스토어 구현
// ============================================================================
let unsubscribes: (() => void)[] = [];

// ✅ Error 4 해결: get 변수를 제거했습니다.
export const useCollabStore = create<CollabState>((set) => ({
  version: 0, projects: [], messages: [], tasks: [], presenceByProject: {}, composerLocksByProject: {}, composerHistoryByProject: {},
  connectionStatus: 'idle', connectionError: null,

  initializeRealtime: async () => {
    if (typeof window === 'undefined' || unsubscribes.length > 0) return;
    set({ connectionStatus: 'connecting', connectionError: null });

    try {
      unsubscribes.push(onSnapshot(collection(db, 'collab_projects'), (snap) => {
        const projects = snap.docs.map(d => restoreFromFirestore({ id: d.id, ...d.data() }));
        set({ projects, connectionStatus: 'connected' });
      }));

      unsubscribes.push(onSnapshot(collection(db, 'collab_messages'), (snap) => {
        const messages = snap.docs.map(d => ({ id: d.id, ...d.data() } as CollabMessage));
        set({ messages });
      }));

      unsubscribes.push(onSnapshot(collection(db, 'collab_tasks'), (snap) => {
        const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as CollabTask));
        set({ tasks });
      }));

      unsubscribes.push(onSnapshot(collection(db, 'collab_presence'), (snap) => {
        const presenceList = snap.docs.map(d => d.data() as CollabPresence);
        const presenceByProject: Record<string, CollabPresence[]> = {};
        presenceList.forEach(p => {
          if (!presenceByProject[p.projectId]) presenceByProject[p.projectId] = [];
          presenceByProject[p.projectId].push(p);
        });
        set({ presenceByProject });
      }));

      unsubscribes.push(onSnapshot(collection(db, 'collab_locks'), (snap) => {
        const locksList = snap.docs.map(d => d.data() as CollabComposerLock);
        const composerLocksByProject: Record<string, CollabComposerLock[]> = {};
        locksList.forEach(l => {
          if (!composerLocksByProject[l.projectId]) composerLocksByProject[l.projectId] = [];
          composerLocksByProject[l.projectId].push(l);
        });
        set({ composerLocksByProject });
      }));

    } catch (error) {
      set({ connectionStatus: 'error', connectionError: '파이어베이스 실시간 연결에 실패했습니다.' });
    }
  },

  createFromComposerProject: async (payload) => {
    const projectId = doc(collection(db, 'collab_projects')).id;
    const newProject = {
      id: projectId, title: payload.title, summary: payload.summary, genre: payload.genre, bpm: payload.bpm, steps: payload.steps,
      status: 'planning', createdAt: Date.now(), updatedAt: Date.now(), ownerEmail: payload.ownerEmail, ownerName: payload.ownerName,
      sourceProjectId: payload.sourceProjectId, snapshotRevision: 1, snapshotUpdatedByEmail: payload.ownerEmail, snapshotUpdatedBySessionId: payload.sessionId || COLLAB_SESSION_ID,
      members: [{ email: payload.ownerEmail, name: payload.ownerName, role: 'owner', joinedAt: Date.now() }], tags: [],
      snapshot: sanitizeForFirestore(payload.snapshot)
    };
    await setDoc(doc(db, 'collab_projects', projectId), newProject);
    return projectId;
  },

  joinProject: async (projectId, payload) => {
    await updateDoc(doc(db, 'collab_projects', projectId), {
      members: arrayUnion({ email: payload.email, name: payload.name, role: 'editor', joinedAt: Date.now() })
    });
  },

  addMessage: async (projectId, payload) => {
    const msgRef = doc(collection(db, 'collab_messages'));
    await setDoc(msgRef, { id: msgRef.id, projectId, authorEmail: payload.email, authorName: payload.name, content: payload.content, createdAt: Date.now() });
  },

  addTask: async (projectId, payload) => {
    const taskRef = doc(collection(db, 'collab_tasks'));
    await setDoc(taskRef, { id: taskRef.id, projectId, content: payload.content, completed: false, assigneeName: payload.assigneeName, createdAt: Date.now() });
  },

  // ✅ Error 5 해결: 사용하지 않는 projectId에 밑줄(_)을 추가해 경고를 무시합니다.
  toggleTask: async (_projectId, taskId) => {
    const taskRef = doc(db, 'collab_tasks', taskId);
    const snap = await getDoc(taskRef);
    if (snap.exists()) await updateDoc(taskRef, { completed: !snap.data().completed });
  },

  setStatus: async (projectId, status) => {
    await updateDoc(doc(db, 'collab_projects', projectId), { status, updatedAt: Date.now() });
  },

  updateComposerSnapshot: async (projectId, payload) => {
    await updateDoc(doc(db, 'collab_projects', projectId), {
      snapshot: sanitizeForFirestore(payload.snapshot),
      snapshotRevision: increment(1),
      snapshotUpdatedByEmail: payload.email,
      snapshotUpdatedBySessionId: payload.sessionId || COLLAB_SESSION_ID,
      updatedAt: Date.now()
    });
    return 1;
  },

  applyComposerOperation: async (projectId, payload) => {
    const currentSongState = useSongStore.getState();
    const currentSnapshot = buildSongProjectSnapshot(currentSongState);
    if (currentSnapshot) {
      await updateDoc(doc(db, 'collab_projects', projectId), {
        snapshot: sanitizeForFirestore(currentSnapshot),
        snapshotRevision: increment(1),
        snapshotUpdatedByEmail: payload.email,
        updatedAt: Date.now()
      });
    }
    return 1;
  },

  setComposerLock: async (projectId, payload) => {
    const lockId = `${projectId}_${payload.instrument}_${payload.sessionId || COLLAB_SESSION_ID}`;
    const lockRef = doc(db, 'collab_locks', lockId);
    if (payload.lock) {
      await setDoc(lockRef, {
        projectId, instrument: payload.instrument, barIndex: payload.barIndex, sessionId: payload.sessionId || COLLAB_SESSION_ID,
        email: payload.email || '', name: payload.name || '', lockedAt: Date.now(), expiresAt: Date.now() + 60000
      });
    } else {
      await deleteDoc(lockRef);
    }
  },

  touchPresence: async (projectId, payload) => {
    const presenceId = `${projectId}_${COLLAB_SESSION_ID}`;
    await setDoc(doc(db, 'collab_presence', presenceId), {
      projectId, sessionId: COLLAB_SESSION_ID, email: payload.email, name: payload.name, focus: payload.focus || '', lastSeenAt: Date.now()
    }, { merge: true });
  },

  leavePresence: async (projectId) => {
    const presenceId = `${projectId}_${COLLAB_SESSION_ID}`;
    await deleteDoc(doc(db, 'collab_presence', presenceId));
  },

  deleteProject: async (projectId) => {
    await deleteDoc(doc(db, 'collab_projects', projectId));
  },
  
}));
