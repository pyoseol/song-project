import {
  createReadStream,
  existsSync,
  mkdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSqlDriver, loadSqlState, saveSqlState } from './sqliteState.mjs';
import { loadMarketMysqlState, saveMarketMysqlState } from './mysqlTables.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MARKET_LEGACY_DATA_PATH = join(__dirname, 'market-data.json');
const MARKET_UPLOAD_DIR = join(__dirname, 'uploads', 'market');
const MARKET_ITEM_IMAGES = {
  launchkey: '/seed-images/market/launchkey.svg',
  keylab: '/seed-images/market/keylab.svg',
  mx61: '/seed-images/market/mx61.svg',
  microkey: '/seed-images/market/microkey.svg',
  scarlett: '/seed-images/market/scarlett.svg',
  id4: '/seed-images/market/id4.svg',
  sm58: '/seed-images/market/sm58.svg',
  at2020: '/seed-images/market/at2020.svg',
  hs5: '/seed-images/market/hs5.svg',
  push2: '/seed-images/market/push2.svg',
};
const MARKET_DEFAULT_IMAGES = {
  keyboard: '/seed-images/market/keyboard.svg',
  midi: '/seed-images/market/pads.svg',
  interface: '/seed-images/market/interface.svg',
  microphone: '/seed-images/market/microphone.svg',
  monitor: '/seed-images/market/monitor.svg',
  guitar: '/seed-images/market/gear.svg',
  etc: '/seed-images/market/gear.svg',
};

const PALETTES = [
  'radial-gradient(circle at 24% 18%, rgba(120,160,255,0.24), transparent 30%), linear-gradient(145deg, #61656d 0%, #2a2c31 100%)',
  'radial-gradient(circle at 76% 16%, rgba(162,199,255,0.18), transparent 28%), linear-gradient(145deg, #5d626a 0%, #272a2e 100%)',
  'radial-gradient(circle at 70% 24%, rgba(255,215,130,0.15), transparent 28%), linear-gradient(145deg, #666056 0%, #29261f 100%)',
  'radial-gradient(circle at 22% 18%, rgba(145,244,222,0.18), transparent 28%), linear-gradient(145deg, #546360 0%, #232a29 100%)',
  'radial-gradient(circle at 75% 15%, rgba(255,118,118,0.16), transparent 28%), linear-gradient(145deg, #665757 0%, #2a2121 100%)',
  'radial-gradient(circle at 24% 18%, rgba(176,186,255,0.18), transparent 28%), linear-gradient(145deg, #5f6070 0%, #24242c 100%)',
];

const SEEDS = [
  ['launchkey', 'Launchkey 61 MK3', 'Novation', 'keyboard', 'sale', 'both', '중상', 149000, true, 0, 'seoul@songmaker.app', '서울메이커'],
  ['keylab', 'KeyLab Essential 49', 'Arturia', 'midi', 'sale', 'direct', '상', 185000, false, 1, 'keys@songmaker.app', 'keys'],
  ['mx61', 'MX61', 'Yamaha', 'keyboard', 'sale', 'delivery', '중', 330000, false, 2, 'yamaha@songmaker.app', 'yamaha'],
  ['microkey', 'microKEY Air 37', 'Korg', 'midi', 'reserved', 'both', '상', 99000, true, 3, 'korg@songmaker.app', 'korg'],
  ['scarlett', 'Scarlett 2i2 3rd', 'Focusrite', 'interface', 'sale', 'both', '상', 149000, true, 4, 'focus@songmaker.app', 'focus'],
  ['id4', 'iD4 MKII', 'Audient', 'interface', 'sale', 'delivery', '중상', 179000, false, 5, 'audient@songmaker.app', 'audient'],
  ['sm58', 'SM58', 'Shure', 'microphone', 'sale', 'direct', '상', 95000, false, 0, 'vocal@songmaker.app', 'vocal'],
  ['at2020', 'AT2020', 'Audio-Technica', 'microphone', 'wanted', 'delivery', '특A', 120000, false, 3, 'wanted@songmaker.app', 'wanted'],
  ['hs5', 'HS5 Pair', 'Yamaha', 'monitor', 'sale', 'direct', '중상', 360000, false, 2, 'monitor@songmaker.app', 'monitor'],
  ['push2', 'Push 2', 'Ableton', 'etc', 'wanted', 'both', '특A', 520000, false, 5, 'ableton@songmaker.app', 'ableton'],
];

