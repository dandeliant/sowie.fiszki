#!/usr/bin/env node
'use strict';

/* ═══════════════════════════════════════════════════════════════════
   sync-supabase-to-datajs.js

   Synchronizuje dane z Supabase → lokalny data.js.
   Po uruchomieniu, data.js zawiera SNAPSHOT calej tresci z bazy:
     - admin_books    → nowe podreczniki dodane przez admina
     - admin_units    → nowe unity wewnatrz podrecznikow
     - admin_words    → edycje slow + nowe slowa + soft-delete
     - word_sentences → zdania przykladowe (inline jako 4. i 5. element)

   Wbudowany format slowek:
     - 4-elem:  [pl, en, sentPl, sentEn]                  — bez emoji (klasa1-8 itp.)
     - 5-elem:  [pl, en, emoji, sentPl, sentEn]           — z emoji (Tiger 1, bugsteam2 itd.)
     - 3-elem:  [pl, en, emoji]                           — gdy brak zdan w bazie
     - 2-elem:  [pl, en]                                   — minimalny

   Aplikacja (app.html) obsluguje wszystkie 4 formaty przez helper
   getInlineSentences(w) + isLikelySentence(s).

   Uzycie:
     node sync-supabase-to-datajs.js              # safe mode → zapis do data.js.new
     node sync-supabase-to-datajs.js --in-place   # nadpisuje data.js (backup .bak)

   Po uruchomieniu (safe mode):
     1. Sprawdz diff: code --diff data.js data.js.new
     2. Jesli OK:    mv data.js.new data.js
     3. Bump SW w sw.js (np. v1.10 → v1.11)
     4. git add data.js sw.js && git commit -m "Sync from Supabase" && git push

   Wymagania:
     - Node.js 18+ (z global.fetch)
     - Plik supabase-config.js obok skryptu (z SUPABASE_URL i SUPABASE_ANON_KEY)
   ═══════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_JS = path.join(ROOT, 'data.js');
const CONFIG_JS = path.join(ROOT, 'supabase-config.js');

// ─── 1. Load Supabase config ─────────────────────────────────
function loadConfig() {
  const code = fs.readFileSync(CONFIG_JS, 'utf8');
  const url = code.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/)?.[1];
  const key = code.match(/SUPABASE_(?:ANON_)?KEY\s*=\s*['"]([^'"]+)['"]/)?.[1];
  if (!url || !key) throw new Error('Cannot parse SUPABASE_URL/KEY z supabase-config.js');
  return { url, key };
}

// ─── 2. Load data.js → BOOKS object ──────────────────────────
function loadBooks() {
  const code = fs.readFileSync(DATA_JS, 'utf8');
  const start = code.indexOf('const BOOKS');
  if (start < 0) throw new Error('Nie znaleziono "const BOOKS" w data.js');
  const startBrace = code.indexOf('{', start);
  let depth = 0, end = -1;
  for (let i = startBrace; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  if (end < 0) throw new Error('Nie znaleziono konca obiektu BOOKS');
  const literal = code.substring(startBrace, end);
  return eval('(' + literal + ')');
}

// ─── 3. Fetch from Supabase REST API ─────────────────────────
async function supaFetch(config, table, queryParams = '') {
  const url = `${config.url}/rest/v1/${table}?select=*${queryParams}`;
  const res = await fetch(url, {
    headers: {
      'apikey': config.key,
      'Authorization': `Bearer ${config.key}`,
    }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${table}: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

// Heurystyka: czy ciag wyglada jak zdanie vs emoji
function isLikelySentence(s) {
  if (!s) return false;
  return /[a-zA-Z]/.test(s) || s.length > 4;
}

// ─── 4. Apply Supabase overrides to BOOKS ────────────────────
function applyOverrides(BOOKS, supa) {
  const { books, units, words, sentences } = supa;

  // 4a. Nowe podreczniki z admin_books (te, ktorych nie ma w data.js)
  let newBooks = 0;
  books.forEach(b => {
    if (BOOKS[b.book_id]) return; // istniejacy — overrides slow obsluzone nizej
    BOOKS[b.book_id] = {
      id: b.book_id,
      language: b.language || 'en',
      schoolType: b.school_type || 'courses',
      ...(b.grade != null ? { grade: b.grade } : {}),
      name: b.name || b.book_id,
      shortName: b.short_name || b.name || b.book_id,
      icon: b.icon || '📖',
      color: b.color || '#7c4dff',
      description: b.description || '',
      units: {}
    };
    newBooks++;
  });

  // 4b. Nowe unity z admin_units
  let newUnits = 0;
  units.forEach(u => {
    const book = BOOKS[u.book_id];
    if (!book) return;
    if (!book.units[u.unit_key]) {
      book.units[u.unit_key] = {
        name: u.name || u.unit_key,
        icon: u.icon || '📖',
        color: u.color || '#7c4dff',
        words: []
      };
      newUnits++;
    }
  });

  // 4c. admin_words: dodaj nowe, nadpisz istniejace, usun soft-deleted
  let addedWords = 0, overriddenWords = 0, deletedWords = 0;
  words.forEach(w => {
    const book = BOOKS[w.book_id];
    if (!book) return;
    const unit = book.units[w.unit_key];
    if (!unit) return;
    const idx = (unit.words || []).findIndex(x => x[0] === w.word_pl);
    if (w.is_deleted) {
      if (idx >= 0) { unit.words.splice(idx, 1); deletedWords++; }
      return;
    }
    if (idx >= 0) {
      // Zachowaj emoji z istniejacego wpisu (jesli nie jest zdaniem)
      const existing = unit.words[idx];
      const newEntry = [w.word_pl, w.word_en];
      if (existing[2] && !isLikelySentence(existing[2])) {
        newEntry.push(existing[2]);
      }
      unit.words[idx] = newEntry;
      overriddenWords++;
    } else {
      unit.words.push([w.word_pl, w.word_en]);
      addedWords++;
    }
  });

  // 4d. word_sentences → wbudowane jako [pl, en, emoji?, sentPl, sentEn]
  let embeddedSentences = 0;
  sentences.forEach(s => {
    const book = BOOKS[s.book_id];
    if (!book) return;
    let foundUnit = null, foundIdx = -1;
    for (const uk of Object.keys(book.units)) {
      const u = book.units[uk];
      const i = (u.words || []).findIndex(x => x[0] === s.word_pl);
      if (i >= 0) { foundUnit = u; foundIdx = i; break; }
    }
    if (!foundUnit) return; // slowo z DB nie pasuje do data.js — pomijamy
    const w = foundUnit.words[foundIdx];
    const sentPl = s.sentence_pl || '';
    const sentEn = s.sentence_target || '';
    if (w[2] && !isLikelySentence(w[2])) {
      // Ma emoji na pozycji [2] — zachowaj, dodaj zdania na [3] [4]
      foundUnit.words[foundIdx] = [w[0], w[1], w[2], sentPl, sentEn];
    } else {
      // Bez emoji — uzyj formatu 4-elem
      foundUnit.words[foundIdx] = [w[0], w[1], sentPl, sentEn];
    }
    embeddedSentences++;
  });

  return { newBooks, newUnits, addedWords, overriddenWords, deletedWords, embeddedSentences };
}

// ─── 5. Serialize BOOKS → JS source ──────────────────────────
function jsStr(s) {
  if (s == null) return "''";
  s = String(s);
  // Single quotes; jesli zawiera ' ale nie " → uzyj "
  if (s.includes("'") && !s.includes('"')) {
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  }
  return "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n') + "'";
}

function serializeBook(b) {
  let out = '{\n';
  out += '    id: ' + jsStr(b.id) + ',\n';
  // Linia metadanych (jezyk, typ, klasa, flagi)
  const metaParts = [];
  if (b.language)            metaParts.push('language: ' + jsStr(b.language));
  if (b.schoolType)          metaParts.push('schoolType: ' + jsStr(b.schoolType));
  if (b.grade != null)       metaParts.push('grade: ' + b.grade);
  if (b.defaultAccess)       metaParts.push('defaultAccess: true');
  if (b.adminOnly)           metaParts.push('adminOnly: true');
  if (metaParts.length)      out += '    ' + metaParts.join(', ') + ',\n';
  out += '    name: ' + jsStr(b.name) + ',\n';
  if (b.shortName)   out += '    shortName: ' + jsStr(b.shortName) + ',\n';
  if (b.icon)        out += '    icon: ' + jsStr(b.icon) + ',\n';
  if (b.color)       out += '    color: ' + jsStr(b.color) + ',\n';
  if (b.description) out += '    description: ' + jsStr(b.description) + ',\n';
  if (b.lang)        out += '    lang: ' + jsStr(b.lang) + ',\n';
  out += '    units: {\n';
  Object.entries(b.units || {}).forEach(([uk, u]) => {
    out += '      ' + uk + ': {\n';
    const headParts = ['name: ' + jsStr(u.name)];
    if (u.icon)  headParts.push('icon: ' + jsStr(u.icon));
    if (u.color) headParts.push('color: ' + jsStr(u.color));
    out += '        ' + headParts.join(', ') + ',\n';
    out += '        words: [\n';
    (u.words || []).forEach(w => {
      const parts = w.map(jsStr);
      out += '          [' + parts.join(', ') + '],\n';
    });
    out += '        ]\n';
    out += '      },\n';
  });
  out += '    }\n';
  out += '  }';
  return out;
}

function serializeBooks(BOOKS) {
  let out = "'use strict';\n";
  out += "// ═══════════════════════════════════════════════════════════\n";
  out += "//  SOWIE FISZKI — Baza słówek (auto-generated)\n";
  out += "//  Zsynchronizowane z Supabase przez sync-supabase-to-datajs.js\n";
  out += "//  Format slowek:\n";
  out += "//    4-elem:  [pl, en, sentPl, sentEn]            — bez emoji\n";
  out += "//    5-elem:  [pl, en, emoji, sentPl, sentEn]     — z emoji\n";
  out += "//    3-elem:  [pl, en, emoji]                     — bez zdan\n";
  out += "//    2-elem:  [pl, en]                            — minimum\n";
  out += "// ═══════════════════════════════════════════════════════════\n\n";
  out += 'const BOOKS = {\n';

  const ids = Object.keys(BOOKS);
  ids.forEach((id, idx) => {
    const b = BOOKS[id];
    out += '\n  // ─── ' + (b.shortName || b.name || id) + ' ──────────────────────\n';
    out += '  ' + (idx > 0 ? ',' : '') + id + ': ' + serializeBook(b) + '\n';
  });

  out += '\n};\n\n';
  out += `// ─── HELPERS ────────────────────────────────────────────────

/** Wszystkie słowa z danego podręcznika (płaska lista) */
function getBookAllWords(bookId) {
  if (!BOOKS[bookId]) return [];
  return Object.values(BOOKS[bookId].units).flatMap(u => u.words);
}

