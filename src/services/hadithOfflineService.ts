import { HADITH_BOOKS, HadithItem } from '../data/hadithCollection';
import bookSectionsMeta from '../data/bookSectionsMeta.json';

const DB_NAME = 'ibadat_hadith_offline_db';
const DB_VERSION = 1;
const STORE_BOOKS = 'book_hadiths';
const STORE_META = 'sync_meta';
const CURRENT_DATA_VERSION = 1;

export interface CanonicalBookInfo {
  bookId: string;
  normId: string;
  title: string;
}

export const CANONICAL_HADITH_BOOKS: CanonicalBookInfo[] = [
  { bookId: 'bukhari', normId: 'bukhari', title: 'সহীহ বুখারী' },
  { bookId: 'muslim', normId: 'muslim', title: 'সহীহ মুসলিম' },
  { bookId: 'abudawood', normId: 'abudawud', title: 'সুনানে আবু দাউদ' },
  { bookId: 'tirmidhi', normId: 'tirmidhi', title: "জামে' আত-তিরমিযী" },
  { bookId: 'nasai', normId: 'nasai', title: 'সুনানে আন-নাসায়ী' },
  { bookId: 'ibnmajah', normId: 'ibnmajah', title: 'সুনানে ইবনে মাজাহ' },
  { bookId: 'malik', normId: 'malik', title: 'মুয়াত্তা ইমাম মালিক' }
];