const VARIANTS = [
  { id: 'seongsu', label: '서울 성수', priceOffset: 0, hourOffset: 0 },
  { id: 'bundang', label: '성남 분당', priceOffset: -8000, hourOffset: 18 },
  { id: 'songdo', label: '인천 송도', priceOffset: 6000, hourOffset: 36 },
  { id: 'dunsan', label: '대전 둔산', priceOffset: -12000, hourOffset: 54 },
];

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureUploadDirs() {
  const dataDir = dirname(MARKET_UPLOAD_DIR);
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  if (!existsSync(MARKET_UPLOAD_DIR)) {
    mkdirSync(MARKET_UPLOAD_DIR, { recursive: true });
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeText(value, fallback = '') {
  const trimmed = String(value || '').trim();
  return trimmed || fallback;
}

function buildUploadUrl(baseUrl, fileName) {
  return `${baseUrl}/uploads/market/${encodeURIComponent(fileName)}`;
}

function getSeedItemImage(baseId, category) {
  return (
    MARKET_ITEM_IMAGES[baseId] ||
    MARKET_DEFAULT_IMAGES[category] ||
    '/seed-images/market/gear.svg'
  );
}

function createSeedItems() {
  return VARIANTS.flatMap((variant, variantIndex) =>
    SEEDS.map(
      ([
        id,
        title,
        brand,
        category,
        status,
        tradeType,
        condition,
        price,
        urgent,
        paletteIndex,
        sellerEmail,
        sellerName,
      ], itemIndex) => ({
        id: `${id}-${variant.id}`,
        title,
        brand,
        category,
        status:
          variantIndex === 1 && itemIndex % 5 === 0
            ? 'reserved'
            : variantIndex === 3 && itemIndex % 6 === 0
              ? 'wanted'
              : status,
        tradeType: variantIndex === 2 && tradeType === 'direct' ? 'both' : tradeType,
        condition,
        location: variant.label,
        price: Math.max(65000, price + variant.priceOffset + (itemIndex % 3) * 4000),
        createdAt:
          Date.parse('2026-03-20T12:00:00+09:00') -
          (variant.hourOffset + itemIndex) * 60 * 60 * 1000,
        updatedAt:
          Date.parse('2026-03-20T12:00:00+09:00') -
          (variant.hourOffset + itemIndex) * 60 * 60 * 1000,
        urgent,
        palette: PALETTES[paletteIndex],
        sellerName,
        sellerEmail,
        description: `${brand} ${title} 거래 글입니다. 구성품과 상태는 메시지로 한 번 더 확인해 주세요.`,
        favoriteCount: Math.max(0, 3 + ((itemIndex + variantIndex) % 7)),
        viewCount: 40 + itemIndex * 13 + variantIndex * 11,
        imageUrl: getSeedItemImage(id, category),
        imageStorageKey: undefined,
        imageFileName: undefined,
      })
    )
  );
}

function createSeedState() {
  return {
    items: createSeedItems(),
    favoriteItemIdsByUser: {},
  };
}

async function loadLegacyState() {
  return await loadSqlState('market', createSeedState, {
    legacyFilePath: MARKET_LEGACY_DATA_PATH,
    normalize: (parsed) => ({
      items: Array.isArray(parsed.items) ? parsed.items : createSeedItems(),
      favoriteItemIdsByUser:
        parsed && typeof parsed.favoriteItemIdsByUser === 'object' && parsed.favoriteItemIdsByUser
          ? parsed.favoriteItemIdsByUser
          : {},
    }),
  });
}

async function loadState() {
  if (getSqlDriver() === 'mysql') {
    return await loadMarketMysqlState(loadLegacyState);
  }

  return await loadLegacyState();
}

let state = await loadState();

function saveState() {
  if (getSqlDriver() === 'mysql') {
    saveMarketMysqlState(state);
    return;
  }

  saveSqlState('market', state);
}

function getCurrentFavoriteIds(itemId) {
  return Object.entries(state.favoriteItemIdsByUser)
    .filter(([, ids]) => ids.includes(itemId))
    .map(([email]) => email);
}

function getDefaultMarketImage(item) {
  const baseId = String(item.id || '').split('-')[0];
  if (MARKET_ITEM_IMAGES[baseId]) {
    return MARKET_ITEM_IMAGES[baseId];
  }
  return MARKET_DEFAULT_IMAGES[item.category] ?? '/seed-images/market/gear.svg';
}

function hydrateFavoriteCounts(items) {
  return items.map((item) => ({
    ...item,
    favoriteCount: getCurrentFavoriteIds(item.id).length,
    imageUrl:
      item.imageStorageKey || String(item.imageUrl || '').startsWith('/uploads/market/')
        ? item.imageUrl
        : getDefaultMarketImage(item),
  }));
}

export function getMarketSnapshot() {
  return {
    items: hydrateFavoriteCounts(state.items),
    favoriteItemIdsByUser: state.favoriteItemIdsByUser,
  };
}

export function createMarketItem(payload) {
  const timestamp = Date.now();
  const nextItem = {
    id: createId('market'),
    title: normalizeText(payload.title, '중고 장비'),
    brand: normalizeText(payload.brand, '브랜드 미정'),
    category: normalizeText(payload.category, 'etc'),
    status: normalizeText(payload.status, 'sale'),
    tradeType: normalizeText(payload.tradeType, 'both'),
    condition: normalizeText(payload.condition, '상'),
    location: normalizeText(payload.location, '지역 미정'),
    price: Math.max(0, Number(payload.price) || 0),
    createdAt: timestamp,
    updatedAt: timestamp,
    urgent: Boolean(payload.urgent),
    palette: normalizeText(payload.palette, PALETTES[0]),
    sellerName: normalizeText(payload.sellerName, 'guest'),
    sellerEmail: normalizeEmail(payload.sellerEmail) || 'guest@songmaker.local',
    description: normalizeText(payload.description, '상세 설명이 아직 없습니다.'),
    favoriteCount: 0,
    viewCount: 0,
    imageUrl: payload.imageUrl,
    imageStorageKey: payload.imageStorageKey,
    imageFileName: payload.imageFileName,
  };

  state = {
    ...state,
    items: [nextItem, ...state.items],
  };
  saveState();

  return {
    itemId: nextItem.id,
    snapshot: getMarketSnapshot(),
  };
}

export function updateMarketItem(payload) {
  const itemId = normalizeText(payload.itemId);
  const sellerEmail = normalizeEmail(payload.sellerEmail);

  state = {
    ...state,
    items: state.items.map((item) => {
      if (item.id !== itemId || normalizeEmail(item.sellerEmail) !== sellerEmail) {
        return item;
      }

      return {
        ...item,
        title: normalizeText(payload.title, item.title),
        brand: normalizeText(payload.brand, item.brand),
        category: normalizeText(payload.category, item.category),
        status: normalizeText(payload.status, item.status),
        tradeType: normalizeText(payload.tradeType, item.tradeType),
        condition: normalizeText(payload.condition, item.condition),
        location: normalizeText(payload.location, item.location),
        price: Math.max(0, Number(payload.price) || item.price),
        urgent: payload.urgent == null ? item.urgent : Boolean(payload.urgent),
        palette: normalizeText(payload.palette, item.palette),
        description: normalizeText(payload.description, item.description),
        imageUrl: payload.imageUrl ?? item.imageUrl,
        imageStorageKey: payload.imageStorageKey ?? item.imageStorageKey,
        imageFileName: payload.imageFileName ?? item.imageFileName,
        updatedAt: Date.now(),
      };
    }),
  };
  saveState();

  return getMarketSnapshot();
}

export function deleteMarketItem(payload) {
  const itemId = normalizeText(payload.itemId);
  const sellerEmail = normalizeEmail(payload.sellerEmail);

  state = {
    ...state,
    items: state.items.filter(
      (item) => !(item.id === itemId && normalizeEmail(item.sellerEmail) === sellerEmail)
    ),
    favoriteItemIdsByUser: Object.fromEntries(
      Object.entries(state.favoriteItemIdsByUser).map(([email, ids]) => [
        email,
        ids.filter((id) => id !== itemId),
      ])
    ),
  };
  saveState();

  return getMarketSnapshot();
}

export function toggleMarketFavorite(payload) {
  const userEmail = normalizeEmail(payload.userEmail);
  const itemId = normalizeText(payload.itemId);
  const currentIds = state.favoriteItemIdsByUser[userEmail] ?? [];
  const isActive = currentIds.includes(itemId);

  state = {
    ...state,
    favoriteItemIdsByUser: {
      ...state.favoriteItemIdsByUser,
      [userEmail]: isActive
        ? currentIds.filter((id) => id !== itemId)
        : [itemId, ...currentIds],
    },
  };
  saveState();

  return {
    snapshot: getMarketSnapshot(),
    favorite: !isActive,
  };
}

export function recordMarketView(payload) {
  const itemId = normalizeText(payload.itemId);

  state = {
    ...state,
    items: state.items.map((item) =>
      item.id === itemId
        ? {
            ...item,
            viewCount: Number(item.viewCount || 0) + 1,
          }
        : item
    ),
  };
  saveState();

  return getMarketSnapshot();
}

export function saveMarketImageFile(payload) {
  ensureUploadDirs();
  const ext = extname(payload.fileName || '').toLowerCase() || '.jpg';
  const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
  const storageKey = `${createId('market-image')}${safeExt}`;
  const filePath = join(MARKET_UPLOAD_DIR, storageKey);

  writeFileSync(filePath, payload.buffer);

  return {
    imageUrl: buildUploadUrl(payload.baseUrl, storageKey),
    imageStorageKey: storageKey,
    imageFileName: payload.fileName || storageKey,
  };
}

export function serveMarketUpload(request, response, fileName) {
  const filePath = join(MARKET_UPLOAD_DIR, fileName);
  if (!existsSync(filePath)) {
    return false;
  }

  const ext = extname(filePath).toLowerCase();
  const contentType =
    ext === '.png'
      ? 'image/png'
      : ext === '.webp'
        ? 'image/webp'
        : 'image/jpeg';
  const stat = statSync(filePath);

  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size,
    'Cache-Control': 'public, max-age=3600',
    'Access-Control-Allow-Origin': '*',
  });

  createReadStream(filePath).pipe(response);
  return true;
}
