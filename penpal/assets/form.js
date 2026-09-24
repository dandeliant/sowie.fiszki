/* PenPal – formularz nauczyciela */
(async function () {
  'use strict';
  const { $, API, toast, plural } = PP;

  const editor = new SubmissionEditor($('#editor'));
  editor.addRow();
  editor.addRow();

  const form = $('#form');
  const submitBtn = $('#submit');
  let editing = null; // {id, token}
  const startedAt = Date.now(); // do anty-botowego limitu czasu (min. 3 s)

  const updateSummary = () => {
    const n = editor.students().filter(s => s.name).length;
    $('#summary').textContent = n ? `Zgłaszasz ${plural(n, 'ucznia', 'uczniów', 'uczniów')}.` : '';
  };
  $('#editor').addEventListener('input', updateSummary);
  $('#editor').addEventListener('click', () => setTimeout(updateSummary));

  // Ustawienia projektu
  let cfg = {};
  try {
    cfg = await API.config();
  } catch (e) { /* zostają domyślne teksty */ }
  if ((await API.mode) === 'local') {
    const isTestHost = location.protocol === 'file:' || ['localhost', '127.0.0.1', ''].includes(location.hostname);
    if (!isTestHost) {
      // Na prawdziwej stronie bez działającego api.php nie przyjmujemy zgłoszeń – zostałyby tylko w przeglądarce nauczyciela.
      form.classList.add('hidden');
      $('#closed').classList.remove('hidden');
      $('#closed').innerHTML = '<h2>Formularz jest chwilowo niedostępny</h2><p class="muted" style="margin-top:8px">Brak połączenia z serwerem. Spróbuj ponownie później lub skontaktuj się z organizatorem.</p>';
      return;
    }
    PP.showLocalBanner('Zgłoszenia zobaczysz w <a href="admin.html">panelu</a> w tej samej przeglądarce.');
  }
  if (cfg.projectName) {
    $('#project-name').textContent = cfg.projectName;
    document.title = `Zgłoszenie szkoły – ${cfg.projectName}`;
  }
  if (cfg.intro) $('#intro').textContent = cfg.intro;
  if (cfg.deadline) {
    const d = new Date(cfg.deadline + 'T00:00:00');
    $('#deadline').textContent = `Zgłoszenia do ${d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    $('#deadline').classList.remove('hidden');
  }

  // Tryb edycji: index.html#edit=<id>.<token>
  const m = location.hash.match(/edit=([a-f0-9]+)\.([a-f0-9]+)/);
  if (m) {
    try {
      const res = await API.getOwn(m[1], m[2]);
      editing = { id: m[1], token: m[2] };
      editor.setData(res.submission);
      $('#edit-chip').classList.remove('hidden');
      submitBtn.textContent = 'Zapisz zmiany';
      updateSummary();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  if (cfg.formOpen === false) {
    form.classList.add('hidden');
    $('#closed').classList.remove('hidden');
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    // Anty-bot: honeypot (ukryte pole „website" wypełni tylko bot).
    if (form.website.value) return;
    // Anty-bot: formularz wysłany zbyt szybko (<3 s) = najpewniej automat.
    if (!editing && Date.now() - startedAt < 3000) {
      toast('Poczekaj chwilę i spróbuj ponownie.', 'error');
      return;
    }
    const data = editor.getData();
    if (!data) return;
    data.website = form.website.value;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Wysyłanie…';
    try {
      let link = null;
      if (editing) {
        await API.updateOwn(editing.id, editing.token, data);
        link = location.href;
      } else {
        const res = await API.submit(data);
        link = `${location.origin}${location.pathname}#edit=${res.id}.${res.token}`;
      }
      form.classList.add('hidden');
      $('#done').classList.remove('hidden');
      $('#done-title').textContent = editing ? 'Zmiany zostały zapisane.' : 'Dziękujemy! Zgłoszenie zostało wysłane.';
      $('#done-text').textContent = `${data.school} · ${plural(data.students.length, 'uczeń', 'uczniów', 'uczniów')}. Informację o dobranych parach otrzymasz od organizatora.`;
      $('#edit-link').value = link;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = editing ? 'Zapisz zmiany' : 'Wyślij zgłoszenie';
    }
  });

  $('#copy-link').addEventListener('click', async () => {
    const inp = $('#edit-link');
    try {
      await navigator.clipboard.writeText(inp.value);
    } catch (e) {
      inp.select();
      document.execCommand('copy');
    }
    toast('Skopiowano link', 'ok');
  });

  $('#again').addEventListener('click', () => {
    location.hash = '';
    location.reload();
  });
})();