export const BENGALI_CHAPTER_MAP: Record<string, string> = {
  'Revelation': 'ওহীর সূচনা',
  'Belief': 'ঈমান ও বিশ্বাস',
  'Knowledge': 'ইলম ও জ্ঞান',
  "Ablutions (Wudu')": 'পবিত্রতা ও ওযু',
  'Bathing (Ghusl)': 'গোসলের নিয়মাবলী',
  'Menstrual Periods': 'ঋতুস্রাব (হায়েয)',
  'Rubbing hands and feet with dust (Tayammum)': 'তায়াম্মুম',
  'Prayers (Salat)': 'সালাত ও নামাজ',
  'Times of the Prayers': 'সালাতের ওয়াক্তসমূহ',
  'Call to Prayers (Adhaan)': 'আযান ও ইকামাত',
  'Characteristics of Prayer': 'নামাজের বৈশিষ্ট্য ও নিয়ম',
  'Friday Prayer': 'জুমু‘আর নামাজ',
  'Fear Prayer': 'ভয়ের সালাত',
  'The Two Festivals (Eids)': 'দুই ঈদের নামাজ',
  'Witr Prayer': 'বিতর সালাত',
  'Invoking Allah for Rain (Istisqaa)': 'বৃষ্টির জন্য প্রার্থনা (ইস্তিসকা)',
  'Eclipses': 'সূর্যগ্রহণ ও চন্দ্রগ্রহণ (কুসূফ)',
  'Prostration During Recitation of Quran': 'সিজদায়ে তিলাওয়াত',
  'Shortening the Prayers (At-Taqseer)': 'কসর সালাত (মুসাফিরের নামাজ)',
  'Prayer at Night (Tahajjud)': 'তাহাজ্জুদ ও রাতের নামাজ',
  'Actions while Praying': 'নামাজের মধ্যকার আমল',
  'Funerals (Al-Janaaiz)': 'জানাযার নামাজ ও কাফন-দাফন',
  'Obligatory Charity Tax (Zakat)': 'যাকাত ও সদকা',
  'Obligatory Charity Tax After Ramadan (Zakat ul Fitr)': 'সাদকাতুল ফিতর',
  'Hajj (Pilgrimage)': 'হজ্জ ও উমরাহ',
  'Fasting': 'সাওম ও রোজা',
  'Praying at Night in Ramadaan (Taraweeh)': 'তারাবীহ সালাত',
  "Retiring to a Mosque for Remembrance of Allah (I'tikaf)": 'ইতিকাফ',
  'Sales and Trade': 'ক্রয়-বিক্রয় ও বাণিজ্য',
  'Distribution of Water': 'পানি বণ্টন ও সেচ',
  'Loans, Payment of Loans, Freezing of Property, Bankruptcy': 'ঋণ ও পাওনা পরিশোধ',
  'Lost Things Picked up by Someone (Luqatah)': 'হারানো বস্তু প্রাপ্তি (লুকতাহ)',
  'Oppressions': 'জুলুম ও অত্যাচার প্রতিরোধ',
  'Partnership': 'অংশীদারি কারবার',
  'Mortgaging': 'বন্ধক রাখা',
  'Manumission of Slaves': 'দাসমুক্তি ও মানবকল্যাণ',
  'Gifts': 'উপহার ও হাদিয়া বিনিময়',
  'Witnesses': 'সাক্ষ্য ও বিচার',
  'Peacemaking': 'পারস্পরিক মীমাংসা ও সম্প্রীতি',
  'Conditions': 'চুক্তি ও শর্তাবলী',
  'Wills and Testaments (Wasaayaa)': 'অসিয়ত ও উইল',
  'Fighting for the Cause of Allah (Jihaad)': 'আল্লাহর পথে সংগ্রাম ও আত্মত্যাগ',
  'One-fifth of Booty to the Cause of Allah (Khumus)': 'গনীমতের সম্পদ বণ্টন',
  'Prophets': 'নবী-রাসূলগণের ঘটনা ও শিক্ষা',
  'Virtues and Merits of the Prophet (pbuh) and his Companions': 'রাসূলুল্লাহ (ﷺ) ও সাহাবীদের মর্যাদা',
  'Companions of the Prophet': 'সাহাবায়ে কিরামের জীবনী ও ফযিলত',
  'Merits of the Helpers in Madinah (Ansaar)': 'আনসারদের মর্যাদা',
  'Military Expeditions led by the Prophet (pbuh) (Al-Maghaazi)': 'মাগাযী (ঐতিহাসিক যুদ্ধ ও বিজয়)',
  "Prophetic Commentary on the Qur'an (Tafseer)": 'কুরআনের তাফসীর ও ব্যাখ্যা',
  "Virtues of the Qur'an": 'পবিত্র কুরআনের ফযিলত',
  'Wedlock, Marriage (Nikaah)': 'বিবাহ ও দাম্পত্য জীবন',
  'Divorce': 'তালাক ও পারিবারিক সমাধান',
  'Supporting the Family': 'পরিবারের ভরণপোষণ',
  'Food, Meals': 'খাদ্য ও আহারের আদব',
  'Sacrifice on Occasion of Birth (`Aqiqa)': 'আকিকা',
  'Hunting, Slaughtering': 'শিকার ও হালাল যবাই',
  'Al-Adha Festival Sacrifice (Al-Udhiyah)': 'কোরবানি',
  'Drinks': 'পানীয় ও পানাহারের আদব',
  'Patients': 'রোগীর সেবা ও পরিচর্যা',
  'Medicine': 'চিকিৎসা ও শেফা',
  'Dress': 'পোশাক-পরিচ্ছদ ও শালীনতা',
  'Good Manners and Form (Al-Adab)': 'উত্তম চরিত্র ও শিষ্টাচার (আদব)',
  'Asking for Permission': 'অনুমতি প্রার্থনা ও সালাম',
  'Invocations': 'দোয়া ও যিকির',
  'To make the Heart Tender (Ar-Riqaq)': 'অন্তর গলানো উপদেশ (রিকাক)',
  'Divine Will (Al-Qadar)': 'তাকদীর ও ভাগ্য',
  'Oaths and Vows': 'কসম ও মান্নত',
  "Holding Fast to the Qur'an and Sunnah": 'কুরআন ও সুন্নাহকে আঁকড়ে ধরা',
  'Sayings of the Prophet': 'নবীজীর বাণী',
  'Forty Hadith of an-Nawawi': 'ইমাম নববীর ৪০ হাদিস',
  'Forty Hadith Qudsi': '৪০ হাদিসে কুদসী'
};

export function normalizeBookId(bookId: string): string {
  if (bookId === 'abudawood') return 'abudawud';
  if (bookId === 'nawawi40') return 'nawawi';
  if (bookId === 'qudsi40') return 'qudsi';
  return bookId;
}

export function convertBengaliDigitsToEnglish(str: string): string {
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[০-৯]/g, (d) => String(bn.indexOf(d)));
}

export function toBengaliDigits(val: number | string): string {
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(val).replace(/\d/g, (d) => bn[parseInt(d, 10)] || d);
}

export function parseHadithNum(label: string): number {
  const normalized = convertBengaliDigitsToEnglish(label);
  const match = normalized.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export function extractNarrator(text: string): string {
  const match1 = text.match(
    /([^\n।]+?(?:হতে বর্ণিত|\(রাঃ\)[^।\n]*?বলেন|\(রাঃ\)[^।\n]*?বর্ণনা করেছেন))/
  );
  if (match1 && match1[1].length < 120) {
    return match1[1].trim();
  }
  return 'সাহাবী (রাঃ)';
}

export function cleanHadithText(text: string): string {
  return text.trim();
}

export function extractReference(text: string, defaultBook: string, hadithNum: number): string {
  const match =
    text.match(/\[([^\]]+)\]$/) ||
    text.match(/\(([^)]*(?:আধুনিক|ইসলামিক|মুসলিম|বুখারী)[^)]*)\)/);
  if (match && match[1]) {
    return `${defaultBook}: ${match[1].trim()}`;
  }
  return `${defaultBook}: হাদিস নং ${hadithNum}`;
}

