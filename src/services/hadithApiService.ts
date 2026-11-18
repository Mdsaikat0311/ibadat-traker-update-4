import { HADITH_BOOKS, HadithItem } from '../data/hadithCollection';
import bookSectionsMeta from '../data/bookSectionsMeta.json';
import nawawi40Full from '../data/nawawi40Full.json';
import qudsi40Full from '../data/qudsi40Full.json';
import shamayilFull from '../data/shamayilFull.json';
import selected300Full from '../data/selected300Full.json';
import adabMufradFull from '../data/adabMufradFull.json';
import riyadFull from '../data/riyadFull.json';
import {
  BENGALI_CHAPTER_MAP,
  CANONICAL_HADITH_BOOKS,
  cleanHadithText,
  convertBengaliDigitsToEnglish,
  determineGrade,
  extractNarrator,
  extractReference,
  getBookTitleById,
  getOfflineBookHadiths,
  normalizeBookId,
  parseHadithNum
} from './hadithOfflineService';

// In-memory cache for fast tab/section switching
const sectionCache: Record<string, HadithItem[]> = {};
const hadithCache: Record<string, HadithItem> = {};
const bundledCache: Record<string, HadithItem[]> = {};

export interface BookSectionDetail {
  sectionNumber: number;
  englishTitle: string;
  bengaliTitle: string;
  firstHadithNumber: number;
  lastHadithNumber: number;
  count: number;
}

export class HadithApiService {
  /**
   * Get sections/chapters for a given book
   */
  static getBookSections(bookId: string): BookSectionDetail[] {
    if (bookId === 'nawawi' || bookId === 'nawawi40') {
      return [
        {
          sectionNumber: 1,
          englishTitle: 'Forty Hadith of an-Nawawi',
          bengaliTitle: 'ইমাম নববীর ৪০ হাদিস (সম্পূর্ণ ৪২টি)',
          firstHadithNumber: 1,
          lastHadithNumber: 42,
          count: 42
        }
      ];
    }

    if (bookId === 'qudsi' || bookId === 'qudsi40') {
      return [
        {
          sectionNumber: 1,
          englishTitle: 'Forty Hadith Qudsi',
          bengaliTitle: '৪০ হাদিসে কুদসী (সম্পূর্ণ সংকলন)',
          firstHadithNumber: 1,
          lastHadithNumber: 40,
          count: 40
        }
      ];
    }

    if (bookId === 'shamayil') {
      return extractSectionsFromList(shamayilFull as any[]);
    }

    if (bookId === 'selected300') {
      return extractSectionsFromList(selected300Full as any[]);
    }

    if (bookId === 'adab_mufrad') {
      return extractSectionsFromList(adabMufradFull as any[]);
    }

    if (bookId === 'riyad500' || bookId === 'riyad_full') {
      return extractSectionsFromList(riyadFull as any[]);
    }

    const normId = normalizeBookId(bookId);
    const meta = (bookSectionsMeta as any)[normId];
    if (!meta || !meta.sections) {
      return [
        {
          sectionNumber: 1,
          englishTitle: 'All Hadiths',
          bengaliTitle: 'সকল হাদিস সংকলন',
          firstHadithNumber: 1,
          lastHadithNumber: 50,
          count: 50
        }
      ];
    }

    const sections: BookSectionDetail[] = [];
    const sectionObj = meta.sections;
    const detailsObj = meta.details || {};

    Object.entries(sectionObj).forEach(([secKey, secName]) => {
      const secNum = parseInt(secKey, 10);
      const strName = String(secName).trim();
      if (secNum === 0 && !strName) return;
      if (!strName && secNum !== 1) return;

      const detail = detailsObj[secKey] || {};
      const first = detail.hadithnumber_first || 1;
      const last = detail.hadithnumber_last || first;
      const count = Math.max(1, last - first + 1);

      const bengaliTitle =
        BENGALI_CHAPTER_MAP[strName] ||
        (secNum === 1 && !strName ? 'অধ্যায় ১' : strName);

      sections.push({
        sectionNumber: secNum,
        englishTitle: strName || `Section ${secNum}`,
        bengaliTitle,
        firstHadithNumber: first,
        lastHadithNumber: last,
        count
      });
    });

    return sections;
  }

