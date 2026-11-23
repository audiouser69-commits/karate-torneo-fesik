/* Karate Torneo FESIK - interfaccia di gestione */
'use strict';
const C = window.Core;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KT = window.api || {};

// ---------------- stato ----------------
function blankState() {
  return {
    version: 1,
    tournament: { name: 'Torneo di Karate', date: C.isoDate(new Date()), place: '', tatami: '1' },
    settings: JSON.parse(JSON.stringify(C.DEFAULT_SETTINGS)),
    firebase: { url: '', secret: '', tid: 'torneo-' + Math.random().toString(36).slice(2, 7), enabled: false },
    athletes: [], categories: [], unassigned: [],
    selCat: null, bout: null, kataSel: null,
    graphics: defaultGraphics()
  };
}
function defaultGraphics() {
  const g = (title, figure, theme, subtitle, text) => ({ id: C.uid('g'), title, figure, theme, subtitle, text, kicker: '', animate: true });
  return {
    items: [
      g('Benvenuti', 'karateka', 'rosso', 'Il torneo sta per iniziare', 'Atleti e accompagnatori sono pregati di prendere posto.\nBuona gara a tutti!'),
      g('Cerimonia di apertura', 'saluto', 'nero', 'Saluto degli atleti e degli arbitri', 'Atleti schierati sul tatami per il saluto ufficiale.'),
      g('Gare di Kata', 'kata', 'blu', 'Eliminatorie in corso', 'Gli atleti eseguono il kata davanti ai giudici.\nPunteggio: si scartano il voto più alto e il più basso.'),
      g('Gare di Kumite', 'calcio', 'rosso', 'Combattimenti in corso', 'Shobu Sanbon e Shobu Nihon.\nSeguite il punteggio sul tabellone.'),
      g('Pausa', 'pausa', 'verde', 'Le gare riprendono a breve', ''),
      g('Si riprende tra poco', 'orologio', 'nero', 'Atleti pronti in zona di chiamata', ''),
      g('Premiazione', 'coppa', 'oro', 'Complimenti a tutti gli atleti!', 'Gli atleti premiati sono pregati di recarsi al podio.'),
      g('Podio', 'podio', 'oro', 'Classifica finale', ''),
      g('Riunione arbitri', 'arbitro', 'blu', 'Breve sospensione', 'Gli ufficiali di gara si riuniscono al tavolo centrale.'),
      g('Comunicazione', 'megafono', 'chiaro', 'Avviso per il pubblico', 'Scrivi qui il tuo messaggio.')
    ],
    program: [
      { name: 'Accredito e pesatura', time: '08:30' }, { name: 'Cerimonia di apertura', time: '09:30' }, { name: 'Gare di Kata', time: '10:00' },
      { name: 'Pausa pranzo', time: '13:00' }, { name: 'Gare di Kumite', time: '14:00' }, { name: 'Premiazione', time: '17:30' }
    ],
    current: 0, showProgram: true, sel: null, onAir: null
  };
}
let S = blankState();
let byId = {};
function reindex() { byId = {}; S.athletes.forEach(a => byId[a.id] = a); }
const nameOf = id => id && byId[id] ? C.athleteName(byId[id]) : '—';
const clubOf = id => id && byId[id] ? byId[id].societa : '';
const catById = id => S.categories.find(c => c.id === id);

let saveTimer = null;
function save(skipPublish) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { KT.autosaveWrite && KT.autosaveWrite(JSON.stringify(S)); }, 400);
  if (!skipPublish) publishAllDebounced();
}
function toast(msg, ms) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms || 2200); }
function modal(html, buttons) {
  return new Promise(res => {
    $('#modalBody').innerHTML = html; const b = $('#modalBtns'); b.innerHTML = '';
    (buttons || [{ label: 'OK', value: true, cls: 'primary' }]).forEach(btn => {
      const e = document.createElement('button'); e.textContent = btn.label; if (btn.cls) e.className = btn.cls;
      e.onclick = () => { const v = typeof btn.value === 'function' ? btn.value() : btn.value; $('#modal').classList.add('hidden'); res(v); };
      b.appendChild(e);
    });
    $('#modal').classList.remove('hidden');
  });
}
const confirmBox = (msg) => modal('<h3>Conferma</h3><p>' + msg + '</p>', [{ label: 'Annulla', value: false }, { label: 'Conferma', value: true, cls: 'primary' }]);