export function determineGrade(
  grades: any[],
  text: string
): 'সহীহ' | 'হাসান' | 'মুতাওয়াতির' | 'হাসান সহীহ' {
  if (Array.isArray(grades) && grades.length > 0) {
    const g = String(grades[0]?.grade || '').toLowerCase();
    if (g.includes('sahih')) return 'সহীহ';
    if (g.includes('hasan')) return 'হাসান';
  }
  if (text.includes('সহীহ') || text.includes('বুখারী') || text.includes('মুসলিম')) {
    return 'সহীহ';
  }
  return 'সহীহ';
}

interface StoredBookRecord {
  bookId: string;
  version: number;
  hadiths: HadithItem[];
  downloadedAt: number;
}

interface SyncMetaRecord {
  bookId: string;
  version: number;
  count: number;
  downloadedAt: number;
}

export type HadithSyncStatus = 'idle' | 'downloading' | 'completed' | 'error';

export interface HadithSyncState {
  status: HadithSyncStatus;
  downloadedBookIds: string[];
  totalBooks: number;
  currentBookId: string | null;
  currentBookTitle: string;
  totalHadithsStored: number;
  errorMessage: string | null;
}

// Fast in-memory cache for books read/downloaded during this session
const bookMemoryCache: Record<string, HadithItem[]> = {};

let syncState: HadithSyncState = {
  status: 'idle',
  downloadedBookIds: [],
  totalBooks: CANONICAL_HADITH_BOOKS.length,
  currentBookId: null,
  currentBookTitle: '',
  totalHadithsStored: 0,
  errorMessage: null
};

const listeners = new Set<(state: HadithSyncState) => void>();
let activeSyncPromise: Promise<void> | null = null;
let autoSyncInitialized = false;
let dbPromise: Promise<IDBDatabase> | null = null;

function notifyListeners() {
  const snapshot: HadithSyncState = {
    ...syncState,
    downloadedBookIds: [...syncState.downloadedBookIds]
  };
  listeners.forEach((cb) => {
    try {
      cb(snapshot);
    } catch {}
  });
}

export function getHadithSyncState(): HadithSyncState {
  return {
    ...syncState,
    downloadedBookIds: [...syncState.downloadedBookIds]
  };
}

