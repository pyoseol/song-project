const DB_NAME = 'song-maker-media';
const STORE_NAME = 'short-videos';
const DB_VERSION = 1;

function openShortsVideoDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      reject(new Error('이 브라우저에서는 IndexedDB를 사용할 수 없습니다.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB를 열지 못했습니다.'));
  });
}

export function createShortVideoStorageKey() {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId
    ? `short-video-${randomId}`
    : `short-video-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function saveShortVideoFile(storageKey: string, file: Blob) {
  const database = await openShortsVideoDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(file, storageKey);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('영상을 저장하지 못했습니다.'));
  });

  database.close();
}

export async function readShortVideoFile(storageKey: string) {
  const database = await openShortsVideoDatabase();

  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(storageKey);

    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error ?? new Error('영상을 불러오지 못했습니다.'));
  });

  database.close();
  return blob;
}

export async function deleteShortVideoFile(storageKey: string) {
  const database = await openShortsVideoDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(storageKey);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('영상을 삭제하지 못했습니다.'));
  });

  database.close();
}
