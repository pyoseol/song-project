import { create } from 'zustand';
import type { SongProject } from './songStore';

export type CollabStatus = 'planning' | 'working' | 'feedback';
export type CollabRole = 'owner' | 'editor' | 'viewer';
export type CollabConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export type CollabMember = {
  email: string;
  name: string;
  role: CollabRole;
  joinedAt: number;
};

export type CollabProject = {
  id: string;
  title: string;
  summary: string;
  genre: string;
  bpm: number;
  steps: number;
  status: CollabStatus;
  createdAt: number;
  updatedAt: number;
  ownerEmail: string;
  ownerName: string;
  sourceProjectId: string | null;
  snapshot?: SongProject;
  snapshotRevision: number;
  snapshotUpdatedByEmail: string | null;
  snapshotUpdatedBySessionId: string | null;
  members: CollabMember[];
  tags: string[];
};

export type CollabMessage = {
  id: string;
  projectId: string;
  authorEmail: string;
  authorName: string;
  content: string;
  createdAt: number;
};

export type CollabTask = {
  id: string;
  projectId: string;
  content: string;
  completed: boolean;
  assigneeName: string;
  createdAt: number;
};

export type CollabPresence = {
  sessionId: string;
  projectId: string;
  email: string;
  name: string;
  focus?: string;
  lastSeenAt: number;
};

export type CollabComposerInstrument = 'melody' | 'drums' | 'bass';

export type CollabComposerLock = {
  projectId: string;
  instrument: CollabComposerInstrument;
  barIndex: number;
  sessionId: string;
  email: string;
  name: string;
  lockedAt: number;
  expiresAt: number;
};

export type CollabComposerHistoryEntry = {
  id: string;
  projectId: string;
  instrument: CollabComposerInstrument | 'transport';
  barIndex: number | null;
  authorEmail: string;
  authorName: string;
  action: string;
  summary: string;
  createdAt: number;
  revision: number;
};

type CreateCollabFromComposerPayload = {
  sourceProjectId: string;
  title: string;
  summary: string;
  genre: string;
  bpm: number;
  steps: number;
  ownerEmail: string;
  ownerName: string;
  snapshot: SongProject;
  sessionId?: string;
};

type CollabSnapshot = {
  version: number;
  projects: CollabProject[];
  messages: CollabMessage[];
  tasks: CollabTask[];
  presenceByProject: Record<string, CollabPresence[]>;
  composerLocksByProject: Record<string, CollabComposerLock[]>;
  composerHistoryByProject: Record<string, CollabComposerHistoryEntry[]>;
};

type UpdateComposerPayload = {
  snapshot: SongProject;
  email: string;
  name: string;
  sessionId?: string;
  baseRevision?: number;
};

export type CollabComposerOperation =
  | {
      type: 'set-melody-note';
      row: number;
      col: number;
      length: number;
      barIndex: number;
    }
  | {
      type: 'toggle-drum-step';
      row: number;
      col: number;
      nextValue: boolean;
      barIndex: number;
    }
  | {
      type: 'toggle-bass-step';
      row: number;
      col: number;
      nextValue: boolean;
      barIndex: number;
    }
  | {
      type: 'apply-chord';
      chord: string;
      col: number;
      isBass: boolean;
      rows: number[];
      barIndex: number;
    }
  | {
      type: 'set-volume';
      instrument: CollabComposerInstrument;
      volume: number;
    };

type ApplyComposerOperationPayload = {
  operation: CollabComposerOperation;
  email: string;
  name: string;
  sessionId?: string;
  baseRevision?: number;
};

type ComposerLockPayload = {
  instrument: CollabComposerInstrument;
  barIndex: number;
  email?: string;
  name?: string;
  sessionId?: string;
  lock: boolean;
};

