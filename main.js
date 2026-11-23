const { app, BrowserWindow, ipcMain, dialog, screen, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let control = null, board = null;
const autosaveFile = () => path.join(app.getPath('userData'), 'torneo-autosave.json');

function createControl() {
  control = new BrowserWindow({
    width: 1400, height: 900, minWidth: 1100, minHeight: 700, title: 'Karate Torneo FESIK',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  });
  control.loadFile(path.join(__dirname, 'app', 'index.html'));
  control.on('closed', () => { control = null; if (board) board.close(); });
}

function externalDisplay() {
  const prim = screen.getPrimaryDisplay();
  return screen.getAllDisplays().find(d => d.id !== prim.id) || null;
}

function openBoard(forceWindowed) {
  if (board) { board.focus(); return; }
  const ext = externalDisplay();
  const opts = {
    title: 'Tabellone', backgroundColor: '#000000', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true }
  };
  if (ext && !forceWindowed) {
    Object.assign(opts, { x: ext.bounds.x, y: ext.bounds.y, width: ext.bounds.width, height: ext.bounds.height, fullscreen: true, frame: false });
  } else {
    Object.assign(opts, { width: 1280, height: 720 });
  }
  board = new BrowserWindow(opts);
  board.setMenuBarVisibility(false);
  board.loadFile(path.join(__dirname, 'app', 'scoreboard.html'));
  board.on('closed', () => { board = null; if (control) control.webContents.send('board:closed'); });
  board.webContents.on('did-finish-load', () => { if (control) control.webContents.send('board:ready'); });
  board.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') board.setFullScreen(!board.isFullScreen());
    if (input.type === 'keyDown' && input.key === 'Escape' && board.isFullScreen()) board.setFullScreen(false);
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu', label: 'Karate Torneo FESIK' }] : []),
    { label: 'File', submenu: [{ role: 'reload', label: 'Ricarica' }, { role: 'toggleDevTools', label: 'Strumenti sviluppatore' }, { type: 'separator' }, { role: 'quit', label: 'Esci' }] },
    { label: 'Modifica', submenu: [{ role: 'undo', label: 'Annulla' }, { role: 'redo', label: 'Ripeti' }, { type: 'separator' }, { role: 'cut', label: 'Taglia' }, { role: 'copy', label: 'Copia' }, { role: 'paste', label: 'Incolla' }, { role: 'selectAll', label: 'Seleziona tutto' }] },
    { label: 'Visualizza', submenu: [{ role: 'zoomIn', label: 'Ingrandisci' }, { role: 'zoomOut', label: 'Riduci' }, { role: 'resetZoom', label: 'Zoom 100%' }, { role: 'togglefullscreen', label: 'Schermo intero' }] }
  ]));
  createControl();
  screen.on('display-added', () => control && control.webContents.send('displays', screen.getAllDisplays().length));
  screen.on('display-removed', () => control && control.webContents.send('displays', screen.getAllDisplays().length));
});
app.on('window-all-closed', () => app.quit());

ipcMain.handle('board:open', (e, windowed) => { openBoard(windowed); return true; });
ipcMain.handle('board:close', () => { if (board) board.close(); return true; });
ipcMain.handle('board:move', () => {
  if (!board) return false;
  const displays = screen.getAllDisplays();
  const cur = screen.getDisplayMatching(board.getBounds());
  const idx = displays.findIndex(d => d.id === cur.id);
  const nxt = displays[(idx + 1) % displays.length];
  board.setFullScreen(false);
  board.setBounds({ x: nxt.bounds.x + 50, y: nxt.bounds.y + 50, width: 1280, height: 720 });
  setTimeout(() => board && board.setFullScreen(true), 300);
  return true;
});
ipcMain.handle('displays', () => screen.getAllDisplays().length);
ipcMain.on('board:update', (e, data) => { if (board) board.webContents.send('board:update', data); });

