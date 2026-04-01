import type { MarketItem } from '../types/market';
import { fetchServerJson } from './serverApi';

export type MarketSnapshot = {
  items: MarketItem[];
  favoriteItemIdsByUser: Record<string, string[]>;
};

export function fetchMarketBootstrap() {
  return fetchServerJson<MarketSnapshot>('/api/market');
}

export function toggleMarketFavoriteOnServer(payload: { itemId: string; userEmail: string }) {
  return fetchServerJson<{ snapshot: MarketSnapshot; favorite: boolean }>('/api/market/favorites/toggle', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function recordMarketViewOnServer(payload: { itemId: string }) {
  return fetchServerJson<{ snapshot: MarketSnapshot }>('/api/market/view', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function createMarketItemOnServer(payload: Record<string, unknown>) {
  return fetchServerJson<{ itemId: string; snapshot: MarketSnapshot }>('/api/market/items', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadMarketImageOnServer(file: File) {
  const { APP_SERVER_URL } = await import('./serverApi');
  const { getStoredSessionToken } = await import('./authSession');
  const { useAuthStore } = await import('../store/authStore');

  const userEmail = useAuthStore.getState().user?.email ?? '';
  const persistedSessionToken = useAuthStore.getState().sessionToken;
  const sessionToken = getStoredSessionToken() ?? persistedSessionToken;
  const response = await fetch(
    `${APP_SERVER_URL}/api/market/upload?fileName=${encodeURIComponent(file.name)}&sellerEmail=${encodeURIComponent(userEmail)}`,
    {
      method: 'POST',
      headers: sessionToken ? { Authorization: `Bearer ${sessionToken}` } : undefined,
      body: file,
    }
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || '중고거래 이미지를 업로드하지 못했습니다.');
  }

  return (await response.json()) as {
    imageUrl: string;
    imageStorageKey: string;
    imageFileName: string;
  };
}
