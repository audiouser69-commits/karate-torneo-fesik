/* Schermata informativa (fasi dell'evento) condivisa da tabellone TV, anteprima e pagina live */
(function (root) {
  'use strict';
  const THEMES = {
    rosso: { name: 'Rosso', bg: 'linear-gradient(160deg,#c0170e 0%,#5a0905 70%,#2a0402 100%)', accent: '#ffd23f', ink: '#ffffff' },
    blu: { name: 'Blu notte', bg: 'linear-gradient(160deg,#1d3f94 0%,#0a1840 70%,#040a1c 100%)', accent: '#ffd23f', ink: '#ffffff' },
    nero: { name: 'Nero', bg: 'linear-gradient(160deg,#262b38 0%,#0c0e14 70%,#000 100%)', accent: '#ff4d42', ink: '#ffffff' },
    verde: { name: 'Verde tatami', bg: 'linear-gradient(160deg,#1c8a4c 0%,#0b3d21 70%,#04190d 100%)', accent: '#ffd23f', ink: '#ffffff' },
    oro: { name: 'Oro premiazione', bg: 'radial-gradient(circle at 30% 30%,#a87400 0%,#4a3200 55%,#160e00 100%)', accent: '#fff2a8', ink: '#ffffff' },
    chiaro: { name: 'Chiaro', bg: 'linear-gradient(160deg,#ffffff 0%,#e7eaf0 100%)', accent: '#d7261e', ink: '#111827' }
  };
  const CSS = `
  .ist{position:absolute;inset:0;container-type:size;overflow:hidden;font-family:"Segoe UI",Arial,sans-serif}
  .ist .in{position:absolute;inset:0;display:grid;grid-template-columns:44% 56%;grid-template-rows:1fr auto}
  .ist .fig{position:relative;display:flex;align-items:center;justify-content:center}
  .ist .fig canvas{width:78%;height:78%;image-rendering:pixelated;position:relative;z-index:2}
  .ist .fig.anim canvas{animation:istbob 1.2s steps(2) infinite}
  @keyframes istbob{50%{transform:translateY(-1.2cqh)}}
  .ist .floor{position:absolute;left:12%;right:12%;bottom:9%;height:6cqh;border-radius:50%;background:rgba(0,0,0,.35);filter:blur(.6cqh);z-index:1}
  .ist .txt{display:flex;flex-direction:column;justify-content:center;padding:4cqh 6cqw 4cqh 1cqw;min-width:0}
  .ist .kick{font-size:3cqh;font-weight:800;letter-spacing:.35em;opacity:.8;text-transform:uppercase}
  .ist .tt{font-size:12cqh;font-weight:900;line-height:.98;text-transform:uppercase;margin:1cqh 0 1.5cqh;overflow-wrap:anywhere}
  .ist .tt.long{font-size:8.5cqh}
  .ist .bar{width:14cqw;height:1.2cqh;border-radius:1cqh;margin-bottom:2.2cqh}
  .ist .st{font-size:5.4cqh;font-weight:700;line-height:1.15;margin-bottom:1.6cqh}
  .ist .tx{font-size:3.7cqh;line-height:1.35;opacity:.92;white-space:pre-line;max-height:34cqh;overflow:hidden}
  .ist .prog{grid-column:1/3;display:flex;gap:1cqw;padding:0 3cqw 3cqh;flex-wrap:nowrap;overflow:hidden}
  .ist .ph{flex:1;min-width:0;border-radius:1.4cqh;padding:1.3cqh 1.2cqw;background:rgba(0,0,0,.28);font-size:2.6cqh;line-height:1.2}
  .ist .ph b{display:block;font-size:2.9cqh;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ist .ph i{font-style:normal;opacity:.7;font-size:2.3cqh}
  .ist .ph.done{opacity:.45}
  .ist .ph.cur{color:#111;box-shadow:0 0 0 .4cqh rgba(255,255,255,.6)}
  .ist .ph.cur i{opacity:1;font-weight:800;letter-spacing:.12em}
  .ist .hdr{position:absolute;top:2.6cqh;right:3cqw;left:3cqw;display:flex;justify-content:space-between;font-size:2.6cqh;font-weight:700;opacity:.8;z-index:3}
  .ist.light .ph{background:rgba(0,0,0,.07)}`;
  function injectCss(doc) { doc = doc || document; if (doc.getElementById('ist-css')) return; const s = doc.createElement('style'); s.id = 'ist-css'; s.textContent = CSS; doc.head.appendChild(s); }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function html(d) {
    const th = THEMES[d.theme] || THEMES.rosso;
    const prog = (d.showProgram && d.program && d.program.length) ? `<div class="prog">${d.program.map((p, i) => {
      const cls = i === d.current ? 'cur' : (d.current != null && i < d.current ? 'done' : '');
      return `<div class="ph ${cls}" style="${i === d.current ? 'background:' + th.accent : ''}"><b>${esc(p.name)}</b><i>${i === d.current ? 'IN CORSO' : (cls === 'done' ? '✓ conclusa' : esc(p.time || ''))}</i></div>`;
    }).join('')}</div>` : '';
    const long = String(d.title || '').length > 14;
    return `<div class="ist ${d.theme === 'chiaro' ? 'light' : ''}" style="background:${th.bg};color:${th.ink}">
      <div class="hdr"><span>${esc(d.tournament || '')}</span><span>${d.tatami ? 'TATAMI ' + esc(d.tatami) : ''}</span></div>
      <div class="in"><div class="fig ${d.animate !== false ? 'anim' : ''}"><div class="floor"></div><canvas width="512" height="512"></canvas></div>
      <div class="txt">${d.kicker ? `<div class="kick">${esc(d.kicker)}</div>` : ''}<div class="tt ${long ? 'long' : ''}">${esc(d.title || '')}</div><div class="bar" style="background:${th.accent}"></div>
      ${d.subtitle ? `<div class="st">${esc(d.subtitle)}</div>` : ''}${d.text ? `<div class="tx">${esc(d.text)}</div>` : ''}</div>${prog}</div></div>`;
  }
  const imgCache = {};
  function drawQR(cv, text) {
    const ctx = cv.getContext('2d'); ctx.clearRect(0, 0, cv.width, cv.height);
    if (!root.qrcode || !text) return;
    const q = root.qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(), m = 2, px = Math.floor(Math.min(cv.width, cv.height) / (n + m * 2));
    const size = px * (n + m * 2), x0 = Math.floor((cv.width - size) / 2), y0 = Math.floor((cv.height - size) / 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(x0, y0, size, size); ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect(x0 + (c + m) * px, y0 + (r + m) * px, px, px);
  }
  // monta la schermata in un contenitore e avvia l'animazione; ritorna una funzione di stop
  function mount(el, d) {
    injectCss(el.ownerDocument);
    el.innerHTML = html(d);
    const cv = el.querySelector('canvas');
    let frame = 0, timer = null, img = null;
    const draw = () => d.figure === 'qr' ? drawQR(cv, d.qrUrl) : root.PixelArt.render(cv, d.figure, frame, { image: img });
    if (d.figure === 'custom' && d.custom) {
      img = imgCache[d.custom]; if (!img) { img = new Image(); img.src = d.custom; imgCache[d.custom] = img; }
      if (!img.complete) img.onload = draw;
    }
    draw();
    const f = root.PixelArt.FIGURES[d.figure];
    if (d.animate !== false && f && f.frames.length > 1) timer = setInterval(() => { frame++; draw(); }, 600);
    return () => clearInterval(timer);
  }
  const api = { THEMES, html, mount, injectCss, drawQR };
  root.InfoScreen = api;
})(typeof window !== 'undefined' ? window : globalThis);
