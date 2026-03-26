import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { LessonId } from '../dummy/learnData';
import {
  answerLearnQuizOnServer,
  fetchLearnProgressBootstrap,
  toggleLearnCompletedOnServer,
  toggleLearnFavoriteOnServer,
  type LearnProgressSnapshot,
  type LearnQuizAnswer,
} from '../utils/learnApi';

type LearnProgressState = {
  completedByUser: Record<string, LessonId[]>;
  favoriteByUser: Record<string, LessonId[]>;
  quizAnswersByUser: Record<string, Partial<Record<LessonId, LearnQuizAnswer>>>;
  bootstrapStatus: Record<string, 'idle' | 'loading' | 'ready' | 'error'>;
  bootstrapError: Record<string, string | null>;
  seedLearnProgress: (userKey: string, force?: boolean) => Promise<void>;
  applyServerSnapshot: (snapshot: LearnProgressSnapshot) => void;
  toggleCompleted: (userKey: string, lessonId: LessonId) => Promise<void>;
  toggleFavorite: (userKey: string, lessonId: LessonId) => Promise<void>;
  answerQuiz: (
    userKey: string,
    lessonId: LessonId,
    selectedIndex: number,
    isCorrect: boolean
  ) => Promise<void>;
};

const learnBootstrapPromises = new Map<string, Promise<void>>();

function applySnapshot(snapshot: LearnProgressSnapshot) {
  useLearnProgressStore.setState((state) => ({
    ...state,
    completedByUser: {
      ...state.completedByUser,
      [snapshot.userKey]: snapshot.completedLessons ?? [],
    },
    favoriteByUser: {
      ...state.favoriteByUser,
      [snapshot.userKey]: snapshot.favoriteLessons ?? [],
    },
    quizAnswersByUser: {
      ...state.quizAnswersByUser,
      [snapshot.userKey]: snapshot.quizAnswers ?? {},
    },
    bootstrapStatus: {
      ...state.bootstrapStatus,
      [snapshot.userKey]: 'ready',
    },
    bootstrapError: {
      ...state.bootstrapError,
      [snapshot.userKey]: null,
    },
  }));
}

export const useLearnProgressStore = create<LearnProgressState>()(
  persist(
    (set, get) => ({
      completedByUser: {},
      favoriteByUser: {},
      quizAnswersByUser: {},
      bootstrapStatus: {},
      bootstrapError: {},
      seedLearnProgress: async (userKey, force = false) => {
        const safeUserKey = userKey || 'guest';

        if (!force && get().bootstrapStatus[safeUserKey] === 'ready') {
          return;
        }

        if (!force && learnBootstrapPromises.has(safeUserKey)) {
          return learnBootstrapPromises.get(safeUserKey);
        }

        set((state) => ({
          ...state,
          bootstrapStatus: {
            ...state.bootstrapStatus,
            [safeUserKey]: 'loading',
          },
          bootstrapError: {
            ...state.bootstrapError,
            [safeUserKey]: null,
          },
        }));

        const nextPromise = fetchLearnProgressBootstrap(safeUserKey)
          .then((snapshot) => {
            applySnapshot(snapshot);
          })
          .catch((error) => {
            set((state) => ({
              ...state,
              bootstrapStatus: {
                ...state.bootstrapStatus,
                [safeUserKey]: 'error',
              },
              bootstrapError: {
                ...state.bootstrapError,
                [safeUserKey]:
                  error instanceof Error
                    ? error.message
                    : '학습 진행도를 서버에서 불러오지 못했습니다.',
              },
            }));
            throw error;
          })
          .finally(() => {
            learnBootstrapPromises.delete(safeUserKey);
          });

        learnBootstrapPromises.set(safeUserKey, nextPromise);
        return nextPromise;
      },
      applyServerSnapshot: (snapshot) => {
        applySnapshot(snapshot);
      },
      toggleCompleted: async (userKey, lessonId) => {
        const response = await toggleLearnCompletedOnServer({ userKey, lessonId });
        applySnapshot(response.snapshot);
      },
      toggleFavorite: async (userKey, lessonId) => {
        const response = await toggleLearnFavoriteOnServer({ userKey, lessonId });
        applySnapshot(response.snapshot);
      },
      answerQuiz: async (userKey, lessonId, selectedIndex, isCorrect) => {
        const response = await answerLearnQuizOnServer({
          userKey,
          lessonId,
          selectedIndex,
          isCorrect,
        });
        applySnapshot(response.snapshot);
      },
    }),
    {
      name: 'song-maker-learn-progress',
      partialize: (state) => ({
        completedByUser: state.completedByUser,
        favoriteByUser: state.favoriteByUser,
        quizAnswersByUser: state.quizAnswersByUser,
      }),
    }
  )
);