export function subscribeHadithSync(listener: (state: HadithSyncState) => void): () => void {
  listeners.add(listener);
  listener(getHadithSyncState());
  return () => {
    listeners.delete(listener);
  };
}

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_BOOKS)) {
        db.createObjectStore(STORE_BOOKS, { keyPath: 'bookId' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'bookId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

export async function getOfflineBookHadiths(bookId: string): Promise<HadithItem[] | null> {
  if (bookMemoryCache[bookId] && bookMemoryCache[bookId].length > 0) {
    return bookMemoryCache[bookId];
  }

  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_BOOKS, 'readonly');
      const req = tx.objectStore(STORE_BOOKS).get(bookId);
      req.onsuccess = () => {
        const res = req.result as StoredBookRecord | undefined;
        if (res && Array.isArray(res.hadiths) && res.hadiths.length > 0) {
          bookMemoryCache[bookId] = res.hadiths;
          resolve(res.hadiths);
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

export async function saveOfflineBookHadiths(bookId: string, hadiths: HadithItem[]): Promise<void> {
  bookMemoryCache[bookId] = hadiths;
  try {
    const db = await openDB();
    const now = Date.now();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_BOOKS, STORE_META], 'readwrite');
      tx.objectStore(STORE_BOOKS).put({
        bookId,
        version: CURRENT_DATA_VERSION,
        hadiths,
        downloadedAt: now
      } as StoredBookRecord);
      tx.objectStore(STORE_META).put({
        bookId,
        version: CURRENT_DATA_VERSION,
        count: hadiths.length,
        downloadedAt: now
      } as SyncMetaRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn(`Failed saving offline hadiths for ${bookId}:`, err);
  }
}

export async function getAllSyncMeta(): Promise<SyncMetaRecord[]> {
  try {
    const db = await openDB();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).getAll();
      req.onsuccess = () => {
        const list = (req.result || []) as SyncMetaRecord[];
        resolve(list.filter((m) => m.version === CURRENT_DATA_VERSION && m.count > 0));
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function refreshSyncMetaState(): Promise<SyncMetaRecord[]> {
  const metaList = await getAllSyncMeta();
  const downloadedIds = metaList
    .map((m) => m.bookId)
    .filter((id) => CANONICAL_HADITH_BOOKS.some((b) => b.bookId === id));
  const totalStored = metaList.reduce((acc, m) => acc + (m.count || 0), 0);

  syncState = {
    ...syncState,
    downloadedBookIds: downloadedIds,
    totalHadithsStored: totalStored,
    status:
      downloadedIds.length >= CANONICAL_HADITH_BOOKS.length
        ? 'completed'
        : syncState.status
  };
  notifyListeners();
  return metaList;
}

function buildSectionRanges(normId: string): Array<{ secNum: number; first: number; last: number; bnTitle: string }> {
  const meta = (bookSectionsMeta as any)[normId];
  if (!meta || !meta.sections) return [];
  const ranges: Array<{ secNum: number; first: number; last: number; bnTitle: string }> = [];
  const detailsObj = meta.details || {};
  Object.entries(meta.sections).forEach(([secKey, secName]) => {
    const secNum = parseInt(secKey, 10);
    const strName = String(secName || '').trim();
    if (secNum === 0 && !strName) return;
    if (!strName && secNum !== 1) return;
    const d = detailsObj[secKey] || {};
    const first = Number(d.hadithnumber_first) || 1;
    const last = Number(d.hadithnumber_last) || first;
    const bnTitle = BENGALI_CHAPTER_MAP[strName] || (secNum === 1 && !strName ? 'অধ্যায় ১' : strName);
    ranges.push({ secNum, first, last, bnTitle });
  });
  return ranges;
}

function mapFullBookToHadithItems(
  bookInfo: CanonicalBookInfo,
  benData: any,
  araData: any
): HadithItem[] {
  const { bookId, normId, title: bookTitle } = bookInfo;
  const araMap: Record<string, string> = {};
  if (araData && Array.isArray(araData.hadiths)) {
    for (let i = 0; i < araData.hadiths.length; i++) {
      const ah = araData.hadiths[i];
      if (ah && ah.hadithnumber !== undefined && ah.text) {
        araMap[String(ah.hadithnumber)] = ah.text;
      }
    }
  }

  const sectionsMeta = benData?.metadata?.sections || {};
  const ranges = buildSectionRanges(normId);

  const rawHadiths: any[] = Array.isArray(benData?.hadiths) ? benData.hadiths : [];
  const mapped: HadithItem[] = new Array(rawHadiths.length);

  for (let i = 0; i < rawHadiths.length; i++) {
    const h = rawHadiths[i];
    const hNumRaw = h.hadithnumber ?? i + 1;
    const hNum = Number(hNumRaw);
    const rawText = String(h.text || '');

    let secNum = Number(h.reference?.book);
    if (!secNum || isNaN(secNum)) {
      const foundRange = ranges.find((r) => hNum >= r.first && hNum <= r.last);
      secNum = foundRange ? foundRange.secNum : 1;
    }

    const rawSecTitle =
      sectionsMeta[String(secNum)] ||
      ranges.find((r) => r.secNum === secNum)?.bnTitle ||
      `অধ্যায় ${secNum}`;
    const bnSectionTitle = BENGALI_CHAPTER_MAP[String(rawSecTitle)] || String(rawSecTitle);

    mapped[i] = {
      id: `${bookId}_${hNumRaw}`,
      bookId,
      bookTitle,
      hadithNumber: `হাদিস নং ${hNumRaw}`,
      numericNumber: Math.floor(hNum),
      sectionNumber: secNum,
      chapter: bnSectionTitle,
      narrator: extractNarrator(rawText),
      arabic: araMap[String(hNumRaw)] || '',
      translation: cleanHadithText(rawText),
      grade: determineGrade(h.grades, rawText),
      reference: extractReference(rawText, bookTitle, hNumRaw)
    };
  }

  return mapped;
}

async function downloadAndStoreSingleBook(bookInfo: CanonicalBookInfo): Promise<number> {
  const benUrl = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ben-${bookInfo.normId}.min.json`;
  const araUrl = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-${bookInfo.normId}.min.json`;

  const [benRes, araRes] = await Promise.all([
    fetch(benUrl, { cache: 'force-cache' }),
    fetch(araUrl, { cache: 'force-cache' }).catch(() => null)
  ]);

  if (!benRes.ok) {
    throw new Error(`HTTP ${benRes.status} while fetching ${bookInfo.normId}`);
  }

  const benData = await benRes.json();
  let araData: any = null;
  if (araRes && araRes.ok) {
    try {
      araData = await araRes.json();
    } catch {
      araData = null;
    }
  }

  const items = mapFullBookToHadithItems(bookInfo, benData, araData);
  if (items.length === 0) {
    throw new Error(`Empty dataset received for ${bookInfo.normId}`);
  }

  await saveOfflineBookHadiths(bookInfo.bookId, items);
  return items.length;
}

/**
 * Ensures all 7 canonical Hadith books (Bukhari, Muslim, Abu Dawood, Tirmidhi, Nasai, Ibn Majah, Malik)
 * are downloaded in full and stored in IndexedDB for 100% offline reading and searching.
 */
export async function ensureAllHadithsDownloadedOffline(force = false): Promise<void> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    try {
      const metaList = await refreshSyncMetaState();
      const downloadedSet = new Set(
        metaList.map((m) => m.bookId).filter((id) => CANONICAL_HADITH_BOOKS.some((b) => b.bookId === id))
      );

      const missingBooks = force
        ? CANONICAL_HADITH_BOOKS
        : CANONICAL_HADITH_BOOKS.filter((b) => !downloadedSet.has(b.bookId));

      if (missingBooks.length === 0) {
        syncState = {
          ...syncState,
          status: 'completed',
          currentBookId: null,
          currentBookTitle: '',
          errorMessage: null
        };
        notifyListeners();
        return;
      }

      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        syncState = {
          ...syncState,
          status: 'error',
          currentBookId: null,
          currentBookTitle: '',
          errorMessage: 'অফলাইন মোড: ইন্টারনেট সংযোগ পেলে অবশিষ্ট হাদিস কিতাবগুলো স্বয়ংক্রিয়ভাবে ডাউনলোড হবে।'
        };
        notifyListeners();
        return;
      }

      syncState = {
        ...syncState,
        status: 'downloading',
        errorMessage: null
      };
      notifyListeners();

      let failedCount = 0;

      for (const book of missingBooks) {
        syncState = {
          ...syncState,
          status: 'downloading',
          currentBookId: book.bookId,
          currentBookTitle: book.title
        };
        notifyListeners();

        try {
          await downloadAndStoreSingleBook(book);
          await refreshSyncMetaState();
        } catch (err) {
          failedCount++;
          console.warn(`Offline sync failed for ${book.bookId}:`, err);
        }
      }

      const finalMeta = await refreshSyncMetaState();
      const allDone = CANONICAL_HADITH_BOOKS.every((b) =>
        finalMeta.some((m) => m.bookId === b.bookId)
      );

      if (allDone) {
        syncState = {
          ...syncState,
          status: 'completed',
          currentBookId: null,
          currentBookTitle: '',
          errorMessage: null
        };
      } else {
        syncState = {
          ...syncState,
          status: 'error',
          currentBookId: null,
          currentBookTitle: '',
          errorMessage:
            failedCount > 0
              ? 'কিছু কিতাব ডাউনলোড অসম্পূর্ণ রয়েছে। ইন্টারনেট সংযোগ নিশ্চিত করে রিট্রাই করুন।'
              : 'ডাউনলোড অসম্পূর্ণ রয়েছে।'
        };
      }
      notifyListeners();
    } finally {
      activeSyncPromise = null;
    }
  })();

  return activeSyncPromise;
}

/**
 * Call once when the app starts so all Hadiths are downloaded automatically
 * on first launch and resumed automatically if connectivity comes back.
 */
export function initHadithOfflineAutoSync(): void {
  if (autoSyncInitialized) return;
  autoSyncInitialized = true;

  // Hydrate existing IndexedDB state immediately
  refreshSyncMetaState().then((meta) => {
    const allDone = CANONICAL_HADITH_BOOKS.every((b) =>
      meta.some((m) => m.bookId === b.bookId)
    );
    if (!allDone) {
      // Slight delay so initial React render is completely unblocked
      setTimeout(() => {
        ensureAllHadithsDownloadedOffline().catch(() => {});
      }, 900);
    }
  });

  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      ensureAllHadithsDownloadedOffline().catch(() => {});
    });
  }
}

export function getBookTitleById(bookId: string): string {
  const found = HADITH_BOOKS.find((b) => b.id === bookId);
  if (found) return found.title;
  const canon = CANONICAL_HADITH_BOOKS.find((b) => b.bookId === bookId);
  return canon ? canon.title : bookId;
}
