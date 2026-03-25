import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Comment, Post } from '../types/community';
import {
  addCommunityCommentOnServer,
  createCommunityPostOnServer,
  deleteCommunityCommentOnServer,
  deleteCommunityPostOnServer,
  fetchCommunityBootstrap,
  moderateCommunityPostOnServer,
  recordCommunityViewOnServer,
  replyCommunityCommentOnServer,
  reportCommunityPostOnServer,
  toggleCommunityBookmarkOnServer,
  toggleCommunityLikeOnServer,
  updateCommunityCommentOnServer,
  updateCommunityPostOnServer,
  type AddCommunityCommentPayload,
  type CommunitySnapshot,
  type CreateCommunityPostPayload,
  type ReplyCommunityCommentPayload,
  type UpdateCommunityCommentPayload,
  type UpdateCommunityPostPayload,
} from '../utils/communityApi';

type CommunityStoreState = {
  posts: Post[];
  comments: Comment[];
  likedPostIdsByUser: Record<string, string[]>;
  bookmarkedPostIdsByUser: Record<string, string[]>;
  reportedPostIdsByUser: Record<string, string[]>;
  bootstrapStatus: 'idle' | 'loading' | 'ready' | 'error';
  bootstrapError: string | null;
  seedCommunity: (force?: boolean) => Promise<void>;
  applyServerSnapshot: (snapshot: CommunitySnapshot) => void;
  createPost: (payload: CreateCommunityPostPayload) => Promise<string>;
  updatePost: (payload: UpdateCommunityPostPayload) => Promise<void>;
  deletePost: (postId: string, userEmail: string) => Promise<void>;
  moderatePost: (
    postId: string,
    userEmail: string,
    action: 'delete-post' | 'block-user'
  ) => Promise<void>;
  recordView: (postId: string) => Promise<void>;
  toggleLike: (postId: string, userEmail: string) => Promise<void>;
  toggleBookmark: (postId: string, userEmail: string) => Promise<boolean>;
  reportPost: (postId: string, userEmail: string) => Promise<void>;
  addComment: (payload: AddCommunityCommentPayload) => Promise<string>;
  replyComment: (payload: ReplyCommunityCommentPayload) => Promise<string>;
  updateComment: (payload: UpdateCommunityCommentPayload) => Promise<void>;
  deleteComment: (commentId: string, userEmail: string) => Promise<void>;
};

let communityBootstrapPromise: Promise<void> | null = null;

function applySnapshot(snapshot: CommunitySnapshot) {
  useCommunityStore.setState((state) => ({
    ...state,
    posts: snapshot.posts ?? [],
    comments: snapshot.comments ?? [],
    likedPostIdsByUser: snapshot.likedPostIdsByUser ?? {},
    bookmarkedPostIdsByUser: snapshot.bookmarkedPostIdsByUser ?? {},
    reportedPostIdsByUser: snapshot.reportedPostIdsByUser ?? {},
    bootstrapStatus: 'ready',
    bootstrapError: null,
  }));
}

export const useCommunityStore = create<CommunityStoreState>()(
  persist(
    (set, get) => ({
      posts: [],
      comments: [],
      likedPostIdsByUser: {},
      bookmarkedPostIdsByUser: {},
      reportedPostIdsByUser: {},
      bootstrapStatus: 'idle',
      bootstrapError: null,
      seedCommunity: async (force = false) => {
        if (!force && get().bootstrapStatus === 'ready') {
          return;
        }

        if (!force && communityBootstrapPromise) {
          return communityBootstrapPromise;
        }

        set((state) => ({
          ...state,
          bootstrapStatus: 'loading',
          bootstrapError: null,
        }));

        const nextPromise = fetchCommunityBootstrap()
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
                  : '커뮤니티 데이터를 서버에서 불러오지 못했습니다.',
            }));
            throw error;
          })
          .finally(() => {
            communityBootstrapPromise = null;
          });

        communityBootstrapPromise = nextPromise;
        return nextPromise;
      },
      applyServerSnapshot: (snapshot) => {
        applySnapshot(snapshot);
      },
      createPost: async (payload) => {
        const response = await createCommunityPostOnServer(payload);
        applySnapshot(response.snapshot);
        return response.postId;
      },
      updatePost: async (payload) => {
        const response = await updateCommunityPostOnServer(payload);
        applySnapshot(response.snapshot);
      },
      deletePost: async (postId, userEmail) => {
        const response = await deleteCommunityPostOnServer({ postId, userEmail });
        applySnapshot(response.snapshot);
      },
      moderatePost: async (postId, userEmail, action) => {
        const response = await moderateCommunityPostOnServer({ postId, userEmail, action });
        applySnapshot(response.snapshot);
      },
      recordView: async (postId) => {
        const response = await recordCommunityViewOnServer({ postId });
        applySnapshot(response.snapshot);
      },
      toggleLike: async (postId, userEmail) => {
        const response = await toggleCommunityLikeOnServer({ postId, userEmail });
        applySnapshot(response.snapshot);
      },
      toggleBookmark: async (postId, userEmail) => {
        const response = await toggleCommunityBookmarkOnServer({ postId, userEmail });
        applySnapshot(response.snapshot);
        return response.bookmarked;
      },
      reportPost: async (postId, userEmail) => {
        const response = await reportCommunityPostOnServer({ postId, userEmail });
        applySnapshot(response.snapshot);
      },
      addComment: async (payload) => {
        const response = await addCommunityCommentOnServer(payload);
        applySnapshot(response.snapshot);
        return response.commentId;
      },
      replyComment: async (payload) => {
        const response = await replyCommunityCommentOnServer(payload);
        applySnapshot(response.snapshot);
        return response.commentId;
      },
      updateComment: async (payload) => {
        const response = await updateCommunityCommentOnServer(payload);
        applySnapshot(response.snapshot);
      },
      deleteComment: async (commentId, userEmail) => {
        const response = await deleteCommunityCommentOnServer({ commentId, userEmail });
        applySnapshot(response.snapshot);
      },
    }),
    {
      name: 'song-maker-community',
      partialize: (state) => ({
        posts: state.posts,
        comments: state.comments,
        likedPostIdsByUser: state.likedPostIdsByUser,
        bookmarkedPostIdsByUser: state.bookmarkedPostIdsByUser,
        reportedPostIdsByUser: state.reportedPostIdsByUser,
      }),
    }
  )
);
