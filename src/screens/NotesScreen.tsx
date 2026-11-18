import React, { useState, useCallback } from 'react';
import { BookOpen, NotebookText, Trash2, Lock, Library, ChevronRight, Bookmark } from 'lucide-react';
import { DuaNote } from '../types/ibadat';
import { CustomAlertDialog } from '../components/dialogs/CustomAlertDialog';
import {
  PDF_BOOKS,
  PdfBook,
  PdfReadingProgress,
  getPdfReadingProgress,
  toBnDigits
} from '../data/pdfBooksData';
import { PdfBookReaderModal } from '../components/pdf/PdfBookReaderModal';

interface NotesScreenProps {
  duaNotes: DuaNote[];
  onAddNote: (title: string, text: string) => void;
  onDeleteNote: (id: string) => void;
  onOpenNoteDetail?: (note: DuaNote) => void;
}

export const NotesScreen: React.FC<NotesScreenProps> = ({
  duaNotes,
  onAddNote,
  onDeleteNote
}) => {
  const [titleInput, setTitleInput] = useState('');
  const [textInput, setTextInput] = useState('');
  const [noteToDelete, setNoteToDelete] = useState<{ id: string; title: string } | null>(null);

  const [activePdfBook, setActivePdfBook] = useState<PdfBook | null>(null);
  const [pdfProgressMap, setPdfProgressMap] = useState<Record<string, PdfReadingProgress>>(() => {
    const initial: Record<string, PdfReadingProgress> = {};
    PDF_BOOKS.forEach((b) => {
      initial[b.id] = getPdfReadingProgress(b.id, b.totalPages);
    });
    return initial;
  });

  const handlePdfProgressUpdate = useCallback((bookId: string, progress: PdfReadingProgress) => {
    setPdfProgressMap((prev) => ({
      ...prev,
      [bookId]: progress
    }));
  }, []);

  const manualNotes = React.useMemo(() => {
    const map = new Map<string, DuaNote>();
    duaNotes.forEach((n) => {
      if (n && n.id && !n.isAuto && !n.id.startsWith('auto_')) {
        map.set(n.id, n);
      }
    });
    return Array.from(map.values());
  }, [duaNotes]);

  const autoNotes = React.useMemo(() => {
    const map = new Map<string, DuaNote>();
    duaNotes.forEach((n) => {
      if (n && n.id && (n.isAuto || n.id.startsWith('auto_'))) {
        map.set(n.id, n);
      }
    });
    return Array.from(map.values());
  }, [duaNotes]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    onAddNote(titleInput, textInput);
    setTitleInput('');
    setTextInput('');
  };

  const renderNoteCard = (note: DuaNote) => {
    const isAutoNote = note.isAuto || note.id.startsWith('auto_');

    return (
      <div
        key={note.id}
        className="w-full rounded-2xl border border-teal-300 bg-white px-4 py-3 shadow-xs"
      >
        <div className="flex justify-between items-center mb-1.5">
          <span className="font-bold text-gray-800 text-[16px] truncate pr-2">
            {isAutoNote ? 'স্বয়ংক্রিয় নোট' : (note.title || note.date)}
          </span>

          {isAutoNote ? (
            <span title="মুছে ফেলা যাবে না">
              <Lock className="w-4 h-4 text-gray-400 shrink-0" />
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setNoteToDelete({ id: note.id, title: note.title || 'নোটটি' })}
              className="shrink-0 text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition cursor-pointer"
              title="মুছে ফেলুন"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
          {note.text}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 pb-20">
      {/* New Note Form */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-gray-200">
        <h2 className="text-sm font-bold text-gray-700 mb-2">নতুন নোট লিখুন</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            id="new-note-head-input"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            className="w-full p-2.5 mb-2 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-teal-500 focus:outline-hidden text-sm text-gray-800 placeholder-gray-400"
            placeholder="হেড/শিরোনাম (ঐচ্ছিক)"
          />
          <textarea
            id="new-note-input"
            rows={2}
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:ring-1 focus:ring-teal-500 focus:outline-hidden text-sm text-gray-800 placeholder-gray-400 resize-none"
            placeholder="এখানে লিখুন..."
          />
          <div className="flex justify-end mt-2 pt-1">
            <button
              type="submit"
              className="px-4 py-1.5 bg-teal-600 text-white text-xs rounded-md hover:bg-teal-700 transition font-medium shadow-xs cursor-pointer"
            >
              সেভ করুন
            </button>
          </div>
        </form>
      </div>

      {/* Manual Notes */}
      <div>
        <h2 className="text-base font-bold text-gray-800 mb-2.5 flex items-center">
          <NotebookText className="w-4 h-4 mr-2 text-teal-600" />
          <span>আমার নোটস ({manualNotes.length})</span>
        </h2>
        <div className="grid grid-cols-1 gap-3">
          {manualNotes.length === 0 ? (
            <div className="p-3.5 bg-white border border-gray-200 rounded-xl text-center text-xs text-gray-500">
              এখনও কোনো নোট যোগ করা হয়নি। উপরের বক্সে লিখে সেভ করুন।
            </div>
          ) : (
            manualNotes.map(renderNoteCard)
          )}
        </div>
      </div>

      {/* Dedicated Important Hadith & Islamic PDF Books Section */}
      <div className="pt-1">
        <h2 className="text-base font-bold text-gray-800 mb-2.5 flex items-center">
          <Library className="w-4 h-4 mr-2 text-emerald-700" />
          <span>গুরুত্বপূর্ণ হাদিস ও পিডিএফ বইসমূহ ({toBnDigits(PDF_BOOKS.length)})</span>
        </h2>

        <div className="grid grid-cols-1 gap-3">
          {PDF_BOOKS.map((book) => {
            const progress = pdfProgressMap[book.id] || getPdfReadingProgress(book.id, book.totalPages);
            const hasStarted = progress.updatedAt > 0 && progress.page > 1;
            const total = progress.totalPages || book.totalPages;
            const pct = Math.max(1, Math.min(100, Math.round((progress.page / total) * 100)));

            return (
              <button
                key={book.id}
                type="button"
                onClick={() => setActivePdfBook(book)}
                className="w-full text-left rounded-2xl bg-white border border-emerald-200 hover:border-emerald-500 hover:shadow-md transition-all p-3.5 shadow-xs cursor-pointer group"
              >
                <div className="flex items-stretch gap-3.5">
                  {/* Islamic Hardcover Book Thumbnail */}
                  <div className="w-16 sm:w-20 shrink-0 rounded-xl bg-gradient-to-br from-emerald-800 via-teal-900 to-emerald-950 p-2 flex flex-col justify-between text-white shadow-sm relative overflow-hidden border border-emerald-700/60">
                    <div className="absolute inset-y-0 left-0 w-1.5 bg-amber-400/75" />
                    <div className="pl-1.5">
                      <BookOpen className="w-4 h-4 text-amber-300" />
                    </div>
                    <div className="pl-1.5 space-y-0.5">
                      <p className="text-[10px] font-bold leading-tight text-amber-100 line-clamp-3">
                        {book.title}
                      </p>
                      <p className="text-[8px] text-emerald-200/80">
                        {toBnDigits(total)} পৃষ্ঠা
                      </p>
                    </div>
                  </div>

                  {/* Book Details & Reading Memory */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-[15px] font-bold text-gray-900 group-hover:text-emerald-800 transition-colors leading-snug">
                          {book.title}
                        </h3>
                        <ChevronRight className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform" />
                      </div>

                      <p className="text-xs text-emerald-800 font-medium mt-0.5 truncate">
                        {book.author}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1 line-clamp-2 leading-relaxed">
                        {book.subtitle}
                      </p>
                    </div>

                    {/* Reading Progress & Metadata */}
                    <div className="mt-2.5 pt-2 border-t border-gray-100 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] gap-2">
                        <span className="text-emerald-800 font-semibold truncate">
                          {hasStarted
                            ? `সর্বশেষ পড়া: পৃষ্ঠা ${toBnDigits(progress.page)} / ${toBnDigits(total)}`
                            : `মোট ${toBnDigits(total)} পৃষ্ঠা · নতুন ট্যাবে পড়ুন`}
                        </span>
                        <span className="text-emerald-700 font-bold shrink-0 flex items-center gap-1">
                          {progress.bookmarks.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-amber-700 mr-1.5">
                              <Bookmark className="w-3 h-3 fill-current" />
                              {toBnDigits(progress.bookmarks.length)}
                            </span>
                          )}
                          <span>{hasStarted ? 'চালিয়ে যান' : 'পড়া শুরু করুন'}</span>
                        </span>
                      </div>

                      <div className="w-full h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-600 to-teal-500 rounded-full transition-all duration-300"
                          style={{ width: `${hasStarted ? pct : 3}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Library Notes */}
      <div className="pt-1">
        <h2 className="text-base font-bold text-gray-800 mb-2.5 flex items-center">
          <BookOpen className="w-4 h-4 mr-2 text-blue-600" />
          <span>স্বয়ংক্রিয় লাইব্রেরি নোটস ({autoNotes.length})</span>
        </h2>
        <div className="grid grid-cols-1 gap-3">
          {autoNotes.map(renderNoteCard)}
        </div>
      </div>

      {/* Delete Confirmation Alert */}
      {noteToDelete && (
        <CustomAlertDialog
          title="নোট মুছে ফেলা"
          message={`আপনি কি নিশ্চিত যে আপনি এই নোটটি মুছে ফেলতে চান?`}
          isSuccess={false}
          isConfirm={true}
          onConfirm={() => {
            onDeleteNote(noteToDelete.id);
            setNoteToDelete(null);
          }}
          onDismiss={() => setNoteToDelete(null)}
        />
      )}

      {/* Top-Tabbed Interactive PDF Reader */}
      {activePdfBook && (
        <PdfBookReaderModal
          book={activePdfBook}
          onClose={() => setActivePdfBook(null)}
          onProgressUpdate={handlePdfProgressUpdate}
        />
      )}
    </div>
  );
};
