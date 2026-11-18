import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  List,
  Loader2,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import {
  PdfBook,
  PdfReadingProgress,
  getPdfReadingProgress,
  parsePageInputToNumber,
  savePdfReadingPage,
  toBnDigits,
  togglePdfPageBookmark
} from '../../data/pdfBooksData';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  './pdfjs/pdf.worker.min.mjs',
  window.location.href
).toString();

interface PdfBookReaderModalProps {
  book: PdfBook;
  onClose: () => void;
  onProgressUpdate?: (bookId: string, progress: PdfReadingProgress) => void;
}

interface PdfPageCanvasProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  displayWidth: number;
  defaultAspectRatio: number;
  shouldRender: boolean;
  onMeasureRatio?: (pageNumber: number, ratio: number) => void;
}

const PdfPageCanvas: React.FC<PdfPageCanvasProps> = React.memo(
  ({ pdfDoc, pageNumber, displayWidth, defaultAspectRatio, shouldRender, onMeasureRatio }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [aspectRatio, setAspectRatio] = useState<number>(defaultAspectRatio);
    const [isRendered, setIsRendered] = useState<boolean>(false);

    const estimatedHeight = Math.max(200, Math.round(displayWidth * aspectRatio));

    useEffect(() => {
      if (!shouldRender) {
        setIsRendered(false);
        const c = canvasRef.current;
        if (c) {
          c.width = 0;
          c.height = 0;
        }
        return;
      }

      let cancelled = false;
      let activeTask: pdfjsLib.RenderTask | null = null;

      const render = async () => {
        try {
          const page = await pdfDoc.getPage(pageNumber);
          if (cancelled) return;

          const baseVp = page.getViewport({ scale: 1 });
          const ratio = baseVp.height / baseVp.width;
          if (Math.abs(ratio - aspectRatio) > 0.01) {
            setAspectRatio(ratio);
            onMeasureRatio?.(pageNumber, ratio);
          }

          const canvas = canvasRef.current;
          if (!canvas) return;

          const displayScale = displayWidth / baseVp.width;
          const dpr = Math.min(window.devicePixelRatio || 1, 2);

          const displayViewport = page.getViewport({ scale: displayScale });
          const renderViewport = page.getViewport({ scale: displayScale * dpr });

          canvas.width = Math.floor(renderViewport.width);
          canvas.height = Math.floor(renderViewport.height);
          canvas.style.width = `${Math.floor(displayViewport.width)}px`;
          canvas.style.height = `${Math.floor(displayViewport.height)}px`;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          // Fill clean white paper background before PDF draws onto canvas
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          activeTask = page.render({
            canvas,
            canvasContext: ctx,
            viewport: renderViewport
          });

          await activeTask.promise;
          if (!cancelled) {
            setIsRendered(true);
          }
        } catch (err: any) {
          if (err?.name === 'RenderingCancelledException') return;
          if (!cancelled) {
            console.warn(`PDF page ${pageNumber} render error:`, err);
          }
        }
      };

      render();

      return () => {
        cancelled = true;
        if (activeTask) {
          try {
            activeTask.cancel();
          } catch {}
        }
      };
    }, [pdfDoc, pageNumber, displayWidth, shouldRender]);

    return (
      <div
        className="relative bg-white shadow-lg overflow-hidden mx-auto"
        style={{
          width: `${Math.floor(displayWidth)}px`,
          minHeight: `${estimatedHeight}px`
        }}
      >
        <canvas ref={canvasRef} className="block" />
        {(!shouldRender || !isRendered) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white text-gray-400 select-none pointer-events-none gap-2">
            {shouldRender && <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />}
            <span className="text-xs font-medium text-gray-500">
              পৃষ্ঠা {toBnDigits(pageNumber)}
            </span>
          </div>
        )}
      </div>
    );
  }
);

