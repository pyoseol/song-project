import { fetchServerJson } from './serverApi';

export type ComposerLibrarySnapshot = {
  projects: unknown[];
  favoriteTrackIdsByUser: Record<string, string[]>;
};

export type MusicShareSnapshot = {
  tracks: Array<{
    id: string;
    title: string;
    progression: string;
    reference: string;
    category: string;
    tags: string[];
    palette: string;
    createdAt: number;
    creatorName: string;
    creatorEmail?: string;
    imageUrl?: string;
  }>;
  likedTrackIdsByUser: Record<string, string[]>;
  recentOpenedTrackIdsByUser: Record<string, string[]>;
  trackMetricsById: Record<
    string,
    {
      likeCount: number;
      viewCount: number;
      downloadCount: number;
    }
  >;
  comments: unknown[];
};

export function fetchComposerLibraryBootstrap() {
  return fetchServerJson<ComposerLibrarySnapshot>('/api/composer-library');
}

export function saveComposerProjectOnServer(payload: Record<string, unknown>) {
  return fetchServerJson<{ projectId: string; snapshot: ComposerLibrarySnapshot }>(
    '/api/composer-library/projects/save',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export function shareComposerProjectOnServer(payload: Record<string, unknown>) {
  return fetchServerJson<{ projectId: string; snapshot: ComposerLibrarySnapshot }>(
    '/api/composer-library/projects/share',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function uploadMusicShareCoverOnServer(file: File) {
  const { APP_SERVER_URL } = await import('./serverApi');
  const { getStoredSessionToken } = await import('./authSession');
  const { useAuthStore } = await import('../store/authStore');

  const userEmail = useAuthStore.getState().user?.email ?? '';
  const persistedSessionToken = useAuthStore.getState().sessionToken;
  const sessionToken = getStoredSessionToken() ?? persistedSessionToken;
  const response = await fetch(
    `${APP_SERVER_URL}/api/music-share/upload?fileName=${encodeURIComponent(file.name)}&creatorEmail=${encodeURIComponent(userEmail)}`,
    {
      method: 'POST',
      headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
      body: file,
    }
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || '음악 공유 이미지를 업로드하지 못했습니다.');
  }

  return (await response.json()) as {
    imageUrl: string;
    imageStorageKey: string;
    imageFileName: string;
  };
}

export function toggleFavoriteTrackOnServer(payload: { trackId: string; userEmail: string }) {
  return fetchServerJson<{ snapshot: ComposerLibrarySnapshot }>(
    '/api/composer-library/favorites/toggle',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export function deleteComposerProjectOnServer(payload: { projectId: string; userEmail: string }) {
  return fetchServerJson<{
    snapshot: {
      composer: ComposerLibrarySnapshot;
      music: MusicShareSnapshot;
    };
  }>(`/api/composer-library/projects/${payload.projectId}/delete`, {
    method: 'POST',
    body: JSON.stringify({ userEmail: payload.userEmail }),
  });
}

export function fetchMusicShareBootstrap() {
  return fetchServerJson<MusicShareSnapshot>('/api/music-share');
}

export function toggleTrackLikeOnServer(payload: { trackId: string; userEmail: string }) {
  return fetchServerJson<{ snapshot: MusicShareSnapshot }>('/api/music-share/like', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function addTrackCommentOnServer(payload: {
  trackId: string;
  authorName: string;
  authorEmail: string;
  content: string;
}) {
  return fetchServerJson<{ snapshot: MusicShareSnapshot }>('/api/music-share/comments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function recordTrackViewOnServer(payload: { trackId: string; userEmail?: string }) {
  return fetchServerJson<{ snapshot: MusicShareSnapshot }>('/api/music-share/view', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function recordTrackDownloadOnServer(payload: { trackId: string; userEmail?: string }) {
  return fetchServerJson<{ snapshot: MusicShareSnapshot }>('/api/music-share/download', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function recordTrackOpenOnServer(payload: { trackId: string; userEmail: string }) {
  return fetchServerJson<{ snapshot: MusicShareSnapshot }>('/api/music-share/open', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