  /**
   * Fetch all hadiths of a bundled collection at once (100% offline)
   */
  static getAllBundledHadiths(bookId: string): HadithItem[] | null {
    const cacheKey = bookId === 'nawawi' ? 'nawawi40' : bookId === 'qudsi' ? 'qudsi40' : bookId;
    if (bundledCache[cacheKey]) {
      return bundledCache[cacheKey];
    }

    let mapped: HadithItem[] | null = null;
    if (bookId === 'nawawi' || bookId === 'nawawi40') {
      mapped = mapBundledToHadithItems(nawawi40Full as any[], 'nawawi40');
    } else if (bookId === 'qudsi' || bookId === 'qudsi40') {
      mapped = mapBundledToHadithItems(qudsi40Full as any[], 'qudsi40');
    } else if (bookId === 'shamayil') {
      mapped = mapBundledToHadithItems(shamayilFull as any[], 'shamayil');
    } else if (bookId === 'selected300') {
      mapped = mapBundledToHadithItems(selected300Full as any[], 'selected300');
    } else if (bookId === 'adab_mufrad') {
      mapped = mapBundledToHadithItems(adabMufradFull as any[], 'adab_mufrad');
    } else if (bookId === 'riyad500' || bookId === 'riyad_full') {
      mapped = mapBundledToHadithItems(riyadFull as any[], bookId);
    }

    if (mapped) {
      bundledCache[cacheKey] = mapped;
    }
    return mapped;
  }

  /**
   * Load ALL hadiths of any book (bundled OR IndexedDB offline cache).
   * Returns { hadiths, isCompleteOffline }.
   */
  static async getAllBookHadithsOffline(
    bookId: string
  ): Promise<{ hadiths: HadithItem[]; isCompleteOffline: boolean }> {
    const bundled = this.getAllBundledHadiths(bookId);
    if (bundled && bundled.length > 0) {
      return { hadiths: bundled, isCompleteOffline: true };
    }

    const offlineFull = await getOfflineBookHadiths(bookId);
    if (offlineFull && offlineFull.length > 0) {
      return { hadiths: offlineFull, isCompleteOffline: true };
    }

    const staticBook = HADITH_BOOKS.find((b) => b.id === bookId);
    return {
      hadiths: staticBook?.hadiths || [],
      isCompleteOffline: false
    };
  }

