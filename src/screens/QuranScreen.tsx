import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search,
  X,
  Volume2,
  Play,
  Pause,
  Bookmark,
  BookmarkCheck,
  BookmarkPlus,
  Paperclip,
  Share2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Settings as SettingsIcon,
  BookOpen,
  SlidersHorizontal,
  BookMarked,
  ChevronsDown,
  Palette,
  SkipBack,
  SkipForward,
  Square,
  Download,
  CheckCircle2,
  Trash2,
  Loader2
} from 'lucide-react';
import {
  ALL_SURAHS,
  JUZ_LIST,
  SurahMeta,
  Ayah,
  QuranBookmark,
  fetchSurahAyahs,
  getBookmarks,
  saveBookmark,
  removeBookmark,
  toBengaliNumber,
  toArabicNumber,
  arabicToBengaliPronunciation,
  downloadAllSurahsOffline,
  downloadSingleSurahOffline,
  BulkSurahDownloadProgress
} from '../data/quranData';
import {
  PREBUNDLED_SURAH_NUMBERS,
  getDownloadedSurahNumbers,
  getDownloadedAudioSurahNumbers,
  getOfflineAudioUrl,
  downloadSurahAudioOffline,
  deleteOfflineSurah,
  clearAllOfflineQuranData
} from '../services/quranOfflineService';
import { IslamicStar } from '../components/quran/IslamicStar';
import {
  TajweedConfig,
  getTajweedConfig,
  saveTajweedConfig,
  renderTajweedAyah
} from '../utils/tajweedService';
import { TajweedSettingModal } from '../components/quran/TajweedSettingModal';

type QuranSubTab = 'SURAH' | 'JUZ' | 'BOOKMARK';

interface QuranScreenProps {
  onShowAlert?: (message: string, isSuccess: boolean) => void;
  onReadingChange?: (isReading: boolean) => void;
}