ipcMain.handle('file:openExcel', async () => {
  const r = await dialog.showOpenDialog(control, { title: 'Importa atleti da Excel', filters: [{ name: 'Excel / CSV', extensions: ['xlsx', 'xls', 'csv', 'ods'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths.length) return null;
  return { name: path.basename(r.filePaths[0]), data: fs.readFileSync(r.filePaths[0]).toString('base64') };
});
ipcMain.handle('file:saveAs', async (e, { defaultName, data, base64, filters }) => {
  const r = await dialog.showSaveDialog(control, { defaultPath: defaultName, filters: filters || [] });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, base64 ? Buffer.from(data, 'base64') : data);
  return r.filePath;
});
ipcMain.handle('file:openJson', async () => {
  const r = await dialog.showOpenDialog(control, { title: 'Apri torneo', filters: [{ name: 'Torneo', extensions: ['json'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths.length) return null;
  return fs.readFileSync(r.filePaths[0], 'utf8');
});
ipcMain.handle('autosave:write', (e, data) => { try { fs.writeFileSync(autosaveFile(), data); return true; } catch (err) { return false; } });
ipcMain.handle('autosave:read', () => { try { return fs.readFileSync(autosaveFile(), 'utf8'); } catch (err) { return null; } });
ipcMain.handle('template:path', () => path.join(__dirname, 'modello_atleti.xlsx'));
ipcMain.handle('template:save', async () => {
  const src = path.join(__dirname, 'modello_atleti.xlsx');
  const r = await dialog.showSaveDialog(control, { defaultPath: 'modello_atleti.xlsx', filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, fs.readFileSync(src)); return r.filePath;
});
ipcMain.handle('liveTemplate', () => {
  const html = fs.readFileSync(path.join(__dirname, 'live', 'index.html'), 'utf8');
  const js = ['pixelart.js', 'infoscreen.js'].map(f => fs.readFileSync(path.join(__dirname, 'app', f), 'utf8')).join('\n');
  return html.split('<!--__PIXELART__-->').join('<script>' + js + '</script>');
});
ipcMain.handle('openExternal', (e, url) => shell.openExternal(url));

// ---------- finestra browser interna per gli account (Firebase, Netlify) ----------
const webWins = {};
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/' + process.versions.chrome + ' Safari/537.36';
ipcMain.handle('web:open', (e, { key, url, title }) => {
  let w = webWins[key];
  if (w && !w.isDestroyed()) { w.loadURL(url); w.show(); w.focus(); return true; }
  w = new BrowserWindow({ width: 1200, height: 820, title: title || 'Account', parent: undefined, autoHideMenuBar: true,
    webPreferences: { partition: 'persist:accounts', contextIsolation: true, sandbox: true } });
  w.webContents.setUserAgent(CHROME_UA);
  w.webContents.setWindowOpenHandler(({ url }) => { w.loadURL(url); return { action: 'deny' }; });
  w.on('page-title-updated', (ev) => { ev.preventDefault(); w.setTitle((title || 'Account') + ' — ' + w.webContents.getURL().replace(/^https?:\/\//, '').slice(0, 60)); });
  w.loadURL(url, { userAgent: CHROME_UA });
  webWins[key] = w;
  w.on('closed', () => { delete webWins[key]; });
  return true;
});
// legge il testo della pagina aperta per trovare URL del database, secret o token
ipcMain.handle('web:detect', async (e, key) => {
  const w = webWins[key];
  if (!w || w.isDestroyed()) return { error: 'Finestra non aperta' };
  try {
    const txt = await w.webContents.executeJavaScript(`(function(){
      let t = document.body ? document.body.innerText : '';
      document.querySelectorAll('input,textarea').forEach(i => { if (i.value) t += '\\n' + i.value; });
      return t + '\\n' + location.href; })()`);
    const urlM = txt.match(/https:\/\/[a-z0-9-]+(?:-default-rtdb)?\.[a-z0-9-]+\.firebasedatabase\.app|https:\/\/[a-z0-9-]+\.firebaseio\.com/i);
    const secrets = (txt.match(/(?:^|[^A-Za-z0-9])([A-Za-z0-9]{40})(?![A-Za-z0-9])/g) || []).map(x => x.replace(/^[^A-Za-z0-9]/, '')).filter(x => /\d/.test(x) && /[a-z]/.test(x) && /[A-Z]/.test(x));
    const tokM = txt.match(/nfp_[A-Za-z0-9]{20,}/);
    return { url: urlM ? urlM[0] : null, secret: secrets[0] || null, netlifyToken: tokM ? tokM[0] : null, page: w.webContents.getURL() };
  } catch (err) { return { error: err.message }; }
});
// ---------- pubblicazione della pagina live su Netlify (API, metodo digest) ----------
ipcMain.handle('netlify:deploy', async (e, { token, siteId, name, html }) => {
  const H = { Authorization: 'Bearer ' + token };
  const api = async (method, url, body, extra) => {
    const r = await fetch('https://api.netlify.com/api/v1' + url, { method, headers: Object.assign({}, H, extra || (body && typeof body === 'string' ? { 'Content-Type': 'application/json' } : {})), body });
    const txt = await r.text(); let json = null; try { json = JSON.parse(txt); } catch (_) { }
    if (!r.ok) { const err = new Error((json && (json.message || json.error)) || ('HTTP ' + r.status)); err.status = r.status; throw err; }
    return json;
  };
  try {
    let site = null;
    if (siteId) { try { site = await api('GET', '/sites/' + siteId); } catch (err) { if (err.status !== 404) throw err; } }
    if (!site) {
      try { site = await api('POST', '/sites', JSON.stringify({ name })); }
      catch (err) { if (err.status === 422) site = await api('POST', '/sites', JSON.stringify({})); else throw err; }
    }
    const buf = Buffer.from(html, 'utf8');
    const sha = crypto.createHash('sha1').update(buf).digest('hex');
    const dep = await api('POST', '/sites/' + site.id + '/deploys', JSON.stringify({ files: { '/index.html': sha } }));
    if (!dep.required || dep.required.includes(sha)) {
      await api('PUT', '/deploys/' + dep.id + '/files/index.html', buf, { 'Content-Type': 'application/octet-stream' });
    }
    return { ok: true, siteId: site.id, url: site.ssl_url || site.url || dep.ssl_url, admin: site.admin_url };
  } catch (err) {
    return { ok: false, error: err.status === 401 ? 'Token Netlify non valido o scaduto' : err.message };
  }
});
