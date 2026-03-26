import { fetchServerJson } from './serverApi';

export type ServerProfile = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: number;
};

export function fetchUserProfile(email: string) {
  const query = new URLSearchParams({ email });
  return fetchServerJson<{ user: ServerProfile }>(`/api/profile?${query.toString()}`);
}

export function updateUserProfileOnServer(payload: { email: string; name: string }) {
  return fetchServerJson<{ user: ServerProfile }>('/api/profile/update', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateUserAvatarOnServer(payload: { email: string; avatarUrl: string | null }) {
  return fetchServerJson<{ user: ServerProfile }>('/api/profile/avatar', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
