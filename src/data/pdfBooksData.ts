export interface PdfChapterItem {
  title: string;
  page: number;
  subtitle?: string;
}

export interface PdfBook {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  translator?: string;
  fileUrl: string;
  totalPages: number;
  categoryLabel: string;
  chapters: PdfChapterItem[];
}

export type PdfReaderTheme = 'light' | 'sepia' | 'dark';

export interface PdfReadingProgress {
  page: number;
  totalPages: number;
  updatedAt: number;
  bookmarks: number[];
  theme: PdfReaderTheme;
}

const PDF_PROGRESS_STORAGE_KEY = 'ibadat_pdf_progress_v1';

export const PDF_BOOKS: PdfBook[] = [
  {
    id: 'fataoya_arkanul_islam',
    title: 'ফাতাওয়া আরকানুল ইসলাম',
    subtitle: 'আকীদাহ, সালাত, যাকাত, সওম ও হজ্জ বিষয়ক প্রামাণ্য ফাতাওয়া সংকলন',
    author: 'শাইখ মুহাম্মাদ বিন সালিহ আল-উসাইমীন (রহ.)',
    translator: 'অনুবাদ: মুহাঃ আবদুল্লাহ আল কাফী ও মুহাঃ আবদুল্লাহ শাহেদ',
    fileUrl: './assets/aistudio/fataoya_arkanul_islam_06d2c9c5.pdf',
    totalPages: 594,
    categoryLabel: 'ইসলামী ফাতাওয়া ও আকীদাহ',
    chapters: [
      { title: 'প্রচ্ছদ ও পরিচিতি', page: 1, subtitle: 'গ্রন্থ পরিচিতি ও লেখকের সংক্ষিপ্ত জীবনী' },
      { title: 'সূচীপত্র', page: 10, subtitle: 'সম্পূর্ণ বিষয়ভিত্তিক প্রশ্নোত্তর তালিকা' },
      { title: '১. আক্বীদাহ্ বিষয়ক ফাতাওয়া', page: 50, subtitle: 'প্রশ্ন ১ – ১২০ · ঈমান, তাওহীদ ও আকীদা' },
      { title: '২. সলাত ও পবিত্রতা বিষয়ক ফাতাওয়া', page: 246, subtitle: 'প্রশ্ন ১২১ – ৩৫৩ · ওযু, গোসল, আজান ও নামায' },
      { title: '৩. যাকাত বিষয়ক ফাতাওয়া', page: 452, subtitle: 'প্রশ্ন ৩৫৪ – ৩৯১ · নিসাব ও যাকাত বণ্টন' },
      { title: '৪. সওম (রোযা) বিষয়ক ফাতাওয়া', page: 478, subtitle: 'প্রশ্ন ৩৯২ – ৪৪৮ · সিয়াম, তারাবীহ ও ইতিকাফ' },
      { title: '৫. হাজ্জ ও উমরাহ বিষয়ক ফাতাওয়া', page: 524, subtitle: 'প্রশ্ন ৪৪৯ – ৫৩৯ · ইহরাম, তাওয়াফ ও কুরবানী' },
      { title: 'সমাপ্তি ও প্রচ্ছদ', page: 591, subtitle: 'গ্রন্থ সমাপ্তি' }
    ]
  }
];

export function toBnDigits(input: number | string): string {
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(input).replace(/\d/g, (d) => bn[Number(d)]);
}

export function parsePageInputToNumber(input: string): number {
  const bnMap: Record<string, string> = {
    '০': '0',
    '১': '1',
    '২': '2',
    '৩': '3',
    '৪': '4',
    '৫': '5',
    '৬': '6',
    '৭': '7',
    '৮': '8',
    '৯': '9'
  };
  const normalized = input.replace(/[০-৯]/g, (ch) => bnMap[ch] ?? ch).trim();
  const parsed = parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function readAllPdfProgress(): Record<string, PdfReadingProgress> {
  try {
    const raw = localStorage.getItem(PDF_PROGRESS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAllPdfProgress(map: Record<string, PdfReadingProgress>): void {
  try {
    localStorage.setItem(PDF_PROGRESS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors cleanly
  }
}

export function getPdfReadingProgress(bookId: string, defaultTotalPages = 1): PdfReadingProgress {
  const all = readAllPdfProgress();
  const existing = all[bookId];
  if (existing && typeof existing.page === 'number' && existing.page >= 1) {
    return {
      page: existing.page,
      totalPages: existing.totalPages || defaultTotalPages,
      updatedAt: existing.updatedAt || Date.now(),
      bookmarks: Array.isArray(existing.bookmarks) ? existing.bookmarks : [],
      theme: existing.theme === 'sepia' || existing.theme === 'dark' ? existing.theme : 'light'
    };
  }
  return {
    page: 1,
    totalPages: defaultTotalPages,
    updatedAt: 0,
    bookmarks: [],
    theme: 'light'
  };
}

export function savePdfReadingPage(
  bookId: string,
  page: number,
  totalPages: number
): PdfReadingProgress {
  const all = readAllPdfProgress();
  const prev = getPdfReadingProgress(bookId, totalPages);
  const clampedPage = Math.max(1, Math.min(totalPages || 1, Math.floor(page)));
  const next: PdfReadingProgress = {
    ...prev,
    page: clampedPage,
    totalPages: totalPages || prev.totalPages,
    updatedAt: Date.now()
  };
  all[bookId] = next;
  writeAllPdfProgress(all);
  return next;
}

export function savePdfReaderTheme(bookId: string, theme: PdfReaderTheme): PdfReadingProgress {
  const all = readAllPdfProgress();
  const prev = getPdfReadingProgress(bookId);
  const next: PdfReadingProgress = {
    ...prev,
    theme
  };
  all[bookId] = next;
  writeAllPdfProgress(all);
  return next;
}

export function togglePdfPageBookmark(bookId: string, page: number): PdfReadingProgress {
  const all = readAllPdfProgress();
  const prev = getPdfReadingProgress(bookId);
  const exists = prev.bookmarks.includes(page);
  const bookmarks = exists
    ? prev.bookmarks.filter((p) => p !== page)
    : [...prev.bookmarks, page].sort((a, b) => a - b);
  const next: PdfReadingProgress = {
    ...prev,
    bookmarks
  };
  all[bookId] = next;
  writeAllPdfProgress(all);
  return next;
}