// ---------------- navigazione ----------------
let curTab = 'torneo';
function show(tab) {
  curTab = tab;
  if (stopPreview) { stopPreview(); stopPreview = null; }
  $$('#nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + tab));
  render();
}
$$('#nav button').forEach(b => b.onclick = () => show(b.dataset.tab));
function render() { ({ torneo: renderTorneo, atleti: renderAtleti, categorie: renderCategorie, tabellone: renderTabellone, incontro: renderIncontro, classifiche: renderClassifiche, grafiche: renderGrafiche, online: renderOnline, regole: renderRegole })[curTab](); }

// ---------------- TORNEO ----------------
function renderTorneo() {
  const t = S.tournament;
  const nK = S.categories.filter(c => c.discipline === 'kata').length, nU = S.categories.length - nK;
  const done = S.categories.filter(c => c.status === 'conclusa').length;
  $('#tab-torneo').innerHTML = `
  <h1>Torneo</h1>
  <div class="card grid3">
    <label class="f">Nome torneo<input type="text" id="tName" value="${esc(t.name)}"></label>
    <label class="f">Data gara (per calcolo età)<input type="date" id="tDate" value="${esc(t.date)}"></label>
    <label class="f">Luogo<input type="text" id="tPlace" value="${esc(t.place)}"></label>
    <label class="f">Tatami di questo PC<input type="text" id="tTatami" value="${esc(t.tatami)}"></label>
  </div>
  <div class="card">
    <h3>1 · Importa gli atleti</h3>
    <p class="muted">Excel con colonne: <b>Cognome, Nome, Sesso, Data di nascita, Peso, Cintura, Società, Specialità</b> (Kata / Kumite / Kata e Kumite), <b>Stile</b> (facoltativo).</p>
    <div class="row gap wrap">
      <button class="primary" id="bImport">📥 Importa Excel</button>
      <button id="bTemplate">📄 Salva modello Excel vuoto</button>
      <span class="muted">${S.athletes.length} atleti caricati</span>
    </div>
  </div>
  <div class="card">
    <h3>2 · Genera categorie e sorteggio</h3>
    <p class="muted">Le categorie vengono create per specialità, classe d'età, sesso, gruppo cinture, peso (kumite) e stile (kata), secondo le regole nella scheda ⚙️ Regole.</p>
    <div class="row gap wrap">
      <button class="primary" id="bGen" ${S.athletes.length ? '' : 'disabled'}>🗂️ Genera categorie</button>
      <button id="bDrawAll" ${S.categories.length ? '' : 'disabled'}>🎲 Sorteggia tutte</button>
      <span class="muted">${S.categories.length} categorie (${nK} kata, ${nU} kumite) · ${done} concluse</span>
    </div>
  </div>
  <div class="card">
    <h3>Salvataggio</h3>
    <p class="muted small">Il torneo si salva da solo a ogni modifica. Puoi anche salvarlo in un file (backup, o per passarlo a un altro PC/tatami).</p>
    <div class="row gap wrap">
      <button id="bSave">💾 Salva torneo su file</button>
      <button id="bOpen">📂 Apri torneo da file</button>
      <button id="bNew">🆕 Nuovo torneo</button>
    </div>
  </div>`;
  const bind = (id, k) => $(id).onchange = e => { S.tournament[k] = e.target.value; save(); };
  bind('#tName', 'name'); bind('#tDate', 'date'); bind('#tPlace', 'place'); bind('#tTatami', 'tatami');
  $('#bImport').onclick = importExcel;
  $('#bTemplate').onclick = async () => { const p = await KT.saveTemplate(); if (p) toast('Modello salvato'); };
  $('#bGen').onclick = generate;
  $('#bDrawAll').onclick = drawAll;
  $('#bSave').onclick = async () => { const p = await KT.saveAs({ defaultName: (S.tournament.name || 'torneo').replace(/[^\w\- ]/g, '') + '.json', data: JSON.stringify(S, null, 1), filters: [{ name: 'Torneo', extensions: ['json'] }] }); if (p) toast('Salvato'); };
  $('#bOpen').onclick = async () => { const d = await KT.openJson(); if (!d) return; try { S = Object.assign(blankState(), JSON.parse(d)); reindex(); save(); render(); toast('Torneo caricato'); } catch (e) { toast('File non valido'); } };
  $('#bNew').onclick = async () => { if (await confirmBox('Cancellare tutti i dati del torneo attuale?')) { const fb = S.firebase; S = blankState(); S.firebase = fb; reindex(); save(); render(); } };
}

async function importExcel() {
  const f = await KT.openExcel(); if (!f) return;
  try {
    const wb = XLSX.read(f.data, { type: 'base64', cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    const { athletes, warnings } = C.parseAthleteRows(rows);
    if (!athletes.length) { modal('<h3>Nessun atleta trovato</h3><p>' + warnings.map(esc).join('<br>') + '</p>'); return; }
    let mode = 'replace';
    if (S.athletes.length) mode = await modal(`<h3>Importa ${athletes.length} atleti</h3><p>Ci sono già ${S.athletes.length} atleti. Cosa vuoi fare?</p>`, [{ label: 'Annulla', value: null }, { label: 'Aggiungi', value: 'add' }, { label: 'Sostituisci tutto', value: 'replace', cls: 'primary' }]);
    if (!mode) return;
    S.athletes = mode === 'add' ? S.athletes.concat(athletes) : athletes;
    if (mode === 'replace') { S.categories = []; S.bout = null; }
    reindex(); save(); render();
    modal(`<h3>Importazione completata</h3><p><b>${athletes.length}</b> atleti importati da ${esc(f.name)}.</p>` + (warnings.length ? '<p class="muted small">' + warnings.slice(0, 15).map(esc).join('<br>') + (warnings.length > 15 ? '<br>…' : '') + '</p>' : '') + '<p>Ora premi <b>Genera categorie</b>.</p>');
  } catch (e) { modal('<h3>Errore</h3><p>Impossibile leggere il file: ' + esc(e.message) + '</p>'); }
}
async function generate() {
  if (S.categories.some(c => c.drawn) && !(await confirmBox('Rigenerare le categorie cancella sorteggi e risultati già inseriti. Continuare?'))) return;
  const { categories, unassigned } = C.generateCategories(S.athletes, S.settings, S.tournament.date);
  S.categories = categories; S.unassigned = unassigned.map(a => a.id); S.bout = null; S.selCat = null;
  save(); show('categorie');
  if (unassigned.length) modal(`<h3>Atleti senza categoria</h3><p>${unassigned.length} atleti non rientrano in nessuna classe d'età (data di nascita mancante o età fuori dalle classi):</p><p class="small">${unassigned.map(a => esc(C.athleteName(a))).join(', ')}</p><p class="muted small">Correggili nella scheda Atleti e rigenera, oppure aggiungili a mano a una categoria.</p>`);
}
async function drawAll() {
  const todo = S.categories.filter(c => !c.drawn);
  if (!todo.length) { if (!(await confirmBox('Tutte le categorie sono già sorteggiate. Rifare il sorteggio di quelle senza incontri giocati?'))) return; }
  let n = 0;
  S.categories.forEach(c => { if (!c.drawn || !hasPlayed(c)) { C.drawCategory(c, byId, S.settings); n++; } });
  save(); render(); toast(n + ' categorie sorteggiate');
}
function hasPlayed(c) { return (c.matches || []).some(m => m.status === 'done' && !m.bye) || (c.kata && c.kata.rounds.some(r => r.entries.some(e => e.done))); }

// ---------------- ATLETI ----------------
let atlFilter = '';
function renderAtleti() {
  const date = S.tournament.date;
  const list = S.athletes.filter(a => !atlFilter || C.strip(C.athleteName(a) + ' ' + a.societa).includes(C.strip(atlFilter)));
  $('#tab-atleti').innerHTML = `
  <div class="row between"><h1>Atleti (${S.athletes.length})</h1><div class="row gap"><input type="text" id="aF" placeholder="Cerca…" value="${esc(atlFilter)}"><button id="aAdd" class="primary">+ Aggiungi atleta</button></div></div>
  <div class="card" style="padding:0;max-height:calc(100vh - 140px);overflow:auto">
  <table class="t"><thead><tr><th>Cognome</th><th>Nome</th><th>Sesso</th><th>Nascita</th><th>Età</th><th>Classe</th><th>Peso</th><th>Cintura</th><th>Società</th><th>Specialità</th><th>Stile</th><th></th></tr></thead><tbody>
  ${list.map(a => { const ac = C.ageClassOf(a, S.settings, date); return `<tr data-id="${a.id}"><td><b>${esc(a.cognome)}</b></td><td>${esc(a.nome)}</td><td>${a.sesso}</td><td>${esc(a.nascita)}</td><td>${C.ageAt(a.nascita, date) ?? '<span class="pill warn">?</span>'}</td><td>${ac ? esc(ac.name) : '<span class="pill warn">nessuna</span>'}</td><td>${a.peso ?? ''}</td><td>${esc(a.cintura)}</td><td>${esc(a.societa)}</td><td>${a.specialita.map(s => `<span class="pill ${s}">${s}</span>`).join(' ')}</td><td>${esc(a.stile)}</td><td><button class="small ghost" data-ed="${a.id}">✏️</button></td></tr>`; }).join('')}
  </tbody></table></div>`;
  $('#aF').oninput = e => { atlFilter = e.target.value; const p = e.target.selectionStart; renderAtleti(); const i = $('#aF'); i.focus(); i.setSelectionRange(p, p); };
  $('#aAdd').onclick = () => editAthlete(null);
  $$('[data-ed]').forEach(b => b.onclick = () => editAthlete(b.dataset.ed));
}
async function editAthlete(id) {
  const a = id ? byId[id] : { id: C.uid('a'), cognome: '', nome: '', sesso: 'M', nascita: '', peso: null, cintura: '', societa: '', specialita: ['kumite'], stile: '' };
  const r = await modal(`<h3>${id ? 'Modifica' : 'Nuovo'} atleta</h3><div class="grid2">
    <label class="f">Cognome<input type="text" id="eC" value="${esc(a.cognome)}"></label><label class="f">Nome<input type="text" id="eN" value="${esc(a.nome)}"></label>
    <label class="f">Sesso<select id="eS"><option ${a.sesso === 'M' ? 'selected' : ''}>M</option><option ${a.sesso === 'F' ? 'selected' : ''}>F</option></select></label>
    <label class="f">Data di nascita<input type="date" id="eD" value="${esc(a.nascita)}"></label>
    <label class="f">Peso (kg)<input type="number" step="0.1" id="eP" value="${a.peso ?? ''}"></label><label class="f">Cintura<input type="text" id="eB" value="${esc(a.cintura)}"></label>
    <label class="f">Società<input type="text" id="eSo" value="${esc(a.societa)}"></label><label class="f">Stile<input type="text" id="eSt" value="${esc(a.stile)}"></label>
    <label class="f">Specialità<span><label><input type="checkbox" id="eKa" ${a.specialita.includes('kata') ? 'checked' : ''}> Kata</label> &nbsp; <label><input type="checkbox" id="eKu" ${a.specialita.includes('kumite') ? 'checked' : ''}> Kumite</label></span></label></div>
    <p class="muted small">Dopo la modifica, rigenera le categorie oppure sposta l'atleta a mano nella scheda Categorie.</p>`,
    [...(id ? [{ label: '🗑 Elimina', value: 'del' }] : []), { label: 'Annulla', value: null }, {
      label: 'Salva', cls: 'primary', value: () => ({
        cognome: $('#eC').value.trim(), nome: $('#eN').value.trim(), sesso: $('#eS').value, nascita: $('#eD').value, peso: parseFloat($('#eP').value) || null,
        cintura: $('#eB').value.trim(), societa: $('#eSo').value.trim(), stile: $('#eSt').value.trim(), specialita: [$('#eKa').checked && 'kata', $('#eKu').checked && 'kumite'].filter(Boolean)
      })
    }]);
  if (!r) return;
  if (r === 'del') { if (!(await confirmBox('Eliminare ' + esc(C.athleteName(a)) + '?'))) return; S.athletes = S.athletes.filter(x => x.id !== id); S.categories.forEach(c => c.athleteIds = c.athleteIds.filter(x => x !== id)); }
  else { Object.assign(a, r); if (!id) S.athletes.push(a); }
  reindex(); save(); render();
}

// ---------------- CATEGORIE ----------------
let catFilter = 'tutte';
function catBadge(c) {
  const st = c.status === 'conclusa' ? 'ok' : c.status === 'in corso' ? 'run' : '';
  return `<span class="pill ${st}">${esc(c.status || '')}</span>`;
}
function formatLabel(c) {
  return ({ recupero: 'Eliminazione diretta con recupero', eliminazione: 'Eliminazione diretta (3° pari merito)', girone: "Girone all'italiana", finale: 'Finale diretta', unico: 'Atleta unico', 'kata-punteggio': 'Kata a punteggio', vuota: '—' })[c.format] || 'da sorteggiare';
}
function renderCategorie() {
  const list = S.categories.filter(c => catFilter === 'tutte' || c.discipline === catFilter || (catFilter === 'singoli' && c.athleteIds.length < 2));
  $('#tab-categorie').innerHTML = `
  <div class="row between"><h1>Categorie (${S.categories.length})</h1>
  <div class="row gap"><select id="cF"><option value="tutte">Tutte</option><option value="kata">Solo Kata</option><option value="kumite">Solo Kumite</option><option value="singoli">Con meno di 2 atleti</option></select>
  <button id="cNew">+ Nuova categoria</button><button id="cDrawAll" class="primary">🎲 Sorteggia tutte</button></div></div>
  ${S.categories.length ? '' : '<div class="hint">Importa gli atleti e premi “Genera categorie” nella scheda Torneo.</div>'}
  <div class="catlist">${list.map(c => `
    <div class="catrow ${c.athleteIds.length < 2 ? 'single' : ''}">
      <span class="num">#${c.num}</span>
      <span class="pill ${c.discipline}">${c.discipline}</span>
      <span class="nm"><b>${esc(c.name)}</b><br><span class="muted small">${c.athleteIds.length} atleti · ${formatLabel(c)}${c.tatami ? ' · Tatami ' + esc(c.tatami) : ''}</span></span>
      ${catBadge(c)}
      <button class="small" data-open="${c.id}">Apri</button>
      <button class="small" data-draw="${c.id}">🎲 Sorteggio</button>
      <button class="small" data-edit="${c.id}">✏️</button>
    </div>`).join('')}</div>`;
  $('#cF').value = catFilter; $('#cF').onchange = e => { catFilter = e.target.value; renderCategorie(); };
  $('#cDrawAll').onclick = drawAll;
  $('#cNew').onclick = () => editCategory(null);
  $$('[data-open]').forEach(b => b.onclick = () => { S.selCat = b.dataset.open; show('tabellone'); });
  $$('[data-draw]').forEach(b => b.onclick = async () => {
    const c = catById(b.dataset.draw);
    if (hasPlayed(c) && !(await confirmBox('Questa categoria ha già incontri giocati. Rifare il sorteggio cancella i risultati. Continuare?'))) return;
    C.drawCategory(c, byId, S.settings); save(); S.selCat = c.id; show('tabellone');
  });
  $$('[data-edit]').forEach(b => b.onclick = () => editCategory(b.dataset.edit));
}
async function editCategory(id) {
  const isNew = !id;
  const c = id ? catById(id) : { id: C.uid('c'), num: S.categories.length + 1, discipline: 'kumite', kumiteType: 'sanbon', sesso: 'M', ageClass: '', belt: '', name: 'Nuova categoria', athleteIds: [], status: 'da sorteggiare', kataFinal: 6 };
  const inCat = new Set(c.athleteIds);
  const candidates = S.athletes.slice().sort((a, b) => C.athleteName(a).localeCompare(C.athleteName(b)));
  const others = S.categories.filter(x => x.id !== c.id && x.discipline === c.discipline);
  const r = await modal(`<h3>${isNew ? 'Nuova categoria' : 'Categoria #' + c.num}</h3>
   <div class="grid2">
    <label class="f">Nome<input type="text" id="kN" value="${esc(c.name)}"></label>
    <label class="f">Specialità<select id="kD"><option value="kumite">Kumite</option><option value="kata">Kata</option></select></label>
    <label class="f">Tipo kumite<select id="kT"><option value="sanbon">Shobu Sanbon</option><option value="nihon">Shobu Nihon</option><option value="ippon">Shobu Ippon</option></select></label>
    <label class="f">Finalisti kata (punteggio)<input type="number" id="kF" value="${c.kataFinal || 6}" min="2" max="16"></label>
    <label class="f">Tatami assegnato (vuoto = questo PC)<input type="text" id="kTat" value="${esc(c.tatami || '')}"></label>
   </div>
   ${others.length && !isNew ? `<p><label class="f">Unisci con un'altra categoria (gli atleti vengono spostati qui)<select id="kM"><option value="">— nessuna —</option>${others.map(o => `<option value="${o.id}">#${o.num} ${esc(o.name)} (${o.athleteIds.length})</option>`).join('')}</select></label></p>` : ''}
   <h3>Atleti (${c.athleteIds.length})</h3>
   <input type="text" id="kQ" placeholder="Filtra…" style="width:100%;margin-bottom:6px">
   <div style="max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:6px" id="kL">
   ${candidates.map(a => `<label class="row gap small" data-q="${esc(C.strip(C.athleteName(a) + ' ' + a.societa))}" style="padding:2px 0"><input type="checkbox" value="${a.id}" ${inCat.has(a.id) ? 'checked' : ''}> ${esc(C.athleteName(a))} <span class="muted">· ${esc(a.societa)} · ${a.sesso} · ${C.ageAt(a.nascita, S.tournament.date) ?? '?'} anni · ${a.peso ?? '?'} kg · ${esc(a.cintura)}</span></label>`).join('')}
   </div>
   <p class="muted small">Se modifichi gli atleti di una categoria già sorteggiata, rifai il sorteggio.</p>`,
    [...(!isNew ? [{ label: '🗑 Elimina categoria', value: 'del' }] : []), { label: 'Annulla', value: null }, {
      label: 'Salva', cls: 'primary', value: () => ({
        tatami: $('#kTat').value.trim(), name: $('#kN').value, discipline: $('#kD').value, kumiteType: $('#kT').value, kataFinal: +$('#kF').value || 6,
        merge: $('#kM') ? $('#kM').value : '', ids: $$('#kL input:checked').map(i => i.value)
      })
    }]);
  if (!r) return;
  if (r === 'del') { if (await confirmBox('Eliminare la categoria?')) { S.categories = S.categories.filter(x => x.id !== c.id); renumber(); save(); render(); } return; }
  c.tatami = r.tatami; c.name = r.name; c.discipline = r.discipline; c.kumiteType = r.kumiteType; c.kataFinal = r.kataFinal;
  let ids = r.ids;
  if (r.merge) { const o = catById(r.merge); ids = [...new Set(ids.concat(o.athleteIds))]; S.categories = S.categories.filter(x => x.id !== o.id); toast('Categorie unite'); }
  const changed = ids.length !== c.athleteIds.length || ids.some(x => !inCat.has(x));
  c.athleteIds = ids;
  if (changed && c.drawn) { c.drawn = false; c.matches = []; c.kata = null; c.ranking = []; c.status = 'da sorteggiare'; c.format = null; }
  if (isNew) S.categories.push(c);
  renumber(); save(); render();
}
function renumber() { S.categories.forEach((c, i) => c.num = i + 1); }
// filtro elenco atleti nel modale
document.addEventListener('input', e => { if (e.target.id === 'kQ') { const q = C.strip(e.target.value); $$('#kL label').forEach(l => l.style.display = l.dataset.q.includes(q) ? '' : 'none'); } });

// ---------------- TABELLONE ----------------
function catSelect(selId, onlyDrawn) {
  return `<select id="${selId}" style="min-width:420px">${S.categories.filter(c => !onlyDrawn || c.drawn).map(c => `<option value="${c.id}" ${c.id === S.selCat ? 'selected' : ''}>#${c.num} ${esc(c.name)} (${c.athleteIds.length}) — ${esc(c.status)}</option>`).join('')}</select>`;
}
function renderTabellone() {
  if (!S.selCat || !catById(S.selCat)) S.selCat = (S.categories.find(c => c.drawn && c.status !== 'conclusa') || S.categories[0] || {}).id;
  const c = catById(S.selCat);
  let body = '';
  if (!c) body = '<div class="hint">Nessuna categoria.</div>';
  else if (!c.drawn) body = `<div class="hint">Categoria non ancora sorteggiata. <button class="primary small" id="tDraw">🎲 Sorteggia ora</button></div>`;
  else if (c.format === 'kata-punteggio') body = kataOverview(c);
  else if (c.format === 'girone') body = roundRobinView(c);
  else if (c.format === 'unico') body = `<div class="hint">Un solo atleta iscritto: <b>${esc(nameOf(c.athleteIds[0]))}</b> si classifica primo.</div>`;
  else body = bracketView(c);
  $('#tab-tabellone').innerHTML = `
    <div class="row between wrap gap"><h1>Tabellone</h1><div class="row gap">${catSelect('tCat')}<button id="tPrint">🖨 Stampa</button></div></div>
    ${c ? `<p class="muted"><span class="pill ${c.discipline}">${c.discipline}</span> ${formatLabel(c)} · ${c.athleteIds.length} atleti ${c.discipline === 'kumite' ? '· ' + C.KUMITE_LABEL[c.kumiteType] : ''} · ${catBadge(c)}</p>` : ''}
    <p class="muted small">Clicca su un incontro per caricarlo sul tabellone live.</p>
    ${body}
    ${c && c.ranking && c.ranking.length ? rankingBox(c) : ''}`;
  if ($('#tCat')) $('#tCat').onchange = e => { S.selCat = e.target.value; renderTabellone(); };
  if ($('#tDraw')) $('#tDraw').onclick = () => { C.drawCategory(c, byId, S.settings); save(); renderTabellone(); };
  $('#tPrint').onclick = () => window.print();
  $$('[data-m]').forEach(el => el.onclick = () => openMatch(c.id, el.dataset.m));
  $$('[data-k]').forEach(el => el.onclick = () => { S.kataSel = { catId: c.id }; show('incontro'); });
  $$('[data-tie]').forEach(el => el.onchange = () => { c.rrTie = c.rrTie || {}; c.rrTie[el.dataset.tie] = +el.value || 0; C.computeRanking(c); save(); renderTabellone(); });
}
function scoreTxt(m) { if (!m.result) return ['', '']; const r = m.result; if (r.decision === 'bye') return ['', '']; if (r.flags) return [r.flags.aka, r.flags.shiro]; const f = p => { const s = C.splitPts(p || 0); return s.ippon + '-' + s.wazaari; }; return [f(r.akaPts), f(r.shiroPts)]; }
function decTxt(m) { const d = m.result && m.result.decision; return d && d !== 'bye' && d !== 'punti' ? d : ''; }
function matchBox(m) {
  const [sa, ss] = scoreTxt(m);
  const cur = S.bout && S.bout.matchId === m.id;
  const side = (k, sc) => { const id = m[k]; return `<div class="s ${k} ${m.winner && m.winner === id ? 'win' : ''}"><span>${id ? esc(nameOf(id)) : (m.bye || (m.status === 'done') ? '<i class="muted">—</i>' : '<i class="muted">in attesa</i>')}<br><span class="club">${esc(clubOf(id))}</span></span><span class="sc">${sc}</span></div>`; };
  return `<div class="bm ${m.bye ? 'bye' : ''} ${cur ? 'cur' : ''}" ${m.aka && m.shiro ? `data-m="${m.id}"` : ''}>${side('aka', sa)}${side('shiro', ss)}${m.status === 'done' && !m.bye ? `<div class="meta">✓ ${esc(decTxt(m) || 'concluso')}${m.draw ? ' · Hikiwake' : ''}</div>` : (m.aka && m.shiro ? '<div class="meta">▶ da disputare</div>' : '')}</div>`;
}
function bracketView(c) {
  const main = c.matches.filter(m => m.type === 'main');
  const rounds = [...new Set(main.map(m => m.round))].sort((a, b) => a - b);
  let h = '<div class="bracket">' + rounds.map(r => { const ms = main.filter(m => m.round === r).sort((a, b) => a.idx - b.idx); return `<div class="bcol"><h4>${esc(ms[0].roundName)}</h4><div class="bin">${ms.map(matchBox).join('')}</div></div>`; }).join('') + '</div>';
  const rep = c.matches.filter(m => m.type === 'rep');
  if (c.format === 'recupero') {
    h += '<h2>Recuperi</h2>';
    if (!rep.length && !(c.repBronze && (c.repBronze.A || c.repBronze.B))) h += '<p class="muted small">I recuperi si creano automaticamente quando sono noti i due finalisti (ripescati gli atleti battuti da ciascun finalista).</p>';
    else h += '<div class="bracket">' + ['A', 'B'].map(g => { const ms = rep.filter(m => m.group === g).sort((a, b) => a.round - b.round); const direct = c.repBronze && c.repBronze[g]; return `<div class="bcol"><h4>Recupero ${g}</h4>${ms.map(matchBox).join('')}${direct ? `<div class="hint small">Bronzo diretto: <b>${esc(nameOf(direct))}</b></div>` : ''}${!ms.length && !direct ? '<span class="muted small">nessun ripescato</span>' : ''}</div>`; }).join('') + '</div>';
  }
  return h;
}
function roundRobinView(c) {
  const st = C.rrStandings(c);
  return `<div class="grid2"><div><h3>Incontri</h3><div class="bcol">${c.matches.map(matchBox).join('')}</div></div>
   <div><h3>Classifica girone</h3><table class="t"><tr><th>#</th><th>Atleta</th><th>V</th><th>P</th><th>S</th><th>Punti</th><th title="Spareggio manuale: 1 = davanti">Spar.</th></tr>
   ${st.map(s => `<tr><td>${s.pos}</td><td><b>${esc(nameOf(s.id))}</b><br><span class="muted small">${esc(clubOf(s.id))}</span></td><td>${s.v}</td><td>${s.p}</td><td>${s.s}</td><td><b>${s.pts}</b></td><td><input type="number" style="width:52px" data-tie="${s.id}" value="${(c.rrTie || {})[s.id] || ''}"></td></tr>`).join('')}</table>
   <p class="muted small">2 punti vittoria, 1 pareggio. Parità: scontro diretto, poi somma punti segnati; se serve, disputa uno spareggio e indica l'ordine nella colonna “Spar.”.</p></div></div>`;
}
function kataOverview(c) {
  const k = c.kata;
  return `<div class="row gap wrap">${k.rounds.map((r, i) => `<div class="card" style="min-width:260px"><h3>${esc(r.name)} ${i === k.current && c.status !== 'conclusa' ? '<span class="pill run">in corso</span>' : r.closed ? '<span class="pill ok">chiuso</span>' : ''}</h3>
   <div class="muted small">Scala ${r.scale ? r.scale[0].toFixed(1) + '–' + r.scale[1].toFixed(1) : ''} ${r.take ? '· passano ' + r.take : ''}</div>
   ${C.kataRoundRanking(r).map((e, j) => `<div class="entry"><b>${j + 1}.</b> ${esc(nameOf(e.id))}<span class="tot">${e.dq ? 'SQ' : e.total.toFixed(1)}</span></div>`).join('')}
   ${r.entries.filter(e => !e.done).map(e => `<div class="entry muted">${esc(nameOf(e.id))}<span class="tot">—</span></div>`).join('')}
   </div>`).join('')}</div><button class="primary" data-k="1">⏱ Vai alla gestione punteggi Kata</button>`;
}
function rankingBox(c) {
  const medal = p => p === 1 ? '🥇' : p === 2 ? '🥈' : p === 3 ? '🥉' : p + '°';
  return `<div class="card"><h3>Classifica ${c.status === 'conclusa' ? 'finale' : 'provvisoria'}</h3>${c.ranking.map(r => `<div class="entry">${medal(r.pos)} <b>${esc(nameOf(r.id))}</b> <span class="muted">${esc(clubOf(r.id))}</span><span class="tot muted small">${esc(r.note || '')}</span></div>`).join('')}</div>`;
}

// ---------------- INCONTRO LIVE ----------------
let tickHandle = null, lastTick = 0;
function openMatch(catId, matchId) {
  const c = catById(catId), m = C.getMatch(c, matchId);
  if (S.bout && S.bout.running) { toast('Ferma prima il tempo dell\'incontro in corso'); return; }
  if (m.status === 'done' && !m.bye) {
    confirmBox('Incontro già concluso. Vuoi annullare il risultato e rigiocarlo?').then(ok => {
      if (!ok) return; if (!C.resetMatch(c, m)) { toast('Impossibile: il turno successivo è già stato giocato'); return; }
      save(); openMatch(catId, matchId);
    });
    return;
  }
  if (S.graphics && S.graphics.onAir) { S.graphics.onAir = null; updateOnAir(); toast('Grafica tolta dal tabellone: si torna alle gare'); }
  S.bout = C.newBout(c, m, S.settings, byId); S.kataSel = null; S.selCat = c.id; S.showRanking = null; undoStack = [];
  save(); show('incontro'); pushBoard(); publishLive(true);
}
function renderIncontro() {
  const el = $('#tab-incontro');
  if (S.kataSel && catById(S.kataSel.catId) && catById(S.kataSel.catId).format === 'kata-punteggio') return renderKataPanel(el);
  const b = S.bout;
  if (!b) {
    const next = nextMatches(8);
    el.innerHTML = `<h1>Incontro live</h1><div class="hint">Nessun incontro caricato. Scegline uno dal Tabellone, oppure dai prossimi qui sotto.</div>
     <h2>Prossimi incontri</h2>${next.length ? next.map(n => `<div class="catrow"><span class="pill ${n.c.discipline}">${n.c.discipline}</span><span class="nm"><b>${esc(nameOf(n.m.aka))}</b> vs <b>${esc(nameOf(n.m.shiro))}</b><br><span class="muted small">#${n.c.num} ${esc(n.c.name)} · ${esc(n.m.roundName)}</span></span><button class="primary small" data-go="${n.c.id}|${n.m.id}">Carica</button></div>`).join('') : '<p class="muted">Nessun incontro da disputare.</p>'}
     ${kataPending().map(c => `<div class="catrow"><span class="pill kata">kata</span><span class="nm"><b>#${c.num} ${esc(c.name)}</b><br><span class="muted small">Kata a punteggio · ${esc(c.kata.rounds[c.kata.current].name)}</span></span><button class="primary small" data-kata="${c.id}">Gestisci</button></div>`).join('')}`;
    $$('[data-go]').forEach(x => x.onclick = () => { const [ci, mi] = x.dataset.go.split('|'); openMatch(ci, mi); });
    $$('[data-kata]').forEach(x => x.onclick = () => { S.kataSel = { catId: x.dataset.kata }; renderIncontro(); pushBoard(); publishLive(true); });
    return;
  }
  const c = catById(b.catId), m = C.getMatch(c, b.matchId);
  if (b.kind === 'flags') return renderFlagsPanel(el, b, c, m);
  const sidePanel = (k) => {
    const s = b[k], sp = C.splitPts(s.pts);
    return `<div class="side-panel ${k}">
      <div class="nm">${k === 'aka' ? 'AKA' : 'SHIRO'} · ${esc(nameOf(m[k]))}</div><div class="club">${esc(clubOf(m[k]))}</div>
      <div class="score-big">${sp.ippon} - ${sp.wazaari}</div><div class="score-lbl">IPPON - WAZA-ARI (${s.pts} wazaari)</div>
      <div class="btns"><button data-a="${k}:waza">+ Waza-ari</button><button data-a="${k}:ippon">+ Ippon</button></div>
      <div class="btns"><button data-a="${k}:minus">− 1 Waza-ari</button><button data-a="${k}:jogai">Jogai (${s.jogai})</button></div>
      <div class="btns"><button data-a="${k}:atenai">Atenai (${s.atenai})</button><button data-a="${k}:mubobi">Mubobi (${s.mubobi || 0})</button></div>
      <div class="btns"><button data-a="${k}:penminus">− 1 penalità…</button><button data-a="${k}:clearpen">Azzera penalità</button></div>
      <div class="btns"><button data-a="${k}:kiken">Kiken (ritiro)</button><button data-a="${k}:win">Vince ${k === 'aka' ? 'AKA' : 'SHIRO'}</button></div>
      <div class="pen"><span class="${s.jogai ? 'on' : ''}">Jogai ${s.jogai}</span><span class="${s.atenai ? 'on' : ''}">Atenai ${s.atenai}</span><span class="${s.mubobi ? 'on' : ''}">Mubobi ${s.mubobi || 0}</span></div>
    </div>`;
  };
  const t = b.timeLeft, cls = t <= 0 ? 'end' : t <= 30000 ? 'warn' : '';
  const banner = b.confirmed ? `<div class="banner win">✓ Risultato registrato: vince ${b.winner === 'draw' ? 'Hikiwake' : (b.winner === 'aka' ? 'AKA ' : 'SHIRO ') + esc(nameOf(m[b.winner]))}. Si passa al prossimo incontro… <button class="small" id="bNext2">Prossimo ▶</button></div>`
    : b.winner ? `<div class="banner win">🏁 Vince ${b.winner === 'draw' ? '— Hikiwake (pareggio)' : (b.winner === 'aka' ? 'AKA ' : 'SHIRO ') + esc(nameOf(m[b.winner]))} · ${esc(b.decision || '')} <button class="small" id="bConfirm">✔ Conferma e registra</button> <button class="small" id="bUndoWin">Annulla</button></div>`
    : b.phase !== 'regolare' ? `<div class="banner">${b.phase === 'encho' ? 'ENCHO-SEN: vince il primo punto valido' : 'SAI SHIAI: nuovo incontro'}</div>` : '';
  el.innerHTML = `
   <div class="row between"><h1>#${c.num} ${esc(c.name)}</h1><span class="muted">${esc(m.roundName || '')} · ${C.KUMITE_LABEL[b.type]} · Tatami ${esc(S.tournament.tatami)}</span></div>
   ${banner}
   <div class="bout">
     ${sidePanel('aka')}
     <div class="center">
       <div class="clock ${cls}" id="clk">${fmtTime(t)}</div>
       <div class="muted small" style="color:#9ca3af">${b.phase === 'regolare' ? 'Tempo regolamentare ' + fmtTime(b.duration) : b.phase.toUpperCase()}</div>
       <button class="${b.running ? 'stop' : 'go'} wide" id="bStart" style="margin-top:10px">${b.running ? '⏸ YAME (ferma)' : '▶ HAJIME (via)'}</button>
       <div class="btns" style="margin-top:8px"><button id="bM10">−10"</button><button id="bP10">+10"</button><button id="bM1">−1"</button><button id="bP1">+1"</button></div>
       <div class="btns"><button id="bSetT">Imposta tempo</button><button id="bResetT">Azzera tempo</button></div>
       <div class="btns"><button id="bHantei">Hantei…</button><button id="bDraw">Hikiwake</button></div>
       <div class="btns"><button id="bEncho">Encho-sen</button><button id="bSai">Sai Shiai</button></div>
       <div class="btns"><button id="bClose">Chiudi incontro</button><button id="bNext">Prossimo ▶</button></div>
       <div class="keys"><kbd>Spazio</kbd> hajime/yame · AKA: <kbd>Q</kbd> waza <kbd>W</kbd> ippon <kbd>A</kbd> −1 <kbd>Z</kbd> jogai <kbd>X</kbd> atenai <kbd>C</kbd> mubobi · SHIRO: <kbd>O</kbd> waza <kbd>P</kbd> ippon <kbd>L</kbd> −1 <kbd>M</kbd> jogai <kbd>N</kbd> atenai <kbd>B</kbd> mubobi · <kbd>Ctrl+Z</kbd> annulla</div>
     </div>
     ${sidePanel('shiro')}
   </div>`;
  $$('[data-a]').forEach(x => x.onclick = () => { const [k, a] = x.dataset.a.split(':'); boutAction(k, a); });
  $('#bStart').onclick = toggleClock;
  $('#bM10').onclick = () => adjTime(-10000); $('#bP10').onclick = () => adjTime(10000); $('#bM1').onclick = () => adjTime(-1000); $('#bP1').onclick = () => adjTime(1000);
  $('#bResetT').onclick = () => { snapshot(); b.timeLeft = b.phase === 'encho' ? S.settings.durations.encho * 1000 : b.duration; b.atoshi = false; changed(); };
  $('#bSetT').onclick = async () => { const v = await modal('<h3>Imposta tempo</h3><label class="f">Minuti:secondi<input type="text" id="tv" value="' + fmtTime(b.timeLeft) + '"></label>', [{ label: 'Annulla', value: null }, { label: 'OK', cls: 'primary', value: () => $('#tv').value }]); if (v) { const [mm, ss] = v.split(':').map(Number); snapshot(); b.timeLeft = ((mm || 0) * 60 + (ss || 0)) * 1000; changed(); } };
  $('#bHantei').onclick = hanteiDialog;
  $('#bDraw').onclick = () => { snapshot(); stopClock(); b.winner = 'draw'; b.decision = 'hikiwake'; changed(); };
  $('#bEncho').onclick = startEncho; $('#bSai').onclick = startSai;
  $('#bClose').onclick = async () => { if (await confirmBox('Chiudere l\'incontro senza registrare il risultato?')) { stopClock(); S.bout = null; save(); render(); pushBoard(); publishLive(true); } };
  $('#bNext').onclick = loadNext;
  if ($('#bConfirm')) $('#bConfirm').onclick = confirmResult;
  if ($('#bNext2')) $('#bNext2').onclick = loadNext;
  if ($('#bUndoWin')) $('#bUndoWin').onclick = () => { snapshot(); b.winner = null; b.decision = null; changed(); };
}
function fmtTime(ms) { ms = Math.max(0, ms); const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function nextMatches(n) {
  const out = [];
  S.categories.filter(c => c.drawn && c.matches).forEach(c => c.matches.filter(m => m.status === 'pending' && m.aka && m.shiro).sort((a, b) => (a.type === 'rep') - (b.type === 'rep') || a.round - b.round || a.idx - b.idx).forEach(m => out.push({ c, m })));
  return out.slice(0, n);
}
function kataPending() { return S.categories.filter(c => c.format === 'kata-punteggio' && c.status !== 'conclusa'); }
async function loadNext() {
  if (S.bout && S.bout.running) { toast('Ferma prima il tempo'); return; }
  if (S.bout && S.bout.winner && !S.bout.confirmed && !(await confirmBox('Il risultato non è stato registrato. Passare comunque al prossimo?'))) return;
  const cur = S.bout && catById(S.bout.catId);
  let list = nextMatches(200);
  const same = cur ? list.find(x => x.c.id === cur.id && x.m.id !== S.bout.matchId) : null;
  const nx = same || list.find(x => !S.bout || x.m.id !== S.bout.matchId);
  if (!nx) { S.bout = null; save(); render(); pushBoard(); toast('Nessun altro incontro da disputare'); return; }
  S.bout = null; openMatch(nx.c.id, nx.m.id);
}
// --- undo ---
let undoStack = [];
function snapshot() { if (S.bout) { undoStack.push(JSON.stringify(S.bout)); if (undoStack.length > 60) undoStack.shift(); } }
function undo() { if (!undoStack.length || !S.bout) return; const run = S.bout.running; const prev = JSON.parse(undoStack.pop()); prev.running = run; prev.timeLeft = S.bout.timeLeft; S.bout = prev; changed(); toast('Annullato'); }
function changed() { save(true); if (curTab === 'incontro') renderIncontro(); pushBoard(); publishLive(); }

function boutAction(k, a) {
  const b = S.bout; if (!b) return;
  if (b.confirmed) { toast('Risultato già registrato'); return; }
  if (b.winner && !['minus', 'clearpen'].includes(a)) { toast('Incontro già deciso: conferma il risultato o annulla'); return; }
  snapshot();
  const s = b[k]; let msg = '';
  switch (a) {
    case 'waza': s.pts += 1; break;
    case 'ippon': s.pts += 2; break;
    case 'minus': s.pts = Math.max(0, s.pts - 1); b.winner = null; break;
    case 'jogai': s.jogai++; break;
    case 'atenai': s.atenai = (s.atenai || 0) + 1; break;
    case 'mubobi': s.mubobi = (s.mubobi || 0) + 1; break;
    case 'penminus': penMinus(k); return;
    case 'kiken': s.kiken = !s.kiken; break;
    case 'clearpen': s.atenai = 0; s.jogai = 0; s.mubobi = 0; s.chui = 0; s.hansoku = false; s.kiken = false; b.winner = null; break;
    case 'win': stopClock(); b.winner = k; b.decision = 'decisione arbitrale'; break;
  }
  if (msg) toast((k === 'aka' ? 'AKA: ' : 'SHIRO: ') + msg);
  const chk = C.boutCheck(b);
  if (chk && !b.winner) { stopClock(); b.winner = chk.winner; b.decision = chk.decision; beep('end'); }
  changed();
}
async function penMinus(k) {
  const b = S.bout, s = b[k];
  const v = await modal('<h3>Togli una penalità a ' + (k === 'aka' ? 'AKA' : 'SHIRO') + '</h3>', [{ label: 'Annulla', value: null }, { label: 'Jogai (' + s.jogai + ')', value: 'jogai' }, { label: 'Atenai (' + s.atenai + ')', value: 'atenai' }, { label: 'Mubobi (' + (s.mubobi || 0) + ')', value: 'mubobi' }]);
  if (!v) return; snapshot(); s[v] = Math.max(0, (s[v] || 0) - 1); changed();
}
function adjTime(d) { const b = S.bout; if (!b) return; snapshot(); b.timeLeft = Math.max(0, b.timeLeft + d); if (b.timeLeft > 30000) b.atoshi = false; changed(); }
function toggleClock() { const b = S.bout; if (!b || b.winner) return; if (b.running) stopClock(); else startClock(); changed(); }
function startClock() {
  const b = S.bout; if (!b || b.timeLeft <= 0) return;
  b.running = true; lastTick = performance.now();
  clearInterval(tickHandle);
  tickHandle = setInterval(tick, 100);
}
function stopClock() { if (S.bout) S.bout.running = false; clearInterval(tickHandle); tickHandle = null; }
let lastPushSec = -1;
function tick() {
  const b = S.bout; if (!b || !b.running) { clearInterval(tickHandle); return; }
  const now = performance.now(); b.timeLeft = Math.max(0, b.timeLeft - (now - lastTick)); lastTick = now;
  if (!b.atoshi && b.timeLeft <= 30000 && b.phase === 'regolare' && b.duration > 30000) { b.atoshi = true; beep('atoshi'); toast('ATOSHI BARAKU — 30 secondi'); }
  const clk = $('#clk'); if (clk) { clk.textContent = fmtTime(b.timeLeft); clk.className = 'clock ' + (b.timeLeft <= 0 ? 'end' : b.timeLeft <= 30000 ? 'warn' : ''); }
  pushBoard();
  const sec = Math.ceil(b.timeLeft / 1000); if (sec !== lastPushSec) { lastPushSec = sec; publishLive(); }
  if (b.timeLeft <= 0) { stopClock(); beep('end'); timeUp(); }
}
async function timeUp() {
  const b = S.bout; const c = catById(b.catId);
  const r = C.boutTimeUp(b, c.format === 'girone');
  if (r.action === 'win') { b.winner = r.winner; b.decision = 'punti'; changed(); return; }
  changed();
  const opts = { encho: [{ label: 'Hantei', value: 'hantei' }, { label: 'Avvia Encho-sen', value: 'encho', cls: 'primary' }], sai: [{ label: 'Hantei', value: 'hantei' }, { label: 'Avvia Sai Shiai', value: 'sai', cls: 'primary' }], hikiwake: [{ label: 'Hantei', value: 'hantei' }, { label: 'Hikiwake', value: 'draw', cls: 'primary' }], hantei: [{ label: 'Chiudi', value: null }, { label: 'Hantei', value: 'hantei', cls: 'primary' }] }[r.action];
  const v = await modal('<h3>Tempo scaduto</h3><p>' + esc(r.msg) + '</p>', opts);
  if (v === 'encho') startEncho(); else if (v === 'sai') startSai(); else if (v === 'hantei') hanteiDialog(r.suggest); else if (v === 'draw') { b.winner = 'draw'; b.decision = 'hikiwake'; changed(); }
}
function startEncho() { const b = S.bout; snapshot(); stopClock(); b.phase = 'encho'; b.enchoBase = { aka: b.aka.pts, shiro: b.shiro.pts }; b.timeLeft = S.settings.durations.encho * 1000; b.winner = null; b.decision = null; changed(); }
function startSai() { const b = S.bout; snapshot(); stopClock(); b.phase = 'sai'; b.aka.pts = 0; b.shiro.pts = 0; b.timeLeft = b.duration; b.atoshi = false; b.winner = null; b.decision = null; changed(); }
async function hanteiDialog(suggest) {
  const b = S.bout; const m = C.getMatch(catById(b.catId), b.matchId);
  const v = await modal(`<h3>Hantei — decisione arbitrale</h3><p>Arbitro e giudici votano con le bandierine. Indica il vincitore della maggioranza.${suggest ? '<br><span class="muted small">Atleta in vantaggio: ' + (suggest === 'aka' ? 'AKA' : 'SHIRO') + '</span>' : ''}</p>`,
    [{ label: 'Annulla', value: null }, { label: '🔴 AKA ' + nameOf(m.aka), value: 'aka', cls: 'primary' }, { label: '⚪ SHIRO ' + nameOf(m.shiro), value: 'shiro', cls: 'blue' }]);
  if (!v) return; snapshot(); stopClock(); b.winner = v; b.decision = 'hantei'; changed();
}
function confirmResult() {
  const b = S.bout; if (!b || b.confirmed) return; const c = catById(b.catId), m = C.getMatch(c, b.matchId);
  const result = { decision: b.decision, akaPts: b.aka.pts, shiroPts: b.shiro.pts, pen: { aka: b.aka, shiro: b.shiro }, flags: b.kind === 'flags' ? b.flags : undefined };
  C.finishMatch(c, m, b.winner, result);
  stopClock(); undoStack = [];
  S.lastResult = { catId: c.id, matchId: m.id };
  const done = c.status === 'conclusa';
  save();
  toast(done ? 'Categoria conclusa!' : 'Risultato registrato');
  S.bout = Object.assign({}, b, { confirmed: true });
  pushBoard(); publishLive(true);
  if (done) { setTimeout(() => { S.bout = null; S.showRanking = c.id; pushBoard(); publishLive(true); save(); render(); }, 2500); }
  render();
  if (!done) setTimeout(() => { if (S.bout && S.bout.confirmed) loadNext(); }, 2500);
}
function renderFlagsPanel(el, b, c, m) {
  const n = S.settings.kataJudges || 5;
  el.innerHTML = `<div class="row between"><h1>#${c.num} ${esc(c.name)}</h1><span class="muted">${esc(m.roundName)} · Kata a bandierine (${n} giudici)</span></div>
   ${b.winner ? `<div class="banner win">🏁 Vince ${b.winner === 'aka' ? 'AKA' : 'SHIRO'} ${esc(nameOf(m[b.winner]))} (${b.flags.aka}-${b.flags.shiro}) <button class="small" id="bConfirm">✔ Conferma e registra</button> <button class="small" id="bUndoWin">Annulla</button></div>` : ''}
   <div class="grid2">
    <div class="side-panel aka"><div class="nm">AKA · ${esc(nameOf(m.aka))}</div><div class="club">${esc(clubOf(m.aka))}</div><div class="score-big">${b.flags.aka}</div><div class="score-lbl">bandierine</div></div>
    <div class="side-panel shiro"><div class="nm">SHIRO · ${esc(nameOf(m.shiro))}</div><div class="club">${esc(clubOf(m.shiro))}</div><div class="score-big">${b.flags.shiro}</div><div class="score-lbl">bandierine</div></div>
   </div>
   <div class="card"><h3>Esito delle bandierine</h3><div class="row gap wrap">${Array.from({ length: n + 1 }, (_, i) => `<button data-fl="${n - i}">AKA ${n - i} – ${i} SHIRO</button>`).join('')}</div>
   <div class="row gap" style="margin-top:10px"><button id="bShowFl" class="primary">📺 Mostra sul tabellone</button><button id="bNext">Prossimo ▶</button><button id="bClose">Chiudi</button></div></div>`;
  $$('[data-fl]').forEach(x => x.onclick = () => { const a = +x.dataset.fl; b.flags = { aka: a, shiro: n - a }; b.flagsShown = false; b.winner = null; changed(); });
  $('#bShowFl').onclick = () => { if (b.flags.aka === b.flags.shiro) { toast('Serve una maggioranza'); return; } b.flagsShown = true; b.winner = b.flags.aka > b.flags.shiro ? 'aka' : 'shiro'; b.decision = 'bandierine ' + b.flags.aka + '-' + b.flags.shiro; changed(); };
  $('#bNext').onclick = loadNext;
  $('#bClose').onclick = () => { S.bout = null; save(); render(); pushBoard(); };
  if ($('#bConfirm')) $('#bConfirm').onclick = confirmResult;
  if ($('#bUndoWin')) $('#bUndoWin').onclick = () => { b.winner = null; b.flagsShown = false; changed(); };
}

// --- Kata a punteggio ---
function renderKataPanel(el) {
  const c = catById(S.kataSel.catId), k = c.kata, r = k.rounds[k.current], n = k.judges;
  const sel = S.kataSel.idx != null ? r.entries[S.kataSel.idx] : null;
  const ev = sel ? C.kataEval(sel.scores) : null;
  const sorted = sel ? sel.scores.map((v, i) => ({ v: +v, i })).filter(x => !isNaN(x.v)).sort((a, b) => a.v - b.v) : [];
  const excl = sorted.length >= 3 ? [sorted[0].i, sorted[sorted.length - 1].i] : [];
  el.innerHTML = `<div class="row between"><h1>#${c.num} ${esc(c.name)}</h1><div class="row gap"><span class="muted">Kata a punteggio · ${n} giudici</span><button id="kBack">← Esci</button></div></div>
   <div class="row gap wrap" style="margin-bottom:10px">${k.rounds.map((x, i) => `<span class="pill ${i === k.current ? 'run' : x.closed ? 'ok' : ''}">${esc(x.name)} ${x.entries.length ? '(' + x.entries.length + ')' : ''}</span>`).join(' → ')}</div>
   ${c.status === 'conclusa' ? '<div class="banner win">Categoria conclusa. Vedi classifica.</div>' + rankingBox(c) : `
   <div class="grid2">
    <div class="card" style="padding:0"><div style="padding:12px 14px"><b>${esc(r.name)}</b> <span class="muted small">scala ${r.scale[0].toFixed(1)}–${r.scale[1].toFixed(1)} ${r.take ? '· passano i primi ' + r.take : ''}</span></div>
     ${r.entries.map((e, i) => `<div class="entry ${S.kataSel.idx === i ? 'sel' : ''}" data-e="${i}"><b>${i + 1}</b> ${esc(nameOf(e.id))} <span class="muted small">${esc(clubOf(e.id))}</span><span class="tot">${e.done ? (e.dq ? 'SQ' : C.kataEval(e.scores).total.toFixed(1)) : '—'}</span></div>`).join('')}
     <div style="padding:12px"><button class="primary" id="kAdv">${k.current === k.rounds.length - 1 ? '🏁 Chiudi finale e classifica' : '➡ Chiudi turno e passa a ' + esc(k.rounds[k.current + 1].name)}</button></div>
    </div>
    <div class="card">${sel ? `<h3>${esc(nameOf(sel.id))} <span class="muted small">${esc(clubOf(sel.id))}</span></h3>
      <div class="kata-scores">${Array.from({ length: n }, (_, i) => `<input type="number" step="0.1" min="0" max="10" data-j="${i}" class="${excl.includes(i) ? 'x' : ''}" value="${sel.scores[i] ?? ''}" placeholder="G${i + 1}">`).join('')}</div>
      <p>Totale (scartati il più alto e il più basso): <b style="font-size:22px">${ev.total.toFixed(1)}</b> <span class="muted small">spareggio: ${ev.tb1.toFixed(1)} / ${ev.tb2.toFixed(1)}</span></p>
      <div class="row gap wrap"><button class="primary" id="kSave">✔ Registra e mostra</button><button id="kShowAth">📺 Mostra atleta</button><button id="kDQ">Squalifica (0.0)</button><button id="kClr">Azzera</button></div>
      <p class="muted small">Penalità tipiche: esitazione 0.1 · pausa 0.2 · perdita equilibrio 0.1–0.2 · movimento non eseguito 0.3 (applicate dai giudici nel voto).</p>`
      : '<p class="muted">Seleziona un atleta a sinistra per inserire i voti.</p>'}</div>
   </div>`}`;
  $('#kBack').onclick = () => { S.kataSel = null; render(); pushBoard(); };
  $$('[data-e]').forEach(x => x.onclick = () => { S.kataSel.idx = +x.dataset.e; S.kataSel.show = 'athlete'; renderKataPanel(el); pushBoard(); publishLive(true); setTimeout(() => { const i = $('[data-j="0"]'); i && i.focus(); }, 30); });
  $$('[data-j]').forEach(inp => {
    inp.onchange = () => { sel.scores[+inp.dataset.j] = inp.value === '' ? undefined : +(+inp.value).toFixed(1); renderKataPanel(el); const nx = $(`[data-j="${+inp.dataset.j + 1}"]`); if (nx) nx.focus(); };
    inp.onkeydown = e => { if (e.key === 'Enter') inp.blur(); };
  });
  if ($('#kSave')) $('#kSave').onclick = () => {
    const vals = sel.scores.slice(0, n).filter(v => v != null && !isNaN(v));
    if (vals.length < n) { toast('Inserisci tutti i ' + n + ' voti'); return; }
    if (vals.some(v => v < r.scale[0] - 0.001 || v > r.scale[1] + 0.001) && !confirm('Alcuni voti sono fuori dalla scala ' + r.scale.join('–') + '. Registrare comunque?')) return;
    sel.done = true; sel.dq = false; S.kataSel.show = 'score'; save(); renderKataPanel(el); pushBoard(); publishLive(true);
  };
  if ($('#kShowAth')) $('#kShowAth').onclick = () => { S.kataSel.show = 'athlete'; pushBoard(); publishLive(true); };
  if ($('#kDQ')) $('#kDQ').onclick = async () => { if (await confirmBox('Squalificare l\'atleta (punteggio 0.0)?')) { sel.dq = true; sel.done = true; sel.scores = Array(n).fill(0); S.kataSel.show = 'score'; save(); renderKataPanel(el); pushBoard(); } };
  if ($('#kClr')) $('#kClr').onclick = () => { sel.scores = []; sel.done = false; sel.dq = false; save(); renderKataPanel(el); };
  if ($('#kAdv')) $('#kAdv').onclick = async () => {
    const res = C.kataAdvance(c);
    if (!res.ok) { toast(res.msg); return; }
    publishAllDebounced();
    S.kataSel.idx = null; save(); renderKataPanel(el);
    if (res.finished) { S.showRanking = c.id; S.kataSel = null; pushBoard(); publishLive(true); render(); toast('Classifica pronta'); }
  };
}

// --- scorciatoie da tastiera ---
document.addEventListener('keydown', e => {
  if (curTab !== 'incontro' || !S.bout || S.bout.kind !== 'kumite') return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
  if (!$('#modal').classList.contains('hidden')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { undo(); e.preventDefault(); return; }
  const map = { q: ['aka', 'waza'], w: ['aka', 'ippon'], a: ['aka', 'minus'], z: ['aka', 'jogai'], x: ['aka', 'atenai'], c: ['aka', 'mubobi'], o: ['shiro', 'waza'], p: ['shiro', 'ippon'], l: ['shiro', 'minus'], m: ['shiro', 'jogai'], n: ['shiro', 'atenai'], b: ['shiro', 'mubobi'] };
  if (e.code === 'Space') { toggleClock(); e.preventDefault(); return; }
  const k = map[e.key.toLowerCase()]; if (k) { boutAction(k[0], k[1]); e.preventDefault(); }
});

// ---------------- tabellone TV ----------------
let beepSeq = 0, lastBeep = null;
function beep(kind) { beepSeq++; lastBeep = { id: beepSeq, kind }; localBeep(kind); }
let actx = null;
function localBeep(kind) {
  try {
    actx = actx || new AudioContext();
    const pattern = kind === 'end' ? [0, 0.45] : [0];
    pattern.forEach(t0 => { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'square'; o.frequency.value = kind === 'end' ? 880 : 660; g.gain.value = 0.08; o.connect(g); g.connect(actx.destination); o.start(actx.currentTime + t0); o.stop(actx.currentTime + t0 + 0.32); });
  } catch (e) { }
}
function infoData(item) {
  const G = S.graphics;
  return { title: item.title, subtitle: item.subtitle, text: item.text, kicker: item.kicker, figure: item.figure, custom: item.custom || null, qrUrl: item.qrUrl || null, theme: item.theme, animate: item.animate !== false,
    program: G.program, current: G.current, showProgram: !!G.showProgram, tournament: S.tournament.name, tatami: S.tournament.tatami };
}
function boardData() {
  const base = { tournament: S.tournament.name, tatami: S.tournament.tatami, beep: lastBeep };
  const G = S.graphics; const air = G && G.onAir && G.items.find(x => x.id === G.onAir);
  if (air) return Object.assign(base, { mode: 'info', info: infoData(air) });
  if (S.kataSel && catById(S.kataSel.catId) && catById(S.kataSel.catId).format === 'kata-punteggio') {
    const c = catById(S.kataSel.catId), k = c.kata, r = k.rounds[k.current], e = S.kataSel.idx != null ? r.entries[S.kataSel.idx] : null;
    if (e) {
      const ev = C.kataEval(e.scores || []);
      const sorted = (e.scores || []).map((v, i) => ({ v: +v, i })).filter(x => !isNaN(x.v)).sort((a, b) => a.v - b.v);
      return Object.assign(base, { mode: 'kata', category: c.name, round: r.name, athlete: nameOf(e.id), club: clubOf(e.id), belt: (byId[e.id] || {}).cintura || '', show: S.kataSel.show, scores: e.done ? e.scores : [], excluded: e.done && sorted.length >= 3 ? [sorted[0].i, sorted[sorted.length - 1].i] : [], total: e.done ? (e.dq ? 0 : ev.total) : null, dq: !!e.dq, judges: k.judges, rank: C.kataRoundRanking(r).slice(0, 8).map(x => ({ n: nameOf(x.id), t: x.dq ? 0 : x.total })) });
    }
    return Object.assign(base, { mode: 'kataList', category: c.name, round: r.name, rank: C.kataRoundRanking(r).map(x => ({ n: nameOf(x.id), c: clubOf(x.id), t: x.total })), waiting: r.entries.filter(x => !x.done).map(x => nameOf(x.id)) });
  }
  if (S.bout) {
    const b = S.bout, c = catById(b.catId), m = C.getMatch(c, b.matchId);
    const side = k => Object.assign({ name: nameOf(m[k]), club: clubOf(m[k]) }, C.splitPts(b[k].pts), { pts: b[k].pts, jogai: b[k].jogai || 0, atenai: b[k].atenai || 0, mubobi: b[k].mubobi || 0, kiken: b[k].kiken });
    return Object.assign(base, { mode: b.kind, category: c.name, catNum: c.num, categoryShort: c.name.replace(/^Kumite [^·]*·\s*/, ''), round: m.roundName, type: C.KUMITE_LABEL[b.type] || '', aka: side('aka'), shiro: side('shiro'), timeLeft: b.timeLeft, running: b.running, phase: b.phase, atoshi: b.timeLeft <= 30000 && b.phase === 'regolare', winner: b.winner, decision: b.decision, flags: b.flags, flagsShown: b.flagsShown });
  }
  if (S.showRanking && catById(S.showRanking)) {
    const c = catById(S.showRanking);
    return Object.assign(base, { mode: 'ranking', category: c.name, ranking: c.ranking.map(r => ({ p: r.pos, n: nameOf(r.id), c: clubOf(r.id) })) });
  }
  const nx = nextMatches(5).map(x => ({ cat: x.c.name, round: x.m.roundName, a: nameOf(x.m.aka), s: nameOf(x.m.shiro) }));
  return Object.assign(base, { mode: 'idle', place: S.tournament.place, date: S.tournament.date, next: nx });
}
function pushBoard() { KT.sendBoard && KT.sendBoard(boardData()); }
let boardOpen = false;
$('#btnBoard').onclick = async () => { await KT.openBoard(false); boardOpen = true; setTimeout(pushBoard, 600); };
$('#btnBoardWin').onclick = async () => { await KT.openBoard(true); boardOpen = true; setTimeout(pushBoard, 600); };
$('#btnBoardMove').onclick = () => KT.moveBoard();
KT.onBoardReady && KT.onBoardReady(() => pushBoard());
KT.onBoardClosed && KT.onBoardClosed(() => { boardOpen = false; });
setInterval(() => { if (!S.bout || !S.bout.running) pushBoard(); }, 3000);


// ---------------- GRAFICHE EVENTO ----------------
let stopPreview = null;
function updateOnAir() {
  const G = S.graphics, it = G && G.onAir && G.items.find(x => x.id === G.onAir), el = $('#onAir');
  if (!el) return;
  el.classList.toggle('hidden', !it); el.textContent = it ? '🔴 IN ONDA: ' + it.title : '';
}
function thumb(canvas, item) {
  if (item.figure === 'qr') { InfoScreen.drawQR(canvas, item.qrUrl); return; }
  if (item.figure === 'custom' && item.custom) { const im = new Image(); im.onload = () => PixelArt.render(canvas, 'custom', 0, { image: im }); im.src = item.custom; }
  else PixelArt.render(canvas, item.figure, 0);
}
function gfxChanged(noRerender) {
  save(true); pushBoard(); if (S.graphics.onAir) publishLive(true);
  updateOnAir();
  if (!noRerender) renderGrafiche(); else refreshPreview();
}
function refreshPreview() {
  const G = S.graphics, it = G.items.find(x => x.id === G.sel), st = $('#gStage');
  if (!it || !st) return;
  if (stopPreview) stopPreview();
  stopPreview = InfoScreen.mount(st, infoData(it));
  const li = $(`.gitem[data-g="${it.id}"]`); if (li) { li.querySelector('.t').textContent = it.title || '(senza titolo)'; thumb(li.querySelector('canvas'), it); }
}
function renderGrafiche() {
  const G = S.graphics;
  if (!G.items.find(x => x.id === G.sel)) G.sel = (G.items[0] || {}).id || null;
  const it = G.items.find(x => x.id === G.sel);
  const figs = PixelArt.list().concat([{ key: 'custom', label: 'Immagine tua' }]);
  $('#tab-grafiche').innerHTML = `
  <div class="row between"><h1>Grafiche evento</h1><span class="muted small">Schermate informative per il pubblico: testo + figura pixel art, sul tabellone TV e sulla pagina live.</span></div>
  <div class="airbar">
    ${it ? `<button class="primary big" id="gAir">📺 Manda in onda “${esc(it.title || '')}”</button>` : ''}
    <button class="big" id="gOff" ${G.onAir ? '' : 'disabled'}>⏹ Torna al tabellone gare</button>
    ${G.onAir ? `<span class="pill warn">IN ONDA: ${esc((G.items.find(x => x.id === G.onAir) || {}).title || '')}</span>` : '<span class="muted small">Nessuna grafica in onda</span>'}
  </div>
  <div class="gfx">
    <div>
      <div class="row gap" style="margin-bottom:8px"><button class="small" id="gNew">+ Nuova</button><button class="small" id="gDup" ${it ? '' : 'disabled'}>⧉ Duplica</button><button class="small" id="gUp">▲</button><button class="small" id="gDown">▼</button></div>
      <div class="glist">${G.items.map(x => `<div class="gitem ${x.id === G.sel ? 'sel' : ''} ${x.id === G.onAir ? 'air' : ''}" data-g="${x.id}"><canvas width="80" height="80"></canvas><div style="min-width:0"><div class="t">${esc(x.title || '(senza titolo)')}</div><div class="muted small">${x.id === G.onAir ? '🔴 in onda' : esc(x.figure === 'qr' ? 'QR code pagina live' : (PixelArt.FIGURES[x.figure] || { label: 'Immagine tua' }).label)}</div></div></div>`).join('')}</div>
    </div>
    <div>${it ? `
      <div class="grid2">
        <div class="card">
          <label class="f">Titolo (nome della fase)<input type="text" id="gT" value="${esc(it.title)}" maxlength="40"></label><br>
          <label class="f">Sottotitolo<input type="text" id="gS" value="${esc(it.subtitle)}" maxlength="80"></label><br>
          <label class="f">Testo informativo (cosa accade in questa fase)<textarea id="gX" style="min-height:90px;font-family:inherit;font-size:14px">${esc(it.text)}</textarea></label><br>
          <label class="f">Etichetta piccola sopra il titolo (facoltativa)<input type="text" id="gK" value="${esc(it.kicker || '')}" placeholder="es. ORA IN CORSO" maxlength="30"></label>
          <div class="row gap wrap" style="margin-top:10px"><span class="muted small">Colori:</span><div class="themes">${Object.entries(InfoScreen.THEMES).map(([k, t]) => `<button title="${esc(t.name)}" data-th="${k}" class="${it.theme === k ? 'sel' : ''}" style="background:${t.bg}"></button>`).join('')}</div>
          <label class="small"><input type="checkbox" id="gA" ${it.animate !== false ? 'checked' : ''}> Animazione</label></div>
          <div class="row gap" style="margin-top:10px"><button class="small" id="gDel">🗑 Elimina grafica</button></div>
        </div>
        <div>
          <div class="stage" id="gStage"></div>
          <p class="muted small" style="margin:6px 0 0">Anteprima di come appare sul televisore.</p>
        </div>
      </div>
      <div class="card"><h3>Figura</h3><div class="figs">${figs.map(f => `<div class="figbtn ${it.figure === f.key ? 'sel' : ''}" data-fig="${f.key}"><canvas width="112" height="112"></canvas>${esc(f.label)}</div>`).join('')}</div>
        <div class="row gap" style="margin-top:8px"><button class="small" id="gImg">📁 Carica immagine tua (PNG/JPG)…</button><label class="small"><input type="checkbox" id="gPix" checked> trasforma in pixel art</label><input type="file" id="gFile" accept="image/*" style="display:none"></div>
      </div>` : '<div class="hint">Crea una grafica con “+ Nuova”.</div>'}
      <div class="card"><div class="row between"><h3>Programma delle fasi</h3><label class="small"><input type="checkbox" id="gP" ${G.showProgram ? 'checked' : ''}> Mostra il programma in basso nelle grafiche</label></div>
        <div id="gProg">${G.program.map((p, i) => `<div class="prow ${i === G.current ? 'cur' : ''}"><input type="radio" name="cur" data-cur="${i}" ${i === G.current ? 'checked' : ''} title="Fase in corso"><input type="text" data-pn="${i}" value="${esc(p.name)}"><input type="text" data-pt="${i}" value="${esc(p.time || '')}" style="width:80px" placeholder="orario"><button class="small ghost" data-pdel="${i}">✕</button></div>`).join('')}</div>
        <div class="row gap wrap" style="margin-top:8px"><button class="small" id="gPAdd">+ Aggiungi fase</button><button id="gPrev">◀ Fase precedente</button><button class="primary" id="gNext">Fase successiva ▶</button><span class="muted small">La fase selezionata appare evidenziata come “IN CORSO”.</span></div>
      </div>
    </div>
  </div>`;
  $$('.gitem').forEach(el => { const x = G.items.find(i => i.id === el.dataset.g); thumb(el.querySelector('canvas'), x); el.onclick = () => { G.sel = x.id; save(true); renderGrafiche(); }; });
  $$('.figbtn').forEach(el => { if (el.dataset.fig === 'custom') { if (it && it.custom) thumb(el.querySelector('canvas'), { figure: 'custom', custom: it.custom }); } else PixelArt.render(el.querySelector('canvas'), el.dataset.fig, 0); });
  $('#gNew').onclick = () => { const n = { id: C.uid('g'), title: 'Nuova fase', subtitle: '', text: '', kicker: '', figure: 'karateka', theme: 'rosso', animate: true }; G.items.push(n); G.sel = n.id; gfxChanged(); setTimeout(() => { const t = $('#gT'); t && (t.focus(), t.select()); }, 30); };
  $('#gDup').onclick = () => { if (!it) return; const n = Object.assign({}, it, { id: C.uid('g'), title: it.title + ' (copia)' }); G.items.splice(G.items.indexOf(it) + 1, 0, n); G.sel = n.id; gfxChanged(); };
  const move = d => { const i = G.items.indexOf(it), j = i + d; if (!it || j < 0 || j >= G.items.length) return; [G.items[i], G.items[j]] = [G.items[j], G.items[i]]; gfxChanged(); };
  $('#gUp').onclick = () => move(-1); $('#gDown').onclick = () => move(1);
  if ($('#gAir')) $('#gAir').onclick = () => { G.onAir = it.id; gfxChanged(); toast('In onda sul tabellone TV'); };
  $('#gOff').onclick = () => { G.onAir = null; gfxChanged(); toast('Tabellone gare ripristinato'); };
  if (it) {
    const live = (id, k) => $(id).oninput = e => { it[k] = e.target.value; gfxChanged(true); };
    live('#gT', 'title'); live('#gS', 'subtitle'); live('#gX', 'text'); live('#gK', 'kicker');
    $('#gA').onchange = e => { it.animate = e.target.checked; gfxChanged(true); };
    $$('[data-th]').forEach(b => b.onclick = () => { it.theme = b.dataset.th; gfxChanged(); });
    $$('.figbtn').forEach(b => b.onclick = () => { if (b.dataset.fig === 'custom' && !it.custom) { $('#gFile').click(); return; } it.figure = b.dataset.fig; gfxChanged(); });
    $('#gImg').onclick = () => $('#gFile').click();
    $('#gFile').onchange = e => { const f = e.target.files[0]; if (f) loadCustomImage(f, $('#gPix').checked, url => { it.custom = url; it.figure = 'custom'; gfxChanged(); }); };
    $('#gDel').onclick = async () => { if (!(await confirmBox('Eliminare la grafica “' + esc(it.title) + '”?'))) return; G.items = G.items.filter(x => x !== it); if (G.onAir === it.id) G.onAir = null; G.sel = null; gfxChanged(); };
    refreshPreview();
  }
  // programma
  const progChanged = () => { save(true); pushBoard(); if (G.onAir) publishLive(true); refreshPreview(); };
  $('#gP').onchange = e => { G.showProgram = e.target.checked; progChanged(); };
  $$('[data-cur]').forEach(r => r.onchange = () => { G.current = +r.dataset.cur; progChanged(); renderGrafiche(); });
  $$('[data-pn]').forEach(i => i.oninput = () => { G.program[+i.dataset.pn].name = i.value; progChanged(); });
  $$('[data-pt]').forEach(i => i.oninput = () => { G.program[+i.dataset.pt].time = i.value; progChanged(); });
  $$('[data-pdel]').forEach(b => b.onclick = () => { const i = +b.dataset.pdel; G.program.splice(i, 1); if (G.current >= G.program.length) G.current = G.program.length - 1; if (G.current > i) G.current--; progChanged(); renderGrafiche(); });
  $('#gPAdd').onclick = () => { G.program.push({ name: 'Nuova fase', time: '' }); progChanged(); renderGrafiche(); };
  const step = d => { const n = Math.min(G.program.length - 1, Math.max(0, (G.current || 0) + d)); G.current = n;
    // se esiste una grafica con lo stesso nome della fase, la seleziona
    const ph = G.program[n]; const match = ph && G.items.find(x => C.strip(x.title) === C.strip(ph.name));
    if (match) { G.sel = match.id; if (G.onAir) G.onAir = match.id; }
    progChanged(); updateOnAir(); renderGrafiche(); };
  $('#gPrev').onclick = () => step(-1); $('#gNext').onclick = () => step(1);
}
function loadCustomImage(file, pixelate, cb) {
  const rd = new FileReader();
  rd.onload = () => {
    const im = new Image();
    im.onload = () => {
      const max = pixelate ? 64 : 320, sc = Math.min(1, max / Math.max(im.width, im.height));
      const w = Math.max(1, Math.round(im.width * sc)), h = Math.max(1, Math.round(im.height * sc));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = !pixelate ? true : true; x.drawImage(im, 0, 0, w, h);
      if (pixelate) { // riduce la palette per un effetto pixel art
        const d = x.getImageData(0, 0, w, h), a = d.data;
        for (let i = 0; i < a.length; i += 4) { for (let k = 0; k < 3; k++) a[i + k] = Math.round(a[i + k] / 51) * 51; a[i + 3] = a[i + 3] < 128 ? 0 : 255; }
        x.putImageData(d, 0, 0);
      }
      cb(c.toDataURL('image/png'));
    };
    im.onerror = () => toast('Immagine non valida');
    im.src = rd.result;
  };
  rd.readAsDataURL(file);
}

// ---------------- CLASSIFICHE ----------------
function renderClassifiche() {
  const clubs = {};
  S.categories.forEach(c => (c.ranking || []).forEach(r => { if (c.status !== 'conclusa') return; const k = clubOf(r.id) || '—'; clubs[k] = clubs[k] || { o: 0, a: 0, b: 0 }; if (r.pos === 1) clubs[k].o++; else if (r.pos === 2) clubs[k].a++; else if (r.pos === 3) clubs[k].b++; }));
  const medal = Object.entries(clubs).sort((x, y) => y[1].o - x[1].o || y[1].a - x[1].a || y[1].b - x[1].b);
  $('#tab-classifiche').innerHTML = `<div class="row between"><h1>Classifiche</h1><button id="xExp" class="primary">📊 Esporta Excel risultati</button></div>
   <div class="grid2"><div>${S.categories.filter(c => c.ranking && c.ranking.length).map(c => `<div class="card"><h3>#${c.num} ${esc(c.name)} ${catBadge(c)}</h3>${c.ranking.filter(r => r.pos <= (c.format === 'kata-punteggio' ? 8 : 3)).map(r => `<div class="entry">${r.pos === 1 ? '🥇' : r.pos === 2 ? '🥈' : r.pos === 3 ? '🥉' : r.pos + '°'} <b>${esc(nameOf(r.id))}</b> <span class="muted">${esc(clubOf(r.id))}</span><span class="tot muted small">${esc(r.note || '')}</span></div>`).join('')}</div>`).join('') || '<div class="hint">Ancora nessun risultato.</div>'}</div>
   <div><div class="card"><h3>Medagliere società</h3><table class="t"><tr><th>Società</th><th>🥇</th><th>🥈</th><th>🥉</th></tr>${medal.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.o}</td><td>${v.a}</td><td>${v.b}</td></tr>`).join('')}</table></div></div></div>`;
  $('#xExp').onclick = exportResults;
}
async function exportResults() {
  const wb = XLSX.utils.book_new();
  const res = [['Cat.', 'Categoria', 'Posizione', 'Cognome', 'Nome', 'Società', 'Note']];
  S.categories.forEach(c => (c.ranking || []).forEach(r => { const a = byId[r.id] || {}; res.push([c.num, c.name, r.pos, a.cognome, a.nome, a.societa, r.note || '']); }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(res), 'Classifiche');
  const inc = [['Cat.', 'Categoria', 'Turno', 'AKA', 'SHIRO', 'Vincitore', 'Punti AKA', 'Punti SHIRO', 'Decisione']];
  S.categories.forEach(c => (c.matches || []).filter(m => m.aka && m.shiro).forEach(m => inc.push([c.num, c.name, m.roundName, nameOf(m.aka), nameOf(m.shiro), m.draw ? 'Hikiwake' : m.winner ? nameOf(m.winner) : '', m.result ? m.result.akaPts : '', m.result ? m.result.shiroPts : '', m.result ? m.result.decision : ''])));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(inc), 'Incontri');
  const cat = [['Cat.', 'Categoria', 'Cognome', 'Nome', 'Società', 'Sesso', 'Nascita', 'Peso', 'Cintura']];
  S.categories.forEach(c => c.athleteIds.forEach(id => { const a = byId[id] || {}; cat.push([c.num, c.name, a.cognome, a.nome, a.societa, a.sesso, a.nascita, a.peso, a.cintura]); }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cat), 'Categorie');
  const data = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const p = await KT.saveAs({ defaultName: 'risultati_' + (S.tournament.name || 'torneo').replace(/[^\w]/g, '_') + '.xlsx', data, base64: true, filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
  if (p) toast('Esportato');
}

// ---------------- ONLINE (Firebase) ----------------
let fbState = 'off';
function setSync(st, msg) { fbState = st; const e = $('#syncStatus'); e.className = 'sync ' + st; e.textContent = 'Online: ' + msg; }
function fbUrl(path) {
  const f = S.firebase; let base = (f.url || '').trim().replace(/\/+$/, '');
  if (base && !/^https?:\/\//.test(base)) base = 'https://' + base;
  return base + '/tornei/' + encodeURIComponent(f.tid) + (path ? '/' + path : '') + '.json' + (f.secret ? '?auth=' + encodeURIComponent(f.secret) : '');
}
async function fbPut(path, data) {
  if (!S.firebase.enabled || !S.firebase.url) return;
  try {
    const r = await fetch(fbUrl(path), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!r.ok) throw new Error('HTTP ' + r.status + (r.status === 401 ? ' (permesso negato: controlla il secret)' : ''));
    setSync('ok', 'aggiornato ' + new Date().toLocaleTimeString('it-IT'));
    return true;
  } catch (e) { setSync('err', 'errore — ' + e.message); return false; }
}
let pubTimer = null;
function publishAllDebounced() { if (!S.firebase.enabled) return; clearTimeout(pubTimer); pubTimer = setTimeout(publishAll, 2000); }
function myCats(c) { return !c.tatami || String(c.tatami) === String(S.tournament.tatami); }
async function fbPatch(data) {
  if (!S.firebase.enabled || !S.firebase.url) return false;
  try {
    const r = await fetch(fbUrl(''), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    if (!r.ok) throw new Error('HTTP ' + r.status + (r.status === 401 ? ' (permesso negato: controlla il secret)' : ''));
    setSync('ok', 'aggiornato ' + new Date().toLocaleTimeString('it-IT')); return true;
  } catch (e) { setSync('err', 'errore — ' + e.message); return false; }
}
let pubHash = {};
function hashStr(t) { let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return h; }
async function publishAll(force) {
  const snap = C.publicSnapshot(S), upd = { info: snap.info };
  let n = 0;
  snap.categories.forEach((c, i) => {
    if (!myCats(S.categories[i])) return;
    const h = hashStr(JSON.stringify(c));
    if (force || pubHash[c.id] !== h) { upd['categories/' + c.id] = c; upd['ver/' + c.id] = Date.now(); n++; }
  });
  const ok = await fbPatch(upd);
  if (ok) { snap.categories.forEach(c => { if (upd['categories/' + c.id]) pubHash[c.id] = hashStr(JSON.stringify(c)); }); publishLive(true); }
  return ok;
}
let liveTimer = null, liveLast = 0;
function liveData() {
  const d = boardData(); delete d.beep;
  d.ts = Date.now();
  return d;
}
function publishLive(force) {
  if (!S.firebase.enabled) return;
  const now = Date.now();
  const doIt = () => { liveLast = Date.now(); fbPut('live/' + encodeURIComponent('tatami' + (S.tournament.tatami || '1')), liveData()); };
  clearTimeout(liveTimer);
  if (force || now - liveLast > 900) doIt(); else liveTimer = setTimeout(doIt, 900 - (now - liveLast));
}
const LS = { get: k => { try { return localStorage.getItem('kt_' + k) || ''; } catch (e) { return ''; } }, set: (k, v) => { try { localStorage.setItem('kt_' + k, v || ''); } catch (e) { } } };
function liveUrl() { return LS.get('netlifyUrl'); }
async function buildLiveHtml() {
  let html = await KT.liveTemplate();
  let base = S.firebase.url.replace(/\/+$/, ''); if (!/^https?:\/\//.test(base)) base = 'https://' + base;
  return html.split('__DB_URL__').join(base).split('__TID__').join(S.firebase.tid).split('__TITLE__').join(esc(S.tournament.name));
}
function qrSvg(text, cell) {
  try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: cell || 5, margin: 2, scalable: true }); } catch (e) { return ''; }
}
function renderOnline() {
  const f = S.firebase, url = liveUrl(), tok = LS.get('netlifyToken');
  const fbOk = !!(f.url && f.secret), nlOk = !!tok;
  const step = (ok, n) => `<span class="pill ${ok ? 'ok' : ''}">${ok ? '✓' : n}</span>`;
  $('#tab-online').innerHTML = `<h1>Account e risultati online</h1>
  <p class="muted">Tutto si configura da qui: gli account si aprono in una finestra interna del programma, senza browser esterni. Va fatto una volta sola.</p>
  <div class="grid2">
  <div class="card">
    <h3>${step(fbOk, 1)} Google Firebase — database dei risultati</h3>
    <ol class="small">
      <li>Premi <b>Apri Firebase</b> e accedi con il tuo account Google.</li>
      <li><b>Aggiungi progetto</b> (es. “torneo-karate”, Analytics non serve).</li>
      <li>Menu <b>Build → Realtime Database → Crea database</b>, posizione <i>Belgio (europe-west1)</i>, modalità <b>bloccata</b>.</li>
      <li>Scheda <b>Regole</b>: incolla il testo qui sotto e premi <b>Pubblica</b>.<div class="row gap" style="margin:4px 0"><code style="background:#f3f4f6;padding:3px 6px;border-radius:5px">{"rules":{".read":true,".write":false}}</code><button class="small" id="fCopyRules">Copia</button></div></li>
      <li>Torna alla scheda <b>Dati</b> e premi <b>🔍 Rileva</b>: il programma legge l'indirizzo del database.</li>
      <li>Vai su ⚙️ <b>Impostazioni progetto → Account di servizio → Secret del database → Mostra</b>, poi di nuovo <b>🔍 Rileva</b>.</li>
    </ol>
    <div class="row gap wrap"><button class="primary" id="fOpen">🔥 Apri Firebase</button><button id="fDetect">🔍 Rileva dalla finestra</button></div>
    <div class="grid2" style="margin-top:10px">
      <label class="f">Indirizzo database<input type="text" id="fU" placeholder="https://…firebasedatabase.app" value="${esc(f.url)}"></label>
      <label class="f">Secret del database<input type="password" id="fS" value="${esc(f.secret)}"></label>
      <label class="f">Codice torneo<input type="text" id="fT" value="${esc(f.tid)}"></label>
      <label class="f">Aggiornamento live<span><label><input type="checkbox" id="fE" ${f.enabled ? 'checked' : ''}> Attivo</label></span></label>
    </div>
    <div class="row gap wrap" style="margin-top:8px"><button id="fTest" class="primary">🔌 Prova e pubblica</button><button id="fClear">🗑 Cancella dati online</button></div>
  </div>
  <div class="card">
    <h3>${step(!!url, 2)} Netlify — pagina pubblica dei risultati</h3>
    <ol class="small">
      <li>Premi <b>Apri Netlify</b> e crea un account gratuito (puoi entrare con lo stesso account Google).</li>
      <li>Premi <b>Crea token</b>: nella pagina che si apre scegli <b>New access token</b>, dagli un nome (es. “torneo”), scadenza lunga, e <b>Generate</b>.</li>
      <li>Premi <b>🔍 Rileva</b> (oppure copia e incolla il token qui sotto).</li>
      <li>Premi <b>Pubblica pagina live</b>: ottieni il link e il QR code da mostrare al pubblico.</li>
    </ol>
    <div class="row gap wrap"><button class="primary" id="nOpen">🌐 Apri Netlify</button><button id="nTok">🔑 Crea token</button><button id="nDetect">🔍 Rileva dalla finestra</button></div>
    <label class="f" style="margin-top:10px">Token di accesso Netlify<input type="password" id="nT" value="${esc(tok)}" placeholder="nfp_…"></label>
    <div class="row gap wrap" style="margin-top:8px"><button class="primary" id="nPub" ${fbOk ? '' : 'disabled title="Configura prima Firebase"'}>🚀 ${url ? 'Aggiorna' : 'Pubblica'} pagina live</button><button id="fPage">💾 Salva index.html (altro hosting)</button></div>
    ${url ? `<div class="row gap" style="margin-top:12px;align-items:flex-start"><div style="width:130px;flex-shrink:0">${qrSvg(url, 4)}</div><div><b>Link pubblico</b><br><a href="#" id="nLink">${esc(url)}</a><div class="row gap wrap" style="margin-top:8px"><button class="small" id="nCopy">📋 Copia link</button><button class="small" id="nView">👁 Apri pagina</button><button class="small" id="nQr">📺 QR sul tabellone</button></div></div></div>` : ''}
  </div>
  </div>
  <div class="card"><h3>È tutto gratuito?</h3><div class="small">
    <p><b>Sì, con i piani gratuiti, senza carta di credito.</b> Limiti da conoscere:</p>
    <ul>
      <li><b>Firebase (piano Spark):</b> circa 10 GB al mese di dati scaricati e un massimo di 100 connessioni contemporanee. La pagina pubblica legge i dati a intervalli brevi invece di restare collegata, così centinaia di spettatori non occupano connessioni fisse. Se si superano i limiti mensili il servizio si ferma fino al mese dopo, ma non si paga nulla.</li>
      <li><b>Netlify (piano Free):</b> 300 crediti al mese. Ogni pubblicazione della pagina consuma 15 crediti (circa 20 al mese); la pagina pesa pochissimo, quindi le visite consumano poco. Pubblica una volta prima della gara: i risultati si aggiornano da soli senza ripubblicare.</li>
    </ul></div></div>`;
  const upd = () => { S.firebase.url = $('#fU').value.trim(); S.firebase.secret = $('#fS').value.trim(); S.firebase.tid = $('#fT').value.trim().replace(/[^\w\-]/g, '') || 'torneo'; S.firebase.enabled = $('#fE').checked; save(true); if (!S.firebase.enabled) setSync('off', 'disattivato'); };
  ['#fU', '#fS', '#fT', '#fE'].forEach(id => $(id).onchange = upd);
  $('#nT').onchange = e => LS.set('netlifyToken', e.target.value.trim());
  $('#fCopyRules').onclick = () => { navigator.clipboard.writeText('{"rules":{".read":true,".write":false}}'); toast('Regole copiate: incollale nella scheda Regole'); };
  $('#fOpen').onclick = () => KT.webOpen({ key: 'firebase', url: 'https://console.firebase.google.com/', title: 'Firebase' });
  $('#fDetect').onclick = async () => {
    const r = await KT.webDetect('firebase');
    if (r.error) { toast(r.error === 'Finestra non aperta' ? 'Apri prima Firebase' : r.error); return; }
    let got = [];
    if (r.url) { $('#fU').value = r.url; got.push('indirizzo database'); }
    if (r.secret) { $('#fS').value = r.secret; got.push('secret'); }
    if (!got.length) { toast('Niente trovato: apri la scheda Dati (per l\'indirizzo) o premi Mostra sul secret'); return; }
    upd(); toast('Rilevato: ' + got.join(' e ')); renderOnline();
  };
  $('#nOpen').onclick = () => KT.webOpen({ key: 'netlify', url: 'https://app.netlify.com/signup', title: 'Netlify' });
  $('#nTok').onclick = () => KT.webOpen({ key: 'netlify', url: 'https://app.netlify.com/user/applications#personal-access-tokens', title: 'Netlify' });
  $('#nDetect').onclick = async () => {
    const r = await KT.webDetect('netlify');
    if (r.error) { toast(r.error === 'Finestra non aperta' ? 'Apri prima Netlify' : r.error); return; }
    if (!r.netlifyToken) { toast('Token non trovato: generalo e lascialo visibile nella pagina'); return; }
    LS.set('netlifyToken', r.netlifyToken); toast('Token rilevato'); renderOnline();
  };
  $('#fTest').onclick = async () => { upd(); if (!S.firebase.url) { toast('Inserisci l\'indirizzo del database'); return; } const was = S.firebase.enabled; S.firebase.enabled = true; pubHash = {}; const ok = await publishAll(true); if (ok) { toast('Connessione riuscita, dati pubblicati'); $('#fE').checked = true; save(true); renderOnline(); } else { S.firebase.enabled = was; toast('Connessione fallita: vedi stato in basso a sinistra'); } };
  $('#nPub').onclick = async () => {
    upd(); const token = $('#nT').value.trim(); LS.set('netlifyToken', token);
    if (!token) { toast('Serve il token Netlify'); return; }
    const b = $('#nPub'); b.disabled = true; b.textContent = '⏳ Pubblicazione…';
    const html = await buildLiveHtml();
    const r = await KT.netlifyDeploy({ token, siteId: LS.get('netlifySite'), name: ('karate-' + S.firebase.tid).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 60), html });
    if (r.ok) { LS.set('netlifySite', r.siteId); LS.set('netlifyUrl', r.url); toast('Pagina pubblicata!'); renderOnline(); }
    else { b.disabled = false; b.textContent = '🚀 Pubblica pagina live'; modal('<h3>Pubblicazione non riuscita</h3><p>' + esc(r.error) + '</p>'); }
  };
  $('#fPage').onclick = async () => {
    upd(); if (!S.firebase.url) { toast('Configura prima Firebase'); return; }
    const p = await KT.saveAs({ defaultName: 'index.html', data: await buildLiveHtml(), filters: [{ name: 'Pagina web', extensions: ['html'] }] });
    if (p) toast('Salvata');
  };
  if ($('#nCopy')) {
    $('#nCopy').onclick = () => { navigator.clipboard.writeText(url); toast('Link copiato'); };
    $('#nLink').onclick = $('#nView').onclick = e => { e.preventDefault(); KT.webOpen({ key: 'live', url, title: 'Pagina live' }); };
    $('#nQr').onclick = () => {
      const G = S.graphics; let it = G.items.find(x => x.qr);
      if (!it) { it = { id: C.uid('g'), title: 'Risultati live', subtitle: 'Inquadra il QR code col telefono', text: url.replace(/^https?:\/\//, ''), kicker: 'SEGUI LA GARA', figure: 'qr', theme: 'nero', animate: false, qr: true }; G.items.push(it); }
      it.text = url.replace(/^https?:\/\//, ''); it.qrUrl = url; G.onAir = it.id; G.sel = it.id; save(true); pushBoard(); updateOnAir(); toast('QR code in onda sul tabellone');
    };
  }
  $('#fClear').onclick = async () => { if (!(await confirmBox('Cancellare dal database online i dati di questo torneo?'))) return; upd(); try { const r = await fetch(fbUrl(''), { method: 'DELETE' }); pubHash = {}; toast(r.ok ? 'Dati online cancellati' : 'Errore ' + r.status); } catch (e) { toast('Errore di rete'); } };
}

// ---------------- REGOLE ----------------
function renderRegole() {
  const st = S.settings;
  const ac = st.ageClasses.map(c => [c.name, c.min, c.max, c.kumite, c.kataFinal].join(';')).join('\n');
  const w = Object.entries(st.weights).map(([k, v]) => k.replace('|', ';') + ';' + v.join(',')).join('\n');
  const bg = st.beltGroups.map(g => g.name + ';' + g.belts.join(',')).join('\n');
  $('#tab-regole').innerHTML = `<h1>Regole di gara</h1>
  <p class="muted">Valori predefiniti dal Regolamento arbitrale FESIK (agg. 15/02/2025). Verifica sempre con la circolare della tua gara: puoi modificarli qui prima di generare le categorie.</p>
  <div class="grid2">
  <div class="card"><h3>Classi d'età</h3><p class="muted small">Nome;età min;età max;tipo kumite (nihon/sanbon/ippon);finalisti kata</p><textarea id="rA">${esc(ac)}</textarea></div>
  <div class="card"><h3>Categorie di peso kumite</h3><p class="muted small">Classe;Sesso;limiti in kg separati da virgola (l'ultima diventa “+”). Classi non elencate = Open.</p><textarea id="rW">${esc(w)}</textarea></div>
  <div class="card"><h3>Gruppi di cinture</h3><p class="muted small">Nome gruppo;cinture separate da virgola</p><textarea id="rB" style="min-height:90px">${esc(bg)}</textarea>
    <label><input type="checkbox" id="rStyle" ${st.splitKataByStyle ? 'checked' : ''}> Dividi il kata per stile</label></div>
  <div class="card"><h3>Formula e tempi</h3><div class="grid2">
    <label class="f">Kumite (4+ atleti)<select id="rF"><option value="recupero">Eliminazione diretta con recupero</option><option value="semplice">Eliminazione diretta, 3° pari merito</option></select></label>
    <label class="f">Girone all'italiana fino a N atleti<input type="number" id="rRR" min="2" max="6" value="${st.roundRobinMax}"></label>
    <label class="f">Kata<select id="rK"><option value="punteggio">A punteggio (scarto alto/basso)</option><option value="bandierine">A bandierine (eliminazione)</option></select></label>
    <label class="f">Giudici kata<select id="rJ"><option value="3">3 (arbitro + 2)</option><option value="5">5 (arbitro + 4)</option></select></label>
    <label class="f">Nihon (secondi)<input type="number" id="rD1" value="${st.durations.nihon}"></label>
    <label class="f">Sanbon/Ippon eliminatorie (s)<input type="number" id="rD2" value="${st.durations.elim}"></label>
    <label class="f">Semifinali e finali (s)<input type="number" id="rD3" value="${st.durations.finals}"></label>
    <label class="f">Encho-sen (s)<input type="number" id="rD4" value="${st.durations.encho}"></label>
  </div><label><input type="checkbox" id="rSep" ${st.separateClubs !== false ? 'checked' : ''}> Nel sorteggio separa gli atleti della stessa società</label></div>
  </div>
  <div class="row gap"><button class="primary" id="rSave">Salva regole</button><button id="rReset">Ripristina valori FESIK</button></div>`;
  $('#rF').value = st.kumiteFormat; $('#rK').value = st.kataSystem; $('#rJ').value = String(st.kataJudges);
  $('#rSave').onclick = () => {
    try {
      st.ageClasses = $('#rA').value.split('\n').map(l => l.split(';').map(x => x.trim())).filter(p => p[0]).map(p => ({ name: p[0], min: +p[1], max: +p[2], kumite: (p[3] || 'sanbon').toLowerCase(), kataFinal: +p[4] || 6 }));
      st.weights = {}; $('#rW').value.split('\n').map(l => l.split(';').map(x => x.trim())).filter(p => p[0] && p[2]).forEach(p => st.weights[p[0] + '|' + p[1].toUpperCase()] = p[2].split(',').map(Number).filter(Boolean).sort((a, b) => a - b));
      st.beltGroups = $('#rB').value.split('\n').map(l => l.split(';')).filter(p => p[0] && p[1]).map(p => ({ name: p[0].trim(), belts: p[1].split(',').map(x => x.trim().toLowerCase()).filter(Boolean) }));
      st.splitKataByStyle = $('#rStyle').checked; st.kumiteFormat = $('#rF').value; st.kataSystem = $('#rK').value; st.kataJudges = +$('#rJ').value; st.roundRobinMax = +$('#rRR').value || 3;
      st.durations = { nihon: +$('#rD1').value || 90, elim: +$('#rD2').value || 120, finals: +$('#rD3').value || 180, encho: +$('#rD4').value || 60 };
      st.separateClubs = $('#rSep').checked;
      save(); toast('Regole salvate — rigenera le categorie per applicarle');
    } catch (e) { toast('Errore nel formato'); }
  };
  $('#rReset').onclick = async () => { if (await confirmBox('Ripristinare le regole predefinite FESIK?')) { S.settings = JSON.parse(JSON.stringify(C.DEFAULT_SETTINGS)); save(); renderRegole(); } };
}

// ---------------- avvio ----------------
(async function init() {
  try { const d = KT.autosaveRead && await KT.autosaveRead(); if (d) { S = Object.assign(blankState(), JSON.parse(d)); S.settings = Object.assign(JSON.parse(JSON.stringify(C.DEFAULT_SETTINGS)), S.settings); } } catch (e) { }
  if (S.bout) S.bout.running = false;
  if (!S.graphics) S.graphics = defaultGraphics();
  reindex(); render(); updateOnAir();
  if (S.firebase.enabled) { setSync('off', 'connessione…'); publishAll(true); }
})();
