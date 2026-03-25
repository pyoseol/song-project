import type { LessonId } from '../dummy/learnData';
import { fetchServerJson } from './serverApi';

export type LearnQuizAnswer = {
  selectedIndex: number;
  isCorrect: boolean;
  answeredAt: number;
};

export type LearnProgressSnapshot = {
  userKey: string;
  completedLessons: LessonId[];
  favoriteLessons: LessonId[];
  quizAnswers: Partial<Record<LessonId, LearnQuizAnswer>>;
};

export function fetchLearnProgressBootstrap(userKey: string) {
  return fetchServerJson<LearnProgressSnapshot>(
    `/api/learn-progress?userKey=${encodeURIComponent(userKey)}`
  );
}

export function toggleLearnCompletedOnServer(payload: { userKey: string; lessonId: LessonId }) {
  return fetchServerJson<{ snapshot: LearnProgressSnapshot }>('/api/learn-progress/completed', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function toggleLearnFavoriteOnServer(payload: { userKey: string; lessonId: LessonId }) {
  return fetchServerJson<{ snapshot: LearnProgressSnapshot }>('/api/learn-progress/favorite', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function answerLearnQuizOnServer(payload: {
  userKey: string;
  lessonId: LessonId;
  selectedIndex: number;
  isCorrect: boolean;
}) {
  return fetchServerJson<{ snapshot: LearnProgressSnapshot }>('/api/learn-progress/answer', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