export const PdfBookReaderModal: React.FC<PdfBookReaderModalProps> = ({
  book,
  onClose,
  onProgressUpdate
}) => {
  const initialProgress = useMemo(
    () => getPdfReadingProgress(book.id, book.totalPages),
    [book.id, book.totalPages]
  );

  const [currentPage, setCurrentPage] = useState<number>(initialProgress.page);
  const [totalPages, setTotalPages] = useState<number>(
    initialProgress.totalPages || book.totalPages
  );
  const [bookmarks, setBookmarks] = useState<number[]>(initialProgress.bookmarks);
  const [zoom, setZoom] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>(String(initialProgress.page));

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState<boolean>(true);
  const [loadProgressPct, setLoadProgressPct] = useState<number>(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [defaultAspectRatio, setDefaultAspectRatio] = useState<number>(559.2 / 375.84);

  const [showTocSheet, setShowTocSheet] = useState<boolean>(false);
  const [tocTab, setTocTab] = useState<'chapters' | 'bookmarks'>('chapters');
  const [savedToast, setSavedToast] = useState<boolean>(false);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const pageContainerRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const hasRestoredInitialScrollRef = useRef<boolean>(false);
  const lastSavedPageRef = useRef<number>(initialProgress.page);

  const [containerWidth, setContainerWidth] = useState<number>(
    typeof window !== 'undefined' ? Math.min(window.innerWidth, 820) : 380
  );
  const [visibleWindowCenter, setVisibleWindowCenter] = useState<number>(initialProgress.page);

  // Measure viewport width
  useEffect(() => {
    const updateWidth = () => {
      if (scrollContainerRef.current) {
        const w = scrollContainerRef.current.clientWidth;
        if (w > 0) setContainerWidth(w);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const displayWidth = useMemo(() => {
    const pad = containerWidth < 460 ? 16 : 32;
    const baseWidth = Math.max(260, Math.min(containerWidth - pad, 760));
    return baseWidth * zoom;
  }, [containerWidth, zoom]);

  // Load PDF document with full WASM + CMap + standardFontDataUrl support for JBIG2 scanned pages
  useEffect(() => {
    let cancelled = false;
    let loadedDoc: pdfjsLib.PDFDocumentProxy | null = null;

    hasRestoredInitialScrollRef.current = false;
    setIsLoadingDoc(true);
    setLoadError(null);
    setLoadProgressPct(0);

    const baseHref = window.location.href;
    const resolvedPdfUrl = new URL(book.fileUrl, baseHref).toString();
    const wasmUrl = new URL('./pdfjs/wasm/', baseHref).toString();
    const cMapUrl = new URL('./pdfjs/cmaps/', baseHref).toString();
    const standardFontDataUrl = new URL('./pdfjs/standard_fonts/', baseHref).toString();

    const loadingTask = pdfjsLib.getDocument({
      url: resolvedPdfUrl,
      wasmUrl,
      cMapUrl,
      cMapPacked: true,
      standardFontDataUrl,
      disableAutoFetch: false,
      disableStream: false
    });

    loadingTask.onProgress = (progressData: { loaded: number; total?: number }) => {
      if (!cancelled && progressData.total && progressData.total > 0) {
        const pct = Math.min(100, Math.round((progressData.loaded / progressData.total) * 100));
        setLoadProgressPct(pct);
      }
    };

    loadingTask.promise
      .then(async (doc) => {
        if (cancelled) {
          doc.cleanup().catch(() => {});
          return;
        }
        loadedDoc = doc;

        // Measure typical page aspect ratio (page 2 or 1) so scroll slots match real height
        try {
          const samplePage = await doc.getPage(Math.min(2, doc.numPages));
          const vp = samplePage.getViewport({ scale: 1 });
          if (vp.width > 0 && vp.height > 0 && !cancelled) {
            setDefaultAspectRatio(vp.height / vp.width);
          }
        } catch {}

        if (cancelled) return;

        const saved = getPdfReadingProgress(book.id, doc.numPages);
        const targetPage = Math.max(1, Math.min(doc.numPages, saved.page));

        setPdfDoc(doc);
        setTotalPages(doc.numPages);
        setCurrentPage(targetPage);
        setVisibleWindowCenter(targetPage);
        setPageInput(String(targetPage));
        setIsLoadingDoc(false);
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('PDF load error:', err);
          setLoadError('পিডিএফ ফাইলটি লোড করা যায়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
          setIsLoadingDoc(false);
        }
      });

    return () => {
      cancelled = true;
      loadingTask.destroy().catch(() => {});
      if (loadedDoc) {
        loadedDoc.cleanup().catch(() => {});
      }
    };
  }, [book.id, book.fileUrl]);

  // Persist current page to localStorage whenever user scrolls to a new page
  const persistPage = useCallback(
    (page: number, pagesCount: number) => {
      if (lastSavedPageRef.current === page) return;
      lastSavedPageRef.current = page;
      const updated = savePdfReadingPage(book.id, page, pagesCount);
      onProgressUpdate?.(book.id, updated);
      setSavedToast(true);
    },
    [book.id, onProgressUpdate]
  );

  useEffect(() => {
    if (!savedToast) return;
    const t = setTimeout(() => setSavedToast(false), 1200);
    return () => clearTimeout(t);
  }, [savedToast]);

  // Scroll cleanly to a specific page inside the vertical scroll container
  const scrollToPage = useCallback(
    (targetPage: number, smooth = true) => {
      const clamped = Math.max(1, Math.min(totalPages || book.totalPages, Math.floor(targetPage)));
      const container = scrollContainerRef.current;
      const pageEl = pageContainerRefs.current[clamped];

      setCurrentPage(clamped);
      setVisibleWindowCenter(clamped);
      setPageInput(String(clamped));
      persistPage(clamped, totalPages || book.totalPages);

      if (container && pageEl) {
        container.scrollTo({
          top: Math.max(0, pageEl.offsetTop - 8),
          behavior: smooth ? 'smooth' : 'auto'
        });
      }
    },
    [totalPages, book.totalPages, persistPage]
  );

  // Automatically restore exact saved page scroll position once document mounts
  useEffect(() => {
    if (isLoadingDoc || !pdfDoc || hasRestoredInitialScrollRef.current) return;

    const targetPage = Math.max(1, Math.min(totalPages, initialProgress.page));
    const rafId = requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      const pageEl = pageContainerRefs.current[targetPage];
      if (container && pageEl && targetPage > 1) {
        container.scrollTop = Math.max(0, pageEl.offsetTop - 8);
      }
      hasRestoredInitialScrollRef.current = true;
    });

    return () => cancelAnimationFrame(rafId);
  }, [isLoadingDoc, pdfDoc, totalPages, initialProgress.page]);

  // Track currently visible page on continuous vertical scroll
  const handleScroll = useCallback(() => {
    if (!hasRestoredInitialScrollRef.current || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const scrollMarker = container.scrollTop + Math.min(180, container.clientHeight * 0.3);

    let detectedPage = 1;
    // Binary search across ordered page refs for O(log N) instant detection over 594 pages
    let low = 1;
    let high = totalPages;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const el = pageContainerRefs.current[mid];
      if (!el) break;
      const top = el.offsetTop;
      const bottom = top + el.offsetHeight;
      if (scrollMarker < top) {
        high = mid - 1;
      } else if (scrollMarker > bottom) {
        detectedPage = mid;
        low = mid + 1;
      } else {
        detectedPage = mid;
        break;
      }
    }

    if (detectedPage !== visibleWindowCenter) {
      setVisibleWindowCenter(detectedPage);
    }
    if (detectedPage !== currentPage) {
      setCurrentPage(detectedPage);
      setPageInput(String(detectedPage));
      persistPage(detectedPage, totalPages);
    }
  }, [totalPages, visibleWindowCenter, currentPage, persistPage]);

  // Keyboard Escape to close TOC or modal
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showTocSheet) {
          setShowTocSheet(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, showTocSheet]);

  const handleToggleBookmark = () => {
    const updated = togglePdfPageBookmark(book.id, currentPage);
    setBookmarks(updated.bookmarks);
    onProgressUpdate?.(book.id, updated);
  };

  const handlePageJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parsePageInputToNumber(pageInput);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      scrollToPage(parsed, true);
    } else {
      setPageInput(String(currentPage));
    }
  };

  const pageNumbers = useMemo(
    () => Array.from({ length: totalPages }, (_, idx) => idx + 1),
    [totalPages]
  );

  const activeChapter = useMemo(() => {
    let matched = book.chapters[0];
    for (const ch of book.chapters) {
      if (currentPage >= ch.page) {
        matched = ch;
      } else {
        break;
      }
    }
    return matched;
  }, [book.chapters, currentPage]);

  const isCurrentBookmarked = bookmarks.includes(currentPage);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-[#1b1f23]"
      role="dialog"
      aria-modal="true"
      aria-label={book.title}
    >
      {/* 1. Top Browser-Style Tab Strip */}
      <div className="bg-[#0d1512] pt-2 px-2 flex items-end justify-between gap-2 border-b border-[#1d2d25] select-none shrink-0">
        <div className="flex items-end gap-1.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={onClose}
            className="mb-1.5 p-2 rounded-lg text-[#a1b8aa] hover:text-white hover:bg-[#16261e] transition cursor-pointer shrink-0"
            title="ফিরে যান"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Top Open Book Tab */}
          <div className="flex items-center gap-2 bg-[#16241d] text-white border-t border-x border-[#284436] rounded-t-xl px-3 py-2 min-w-0 max-w-[290px] sm:max-w-md shadow-sm">
            <BookOpen className="w-4 h-4 text-[#34d399] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold truncate leading-tight">
                {book.title}
              </p>
              <p className="text-[10px] text-[#8bc2a4] truncate leading-tight mt-0.5">
                পৃষ্ঠা {toBnDigits(currentPage)} / {toBnDigits(totalPages)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-[#8da899] hover:text-white hover:bg-[#21382c] transition cursor-pointer shrink-0"
              title="ট্যাব বন্ধ করুন"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="mb-2 pr-1 shrink-0">
          <span
            className={`text-[10px] font-medium transition-opacity duration-200 ${
              savedToast ? 'text-[#4ade80] opacity-100' : 'text-[#739080] opacity-85'
            }`}
          >
            {savedToast ? 'সংরক্ষিত ✓' : 'অটো সেভ'}
          </span>
        </div>
      </div>

      {/* 2. Compact PDF Toolbar (TOC, Page Jump, Zoom, Bookmark) */}
      <div className="bg-[#16241d] border-b border-[#23382d] px-2.5 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setTocTab('chapters');
              setShowTocSheet(true);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-[#1d3227] hover:bg-[#254032] border border-[#2d4e3d] text-xs font-semibold text-[#dcf0e4] flex items-center gap-1.5 transition cursor-pointer"
          >
            <List className="w-3.5 h-3.5 text-[#34d399]" />
            <span>সূচীপত্র</span>
          </button>

          <button
            type="button"
            onClick={handleToggleBookmark}
            className={`px-2 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
              isCurrentBookmarked
                ? 'bg-[#1a3e2a] border-[#34d399]/60 text-[#4ade80]'
                : 'bg-[#1d3227] hover:bg-[#254032] border-[#2d4e3d] text-[#a6c2b2]'
            }`}
            title="এই পৃষ্ঠা বুকমার্ক করুন"
          >
            <Bookmark className={`w-3.5 h-3.5 ${isCurrentBookmarked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Direct Page Jump */}
        <form onSubmit={handlePageJumpSubmit} className="flex items-center gap-1">
          <input
            type="text"
            inputMode="numeric"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            className="w-12 py-1 px-1.5 text-center text-xs font-bold rounded-md bg-[#0d1611] border border-[#2d4e3d] text-[#4ade80] focus:outline-none focus:border-[#34d399]"
            aria-label="পৃষ্ঠা নম্বর"
          />
          <span className="text-[11px] text-[#8da899]">/ {toBnDigits(totalPages)}</span>
          <button
            type="submit"
            className="px-2 py-1 rounded-md bg-[#1f4630] hover:bg-[#27593d] text-[11px] font-bold text-[#4ade80] border border-[#2f6948] cursor-pointer"
          >
            যান
          </button>
        </form>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-[#0d1611] px-1.5 py-0.5 rounded-lg border border-[#23382d]">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.15).toFixed(2)))}
            disabled={zoom <= 0.75}
            className="p-1 text-[#a6c2b2] hover:text-white disabled:opacity-35 cursor-pointer"
            title="ছোট করুন"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="px-1 text-[11px] font-mono text-[#dcf0e4]">
            {toBnDigits(Math.round(zoom * 100))}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.2, +(z + 0.15).toFixed(2)))}
            disabled={zoom >= 2.2}
            className="p-1 text-[#a6c2b2] hover:text-white disabled:opacity-35 cursor-pointer"
            title="বড় করুন"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          {zoom !== 1 && (
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="p-1 text-[#8bc2a4] hover:text-white cursor-pointer"
              title="স্বাভাবিক মাপ"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Active Chapter Indicator */}
      <div className="bg-[#111c17] px-3 py-1 flex items-center justify-between text-[11px] text-[#98b4a4] border-b border-[#1f3228] shrink-0">
        <span className="truncate">{activeChapter ? activeChapter.title : book.title}</span>
        <span className="shrink-0 ml-2 text-[#4ade80] font-semibold">
          পৃষ্ঠা {toBnDigits(currentPage)}
        </span>
      </div>

      {/* 3. Continuous Vertical Scroll PDF Viewport (Original Natural PDF Pages) */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="relative flex-1 overflow-auto bg-[#525659] py-3 px-2 sm:px-4"
      >
        {isLoadingDoc ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center max-w-xs mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-[#16241d] border border-[#2a4a39] flex items-center justify-center text-[#34d399] shadow-md">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">{book.title} লোড হচ্ছে...</p>
              <p className="text-xs text-gray-300">
                পৃষ্ঠা {toBnDigits(initialProgress.page)} থেকে ওপেন হচ্ছে
                {loadProgressPct > 0 ? ` (${toBnDigits(loadProgressPct)}%)` : ''}
              </p>
            </div>
          </div>
        ) : loadError ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto p-6 gap-3">
            <p className="text-sm font-semibold text-red-200">{loadError}</p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[#163324] text-white text-xs font-bold cursor-pointer"
            >
              ফিরে যান
            </button>
          </div>
        ) : (
          <div className="space-y-3 pb-8">
            {pdfDoc &&
              pageNumbers.map((pageNum) => {
                // Virtualize canvas rendering to a 9-page sliding window around scroll position
                const shouldRender = Math.abs(pageNum - visibleWindowCenter) <= 4;

                return (
                  <div
                    key={pageNum}
                    ref={(el) => {
                      pageContainerRefs.current[pageNum] = el;
                    }}
                    data-page={pageNum}
                  >
                    <PdfPageCanvas
                      pdfDoc={pdfDoc}
                      pageNumber={pageNum}
                      displayWidth={displayWidth}
                      defaultAspectRatio={defaultAspectRatio}
                      shouldRender={shouldRender}
                    />
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* 4. Table of Contents & Bookmarks Drawer */}
      {showTocSheet && (
        <div
          className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowTocSheet(false)}
        >
          <div
            className="w-full max-w-md bg-[#111c16] border border-[#253d30] rounded-t-3xl sm:rounded-2xl max-h-[82vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#1e3227]">
              <div>
                <h3 className="text-sm font-bold text-white">{book.title}</h3>
                <p className="text-[11px] text-[#84a693] mt-0.5">{book.author}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowTocSheet(false)}
                className="p-1.5 rounded-lg bg-[#182920] text-[#9ab8a7] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-2.5 border-b border-[#1e3227] grid grid-cols-2 gap-1.5 bg-[#0c1410]">
              <button
                type="button"
                onClick={() => setTocTab('chapters')}
                className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  tocTab === 'chapters'
                    ? 'bg-[#193b28] text-[#4ade80] border border-[#2b6243]'
                    : 'text-[#89a897] hover:text-white'
                }`}
              >
                অধ্যায়সমূহ ({toBnDigits(book.chapters.length)})
              </button>
              <button
                type="button"
                onClick={() => setTocTab('bookmarks')}
                className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  tocTab === 'bookmarks'
                    ? 'bg-[#193b28] text-[#4ade80] border border-[#2b6243]'
                    : 'text-[#89a897] hover:text-white'
                }`}
              >
                বুকমার্ক ({toBnDigits(bookmarks.length)})
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {tocTab === 'chapters' ? (
                book.chapters.map((ch) => {
                  const isActive = activeChapter?.page === ch.page;
                  return (
                    <button
                      key={ch.page}
                      type="button"
                      onClick={() => {
                        scrollToPage(ch.page, false);
                        setShowTocSheet(false);
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                        isActive
                          ? 'bg-[#173624] border-[#2f6b49] text-white'
                          : 'bg-[#15221b] border-[#213529] text-[#d4e7dc] hover:border-[#2d523d]'
                      }`}
                    >
                      <div className="min-w-0">
                        <p
                          className={`text-xs font-bold truncate ${
                            isActive ? 'text-[#4ade80]' : 'text-white'
                          }`}
                        >
                          {ch.title}
                        </p>
                        {ch.subtitle && (
                          <p className="text-[11px] text-[#88a896] truncate mt-0.5">
                            {ch.subtitle}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-[#4ade80] shrink-0">
                        পৃষ্ঠা {toBnDigits(ch.page)}
                      </span>
                    </button>
                  );
                })
              ) : bookmarks.length === 0 ? (
                <div className="text-center py-10 px-4 space-y-2">
                  <Bookmark className="w-8 h-8 text-[#4ade80] mx-auto opacity-50" />
                  <p className="text-xs text-[#89a897]">
                    এখনও কোনো পৃষ্ঠা বুকমার্ক করা হয়নি। পড়ার সময় উপরের বুকমার্ক আইকনে চাপ দিলে এখানে সেভ থাকবে।
                  </p>
                </div>
              ) : (
                bookmarks.map((bmPage) => (
                  <div
                    key={bmPage}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#15221b] border border-[#213529]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        scrollToPage(bmPage, false);
                        setShowTocSheet(false);
                      }}
                      className="flex-1 text-left flex items-center gap-2.5 cursor-pointer"
                    >
                      <Bookmark className="w-4 h-4 text-[#4ade80] fill-current shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-white">
                          পৃষ্ঠা {toBnDigits(bmPage)}
                        </p>
                        <p className="text-[11px] text-[#88a896]">এখান থেকে পড়ুন</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = togglePdfPageBookmark(book.id, bmPage);
                        setBookmarks(updated.bookmarks);
                        onProgressUpdate?.(book.id, updated);
                      }}
                      className="p-1.5 text-[#88a896] hover:text-red-400 cursor-pointer"
                      title="বুকমার্ক সরান"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
