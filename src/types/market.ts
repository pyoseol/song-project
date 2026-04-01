export type MarketCategoryKey =
  | 'keyboard'
  | 'midi'
  | 'interface'
  | 'microphone'
  | 'monitor'
  | 'guitar'
  | 'etc';

export type MarketStatusKey = 'sale' | 'reserved' | 'wanted';
export type MarketTradeKey = 'direct' | 'delivery' | 'both';

export type MarketItem = {
  id: string;
  title: string;
  brand: string;
  category: MarketCategoryKey;
  status: MarketStatusKey;
  tradeType: MarketTradeKey;
  condition: string;
  location: string;
  price: number;
  createdAt: number;
  updatedAt: number;
  urgent: boolean;
  palette: string;
  sellerName: string;
  sellerEmail: string;
  description: string;
  favoriteCount: number;
  viewCount: number;
  imageUrl?: string;
  imageStorageKey?: string;
  imageFileName?: string;
};