export const QuranScreen: React.FC<QuranScreenProps> = ({ onShowAlert, onReadingChange }) => {
  // Navigation & Subtabs
  const [subTab, setSubTab] = useState<QuranSubTab>('SURAH');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);

  // Active Reading View
  const [selectedSurah, setSelectedSurah] = useState<SurahMeta | null>(null);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [loadingAyahs, setLoadingAyahs] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Audio Playback & Repeater State (Screenshots 1 & 2)
  const [currentPlayingAyah, setCurrentPlayingAyah] = useState<number | null>(null);
  const [currentPlayingSurahNumber, setCurrentPlayingSurahNumber] = useState<number | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeAudioObjectUrlRef = useRef<string | null>(null);
  const audioRequestIdRef = useRef<number>(0);

  // Offline Download State (Text & Audio)
  const [downloadedSurahSet, setDownloadedSurahSet] = useState<Set<number>>(
    () => new Set(PREBUNDLED_SURAH_NUMBERS)
  );
  const [downloadedAudioSet, setDownloadedAudioSet] = useState<Set<number>>(() => new Set());
  const [isBulkDownloading, setIsBulkDownloading] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<BulkSurahDownloadProgress>({
    completed: PREBUNDLED_SURAH_NUMBERS.length,
    total: 114,
    failedCount: 0,
    currentSurahName: ''
  });
  const [downloadingSurahNum, setDownloadingSurahNum] = useState<number | null>(null);
  const [downloadingAudioSurahNum, setDownloadingAudioSurahNum] = useState<number | null>(null);
  const [audioDownloadProgress, setAudioDownloadProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0
  });
  const [confirmClearOffline, setConfirmClearOffline] = useState<boolean>(false);
  const [showOfflineModal, setShowOfflineModal] = useState<boolean>(false);
  const [offlineModalSearch, setOfflineModalSearch] = useState<string>('');
  const [offlineModalFilter, setOfflineModalFilter] = useState<'ALL' | 'PENDING' | 'DOWNLOADED'>('ALL');
  const [selectedDownloadSurahs, setSelectedDownloadSurahs] = useState<Set<number>>(() => new Set());
  const bulkAbortRef = useRef<AbortController | null>(null);
  const audioAbortRef = useRef<AbortController | null>(null);

  const refreshOfflineStatus = async () => {
    const [surahNums, audioNums] = await Promise.all([
      getDownloadedSurahNumbers(),
      getDownloadedAudioSurahNumbers()
    ]);
    setDownloadedSurahSet(new Set(surahNums));
    setDownloadedAudioSet(new Set(audioNums));
  };

  useEffect(() => {
    refreshOfflineStatus();
  }, []);

  // Notify parent whether in full-screen reader view
  useEffect(() => {
    onReadingChange?.(selectedSurah !== null);
  }, [selectedSurah, onReadingChange]);

  const [showRepeaterModal, setShowRepeaterModal] = useState<boolean>(false);
  const [repeaterConfig, setRepeaterConfig] = useState<{
    enabled: boolean;
    fromSurah: number;
    fromAyah: number;
    toSurah: number;
    toAyah: number;
    repeatEachVerse: number | 'unlimited';
    repeatAll: number | 'unlimited' | 'off';
    speed: number;
  }>(() => {
    try {
      const saved = localStorage.getItem('ibadat_quran_repeater');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      enabled: false,
      fromSurah: 1,
      fromAyah: 1,
      toSurah: 1,
      toAyah: 7,
      repeatEachVerse: 1,
      repeatAll: 'unlimited',
      speed: 1.0
    };
  });

  const [repeaterDraft, setRepeaterDraft] = useState(repeaterConfig);
  const verseRepeatCountRef = useRef<number>(1);
  const allRepeatCountRef = useRef<number>(1);

  // Bookmarks & Ayah Interactions
  const [bookmarks, setBookmarks] = useState<QuranBookmark[]>(getBookmarks());
  const [copiedAyahNumber, setCopiedAyahNumber] = useState<number | null>(null);
  const [selectedAyahForSheet, setSelectedAyahForSheet] = useState<Ayah | null>(null);
  const [lastRead, setLastRead] = useState<{
    surahNumber: number;
    surahName: string;
    surahEnglishName: string;
    ayahNumber: number;
    timestamp: number;
  } | null>(() => {
    try {
      const saved = localStorage.getItem('ibadat_quran_last_read');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Reading Settings
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [arabicFontSize, setArabicFontSize] = useState<number>(() => {
    return parseInt(localStorage.getItem('ibadat_quran_font_ar') || '21', 10);
  });
  const [showTransliteration, setShowTransliteration] = useState<boolean>(() => {
    return localStorage.getItem('ibadat_quran_show_trans') !== 'false';
  });
  const [showTranslation, setShowTranslation] = useState<boolean>(() => {
    return localStorage.getItem('ibadat_quran_show_translat') !== 'false';
  });

  // Save display preferences
  const updateArabicFontSize = (size: number) => {
    setArabicFontSize(size);
    localStorage.setItem('ibadat_quran_font_ar', size.toString());
  };

  const toggleTransliteration = () => {
    const val = !showTransliteration;
    setShowTransliteration(val);
    localStorage.setItem('ibadat_quran_show_trans', val.toString());
  };

  const toggleTranslation = () => {
    const val = !showTranslation;
    setShowTranslation(val);
    localStorage.setItem('ibadat_quran_show_translat', val.toString());
  };

  // Tajweed & Tashdeed System State
  const [tajweedConfig, setTajweedConfig] = useState<TajweedConfig>(getTajweedConfig);
  const [showTajweedModal, setShowTajweedModal] = useState<boolean>(false);

  const toggleTajweed = () => {
    const updated = { ...tajweedConfig, enabled: !tajweedConfig.enabled };
    setTajweedConfig(updated);
    saveTajweedConfig(updated);
    onShowAlert?.(
      updated.enabled
        ? 'তাজবীদ কালার চালু করা হয়েছে।'
        : 'তাজবীদ বন্ধ করা হয়েছে (সব হরফ সাদা)।',
      true
    );
  };

  // Filtered Surahs
  const filteredSurahs = useMemo(() => {
    if (!searchQuery.trim()) return ALL_SURAHS;
    const q = searchQuery.toLowerCase().trim();
    return ALL_SURAHS.filter(
      (s) =>
        s.number.toString() === q ||
        s.englishName.toLowerCase().includes(q) ||
        s.banglaName.toLowerCase().includes(q) ||
        s.name.includes(q)
    );
  }, [searchQuery]);

  // Load Ayahs when a Surah is selected
  useEffect(() => {
    if (!selectedSurah) {
      setAyahs([]);
      stopAudio();
      return;
    }

    let isMounted = true;
    setLoadingAyahs(true);
    setLoadError(null);

    fetchSurahAyahs(selectedSurah.number)
      .then((data) => {
        if (!isMounted) return;
        if (data && data.length > 0) {
          setAyahs(data);
          setDownloadedSurahSet((prev) => {
            if (prev.has(selectedSurah.number)) return prev;
            const next = new Set(prev);
            next.add(selectedSurah.number);
            return next;
          });
        } else {
          setLoadError('ইন্টারনেট সংযোগ চেক করুন অথবা পুনরায় চেষ্টা করুন।');
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setLoadError('কুরআন আয়াত লোড করতে সমস্যা হয়েছে।');
      })
      .finally(() => {
        if (isMounted) setLoadingAyahs(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSurah]);

  // Repeater helper metas
  const fromSurahMeta = useMemo(() => {
    return ALL_SURAHS.find((s) => s.number === repeaterDraft.fromSurah) || ALL_SURAHS[0];
  }, [repeaterDraft.fromSurah]);

  const toSurahMeta = useMemo(() => {
    return ALL_SURAHS.find((s) => s.number === repeaterDraft.toSurah) || ALL_SURAHS[0];
  }, [repeaterDraft.toSurah]);

  const handleFromSurahChange = (num: number) => {
    const meta = ALL_SURAHS.find((s) => s.number === num);
    const maxAyahs = meta?.numberOfAyahs || 7;
    setRepeaterDraft((prev) => {
      let nextToSurah = prev.toSurah;
      let nextToAyah = prev.toAyah;
      if (nextToSurah < num) {
        nextToSurah = num;
        nextToAyah = maxAyahs;
      }
      return {
        ...prev,
        fromSurah: num,
        fromAyah: 1,
        toSurah: nextToSurah,
        toAyah: nextToAyah
      };
    });
  };

  const handleFromAyahChange = (ayahNum: number) => {
    setRepeaterDraft((prev) => {
      let nextToAyah = prev.toAyah;
      if (prev.fromSurah === prev.toSurah && nextToAyah < ayahNum) {
        nextToAyah = ayahNum;
      }
      return {
        ...prev,
        fromAyah: ayahNum,
        toAyah: nextToAyah
      };
    });
  };

  const handleToSurahChange = (num: number) => {
    const meta = ALL_SURAHS.find((s) => s.number === num);
    const maxAyahs = meta?.numberOfAyahs || 7;
    setRepeaterDraft((prev) => ({
      ...prev,
      toSurah: num,
      toAyah: maxAyahs
    }));
  };

  const playingSurahMeta = useMemo(() => {
    const sNum = currentPlayingSurahNumber || selectedSurah?.number;
    if (!sNum) return selectedSurah;
    return ALL_SURAHS.find((s) => s.number === sNum) || selectedSurah;
  }, [currentPlayingSurahNumber, selectedSurah]);

  // Background MediaSession API integration (keeps audio running outside app, on lock screen, and notification shade)
  const updateMediaSession = (surahNum: number, ayahNum: number, isPlaying: boolean) => {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      const sMeta = ALL_SURAHS.find((s) => s.number === surahNum);
      const title = sMeta
        ? `সূরা ${sMeta.banglaName} (আয়াত ${ayahNum})`
        : `আয়াত ${ayahNum}`;
      const artist = sMeta
        ? `QS. ${sMeta.englishName} ${surahNum}: Verse ${ayahNum}`
        : 'আল-কুরআনুল কারীম';

      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist,
          album: 'আল-কুরআনুল কারীম (ইবাদত ট্র্যাকার)',
          artwork: [
            { src: '/app-icon.jpg', sizes: '512x512', type: 'image/jpeg' },
            { src: '/app-icon.jpg', sizes: '192x192', type: 'image/jpeg' },
            { src: '/app-icon.jpg', sizes: '96x96', type: 'image/jpeg' }
          ]
        });

        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

        navigator.mediaSession.setActionHandler('play', () => handleTogglePlay());
        navigator.mediaSession.setActionHandler('pause', () => handleTogglePlay());
        navigator.mediaSession.setActionHandler('previoustrack', () => handlePrevAyah());
        navigator.mediaSession.setActionHandler('nexttrack', () => handleNextAyah());
        navigator.mediaSession.setActionHandler('stop', () => stopAudio());
      } catch (err) {
        console.warn('MediaSession error:', err);
      }
    }
  };

  const revokeActiveAudioObjectUrl = () => {
    if (activeAudioObjectUrlRef.current) {
      try {
        URL.revokeObjectURL(activeAudioObjectUrlRef.current);
      } catch {}
      activeAudioObjectUrlRef.current = null;
    }
  };

  // Audio Playback & Repeater Engine
  const stopAudio = () => {
    audioRequestIdRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    revokeActiveAudioObjectUrl();
    setIsPlayingAudio(false);
    setCurrentPlayingAyah(null);
    setCurrentPlayingSurahNumber(null);
    verseRepeatCountRef.current = 1;
    allRepeatCountRef.current = 1;
    if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none';
      } catch {}
    }
  };

  const playSingleAyahAudio = async (ayah: Ayah, surahNumber: number = selectedSurah?.number || 1) => {
    if (!ayah.audioUrl) {
      onShowAlert?.('এই আয়াতের অডিও পাওয়া যায়নি।', false);
      return;
    }

    const requestId = ++audioRequestIdRef.current;
    const offlineObjectUrl = await getOfflineAudioUrl(surahNumber, ayah.numberInSurah);

    if (requestId !== audioRequestIdRef.current) {
      if (offlineObjectUrl) {
        try {
          URL.revokeObjectURL(offlineObjectUrl);
        } catch {}
      }
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'auto';
    }

    revokeActiveAudioObjectUrl();
    if (offlineObjectUrl) {
      activeAudioObjectUrlRef.current = offlineObjectUrl;
      audioRef.current.src = offlineObjectUrl;
    } else {
      audioRef.current.src = ayah.audioUrl;
    }

    audioRef.current.playbackRate = repeaterConfig.speed || 1.0;
    audioRef.current
      .play()
      .then(() => {
        if (requestId !== audioRequestIdRef.current) return;
        setIsPlayingAudio(true);
        setCurrentPlayingAyah(ayah.numberInSurah);
        setCurrentPlayingSurahNumber(surahNumber);
        updateMediaSession(surahNumber, ayah.numberInSurah, true);
        setTimeout(() => {
          document.getElementById(`ayah-${ayah.numberInSurah}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      })
      .catch((e) => {
        if (requestId !== audioRequestIdRef.current) return;
        console.warn("Audio playback error:", e);
        setIsPlayingAudio(false);
        onShowAlert?.(
          offlineObjectUrl
            ? 'অফলাইন অডিও প্লে করতে সমস্যা হয়েছে।'
            : 'অডিও প্লে করতে সমস্যা হয়েছে। ইন্টারনেট সংযোগ চেক করুন অথবা অডিও ডাউনলোড করুন।',
          false
        );
      });

    audioRef.current.onended = () => {
      handleAudioEnded(surahNumber, ayah.numberInSurah);
    };
  };

  const playVerse = async (surahNumber: number, ayahNumber: number) => {
    // If not in current selectedSurah, load that Surah
    if (selectedSurah?.number !== surahNumber) {
      const nextMeta = ALL_SURAHS.find((s) => s.number === surahNumber);
      if (nextMeta) {
        setSelectedSurah(nextMeta);
      }
      const loadedAyahs = await fetchSurahAyahs(surahNumber);
      setAyahs(loadedAyahs);
      const target = loadedAyahs.find((a) => a.numberInSurah === ayahNumber) || loadedAyahs[ayahNumber - 1];
      if (target) {
        playSingleAyahAudio(target, surahNumber);
      }
      return;
    }

    const target = ayahs.find((a) => a.numberInSurah === ayahNumber) || ayahs[ayahNumber - 1];
    if (target) {
      playSingleAyahAudio(target, surahNumber);
    }
  };

  const handleAudioEnded = (surahNumber: number, ayahNumber: number) => {
    if (!repeaterConfig.enabled) {
      // Standard sequential playback in current surah
      const nextIndex = ayahNumber;
      if (nextIndex < ayahs.length) {
        playSingleAyahAudio(ayahs[nextIndex], surahNumber);
      } else {
        setIsPlayingAudio(false);
        setCurrentPlayingAyah(null);
        setCurrentPlayingSurahNumber(null);
        if (typeof window !== 'undefined' && 'mediaSession' in navigator) {
          try {
            navigator.mediaSession.playbackState = 'none';
          } catch {}
        }
      }
      return;
    }

    // 1. Repeat current verse check
    if (repeaterConfig.repeatEachVerse === 'unlimited') {
      playVerse(surahNumber, ayahNumber);
      return;
    }

    const targetVerseRepeats = typeof repeaterConfig.repeatEachVerse === 'number' ? repeaterConfig.repeatEachVerse : 1;
    if (verseRepeatCountRef.current < targetVerseRepeats) {
      verseRepeatCountRef.current += 1;
      playVerse(surahNumber, ayahNumber);
      return;
    }

    // Reset verse count for next verse
    verseRepeatCountRef.current = 1;

    // 2. Check if reached end of range
    const isAtEndOfRange =
      surahNumber === repeaterConfig.toSurah && ayahNumber === repeaterConfig.toAyah;

    if (isAtEndOfRange) {
      if (repeaterConfig.repeatAll === 'off') {
        stopAudio();
        onShowAlert?.('রিপিট সম্পন্ন হয়েছে।', true);
        return;
      }

      if (repeaterConfig.repeatAll === 'unlimited') {
        allRepeatCountRef.current += 1;
        playVerse(repeaterConfig.fromSurah, repeaterConfig.fromAyah);
        return;
      }

      const targetAllRepeats = typeof repeaterConfig.repeatAll === 'number' ? repeaterConfig.repeatAll : 1;
      if (allRepeatCountRef.current < targetAllRepeats) {
        allRepeatCountRef.current += 1;
        playVerse(repeaterConfig.fromSurah, repeaterConfig.fromAyah);
        return;
      }

      stopAudio();
      onShowAlert?.('রিপিট সম্পন্ন হয়েছে।', true);
      return;
    }

    // 3. Move to next verse within range
    const surahMeta = ALL_SURAHS.find((s) => s.number === surahNumber);
    const totalAyahs = surahMeta?.numberOfAyahs || ayahs.length;

    if (ayahNumber < totalAyahs) {
      playVerse(surahNumber, ayahNumber + 1);
    } else if (surahNumber < repeaterConfig.toSurah) {
      playVerse(surahNumber + 1, 1);
    } else {
      stopAudio();
    }
  };

  const handlePrevAyah = () => {
    const currentAyah = currentPlayingAyah || 1;
    const currentSurah = currentPlayingSurahNumber || selectedSurah?.number || 1;
    if (currentAyah > 1) {
      playVerse(currentSurah, currentAyah - 1);
    } else if (currentSurah > 1) {
      const prevSurah = ALL_SURAHS.find((s) => s.number === currentSurah - 1);
      if (prevSurah) {
        playVerse(prevSurah.number, prevSurah.numberOfAyahs);
      }
    }
  };

  const handleNextAyah = () => {
    const currentAyah = currentPlayingAyah || 1;
    const currentSurah = currentPlayingSurahNumber || selectedSurah?.number || 1;
    const sMeta = ALL_SURAHS.find((s) => s.number === currentSurah);
    const total = sMeta?.numberOfAyahs || ayahs.length || 7;
    if (currentAyah < total) {
      playVerse(currentSurah, currentAyah + 1);
    } else if (currentSurah < 114) {
      playVerse(currentSurah + 1, 1);
    }
  };

  const handleTogglePlay = () => {
    if (isPlayingAudio) {
      if (audioRef.current) audioRef.current.pause();
      setIsPlayingAudio(false);
      const sNum = currentPlayingSurahNumber || selectedSurah?.number || 1;
      const aNum = currentPlayingAyah || 1;
      updateMediaSession(sNum, aNum, false);
    } else {
      if (audioRef.current && audioRef.current.src && currentPlayingAyah) {
        audioRef.current
          .play()
          .then(() => {
            setIsPlayingAudio(true);
            const sNum = currentPlayingSurahNumber || selectedSurah?.number || 1;
            updateMediaSession(sNum, currentPlayingAyah, true);
          })
          .catch(() => {
            const startAyah = currentPlayingAyah || (repeaterConfig.enabled ? repeaterConfig.fromAyah : 1);
            const startSurah = currentPlayingSurahNumber || (repeaterConfig.enabled ? repeaterConfig.fromSurah : (selectedSurah?.number || 1));
            playVerse(startSurah, startAyah);
          });
      } else {
        const startAyah = currentPlayingAyah || (repeaterConfig.enabled ? repeaterConfig.fromAyah : 1);
        const startSurah = currentPlayingSurahNumber || (repeaterConfig.enabled ? repeaterConfig.fromSurah : (selectedSurah?.number || 1));
        playVerse(startSurah, startAyah);
      }
    }
  };

  const handleSaveAndApplyRepeater = () => {
    if (
      repeaterDraft.fromSurah > repeaterDraft.toSurah ||
      (repeaterDraft.fromSurah === repeaterDraft.toSurah && repeaterDraft.fromAyah > repeaterDraft.toAyah)
    ) {
      onShowAlert?.('শুরুর আয়াত শেষের আয়াতের চেয়ে বেশি হতে পারে না।', false);
      return;
    }

    const updated = {
      ...repeaterDraft,
      enabled: true
    };
    setRepeaterConfig(updated);
    setRepeaterDraft(updated);
    try {
      localStorage.setItem('ibadat_quran_repeater', JSON.stringify(updated));
    } catch {}

    if (audioRef.current) {
      audioRef.current.playbackRate = updated.speed;
    }

    setShowRepeaterModal(false);
    verseRepeatCountRef.current = 1;
    allRepeatCountRef.current = 1;

    onShowAlert?.(
      `রিপিটার সক্রিয়: সূরা ${updated.fromSurah}:${updated.fromAyah} থেকে ${updated.toSurah}:${updated.toAyah} (স্পিড: ${updated.speed}x)`,
      true
    );

    // Auto-start repeating from the configured 'From' verse
    playVerse(updated.fromSurah, updated.fromAyah);
  };

  // Bookmark handlers
  const handleToggleBookmark = (surahNumber: number, surahName: string, ayahNumber?: number) => {
    const existing = bookmarks.find(
      (b) => b.surahNumber === surahNumber && b.ayahNumber === ayahNumber
    );
    if (existing) {
      const updated = removeBookmark(existing.id);
      setBookmarks(updated);
      onShowAlert?.('বুকমার্ক মুছে ফেলা হয়েছে।', false);
    } else {
      const updated = saveBookmark({
        surahNumber,
        surahName,
        ayahNumber
      });
      setBookmarks(updated);
      onShowAlert?.('বুকমার্কে যুক্ত করা হয়েছে।', true);
    }
  };

  const isAyahBookmarked = (surahNumber: number, ayahNumber?: number) => {
    return bookmarks.some(
      (b) => b.surahNumber === surahNumber && b.ayahNumber === ayahNumber
    );
  };

  // Copy Ayah
  const handleCopyAyah = (ayah: Ayah) => {
    const translit = ayah.transliterationBn || arabicToBengaliPronunciation(ayah.textArabic);
    const text = `${ayah.textArabic}\n\n${translit ? translit + '\n\n' : ''}${ayah.translationBn}\n(সূরা ${selectedSurah?.banglaName}, আয়াত: ${ayah.numberInSurah})`;
    navigator.clipboard?.writeText(text);
    setCopiedAyahNumber(ayah.numberInSurah);
    setTimeout(() => setCopiedAyahNumber(null), 2000);
    onShowAlert?.('আয়াত কপি করা হয়েছে!', true);
  };

  // Surah navigation in Reader
  const handlePrevSurah = () => {
    if (!selectedSurah || selectedSurah.number <= 1) return;
    const prev = ALL_SURAHS.find((s) => s.number === selectedSurah.number - 1);
    if (prev) {
      stopAudio();
      setSelectedSurah(prev);
    }
  };

  const handleNextSurah = () => {
    if (!selectedSurah || selectedSurah.number >= 114) return;
    const next = ALL_SURAHS.find((s) => s.number === selectedSurah.number + 1);
    if (next) {
      stopAudio();
      setSelectedSurah(next);
    }
  };

  // Cleanup audio and active downloads on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      revokeActiveAudioObjectUrl();
      bulkAbortRef.current?.abort();
      audioAbortRef.current?.abort();
    };
  }, []);

  // Offline Download Handlers
  const handleBulkDownloadSurahs = async (targetSurahNumbers?: number[]) => {
    if (isBulkDownloading) {
      bulkAbortRef.current?.abort();
      return;
    }

    const targets =
      targetSurahNumbers && targetSurahNumbers.length > 0
        ? targetSurahNumbers.filter((n) => !downloadedSurahSet.has(n))
        : ALL_SURAHS.filter((s) => !downloadedSurahSet.has(s.number)).map((s) => s.number);

    if (targets.length === 0) {
      onShowAlert?.('নির্বাচিত সব সূরা ইতিমধ্যে অফলাইনে সংরক্ষিত আছে।', true);
      return;
    }

    const controller = new AbortController();
    bulkAbortRef.current = controller;
    setConfirmClearOffline(false);
    setIsBulkDownloading(true);
    setBulkProgress({
      completed: 0,
      total: targets.length,
      failedCount: 0,
      currentSurahName: 'শুরু হচ্ছে...'
    });

    try {
      const result = await downloadAllSurahsOffline(
        (progress) => {
          setBulkProgress(progress);
          if (progress.downloadedSurahNumber) {
            const downloadedNum = progress.downloadedSurahNumber;
            setDownloadedSurahSet((prev) => {
              if (prev.has(downloadedNum)) return prev;
              const next = new Set(prev);
              next.add(downloadedNum);
              return next;
            });
            setSelectedDownloadSurahs((prev) => {
              if (!prev.has(downloadedNum)) return prev;
              const next = new Set(prev);
              next.delete(downloadedNum);
              return next;
            });
          }
        },
        controller.signal,
        targets
      );

      await refreshOfflineStatus();

      if (result.cancelled) {
        onShowAlert?.(
          `ডাউনলোড থামানো হয়েছে (${toBengaliNumber(result.completed)}/${toBengaliNumber(result.total)} সূরা সংরক্ষিত)।`,
          false
        );
      } else if (result.failedCount === 0) {
        onShowAlert?.(
          targetSurahNumbers && targetSurahNumbers.length > 0
            ? `নির্বাচিত ${toBengaliNumber(result.completed)}টি সূরা অফলাইনে ডাউনলোড হয়েছে।`
            : 'আলহামদুলিল্লাহ! সব ১১৪টি সূরা অফলাইনে পড়ার জন্য ডাউনলোড হয়েছে।',
          true
        );
      } else {
        onShowAlert?.(
          `${toBengaliNumber(result.completed)}/${toBengaliNumber(result.total)} সূরা সংরক্ষিত হয়েছে (${toBengaliNumber(result.failedCount)}টি ব্যর্থ)। ইন্টারনেট চেক করে আবার চেষ্টা করুন।`,
          false
        );
      }
    } finally {
      setIsBulkDownloading(false);
      bulkAbortRef.current = null;
    }
  };

  const handleToggleSelectDownloadSurah = (surahNumber: number) => {
    if (downloadedSurahSet.has(surahNumber) || isBulkDownloading) return;
    setSelectedDownloadSurahs((prev) => {
      const next = new Set(prev);
      if (next.has(surahNumber)) {
        next.delete(surahNumber);
      } else {
        next.add(surahNumber);
      }
      return next;
    });
  };

  const handleDownloadSingleSurah = async (surah: SurahMeta) => {
    if (downloadingSurahNum !== null || isBulkDownloading) return;
    setDownloadingSurahNum(surah.number);
    try {
      const ok = await downloadSingleSurahOffline(surah.number);
      if (ok) {
        setDownloadedSurahSet((prev) => new Set(prev).add(surah.number));
        setSelectedDownloadSurahs((prev) => {
          if (!prev.has(surah.number)) return prev;
          const next = new Set(prev);
          next.delete(surah.number);
          return next;
        });
        onShowAlert?.(`সূরা ${surah.banglaName} অফলাইনের জন্য ডাউনলোড হয়েছে।`, true);
      } else {
        onShowAlert?.('সূরা ডাউনলোড করতে পারেনি। ইন্টারনেট সংযোগ চেক করুন।', false);
      }
    } finally {
      setDownloadingSurahNum(null);
    }
  };

  const handleDeleteSingleOfflineSurah = async (surah: SurahMeta) => {
    if (PREBUNDLED_SURAH_NUMBERS.includes(surah.number)) return;
    await deleteOfflineSurah(surah.number);
    await refreshOfflineStatus();
    onShowAlert?.(`সূরা ${surah.banglaName} অফলাইন স্টোরেজ থেকে মুছে ফেলা হয়েছে।`, true);
  };

  const handleClearAllOffline = async () => {
    await clearAllOfflineQuranData();
    await refreshOfflineStatus();
    setSelectedDownloadSurahs(new Set());
    setConfirmClearOffline(false);
    onShowAlert?.('ডাউনলোডকৃত অফলাইন কুরআন ডেটা মুছে ফেলা হয়েছে।', true);
  };

  const handleDownloadCurrentSurahAudio = async () => {
    if (!selectedSurah) return;
    if (downloadingAudioSurahNum === selectedSurah.number) {
      audioAbortRef.current?.abort();
      return;
    }
    if (!ayahs || ayahs.length === 0) {
      onShowAlert?.('আয়াত লোড হওয়ার পর অডিও ডাউনলোড করুন।', false);
      return;
    }

    const controller = new AbortController();
    audioAbortRef.current = controller;
    setDownloadingAudioSurahNum(selectedSurah.number);
    setAudioDownloadProgress({ done: 0, total: ayahs.length });

    try {
      const ok = await downloadSurahAudioOffline(
        selectedSurah.number,
        ayahs,
        (done, total) => setAudioDownloadProgress({ done, total }),
        controller.signal
      );

      await refreshOfflineStatus();

      if (controller.signal.aborted) {
        onShowAlert?.('অডিও ডাউনলোড বাতিল করা হয়েছে।', false);
      } else if (ok) {
        onShowAlert?.(
          `সূরা ${selectedSurah.banglaName}-এর পূর্ণ তিলাওয়াত অফলাইনে সংরক্ষিত হয়েছে।`,
          true
        );
      } else {
        onShowAlert?.('কিছু আয়াতের অডিও ডাউনলোড ব্যর্থ হয়েছে। আবার চেষ্টা করুন।', false);
      }
    } finally {
      setDownloadingAudioSurahNum(null);
      audioAbortRef.current = null;
    }
  };

  // Helper for Tajweed & Tashdeed highlighting
  const renderAyahArabic = (text: string, surahNum: number, ayahNum: number): React.ReactNode => {
    return renderTajweedAyah(text, tajweedConfig, surahNum, ayahNum);
  };

  // ----------------------------------------------------
  // VIEW: SURAH READER (Screen 2)
  // ----------------------------------------------------
  if (selectedSurah) {
    const isFirstSurah = selectedSurah.number === 1;
    const isTawbah = selectedSurah.number === 9;

    return (
      <div className="min-h-screen bg-[#070b09] text-slate-100 flex flex-col font-sans -m-4">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-[#070b09]/95 backdrop-blur-md border-b border-[#15201a] px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <button
              onClick={() => {
                setSelectedSurah(null);
              }}
              className="p-1.5 -ml-1 text-slate-300 hover:text-white rounded-lg active:bg-slate-800 transition cursor-pointer shrink-0"
              aria-label="Back to Surah List"
            >
              <ChevronLeft className="w-6 h-6 stroke-[2]" />
            </button>

            {/* Circular Green Quran Emblem */}
            <div className="w-9 h-9 rounded-full bg-[#1b5e43] border border-[#2e7d58] flex items-center justify-center text-emerald-100 shadow-xs shrink-0">
              <BookOpen className="w-4 h-4 stroke-[2]" />
            </div>

            {/* Prominent Surah Name */}
            <div className="flex flex-col justify-center min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-wide leading-tight truncate">
                {selectedSurah.number}. {selectedSurah.banglaName}
              </h1>
              <div className="text-[11px] text-[#2dd4bf] font-medium leading-none mt-0.5 truncate">
                {selectedSurah.englishName} ({selectedSurah.revelationTypeBn} • {selectedSurah.numberOfAyahs} আয়াত)
              </div>
            </div>
          </div>

          {/* Top Actions: 4 Exact Icons as in Screenshot */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 text-slate-300">
            {/* 1. C= icon (Transliteration display mode) */}
            <button
              onClick={() => {
                toggleTransliteration();
                onShowAlert?.(showTransliteration ? "উচ্চারণ বন্ধ করা হয়েছে।" : "উচ্চারণ চালু করা হয়েছে।", true);
              }}
              title="উচ্চারণ প্রদর্শন / বন্ধ"
              className={`p-1.5 rounded-lg hover:bg-[#14201a] transition ${
                showTransliteration ? 'text-[#2dd4bf]' : 'text-slate-400'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 stroke-current fill-none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M 8 6 C 5 6, 3 8.5, 3 12 C 3 15.5, 5 18, 8 18" />
                <line x1="12" y1="9" x2="20" y2="9" />
                <line x1="12" y1="12" x2="20" y2="12" />
                <line x1="12" y1="15" x2="18" y2="15" />
              </svg>
            </button>

            {/* 2. ︾ ChevronsDown icon (Scroll to bottom / jump) */}
            <button
              onClick={() => {
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
              }}
              title="নিচে যান"
              className="p-1.5 rounded-lg hover:bg-[#14201a] text-slate-300 transition"
            >
              <ChevronsDown className="w-5 h-5 stroke-[2]" />
            </button>

            {/* 3. 📖 BookOpen icon (Translation display toggle) */}
            <button
              onClick={() => {
                toggleTranslation();
                onShowAlert?.(showTranslation ? "অর্থ বন্ধ করা হয়েছে।" : "অর্থ চালু করা হয়েছে।", true);
              }}
              title="অর্থ প্রদর্শন / বন্ধ"
              className={`p-1.5 rounded-lg hover:bg-[#14201a] transition ${
                showTranslation ? 'text-[#2dd4bf]' : 'text-slate-400'
              }`}
            >
              <BookOpen className="w-5 h-5 stroke-[1.8]" />
            </button>

            {/* 4. 🎨 Tajweed & Tashdeed Settings icon */}
            <button
              onClick={() => setShowTajweedModal(true)}
              title="তাজবীদ ও তাশদীদ সেটিংস (Tajweed Setting)"
              className={`p-1.5 rounded-lg hover:bg-[#14201a] transition ${
                tajweedConfig.enabled ? 'text-[#f59e0b]' : 'text-slate-400'
              }`}
            >
              <Palette className="w-5 h-5 stroke-[1.8]" />
            </button>

            {/* 5. ⚙ Gear Settings icon */}
            <button
              onClick={() => setShowSettingsModal(true)}
              title="পড়ার সেটিংস ও ফন্ট"
              className="p-1.5 rounded-lg hover:bg-[#14201a] text-slate-300 transition"
            >
              <SettingsIcon className="w-5 h-5 stroke-[1.8]" />
            </button>
          </div>
        </header>

        {/* Reader Body Content */}
        <div className={`flex-1 px-3 py-3 max-w-xl mx-auto w-full space-y-3 transition-all ${
          currentPlayingAyah !== null ? 'pb-48' : 'pb-24'
        }`}>
          {/* Ornate Islamic Framed Banner (100% matches Screenshot) */}
          <div className="relative rounded-lg overflow-hidden border border-[#8f7347]/90 bg-[#121915] p-2 shadow-md">
            {/* Arabesque filigree decorative border overlay */}
            <div className="absolute inset-0.5 border border-[#8f7347]/40 rounded-md pointer-events-none" />
            
            {/* Corner scrollwork flourishes */}
            <div className="absolute top-0.5 left-0.5 w-3 h-3 border-t-2 border-l-2 border-[#c49b63] rounded-tl-sm pointer-events-none" />
            <div className="absolute top-0.5 right-0.5 w-3 h-3 border-t-2 border-r-2 border-[#c49b63] rounded-tr-sm pointer-events-none" />
            <div className="absolute bottom-0.5 left-0.5 w-3 h-3 border-b-2 border-l-2 border-[#c49b63] rounded-bl-sm pointer-events-none" />
            <div className="absolute bottom-0.5 right-0.5 w-3 h-3 border-b-2 border-r-2 border-[#c49b63] rounded-br-sm pointer-events-none" />

            <div className="relative flex items-center justify-between gap-1.5 sm:gap-3">
              {/* Left Box: Kaaba emblem */}
              <div className="w-[62px] h-[46px] rounded-t-full rounded-b-xl border border-[#8f7347]/80 bg-[#141f19] flex items-center justify-center text-xl shadow-inner shrink-0">
                <span className="leading-none select-none">🕋</span>
              </div>

              {/* Center Box: Arabic Calligraphy Title in Arched Frame */}
              <div className="flex-1 flex items-center justify-center border-y border-[#8f7347]/50 bg-[#141f19]/80 rounded-2xl py-1 px-3 min-h-[46px] shadow-inner">
                <div
                  style={{ fontFamily: "'Amiri', serif" }}
                  className="text-2xl sm:text-3xl font-bold text-white tracking-widest drop-shadow-sm select-none"
                >
                  {selectedSurah.name}
                </div>
              </div>

              {/* Right Box: Verse Count Badge */}
              <div className="w-[62px] h-[46px] rounded-t-full rounded-b-xl border border-[#8f7347]/80 bg-[#141f19] flex flex-col items-center justify-center text-center shadow-inner shrink-0 leading-tight">
                <span className="text-xs font-bold text-slate-100">
                  {selectedSurah.numberOfAyahs}
                </span>
                <span className="text-[9px] font-medium text-slate-300 tracking-wider">
                  Verses
                </span>
              </div>
            </div>
          </div>

          {/* Offline Status & Audio Download Strip for Current Surah */}
          {!loadingAyahs && ayahs.length > 0 && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#101914] border border-[#1a2921] text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-300/90 min-w-0">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">আরবি ও বাংলা অফলাইনে সংরক্ষিত</span>
              </div>

              {downloadingAudioSurahNum === selectedSurah.number ? (
                <button
                  onClick={handleDownloadCurrentSurahAudio}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-700/40 text-amber-200 hover:bg-amber-900/60 transition shrink-0"
                >
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>
                    অডিও {toBengaliNumber(audioDownloadProgress.done)}/{toBengaliNumber(audioDownloadProgress.total)} (বাতিল)
                  </span>
                </button>
              ) : downloadedAudioSet.has(selectedSurah.number) ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-950/60 border border-emerald-700/40 text-emerald-300 shrink-0">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>অফলাইন অডিও</span>
                </span>
              ) : (
                <button
                  onClick={handleDownloadCurrentSurahAudio}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#162921] border border-teal-600/40 text-[#2dd4bf] hover:bg-[#1c342a] transition shrink-0 cursor-pointer"
                >
                  <Download className="w-3 h-3" />
                  <span>অডিও ডাউনলোড</span>
                </button>
              )}
            </div>
          )}

          {/* Bismillah Calligraphy (Only if not Tawbah and not Fatihah) */}
          {!isTawbah && !isFirstSurah && (
            <div className="text-center py-3 select-none">
              <div
                style={{ fontFamily: "'Amiri', serif" }}
                className="text-2xl sm:text-3xl font-semibold text-white tracking-widest drop-shadow-sm leading-relaxed"
              >
                بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
              </div>
            </div>
          )}

          {/* Loading Indicator */}
          {loadingAyahs && (
            <div className="py-16 text-center space-y-3">
              <div className="inline-block w-8 h-8 border-3 border-teal-500/30 border-t-teal-400 rounded-full animate-spin" />
              <div className="text-xs text-slate-400">কুরআন আয়াত লোড হচ্ছে...</div>
            </div>
          )}

          {/* Error Message */}
          {loadError && (
            <div className="p-4 bg-red-950/40 border border-red-800/40 rounded-xl text-center space-y-2">
              <div className="text-sm text-red-300">{loadError}</div>
              <button
                onClick={() => {
                  setLoadingAyahs(true);
                  setLoadError(null);
                  fetchSurahAyahs(selectedSurah.number)
                    .then((data) => {
                      if (data && data.length > 0) {
                        setAyahs(data);
                        setDownloadedSurahSet((prev) => new Set(prev).add(selectedSurah.number));
                      } else {
                        setLoadError('ইন্টারনেট সংযোগ চেক করুন অথবা পুনরায় চেষ্টা করুন।');
                      }
                    })
                    .catch(() => setLoadError('কুরআন আয়াত লোড করতে সমস্যা হয়েছে।'))
                    .finally(() => setLoadingAyahs(false));
                }}
                className="px-4 py-1.5 bg-red-900/60 hover:bg-red-800 text-xs text-red-100 rounded-lg transition"
              >
                পুনরায় চেষ্টা করুন
              </button>
            </div>
          )}

          {/* Ayah List (Exact clean layout without bulky cards, identical to Screenshot) */}
          {!loadingAyahs &&
            ayahs.map((ayah) => {
              const isPlayingThisAyah = currentPlayingAyah === ayah.numberInSurah;
              const isLastReadAyah =
                lastRead &&
                lastRead.surahNumber === selectedSurah.number &&
                lastRead.ayahNumber === ayah.numberInSurah;

              return (
                <div
                  key={ayah.numberInSurah}
                  id={`ayah-${ayah.numberInSurah}`}
                  onClick={() => setSelectedAyahForSheet(ayah)}
                  className={`py-3.5 px-2.5 -mx-1 rounded-2xl border-b border-[#141e17]/50 space-y-2 transition-all cursor-pointer group ${
                    isPlayingThisAyah
                      ? 'bg-[#15271e] ring-1 ring-teal-500/50 shadow-md'
                      : isLastReadAyah
                      ? 'bg-[#121c17] border-l-2 border-l-teal-500/80 hover:bg-[#16231c]'
                      : 'hover:bg-[#131d17]/80 active:bg-[#17251d]'
                  }`}
                  title="আয়াত অপশন ও তিলাওয়াত মেনু খুলতে ক্লিক করুন"
                >
                  {/* Top Row: Left 8-lobed Scalloped Rosette + Right Arabic Ayah Text */}
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: 8-lobed Islamic Rosette with Ayah Number */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAyahForSheet(ayah);
                      }}
                      className="cursor-pointer active:scale-95 transition shrink-0 pt-0.5"
                      title="অপশন ও মেন্যু"
                    >
                      <IslamicStar
                        number={ayah.numberInSurah}
                        size={34}
                        numberClassName={
                          isPlayingThisAyah
                            ? 'text-[#4ade80] text-[11px] font-bold'
                            : 'text-[#2dd4bf] text-[11px] font-semibold'
                        }
                      />
                    </div>

                    {/* Right: Arabic Text with Tajweed & Circle End-of-Verse marker */}
                    <div
                      dir="rtl"
                      style={{
                        fontFamily: "'Amiri', serif",
                        fontSize: `${arabicFontSize}px`,
                        lineHeight: '2.2'
                      }}
                      className="text-right text-white font-normal tracking-wide px-1 select-text flex-1"
                    >
                      {renderAyahArabic(ayah.textArabic, selectedSurah.number, ayah.numberInSurah)}
                      <span
                        className={`inline-flex items-center justify-center w-[22px] h-[22px] rounded-full border text-[11px] font-sans mr-2 align-middle select-none shrink-0 ${
                          isPlayingThisAyah
                            ? 'border-teal-400 text-teal-300 font-bold'
                            : 'border-white/80 text-white'
                        }`}
                      >
                        {toArabicNumber(ayah.numberInSurah)}
                      </span>
                    </div>
                  </div>

                  {/* Bengali Transliteration (উচ্চারণ) - Balanced Soft Teal */}
                  {showTransliteration && (ayah.transliterationBn || ayah.textArabic) && (
                    <div className="text-[#5eead4]/90 text-[14px] leading-[1.8] tracking-[0.01em] font-normal pt-1 pl-1">
                      {ayah.transliterationBn || arabicToBengaliPronunciation(ayah.textArabic)}
                    </div>
                  )}

                  {/* Bengali Translation (অনুবাদ) - Soft Silver/Ash Gray */}
                  {showTranslation && ayah.translationBn && (
                    <div className="text-[#cbd5e1] text-[13px] leading-relaxed font-normal pt-0.5 pl-1">
                      {ayah.translationBn}
                    </div>
                  )}
                </div>
              );
            })}

          {/* Bottom Next/Prev Surah Navigator */}
          {!loadingAyahs && ayahs.length > 0 && (
            <div className="flex items-center justify-between pt-6 pb-8 border-t border-[#141e18]">
              <button
                disabled={selectedSurah.number <= 1}
                onClick={handlePrevSurah}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition ${
                  selectedSurah.number <= 1
                    ? 'opacity-40 border-slate-800 text-slate-600 cursor-not-allowed'
                    : 'border-[#23352c] text-slate-300 hover:text-white hover:bg-[#16231c]'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                <span>পূর্ববর্তী সূরা</span>
              </button>

              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-3 py-1.5 text-xs text-[#2dd4bf] hover:underline"
              >
                উপরে যান ↑
              </button>

              <button
                disabled={selectedSurah.number >= 114}
                onClick={handleNextSurah}
                className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition ${
                  selectedSurah.number >= 114
                    ? 'opacity-40 border-slate-800 text-slate-600 cursor-not-allowed'
                    : 'border-[#23352c] text-slate-300 hover:text-white hover:bg-[#16231c]'
                }`}
              >
                <span>পরবর্তী সূরা</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Docked Quran Audio Player Bar (docks directly above BottomNav) */}
        {(isPlayingAudio || currentPlayingAyah !== null) && selectedSurah && (
          <div className="fixed bottom-16 left-0 right-0 z-30 bg-[#0c0f0d]/98 border-t border-b border-[#4a3628] shadow-[0_-8px_30px_rgba(0,0,0,0.9)] backdrop-blur-md py-2 px-4 flex flex-col items-center max-w-[420px] mx-auto animate-in slide-in-from-bottom duration-300">
            {/* Top Pill with Surah & Verse info and 9-dot rosette ornaments */}
            <div className="flex items-center justify-center gap-3 px-5 py-1.5 rounded-full bg-[#251b14] border border-[#443226] shadow-md text-xs font-medium text-[#dfc5ac]">
              <svg className="w-3.5 h-3.5 text-[#bfa085] opacity-80 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="2.2" />
                <circle cx="6" cy="12" r="1.8" />
                <circle cx="18" cy="12" r="1.8" />
                <circle cx="12" cy="6" r="1.8" />
                <circle cx="12" cy="18" r="1.8" />
                <circle cx="7.8" cy="7.8" r="1.6" />
                <circle cx="16.2" cy="7.8" r="1.6" />
                <circle cx="7.8" cy="16.2" r="1.6" />
                <circle cx="16.2" cy="16.2" r="1.6" />
              </svg>
              <span className="tracking-wide select-none font-medium">
                QS. {playingSurahMeta?.englishName || selectedSurah.englishName} {playingSurahMeta?.number || selectedSurah.number}: Verse {currentPlayingAyah || 1}
              </span>
              <svg className="w-3.5 h-3.5 text-[#bfa085] opacity-80 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="2.2" />
                <circle cx="6" cy="12" r="1.8" />
                <circle cx="18" cy="12" r="1.8" />
                <circle cx="12" cy="6" r="1.8" />
                <circle cx="12" cy="18" r="1.8" />
                <circle cx="7.8" cy="7.8" r="1.6" />
                <circle cx="16.2" cy="7.8" r="1.6" />
                <circle cx="7.8" cy="16.2" r="1.6" />
                <circle cx="16.2" cy="16.2" r="1.6" />
              </svg>
            </div>

            {/* Player Controls Row (Settings, Prev, Play/Pause, Next, Stop) */}
            <div className="flex items-center justify-between w-full max-w-xs px-2 pt-2.5 pb-1 text-white">
              {/* Settings button */}
              <button
                type="button"
                onClick={() => {
                  const sNum = currentPlayingSurahNumber || selectedSurah.number;
                  const sMeta = ALL_SURAHS.find((s) => s.number === sNum);
                  setRepeaterDraft({
                    ...repeaterConfig,
                    fromSurah: sNum,
                    fromAyah: currentPlayingAyah || 1,
                    toSurah: sNum,
                    toAyah: sMeta?.numberOfAyahs || selectedSurah.numberOfAyahs || 7
                  });
                  setShowRepeaterModal(true);
                }}
                className="p-2 hover:text-slate-300 active:scale-90 transition cursor-pointer text-slate-100"
                title="সেটিংস ও রিপিটার (Set Repeater)"
              >
                <SettingsIcon className="w-5 h-5 text-slate-200 hover:rotate-45 transition-transform" />
              </button>

              {/* Prev button */}
              <button
                type="button"
                onClick={handlePrevAyah}
                className="p-2 hover:text-slate-300 active:scale-90 transition cursor-pointer text-slate-100"
                title="পূর্ববর্তী আয়াত (Previous Verse)"
              >
                <SkipBack className="w-5 h-5 fill-white text-white" />
              </button>

              {/* Play / Pause button */}
              <button
                type="button"
                onClick={handleTogglePlay}
                className="p-2 active:scale-90 transition cursor-pointer text-white flex items-center justify-center"
                title={isPlayingAudio ? 'Pause' : 'Play'}
              >
                {isPlayingAudio ? (
                  <Pause className="w-8 h-8 fill-white text-white stroke-none drop-shadow-sm" />
                ) : (
                  <Play className="w-8 h-8 fill-white text-white ml-0.5 stroke-none drop-shadow-sm" />
                )}
              </button>

              {/* Next button */}
              <button
                type="button"
                onClick={handleNextAyah}
                className="p-2 hover:text-slate-300 active:scale-90 transition cursor-pointer text-slate-100"
                title="পরবর্তী আয়াত (Next Verse)"
              >
                <SkipForward className="w-5 h-5 fill-white text-white" />
              </button>

              {/* Stop button */}
              <button
                type="button"
                onClick={stopAudio}
                className="p-2 hover:text-red-400 active:scale-90 transition cursor-pointer text-slate-100"
                title="বন্ধ করুন (Stop)"
              >
                <Square className="w-5 h-5 fill-white text-white hover:text-red-400 rounded-xs" />
              </button>
            </div>
          </div>
        )}

        {/* Set Repeater Modal (Matching User Screenshot 2) */}
        {showRepeaterModal && (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 backdrop-blur-xs">
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#19231f] border border-[#2c3d33] rounded-2xl w-full max-w-sm p-5 shadow-2xl text-slate-100 space-y-4"
            >
              {/* Title */}
              <h3 className="text-lg font-bold text-white tracking-wide">
                Set Repeater
              </h3>

              {/* 1. From Section */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">From</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <select
                      value={repeaterDraft.fromSurah}
                      onChange={(e) => handleFromSurahChange(parseInt(e.target.value, 10))}
                      className="w-full appearance-none bg-[#131b17] border border-[#27382e] text-[#2dd4bf] rounded-xl pl-3 pr-7 py-2 text-xs font-semibold focus:outline-none focus:border-teal-500 cursor-pointer"
                    >
                      {ALL_SURAHS.map((s) => (
                        <option key={s.number} value={s.number} className="bg-[#18221d] text-slate-200">
                          {s.number}. {s.englishName}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#2dd4bf] text-[10px]">
                      ▼
                    </div>
                  </div>

                  <div className="relative w-24">
                    <select
                      value={repeaterDraft.fromAyah}
                      onChange={(e) => handleFromAyahChange(parseInt(e.target.value, 10))}
                      className="w-full appearance-none bg-[#131b17] border border-[#27382e] text-[#2dd4bf] rounded-xl pl-3 pr-6 py-2 text-xs font-semibold focus:outline-none focus:border-teal-500 cursor-pointer text-center"
                    >
                      {Array.from({ length: fromSurahMeta.numberOfAyahs }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n} className="bg-[#18221d] text-slate-200">
                          {n}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#2dd4bf] text-[10px]">
                      ▼
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. To Section */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">To</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <select
                      value={repeaterDraft.toSurah}
                      onChange={(e) => handleToSurahChange(parseInt(e.target.value, 10))}
                      className="w-full appearance-none bg-[#131b17] border border-[#27382e] text-[#2dd4bf] rounded-xl pl-3 pr-7 py-2 text-xs font-semibold focus:outline-none focus:border-teal-500 cursor-pointer"
                    >
                      {ALL_SURAHS.map((s) => (
                        <option key={s.number} value={s.number} className="bg-[#18221d] text-slate-200">
                          {s.number}. {s.englishName}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#2dd4bf] text-[10px]">
                      ▼
                    </div>
                  </div>

                  <div className="relative w-24">
                    <select
                      value={repeaterDraft.toAyah}
                      onChange={(e) => setRepeaterDraft((prev) => ({ ...prev, toAyah: parseInt(e.target.value, 10) }))}
                      className="w-full appearance-none bg-[#131b17] border border-[#27382e] text-[#2dd4bf] rounded-xl pl-3 pr-6 py-2 text-xs font-semibold focus:outline-none focus:border-teal-500 cursor-pointer text-center"
                    >
                      {Array.from({ length: toSurahMeta.numberOfAyahs }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n} className="bg-[#18221d] text-slate-200">
                          {n}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#2dd4bf] text-[10px]">
                      ▼
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Repeat Each Verse */}
              <div className="flex items-center justify-between py-2 border-t border-[#233328]">
                <span className="text-xs font-medium text-slate-200">Repeat Each Verse</span>
                <div className="relative">
                  <select
                    value={repeaterDraft.repeatEachVerse}
                    onChange={(e) => {
                      const val = e.target.value === 'unlimited' ? 'unlimited' : parseInt(e.target.value, 10);
                      setRepeaterDraft((prev) => ({ ...prev, repeatEachVerse: val }));
                    }}
                    className="appearance-none bg-[#131b17] border border-[#27382e] text-[#2dd4bf] rounded-xl pl-3 pr-7 py-1.5 text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="1" className="bg-[#18221d] text-slate-200">1 x</option>
                    <option value="2" className="bg-[#18221d] text-slate-200">2 x</option>
                    <option value="3" className="bg-[#18221d] text-slate-200">3 x</option>
                    <option value="5" className="bg-[#18221d] text-slate-200">5 x</option>
                    <option value="7" className="bg-[#18221d] text-slate-200">7 x</option>
                    <option value="10" className="bg-[#18221d] text-slate-200">10 x</option>
                    <option value="20" className="bg-[#18221d] text-slate-200">20 x</option>
                    <option value="unlimited" className="bg-[#18221d] text-slate-200">∞</option>
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#2dd4bf] text-[10px]">
                    ▼
                  </div>
                </div>
              </div>

              {/* 4. Repeat All of Them */}
              <div className="flex items-center justify-between py-2 border-t border-[#233328]">
                <span className="text-xs font-medium text-slate-200">Repeat All of Them</span>
                <div className="relative">
                  <select
                    value={repeaterDraft.repeatAll}
                    onChange={(e) => {
                      const val = e.target.value === 'unlimited' || e.target.value === 'off' ? e.target.value : parseInt(e.target.value, 10);
                      setRepeaterDraft((prev) => ({ ...prev, repeatAll: val }));
                    }}
                    className="appearance-none bg-[#131b17] border border-[#27382e] text-[#2dd4bf] rounded-xl pl-3 pr-7 py-1.5 text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="unlimited" className="bg-[#18221d] text-slate-200">∞</option>
                    <option value="1" className="bg-[#18221d] text-slate-200">1 x</option>
                    <option value="2" className="bg-[#18221d] text-slate-200">2 x</option>
                    <option value="3" className="bg-[#18221d] text-slate-200">3 x</option>
                    <option value="5" className="bg-[#18221d] text-slate-200">5 x</option>
                    <option value="10" className="bg-[#18221d] text-slate-200">10 x</option>
                    <option value="off" className="bg-[#18221d] text-slate-200">Off</option>
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#2dd4bf] text-[10px]">
                    ▼
                  </div>
                </div>
              </div>

              {/* 5. Speed of Murattal */}
              <div className="flex items-center justify-between py-2 border-t border-[#233328]">
                <span className="text-xs font-medium text-slate-200">Speed of Murattal</span>
                <div className="relative">
                  <select
                    value={repeaterDraft.speed}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setRepeaterDraft((prev) => ({ ...prev, speed: val }));
                    }}
                    className="appearance-none bg-[#131b17] border border-[#27382e] text-[#2dd4bf] rounded-xl pl-3 pr-7 py-1.5 text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="0.75" className="bg-[#18221d] text-slate-200">Slow</option>
                    <option value="0.85" className="bg-[#18221d] text-slate-200">Slightly Slow</option>
                    <option value="1" className="bg-[#18221d] text-slate-200">Default</option>
                    <option value="1.15" className="bg-[#18221d] text-slate-200">Slightly Fast</option>
                    <option value="1.25" className="bg-[#18221d] text-slate-200">Fast</option>
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#2dd4bf] text-[10px]">
                    ▼
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-5 pt-3 border-t border-[#233328]">
                <button
                  type="button"
                  onClick={() => setShowRepeaterModal(false)}
                  className="text-xs font-bold text-slate-400 hover:text-white transition cursor-pointer tracking-wider"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndApplyRepeater}
                  className="text-xs font-bold text-teal-400 hover:text-teal-300 transition cursor-pointer tracking-wider"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {showSettingsModal && (
          <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
            <div className="bg-[#121a16] border border-[#23352c] rounded-2xl w-full max-w-sm p-4 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#1c2923] pb-3">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <SettingsIcon className="w-4 h-4 text-[#2dd4bf]" />
                  <span>কুরআন পড়ার সেটিংস</span>
                </h3>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Arabic Font Size Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300">
                  <span>আরবি ফন্ট সাইজ</span>
                  <span className="font-semibold text-[#2dd4bf]">{arabicFontSize}px</span>
                </div>
                <input
                  type="range"
                  min="22"
                  max="42"
                  value={arabicFontSize}
                  onChange={(e) => updateArabicFontSize(parseInt(e.target.value, 10))}
                  className="w-full accent-[#2dd4bf] cursor-pointer"
                />
                <div className="text-right text-lg text-slate-100 font-serif pt-1 select-none" style={{ fontFamily: "'Amiri', serif" }}>
                  بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                </div>
              </div>

              {/* Transliteration Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-[#1c2923]">
                <div>
                  <div className="text-xs font-medium text-slate-200">বাংলা উচ্চারণ (উচ্চারণ)</div>
                  <div className="text-[10px] text-slate-400">উচ্চারণ সহায়তা প্রদর্শন করুন</div>
                </div>
                <button
                  onClick={toggleTransliteration}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    showTransliteration ? 'bg-teal-600' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      showTransliteration ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Translation Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-[#1c2923]">
                <div>
                  <div className="text-xs font-medium text-slate-200">বাংলা অনুবাদ (অর্থ)</div>
                  <div className="text-[10px] text-slate-400">মুহিউদ্দীন খানের বঙ্গানুবাদ</div>
                </div>
                <button
                  onClick={toggleTranslation}
                  className={`w-11 h-6 rounded-full transition-colors relative ${
                    showTranslation ? 'bg-teal-600' : 'bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      showTranslation ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Tajweed / Tashdeed Color Rules Toggle & Modal Link */}
              <div className="pt-2 border-t border-[#1c2923] space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-medium text-slate-200">তাশদীদ ও তাজবীদ কালার</div>
                    <div className="text-[10px] text-slate-400">হরফের উপর অটোমেটিক কালার হাইলাইট</div>
                  </div>
                  <button
                    onClick={toggleTajweed}
                    className={`w-11 h-6 rounded-full transition-colors relative ${
                      tajweedConfig.enabled ? 'bg-amber-600' : 'bg-slate-700'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        tajweedConfig.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    setShowTajweedModal(true);
                  }}
                  className="w-full py-1.5 px-3 bg-[#17231c] hover:bg-[#1f2f26] border border-[#23352c] rounded-xl text-xs text-[#2dd4bf] font-medium flex items-center justify-between transition"
                >
                  <span className="flex items-center space-x-1.5">
                    <Palette className="w-3.5 h-3.5 text-[#f59e0b]" />
                    <span>তাজবীদ রুলস ও উদাহরণ দেখুন</span>
                  </span>
                  <span>→</span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="w-full py-2 bg-teal-700 hover:bg-teal-600 text-xs font-semibold text-white rounded-xl transition"
                >
                  সংরক্ষণ করুন
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dedicated Tajweed Setting Modal (Matches User Screenshot) */}
        <TajweedSettingModal
          isOpen={showTajweedModal}
          onClose={() => setShowTajweedModal(false)}
          config={tajweedConfig}
          onConfigChange={(newCfg) => setTajweedConfig(newCfg)}
          onShowAlert={onShowAlert}
        />

        {/* Ayah Options Bottom Sheet (100% matches User Screenshot) */}
        {selectedAyahForSheet && selectedSurah && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* Dark Backdrop */}
            <div
              className="fixed inset-0 bg-black/75 backdrop-blur-[2px] transition-opacity"
              onClick={() => setSelectedAyahForSheet(null)}
            />

            {/* Bottom Sheet Drawer */}
            <div
              className="relative z-10 w-full max-w-lg mx-auto bg-[#141b17] border-t border-[#26372c] rounded-t-[28px] shadow-2xl overflow-hidden pb-8 select-none"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Drag Handle */}
              <div className="pt-3 pb-2.5 flex justify-center">
                <div className="w-12 h-1 rounded-full bg-[#3d4f43]" />
              </div>

              {/* Header: Exact format 'QS. Al-Fatihah 1: Verse 2' */}
              <div className="text-center px-4 pb-3.5 border-b border-[#1f2b23]">
                <h3 className="text-[15px] font-bold text-white tracking-wide">
                  QS. {selectedSurah.englishName} {selectedSurah.number}: Verse {selectedAyahForSheet.numberInSurah}
                </h3>
              </div>

              {/* Options List matching User Screenshot */}
              <div className="py-2 px-3 space-y-1">
                {/* 1. Play Murattal (Plays ONLY that specific ayah) */}
                <button
                  onClick={() => {
                    playSingleAyahAudio(selectedAyahForSheet, selectedSurah.number);
                    setSelectedAyahForSheet(null);
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left rounded-xl hover:bg-[#1a251e] active:bg-[#203027] transition cursor-pointer group"
                >
                  {isPlayingAudio && currentPlayingAyah === selectedAyahForSheet.numberInSurah ? (
                    <>
                      <Pause className="w-5 h-5 text-teal-400 fill-teal-400 shrink-0" />
                      <span className="text-[15px] font-medium text-teal-300">
                        Pause Murattal
                      </span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 text-slate-300 group-hover:text-teal-300 shrink-0" />
                      <span className="text-[15px] font-medium text-slate-200 group-hover:text-white">
                        Play Murattal
                      </span>
                    </>
                  )}
                </button>

                {/* 2. View Translation */}
                <button
                  onClick={() => {
                    if (!showTranslation) {
                      setShowTranslation(true);
                      localStorage.setItem('ibadat_quran_show_translat', 'true');
                    }
                    setSelectedAyahForSheet(null);
                    setTimeout(() => {
                      const el = document.getElementById(`ayah-${selectedAyahForSheet.numberInSurah}`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                    onShowAlert?.(
                      `আয়াত ${toBengaliNumber(selectedAyahForSheet.numberInSurah)}-এর অনুবাদ দেখানো হচ্ছে`,
                      true
                    );
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left rounded-xl hover:bg-[#1a251e] active:bg-[#203027] transition cursor-pointer group"
                >
                  <BookOpen className="w-5 h-5 text-slate-300 group-hover:text-teal-300 shrink-0" />
                  <span className="text-[15px] font-medium text-slate-200 group-hover:text-white">
                    View Translation
                  </span>
                </button>

                {/* 3. Share Verse */}
                <button
                  onClick={() => {
                    const ayah = selectedAyahForSheet;
                    const translit =
                      ayah.transliterationBn || arabicToBengaliPronunciation(ayah.textArabic);
                    const text = `${ayah.textArabic}\n\n${translit ? translit + '\n\n' : ''}${
                      ayah.translationBn
                    }\n\n(QS. ${selectedSurah.englishName} ${selectedSurah.number}: Verse ${
                      ayah.numberInSurah
                    } - সূরা ${selectedSurah.banglaName})`;
                    if (navigator.share) {
                      navigator
                        .share({
                          title: `QS. ${selectedSurah.englishName} ${selectedSurah.number}:${ayah.numberInSurah}`,
                          text: text
                        })
                        .catch(() => {});
                    } else {
                      navigator.clipboard?.writeText(text);
                      onShowAlert?.('আয়াত কপি করা হয়েছে (শেয়ার করার জন্য)', true);
                    }
                    setSelectedAyahForSheet(null);
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left rounded-xl hover:bg-[#1a251e] active:bg-[#203027] transition cursor-pointer group"
                >
                  <Share2 className="w-5 h-5 text-slate-300 group-hover:text-teal-300 shrink-0" />
                  <span className="text-[15px] font-medium text-slate-200 group-hover:text-white">
                    Share Verse
                  </span>
                </button>

                {/* 4. Copy Verse */}
                <button
                  onClick={() => {
                    handleCopyAyah(selectedAyahForSheet);
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left rounded-xl hover:bg-[#1a251e] active:bg-[#203027] transition cursor-pointer group"
                >
                  {copiedAyahNumber === selectedAyahForSheet.numberInSurah ? (
                    <>
                      <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span className="text-[15px] font-medium text-emerald-300">
                        কপি হয়েছে (Copied!)
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-5 h-5 text-slate-300 group-hover:text-teal-300 shrink-0" />
                      <span className="text-[15px] font-medium text-slate-200 group-hover:text-white">
                        Copy Verse
                      </span>
                    </>
                  )}
                </button>

                {/* 5. Add / Remove Bookmark */}
                <button
                  onClick={() => {
                    handleToggleBookmark(
                      selectedSurah.number,
                      selectedSurah.banglaName,
                      selectedAyahForSheet.numberInSurah
                    );
                    setSelectedAyahForSheet(null);
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left rounded-xl hover:bg-[#1a251e] active:bg-[#203027] transition cursor-pointer group"
                >
                  {isAyahBookmarked(selectedSurah.number, selectedAyahForSheet.numberInSurah) ? (
                    <>
                      <BookmarkCheck className="w-5 h-5 text-teal-400 shrink-0" />
                      <span className="text-[15px] font-medium text-teal-300">
                        Remove Bookmark
                      </span>
                    </>
                  ) : (
                    <>
                      <BookmarkPlus className="w-5 h-5 text-slate-300 group-hover:text-teal-300 shrink-0" />
                      <span className="text-[15px] font-medium text-slate-200 group-hover:text-white">
                        Add to Bookmark
                      </span>
                    </>
                  )}
                </button>

                {/* 6. Mark as Last Read */}
                <button
                  onClick={() => {
                    const record = {
                      surahNumber: selectedSurah.number,
                      surahName: selectedSurah.banglaName,
                      surahEnglishName: selectedSurah.englishName,
                      ayahNumber: selectedAyahForSheet.numberInSurah,
                      timestamp: Date.now()
                    };
                    try {
                      localStorage.setItem('ibadat_quran_last_read', JSON.stringify(record));
                    } catch {
                      // ignore
                    }
                    setLastRead(record);
                    onShowAlert?.(
                      `সর্বশেষ পঠিত চিহ্নিত করা হয়েছে: QS. ${selectedSurah.englishName} ${selectedSurah.number}: Verse ${selectedAyahForSheet.numberInSurah}`,
                      true
                    );
                    setSelectedAyahForSheet(null);
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left rounded-xl hover:bg-[#1a251e] active:bg-[#203027] transition cursor-pointer group"
                >
                  <Paperclip className="w-5 h-5 text-slate-300 group-hover:text-teal-300 shrink-0" />
                  <div className="flex-1 flex items-center justify-between">
                    <span className="text-[15px] font-medium text-slate-200 group-hover:text-white">
                      Mark as Last Read
                    </span>
                    {lastRead &&
                      lastRead.surahNumber === selectedSurah.number &&
                      lastRead.ayahNumber === selectedAyahForSheet.numberInSurah && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-900/60 text-teal-300 border border-teal-700/50">
                          বর্তমান
                        </span>
                      )}
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ----------------------------------------------------
  // VIEW: MAIN LIST SCREEN (Screenshot 1)
  // ----------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0e1412] text-slate-100 flex flex-col font-sans -m-4">
      {/* Top Header Bar (Screenshot 1) */}
      <header className="sticky top-0 z-30 bg-[#0e1412]/95 backdrop-blur-md border-b border-[#1c2923] px-3.5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            {/* Teal Quran Emblem Icon */}
            <div className="w-8 h-8 rounded-full bg-teal-800/80 border border-teal-500/50 flex items-center justify-center text-teal-200 shadow-xs">
              <BookOpen className="w-4 h-4 stroke-[2]" />
            </div>
            <h1 className="text-base font-bold text-white tracking-wide">
              Read Qur'an
            </h1>
          </div>

          <div className="flex items-center space-x-1 text-slate-300">
            {/* Offline Surah Download Manager Icon */}
            <button
              onClick={() => setShowOfflineModal(true)}
              title="অফলাইন সূরা ডাউনলোড তালিকা"
              className={`relative p-2 rounded-lg transition cursor-pointer ${
                isBulkDownloading || showOfflineModal
                  ? 'bg-teal-900/60 text-[#2dd4bf]'
                  : downloadedSurahSet.size >= 114
                  ? 'text-emerald-400 hover:bg-[#16231d]'
                  : 'hover:bg-[#16231d] text-slate-300'
              }`}
            >
              {isBulkDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[14px] px-1 rounded-full bg-[#152920] border border-[#284b3b] text-[8px] font-bold text-[#2dd4bf] flex items-center justify-center leading-none">
                {downloadedSurahSet.size}
              </span>
            </button>

            {/* View / Sort icon */}
            <button
              onClick={() => {
                onShowAlert?.('সূরা তালিকা ক্রম অনুযায়ী সাজানো আছে।', true);
              }}
              title="ভিউ মোড"
              className="p-2 rounded-lg hover:bg-[#16231d] text-slate-300 transition"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {/* Search Icon */}
            <button
              onClick={() => setIsSearchOpen((prev) => !prev)}
              title="সূরা খুঁজুন"
              className={`p-2 rounded-lg transition ${
                isSearchOpen ? 'bg-teal-900/60 text-[#2dd4bf]' : 'hover:bg-[#16231d] text-slate-300'
              }`}
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Quick Bookmark Action */}
            <button
              onClick={() => setSubTab('BOOKMARK')}
              title="বুকমার্ক দেখুন"
              className="p-2 rounded-lg hover:bg-[#16231d] text-slate-300 transition"
            >
              <Bookmark className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Search Input */}
        {isSearchOpen && (
          <div className="mt-2.5 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="সূরার নাম অথবা নম্বর দিয়ে খুঁজুন (যেমন: Fatihah, 36, ইয়াসীন)..."
              autoFocus
              className="w-full bg-[#141f19] border border-[#23352c] focus:border-[#2dd4bf] rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-400 focus:outline-hidden transition"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </header>

      {/* Subtabs Bar: SURAH | JUZ | BOOKMARK (Screenshot 1) */}
      <div className="border-b border-[#1c2923] bg-[#0e1412] px-4 flex items-center justify-around">
        {(['SURAH', 'JUZ', 'BOOKMARK'] as QuranSubTab[]).map((tab) => {
          const isActive = subTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={`py-3 flex-1 text-center text-xs tracking-wider uppercase transition-colors relative select-none ${
                isActive
                  ? 'font-bold text-white'
                  : 'font-medium text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab === 'SURAH' && 'SURAH'}
              {tab === 'JUZ' && 'JUZ'}
              {tab === 'BOOKMARK' && `BOOKMARK ${bookmarks.length > 0 ? `(${bookmarks.length})` : ''}`}

              {/* Bronze/Gold Active Underline Bar */}
              {isActive && (
                <div className="absolute bottom-0 left-2 right-2 h-[2.5px] bg-[#c49b63] rounded-full shadow-xs" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="flex-1 px-3 py-2 max-w-xl mx-auto w-full pb-24">
        {/* SUBTAB: SURAH LIST (Screenshot 1) */}
        {subTab === 'SURAH' && (
          <div className="divide-y divide-[#17231c]">
              {filteredSurahs.map((surah) => {
                const isOfflineReady = downloadedSurahSet.has(surah.number);
                const isThisDownloading = downloadingSurahNum === surah.number;

                return (
                  <div
                    key={surah.number}
                    onClick={() => setSelectedSurah(surah)}
                    className="py-3 px-1.5 flex items-center justify-between hover:bg-[#131d17] active:bg-[#17241d] rounded-xl cursor-pointer transition select-none group"
                  >
                    {/* Left: 8-Point Star with Surah Number */}
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <IslamicStar
                        number={surah.number}
                        size={40}
                        numberClassName="text-[#2dd4bf] text-xs font-bold"
                      />

                      {/* Surah Name and Revelation info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-white tracking-wide group-hover:text-teal-200 transition truncate">
                            {surah.englishName}
                          </span>
                          {isOfflineReady && (
                            <span title="অফলাইনে সংরক্ষিত" className="shrink-0 inline-flex">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 tracking-wide uppercase mt-0.5">
                          {surah.revelationType} | {surah.numberOfAyahs} Verses
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal">
                          সূরা {surah.banglaName}
                        </div>
                      </div>
                    </div>

                    {/* Right: Arabic Calligraphy & Action Icons */}
                    <div className="flex items-center space-x-2 shrink-0">
                      <div
                        style={{ fontFamily: "'Amiri', serif" }}
                        className="text-xl sm:text-2xl text-slate-200 font-normal select-none tracking-wide"
                      >
                        {surah.name}
                      </div>

                      {!isOfflineReady && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadSingleSurah(surah);
                          }}
                          disabled={isThisDownloading || isBulkDownloading}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#2dd4bf] hover:bg-[#1a2820] transition cursor-pointer disabled:opacity-50"
                          title="এই সূরাটি অফলাইনে ডাউনলোড করুন"
                        >
                          {isThisDownloading ? (
                            <Loader2 className="w-4 h-4 animate-spin text-[#2dd4bf]" />
                          ) : (
                            <Download className="w-4 h-4 stroke-[1.8]" />
                          )}
                        </button>
                      )}

                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSurah(surah);
                        }}
                        className="p-1.5 rounded-lg text-[#2dd4bf] hover:bg-[#1a2820] transition"
                        title="সূরা পড়ুন ও তিলাওয়াত শুনুন"
                      >
                        <Volume2 className="w-5 h-5 stroke-[1.8]" />
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredSurahs.length === 0 && (
                <div className="py-12 text-center text-slate-400 text-xs">
                  কোনো সূরা পাওয়া যায়নি। অন্য বানান দিয়ে খুঁজুন।
                </div>
              )}
          </div>
        )}

        {/* SUBTAB: JUZ LIST */}
        {subTab === 'JUZ' && (
          <div className="space-y-2 py-2">
            {JUZ_LIST.map((juz) => {
              return (
                <div
                  key={juz.number}
                  onClick={() => {
                    const targetSurah = ALL_SURAHS.find((s) => s.number === juz.startSurahNumber);
                    if (targetSurah) setSelectedSurah(targetSurah);
                  }}
                  className="bg-[#111915] border border-[#1b2720] hover:border-[#2a3c32] rounded-xl p-3 flex items-center justify-between cursor-pointer active:bg-[#16231c] transition"
                >
                  <div className="flex items-center space-x-3">
                    <IslamicStar
                      number={juz.number}
                      size={38}
                      numberClassName="text-[#c49b63] text-xs font-bold"
                    />
                    <div>
                      <div className="text-xs font-semibold text-white">
                        পারা {toBengaliNumber(juz.number)} ({juz.nameBn})
                      </div>
                      <div className="text-[11px] text-slate-400">
                        শুরু: {juz.startSurahName} (আয়াত {juz.startAyah})
                      </div>
                    </div>
                  </div>

                  <div
                    style={{ fontFamily: "'Amiri', serif" }}
                    className="text-lg text-[#2dd4bf] font-medium"
                  >
                    {juz.nameArabic}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* SUBTAB: BOOKMARK LIST */}
        {subTab === 'BOOKMARK' && (
          <div className="space-y-3 py-2">
            {/* Last Read Card */}
            {lastRead && (
              <div
                onClick={() => {
                  const targetSurah = ALL_SURAHS.find((s) => s.number === lastRead.surahNumber);
                  if (targetSurah) {
                    setSelectedSurah(targetSurah);
                    setTimeout(() => {
                      const el = document.getElementById(`ayah-${lastRead.ayahNumber}`);
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 400);
                  }
                }}
                className="bg-gradient-to-r from-[#14231b] to-[#162a1f] border border-teal-700/50 hover:border-teal-400/70 rounded-2xl p-3.5 flex items-center justify-between cursor-pointer transition shadow-md group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-900/70 border border-teal-500/50 flex items-center justify-center text-teal-300 shrink-0">
                    <Paperclip className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">
                      সর্বশেষ পঠিত (Last Read)
                    </div>
                    <div className="text-sm font-bold text-white group-hover:text-teal-200">
                      QS. {lastRead.surahEnglishName} {lastRead.surahNumber}: Verse {lastRead.ayahNumber}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      সূরা {lastRead.surahName} • আয়াত {toBengaliNumber(lastRead.ayahNumber)}
                    </div>
                  </div>
                </div>

                <div className="text-xs px-3 py-1.5 rounded-xl bg-teal-800/80 text-teal-200 border border-teal-600/50 group-hover:bg-teal-700 transition font-medium shrink-0">
                  পড়ুন →
                </div>
              </div>
            )}

            {bookmarks.length === 0 && !lastRead ? (
              <div className="py-16 text-center space-y-2">
                <BookMarked className="w-10 h-10 text-slate-600 mx-auto stroke-[1.5]" />
                <div className="text-sm font-medium text-slate-300">কোনো বুকমার্ক পাওয়া যায়নি</div>
                <div className="text-xs text-slate-500 max-w-xs mx-auto">
                  সূরা পড়ার সময় আয়াতের বারে ক্লিক করে বুকমার্ক বা সর্বশেষ পঠিত হিসেবে সংরক্ষণ করতে পারেন।
                </div>
              </div>
            ) : (
              bookmarks.map((b) => {
                const targetSurah = ALL_SURAHS.find((s) => s.number === b.surahNumber);
                return (
                  <div
                    key={b.id}
                    onClick={() => {
                      if (targetSurah) setSelectedSurah(targetSurah);
                    }}
                    className="bg-[#111915] border border-[#1c2923] hover:border-teal-500/40 rounded-xl p-3 flex items-center justify-between cursor-pointer transition group"
                  >
                    <div className="flex items-center space-x-3">
                      <IslamicStar
                        number={b.surahNumber}
                        size={36}
                        numberClassName="text-[#2dd4bf] text-xs font-bold"
                      />
                      <div>
                        <div className="text-sm font-semibold text-white group-hover:text-teal-200">
                          সূরা {b.surahName} {b.ayahNumber ? `(আয়াত: ${b.ayahNumber})` : ''}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {targetSurah?.englishName} • {targetSurah?.revelationTypeBn}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeBookmark(b.id);
                          setBookmarks(getBookmarks());
                          onShowAlert?.('বুকমার্ক মুছে ফেলা হয়েছে।', false);
                        }}
                        className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                        title="মুছে ফেলুন"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Floating Audio Player when in Surah List/Tabs (Docked right above BottomNav at bottom-16) */}
      {(isPlayingAudio || currentPlayingAyah !== null) && !selectedSurah && (
        <div className="fixed bottom-16 left-0 right-0 z-50 bg-[#0c0f0d]/98 border-t border-[#4a3628] shadow-[0_-8px_30px_rgba(0,0,0,0.9)] backdrop-blur-md pt-2 pb-2 px-4 flex flex-col items-center max-w-[420px] mx-auto animate-in slide-in-from-bottom duration-200">
          {/* Top Pill - clickable to return to the playing Surah */}
          <div
            onClick={() => {
              const meta = ALL_SURAHS.find((s) => s.number === (currentPlayingSurahNumber || 1));
              if (meta) setSelectedSurah(meta);
            }}
            className="flex items-center justify-center gap-3 px-5 py-1.5 rounded-full bg-[#251b14] border border-[#443226] shadow-md text-xs font-medium text-[#dfc5ac] cursor-pointer hover:bg-[#32231b] transition"
            title="সূরা ভিউতে ফিরে যান"
          >
            <svg className="w-3.5 h-3.5 text-[#bfa085] opacity-80 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="2.2" />
              <circle cx="6" cy="12" r="1.8" />
              <circle cx="18" cy="12" r="1.8" />
              <circle cx="12" cy="6" r="1.8" />
              <circle cx="12" cy="18" r="1.8" />
              <circle cx="7.8" cy="7.8" r="1.6" />
              <circle cx="16.2" cy="7.8" r="1.6" />
              <circle cx="7.8" cy="16.2" r="1.6" />
              <circle cx="16.2" cy="16.2" r="1.6" />
            </svg>
            <span className="tracking-wide select-none font-medium truncate max-w-[260px]">
              QS. {playingSurahMeta?.englishName || 'Al-Quran'} {playingSurahMeta?.number || 1}: Verse {currentPlayingAyah || 1}
            </span>
            <svg className="w-3.5 h-3.5 text-[#bfa085] opacity-80 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="2.2" />
              <circle cx="6" cy="12" r="1.8" />
              <circle cx="18" cy="12" r="1.8" />
              <circle cx="12" cy="6" r="1.8" />
              <circle cx="12" cy="18" r="1.8" />
              <circle cx="7.8" cy="7.8" r="1.6" />
              <circle cx="16.2" cy="7.8" r="1.6" />
              <circle cx="7.8" cy="16.2" r="1.6" />
              <circle cx="16.2" cy="16.2" r="1.6" />
            </svg>
          </div>

          {/* Controls Row */}
          <div className="flex items-center justify-between w-full max-w-xs px-2 pt-1.5 pb-1 text-white">
            <button
              type="button"
              onClick={() => {
                const sNum = currentPlayingSurahNumber || 1;
                const sMeta = ALL_SURAHS.find((s) => s.number === sNum);
                setRepeaterDraft({
                  ...repeaterConfig,
                  fromSurah: sNum,
                  fromAyah: currentPlayingAyah || 1,
                  toSurah: sNum,
                  toAyah: sMeta?.numberOfAyahs || 7
                });
                setShowRepeaterModal(true);
              }}
              className="p-1.5 hover:text-slate-300 active:scale-90 transition cursor-pointer text-slate-100"
              title="সেটিংস ও রিপিটার"
            >
              <SettingsIcon className="w-5 h-5 text-slate-200" />
            </button>

            <button
              type="button"
              onClick={handlePrevAyah}
              className="p-1.5 hover:text-slate-300 active:scale-90 transition cursor-pointer text-slate-100"
              title="পূর্ববর্তী আয়াত"
            >
              <SkipBack className="w-5 h-5 fill-white text-white" />
            </button>

            <button
              type="button"
              onClick={handleTogglePlay}
              className="p-1.5 active:scale-90 transition cursor-pointer text-white"
              title={isPlayingAudio ? 'Pause' : 'Play'}
            >
              {isPlayingAudio ? (
                <Pause className="w-7 h-7 fill-white text-white stroke-none drop-shadow-sm" />
              ) : (
                <Play className="w-7 h-7 fill-white text-white ml-0.5 stroke-none drop-shadow-sm" />
              )}
            </button>

            <button
              type="button"
              onClick={handleNextAyah}
              className="p-1.5 hover:text-slate-300 active:scale-90 transition cursor-pointer text-slate-100"
              title="পরবর্তী আয়াত"
            >
              <SkipForward className="w-5 h-5 fill-white text-white" />
            </button>

            <button
              type="button"
              onClick={stopAudio}
              className="p-1.5 hover:text-red-400 active:scale-90 transition cursor-pointer text-slate-100"
              title="বন্ধ করুন"
            >
              <Square className="w-5 h-5 fill-white text-white hover:text-red-400 rounded-xs" />
            </button>
          </div>
        </div>
      )}

      {/* Offline Surah Download Manager Modal */}
      {showOfflineModal && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowOfflineModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#0e1512] border border-[#1e3127] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="px-4 py-3.5 border-b border-[#1b2b23] bg-[#111a16] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-[#2dd4bf] shrink-0" />
                  <h2 className="text-sm font-bold text-white truncate">
                    অফলাইন সূরা ডাউনলোড
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#182c23] text-[#2dd4bf] border border-[#244335] shrink-0">
                    {toBengaliNumber(downloadedSurahSet.size)} / ১১৪
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                  এক ক্লিকে সব ডাউনলোড করুন অথবা পছন্দমতো সূরা সিলেক্ট করুন
                </p>
              </div>
              <button
                onClick={() => setShowOfflineModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-[#1a2821] transition cursor-pointer shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Bulk & Selective Action Controls */}
            <div className="px-4 py-3 border-b border-[#18261f] bg-[#101814] space-y-2.5">
              {isBulkDownloading ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-teal-200 font-medium truncate">
                      ডাউনলোড হচ্ছে: {bulkProgress.currentSurahName || '...'} ({toBengaliNumber(bulkProgress.completed)}/{toBengaliNumber(bulkProgress.total)})
                    </span>
                    <button
                      onClick={() => handleBulkDownloadSurahs()}
                      className="px-3 py-1 rounded-lg bg-red-950/80 border border-red-700/50 text-red-200 hover:bg-red-900/70 text-[11px] font-semibold transition cursor-pointer shrink-0"
                    >
                      বাতিল
                    </button>
                  </div>
                  <div className="w-full h-2 bg-[#0a100d] rounded-full overflow-hidden border border-[#1d3026]">
                    <div
                      className="h-full bg-linear-to-r from-teal-500 to-emerald-400 transition-all duration-300 rounded-full"
                      style={{
                        width: `${Math.min(
                          100,
                          bulkProgress.total > 0
                            ? Math.round((bulkProgress.completed / bulkProgress.total) * 100)
                            : 0
                        )}%`
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {downloadedSurahSet.size < 114 ? (
                    <button
                      onClick={() => handleBulkDownloadSurahs()}
                      className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#16382b] border border-teal-500/40 text-[#2dd4bf] hover:bg-[#1c4737] text-xs font-semibold transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>সব ডাউনলোড ({toBengaliNumber(114 - downloadedSurahSet.size)})</span>
                    </button>
                  ) : (
                    <div className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/60 border border-emerald-700/40 text-emerald-300 text-xs font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>সব ১১৪ সূরা অফলাইনে আছে</span>
                    </div>
                  )}

                  {selectedDownloadSurahs.size > 0 && (
                    <button
                      onClick={() => handleBulkDownloadSurahs(Array.from(selectedDownloadSurahs))}
                      className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600/25 border border-teal-400/50 text-teal-200 hover:bg-teal-600/35 text-xs font-semibold transition cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>সিলেক্টেড ({toBengaliNumber(selectedDownloadSurahs.size)}) ডাউনলোড</span>
                    </button>
                  )}

                  {downloadedSurahSet.size > PREBUNDLED_SURAH_NUMBERS.length && (
                    confirmClearOffline ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={handleClearAllOffline}
                          className="px-2.5 py-2 rounded-xl bg-red-900/70 text-red-100 text-[11px] font-semibold hover:bg-red-800 transition cursor-pointer"
                        >
                          সব মুছুন
                        </button>
                        <button
                          onClick={() => setConfirmClearOffline(false)}
                          className="px-2.5 py-2 rounded-xl bg-[#192820] text-slate-300 text-[11px] hover:bg-[#22352b] transition cursor-pointer"
                        >
                          না
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmClearOffline(true)}
                        title="সব ডাউনলোডকৃত ডেটা মুছুন"
                        className="p-2 rounded-xl bg-[#16241d] border border-[#22352b] text-slate-400 hover:text-red-300 hover:bg-red-950/40 transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )
                  )}
                </div>
              )}

              {/* Search inside Modal */}
              <div className="relative">
                <input
                  type="text"
                  value={offlineModalSearch}
                  onChange={(e) => setOfflineModalSearch(e.target.value)}
                  placeholder="সূরার নাম বা নম্বর দিয়ে খুঁজুন..."
                  className="w-full bg-[#141f19] border border-[#23352c] focus:border-[#2dd4bf] rounded-xl pl-8 pr-8 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-hidden transition"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                {offlineModalSearch && (
                  <button
                    onClick={() => setOfflineModalSearch('')}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Tabs + Quick Select Pending */}
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1">
                  {([
                    { key: 'ALL', label: `সব (${toBengaliNumber(114)})` },
                    { key: 'PENDING', label: `বাকি (${toBengaliNumber(114 - downloadedSurahSet.size)})` },
                    { key: 'DOWNLOADED', label: `সংরক্ষিত (${toBengaliNumber(downloadedSurahSet.size)})` }
                  ] as const).map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setOfflineModalFilter(tab.key)}
                      className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                        offlineModalFilter === tab.key
                          ? 'bg-[#1a3429] text-[#2dd4bf] border border-teal-500/30'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-[#16221c]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {downloadedSurahSet.size < 114 && !isBulkDownloading && (
                  <button
                    onClick={() => {
                      const pendingNums = ALL_SURAHS
                        .filter((s) => !downloadedSurahSet.has(s.number))
                        .map((s) => s.number);
                      if (selectedDownloadSurahs.size === pendingNums.length) {
                        setSelectedDownloadSurahs(new Set());
                      } else {
                        setSelectedDownloadSurahs(new Set(pendingNums));
                      }
                    }}
                    className="text-[11px] font-medium text-[#2dd4bf] hover:underline cursor-pointer shrink-0"
                  >
                    {selectedDownloadSurahs.size === 114 - downloadedSurahSet.size
                      ? 'সিলেকশন খালি'
                      : 'বাকি সব সিলেক্ট'}
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable 114-Surah Checklist */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#16221c] px-2 py-1">
              {ALL_SURAHS.filter((s) => {
                const isDownloaded = downloadedSurahSet.has(s.number);
                if (offlineModalFilter === 'PENDING' && isDownloaded) return false;
                if (offlineModalFilter === 'DOWNLOADED' && !isDownloaded) return false;
                if (!offlineModalSearch.trim()) return true;
                const q = offlineModalSearch.toLowerCase().trim();
                return (
                  s.number.toString() === q ||
                  s.englishName.toLowerCase().includes(q) ||
                  s.banglaName.toLowerCase().includes(q) ||
                  s.name.includes(q)
                );
              }).map((surah) => {
                const isDownloaded = downloadedSurahSet.has(surah.number);
                const isPrebundled = PREBUNDLED_SURAH_NUMBERS.includes(surah.number);
                const isSelected = selectedDownloadSurahs.has(surah.number);
                const isThisDownloading = downloadingSurahNum === surah.number;

                return (
                  <div
                    key={surah.number}
                    onClick={() => {
                      if (!isDownloaded) handleToggleSelectDownloadSurah(surah.number);
                    }}
                    className={`py-2.5 px-2.5 flex items-center justify-between gap-2 rounded-xl transition ${
                      !isDownloaded ? 'cursor-pointer hover:bg-[#15211b]' : ''
                    } ${isSelected ? 'bg-[#142820]' : ''}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Checkbox or Checkmark */}
                      {isDownloaded ? (
                        <div className="w-5 h-5 rounded-md bg-emerald-950/80 border border-emerald-600/50 flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                      ) : (
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition shrink-0 ${
                            isSelected
                              ? 'bg-[#2dd4bf] border-[#2dd4bf] text-[#07110d]'
                              : 'bg-[#131e18] border-[#2a4236]'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white truncate">
                          {toBengaliNumber(surah.number)}. {surah.banglaName}{' '}
                          <span className="text-[10px] font-normal text-slate-400">
                            ({surah.englishName})
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {toBengaliNumber(surah.numberOfAyahs)} আয়াত • {surah.revelationTypeBn}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isDownloaded ? (
                        <>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
                            {isPrebundled ? 'বিল্ট-ইন' : 'অফলাইন'}
                          </span>
                          {!isPrebundled && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteSingleOfflineSurah(surah);
                              }}
                              title="অফলাইন থেকে মুছুন"
                              className="p-1.5 rounded-lg text-slate-500 hover:text-red-300 hover:bg-red-950/40 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadSingleSurah(surah);
                          }}
                          disabled={isThisDownloading || isBulkDownloading}
                          title="এই সূরাটি ডাউনলোড করুন"
                          className="p-1.5 rounded-lg bg-[#162820] text-[#2dd4bf] hover:bg-[#1d352a] transition cursor-pointer disabled:opacity-50"
                        >
                          {isThisDownloading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Download className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
