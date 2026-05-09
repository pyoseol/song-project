import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  addTrackCommentOnServer,
  fetchMusicShareBootstrap,
  recordTrackDownloadOnServer,
  recordTrackOpenOnServer,
  recordTrackViewOnServer,
  toggleTrackLikeOnServer,
  deleteTrackOnServer,
  type MusicShareSnapshot,
} from '../utils/libraryApi';
import type { MusicShareTrackCard } from '../dummy/musicShareLibrary';

export type MusicShareComment = {
  id: string;
  trackId: string;
  authorName: string;
  authorEmail: string;
  content: string;
  createdAt: number;
};

export type MusicShareMetrics = {
  likeCount: number;
  viewCount: number;
  downloadCount: number;
};

type AddTrackCommentPayload = {
  trackId: string;
  authorName: string;
  authorEmail: string;
  content: string;
};

type MusicShareState = {
  tracks: MusicShareTrackCard[];
  likedTrackIdsByUser: Record<string, string[]>;
  recentOpenedTrackIdsByUser: Record<string, string[]>;
  trackMetricsById: Record<string, MusicShareMetrics>;
  comments: MusicShareComment[];
  bootstrapStatus: 'idle' | 'loading' | 'ready' | 'error';
  bootstrapError: string | null;
  seedMusicShare: (force?: boolean) => Promise<void>;
  applyServerSnapshot: (snapshot: MusicShareSnapshot) => void;
  toggleTrackLike: (trackId: string, userEmail: string) => Promise<void>;
  addTrackComment: (payload: AddTrackCommentPayload) => Promise<string>;
  recordTrackView: (trackId: string, userEmail?: string) => Promise<void>;
  recordTrackDownload: (trackId: string, userEmail?: string) => Promise<void>;
  recordTrackOpen: (trackId: string, userEmail: string) => Promise<void>;
  deleteTrack: (trackId: string) => Promise<void>;
};

let musicShareBootstrapPromise: Promise<void> | null = null;

function isBaseTrack(trackId: string) {
  return trackId.startsWith('share-base-');
}

function getLocalMetrics(metrics?: MusicShareMetrics): MusicShareMetrics {
  return {
    likeCount: metrics?.likeCount ?? 0,
    viewCount: metrics?.viewCount ?? 0,
    downloadCount: metrics?.downloadCount ?? 0,
  };
}

function applySnapshot(snapshot: MusicShareSnapshot) {
  useMusicShareStore.setState((state) => ({
    ...state,
    tracks: (snapshot.tracks ?? []) as MusicShareTrackCard[],
    likedTrackIdsByUser: snapshot.likedTrackIdsByUser ?? {},
    recentOpenedTrackIdsByUser: snapshot.recentOpenedTrackIdsByUser ?? {},
    trackMetricsById: (snapshot.trackMetricsById ?? {}) as Record<string, MusicShareMetrics>,
    comments: (snapshot.comments ?? []) as MusicShareComment[],
    bootstrapStatus: 'ready',
    bootstrapError: null,
  }));
}

