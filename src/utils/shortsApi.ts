import { getStoredSessionToken } from './authSession';
import { APP_SERVER_URL, fetchServerJson } from './serverApi';

export type ShortsSnapshot = {
  shorts: unknown[];
  comments: unknown[];
};

export function fetchShortsBootstrap() {
  return fetchServerJson<ShortsSnapshot>('/api/shorts/bootstrap');
}

export function createShortOnServer(payload: Record<string, unknown>) {
  return fetchServerJson<{ shortId: string; snapshot: ShortsSnapshot }>('/api/shorts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateShortOnServer(payload: { shortId: string } & Record<string, unknown>) {
  return fetchServerJson<{ snapshot: ShortsSnapshot }>(`/api/shorts/${payload.shortId}/update`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteShortOnServer(payload: { shortId: string; userEmail: string }) {
  return fetchServerJson<{ snapshot: ShortsSnapshot }>(`/api/shorts/${payload.shortId}/delete`, {
    method: 'POST',
    body: JSON.stringify({ userEmail: payload.userEmail }),
  });
}

export function toggleShortLikeOnServer(payload: { shortId: string; userEmail: string }) {
  return fetchServerJson<{ snapshot: ShortsSnapshot }>('/api/shorts/like', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function addShortCommentOnServer(payload: {
  shortId: string;
  authorName: string;
  authorEmail: string;
  content: string;
}) {
  return fetchServerJson<{ snapshot: ShortsSnapshot }>('/api/shorts/comments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function recordShortViewOnServer(payload: { shortId: string }) {
  return fetchServerJson<{ snapshot: ShortsSnapshot }>('/api/shorts/view', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadShortVideoOnServer(payload: {
  creatorEmail: string;
  file: File;
}) {
  const token = getStoredSessionToken();

  const response = await fetch(
    `${APP_SERVER_URL}/api/shorts/upload?fileName=${encodeURIComponent(payload.file.name)}&creatorEmail=${encodeURIComponent(payload.creatorEmail)}`,
    {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': payload.file.type || 'application/octet-stream',
      },
      body: payload.file,
    }
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || '숏폼 영상을 서버에 업로드하지 못했습니다.');
  }

  return (await response.json()) as {
    videoUrl: string;
    videoStorageKey: string;
    videoFileName: string;
    videoSizeBytes: number;
  };
}
