import { useAuthStore } from '../store/authStore';
import { getStoredSessionToken } from './authSession';
import { storeSessionToken } from './authSession';

const DEFAULT_SERVER_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8788`
    : 'http://localhost:8788';

export const APP_SERVER_URL =
  (import.meta.env.VITE_APP_SERVER_URL as string | undefined) ??
  (import.meta.env.VITE_AUTH_SERVER_URL as string | undefined) ??
  (import.meta.env.VITE_COLLAB_SERVER_URL as string | undefined) ??
  DEFAULT_SERVER_URL;

export async function fetchServerJson<T>(
  path: string,
  init?: RequestInit,
  connectionErrorMessage = '서버에 연결하지 못했습니다. `npm.cmd run dev`가 실행 중인지 확인해주세요.'
) {
  let response: Response;

  try {
    const persistedSessionToken = useAuthStore.getState().sessionToken;
    const sessionToken = getStoredSessionToken() ?? persistedSessionToken;

    if (sessionToken && !getStoredSessionToken()) {
      storeSessionToken(sessionToken);
    }

    response = await fetch(`${APP_SERVER_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new Error(connectionErrorMessage);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || '서버 요청에 실패했습니다.');
  }

  return (await response.json()) as T;
}
