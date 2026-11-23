/* ============================================================
   TutorFlow — adapter-local.js
   Warstwa persystencji. Store nie wie, GDZIE trzymane są dane —
   rozmawia wyłącznie z adapterem o tym interfejsie:

     read()            -> obiekt { students:[], lessons:[], … } | null
     write(state)      -> zapis całości (debounce po stronie Store)
     clear()           -> usunięcie danych
     info()            -> { name, size }

   Podmiana na backend (Supabase / Firebase / REST + Postgres)
   sprowadza się do napisania drugiego adaptera z tymi metodami
   i wywołania TF.Store.useAdapter(new SupabaseAdapter(...)).
   Metody mogą zwracać Promise — Store obsługuje oba warianty
   (patrz store.js → _resolve).
   ============================================================ */
window.TF = window.TF || {};

(function () {
  'use strict';

  const KEY = 'tutorflow:v1';

  function LocalStorageAdapter(key) {
    this.key = key || KEY;
    this.name = 'localStorage';
  }

  LocalStorageAdapter.prototype.read = function () {
    try {
      const raw = window.localStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[TutorFlow] Nie udało się odczytać danych:', e);
      return null;
    }
  };

  LocalStorageAdapter.prototype.write = function (state) {
    try {
      window.localStorage.setItem(this.key, JSON.stringify(state));
      return true;
    } catch (e) {
      console.error('[TutorFlow] Zapis nieudany (limit pamięci?):', e);
      if (window.TF.UI && window.TF.UI.toast) {
        window.TF.UI.toast('Nie udało się zapisać danych', { type: 'bad', desc: 'Sprawdź limit pamięci przeglądarki.' });
      }
      return false;
    }
  };

  LocalStorageAdapter.prototype.clear = function () {
    try { window.localStorage.removeItem(this.key); return true; }
    catch (e) { return false; }
  };

  LocalStorageAdapter.prototype.info = function () {
    let size = 0;
    try { size = (window.localStorage.getItem(this.key) || '').length; } catch (e) {}
    return { name: this.name, size: size, sizeKb: Math.round(size / 1024 * 10) / 10 };
  };

  /* Adapter zapasowy — gdy localStorage jest zablokowany
     (tryb prywatny, polityka przeglądarki). Dane żyją w pamięci sesji. */
  function MemoryAdapter() { this.name = 'pamięć (bez zapisu)'; this._d = null; }
  MemoryAdapter.prototype.read = function () { return this._d; };
  MemoryAdapter.prototype.write = function (s) { this._d = JSON.parse(JSON.stringify(s)); return true; };
  MemoryAdapter.prototype.clear = function () { this._d = null; return true; };
  MemoryAdapter.prototype.info = function () { return { name: this.name, size: 0, sizeKb: 0 }; };

  function createDefaultAdapter() {
    try {
      const t = '__tf_test__';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      return new LocalStorageAdapter(KEY);
    } catch (e) {
      console.warn('[TutorFlow] localStorage niedostępny — dane nie przetrwają odświeżenia.');
      return new MemoryAdapter();
    }
  }

  window.TF.Adapters = { LocalStorageAdapter, MemoryAdapter, createDefaultAdapter, KEY };
})();