  /**
   * Fetch all hadiths of a specific section/chapter for a book (Offline IndexedDB first, CDN fallback)
   */
  static async fetchHadithsBySection(
    bookId: string,
    sectionNumber: number,
    bookTitle: string
  ): Promise<HadithItem[]> {
    const cacheKey = `${bookId}_sec_${sectionNumber}`;
    if (sectionCache[cacheKey]) {
      return sectionCache[cacheKey];
    }

    // 1. Check bundled collections
    const bundled = this.getAllBundledHadiths(bookId);
    if (bundled) {
      if (bookId === 'nawawi' || bookId === 'nawawi40' || bookId === 'qudsi' || bookId === 'qudsi40') {
        sectionCache[cacheKey] = bundled;
        return bundled;
      }
      const sections = this.getBookSections(bookId);
      const targetSec = sections.find((s) => s.sectionNumber === sectionNumber);
      if (targetSec) {
        const filtered = bundled.filter((h) => {
          const num = h.numericNumber ?? parseHadithNum(h.hadithNumber);
          return num >= targetSec.firstHadithNumber && num <= targetSec.lastHadithNumber;
        });
        sectionCache[cacheKey] = filtered;
        return filtered;
      }
      sectionCache[cacheKey] = bundled;
      return bundled;
    }

    // 2. Check full-book IndexedDB offline storage FIRST
    const offlineBook = await getOfflineBookHadiths(bookId);
    if (offlineBook && offlineBook.length > 0) {
      let filtered = offlineBook.filter((h) => h.sectionNumber === sectionNumber);
      if (filtered.length === 0) {
        const sections = this.getBookSections(bookId);
        const targetSec = sections.find((s) => s.sectionNumber === sectionNumber);
        if (targetSec) {
          filtered = offlineBook.filter((h) => {
            const num = h.numericNumber ?? parseHadithNum(h.hadithNumber);
            return num >= targetSec.firstHadithNumber && num <= targetSec.lastHadithNumber;
          });
        }
      }
      if (filtered.length > 0) {
        sectionCache[cacheKey] = filtered;
        return filtered;
      }
    }

    // 3. Online CDN fallback if full book isn't in IndexedDB yet
    const normId = normalizeBookId(bookId);
    const benUrl = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ben-${normId}/sections/${sectionNumber}.min.json`;
    const araUrl = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-${normId}/sections/${sectionNumber}.min.json`;

    try {
      const [benRes, araRes] = await Promise.all([
        fetch(benUrl),
        fetch(araUrl).catch(() => null)
      ]);

      if (!benRes.ok) {
        throw new Error(`Failed to fetch section ${sectionNumber} for ${normId}`);
      }

      const benData = await benRes.json();
      let araData: any = null;
      if (araRes && araRes.ok) {
        try {
          araData = await araRes.json();
        } catch {}
      }

      const araMap: Record<number, string> = {};
      if (araData && Array.isArray(araData.hadiths)) {
        araData.hadiths.forEach((h: any) => {
          araMap[h.hadithnumber] = h.text;
        });
      }

      const sectionTitle =
        benData.metadata?.section?.[String(sectionNumber)] ||
        benData.metadata?.sections?.[String(sectionNumber)] ||
        `অধ্যায় ${sectionNumber}`;
      const bnSectionTitle = BENGALI_CHAPTER_MAP[sectionTitle] || sectionTitle;

      const hadiths: HadithItem[] = (benData.hadiths || []).map((h: any) => {
        const arabicText = araMap[h.hadithnumber] || '';
        const rawText = h.text || '';
        const referenceStr = extractReference(rawText, bookTitle, h.hadithnumber);

        return {
          id: `${bookId}_${h.hadithnumber}`,
          bookId,
          bookTitle,
          hadithNumber: `হাদিস নং ${h.hadithnumber}`,
          numericNumber: Math.floor(Number(h.hadithnumber) || 0),
          sectionNumber,
          chapter: bnSectionTitle,
          narrator: extractNarrator(rawText),
          arabic: arabicText,
          translation: cleanHadithText(rawText),
          grade: determineGrade(h.grades, rawText),
          reference: referenceStr
        };
      });

      sectionCache[cacheKey] = hadiths;
      return hadiths;
    } catch (err) {
      console.warn(`Error fetching section ${sectionNumber} for ${bookId}:`, err);
      return [];
    }
  }

  /**
   * Fetch a single Hadith directly by its number (Offline IndexedDB/Bundled first, CDN fallback)
   */
  static async fetchHadithByNumber(
    bookId: string,
    hadithNumber: number,
    bookTitle: string
  ): Promise<HadithItem | null> {
    const cacheKey = `${bookId}_single_${hadithNumber}`;
    if (hadithCache[cacheKey]) {
      return hadithCache[cacheKey];
    }

    // 1. Check bundled collections
    const bundledAll = this.getAllBundledHadiths(bookId);
    if (bundledAll) {
      const match = bundledAll.find(
        (h) => (h.numericNumber ?? parseHadithNum(h.hadithNumber)) === hadithNumber
      );
      if (match) {
        hadithCache[cacheKey] = match;
        return match;
      }
    }

    // 2. Check IndexedDB full-book offline store
    const offlineBook = await getOfflineBookHadiths(bookId);
    if (offlineBook && offlineBook.length > 0) {
      const match =
        offlineBook.find((h) => h.numericNumber === hadithNumber) ||
        offlineBook.find((h) => parseHadithNum(h.hadithNumber) === hadithNumber);
      if (match) {
        hadithCache[cacheKey] = match;
        return match;
      }
    }

    // 3. Check static sample items in HADITH_BOOKS
    const staticMatch = HADITH_BOOKS.find((b) => b.id === bookId)?.hadiths.find(
      (h) => parseHadithNum(h.hadithNumber) === hadithNumber
    );
    if (staticMatch) {
      return staticMatch;
    }

    // 4. Online fallback if book hasn't finished downloading yet
    const normId = normalizeBookId(bookId);
    const benUrl = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ben-${normId}/${hadithNumber}.min.json`;
    const araUrl = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/ara-${normId}/${hadithNumber}.min.json`;

    try {
      const [benRes, araRes] = await Promise.all([
        fetch(benUrl),
        fetch(araUrl).catch(() => null)
      ]);

      if (!benRes.ok) return null;

      const benData = await benRes.json();
      const rawHadith = benData.hadiths?.[0];
      if (!rawHadith) return null;

      let arabicText = '';
      if (araRes && araRes.ok) {
        try {
          const araData = await araRes.json();
          arabicText = araData.hadiths?.[0]?.text || '';
        } catch {}
      }

      const secObj = benData.metadata?.section || benData.metadata?.sections || {};
      const secName = Object.values(secObj)[0] || 'হাদিস সংকলন';
      const bnSec = BENGALI_CHAPTER_MAP[String(secName)] || String(secName);

      const item: HadithItem = {
        id: `${bookId}_${rawHadith.hadithnumber}`,
        bookId,
        bookTitle,
        hadithNumber: `হাদিস নং ${rawHadith.hadithnumber}`,
        numericNumber: Math.floor(Number(rawHadith.hadithnumber) || 0),
        chapter: bnSec,
        narrator: extractNarrator(rawHadith.text || ''),
        arabic: arabicText,
        translation: cleanHadithText(rawHadith.text || ''),
        grade: determineGrade(rawHadith.grades, rawHadith.text || ''),
        reference: extractReference(rawHadith.text || '', bookTitle, rawHadith.hadithnumber)
      };

      hadithCache[cacheKey] = item;
      return item;
    } catch (e) {
      console.warn(`Error fetching hadith ${hadithNumber} for ${bookId}:`, e);
      return null;
    }
  }

