import type {
  SessionMeetingType,
  SessionRecruitPost,
  SessionRegion,
  SessionRole,
  SessionStatus,
} from '../types/sessionRecruit';
import { fetchServerJson } from './serverApi';

export type SessionRecruitSnapshot = {
  posts: SessionRecruitPost[];
};

export type CreateSessionRecruitPayload = {
  title: string;
  genre: string;
  hostName: string;
  hostEmail: string;
  summary: string;
  location: string;
  region: SessionRegion;
  meetingType: SessionMeetingType;
  status: SessionStatus;
  wantedRoles: SessionRole[];
  tags: string[];
  currentMembers: number;
  maxMembers: number;
  schedule: string;
  urgent: boolean;
};

export type UpdateSessionRecruitPayload = CreateSessionRecruitPayload & {
  postId: string;
  userEmail: string;
};

export function fetchSessionRecruitBootstrap() {
  return fetchServerJson<SessionRecruitSnapshot>('/api/sessions/bootstrap');
}

export function createSessionRecruitPostOnServer(payload: CreateSessionRecruitPayload) {
  return fetchServerJson<{ postId: string; snapshot: SessionRecruitSnapshot }>(
    '/api/sessions',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export function updateSessionRecruitPostOnServer(payload: UpdateSessionRecruitPayload) {
  return fetchServerJson<{ snapshot: SessionRecruitSnapshot }>(
    `/api/sessions/${payload.postId}/update`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export function deleteSessionRecruitPostOnServer(payload: {
  postId: string;
  userEmail: string;
}) {
  return fetchServerJson<{ snapshot: SessionRecruitSnapshot }>(
    `/api/sessions/${payload.postId}/delete`,
    {
      method: 'POST',
      body: JSON.stringify({ userEmail: payload.userEmail }),
    }
  );
}
