import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MarketItem } from '../types/market';
import {
  createMarketItemOnServer,
  fetchMarketBootstrap,
  recordMarketViewOnServer,
  toggleMarketFavoriteOnServer,
  type MarketSnapshot,
} from '../utils/marketApi';

type UsedMarketStoreState = {
  items: MarketItem[];
  favoriteItemIdsByUser: Record<string, string[]>;
  bootstrapStatus: 'idle' | 'loading' | 'ready' | 'error';
  bootstrapError: string | null;
  seedMarket: (force?: boolean) => Promise<void>;
  applyServerSnapshot: (snapshot: MarketSnapshot) => void;
  createItem: (payload: Record<string, unknown>) => Promise<string>;
  toggleFavorite: (itemId: string, userEmail: string) => Promise<boolean>;
  recordView: (itemId: string) => Promise<void>;
};

let marketBootstrapPromise: Promise<void> | null = null;

function applySnapshot(snapshot: MarketSnapshot) {
  useUsedMarketStore.setState((state) => ({
    ...state,
    items: snapshot.items ?? [],
    favoriteItemIdsByUser: snapshot.favoriteItemIdsByUser ?? {},
    bootstrapStatus: 'ready',
    bootstrapError: null,
  }));
}

export const useUsedMarketStore = create<UsedMarketStoreState>()(
  persist(
    (set, get) => ({
      items: [],
      favoriteItemIdsByUser: {},
      bootstrapStatus: 'idle',
      bootstrapError: null,
      seedMarket: async (force = false) => {
        if (!force && get().bootstrapStatus === 'ready') {
          return;
        }

        if (!force && marketBootstrapPromise) {
          return marketBootstrapPromise;
        }

        set((state) => ({
          ...state,
          bootstrapStatus: 'loading',
          bootstrapError: null,
        }));

        const nextPromise = fetchMarketBootstrap()
          .then((snapshot) => {
            applySnapshot(snapshot);
          })
          .catch((error) => {
            set((state) => ({
              ...state,
              bootstrapStatus: 'error',
              bootstrapError: error instanceof Error ? error.message : '중고거래 데이터를 불러오지 못했습니다.',
            }));
            throw error;
          })
          .finally(() => {
            marketBootstrapPromise = null;
          });

        marketBootstrapPromise = nextPromise;
        return nextPromise;
      },
      applyServerSnapshot: (snapshot) => {
        applySnapshot(snapshot);
      },
      createItem: async (payload) => {
        const response = await createMarketItemOnServer(payload);
        applySnapshot(response.snapshot);
        return response.itemId;
      },
      toggleFavorite: async (itemId, userEmail) => {
        const response = await toggleMarketFavoriteOnServer({ itemId, userEmail });
        applySnapshot(response.snapshot);
        return response.favorite;
      },
      recordView: async (itemId) => {
        const response = await recordMarketViewOnServer({ itemId });
        applySnapshot(response.snapshot);
      },
    }),
    {
      name: 'song-maker-used-market',
      partialize: (state) => ({
        items: state.items,
        favoriteItemIdsByUser: state.favoriteItemIdsByUser,
      }),
    }
  )
);
