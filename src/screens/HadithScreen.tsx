import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BookOpen,
  Bookmark,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Search,
  Copy,
  Check,
  Share2,
  Award,
  Sparkles,
  Layers,
  Hash,
  Loader2,
  ArrowRight,
  ChevronDown,
  X
} from 'lucide-react';
import { HADITH_BOOKS, HadithBook, HadithItem } from '../data/hadithCollection';
import { HadithApiService, BookSectionDetail } from '../services/hadithApiService';
import {
  HadithSyncState,
  convertBengaliDigitsToEnglish,
  ensureAllHadithsDownloadedOffline,
  getHadithSyncState,
  parseHadithNum,
  subscribeHadithSync,
  toBengaliDigits
} from '../services/hadithOfflineService';

interface HadithScreenProps {
  onShowAlert?: (msg: string, isSuccess: boolean) => void;
}

const RENDER_BATCH_SIZE = 50;
const GLOBAL_SEARCH_LIMIT = 150;

export const HadithScreen: React.FC<HadithScreenProps> = ({ onShowAlert }) => {
  const [selectedBook, setSelectedBook] = useState<HadithBook | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyBookmarks, setOnlyBookmarks] = useState(false);
  const [fontSizeLevel, setFontSizeLevel] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('hadith_font_size') || '1', 10);
    } catch {
      return 1;
    }
  });
  const [showArabic, setShowArabic] = useState(true);

  // Offline Sync State
  const [syncState, setSyncState] = useState<HadithSyncState>(() => getHadithSyncState());

  // View Mode: 'all' (সব হাদিস একসাথে) or 'chapter' (অধ্যায়ভিত্তিক) - Default is ALWAYS 'all'
  const [viewMode, setViewMode] = useState<'all' | 'chapter'>('all');
  const [showChapterModal, setShowChapterModal] = useState<boolean>(false);
  const [chapterSearch, setChapterSearch] = useState<string>('');
  const [loadedSectionsInAllMode, setLoadedSectionsInAllMode] = useState<number[]>([1]);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Dynamic Hadiths State
  const [sections, setSections] = useState<BookSectionDetail[]>([]);
  const [selectedSectionNum, setSelectedSectionNum] = useState<number>(1);
  const [activeHadiths, setActiveHadiths] = useState<HadithItem[]>([]);
  const [isBookCompleteOffline, setIsBookCompleteOffline] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [visibleLimit, setVisibleLimit] = useState<number>(RENDER_BATCH_SIZE);
  const [jumpHadithNum, setJumpHadithNum] = useState<string>('');
  const [searchedSingleHadith, setSearchedSingleHadith] = useState<HadithItem | null>(null);

  // Global Cross-Book Offline Search State
  const [globalSearchResults, setGlobalSearchResults] = useState<HadithItem[]>([]);
  const [globalTotalMatches, setGlobalTotalMatches] = useState<number>(0);
  const [isGlobalSearching, setIsGlobalSearching] = useState<boolean>(false);
  const [globalVisibleLimit, setGlobalVisibleLimit] = useState<number>(30);

  // Bookmarks store in localStorage + resolved items across all books
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('ibadat_hadith_bookmarks');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  const [bookmarkedHadiths, setBookmarkedHadiths] = useState<HadithItem[]>([]);
  const [loadingBookmarks, setLoadingBookmarks] = useState<boolean>(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Subscribe to offline sync updates and trigger initial sync if needed
  useEffect(() => {
    const unsub = subscribeHadithSync((nextState) => {
      setSyncState(nextState);
    });
    ensureAllHadithsDownloadedOffline().catch(() => {});
    return unsub;
  }, []);

  const downloadedCanonicalSet = useMemo(
    () => new Set(syncState.downloadedBookIds),
    [syncState.downloadedBookIds]
  );

  // Resolve bookmarked hadiths from ALL offline books (bundled + IndexedDB)
  useEffect(() => {
    if (!onlyBookmarks) return;
    let cancelled = false;
    setLoadingBookmarks(true);
    HadithApiService.getHadithsByIds(bookmarkedIds)
      .then((items) => {
        if (!cancelled) setBookmarkedHadiths(items);
      })
      .finally(() => {
        if (!cancelled) setLoadingBookmarks(false);
      });
    return () => {
      cancelled = true;
    };
  }, [onlyBookmarks, bookmarkedIds, syncState.downloadedBookIds]);

  // Global cross-book search whenever typing on the main screen (!selectedBook && !onlyBookmarks)
  useEffect(() => {
    if (selectedBook || onlyBookmarks) return;
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setGlobalSearchResults([]);
      setGlobalTotalMatches(0);
      setIsGlobalSearching(false);
      return;
    }

    let cancelled = false;
    setIsGlobalSearching(true);
    setGlobalVisibleLimit(30);

    const timer = setTimeout(() => {
      HadithApiService.searchAllOfflineHadiths(trimmed, GLOBAL_SEARCH_LIMIT)
        .then(({ results, totalMatches }) => {
          if (!cancelled) {
            setGlobalSearchResults(results);
            setGlobalTotalMatches(totalMatches);
          }
        })
        .finally(() => {
          if (!cancelled) setIsGlobalSearching(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, selectedBook, onlyBookmarks, syncState.downloadedBookIds]);

  const loadSectionHadiths = useCallback(
    async (bookId: string, secNum: number, bookTitle: string) => {
      setIsLoading(true);
      setSearchedSingleHadith(null);
      setVisibleLimit(RENDER_BATCH_SIZE);
      try {
        const fetched = await HadithApiService.fetchHadithsBySection(bookId, secNum, bookTitle);
        if (fetched.length > 0) {
          setActiveHadiths(fetched);
        } else {
          const fallback = HADITH_BOOKS.find((b) => b.id === bookId)?.hadiths || [];
          setActiveHadiths(fallback);
        }
      } catch (e) {
        console.warn('Error loading hadiths:', e);
        const fallback = HADITH_BOOKS.find((b) => b.id === bookId)?.hadiths || [];
        setActiveHadiths(fallback);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Load full book (from bundled JSON or IndexedDB) when selectedBook opens OR finishes downloading
  const loadBookAllHadiths = useCallback(
    async (book: HadithBook) => {
      setIsLoading(true);
      setVisibleLimit(RENDER_BATCH_SIZE);
      try {
        const { hadiths, isCompleteOffline } = await HadithApiService.getAllBookHadithsOffline(
          book.id
        );
        setIsBookCompleteOffline(isCompleteOffline);

        if (isCompleteOffline && hadiths.length > 0) {
          setActiveHadiths(hadiths);
          setIsLoading(false);
          return;
        }

        // If canonical book isn't fully downloaded into IndexedDB yet, load section 1 as immediate preview
        const bookSecs = HadithApiService.getBookSections(book.id);
        const initialSec = bookSecs.length > 0 ? bookSecs[0].sectionNumber : 1;
        const secHadiths = await HadithApiService.fetchHadithsBySection(
          book.id,
          initialSec,
          book.title
        );
        setActiveHadiths(secHadiths.length > 0 ? secHadiths : book.hadiths);
      } catch {
        setActiveHadiths(book.hadiths);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Load sections & full offline hadiths when a book is selected
  useEffect(() => {
    if (!selectedBook) {
      setSections([]);
      setActiveHadiths([]);
      setIsBookCompleteOffline(false);
      setSearchedSingleHadith(null);
      setViewMode('all');
      setShowChapterModal(false);
      setVisibleLimit(RENDER_BATCH_SIZE);
      return;
    }

    const bookId = selectedBook.id;
    const bookSecs = HadithApiService.getBookSections(bookId);
    setSections(bookSecs);

    const initialSec = bookSecs.length > 0 ? bookSecs[0].sectionNumber : 1;
    setSelectedSectionNum(initialSec);
    setLoadedSectionsInAllMode([initialSec]);
    setViewMode('all');
    setSearchedSingleHadith(null);
    setSearchQuery('');

    loadBookAllHadiths(selectedBook);
  }, [selectedBook, loadBookAllHadiths]);

  // If the currently opened canonical book just finished downloading in background, refresh to full offline dataset
  useEffect(() => {
    if (selectedBook && !isBookCompleteOffline && downloadedCanonicalSet.has(selectedBook.id)) {
      loadBookAllHadiths(selectedBook);
    }
  }, [selectedBook, isBookCompleteOffline, downloadedCanonicalSet, loadBookAllHadiths]);

  // Reset pagination when query or viewMode changes inside a book
  useEffect(() => {
    setVisibleLimit(RENDER_BATCH_SIZE);
  }, [searchQuery, viewMode, selectedSectionNum]);

  const handleSelectChapter = (secNum: number) => {
    if (!selectedBook) return;
    setViewMode('chapter');
    setSelectedSectionNum(secNum);
    setSearchedSingleHadith(null);
    setShowChapterModal(false);
    setVisibleLimit(RENDER_BATCH_SIZE);

    if (!isBookCompleteOffline) {
      loadSectionHadiths(selectedBook.id, secNum, selectedBook.title);
    }
  };

  const handleSwitchToAllHadiths = async () => {
    if (!selectedBook) return;
    setViewMode('all');
    setSearchedSingleHadith(null);
    setVisibleLimit(RENDER_BATCH_SIZE);
    await loadBookAllHadiths(selectedBook);
  };

  const handleNavigateChapter = (direction: -1 | 1) => {
    if (!selectedBook || sections.length === 0) return;
    const curIndex = sections.findIndex((s) => s.sectionNumber === selectedSectionNum);
    const nextIndex = curIndex + direction;
    if (nextIndex >= 0 && nextIndex < sections.length) {
      const nextSec = sections[nextIndex];
      handleSelectChapter(nextSec.sectionNumber);
    }
  };

  const handleLoadNextSectionInAllMode = async () => {
    if (!selectedBook || sections.length === 0) return;
    const lastLoaded = loadedSectionsInAllMode[loadedSectionsInAllMode.length - 1];
    const nextSecIndex = sections.findIndex((s) => s.sectionNumber === lastLoaded) + 1;
    if (nextSecIndex >= sections.length) {
      if (onShowAlert) onShowAlert('এই কিতাবের সকল হাদিস লোড সম্পন্ন হয়েছে!', true);
      return;
    }
    const nextSec = sections[nextSecIndex];
    setLoadingMore(true);
    try {
      const nextHadiths = await HadithApiService.fetchHadithsBySection(
        selectedBook.id,
        nextSec.sectionNumber,
        selectedBook.title
      );
      if (nextHadiths.length > 0) {
        setActiveHadiths((prev) => [...prev, ...nextHadiths]);
        setLoadedSectionsInAllMode((prev) => [...prev, nextSec.sectionNumber]);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const handleJumpToHadith = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook || !jumpHadithNum.trim()) return;

    const normalized = convertBengaliDigitsToEnglish(jumpHadithNum.trim());
    const num = parseInt(normalized, 10);
    if (isNaN(num) || num <= 0) {
      if (onShowAlert) onShowAlert('অনুগ্রহ করে সঠিক হাদিস নম্বর লিখুন', false);
      return;
    }

    // Check currently loaded full book first for 0ms instant offline jump
    const localMatch =
      activeHadiths.find((h) => h.numericNumber === num) ||
      activeHadiths.find((h) => parseHadithNum(h.hadithNumber) === num);

    if (localMatch) {
      setSearchedSingleHadith(localMatch);
      if (onShowAlert) {
        onShowAlert(`${selectedBook.title}: হাদিস নং ${toBengaliDigits(num)} পাওয়া গেছে`, true);
      }
      return;
    }

    setIsLoading(true);
    try {
      const single = await HadithApiService.fetchHadithByNumber(
        selectedBook.id,
        num,
        selectedBook.title
      );
      if (single) {
        setSearchedSingleHadith(single);
        if (onShowAlert) {
          onShowAlert(`${selectedBook.title}: হাদিস নং ${toBengaliDigits(num)} পাওয়া গেছে`, true);
        }
      } else {
        if (onShowAlert) onShowAlert(`হাদিস নং ${toBengaliDigits(num)} পাওয়া যায়নি।`, false);
      }
    } catch {
      if (onShowAlert) onShowAlert('হাদিস লোড হতে সমস্যা হয়েছে', false);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (onShowAlert) onShowAlert('হাদিস বুকমার্ক থেকে সরানো হয়েছে', false);
      } else {
        next.add(id);
        if (onShowAlert) onShowAlert('হাদিস বুকমার্কে সংরক্ষণ করা হয়েছে', true);
      }
      try {
        localStorage.setItem('ibadat_hadith_bookmarks', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const handleCopy = (hadith: HadithItem) => {
    const text = `【 ${hadith.hadithNumber} - ${hadith.chapter} 】\n${hadith.narrator ? `বর্ণনাকারী: ${hadith.narrator}\n\n` : ''}${hadith.arabic ? `${hadith.arabic}\n\n` : ''}অনুবাদ: ${hadith.translation}\n\nমান: ${hadith.grade} | সূত্র: ${hadith.reference}${hadith.explanation ? `\nশিক্ষা: ${hadith.explanation}` : ''}\n\n(ইবাদত ট্র্যাকার অ্যাপ)`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(hadith.id);
      setTimeout(() => setCopiedId(null), 2000);
      if (onShowAlert) onShowAlert('হাদিস কপি হয়েছে!', true);
    });
  };

  const handleShare = async (hadith: HadithItem) => {
    const text = `【 ${hadith.hadithNumber} - ${hadith.chapter} 】\n${hadith.narrator ? `বর্ণনাকারী: ${hadith.narrator}\n\n` : ''}অনুবাদ: ${hadith.translation}\n\nমান: ${hadith.grade} | সূত্র: ${hadith.reference}\n\n(ইবাদত ট্র্যাকার)`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: hadith.hadithNumber,
          text
        });
      } catch {}
    } else {
      handleCopy(hadith);
    }
  };

  const handleFontSizeChange = (delta: number) => {
    setFontSizeLevel((prev) => {
      const next = Math.max(0, Math.min(3, prev + delta));
      try {
        localStorage.setItem('hadith_font_size', String(next));
      } catch {}
      return next;
    });
  };

  const arabicFontClass = useMemo(() => {
    switch (fontSizeLevel) {
      case 0: return 'text-xl leading-relaxed';
      case 1: return 'text-2xl leading-loose';
      case 2: return 'text-3xl leading-loose';
      case 3: return 'text-4xl leading-loose';
      default: return 'text-2xl leading-loose';
    }
  }, [fontSizeLevel]);

  const bengaliFontClass = useMemo(() => {
    switch (fontSizeLevel) {
      case 0: return 'text-xs';
      case 1: return 'text-sm';
      case 2: return 'text-base';
      case 3: return 'text-lg';
      default: return 'text-sm';
    }
  }, [fontSizeLevel]);

  const currentSection = sections.find((s) => s.sectionNumber === selectedSectionNum);

  // Filtered Hadiths inside selected book (searches the ENTIRE book offline!)
  const displayedHadiths = useMemo(() => {
    if (onlyBookmarks) {
      return bookmarkedHadiths;
    }

    if (searchedSingleHadith) {
      return [searchedSingleHadith];
    }

    let list = activeHadiths;

    // Filter by selected section when in chapter mode and the full book is loaded
    if (viewMode === 'chapter' && isBookCompleteOffline && selectedSectionNum) {
      const bySec = list.filter((h) => h.sectionNumber === selectedSectionNum);
      if (bySec.length > 0) {
        list = bySec;
      } else if (currentSection) {
        list = list.filter((h) => {
          const num = h.numericNumber ?? parseHadithNum(h.hadithNumber);
          return num >= currentSection.firstHadithNumber && num <= currentSection.lastHadithNumber;
        });
      }
    }

    const trimmed = searchQuery.trim();
    if (!trimmed) return list;

    const normalizedQuery = convertBengaliDigitsToEnglish(trimmed).toLowerCase();
    const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
    const isPureNum = /^\d+$/.test(normalizedQuery);
    const exactTarget = isPureNum ? parseInt(normalizedQuery, 10) : null;

    const exactMatches: HadithItem[] = [];
    const partialMatches: HadithItem[] = [];

    for (let i = 0; i < list.length; i++) {
      const h = list[i];
      const numVal = h.numericNumber ?? parseHadithNum(h.hadithNumber);
      if (exactTarget !== null && numVal === exactTarget) {
        exactMatches.push(h);
        continue;
      }

      const numStr = String(numVal);
      const matchesAll = tokens.every(
        (tok) =>
          numStr === tok ||
          h.hadithNumber.toLowerCase().includes(tok) ||
          h.chapter.toLowerCase().includes(tok) ||
          h.narrator.toLowerCase().includes(tok) ||
          h.translation.toLowerCase().includes(tok) ||
          h.arabic.includes(trimmed) ||
          h.reference.toLowerCase().includes(tok) ||
          (h.explanation ? h.explanation.toLowerCase().includes(tok) : false)
      );

      if (matchesAll) {
        partialMatches.push(h);
      }
    }

    return [...exactMatches, ...partialMatches];
  }, [
    onlyBookmarks,
    bookmarkedHadiths,
    searchedSingleHadith,
    activeHadiths,
    viewMode,
    isBookCompleteOffline,
    selectedSectionNum,
    currentSection,
    searchQuery
  ]);

  const paginatedDisplayedHadiths = useMemo(() => {
    if (onlyBookmarks || searchedSingleHadith) return displayedHadiths;
    return displayedHadiths.slice(0, visibleLimit);
  }, [displayedHadiths, onlyBookmarks, searchedSingleHadith, visibleLimit]);

  const hasMoreInDisplayed = !onlyBookmarks && !searchedSingleHadith && displayedHadiths.length > visibleLimit;

  // Filtered books for Global Search on main screen
  const matchingBooks = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return HADITH_BOOKS;
    const q = convertBengaliDigitsToEnglish(trimmed).toLowerCase();
    return HADITH_BOOKS.filter(
      (b) => b.title.toLowerCase().includes(q) || b.subtitle.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // Filtered sections for chapter selection modal
  const filteredModalSections = useMemo(() => {
    if (!chapterSearch.trim()) return sections;
    const q = convertBengaliDigitsToEnglish(chapterSearch).toLowerCase().trim();
    return sections.filter(
      (s) =>
        s.bengaliTitle.toLowerCase().includes(q) ||
        s.englishTitle.toLowerCase().includes(q) ||
        String(s.sectionNumber).includes(q) ||
        String(s.firstHadithNumber).includes(q) ||
        String(s.lastHadithNumber).includes(q)
    );
  }, [sections, chapterSearch]);

  const lastLoadedSec = loadedSectionsInAllMode[loadedSectionsInAllMode.length - 1];
  const nextSecIndex = sections.findIndex((s) => s.sectionNumber === lastLoadedSec) + 1;
  const hasMoreOnlineSections =
    !isBookCompleteOffline && viewMode === 'all' && !searchedSingleHadith && nextSecIndex < sections.length;
  const nextSectionToLoad = hasMoreOnlineSections ? sections[nextSecIndex] : null;

  return (
    <div className="min-h-screen bg-[#111613] text-[#e1e7e3] -m-4 p-4 font-sans selection:bg-emerald-900 selection:text-white">
      {/* Top Header */}
      {!selectedBook && !onlyBookmarks ? (
        <div className="flex items-center justify-between pb-4 border-b border-[#202b23]">
          <div>
            <h1 className="text-2xl font-bold text-[#34d399] tracking-wide">
              আল-হাদিস
            </h1>
            <p className="text-xs text-[#8ea496] mt-0.5">
              ইসলামিক জ্ঞান ও দিকনির্দেশনা (বিশুদ্ধ সংকলন)
            </p>
          </div>

          <button
            onClick={() => setOnlyBookmarks(true)}
            className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center gap-1.5 ${
              bookmarkedIds.size > 0
                ? 'bg-[#1b3a29] border-[#2f6648] text-[#4ade80]'
                : 'bg-[#18201a] border-[#222e25] text-[#8ea496] hover:text-[#4ade80]'
            }`}
            title="সংরক্ষিত হাদিস"
          >
            <Bookmark className="w-5 h-5 fill-current" />
            {bookmarkedIds.size > 0 && (
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-[#10b981] text-black">
                {bookmarkedIds.size}
              </span>
            )}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between pb-3 border-b border-[#202b23]">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                setSelectedBook(null);
                setOnlyBookmarks(false);
                setSearchQuery('');
                setSearchedSingleHadith(null);
                setShowChapterModal(false);
              }}
              className="p-2 rounded-xl bg-[#18201a] border border-[#222e25] text-[#8ea496] hover:text-white transition cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-[#34d399] line-clamp-1">
                {onlyBookmarks ? 'সংরক্ষিত হাদিসসমূহ' : selectedBook?.title}
              </h2>
              <p className="text-xs text-[#8ea496] truncate">
                {onlyBookmarks
                  ? `${toBengaliDigits(displayedHadiths.length)} টি সংরক্ষিত`
                  : viewMode === 'all'
                  ? `সকল হাদিস ক্রমানুসারে (${toBengaliDigits(activeHadiths.length)}টি প্রদর্শিত)`
                  : currentSection
                  ? `${currentSection.bengaliTitle} (${toBengaliDigits(currentSection.firstHadithNumber)}-${toBengaliDigits(currentSection.lastHadithNumber)})`
                  : `${selectedBook?.totalHadithLabel || ''} হাদিস`}
              </p>
            </div>
          </div>

          {/* Reading Controls */}
          <div className="flex items-center gap-1 bg-[#18201a] border border-[#243328] rounded-xl p-1 shrink-0">
            <button
              onClick={() => handleFontSizeChange(-1)}
              disabled={fontSizeLevel === 0}
              className="px-2 py-1 text-xs font-bold text-[#8ea496] hover:text-white disabled:opacity-40 cursor-pointer"
              title="ফন্ট ছোট করুন"
            >
              A-
            </button>
            <span className="text-[10px] text-[#556b5d] px-1 font-mono">
              {fontSizeLevel === 0 ? 'ছোট' : fontSizeLevel === 1 ? 'স্বাভাবিক' : fontSizeLevel === 2 ? 'বড়' : 'অতিবড়'}
            </span>
            <button
              onClick={() => handleFontSizeChange(1)}
              disabled={fontSizeLevel === 3}
              className="px-2 py-1 text-xs font-bold text-[#8ea496] hover:text-white disabled:opacity-40 cursor-pointer"
              title="ফন্ট বড় করুন"
            >
              A+
            </button>
          </div>
        </div>
      )}

      {/* Main Hadith Book List + Global Offline Search View */}
      {!selectedBook && !onlyBookmarks && (
        <div className="mt-3 space-y-3">
          {/* Global Search Input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-[#60796a]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="হাদিসের বিষয়, অর্থ বা সূত্র দিয়ে খুঁজুন..."
              className="w-full pl-10 pr-16 py-2.5 rounded-xl bg-[#161c18] border border-[#222d25] text-sm text-[#e1e7e3] placeholder-[#60796a] focus:outline-none focus:border-[#34d399] transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-xs text-[#8ea496] hover:text-white px-2 py-1 rounded-lg bg-[#222d25] cursor-pointer"
              >
                মুছুন
              </button>
            )}
          </div>

          {/* Global Cross-Book Search Results View */}
          {searchQuery.trim() ? (
            <div className="space-y-4">
              {/* Matching Books Strip */}
              {matchingBooks.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-bold text-[#8ea496] px-1">
                    সম্পর্কিত হাদিস কিতাব ({toBengaliDigits(matchingBooks.length)}টি)
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {matchingBooks.slice(0, 4).map((book) => (
                      <div
                        key={book.id}
                        onClick={() => setSelectedBook(book)}
                        className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-[#161d18] border border-[#222e25] hover:border-[#34d399] cursor-pointer transition"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-sm font-bold text-[#edf2ee] truncate">{book.title}</p>
                          <p className="text-[11px] text-[#81998a] truncate">{book.subtitle}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-[#4ade80] shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Hadiths Across All Books */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-bold text-[#4ade80]">
                    সকল কিতাব থেকে হাদিস সার্চ ফলাফল
                  </p>
                  {!isGlobalSearching && (
                    <span className="text-[11px] text-[#8ea496]">
                      {globalTotalMatches > GLOBAL_SEARCH_LIMIT
                        ? `${toBengaliDigits(GLOBAL_SEARCH_LIMIT)}+ টি পাওয়া গেছে`
                        : `${toBengaliDigits(globalTotalMatches)}টি পাওয়া গেছে`}
                    </span>
                  )}
                </div>

                {isGlobalSearching ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-sm text-[#4ade80]">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>সকল অফলাইন হাদিসে খোঁজা হচ্ছে...</span>
                  </div>
                ) : globalSearchResults.length === 0 ? (
                  <div className="text-center py-12 bg-[#161c18] rounded-2xl border border-[#222e25] p-6 space-y-3">
                    <BookOpen className="w-10 h-10 text-[#4ade80] mx-auto opacity-60" />
                    <p className="text-sm text-[#8ea496]">
                      "{searchQuery}" অনুযায়ী কোনো হাদিস মেলেনি। অন্য শব্দ বা হাদিস নম্বর দিয়ে চেষ্টা করুন।
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {globalSearchResults.slice(0, globalVisibleLimit).map((h) => (
                      <HadithCard
                        key={h.id}
                        hadith={h}
                        arabicFontClass={arabicFontClass}
                        bengaliFontClass={bengaliFontClass}
                        showArabic={showArabic}
                        isBookmarked={bookmarkedIds.has(h.id)}
                        onToggleBookmark={() => toggleBookmark(h.id)}
                        copied={copiedId === h.id}
                        onCopy={() => handleCopy(h)}
                        onShare={() => handleShare(h)}
                      />
                    ))}

                    {globalSearchResults.length > globalVisibleLimit && (
                      <button
                        type="button"
                        onClick={() => setGlobalVisibleLimit((prev) => prev + 30)}
                        className="w-full py-3 px-4 rounded-xl bg-[#183925] hover:bg-[#204e33] border border-[#2b6541] text-xs font-bold text-[#4ade80] flex items-center justify-center gap-2 transition cursor-pointer"
                      >
                        <span>
                          আরও ফলাফল দেখুন ({toBengaliDigits(globalSearchResults.length - globalVisibleLimit)}টি বাকি)
                        </span>
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* The 14 Books List */
            <div className="divide-y divide-[#1c261f]">
              {HADITH_BOOKS.map((book) => (
                  <div
                    key={book.id}
                    onClick={() => setSelectedBook(book)}
                    className="flex items-center justify-between py-4 px-2 hover:bg-[#18211b] active:bg-[#1d2720] transition rounded-xl cursor-pointer group"
                  >
                    <div className="space-y-1 pr-3 flex-1 min-w-0">
                      <h3 className="text-[16px] font-bold text-[#edf2ee] group-hover:text-[#4ade80] transition-colors truncate">
                        {book.title}
                      </h3>
                      <p className="text-xs text-[#81998a] line-clamp-1 leading-relaxed">
                        {book.subtitle}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs px-3 py-1 rounded-full bg-[#182d20] text-[#4ade80] font-semibold border border-[#21432e] shadow-xs">
                        {book.totalHadithLabel}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[#4f6456] group-hover:text-[#4ade80] group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Book Detail & Interactive Hadith Browser */}
      {selectedBook && !onlyBookmarks && (
        <div className="mt-3 space-y-3">
          {/* Action Row: [সব হাদিস একসাথে] and [অধ্যায় ফিল্টার] */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSwitchToAllHadiths}
              className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                viewMode === 'all' && !searchedSingleHadith
                  ? 'bg-[#183925] border-[#2e6d46] text-[#4ade80] shadow-sm ring-1 ring-[#4ade80]/40'
                  : 'bg-[#161d18] border-[#222e25] text-[#8ea496] hover:text-[#d3ded7] hover:border-[#2b3c30]'
              }`}
            >
              <BookOpen className="w-4 h-4 text-[#4ade80] shrink-0" />
              <span>সব হাদিস একসাথে</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                  viewMode === 'all' && !searchedSingleHadith
                    ? 'bg-[#214d33] text-[#4ade80] border border-[#2b6543]'
                    : 'bg-[#1c261f] text-[#81998a]'
                }`}
              >
                {activeHadiths.length > 0
                  ? `${toBengaliDigits(activeHadiths.length)}টি`
                  : selectedBook.totalHadithLabel}
              </span>
            </button>

            {sections.length > 1 && (
              <button
                type="button"
                onClick={() => setShowChapterModal(true)}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-between border cursor-pointer ${
                  viewMode === 'chapter' && !searchedSingleHadith
                    ? 'bg-[#183925] border-[#2e6d46] text-[#4ade80] shadow-sm ring-1 ring-[#4ade80]/40'
                    : 'bg-[#161d18] border-[#222e25] text-[#8ea496] hover:text-[#d3ded7] hover:border-[#2b3c30]'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Layers className="w-4 h-4 shrink-0 text-[#8ea496]" />
                  <span className="truncate">
                    {viewMode === 'chapter' && currentSection
                      ? currentSection.bengaliTitle
                      : `অধ্যায় ফিল্টার (${toBengaliDigits(sections.length)})`}
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 shrink-0 ml-1 opacity-80" />
              </button>
            )}
          </div>

          {/* Active Chapter Filter Notice */}
          {viewMode === 'chapter' && currentSection && !searchedSingleHadith && (
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#142319] border border-[#234b33] text-xs">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full bg-[#4ade80] shrink-0"></span>
                <span className="text-[#8ea496] truncate">
                  ফিল্টার: <span className="text-[#4ade80] font-bold">{currentSection.bengaliTitle}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={handleSwitchToAllHadiths}
                className="text-[11px] font-bold text-[#4ade80] hover:underline shrink-0 ml-2 cursor-pointer flex items-center gap-1"
              >
                <span>সব হাদিস একসাথে দেখুন</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Quick Jump to Hadith Number bar (supports both Bengali & English numerals) */}
          <form
            onSubmit={handleJumpToHadith}
            className="flex items-center gap-2 p-2 rounded-xl bg-[#161d18] border border-[#222e25]"
          >
            <div className="flex items-center gap-1.5 pl-2 text-xs font-semibold text-[#4ade80] shrink-0">
              <Hash className="w-3.5 h-3.5" />
              <span>হাদিস নং:</span>
            </div>
            <input
              type="text"
              inputMode="numeric"
              value={jumpHadithNum}
              onChange={(e) => setJumpHadithNum(e.target.value)}
              placeholder={`১ - ${toBengaliDigits(selectedBook.totalCount || 7563)}`}
              className="flex-1 py-1 px-2 text-xs rounded-lg bg-[#111713] border border-[#222e25] text-white focus:outline-none focus:border-[#34d399]"
            />
            <button
              type="submit"
              className="px-3 py-1 rounded-lg bg-[#183925] hover:bg-[#204e33] text-xs font-bold text-[#4ade80] border border-[#285d3c] transition cursor-pointer flex items-center gap-1 shrink-0"
            >
              <span>যান</span>
              <ArrowRight className="w-3 h-3" />
            </button>
            {searchedSingleHadith && (
              <button
                type="button"
                onClick={() => {
                  setSearchedSingleHadith(null);
                  setJumpHadithNum('');
                }}
                className="px-2 py-1 rounded-lg bg-[#27211a] text-xs text-[#fbbf24] hover:text-white cursor-pointer"
              >
                সব দেখুন
              </button>
            )}
          </form>

          {/* Quick Filters Bar (Arabic Toggle & In-Book Full Search) */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-[#161d18] border border-[#222e25]">
            <button
              onClick={() => setShowArabic(!showArabic)}
              className={`text-xs px-2.5 py-1 rounded-lg transition border cursor-pointer ${
                showArabic
                  ? 'bg-[#1b3a29] border-[#2c6145] text-[#4ade80] font-semibold'
                  : 'bg-[#1c241e] border-[#27352a] text-[#718579]'
              }`}
            >
              আরবী ইবারত {showArabic ? 'অন' : 'অফ'}
            </button>

            <div className="relative flex-1 min-w-[150px]">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="এই কিতাবে খুঁজুন (শব্দ বা নম্বর)..."
                className="w-full pl-7 pr-7 py-1 text-xs rounded-lg bg-[#111713] border border-[#222e25] text-[#e1e7e3] placeholder-[#60796a] focus:outline-none focus:border-[#34d399]"
              />
              <Search className="absolute left-2 top-1.5 w-3.5 h-3.5 text-[#60796a]" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1.5 top-1 text-[#8ea496] hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {searchQuery.trim() && !isLoading && (
            <div className="px-1 flex items-center justify-between text-xs text-[#8ea496]">
              <span>
                "{searchQuery}" অনুযায়ী {toBengaliDigits(displayedHadiths.length)}টি হাদিস পাওয়া গেছে
              </span>
            </div>
          )}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center justify-center py-10 gap-2 text-sm text-[#4ade80]">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>হাদিস লোড হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন</span>
            </div>
          )}

          {/* Hadiths Render List */}
          {!isLoading && paginatedDisplayedHadiths.length === 0 ? (
            <div className="text-center py-16 bg-[#161c18] rounded-2xl border border-[#222e25] p-6 space-y-3">
              <BookOpen className="w-10 h-10 text-[#4ade80] mx-auto opacity-60" />
              <p className="text-sm text-[#8ea496]">
                কোনো হাদিস মেলেনি। অন্য অধ্যায়, শব্দ বা নম্বর দিয়ে চেষ্টা করুন।
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedDisplayedHadiths.map((h) => (
                <HadithCard
                  key={h.id}
                  hadith={h}
                  arabicFontClass={arabicFontClass}
                  bengaliFontClass={bengaliFontClass}
                  showArabic={showArabic}
                  isBookmarked={bookmarkedIds.has(h.id)}
                  onToggleBookmark={() => toggleBookmark(h.id)}
                  copied={copiedId === h.id}
                  onCopy={() => handleCopy(h)}
                  onShare={() => handleShare(h)}
                />
              ))}

              {/* Show More Button for offline full-book list */}
              {hasMoreInDisplayed && (
                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => setVisibleLimit((prev) => prev + RENDER_BATCH_SIZE)}
                    className="w-full py-3 px-4 rounded-xl bg-[#183925] hover:bg-[#204e33] border border-[#2b6541] text-xs font-bold text-[#4ade80] flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
                  >
                    <span>
                      আরও {toBengaliDigits(Math.min(RENDER_BATCH_SIZE, displayedHadiths.length - visibleLimit))}টি হাদিস দেখুন (মোট {toBengaliDigits(displayedHadiths.length - visibleLimit)}টি বাকি)
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Chapter Pager in 'chapter' Mode */}
              {viewMode === 'chapter' && !searchedSingleHadith && sections.length > 1 && (
                <div className="pt-3 pb-1 border-t border-[#202b23] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleNavigateChapter(-1)}
                    disabled={sections.findIndex((s) => s.sectionNumber === selectedSectionNum) <= 0}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#18201a] border border-[#243026] text-xs font-semibold text-[#8ea496] hover:text-[#4ade80] disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>পূর্ববর্তী অধ্যায়</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowChapterModal(true)}
                    className="py-2 px-3 rounded-xl bg-[#183925] border border-[#2e6d46] text-xs font-bold text-[#4ade80] hover:bg-[#1f4a30] transition cursor-pointer text-center truncate max-w-[150px]"
                  >
                    <span>
                      অধ্যায় {toBengaliDigits(sections.findIndex((s) => s.sectionNumber === selectedSectionNum) + 1)} / {toBengaliDigits(sections.length)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavigateChapter(1)}
                    disabled={
                      sections.findIndex((s) => s.sectionNumber === selectedSectionNum) >= sections.length - 1
                    }
                    className="flex-1 py-2.5 px-3 rounded-xl bg-[#18201a] border border-[#243026] text-xs font-semibold text-[#8ea496] hover:text-[#4ade80] disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>পরবর্তী অধ্যায়</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Fallback Online Load More if offline full-book isn't synced yet */}
              {hasMoreOnlineSections && !hasMoreInDisplayed && (
                <div className="pt-2 text-center">
                  <button
                    onClick={handleLoadNextSectionInAllMode}
                    disabled={loadingMore}
                    className="w-full py-3 px-4 rounded-xl bg-[#183925] hover:bg-[#204e33] border border-[#2b6541] text-xs font-bold text-[#4ade80] flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shadow-md"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>পরবর্তী হাদিসসমূহ লোড হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <span>
                          পরবর্তী হাদিসগুলো লোড করুন ({nextSectionToLoad?.bengaliTitle})
                        </span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* All Hadiths Completed Indicator */}
              {viewMode === 'all' &&
                !searchedSingleHadith &&
                !hasMoreInDisplayed &&
                !hasMoreOnlineSections &&
                displayedHadiths.length > 0 && (
                  <div className="pt-3 text-center text-xs text-[#8ea496] bg-[#161d18] border border-[#222e25] py-2.5 rounded-xl">
                    <span>✓ এই কিতাবের সকল হাদিস প্রদর্শিত হয়েছে (মোট {toBengaliDigits(displayedHadiths.length)}টি)</span>
                  </div>
                )}
            </div>
          )}
        </div>
      )}

      {/* Bookmarks Only View */}
      {onlyBookmarks && (
        <div className="mt-3 space-y-4">
          {loadingBookmarks ? (
            <div className="flex items-center justify-center py-10 gap-2 text-sm text-[#4ade80]">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>সংরক্ষিত হাদিস লোড হচ্ছে...</span>
            </div>
          ) : displayedHadiths.length === 0 ? (
            <div className="text-center py-16 bg-[#161c18] rounded-2xl border border-[#222e25] p-6 space-y-3">
              <Bookmark className="w-10 h-10 text-[#4ade80] mx-auto opacity-60" />
              <p className="text-sm text-[#8ea496]">
                আপনার কোনো সংরক্ষিত হাদিস নেই। যেকোনো হাদিস কার্ডের বুকমার্ক আইকনে ক্লিক করে এখানে সংরক্ষণ করুন।
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedHadiths.map((h) => (
                <HadithCard
                  key={h.id}
                  hadith={h}
                  arabicFontClass={arabicFontClass}
                  bengaliFontClass={bengaliFontClass}
                  showArabic={showArabic}
                  isBookmarked={bookmarkedIds.has(h.id)}
                  onToggleBookmark={() => toggleBookmark(h.id)}
                  copied={copiedId === h.id}
                  onCopy={() => handleCopy(h)}
                  onShare={() => handleShare(h)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chapter Selection Modal Dialog */}
      {showChapterModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-[420px] bg-[#161d18] border border-[#26372b] rounded-t-3xl sm:rounded-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#212f25]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#183925] text-[#4ade80] flex items-center justify-center">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    অধ্যায় নির্বাচন করুন
                  </h3>
                  <p className="text-[11px] text-[#8ea496]">
                    {selectedBook?.title} ({toBengaliDigits(sections.length)}টি অধ্যায়)
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowChapterModal(false);
                  setChapterSearch('');
                }}
                className="p-1.5 rounded-lg bg-[#111713] text-[#8ea496] hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Input */}
            <div className="p-3 border-b border-[#212f25]">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#60796a]" />
                <input
                  type="text"
                  value={chapterSearch}
                  onChange={(e) => setChapterSearch(e.target.value)}
                  placeholder="অধ্যায়ের নাম বা বিষয় লিখে খুঁজুন..."
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-[#111713] border border-[#26372b] text-white placeholder-[#60796a] focus:outline-none focus:border-[#34d399]"
                />
              </div>
            </div>

            {/* Chapters List */}
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-[#1e2a21]">
              <div
                onClick={() => {
                  handleSwitchToAllHadiths();
                  setShowChapterModal(false);
                }}
                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition mb-2 border ${
                  viewMode === 'all'
                    ? 'bg-[#183925] border-[#2e6d46] text-[#4ade80]'
                    : 'bg-[#141b16] border-[#202b23] text-[#8ea496] hover:bg-[#1a241d]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                      viewMode === 'all'
                        ? 'bg-[#4ade80] text-black font-mono'
                        : 'bg-[#111713] text-[#8ea496] border border-[#222e25]'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${viewMode === 'all' ? 'text-[#4ade80]' : 'text-[#e1e7e3]'}`}>
                      সকল হাদিস একসাথে দেখুন
                    </p>
                    <p className="text-[10px] text-[#718678] mt-0.5">
                      সম্পূর্ণ কিতাবের সকল হাদিস এক তালিকায় ({selectedBook?.totalHadithLabel || 'সম্পূর্ণ'})
                    </p>
                  </div>
                </div>
                {viewMode === 'all' && <Check className="w-4 h-4 text-[#4ade80]" />}
              </div>

              {filteredModalSections.length === 0 ? (
                <div className="text-center py-10 text-xs text-[#718678]">
                  কোনো অধ্যায় মেলেনি।
                </div>
              ) : (
                filteredModalSections.map((sec) => {
                  const isCurrent = sec.sectionNumber === selectedSectionNum && viewMode === 'chapter';
                  return (
                    <div
                      key={sec.sectionNumber}
                      onClick={() => handleSelectChapter(sec.sectionNumber)}
                      className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition ${
                        isCurrent
                          ? 'bg-[#183925] border border-[#2e6d46]'
                          : 'hover:bg-[#1a241d]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            isCurrent
                              ? 'bg-[#4ade80] text-black font-mono'
                              : 'bg-[#111713] text-[#8ea496] border border-[#222e25] font-mono'
                          }`}
                        >
                          {sec.sectionNumber}
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`text-xs font-bold truncate ${
                              isCurrent ? 'text-[#4ade80]' : 'text-[#e1e7e3]'
                            }`}
                          >
                            {sec.bengaliTitle}
                          </p>
                          <p className="text-[10px] text-[#718678] font-mono mt-0.5">
                            হাদিস নং: {toBengaliDigits(sec.firstHadithNumber)} - {toBengaliDigits(sec.lastHadithNumber)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#111713] text-[#4ade80] font-semibold border border-[#222e25]">
                          {toBengaliDigits(sec.count)}টি
                        </span>
                        {isCurrent && <Check className="w-4 h-4 text-[#4ade80]" />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface HadithCardProps {
  hadith: HadithItem;
  arabicFontClass: string;
  bengaliFontClass: string;
  showArabic: boolean;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  copied: boolean;
  onCopy: () => void;
  onShare: () => void;
}

const HadithCard: React.FC<HadithCardProps> = ({
  hadith,
  arabicFontClass,
  bengaliFontClass,
  showArabic,
  isBookmarked,
  onToggleBookmark,
  copied,
  onCopy,
  onShare
}) => {
  return (
    <div className="rounded-2xl bg-[#161c18] border border-[#222f25] p-4 space-y-3.5 shadow-sm hover:border-[#2f4a38] transition-colors">
      {/* Header tags & Action buttons */}
      <div className="flex items-start justify-between gap-3 border-b border-[#212c24] pb-2.5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {hadith.bookTitle && (
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#1b2c22] text-[#86efac] border border-[#294c36]">
                {hadith.bookTitle}
              </span>
            )}
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[#183523] text-[#4ade80] border border-[#234d34]">
              {hadith.hadithNumber}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#192b3a] text-[#38bdf8] border border-[#233d52]">
              {hadith.chapter}
            </span>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#272113] text-[#fbbf24] border border-[#3d3319] flex items-center gap-1">
              <Award className="w-3 h-3" />
              {hadith.grade}
            </span>
          </div>
          {hadith.narrator && (
            <p className="text-[12px] text-[#86a894] font-medium pt-0.5">
              বর্ণনাকারী: <span className="text-white">{hadith.narrator}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggleBookmark}
            className={`p-1.5 rounded-lg border transition cursor-pointer ${
              isBookmarked
                ? 'bg-[#1b3a29] border-[#2c6145] text-[#4ade80]'
                : 'bg-[#1a221c] border-[#243026] text-[#718678] hover:text-[#4ade80]'
            }`}
            title="বুকমার্ক করুন"
          >
            <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>

          <button
            onClick={onCopy}
            className="p-1.5 rounded-lg bg-[#1a221c] border border-[#243026] text-[#718678] hover:text-[#4ade80] transition cursor-pointer"
            title="কপি করুন"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>

          <button
            onClick={onShare}
            className="p-1.5 rounded-lg bg-[#1a221c] border border-[#243026] text-[#718678] hover:text-[#4ade80] transition cursor-pointer"
            title="শেয়ার করুন"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Arabic Text */}
      {showArabic && hadith.arabic && (
        <div className="p-3.5 rounded-xl bg-[#111713] border border-[#1e2a21] text-right">
          <p
            dir="rtl"
            className={`font-['Amiri',serif] text-[#f1f5f2] tracking-wider leading-loose ${arabicFontClass}`}
          >
            {hadith.arabic}
          </p>
        </div>
      )}

      {/* Bengali Translation */}
      <div className="space-y-1">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[#34d399]">
          অনুবাদ ও বিবরণ:
        </span>
        <p className={`text-[#d3ded7] font-normal leading-relaxed ${bengaliFontClass} whitespace-pre-line`}>
          {hadith.translation}
        </p>
      </div>

      {/* Explanation or Core Takeaway */}
      {hadith.explanation && (
        <div className="p-2.5 rounded-xl bg-[#14261d] border border-[#1e3c2c] text-xs text-[#a7c5b3] space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-[#4ade80]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>শিক্ষণীয় বিষয়:</span>
          </div>
          <p className="leading-relaxed">{hadith.explanation}</p>
        </div>
      )}

      {/* Exact Reference Footer */}
      <div className="pt-2 border-t border-[#212c24] flex items-center justify-between text-[11px] text-[#759582] font-mono">
        <span className="line-clamp-1">মূল রেফারেন্স: {hadith.reference}</span>
      </div>
    </div>
  );
};