type CollabState = {
  version: number;
  projects: CollabProject[];
  messages: CollabMessage[];
  tasks: CollabTask[];
  presenceByProject: Record<string, CollabPresence[]>;
  composerLocksByProject: Record<string, CollabComposerLock[]>;
  composerHistoryByProject: Record<string, CollabComposerHistoryEntry[]>;
  connectionStatus: CollabConnectionStatus;
  connectionError: string | null;
  initializeRealtime: () => Promise<void>;
  createFromComposerProject: (payload: CreateCollabFromComposerPayload) => Promise<string>;
  joinProject: (projectId: string, payload: { email: string; name: string }) => Promise<void>;
  addMessage: (
    projectId: string,
    payload: { email: string; name: string; content: string }
  ) => Promise<void>;
  addTask: (projectId: string, payload: { content: string; assigneeName: string }) => Promise<void>;
  toggleTask: (projectId: string, taskId: string) => Promise<void>;
  setStatus: (projectId: string, status: CollabStatus) => Promise<void>;
  updateComposerSnapshot: (projectId: string, payload: UpdateComposerPayload) => Promise<number>;
  applyComposerOperation: (
    projectId: string,
    payload: ApplyComposerOperationPayload
  ) => Promise<number>;
  setComposerLock: (projectId: string, payload: ComposerLockPayload) => Promise<void>;
  touchPresence: (
    projectId: string,
    payload: { email: string; name: string; focus?: string }
  ) => Promise<void>;
  leavePresence: (projectId: string) => Promise<void>;
};

export const COLLAB_PRESENCE_TIMEOUT_MS = 20_000;
export const COLLAB_PRESENCE_PING_INTERVAL_MS = 8_000;

const DEFAULT_COLLAB_SERVER_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8788`
    : 'http://localhost:8788';

const COLLAB_SERVER_URL =
  (import.meta.env.VITE_COLLAB_SERVER_URL as string | undefined) ??
  DEFAULT_COLLAB_SERVER_URL;

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId
    ? `${prefix}-${randomId}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const COLLAB_SESSION_ID = createId('collab-session');

export class CollabRequestError extends Error {
  statusCode: number;
  payload: unknown;

