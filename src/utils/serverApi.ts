import { useAuthStore } from '../store/authStore';
import { getStoredSessionToken } from './authSession';
import { storeSessionToken } from './authSession';

const DEFAULT_SERVER_URL =
  typeof window !== 'undefined'
    ? import.meta.env.DEV
      ? `${window.location.protocol}//${window.location.hostname}:8788`
      : `${window.location.protocol}//${window.location.hostname}`
    : 'http://localhost:8788';

const CONFIGURED_SERVER_URL =
  (import.meta.env.VITE_APP_SERVER_URL as string | undefined) ??
  (import.meta.env.VITE_AUTH_SERVER_URL as string | undefined) ??
  (import.meta.env.VITE_COLLAB_SERVER_URL as string | undefined);

function resolveServerUrl() {
  if (!CONFIGURED_SERVER_URL?.trim()) {
    return DEFAULT_SERVER_URL;
  }

  if (
    import.meta.env.DEV &&
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    try {
      const configuredUrl = new URL(CONFIGURED_SERVER_URL);
      if (
        configuredUrl.hostname === 'localhost' ||
        configuredUrl.hostname === '127.0.0.1'
      ) {
        configuredUrl.hostname = window.location.hostname;
        return configuredUrl.origin;
      }
    } catch {
      return DEFAULT_SERVER_URL;
    }
  }

  return CONFIGURED_SERVER_URL.replace(/\/+$/, '');
}

export const APP_SERVER_URL = resolveServerUrl();

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

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error(
      `API 서버 주소가 올바르지 않습니다. 현재 서버 주소(${APP_SERVER_URL})와 실행 포트 8788을 확인해 주세요.`
    );
  }

  return (await response.json()) as T;
}
