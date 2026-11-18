// Quran Transliteration Engine: English phonetic & Arabic to Bengali pronunciation
// Specially crafted for authentic, fluent, easy-to-read Bengali Quranic recitation

const CANONICAL_PHRASES: [RegExp, string][] = [
  [/\bbismil-?laahir[- ]rahmaanir[- ]raheem\b/gi, 'বিসমিল্লাহির রাহমানির রাহীম'],
  [/\bbismillahir[- ]rahmanir[- ]rahim\b/gi, 'বিসমিল্লাহির রাহমানির রাহীম'],
  [/\ballahu akbar\b/gi, 'আল্লাহু আকবার'],
  [/\bAlif-Laaam-Meeem-Saaad\b/gi, 'আলিফ-লাম-মীম-ছোয়াদ'],
  [/\bAlif-Laaam-Meeem-Raa\b/gi, 'আলিফ-লাম-মীম-রা'],
  [/\bAlif-Laaam-Meeem\b/gi, 'আলিফ-লাম-মীম'],
  [/\bAlif-Laam-Meem\b/gi, 'আলিফ-লাম-মীম'],
  [/\bAlif-Laaam-Raa\b/gi, 'আলিফ-লাম-রা'],
  [/\bKaaf-Haa-Yaa-'Aiiin-Saaad\b/gi, 'কাফ-হা-ইয়া-আইন-ছোয়াদ'],
  [/\bTaa-Seeen-Meeem\b/gi, 'ত্বা-সীন-মীম'],
  [/\bTaa-Seeen\b/gi, 'ত্বা-সীন'],
  [/\bTaa-Haa\b/gi, 'ত্বা-হা'],
  [/\bYaa-Seeen\b/gi, 'ইয়া-সীন'],
  [/\bHaa-Meeem\b/gi, 'হা-মীম'],
  [/\bSaaad\b/gi, 'ছোয়াদ'],
  [/\bQaaaaf\b/gi, 'ক্বাফ'],
  [/\bNooon\b/gi, 'নূন'],
  [/\bAllaahu\b/gi, 'আল্লাহু'],
  [/\bAllahu\b/gi, 'আল্লাহু'],
  [/\bAllaahi\b/gi, 'আল্লাহি'],
  [/\bAllaaha\b/gi, 'আল্লাহা'],
  [/\bAllaah\b/gi, 'আল্লাহ'],
  [/\bAllah\b/gi, 'আল্লাহ'],
  [/\blillaahi\b/gi, 'লিল্লাহি'],
  [/\blillaah\b/gi, 'লিল্লাহ']
];

const DOUBLE_CONSONANTS: Record<string, string> = {
  b: 'ব্ব',
  t: 'ত্ত',
  d: 'দ্দ',
  l: 'ল্ল',
  m: 'ম্ম',
  n: 'ন্ন',
  s: 'স্স',
  k: 'ক্ক',
  q: 'ক্ক্ব',
  f: 'ফ্‌ফ',
  j: 'জ্জ',
  r: 'র্‌র',
  z: 'য্‌য',
  p: 'প্প',
  h: 'হ্‌হ',
  v: 'ভ্ভ',
  g: 'গ্গ'
};

const DOUBLE_DIGRAPHS: Record<string, string> = {
  sh: 'শ্‌শ',
  kh: 'খ্‌খ',
  gh: 'গ্‌গ',
  th: 'ছ্‌ছ',
  dh: 'য্‌য'
};

const SINGLE_CONSONANTS: Record<string, string> = {
  q: 'ক্ব',
  k: 'ক',
  b: 'ব',
  t: 'ত',
  d: 'দ',
  r: 'র',
  l: 'ল',
  m: 'ম',
  n: 'ন',
  h: 'হ',
  f: 'ফ',
  s: 'স',
  z: 'য',
  j: 'জ',
  p: 'প',
  v: 'ভ',
  g: 'গ',
  c: 'ক'
};

const isVowelChar = (ch: string | undefined): boolean => {
  if (!ch) return false;
  return /[aeiou]/i.test(ch);
};

interface VowelMatch {
  independent: string;
  dependent: string;
  length: number;
}

function matchVowelSequence(s: string, idx: number): VowelMatch | null {
  if (idx >= s.length) return null;
  const sub = s.slice(idx).toLowerCase();

  // Long 'aa+', 'ee+', 'oo+', 'uu+', 'ii+'
  const longA = sub.match(/^a{2,}/);
  if (longA) {
    return { independent: 'আ', dependent: 'া', length: longA[0].length };
  }
  const longE = sub.match(/^e{2,}/);
  if (longE) {
    return { independent: 'ঈ', dependent: 'ী', length: longE[0].length };
  }
  const longI = sub.match(/^i{2,}/);
  if (longI) {
    return { independent: 'ঈ', dependent: 'ী', length: longI[0].length };
  }
  const longO = sub.match(/^o{2,}/);
  if (longO) {
    return { independent: 'ঊ', dependent: 'ূ', length: longO[0].length };
  }
  const longU = sub.match(/^u{2,}/);
  if (longU) {
    return { independent: 'ঊ', dependent: 'ূ', length: longU[0].length };
  }

  // Diphthongs: only treat 'ay'/'ai' as diphthong if 'y' is NOT followed by a vowel or another 'y'
  if (sub.startsWith('ai')) {
    return { independent: 'আই', dependent: 'াই', length: 2 };
  }
  if (sub.startsWith('ay') && !isVowelChar(sub[2]) && sub[2] !== 'y') {
    return { independent: 'আই', dependent: 'াই', length: 2 };
  }

  // Diphthongs: only treat 'au'/'aw' as diphthong if 'w' is NOT followed by a vowel or another 'w'
  if (sub.startsWith('au')) {
    return { independent: 'আও', dependent: 'াও', length: 2 };
  }
  if (sub.startsWith('aw') && !isVowelChar(sub[2]) && sub[2] !== 'w') {
    return { independent: 'আও', dependent: 'াও', length: 2 };
  }

  // Single short vowels
  const c1 = sub[0];
  if (c1 === 'a') return { independent: 'আ', dependent: 'া', length: 1 };
  if (c1 === 'i') return { independent: 'ই', dependent: 'ি', length: 1 };
  if (c1 === 'u') return { independent: 'উ', dependent: 'ু', length: 1 };
  if (c1 === 'e') return { independent: 'এ', dependent: 'ে', length: 1 };
  if (c1 === 'o') return { independent: 'ও', dependent: 'ো', length: 1 };

  return null;
}

function transliterateSegment(rawSeg: string): string {
  if (!rawSeg) return '';
  if (/[\u0980-\u09FF]/.test(rawSeg)) return rawSeg;

  // Trim leading/trailing apostrophes so they never dangle at segment boundaries
  const s = rawSeg.replace(/^'+|'+$/g, '');
  if (!s) return '';

  let res = '';
  let i = 0;
  let atBoundary = true;

  const appendFollowingVowel = () => {
    const vm = matchVowelSequence(s, i);
    if (vm) {
      res += vm.dependent;
      i += vm.length;
    }
    atBoundary = false;
  };

  while (i < s.length) {
    const subLower = s.slice(i).toLowerCase();

    // Handle internal glottal/ayn apostrophe (')
    if (s[i] === "'") {
      const nextCh = subLower[1];
      if (!nextCh) {
        i += 1;
        continue;
      }
      if (isVowelChar(nextCh)) {
        // Vowel after apostrophe starts a clean independent vowel (never attach vowel-mark to ')
        i += 1;
        atBoundary = true;
        continue;
      }
      // Consonant after apostrophe (e.g., na'budu, mu'mineen, ya'lamoon): subtle Bengali '’' pause
      if (res.length > 0 && !res.endsWith('’')) {
        res += '’';
      }
      i += 1;
      atBoundary = true;
      continue;
    }

    // 1. Doubled 2-letter consonant digraphs (e.g., shsh, khkh, thth, dhdh, ghgh)
    const d4 = subLower.slice(0, 4);
    const d2 = subLower.slice(0, 2);
    if (d4.length === 4 && d4.slice(0, 2) === d4.slice(2, 4) && DOUBLE_DIGRAPHS[d2]) {
      res += DOUBLE_DIGRAPHS[d2];
      i += 4;
      appendFollowingVowel();
      continue;
    }

    // 2. Doubled 'yy' (e.g., iyyaaka -> ইয়্যাকা, qayyoom -> ক্বায়্যূম)
    if (d2 === 'yy') {
      res += atBoundary ? 'ইয়্য' : 'য়্য';
      i += 2;
      appendFollowingVowel();
      continue;
    }

    // 3. Doubled 'ww' (e.g., tawwaab -> তাওওয়াব, quwwah -> ক্বুওওয়াহ)
    if (d2 === 'ww') {
      res += atBoundary ? 'ওওয়' : 'ওওয়';
      i += 2;
      appendFollowingVowel();
      continue;
    }

    // 4. Doubled single consonants (bb, tt, dd, ll, mm, nn, ss, kk, qq, rr, etc.)
    if (d2.length === 2 && d2[0] === d2[1] && DOUBLE_CONSONANTS[d2[0]]) {
      res += DOUBLE_CONSONANTS[d2[0]];
      i += 2;
      appendFollowingVowel();
      continue;
    }

    // 5. 2-letter consonant digraphs (kh, gh, sh, th, dh, zh, ch, ph)
    if (d2 === 'kh' || d2 === 'gh' || d2 === 'sh' || d2 === 'th' || d2 === 'dh' || d2 === 'zh' || d2 === 'ch' || d2 === 'ph') {
      const mapDigraph: Record<string, string> = {
        kh: 'খ',
        gh: 'গ',
        sh: 'শ',
        th: 'ছ',
        dh: 'য',
        zh: 'য',
        ch: 'চ',
        ph: 'ফ'
      };
      res += mapDigraph[d2];
      i += 2;
      appendFollowingVowel();
      continue;
    }

    // 6. Semivowel 'y'
    if (subLower[0] === 'y') {
      const nextVowel = matchVowelSequence(s, i + 1);
      if (nextVowel) {
        if (atBoundary && (subLower.startsWith('yu') || subLower.startsWith('yoo'))) {
          // yu / yoo at syllable start reads naturally as 'ইউ' (e.g., ইউমিনূনা, ইউক্বীমূনাস, ইউক্বিনূন)
          res += 'ইউ';
          i += 1 + nextVowel.length;
          atBoundary = false;
          continue;
        }
        res += atBoundary ? 'ইয়' : 'য়';
        res += nextVowel.dependent;
        i += 1 + nextVowel.length;
        atBoundary = false;
        continue;
      }
      res += atBoundary ? 'ই' : 'ই';
      i += 1;
      atBoundary = false;
      continue;
    }

    // 7. Semivowel 'w'
    if (subLower[0] === 'w') {
      const nextVowel = matchVowelSequence(s, i + 1);
      if (nextVowel) {
        if (atBoundary && (subLower.startsWith('wu') || subLower.startsWith('woo'))) {
          res += 'উ';
          i += 1 + nextVowel.length;
          atBoundary = false;
          continue;
        }
        if (atBoundary && (subLower.startsWith('wi') || subLower.startsWith('wee'))) {
          res += subLower.startsWith('wee') ? 'উঈ' : 'উই';
          i += 1 + nextVowel.length;
          atBoundary = false;
          continue;
        }
        res += 'ওয়';
        res += nextVowel.dependent;
        i += 1 + nextVowel.length;
        atBoundary = false;
        continue;
      }
      // 'w' before consonant or end (e.g., saddanw-wa -> সাদ্দানও-ওয়া)
      res += 'ও';
      i += 1;
      atBoundary = false;
      continue;
    }

    // 8. Single consonants
    const c1 = subLower[0];
    if (SINGLE_CONSONANTS[c1]) {
      res += SINGLE_CONSONANTS[c1];
      i += 1;
      appendFollowingVowel();
      continue;
    }

    // 9. Vowels (independent at syllable boundary, dependent otherwise)
    const vm = matchVowelSequence(s, i);
    if (vm) {
      res += atBoundary ? vm.independent : vm.dependent;
      i += vm.length;
      atBoundary = false;
      continue;
    }

    // 10. Passthrough
    res += s[i];
    i += 1;
    atBoundary = true;
  }

  return res;
}

function transliterateWord(word: string): string {
  if (!word) return '';
  if (/[\u0980-\u09FF]/.test(word)) return word;

  // Split by hyphen '-' so every segment resets vowel-start boundaries properly
  // (e.g., Qur-aanil -> ক্বুর-আনিল, Ar-Rahmaan -> আর-রাহমান, 'a-anzartahum -> আ-আনযারতাহুম)
  const parts = word.split('-');
  return parts.map((part) => transliterateSegment(part)).join('-');
}

export function convertEnTransliterationToBengali(englishText: string): string {
  if (!englishText) return '';

  // Strip any HTML markup and normalize smart apostrophes/whitespace
  let text = englishText
    .replace(/<[^>]+>/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

  // Apply canonical sacred phrase replacements first
  for (const [regex, repl] of CANONICAL_PHRASES) {
    text = text.replace(regex, repl);
  }

  // Tokenize by whitespace and punctuation while preserving delimiters
  const tokens = text.split(/([\s,;:!?—()[\].]+)/);
  const converted = tokens
    .map((tok) => {
      if (!tok || /^[\s,;:!?—()[\].]+$/.test(tok)) {
        return tok;
      }
      if (/[\u0980-\u09FF]/.test(tok)) {
        return tok;
      }
      return transliterateWord(tok);
    })
    .join('');

  return converted.replace(/\s+/g, ' ').trim();
}

// Direct Arabic Uthmani text to Bengali pronunciation engine (Offline fallback)
export function arabicToBengaliPronunciation(arabic: string): string {
  if (!arabic) return '';

  const clean = arabic
    .replace(/[\u06D6-\u06ED]/g, '') // Quranic pause marks
    .trim();

  const words = clean.split(/\s+/);
  return words
    .map((w) => convertArabicWord(w))
    .filter(Boolean)
    .join(' ');
}

const ARABIC_DOUBLE_MAP: Record<string, string> = {
  ب: 'ব্ব',
  ت: 'ত্ত',
  ث: 'ছ্‌ছ',
  ج: 'জ্জ',
  ح: 'হ্‌হ',
  خ: 'খ্‌খ',
  د: 'দ্দ',
  ذ: 'য্‌য',
  ر: 'র্‌র',
  ز: 'য্‌য',
  س: 'স্স',
  ش: 'শ্‌শ',
  ص: 'স্স',
  ض: 'দ্দ',
  ط: 'ত্ত্ব',
  ظ: 'য্‌য',
  ف: 'ফ্‌ফ',
  ق: 'ক্ক্ব',
  ك: 'ক্ক',
  ل: 'ল্ল',
  م: 'ম্ম',
  ن: 'ন্ন',
  ه: 'হ্‌হ',
  و: 'ওওয়',
  ي: 'য়্য'
};

function convertArabicWord(word: string): string {
  let res = '';
  const len = word.length;

  for (let i = 0; i < len; i++) {
    const ch = word[i];
    const next = word[i + 1] || '';
    const hasShaddah = next === '\u0651' || word[i + 2] === '\u0651';

    let base = '';
    switch (ch) {
      case 'ا':
      case 'ٱ':
        if (res.length === 0) {
          base = 'আ';
        } else if (!res.endsWith('া') && !res.endsWith('ি') && !res.endsWith('ু')) {
          base = 'া';
        }
        break;
      case 'أ':
      case 'إ':
      case 'آ':
      case 'ء':
        base = res.length === 0 ? 'আ' : '';
        break;
      case 'ب': base = 'ব'; break;
      case 'ت': base = 'ত'; break;
      case 'ث': base = 'ছ'; break;
      case 'ج': base = 'জ'; break;
      case 'ح': base = 'হ'; break;
      case 'خ': base = 'খ'; break;
      case 'د': base = 'দ'; break;
      case 'ذ': base = 'য'; break;
      case 'ر': base = 'র'; break;
      case 'ز': base = 'য'; break;
      case 'س': base = 'স'; break;
      case 'ش': base = 'শ'; break;
      case 'ص': base = 'স'; break;
      case 'ض': base = 'দ'; break;
      case 'ط': base = 'ত্ব'; break;
      case 'ظ': base = 'য'; break;
      case 'ع': base = res.length === 0 ? 'আ' : '‘'; break;
      case 'غ': base = 'গ'; break;
      case 'ف': base = 'ফ'; break;
      case 'ق': base = 'ক্ব'; break;
      case 'ك': base = 'ক'; break;
      case 'ل': base = 'ল'; break;
      case 'م': base = 'ম'; break;
      case 'ن': base = 'ন'; break;
      case 'ه':
      case 'ة': base = 'হ'; break;
      case 'و': base = res.length === 0 ? 'ওয়া' : 'ও'; break;
      case 'ي':
      case 'ى': base = res.length === 0 ? 'ইয়া' : 'ই'; break;
      case '\u064E': // Fatha
        if (res.length > 0 && !res.endsWith('া') && !res.endsWith('ি') && !res.endsWith('ু')) {
          base = 'া';
        }
        break;
      case '\u064F': // Damma
        base = res.length === 0 ? 'উ' : 'ু';
        break;
      case '\u0650': // Kasra
        base = res.length === 0 ? 'ই' : 'ি';
        break;
      case '\u0652': // Sukun
        base = '';
        break;
      case '\u064B': // Fathatan
        base = 'ান';
        break;
      case '\u064C': // Dammatan
        base = 'উন';
        break;
      case '\u064D': // Kasratan
        base = 'ইন';
        break;
      case '\u0670': // Dagger Alif
        base = 'া';
        break;
    }

    if (hasShaddah && ARABIC_DOUBLE_MAP[ch]) {
      res += ARABIC_DOUBLE_MAP[ch];
    } else if (base) {
      res += base;
    }
  }

  return res;
}