export const useMusicShareStore = create<MusicShareState>()(
  persist(
    (set, get) => ({
      likedTrackIdsByUser: {},
      tracks: [],
      recentOpenedTrackIdsByUser: {},
      trackMetricsById: {},
      comments: [],
      bootstrapStatus: 'idle',
      bootstrapError: null,
      seedMusicShare: async (force = false) => {
        if (!force && get().bootstrapStatus === 'ready') {
          return;
        }

        if (!force && musicShareBootstrapPromise) {
          return musicShareBootstrapPromise;
        }

        set((state) => ({
          ...state,
          bootstrapStatus: 'loading',
          bootstrapError: null,
        }));

        const nextPromise = fetchMusicShareBootstrap()
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
                  : '음악 공유 데이터를 서버에서 불러오지 못했습니다.',
            }));
            throw error;
          })
          .finally(() => {
            musicShareBootstrapPromise = null;
          });

        musicShareBootstrapPromise = nextPromise;
        return nextPromise;
      },
      applyServerSnapshot: (snapshot) => {
        applySnapshot(snapshot);
      },
      toggleTrackLike: async (trackId, userEmail) => {
        if (isBaseTrack(trackId)) {
          set((state) => {
            const likedTrackIds = state.likedTrackIdsByUser[userEmail] ?? [];
            const alreadyLiked = likedTrackIds.includes(trackId);
            const metrics = getLocalMetrics(state.trackMetricsById[trackId]);

            return {
              ...state,
              likedTrackIdsByUser: {
                ...state.likedTrackIdsByUser,
                [userEmail]: alreadyLiked
                  ? likedTrackIds.filter((id) => id !== trackId)
                  : [...likedTrackIds, trackId],
              },
              trackMetricsById: {
                ...state.trackMetricsById,
                [trackId]: {
                  ...metrics,
                  likeCount: Math.max(0, metrics.likeCount + (alreadyLiked ? -1 : 1)),
                },
              },
            };
          });
          return;
        }

        const response = await toggleTrackLikeOnServer({ trackId, userEmail });
        applySnapshot(response.snapshot);
      },
      addTrackComment: async ({ trackId, authorName, authorEmail, content }) => {
        if (isBaseTrack(trackId)) {
          const commentId = `local-comment-${Date.now()}`;
          set((state) => ({
            ...state,
            comments: [
              ...state.comments,
              {
                id: commentId,
                trackId,
                authorName,
                authorEmail,
                content,
                createdAt: Date.now(),
              },
            ],
          }));
          return commentId;
        }

        const response = await addTrackCommentOnServer({
          trackId,
          authorName,
          authorEmail,
          content,
        });
        applySnapshot(response.snapshot);
        return '';
      },
      recordTrackView: async (trackId, userEmail) => {
        if (isBaseTrack(trackId)) {
          set((state) => {
            const metrics = getLocalMetrics(state.trackMetricsById[trackId]);
            return {
              ...state,
              trackMetricsById: {
                ...state.trackMetricsById,
                [trackId]: {
                  ...metrics,
                  viewCount: metrics.viewCount + 1,
                },
              },
            };
          });
          return;
        }

        const response = await recordTrackViewOnServer({ trackId, userEmail });
        applySnapshot(response.snapshot);
      },
      recordTrackDownload: async (trackId, userEmail) => {
        if (isBaseTrack(trackId)) {
          set((state) => {
            const metrics = getLocalMetrics(state.trackMetricsById[trackId]);
            return {
              ...state,
              trackMetricsById: {
                ...state.trackMetricsById,
                [trackId]: {
                  ...metrics,
                  downloadCount: metrics.downloadCount + 1,
                },
              },
            };
          });
          return;
        }

        const response = await recordTrackDownloadOnServer({ trackId, userEmail });
        applySnapshot(response.snapshot);
      },
      recordTrackOpen: async (trackId, userEmail) => {
        if (isBaseTrack(trackId)) {
          set((state) => {
            const recentTrackIds = state.recentOpenedTrackIdsByUser[userEmail] ?? [];
            return {
              ...state,
              recentOpenedTrackIdsByUser: {
                ...state.recentOpenedTrackIdsByUser,
                [userEmail]: [trackId, ...recentTrackIds.filter((id) => id !== trackId)].slice(
                  0,
                  20
                ),
              },
            };
          });
          return;
        }

        const response = await recordTrackOpenOnServer({ trackId, userEmail });
        applySnapshot(response.snapshot);
      },
      deleteTrack: async (trackId) => {
        const response = await deleteTrackOnServer({ trackId });
        applySnapshot(response.snapshot);
      },
    }),
    {
      name: 'song-maker-music-share',
      partialize: (state) => ({
        likedTrackIdsByUser: state.likedTrackIdsByUser,
        tracks: state.tracks,
        recentOpenedTrackIdsByUser: state.recentOpenedTrackIdsByUser,
        trackMetricsById: state.trackMetricsById,
        comments: state.comments,
      }),
    }
  )
);


