import { getStoredSessionToken } from './authSession';
import { APP_SERVER_URL, fetchServerJson } from './serverApi';

export type ShortsSnapshot = {
  shorts: any[];
  comments: any[];
};

type UploadResponse = {
  url?: string;
  storageKey?: string;
  videoUrl?: string;
  videoStorageKey?: string;
  audioUrl?: string;
  audioStorageKey?: string;
};

async function uploadShortFile(
  path: string,
  creatorEmail: string,
  file: File,
  kind: 'video' | 'audio'
) {
  const params = new URLSearchParams({
    fileName: file.name,
    creatorEmail,
  });
  const sessionToken = getStoredSessionToken();
  let response: Response;

  try {
    response = await fetch(`${APP_SERVER_URL}${path}?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: file,
    });
  } catch {
    throw new Error(
      '숏폼 업로드 서버에 연결하지 못했습니다. npm.cmd run dev가 실행 중인지 확인해 주세요.'
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || '숏폼 파일 업로드에 실패했습니다.');
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `숏폼 API 서버 주소가 올바르지 않습니다. 현재 서버 주소(${APP_SERVER_URL})와 실행 포트 8788을 확인해 주세요.`
    );
  }

  const payload = (await response.json()) as UploadResponse;
  const url = kind === 'video' ? payload.videoUrl : payload.audioUrl;
  const storageKey =
    kind === 'video' ? payload.videoStorageKey : payload.audioStorageKey;

  if (!url || !storageKey) {
    throw new Error('업로드 서버에서 파일 주소를 받지 못했습니다.');
  }

  return { url, storageKey };
}

export function fetchShortsBootstrap() {
  return fetchServerJson<ShortsSnapshot>('/api/shorts/bootstrap');
}

export function uploadShortVideoOnServer(payload: {
  creatorEmail: string;
  file: File;
}) {
  return uploadShortFile('/api/shorts/upload', payload.creatorEmail, payload.file, 'video');
}

export function uploadShortAudioOnServer(payload: {
  creatorEmail: string;
  file: File;
}) {
  return uploadShortFile(
    '/api/shorts/upload-audio',
    payload.creatorEmail,
    payload.file,
    'audio'
  );
}

export function createShortOnServer(payload: Record<string, any>) {
  return fetchServerJson<{ shortId: string; snapshot: ShortsSnapshot }>('/api/shorts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateShortOnServer(
  payload: { shortId: string } & Record<string, any>
) {
  const { shortId, ...updateData } = payload;
  return fetchServerJson<{ snapshot: ShortsSnapshot }>(
    `/api/shorts/${encodeURIComponent(shortId)}/update`,
    {
      method: 'POST',
      body: JSON.stringify(updateData),
    }
  );
}

export function deleteShortOnServer(payload: {
  shortId: string;
  userEmail: string;
}) {
  return fetchServerJson<{ snapshot: ShortsSnapshot }>(
    `/api/shorts/${encodeURIComponent(payload.shortId)}/delete`,
    {
      method: 'POST',
      body: JSON.stringify({ userEmail: payload.userEmail }),
    }
  );
}

export function toggleShortLikeOnServer(payload: {
  shortId: string;
  userEmail: string;
}) {
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
