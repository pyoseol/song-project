import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SessionRecruitPost } from '../types/sessionRecruit';
import {
  createSessionRecruitPostOnServer,
  deleteSessionRecruitPostOnServer,
  fetchSessionRecruitBootstrap,
  updateSessionRecruitPostOnServer,
  type CreateSessionRecruitPayload,
  type SessionRecruitSnapshot,
  type UpdateSessionRecruitPayload,
} from '../utils/sessionRecruitApi';

type SessionRecruitStoreState = {
  posts: SessionRecruitPost[];
  bootstrapStatus: 'idle' | 'loading' | 'ready' | 'error';
  bootstrapError: string | null;
  seedSessionRecruit: (force?: boolean) => Promise<void>;
  applyServerSnapshot: (snapshot: SessionRecruitSnapshot) => void;
  createPost: (payload: CreateSessionRecruitPayload) => Promise<string>;
  updatePost: (payload: UpdateSessionRecruitPayload) => Promise<void>;
  deletePost: (postId: string, userEmail: string) => Promise<void>;
};

let sessionRecruitBootstrapPromise: Promise<void> | null = null;

function applySnapshot(snapshot: SessionRecruitSnapshot) {
  useSessionRecruitStore.setState((state) => ({
    ...state,
    posts: snapshot.posts ?? [],
    bootstrapStatus: 'ready',
    bootstrapError: null,
  }));
}

export const useSessionRecruitStore = create<SessionRecruitStoreState>()(
  persist(
    (set, get) => ({
      posts: [],
      bootstrapStatus: 'idle',
      bootstrapError: null,
      seedSessionRecruit: async (force = false) => {
        if (!force && get().bootstrapStatus === 'ready') {
          return;
        }

        if (!force && sessionRecruitBootstrapPromise) {
          return sessionRecruitBootstrapPromise;
        }

        set((state) => ({
          ...state,
          bootstrapStatus: 'loading',
          bootstrapError: null,
        }));

        const nextPromise = fetchSessionRecruitBootstrap()
          .then((snapshot) => {
            applySnapshot(snapshot);
          })
          .catch((error) => {
            set((state) => ({
              ...state,
              bootstrapStatus: 'error',
              bootstrapError:
                error instanceof Error
                  ? error.message
                  : '세션 모집 데이터를 서버에서 불러오지 못했습니다.',
            }));
            throw error;
          })
          .finally(() => {
            sessionRecruitBootstrapPromise = null;
          });

        sessionRecruitBootstrapPromise = nextPromise;
        return nextPromise;
      },
      applyServerSnapshot: (snapshot) => {
        applySnapshot(snapshot);
      },
      createPost: async (payload) => {
        const response = await createSessionRecruitPostOnServer(payload);
        applySnapshot(response.snapshot);
        return response.postId;
      },
      updatePost: async (payload) => {
        const response = await updateSessionRecruitPostOnServer(payload);
        applySnapshot(response.snapshot);
      },
      deletePost: async (postId, userEmail) => {
        const response = await deleteSessionRecruitPostOnServer({ postId, userEmail });
        applySnapshot(response.snapshot);
      },
    }),
    {
      name: 'song-maker-session-recruit',
      partialize: (state) => ({
        posts: state.posts,
      }),
    }
  )
);
