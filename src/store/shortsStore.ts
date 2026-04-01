import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ShortComment, ShortItem } from '../types/shorts';
import {
  addShortCommentOnServer,
  createShortOnServer,
  deleteShortOnServer,
  fetchShortsBootstrap,
  recordShortViewOnServer,
  toggleShortLikeOnServer,
  updateShortOnServer,
  type ShortsSnapshot,
} from '../utils/shortsApi';

type CreateShortPayload = Omit<
  ShortItem,
  'id' | 'createdAt' | 'likeCount' | 'viewCount' | 'likedBy'
>;

type UpdateShortPayload = Partial<CreateShortPayload> & {
  shortId: string;
  creatorEmail?: string;
};

type AddCommentPayload = {
  shortId: string;
  authorName: string;
  authorEmail: string;
  content: string;
};

type ShortsState = {
  shorts: ShortItem[];
  comments: ShortComment[];
  bootstrapStatus: 'idle' | 'loading' | 'ready' | 'error';
  bootstrapError: string | null;
  seedShorts: (force?: boolean) => Promise<void>;
  applyServerSnapshot: (snapshot: ShortsSnapshot) => void;
  createShort: (payload: CreateShortPayload) => Promise<string>;
  updateShort: (payload: UpdateShortPayload) => Promise<void>;
  deleteShort: (shortId: string, userEmail: string) => Promise<void>;
  toggleLike: (shortId: string, userEmail: string) => Promise<void>;
  addComment: (payload: AddCommentPayload) => Promise<string>;
  recordView: (shortId: string) => Promise<void>;
};

let shortsBootstrapPromise: Promise<void> | null = null;

function applySnapshot(snapshot: ShortsSnapshot) {
  useShortsStore.setState((state) => ({
    ...state,
    shorts: (snapshot.shorts ?? []) as ShortItem[],
    comments: (snapshot.comments ?? []) as ShortComment[],
    bootstrapStatus: 'ready',
    bootstrapError: null,
  }));
}

export const useShortsStore = create<ShortsState>()(
  persist(
    (set, get) => ({
      shorts: [],
      comments: [],
      bootstrapStatus: 'idle',
      bootstrapError: null,
      seedShorts: async (force = false) => {
        if (!force && get().bootstrapStatus === 'ready') {
          return;
        }

        if (!force && shortsBootstrapPromise) {
          return shortsBootstrapPromise;
        }

        set((state) => ({
          ...state,
          bootstrapStatus: 'loading',
          bootstrapError: null,
        }));

        const nextPromise = fetchShortsBootstrap()
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
                  : '숏폼 데이터를 서버에서 불러오지 못했습니다.',
            }));
            throw error;
          })
          .finally(() => {
            shortsBootstrapPromise = null;
          });

        shortsBootstrapPromise = nextPromise;
        return nextPromise;
      },
      applyServerSnapshot: (snapshot) => {
        applySnapshot(snapshot);
      },
      createShort: async (payload) => {
        const response = await createShortOnServer(payload as unknown as Record<string, unknown>);
        applySnapshot(response.snapshot);
        return response.shortId;
      },
      updateShort: async ({ shortId, ...payload }) => {
        const response = await updateShortOnServer({
          shortId,
          ...payload,
        } as Record<string, unknown> & { shortId: string });
        applySnapshot(response.snapshot);
      },
      deleteShort: async (shortId, userEmail) => {
        const response = await deleteShortOnServer({ shortId, userEmail });
        applySnapshot(response.snapshot);
      },
      toggleLike: async (shortId, userEmail) => {
        const response = await toggleShortLikeOnServer({ shortId, userEmail });
        applySnapshot(response.snapshot);
      },
      addComment: async ({ shortId, authorName, authorEmail, content }) => {
        const response = await addShortCommentOnServer({
          shortId,
          authorName,
          authorEmail,
          content,
        });
        applySnapshot(response.snapshot);
        return '';
      },
      recordView: async (shortId) => {
        const response = await recordShortViewOnServer({ shortId });
        applySnapshot(response.snapshot);
      },
    }),
    {
      name: 'song-maker-shorts',
      partialize: (state) => ({
        shorts: state.shorts,
        comments: state.comments,
      }),
    }
  )
);
