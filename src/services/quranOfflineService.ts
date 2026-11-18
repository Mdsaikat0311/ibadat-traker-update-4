import type { Ayah } from '../data/quranData';

const DB_NAME = 'ibadat_quran_offline_db';
const DB_VERSION = 1;
const STORE_SURAHS = 'surahs';
const STORE_AUDIO = 'audio';
const STORE_META = 'audio_surah_meta';

export const PREBUNDLED_SURAH_NUMBERS = [1, 103, 108, 109, 110, 111, 112, 113, 114];

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_SURAHS)) {
        db.createObjectStore(STORE_SURAHS, { keyPath: 'surahNumber' });
      }
      if (!db.objectStoreNames.contains(STORE_AUDIO)) {
        const audioStore = db.createObjectStore(STORE_AUDIO, { keyPath: 'audioKey' });
        audioStore.createIndex('surahNumber', 'surahNumber', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'surahNumber' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

export async function getOfflineSurahAyahs(surahNumber: number): Promise<Ayah[] | null> {
  try {
    const db = await openDB();
    return await new Promise<Ayah[] | null>((resolve) => {
      const tx = db.transaction(STORE_SURAHS, 'readonly');
      const store = tx.objectStore(STORE_SURAHS);
      const req = store.get(surahNumber);
      req.onsuccess = () => {
        const res = req.result;
        if (res && Array.isArray(res.ayahs) && res.ayahs.length > 0) {
          resolve(res.ayahs as Ayah[]);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveOfflineSurahAyahs(surahNumber: number, ayahs: Ayah[]): Promise<void> {
  if (!ayahs || ayahs.length === 0) return;
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SURAHS, 'readwrite');
      const store = tx.objectStore(STORE_SURAHS);
      store.put({
        surahNumber,
        ayahs,
        downloadedAt: Date.now()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Failed saving offline Surah to IndexedDB:', err);
  }
}

export async function getDownloadedSurahNumbers(): Promise<number[]> {
  const set = new Set<number>(PREBUNDLED_SURAH_NUMBERS);

  // Check legacy localStorage entries
  if (typeof window !== 'undefined' && window.localStorage) {
    for (let s = 1; s <= 114; s++) {
      if (set.has(s)) continue;
      try {
        if (localStorage.getItem(`ibadat_quran_surah_v5_${s}`)) {
          set.add(s);
        }
      } catch {}
    }
  }

  // Check IndexedDB
  try {
    const db = await openDB();
    const keys = await new Promise<number[]>((resolve) => {
      const tx = db.transaction(STORE_SURAHS, 'readonly');
      const store = tx.objectStore(STORE_SURAHS);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const res = (req.result || []).map((k) => Number(k)).filter((n) => !isNaN(n));
        resolve(res);
      };
      req.onerror = () => resolve([]);
    });
    keys.forEach((k) => set.add(k));
  } catch {}

  return Array.from(set).sort((a, b) => a - b);
}

export async function getOfflineAudioUrl(surahNumber: number, ayahNumber: number): Promise<string | null> {
  try {
    const db = await openDB();
    const audioKey = `${surahNumber}_${ayahNumber}`;
    const blob = await new Promise<Blob | null>((resolve) => {
      const tx = db.transaction(STORE_AUDIO, 'readonly');
      const store = tx.objectStore(STORE_AUDIO);
      const req = store.get(audioKey);
      req.onsuccess = () => {
        const res = req.result;
        if (res && res.blob instanceof Blob) {
          resolve(res.blob);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
    if (blob) {
      return URL.createObjectURL(blob);
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveOfflineAyahAudio(surahNumber: number, ayahNumber: number, blob: Blob): Promise<void> {
  try {
    const db = await openDB();
    const audioKey = `${surahNumber}_${ayahNumber}`;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_AUDIO, 'readwrite');
      const store = tx.objectStore(STORE_AUDIO);
      store.put({
        audioKey,
        surahNumber,
        ayahNumber,
        blob,
        downloadedAt: Date.now()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

export async function markSurahAudioDownloaded(surahNumber: number, totalAyahs: number): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readwrite');
      const store = tx.objectStore(STORE_META);
      store.put({
        surahNumber,
        totalAyahs,
        downloadedAt: Date.now()
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {}
}

export async function getDownloadedAudioSurahNumbers(): Promise<number[]> {
  try {
    const db = await openDB();
    return await new Promise<number[]>((resolve) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        resolve((req.result || []).map((k) => Number(k)).filter((n) => !isNaN(n)));
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function downloadSurahAudioOffline(
  surahNumber: number,
  ayahs: Ayah[],
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<boolean> {
  if (!ayahs || ayahs.length === 0) return false;
  const total = ayahs.length;
  let done = 0;
  let failed = 0;

  // Check which ayahs are already stored
  const db = await openDB().catch(() => null);
  const existingKeys = new Set<string>();
  if (db) {
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_AUDIO, 'readonly');
        const idx = tx.objectStore(STORE_AUDIO).index('surahNumber');
        const req = idx.getAllKeys(surahNumber);
        req.onsuccess = () => {
          (req.result || []).forEach((k) => existingKeys.add(String(k)));
          resolve();
        };
        req.onerror = () => resolve();
      });
    } catch {}
  }

  // Batch fetch 4 ayahs at a time
  const CONCURRENCY = 4;
  for (let i = 0; i < ayahs.length; i += CONCURRENCY) {
    if (signal?.aborted) return false;
    const chunk = ayahs.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (ayah) => {
        if (signal?.aborted) return;
        const audioKey = `${surahNumber}_${ayah.numberInSurah}`;
        if (existingKeys.has(audioKey)) {
          done++;
          onProgress?.(done, total);
          return;
        }
        const audioSrc =
          ayah.audioUrl ||
          (ayah.numberInQuran
            ? `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${ayah.numberInQuran}.mp3`
            : '');
        if (!audioSrc) {
          failed++;
          return;
        }
        try {
          const resp = await fetch(audioSrc, { signal });
          if (!resp.ok) throw new Error('Audio fetch failed');
          const blob = await resp.blob();
          await saveOfflineAyahAudio(surahNumber, ayah.numberInSurah, blob);
          done++;
          onProgress?.(done, total);
        } catch {
          failed++;
        }
      })
    );
  }

  if (signal?.aborted) return false;
  if (failed === 0 && done >= total) {
    await markSurahAudioDownloaded(surahNumber, total);
    return true;
  }
  return false;
}

export async function deleteOfflineSurah(surahNumber: number): Promise<void> {
  try {
    localStorage.removeItem(`ibadat_quran_surah_v5_${surahNumber}`);
  } catch {}
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction([STORE_SURAHS, STORE_AUDIO, STORE_META], 'readwrite');
      tx.objectStore(STORE_SURAHS).delete(surahNumber);
      tx.objectStore(STORE_META).delete(surahNumber);
      const audioStore = tx.objectStore(STORE_AUDIO);
      const idx = audioStore.index('surahNumber');
      const cursorReq = idx.openKeyCursor(IDBKeyRange.only(surahNumber));
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          audioStore.delete(cursor.primaryKey);
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}

export async function clearAllOfflineQuranData(): Promise<void> {
  if (typeof window !== 'undefined' && window.localStorage) {
    for (let s = 1; s <= 114; s++) {
      try {
        localStorage.removeItem(`ibadat_quran_surah_v5_${s}`);
      } catch {}
    }
  }
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction([STORE_SURAHS, STORE_AUDIO, STORE_META], 'readwrite');
      tx.objectStore(STORE_SURAHS).clear();
      tx.objectStore(STORE_AUDIO).clear();
      tx.objectStore(STORE_META).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {}
}