  /**
   * Search across ALL 14 Hadith books completely offline (Bundled JSON + IndexedDB).
   * Supports multi-word queries, Arabic/Bengali/English text, book names, and Bengali/English Hadith numbers.
   */
  static async searchAllOfflineHadiths(
    rawQuery: string,
    limit = 100
  ): Promise<{ results: HadithItem[]; totalMatches: number }> {
    const trimmed = rawQuery.trim();
    if (!trimmed) return { results: [], totalMatches: 0 };

    const normalizedQuery = convertBengaliDigitsToEnglish(trimmed).toLowerCase();
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const isPureNumber = /^\d+$/.test(normalizedQuery);
    const exactNumTarget = isPureNumber ? parseInt(normalizedQuery, 10) : null;

    const exactNumberMatches: HadithItem[] = [];
    const textMatches: HadithItem[] = [];

    const bundledBookIds = [
      'nawawi40',
      'qudsi40',
      'shamayil',
      'selected300',
      'adab_mufrad',
      'riyad_full'
    ];

    const checkBookList = (items: HadithItem[], defaultBookTitle: string) => {
      const lowerBookTitle = defaultBookTitle.toLowerCase();
      for (let i = 0; i < items.length; i++) {
        const h = items[i];
        const bTitle = h.bookTitle || defaultBookTitle;

        if (exactNumTarget !== null) {
          const num = h.numericNumber ?? parseHadithNum(h.hadithNumber);
          if (num === exactNumTarget) {
            exactNumberMatches.push(h.bookTitle ? h : { ...h, bookTitle: bTitle });
            continue;
          }
        }

        // Fast token check
        let allMatch = true;
        for (let t = 0; t < tokens.length; t++) {
          const tok = tokens[t];
          const numStr = String(h.numericNumber ?? parseHadithNum(h.hadithNumber));
          const inBasic =
            lowerBookTitle.includes(tok) ||
            numStr === tok ||
            h.hadithNumber.toLowerCase().includes(tok) ||
            h.chapter.toLowerCase().includes(tok) ||
            h.narrator.toLowerCase().includes(tok) ||
            h.translation.toLowerCase().includes(tok) ||
            h.reference.toLowerCase().includes(tok) ||
            (h.explanation ? h.explanation.toLowerCase().includes(tok) : false) ||
            h.arabic.includes(trimmed);

          if (!inBasic) {
            allMatch = false;
            break;
          }
        }

        if (allMatch) {
          textMatches.push(h.bookTitle ? h : { ...h, bookTitle: bTitle });
        }
      }
    };

    // 1. Search all bundled offline books
    for (const bId of bundledBookIds) {
      const items = this.getAllBundledHadiths(bId);
      if (items) {
        checkBookList(items, getBookTitleById(bId));
      }
    }

    // 2. Search all 7 canonical books stored in IndexedDB (or static samples if not synced yet)
    for (const canon of CANONICAL_HADITH_BOOKS) {
      const offlineItems = await getOfflineBookHadiths(canon.bookId);
      if (offlineItems && offlineItems.length > 0) {
        checkBookList(offlineItems, canon.title);
      } else {
        const staticSamples = HADITH_BOOKS.find((b) => b.id === canon.bookId)?.hadiths || [];
        checkBookList(staticSamples, canon.title);
      }
    }

    const combined = [...exactNumberMatches, ...textMatches];
    return {
      results: combined.slice(0, limit),
      totalMatches: combined.length
    };
  }