  constructor(statusCode: number, message: string, payload?: unknown) {
    super(message);
    this.name = 'CollabRequestError';
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

async function fetchCollabJson<T>(path: string, init?: RequestInit) {
  let response: Response;

  try {
    response = await fetch(`${COLLAB_SERVER_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error(
      '협업 서버에 연결하지 못했습니다. `npm.cmd run dev` 또는 `npm.cmd run collab:server`가 실행 중인지 확인해주세요.'
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new CollabRequestError(
      response.status,
      payload?.error || '협업 서버 요청이 실패했습니다.',
      payload
    );
  }

  return (await response.json()) as T;
}

function applySnapshot(snapshot: CollabSnapshot) {
  useCollabStore.setState((state) => ({
    ...state,
    version: snapshot.version,
    projects: snapshot.projects,
    messages: snapshot.messages,
    tasks: snapshot.tasks,
    presenceByProject: snapshot.presenceByProject,
    composerLocksByProject: snapshot.composerLocksByProject ?? {},
    composerHistoryByProject: snapshot.composerHistoryByProject ?? {},
    connectionStatus: 'connected',
    connectionError: null,
  }));
}

let collabEventSource: EventSource | null = null;
let initPromise: Promise<void> | null = null;

export const useCollabStore = create<CollabState>((set) => ({
  version: 0,
  projects: [],
  messages: [],
  tasks: [],
  presenceByProject: {},
  composerLocksByProject: {},
  composerHistoryByProject: {},
  connectionStatus: 'idle',
  connectionError: null,
  initializeRealtime: async () => {
    if (typeof window === 'undefined') {
      return;
    }

    if (initPromise) {
      return initPromise;
    }

    set((state) => ({
      ...state,
      connectionStatus: 'connecting',
      connectionError: null,
    }));

    initPromise = (async () => {
      try {
        const snapshot = await fetchCollabJson<CollabSnapshot>('/api/collab/bootstrap');
        applySnapshot(snapshot);

        if (!collabEventSource) {
          collabEventSource = new EventSource(`${COLLAB_SERVER_URL}/api/collab/stream`);

          collabEventSource.addEventListener('snapshot', (event) => {
            const message = event as MessageEvent<string>;
            const nextSnapshot = JSON.parse(message.data) as CollabSnapshot;
            applySnapshot(nextSnapshot);
          });

          collabEventSource.onerror = () => {
            useCollabStore.setState((state) => ({
              ...state,
              connectionStatus: 'error',
              connectionError:
                '협업 서버 연결이 끊겼습니다. 실시간 서버가 실행 중인지 확인해주세요.',
            }));
          };

          collabEventSource.onopen = () => {
            useCollabStore.setState((state) => ({
              ...state,
              connectionStatus: 'connected',
              connectionError: null,
            }));
          };
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '협업 서버에 연결하지 못했습니다.';
        useCollabStore.setState((state) => ({
          ...state,
          connectionStatus: 'error',
          connectionError: message,
        }));
        throw error;
      }
    })();

    try {
      await initPromise;
    } finally {
      initPromise = null;
    }
  },
  createFromComposerProject: async (payload) => {
    const response = await fetchCollabJson<{ projectId: string; snapshot: CollabSnapshot }>(
      '/api/collab/projects/from-composer',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    applySnapshot(response.snapshot);
    return response.projectId;
  },
  joinProject: async (projectId, payload) => {
    const response = await fetchCollabJson<{ ok: true; snapshot: CollabSnapshot }>(
      `/api/collab/projects/${projectId}/join`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    applySnapshot(response.snapshot);
  },
  addMessage: async (projectId, payload) => {
    const response = await fetchCollabJson<{ ok: true; snapshot: CollabSnapshot }>(
      `/api/collab/projects/${projectId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    applySnapshot(response.snapshot);
  },
  addTask: async (projectId, payload) => {
    const response = await fetchCollabJson<{ ok: true; snapshot: CollabSnapshot }>(
      `/api/collab/projects/${projectId}/tasks`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );

    applySnapshot(response.snapshot);
  },
  toggleTask: async (projectId, taskId) => {
    const response = await fetchCollabJson<{ ok: true; snapshot: CollabSnapshot }>(
      `/api/collab/projects/${projectId}/tasks/${taskId}/toggle`,
      {
        method: 'POST',
      }
    );

    applySnapshot(response.snapshot);
  },
  setStatus: async (projectId, status) => {
    const response = await fetchCollabJson<{ ok: true; snapshot: CollabSnapshot }>(
      `/api/collab/projects/${projectId}/status`,
      {
        method: 'POST',
        body: JSON.stringify({ status }),
      }
    );

    applySnapshot(response.snapshot);
  },
  updateComposerSnapshot: async (projectId, payload) => {
    try {
      const response = await fetchCollabJson<{
        ok: true;
        revision: number;
        snapshot: CollabSnapshot;
      }>(`/api/collab/projects/${projectId}/composer-snapshot`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      applySnapshot(response.snapshot);
      return response.revision;
    } catch (error) {
      if (error instanceof CollabRequestError && error.statusCode === 409) {
        const conflictSnapshot = (error.payload as { snapshot?: CollabSnapshot } | null)?.snapshot;
        if (conflictSnapshot) {
          applySnapshot(conflictSnapshot);
        }
      }

      throw error;
    }
  },
  applyComposerOperation: async (projectId, payload) => {
    try {
      const response = await fetchCollabJson<{
        ok: true;
        revision: number;
        snapshot: CollabSnapshot;
      }>(`/api/collab/projects/${projectId}/composer-operation`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      applySnapshot(response.snapshot);
      return response.revision;
    } catch (error) {
      if (error instanceof CollabRequestError && error.statusCode === 409) {
        const conflictSnapshot = (error.payload as { snapshot?: CollabSnapshot } | null)?.snapshot;
        if (conflictSnapshot) {
          applySnapshot(conflictSnapshot);
        }
      }

      throw error;
    }
  },
  setComposerLock: async (projectId, payload) => {
    const response = await fetchCollabJson<{ ok: true; snapshot: CollabSnapshot }>(
      `/api/collab/projects/${projectId}/composer-lock`,
      {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          projectId,
          sessionId: payload.sessionId ?? COLLAB_SESSION_ID,
        }),
      }
    );

    applySnapshot(response.snapshot);
  },
  touchPresence: async (projectId, payload) => {
    await fetchCollabJson<{ ok: true }>('/api/collab/presence/ping', {
      method: 'POST',
      body: JSON.stringify({
        ...payload,
        projectId,
        sessionId: COLLAB_SESSION_ID,
      }),
    });
  },
  leavePresence: async (projectId) => {
    await fetchCollabJson<{ ok: true }>('/api/collab/presence/leave', {
      method: 'POST',
      body: JSON.stringify({
        projectId,
        sessionId: COLLAB_SESSION_ID,
      }),
    });
  },
}));
