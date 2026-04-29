'use strict';
// ═══════════════════════════════════════════════════════════════
//  SOWIE FISZKI — Cookie Consent Banner (ePrivacy / RODO)
//
//  Apka NIE uzywa cookies do sledzenia ani reklam — tylko
//  funkcjonalnego localStorage (sesja, motyw, ustawienia gier).
//  Mimo to ePrivacy Directive wymaga poinformowania uzytkownika
//  i uzyskania potwierdzenia. Niniejszy baner spelnia ten wymog.
//
//  Inline styles (nie zalezy od CSS reszty strony) — dziala
//  identycznie na index.html, app.html i wszystkich grach.
// ═══════════════════════════════════════════════════════════════
(function(){
  if (typeof window === 'undefined') return;
  // Nie pokazuj w trybie wydruku ani w iframe
  if (window.top !== window.self) return;

  const STORAGE_KEY = 'fiszki_consent_v1';

  function hasConsent(){
    try { return localStorage.getItem(STORAGE_KEY) === '1'; }
    catch(e) { return false; }
  }

  function setConsent(){
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch(e) {}
  }

  function showPolicyModal(){
    // Jesli juz otwarty — nie powielaj
    if (document.getElementById('sowie-policy-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'sowie-policy-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Polityka prywatności i cookies');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);backdrop-filter:blur(8px);z-index:99999998;display:flex;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
    modal.innerHTML =
      '<div style="background:#fff;max-width:680px;max-height:88vh;border-radius:18px;padding:26px 30px;overflow-y:auto;color:#1f2937;line-height:1.55;font-size:14.5px;box-shadow:0 20px 60px rgba(0,0,0,.5)">' +
      '<h2 style="font-size:1.4rem;margin:0 0 14px;color:#7c3aed;font-weight:800">🦉 Polityka prywatności i cookies</h2>' +
      '<p><strong>Sowie Fiszki</strong> to projekt edukacyjny non-profit (Daniel Ostrowski, kontakt: <a href="mailto:sowie.fiszki@gmail.com" style="color:#7c3aed">sowie.fiszki@gmail.com</a>).</p>' +
      '<h3 style="font-size:1rem;margin:14px 0 6px;color:#1f2937">🍪 Co przechowujemy w przeglądarce</h3>' +
      '<ul style="margin:0 0 10px 22px;padding:0">' +
        '<li><strong>localStorage</strong> — preferencje (motyw, dźwięk, ustawienia gier), wybrane słówka, stany lokalne aplikacji</li>' +
        '<li><strong>sessionStorage</strong> — aktualne zalogowanie</li>' +
        '<li><strong>Token sesji Supabase</strong> — uwierzytelnienie do bazy danych</li>' +
      '</ul>' +
      '<p><strong>Nie używamy</strong> żadnych cookies analitycznych (Google Analytics itp.), reklamowych ani trackerów. Brak fingerprintingu, brak profilowania.</p>' +
      '<h3 style="font-size:1rem;margin:14px 0 6px;color:#1f2937">📊 Dane przetwarzane (RODO)</h3>' +
      '<ul style="margin:0 0 10px 22px;padding:0">' +
        '<li>Login + hasło (zaszyfrowane bcrypt w Supabase Auth)</li>' +
        '<li>Postępy nauki (XP, opanowane słówka, statystyki)</li>' +
        '<li>Dziennik aktywności (z retencją 60 dni — patrz „Dziennik aktywności")</li>' +
        '<li>Opcjonalnie: imię i nazwisko (przy prośbie o dostęp do podręcznika)</li>' +
      '</ul>' +
      '<h3 style="font-size:1rem;margin:14px 0 6px;color:#1f2937">⚖️ Twoje prawa (RODO art. 15–22)</h3>' +
      '<ul style="margin:0 0 10px 22px;padding:0">' +
        '<li>📋 Wgląd, sprostowanie, ograniczenie przetwarzania</li>' +
        '<li>🗑️ <strong>Prawo do bycia zapomnianym</strong> (art. 17): „Moje konto" → „Usuń konto" — usuwa wszystko nieodwracalnie</li>' +
        '<li>📤 Eksport danych (CSV postępów dostępny w panelu)</li>' +
        '<li>👨‍👩‍👧 Dzieci poniżej 16 lat — wymagana zgoda rodzica/opiekuna (checkbox przy rejestracji)</li>' +
      '</ul>' +
      '<h3 style="font-size:1rem;margin:14px 0 6px;color:#1f2937">🌐 Hosting i przechowywanie danych</h3>' +
      '<p>Domena <strong>sowiefiszki.com</strong> — aplikacja hostowana na <strong>Vercel Inc.</strong> (USA, infrastruktura w UE/EOG; logi serwerowe: IP, user-agent, request URL — RODO art. 6.1.f). Baza danych i uwierzytelnianie: <strong>Supabase Inc.</strong> (UE/EOG). Komunikacja zawsze przez HTTPS.</p>' +
      '<p style="font-size:13px;color:#6b7280;margin-top:14px;font-style:italic">Pełny regulamin i polityka prywatności dostępne w aplikacji po zalogowaniu (zakładka „Moje konto" → „Regulamin" / „Polityka prywatności").</p>' +
      '<button onclick="this.closest(\'#sowie-policy-modal\').remove()" style="margin-top:18px;padding:11px 26px;background:#7c3aed;color:#fff;border:none;border-radius:100px;font-weight:800;cursor:pointer;font-size:15px;font-family:inherit;width:100%">Zamknij</button>' +
      '</div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e){ if (e.target === modal) modal.remove(); });
    // Esc — zamyka modal
    function onEsc(e){ if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', onEsc); } }
    document.addEventListener('keydown', onEsc);
  }

  function injectBanner(){
    if (hasConsent()) return;
    if (document.getElementById('sowie-cookie-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'sowie-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Informacja o przechowywaniu danych');
    banner.setAttribute('aria-live', 'polite');
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999999;background:linear-gradient(180deg,#1e1b4b 0%,#0f172a 100%);color:#fff;padding:14px 18px;box-shadow:0 -8px 32px rgba(0,0,0,.5);border-top:2px solid #a78bfa;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;display:flex;flex-wrap:wrap;align-items:center;gap:14px;justify-content:center';

    banner.innerHTML =
      '<div style="flex:1 1 280px;max-width:760px">' +
        '🍪 <strong>Sowie Fiszki</strong> używa <strong>localStorage</strong> i tokenu sesji Supabase wyłącznie do działania aplikacji ' +
        '(zalogowanie, motyw, ustawienia gier, postępy nauki). ' +
        '<strong>Nie stosujemy cookies analitycznych ani reklamowych.</strong> ' +
        'Klikając „Rozumiem" potwierdzasz zapoznanie się z polityką prywatności. ' +
        '<a href="#" id="sowie-policy-link" style="color:#c4b5fd;text-decoration:underline;font-weight:700">Czytaj politykę</a>' +
      '</div>' +
      '<button id="sowie-consent-accept" type="button" aria-label="Akceptuję politykę prywatności" style="padding:11px 24px;background:linear-gradient(135deg,#a78bfa,#7c3aed);color:#fff;border:none;border-radius:100px;font-weight:800;font-size:14px;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(124,58,237,.5);white-space:nowrap">✓ Rozumiem</button>';

    document.body.appendChild(banner);

    document.getElementById('sowie-consent-accept').onclick = function(){
      setConsent();
      banner.style.transition = 'transform .3s ease, opacity .3s ease';
      banner.style.transform = 'translateY(105%)';
      banner.style.opacity = '0';
      setTimeout(function(){ try { banner.remove(); } catch(e) {} }, 320);
    };

    document.getElementById('sowie-policy-link').onclick = function(e){
      e.preventDefault();
      showPolicyModal();
    };
  }

  // Hook do otwierania polityki z dowolnego miejsca: window.openPrivacyPolicy()
  window.openPrivacyPolicy = showPolicyModal;

  // Inject po DOMContentLoaded (lub od razu jesli juz ready)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectBanner);
  } else {
    injectBanner();
  }
})();
