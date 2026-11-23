/* Karate Torneo FESIK - logica di gara (pura, testabile) */
(function (root) {
  'use strict';

  // ---------- Impostazioni predefinite (Regolamento arbitrale FESIK agg. 15/02/2025) ----------
  const DEFAULT_SETTINGS = {
    ageClasses: [
      { name: 'Ragazzi A', min: 6, max: 7, kumite: 'nihon', kataFinal: 8 },
      { name: 'Ragazzi B', min: 8, max: 9, kumite: 'nihon', kataFinal: 8 },
      { name: 'Ragazzi C', min: 10, max: 11, kumite: 'nihon', kataFinal: 8 },
      { name: 'Ragazzi D', min: 12, max: 13, kumite: 'nihon', kataFinal: 8 },
      { name: 'Mini-Cadetti', min: 14, max: 15, kumite: 'sanbon', kataFinal: 6 },
      { name: 'Cadetti', min: 16, max: 17, kumite: 'sanbon', kataFinal: 6 },
      { name: 'Juniores', min: 18, max: 20, kumite: 'sanbon', kataFinal: 6 },
      { name: 'Seniores', min: 21, max: 35, kumite: 'sanbon', kataFinal: 6 },
      { name: 'Veterani A', min: 36, max: 45, kumite: 'sanbon', kataFinal: 6 },
      { name: 'Veterani B', min: 46, max: 65, kumite: 'sanbon', kataFinal: 6 }
    ],
    // limiti di peso (kg) per classe|sesso; l'ultima categoria è "+ultimo". Vuoto = open
    weights: {
      'Cadetti|M': [52, 57, 63, 70], 'Cadetti|F': [47, 54],
      'Juniores|M': [55, 61, 68, 76], 'Juniores|F': [48, 53, 59, 66],
      'Seniores|M': [60, 67, 75, 84], 'Seniores|F': [50, 55, 61, 68]
    },
    beltGroups: [
      { name: 'Cinture colorate', belts: ['bianca', 'gialla', 'arancio', 'arancione', 'verde', 'blu', 'azzurra'] },
      { name: 'Cinture marroni e nere', belts: ['marrone', 'nera'] }
    ],
    splitKataByStyle: true,
    kataSystem: 'punteggio',     // 'punteggio' | 'bandierine'
    kataJudges: 5,               // 3 o 5 (arbitro + 2/4 giudici)
    kumiteFormat: 'recupero',    // 'recupero' | 'semplice'
    roundRobinMax: 3,            // fino a N atleti: girone all'italiana
    separateClubs: true,
    durations: { nihon: 90, elim: 120, finals: 180, encho: 60 },
    kataScales: {
      Eliminatorie: [5.0, 7.0], Semifinale: [6.0, 8.0], Finale: [7.0, 9.0]
    }
  };

  const WIN_POINTS = { sanbon: 6, nihon: 4, ippon: 2 }; // in wazaari (1 ippon = 2 wazaari)
  const KUMITE_LABEL = { sanbon: 'Shobu Sanbon', nihon: 'Shobu Nihon', ippon: 'Shobu Ippon' };

  // ---------- utilità ----------
  let _uid = 0;
  function uid(p) { _uid++; return (p || 'id') + Date.now().toString(36) + _uid.toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function strip(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); }
  function shuffle(a, rnd) { rnd = rnd || Math.random; a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function cap(s) { s = String(s || '').trim(); return s ? s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : ''; }

  function parseDate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
    if (typeof v === 'number') { // seriale Excel
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000); return d;
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) { let y = +m[3]; if (y < 100) y += y > 30 ? 1900 : 2000; return new Date(Date.UTC(y, +m[2] - 1, +m[1])); }
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (/^\d{4}$/.test(s)) return new Date(Date.UTC(+s, 0, 1));
    return null;
  }
  function isoDate(d) { return d ? d.toISOString().slice(0, 10) : ''; }
  function ageAt(birthIso, dateIso) {
    if (!birthIso) return null;
    const b = new Date(birthIso + 'T00:00:00Z'), d = new Date((dateIso || isoDate(new Date())) + 'T00:00:00Z');
    let a = d.getUTCFullYear() - b.getUTCFullYear();
    if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) a--;
    return a;
  }

  // ---------- import Excel ----------
  const HEADER_MAP = {
    cognome: ['cognome', 'surname', 'last name', 'lastname'],
    nome: ['nome', 'name', 'first name', 'firstname'],
    sesso: ['sesso', 'sex', 'genere', 'm/f'],
    nascita: ['data di nascita', 'data nascita', 'nascita', 'nato il', 'data', 'birth', 'anno', 'anno di nascita'],
    peso: ['peso', 'kg', 'peso kg', 'weight'],
    cintura: ['cintura', 'grado', 'belt', 'kyu'],
    societa: ['societa', 'società', 'club', 'palestra', 'asd', 'team'],
    specialita: ['specialita', 'specialità', 'disciplina', 'gara', 'specialty'],
    stile: ['stile', 'style', 'ryu'],
    kata: ['kata'], kumite: ['kumite']
  };
  function mapHeaders(headers) {
    const map = {};
    headers.forEach((h, i) => {
      const k = strip(h);
      for (const field in HEADER_MAP) {
        if (map[field] != null) continue;
        if (HEADER_MAP[field].some(x => strip(x) === k)) { map[field] = i; return; }
      }
    });
    headers.forEach((h, i) => { // corrispondenze parziali
      const k = strip(h);
      for (const field in HEADER_MAP) {
        if (map[field] != null || Object.values(map).includes(i)) continue;
        if (HEADER_MAP[field].some(x => k.includes(strip(x)) && strip(x).length > 3)) map[field] = i;
      }
    });
    return map;
  }
  function yes(v) { const s = strip(v); return s === 'x' || s === 'si' || s === 'sì' || s === 's' || s === '1' || s === 'true' || s === 'yes'; }
  function parseAthleteRows(rows) {
    // rows: array di array (prima riga = intestazioni)
    if (!rows || !rows.length) return { athletes: [], warnings: ['File vuoto'] };
    const hi = rows.findIndex(r => r && r.filter(c => c !== '' && c != null).length >= 2);
    const map = mapHeaders(rows[hi].map(x => String(x || '')));
    const warnings = [];
    ['cognome', 'nome', 'sesso', 'nascita'].forEach(f => { if (map[f] == null) warnings.push('Colonna mancante: ' + f); });
    const out = [];
    for (let r = hi + 1; r < rows.length; r++) {
      const row = rows[r]; if (!row) continue;
      const g = f => map[f] == null ? '' : row[map[f]];
      const cognome = cap(g('cognome')), nome = cap(g('nome'));
      if (!cognome && !nome) continue;
      const sx = strip(g('sesso')); const sesso = sx.startsWith('f') || sx === 'd' ? 'F' : 'M';
      const nascita = isoDate(parseDate(g('nascita')));
      const peso = parseFloat(String(g('peso')).replace(',', '.')) || null;
      let spec = [];
      const sp = strip(g('specialita'));
      if (sp) { if (sp.includes('kata')) spec.push('kata'); if (sp.includes('kumite')) spec.push('kumite'); if (sp.includes('entramb') || sp.includes('tutt')) spec = ['kata', 'kumite']; }
      if (map.kata != null && yes(g('kata'))) spec.push('kata');
      if (map.kumite != null && yes(g('kumite'))) spec.push('kumite');
      spec = [...new Set(spec)]; if (!spec.length) spec = ['kata', 'kumite'].filter(x => sp === '' ? x === 'kumite' : false);
      if (!spec.length) spec = ['kumite'];
      if (!nascita) warnings.push(`Riga ${r + 1}: data di nascita non valida per ${cognome} ${nome}`);
      out.push({ id: uid('a'), cognome, nome, sesso, nascita, peso, cintura: cap(g('cintura')), societa: String(g('societa') || '').trim(), specialita: spec, stile: cap(g('stile')) });
    }
    return { athletes: out, warnings };
  }

  // ---------- categorie ----------
  function ageClassOf(ath, settings, date) {
    const a = ageAt(ath.nascita, date); if (a == null) return null;
    return settings.ageClasses.find(c => a >= c.min && a <= c.max) || null;
  }
  function beltGroupOf(ath, settings) {
    const b = strip(ath.cintura);
    if (!b) return settings.beltGroups.length ? settings.beltGroups[0].name : '';
    const g = settings.beltGroups.find(g => g.belts.some(x => b.includes(strip(x))));
    return g ? g.name : (settings.beltGroups.length ? settings.beltGroups[settings.beltGroups.length - 1].name : '');
  }
  function weightLabel(peso, limits) {
    if (!limits || !limits.length) return 'Open';
    if (peso == null) return 'Peso n.d.';
    for (const l of limits) if (peso <= l) return '-' + l + ' kg';
    return '+' + limits[limits.length - 1] + ' kg';
  }
  function weightOrder(lbl) { if (lbl === 'Open') return 0; const n = parseFloat(lbl.replace(/[^\d.]/g, '')) || 999; return lbl.startsWith('+') ? n + 0.5 : n; }

  function generateCategories(athletes, settings, date) {
    const groups = {};
    const unassigned = [];
    athletes.forEach(a => {
      const ac = ageClassOf(a, settings, date);
      if (!ac) { unassigned.push(a); return; }
      const belt = beltGroupOf(a, settings);
      (a.specialita || []).forEach(disc => {
        let key, base = { discipline: disc, sesso: a.sesso, ageClass: ac.name, belt };
        if (disc === 'kumite') {
          const w = weightLabel(a.peso, settings.weights[ac.name + '|' + a.sesso]);
          base.weight = w; base.kumiteType = ac.kumite;
          key = ['kumite', ac.name, a.sesso, belt, w].join('|');
        } else {
          const st = settings.splitKataByStyle ? (a.stile || 'Tutti gli stili') : 'Tutti gli stili';
          base.stile = st; base.kataFinal = ac.kataFinal || 6;
          key = ['kata', ac.name, a.sesso, belt, st].join('|');
        }
        if (!groups[key]) groups[key] = Object.assign({ id: uid('c'), athleteIds: [], ageMin: ac.min }, base);
        groups[key].athleteIds.push(a.id);
      });
    });
    const cats = Object.values(groups);
    cats.sort((x, y) => (x.discipline === y.discipline ? 0 : x.discipline === 'kata' ? -1 : 1) || x.ageMin - y.ageMin || x.sesso.localeCompare(y.sesso) || x.belt.localeCompare(y.belt) || weightOrder(x.weight || '') - weightOrder(y.weight || '') || String(x.stile).localeCompare(String(y.stile)));
    cats.forEach((c, i) => { c.num = i + 1; c.name = categoryName(c); c.status = 'da sorteggiare'; });
    return { categories: cats, unassigned };
  }
  function categoryName(c) {
    const parts = [c.discipline === 'kata' ? 'Kata' : 'Kumite ' + (KUMITE_LABEL[c.kumiteType] || '').replace('Shobu ', ''), c.ageClass, c.sesso === 'F' ? 'Femminile' : 'Maschile', c.belt];
    if (c.discipline === 'kumite' && c.weight) parts.push(c.weight);
    if (c.discipline === 'kata' && c.stile && c.stile !== 'Tutti gli stili') parts.push(c.stile);
    return parts.filter(Boolean).join(' · ');
  }

  // ---------- sorteggio ----------
  function seedOrder(size) { // posizioni standard delle teste di serie
    let order = [1];
    while (order.length < size) { const n = order.length * 2; order = order.flatMap(s => [s, n + 1 - s]); }
    return order; // order[pos] = seed
  }
  function clubSpread(ids, byId, rnd, separate) {
    if (!separate) return shuffle(ids, rnd);
    const clubs = {};
    shuffle(ids, rnd).forEach(id => { const k = strip(byId[id] && byId[id].societa) || ('_' + id); (clubs[k] = clubs[k] || []).push(id); });
    const lists = shuffle(Object.values(clubs), rnd).sort((a, b) => b.length - a.length);
    // distribuzione: i membri dello stesso club ricevono teste di serie lontane
    const n = ids.length, size = nextPow2(n);
    const order = seedOrder(size); // seed per posizione
    const posOfSeed = {}; order.forEach((s, p) => posOfSeed[s] = p);
    const seeds = []; // seed -> id
    const used = new Set();
    const avail = []; for (let s = 1; s <= n; s++) avail.push(s);
    lists.forEach(list => {
      const chosen = [];
      list.forEach(id => {
        // scegli il seed libero che massimizza la distanza minima dai compagni di club (nell'albero)
        let best = null, bestD = -1;
        const cand = avail.filter(s => !used.has(s));
        for (const s of cand) {
          const p = posOfSeed[s];
          let d = chosen.length ? Math.min(...chosen.map(q => treeDist(p, posOfSeed[q]))) : 99;
          d += rnd() * 0.01;
          if (d > bestD) { bestD = d; best = s; }
        }
        used.add(best); chosen.push(best); seeds[best] = id;
      });
    });
    const res = []; for (let s = 1; s <= n; s++) res.push(seeds[s]);
    return res;
  }
  function treeDist(p, q) { let d = 0; while (p !== q) { p >>= 1; q >>= 1; d++; } return d; }
  function nextPow2(n) { let s = 1; while (s < n) s *= 2; return s; }
  function roundName(matchesInRound) { return matchesInRound === 1 ? 'Finale' : matchesInRound === 2 ? 'Semifinali' : matchesInRound === 4 ? 'Quarti di finale' : matchesInRound === 8 ? 'Ottavi di finale' : matchesInRound === 16 ? 'Sedicesimi' : 'Turno'; }

  function newMatch(o) { return Object.assign({ id: uid('m'), aka: null, shiro: null, winner: null, loser: null, status: 'pending', result: null }, o); }

  function drawCategory(cat, byId, settings, rnd) {
    rnd = rnd || Math.random;
    const ids = cat.athleteIds.slice();
    cat.matches = []; cat.ranking = []; cat.kata = null; cat.drawn = true; cat.status = 'in corso';
    const n = ids.length;
    if (cat.discipline === 'kata' && settings.kataSystem === 'punteggio') {
      cat.format = 'kata-punteggio';
      cat.kata = buildKataRounds(shuffle(ids, rnd), cat.kataFinal || 6, settings);
      return cat;
    }
    cat.matchKind = cat.discipline === 'kata' ? 'flags' : 'kumite';
    if (n === 0) { cat.format = 'vuota'; cat.status = 'vuota'; return cat; }
    if (n === 1) { cat.format = 'unico'; cat.ranking = [{ pos: 1, id: ids[0] }]; cat.status = 'conclusa'; return cat; }
    if (n === 2) { cat.format = 'finale'; }
    else if (n <= (settings.roundRobinMax || 3)) { cat.format = 'girone'; }
    else cat.format = settings.kumiteFormat === 'semplice' ? 'eliminazione' : 'recupero';
    if (cat.format === 'girone') {
      const order = clubSpread(ids, byId, rnd, false);
      const pairs = [];
      if (order.length === 3) pairs.push([0, 1], [1, 2], [0, 2]);
      else for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) pairs.push([i, j]);
      pairs.forEach(([i, j], k) => cat.matches.push(newMatch({ type: 'rr', round: 0, roundName: 'Girone', idx: k, aka: order[i], shiro: order[j] })));
      cat.rrOrder = order;
      return cat;
    }
    // eliminazione diretta
    const seeded = clubSpread(ids, byId, rnd, settings.separateClubs !== false);
    const size = nextPow2(n), order = seedOrder(size);
    const slots = order.map(s => s <= n ? seeded[s - 1] : null);
    const rounds = Math.log2(size);
    let prev = [];
    for (let r = 0; r < rounds; r++) {
      const cnt = size >> (r + 1), cur = [];
      for (let i = 0; i < cnt; i++) {
        const m = newMatch({ type: 'main', round: r, idx: i, roundName: roundName(cnt) });
        if (r === 0) { m.aka = slots[2 * i]; m.shiro = slots[2 * i + 1]; }
        cur.push(m); cat.matches.push(m);
      }
      prev.forEach((pm, i) => { pm.next = { id: cur[i >> 1].id, side: i % 2 === 0 ? 'aka' : 'shiro' }; });
      prev = cur;
    }
    // bye
    cat.matches.filter(m => m.round === 0).forEach(m => {
      if (!m.aka || !m.shiro) { const w = m.aka || m.shiro; if (w) finishMatch(cat, m, m.aka ? 'aka' : 'shiro', { decision: 'bye' }); else { m.status = 'done'; m.bye = true; if (m.next) { /* nessuno avanza */ } } }
    });
    // propaga i "vuoti" doppi
    propagateEmpty(cat);
    return cat;
  }
  function propagateEmpty(cat) {
    let changed = true;
    while (changed) {
      changed = false;
      cat.matches.filter(m => m.type === 'main' && m.round > 0 && m.status === 'pending').forEach(m => {
        const feeders = cat.matches.filter(x => x.next && x.next.id === m.id);
        if (feeders.length === 2 && feeders.every(f => f.status === 'done')) {
          if (m.aka && !m.shiro) { finishMatch(cat, m, 'aka', { decision: 'bye' }); changed = true; }
          else if (!m.aka && m.shiro) { finishMatch(cat, m, 'shiro', { decision: 'bye' }); changed = true; }
          else if (!m.aka && !m.shiro) { m.status = 'done'; m.bye = true; changed = true; }
        }
      });
    }
  }
  function getMatch(cat, id) { return (cat.matches || []).find(m => m.id === id); }

  function finishMatch(cat, m, winnerSide, result) {
    result = result || {};
    m.status = 'done'; m.result = result;
    if (winnerSide === 'draw') { m.winner = null; m.loser = null; m.draw = true; }
    else {
      m.winner = m[winnerSide]; m.loser = m[winnerSide === 'aka' ? 'shiro' : 'aka'];
      if (result.decision === 'bye') m.bye = true;
      if (m.next) { const nm = getMatch(cat, m.next.id); if (nm) nm[m.next.side] = m.winner; }
    }
    afterResult(cat);
  }
  function resetMatch(cat, m) { // annulla un risultato (solo se il successivo non è giocato)
    if (m.next) { const nm = getMatch(cat, m.next.id); if (nm && nm.status === 'done' && !nm.bye) return false; if (nm) nm[m.next.side] = null; }
    m.status = 'pending'; m.winner = m.loser = null; m.result = null; m.draw = false;
    if (m.type === 'main') { cat.matches = cat.matches.filter(x => x.type !== 'rep'); cat.repDone = false; }
    cat.ranking = []; cat.status = 'in corso';
    return true;
  }

  function afterResult(cat) {
    if (cat.format === 'recupero' && !cat.repDone) {
      const fin = cat.matches.find(m => m.type === 'main' && m.roundName === 'Finale');
      if (fin && fin.aka && fin.shiro) { buildRepechage(cat, fin); cat.repDone = true; }
    }
    computeRanking(cat);
  }
  function buildRepechage(cat, fin) {
    cat.repBronze = {};
    ['aka', 'shiro'].forEach((side, gi) => {
      const F = fin[side];
      const losers = cat.matches.filter(m => m.type === 'main' && m.winner === F && m.loser && m !== fin).sort((a, b) => a.round - b.round).map(m => m.loser);
      const g = gi === 0 ? 'A' : 'B';
      if (losers.length === 1) { cat.repBronze[g] = losers[0]; return; }
      let prev = null;
      for (let i = 1; i < losers.length; i++) {
        const m = newMatch({ type: 'rep', group: g, round: i - 1, idx: i - 1, roundName: 'Recupero ' + g + (losers.length > 2 ? ' ' + i : '') });
        if (i === 1) { m.aka = losers[0]; m.shiro = losers[1]; } else { m.shiro = losers[i]; prev.next = { id: m.id, side: 'aka' }; }
        cat.matches.push(m); prev = m;
      }
      if (prev) prev.isBronze = true;
    });
  }
  function computeRanking(cat) {
    const rk = [];
    if (cat.format === 'girone') {
      const st = rrStandings(cat);
      if (cat.matches.every(m => m.status === 'done')) { st.forEach((s, i) => rk.push({ pos: s.pos || i + 1, id: s.id, note: s.pts + ' pt' })); }
    } else if (cat.format === 'finale' || cat.format === 'eliminazione' || cat.format === 'recupero') {
      const fin = cat.matches.find(m => m.type === 'main' && m.roundName === 'Finale');
      if (fin && fin.status === 'done' && fin.winner) {
        rk.push({ pos: 1, id: fin.winner }); if (fin.loser) rk.push({ pos: 2, id: fin.loser });
        if (cat.format === 'eliminazione') {
          cat.matches.filter(m => m.type === 'main' && m.roundName === 'Semifinali' && m.loser).forEach(m => rk.push({ pos: 3, id: m.loser }));
        } else if (cat.format === 'recupero') {
          ['A', 'B'].forEach(g => {
            if (cat.repBronze && cat.repBronze[g]) rk.push({ pos: 3, id: cat.repBronze[g] });
            const b = cat.matches.find(m => m.type === 'rep' && m.group === g && m.isBronze);
            if (b && b.winner) rk.push({ pos: 3, id: b.winner });
          });
        }
      }
      const pending = cat.matches.some(m => m.status !== 'done');
      if (pending) { cat.ranking = rk; cat.status = 'in corso'; return; }
    }
    cat.ranking = rk;
    const done = (cat.matches || []).length > 0 && cat.matches.every(m => m.status === 'done');
    if (done && rk.length) cat.status = 'conclusa';
  }
  function matchPoints(m, side) { const r = m.result || {}; return side === 'aka' ? (r.akaPts || 0) : (r.shiroPts || 0); }
  function rrStandings(cat) {
    const tab = {};
    (cat.rrOrder || cat.athleteIds).forEach(id => tab[id] = { id, pts: 0, v: 0, p: 0, s: 0, score: 0 });
    cat.matches.filter(m => m.status === 'done').forEach(m => {
      const A = tab[m.aka], S = tab[m.shiro]; if (!A || !S) return;
      A.score += matchPoints(m, 'aka'); S.score += matchPoints(m, 'shiro');
      if (m.draw) { A.pts++; S.pts++; A.p++; S.p++; }
      else if (m.winner === m.aka) { A.pts += 2; A.v++; S.s++; } else { S.pts += 2; S.v++; A.s++; }
    });
    const arr = Object.values(tab);
    const h2h = (x, y) => { const m = cat.matches.find(m => m.status === 'done' && !m.draw && ((m.aka === x.id && m.shiro === y.id) || (m.aka === y.id && m.shiro === x.id))); return m ? (m.winner === x.id ? -1 : 1) : 0; };
    arr.sort((x, y) => y.pts - x.pts || (cat.rrTie && (cat.rrTie[x.id] || 0) - (cat.rrTie[y.id] || 0)) || h2h(x, y) || y.score - x.score);
    arr.forEach((s, i) => s.pos = i + 1);
    return arr;
  }

  // ---------- Kata a punteggio ----------
  function buildKataRounds(order, F, settings) {
    const n = order.length, plan = [];
    if (n <= F) plan.push({ name: 'Finale', take: null });
    else if (n <= 3 * F) plan.push({ name: 'Eliminatorie', take: F }, { name: 'Finale', take: null });
    else plan.push({ name: 'Eliminatorie', take: 2 * F }, { name: 'Semifinale', take: F }, { name: 'Finale', take: null });
    const rounds = plan.map(p => ({ name: p.name, take: p.take, scale: (settings.kataScales || DEFAULT_SETTINGS.kataScales)[p.name], entries: [], open: false }));
    rounds[0].entries = order.map(id => ({ id, scores: [], done: false }));
    rounds[0].open = true;
    return { F, judges: settings.kataJudges || 5, rounds, current: 0 };
  }
  function kataEval(scores) {
    const s = scores.map(Number).filter(x => !isNaN(x));
    if (s.length < 3) return { total: s.reduce((a, b) => a + b, 0), tb1: 0, tb2: 0 };
    const sorted = s.slice().sort((a, b) => a - b);
    const mid = sorted.slice(1, -1);
    const total = round2(mid.reduce((a, b) => a + b, 0));
    return { total, tb1: round2(total + sorted[0]), tb2: round2(total + sorted[0] + sorted[sorted.length - 1]), low: sorted[0], high: sorted[sorted.length - 1] };
  }
  function round2(x) { return Math.round(x * 100) / 100; }
  function kataRoundRanking(round) {
    return round.entries.filter(e => e.done).map(e => Object.assign({}, e, e.dq ? { total: 0, tb1: 0, tb2: 0 } : kataEval(e.scores)))
      .sort((a, b) => b.total - a.total || b.tb1 - a.tb1 || b.tb2 - a.tb2 || (a.tie || 0) - (b.tie || 0));
  }
  function kataAdvance(cat) { // chiude il turno corrente e prepara il successivo
    const k = cat.kata, r = k.rounds[k.current];
    if (r.entries.some(e => !e.done)) return { ok: false, msg: 'Ci sono atleti senza punteggio nel turno.' };
    const rk = kataRoundRanking(r);
    r.open = false; r.closed = true;
    if (k.current === k.rounds.length - 1) { kataFinalRanking(cat); return { ok: true, finished: true }; }
    const next = k.rounds[k.current + 1];
    const qualified = rk.slice(0, r.take);
    next.entries = qualified.reverse().map(e => ({ id: e.id, scores: [], done: false })); // dal peggiore al migliore
    next.open = true; k.current++;
    return { ok: true };
  }
  function kataFinalRanking(cat) {
    const k = cat.kata, out = [], seen = new Set();
    for (let i = k.rounds.length - 1; i >= 0; i--) {
      kataRoundRanking(k.rounds[i]).forEach(e => { if (!seen.has(e.id)) { seen.add(e.id); out.push({ pos: out.length + 1, id: e.id, note: e.total.toFixed(1) + (i < k.rounds.length - 1 ? ' (' + k.rounds[i].name + ')' : '') }); } });
    }
    cat.ranking = out; cat.status = 'conclusa';
  }

  // ---------- incontro di kumite (stato live) ----------
  function newBout(cat, m, settings, byId) {
    const type = cat.kumiteType || 'sanbon';
    const isFinals = m.type === 'main' && (m.roundName === 'Finale' || m.roundName === 'Semifinali');
    const d = settings.durations || DEFAULT_SETTINGS.durations;
    const dur = type === 'nihon' ? d.nihon : (isFinals ? d.finals : d.elim);
    const side = () => ({ pts: 0, jogai: 0, atenai: 0, mubobi: 0, chui: 0, hansoku: false, kiken: false });
    return { catId: cat.id, matchId: m.id, kind: cat.matchKind || 'kumite', type, duration: dur * 1000, timeLeft: dur * 1000, running: false, phase: 'regolare', atoshi: false, aka: side(), shiro: side(), winner: null, decision: null, flags: { aka: 0, shiro: 0 }, startedAt: null };
  }
  function boutCheck(b) { // ritorna side vincitore se raggiunto il punteggio pieno o squalifica
    const lim = WIN_POINTS[b.type] || 6;
    if (b.aka.hansoku || b.aka.kiken) return { winner: 'shiro', decision: b.aka.hansoku ? 'hansoku' : 'kiken' };
    if (b.shiro.hansoku || b.shiro.kiken) return { winner: 'aka', decision: b.shiro.hansoku ? 'hansoku' : 'kiken' };
    if (b.phase === 'encho') { if (b.aka.pts > b.enchoBase.aka) return { winner: 'aka', decision: 'encho-sen' }; if (b.shiro.pts > b.enchoBase.shiro) return { winner: 'shiro', decision: 'encho-sen' }; }
    if (b.aka.pts >= lim) return { winner: 'aka', decision: 'punti' };
    if (b.shiro.pts >= lim) return { winner: 'shiro', decision: 'punti' };
    return null;
  }
  function boutTimeUp(b, isRoundRobin) { // cosa fare a fine tempo
    const a = b.aka.pts, s = b.shiro.pts;
    if (b.phase === 'encho') return { action: 'hantei', msg: 'Encho-sen senza punti: decisione arbitrale (Hantei).' };
    if (a !== s) {
      const lead = a > s ? 'aka' : 'shiro';
      if (b[lead].chui > 0) return { action: 'hantei', suggest: lead, msg: 'Vantaggio con penalità a carico: Hantei obbligatorio.' };
      return { action: 'win', winner: lead, decision: 'punti' };
    }
    if (isRoundRobin) return { action: 'hikiwake', msg: 'Parità nel girone: Hikiwake (pareggio) o Hantei.' };
    if (b.type === 'sanbon') return { action: 'encho', msg: 'Parità: Encho-sen di 1 minuto (vince il primo punto).' };
    if (b.type === 'ippon') return b.phase === 'sai' ? { action: 'hantei', msg: 'Parità anche nel Sai Shiai: Hantei.' } : { action: 'sai', msg: 'Parità: Sai Shiai (nuovo incontro).' };
    return { action: 'hantei', msg: 'Parità: Hantei.' };
  }
  function applyJogai(b, side) { b[side].jogai++; return 'Jogai ' + b[side].jogai; }
  function splitPts(p) { return { ippon: Math.floor(p / 2), wazaari: p % 2 }; }

  // ---------- snapshot pubblico ----------
  function athleteName(a) { return a ? (a.cognome + ' ' + a.nome).trim() : ''; }
  function publicSnapshot(state) {
    const byId = {}; state.athletes.forEach(a => byId[a.id] = a);
    const nm = id => id ? { n: athleteName(byId[id]), c: (byId[id] || {}).societa || '' } : null;
    return {
      info: { name: state.tournament.name || 'Torneo', date: state.tournament.date || '', place: state.tournament.place || '', updated: Date.now() },
      categories: (state.categories || []).map(c => ({
        id: c.id, num: c.num, name: c.name, discipline: c.discipline, format: c.format || '', status: c.status, count: c.athleteIds.length,
        athletes: c.athleteIds.map(nm),
        matches: (c.matches || []).filter(m => !(m.bye && !m.aka && !m.shiro)).map(m => ({ id: m.id, t: m.type, r: m.round, i: m.idx, rn: m.roundName, a: nm(m.aka), s: nm(m.shiro), w: m.winner ? (m.winner === m.aka ? 'aka' : 'shiro') : (m.draw ? 'draw' : null), bye: !!m.bye, sc: m.result ? [m.result.akaPts || 0, m.result.shiroPts || 0, m.result.decision || ''] : null })),
        kata: c.kata ? c.kata.rounds.map(r => ({ name: r.name, entries: kataRoundRanking(r).map(e => ({ n: nm(e.id), t: e.total, s: e.scores })).concat(r.entries.filter(e => !e.done).map(e => ({ n: nm(e.id), t: null }))) })) : null,
        ranking: (c.ranking || []).map(r => ({ p: r.pos, a: nm(r.id), note: r.note || '' }))
      }))
    };
  }

  const api = { DEFAULT_SETTINGS, WIN_POINTS, KUMITE_LABEL, uid, strip, shuffle, parseDate, isoDate, ageAt, parseAthleteRows, mapHeaders, ageClassOf, beltGroupOf, weightLabel, generateCategories, categoryName, drawCategory, seedOrder, getMatch, finishMatch, resetMatch, computeRanking, rrStandings, buildKataRounds, kataEval, kataRoundRanking, kataAdvance, kataFinalRanking, newBout, boutCheck, boutTimeUp, applyJogai, splitPts, athleteName, publicSnapshot, nextPow2 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Core = api;
})(typeof window !== 'undefined' ? window : globalThis);
