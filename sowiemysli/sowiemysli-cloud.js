// ============================================================
//  SOWIE MYSLI — warstwa chmury (Supabase)
//  Prywatne mapy mysli pod sekretnym linkiem /sowiemysli/#/m/<slug>.
//  - odczyt publiczny TYLKO po dokladnym slugu (RPC sowiemysli_get_map)
//  - zapis/edycja/kasowanie: tylko wlasciciel (RLS owner_id = auth.uid())
//  - tworzenie/edycja w chmurze: TYLKO Admin lub Nauczyciel z Premium
//  Sesja wspoldzielona z sowiefiszki.com (ten sam origin + supabase-config.js).
// ============================================================
(function () {
  'use strict';

  const TABLE = 'sowiemysli_maps';
  const PROMO_END = Date.parse('2026-11-01T00:00:00'); // Premium dla wszystkich do 31.10.2026
  let sb = null;
  let user = null;
  let profile = null; // { is_admin, is_teacher, plan, plan_expires_at }

  function isPromoActive() { return Date.now() < PROMO_END; }

  async function loadProfile() {
    profile = null;
    if (!sb || !user) return;
    try {
      const { data } = await sb.from('profiles')
        .select('is_admin,is_teacher,plan,plan_expires_at')
        .eq('id', user.id)
        .maybeSingle();
      profile = data || null;
    } catch (e) { profile = null; }
  }

  const SMCloud = {
    async init() {
      if (!window.supabase || typeof window.supabase.from !== 'function') return false;
      sb = window.supabase;
      try {
        const { data } = await sb.auth.getSession();
        user = data && data.session ? data.session.user : null;
      } catch (e) { user = null; }
      await loadProfile();
      try {
        sb.auth.onAuthStateChange((_ev, session) => {
          user = session ? session.user : null;
          loadProfile();
        });
      } catch (e) {}
      return true;
    },

    ready() { return !!sb; },
    user() { return user; },
    userId() { return user ? user.id : null; },
    loginUrl() { return (location.origin + '/login'); },
    isTeacher() { return !!(profile && profile.is_teacher); },
    isAdmin() { return !!(profile && profile.is_admin); },

    hasPremium() {
      if (!profile) return false;
      if (profile.is_admin) return true;
      if (isPromoActive()) return true;
      return profile.plan === 'premium'
        && !!profile.plan_expires_at
        && new Date(profile.plan_expires_at).getTime() > Date.now();
    },
    // Tworzyc/edytowac/udostepniac w chmurze moga: admin oraz nauczyciel z Premium.
    canEdit() {
      if (!user || !profile) return false;
      if (profile.is_admin) return true;
      if (profile.is_teacher) return this.hasPremium();
      return false;
    },

    genSlug() {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
      let out = '';
      const rnd = (window.crypto && crypto.getRandomValues)
        ? crypto.getRandomValues(new Uint32Array(18))
        : Array.from({ length: 18 }, () => Math.floor(Math.random() * 4294967296));
      for (let i = 0; i < 18; i++) out += alphabet[rnd[i] % alphabet.length];
      return out;
    },

    async fetchBySlug(slug) {
      if (!sb) return null;
      try {
        const { data, error } = await sb.rpc('sowiemysli_get_map', { p_slug: slug });
        if (error) { console.warn('[SMCloud] fetch', error); return null; }
        const row = Array.isArray(data) ? data[0] : data;
        return row || null;
      } catch (e) { console.warn('[SMCloud] fetch', e); return null; }
    },

    async publish(map) {
      if (!sb || !user) throw new Error('not-auth');
      const slug = this.genSlug();
      const payload = {
        slug,
        owner_id: user.id,
        title: (map.title || '').slice(0, 200),
        data: map,
        updated_at: new Date().toISOString()
      };
      const { error } = await sb.from(TABLE).insert(payload);
      if (error) throw error;
      return slug;
    },

    async update(slug, map) {
      if (!sb || !user || !slug) return false;
      try {
        const { error } = await sb.from(TABLE)
          .update({ title: (map.title || '').slice(0, 200), data: map, updated_at: new Date().toISOString() })
          .eq('slug', slug);
        if (error) { console.warn('[SMCloud] update', error); return false; }
        return true;
      } catch (e) { console.warn('[SMCloud] update', e); return false; }
    },

    async remove(slug) {
      if (!sb || !user || !slug) return false;
      try {
        const { error } = await sb.from(TABLE).delete().eq('slug', slug);
        return !error;
      } catch (e) { return false; }
    },

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

  window.SMCloud = SMCloud;
})();