/** Jednostki podręcznika + wirtualny unit "Wszystkie" */
function getBookUnitsWithAll(bookId) {
  if (!BOOKS[bookId]) return {};
  const units = {};
  Object.entries(BOOKS[bookId].units).forEach(([k, v]) => { units[k] = v; });
  units.all = {
    name: 'Wszystkie',
    icon: '🌍',
    color: '#ffd166',
    words: getBookAllWords(bookId)
  };
  return units;
}
`;

  return out;
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  console.log('🦉 sync-supabase-to-datajs.js');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log('📥 Wczytywanie data.js...');
  const BOOKS = loadBooks();
  console.log(`   ${Object.keys(BOOKS).length} ksiazek`);

  console.log('🌐 Laczenie z Supabase...');
  const config = loadConfig();
  console.log(`   ${config.url}`);

  console.log('📥 admin_books...');
  const books = await supaFetch(config, 'admin_books');
  console.log(`   ${books.length} ksiazek`);

  console.log('📥 admin_units...');
  const units = await supaFetch(config, 'admin_units');
  console.log(`   ${units.length} unitow`);

  console.log('📥 admin_words (limit 20000)...');
  const words = await supaFetch(config, 'admin_words', '&limit=20000');
  console.log(`   ${words.length} slow`);

  console.log('📥 word_sentences (limit 20000)...');
  const sentences = await supaFetch(config, 'word_sentences', '&limit=20000');
  console.log(`   ${sentences.length} zdan`);

  console.log('🔄 Aplikowanie overrides...');
  const stats = applyOverrides(BOOKS, { books, units, words, sentences });
  console.log(`   + ${stats.newBooks} nowych ksiazek`);
  console.log(`   + ${stats.newUnits} nowych unitow`);
  console.log(`   + ${stats.addedWords} dodanych slow`);
  console.log(`   ↻ ${stats.overriddenWords} nadpisanych slow`);
  console.log(`   - ${stats.deletedWords} usunietych slow (soft-delete)`);
  console.log(`   ✎ ${stats.embeddedSentences} wbudowanych zdan`);

  console.log('💾 Generowanie nowego data.js...');
  const out = serializeBooks(BOOKS);
  console.log(`   ${(out.length / 1024).toFixed(1)} KB`);

  const inPlace = process.argv.includes('--in-place');
  if (inPlace) {
    const bak = DATA_JS + '.bak';
    fs.copyFileSync(DATA_JS, bak);
    fs.writeFileSync(DATA_JS, out);
    console.log(`✅ Zapisano ${DATA_JS} (backup: ${bak})`);
    console.log('');
    console.log('📋 Nastepne kroki:');
    console.log('   1. Sprawdz zmiany: git diff data.js');
    console.log('   2. Bump SW w sw.js');
    console.log('   3. git add data.js sw.js && git commit && git push');
    console.log('   4. Po zatwierdzeniu zmian: del data.js.bak (lub rm)');
  } else {
    const newPath = DATA_JS + '.new';
    fs.writeFileSync(newPath, out);
    console.log(`✅ Zapisano ${newPath}`);
    console.log('');
    console.log('📋 Nastepne kroki:');
    console.log(`   1. Porownaj: code --diff data.js ${path.basename(newPath)}`);
    console.log(`   2. Jesli OK: move data.js.new data.js (Windows) lub mv data.js.new data.js`);
    console.log('   3. Bump SW w sw.js');
    console.log('   4. git add data.js sw.js && git commit && git push');
    console.log('');
    console.log('   Albo w jednym kroku: node sync-supabase-to-datajs.js --in-place');
  }
}

main().catch(err => {
  console.error('❌ Blad:', err.message);
  if (process.env.DEBUG) console.error(err.stack);
  process.exit(1);
});