  /**
   * Resolve a Set of bookmarked Hadith IDs across all bundled + IndexedDB books offline
   */
  static async getHadithsByIds(ids: Set<string>): Promise<HadithItem[]> {
    if (ids.size === 0) return [];
    const foundMap = new Map<string, HadithItem>();

    // 1. Static HADITH_BOOKS samples
    for (const book of HADITH_BOOKS) {
      for (const h of book.hadiths) {
        if (ids.has(h.id) && !foundMap.has(h.id)) {
          foundMap.set(h.id, { ...h, bookTitle: book.title });
        }
      }
    }

    // 2. Bundled JSON books
    const bundledIds = ['nawawi40', 'qudsi40', 'shamayil', 'selected300', 'adab_mufrad', 'riyad500', 'riyad_full'];
    for (const bId of bundledIds) {
      if (foundMap.size >= ids.size) break;
      const list = this.getAllBundledHadiths(bId) || [];
      for (const h of list) {
        if (ids.has(h.id) && !foundMap.has(h.id)) {
          foundMap.set(h.id, h);
        }
      }
    }

    // 3. IndexedDB canonical books
    for (const canon of CANONICAL_HADITH_BOOKS) {
      if (foundMap.size >= ids.size) break;
      // Optimization: only open IDB book if any wanted id starts with `${canon.bookId}_`
      const hasPotential = Array.from(ids).some((id) => id.startsWith(`${canon.bookId}_`));
      if (!hasPotential) continue;
      const list = (await getOfflineBookHadiths(canon.bookId)) || [];
      for (const h of list) {
        if (ids.has(h.id) && !foundMap.has(h.id)) {
          foundMap.set(h.id, h);
        }
      }
    }

    return Array.from(foundMap.values());
  }
}

// Local Helpers
function extractSectionsFromList(list: any[]): BookSectionDetail[] {
  const chapterMap = new Map<string, { first: number; last: number; count: number }>();
  list.forEach((item) => {
    const ch = item.chapter || 'সাধারণ';
    const num = item.hadithnumber || 1;
    if (!chapterMap.has(ch)) {
      chapterMap.set(ch, { first: num, last: num, count: 1 });
    } else {
      const curr = chapterMap.get(ch)!;
      curr.last = Math.max(curr.last, num);
      curr.count += 1;
    }
  });

  const sections: BookSectionDetail[] = [];
  let secIdx = 1;
  chapterMap.forEach((meta, chName) => {
    sections.push({
      sectionNumber: secIdx,
      englishTitle: chName,
      bengaliTitle: chName,
      firstHadithNumber: meta.first,
      lastHadithNumber: meta.last,
      count: meta.count
    });
    secIdx++;
  });

  return sections;
}

function mapBundledToHadithItems(list: any[], bookId: string): HadithItem[] {
  const bookTitle = getBookTitleById(bookId);
  return list.map((h) => ({
    id: `${bookId}_${h.hadithnumber}`,
    bookId,
    bookTitle,
    hadithNumber: `হাদিস নং ${h.hadithnumber}`,
    numericNumber: Math.floor(Number(h.hadithnumber) || 0),
    chapter: h.chapter || 'হাদিস সংকলন',
    narrator: h.narrator || extractNarrator(h.text || ''),
    arabic: h.arabicText || '',
    translation: cleanHadithText(h.text || ''),
    grade: (h.grade as any) || 'সহীহ',
    reference: h.reference || `${bookTitle}: হাদিস নং ${h.hadithnumber}`,
    explanation: h.explanation
  }));
}
