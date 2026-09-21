// ============================================================
//  NOTESOWNIK — warstwa chmury (Supabase)
//  Prywatne tablice pod sekretnym linkiem /notesownik/#/b/<slug>.
//  - odczyt publiczny TYLKO po dokladnym slugu (RPC notesownik_get_board)
//  - zapis/edycja/kasowanie: tylko wlasciciel (RLS owner_id = auth.uid())
//  Sesja wspoldzielona z sowiefiszki.com (ten sam origin + supabase-config.js).
// ============================================================
(function () {
  'use strict';

  const TABLE = 'notesownik_boards';
  let sb = null;      // klient Supabase (z supabase-config.js: window.supabase)
  let user = null;    // zalogowany uzytkownik lub null

  const NSCloud = {
    async init() {
      // supabase-config.js nadpisuje window.supabase klientem
      if (!window.supabase || typeof window.supabase.from !== 'function') return false;
      sb = window.supabase;
      try {
        const { data } = await sb.auth.getSession();
        user = data && data.session ? data.session.user : null;
      } catch (e) { user = null; }
      try {
        sb.auth.onAuthStateChange((_ev, session) => { user = session ? session.user : null; });
      } catch (e) {}
      return true;
    },

    ready() { return !!sb; },
    user() { return user; },
    userId() { return user ? user.id : null; },
    loginUrl() { return (location.origin + '/login'); },

    // sekretny, trudny do zgadniecia slug (18 znakow base58-ish)
    genSlug() {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
      let out = '';
      const rnd = (window.crypto && crypto.getRandomValues)
        ? crypto.getRandomValues(new Uint32Array(18))
        : Array.from({ length: 18 }, () => Math.floor(Math.random() * 4294967296));
      for (let i = 0; i < 18; i++) out += alphabet[rnd[i] % alphabet.length];
      return out;
    },

    // Publiczny odczyt po slugu — przez SECURITY DEFINER RPC (bez listowania cudzych).
    async fetchBySlug(slug) {
      if (!sb) return null;
      try {
        const { data, error } = await sb.rpc('notesownik_get_board', { p_slug: slug });
        if (error) { console.warn('[NSCloud] fetch', error); return null; }
        const row = Array.isArray(data) ? data[0] : data;
        return row || null;
      } catch (e) { console.warn('[NSCloud] fetch', e); return null; }
    },

    // Utworz nowa tablice w chmurze; zwraca slug.
    async publish(board) {
      if (!sb || !user) throw new Error('not-auth');
      const slug = this.genSlug();
      const payload = {
        slug,
        owner_id: user.id,
        title: (board.title || '').slice(0, 200),
        data: board,
        updated_at: new Date().toISOString()
      };
      const { error } = await sb.from(TABLE).insert(payload);
      if (error) throw error;
      return slug;
    },

    // Nadpisz istniejaca tablice (tylko wlasciciel — pilnuje RLS).
    async update(slug, board) {
      if (!sb || !user || !slug) return false;
      try {
        const { error } = await sb.from(TABLE)
          .update({ title: (board.title || '').slice(0, 200), data: board, updated_at: new Date().toISOString() })
          .eq('slug', slug);
        if (error) { console.warn('[NSCloud] update', error); return false; }
        return true;
      } catch (e) { console.warn('[NSCloud] update', e); return false; }
    },

    async remove(slug) {
      if (!sb || !user || !slug) return false;
      try {
        const { error } = await sb.from(TABLE).delete().eq('slug', slug);
        return !error;
      } catch (e) { return false; }
    },

    // Moje tablice (do pulpitu po zalogowaniu — dziala miedzy urzadzeniami).
    async listMine() {
      if (!sb || !user) return [];
      try {
        const { data, error } = await sb.from(TABLE)
          .select('slug,title,data,updated_at')
          .eq('owner_id', user.id)
          .order('updated_at', { ascending: false });
        return error ? [] : (data || []);
      } catch (e) { return []; }
    }
  };

  window.NSCloud = NSCloud;
})();
