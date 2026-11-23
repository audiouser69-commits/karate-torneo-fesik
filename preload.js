const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  openBoard: (w) => ipcRenderer.invoke('board:open', w),
  closeBoard: () => ipcRenderer.invoke('board:close'),
  moveBoard: () => ipcRenderer.invoke('board:move'),
  displays: () => ipcRenderer.invoke('displays'),
  sendBoard: (d) => ipcRenderer.send('board:update', d),
  onBoard: (cb) => ipcRenderer.on('board:update', (e, d) => cb(d)),
  onBoardReady: (cb) => ipcRenderer.on('board:ready', cb),
  onBoardClosed: (cb) => ipcRenderer.on('board:closed', cb),
  onDisplays: (cb) => ipcRenderer.on('displays', (e, n) => cb(n)),
  openExcel: () => ipcRenderer.invoke('file:openExcel'),
  saveAs: (o) => ipcRenderer.invoke('file:saveAs', o),
  openJson: () => ipcRenderer.invoke('file:openJson'),
  autosaveWrite: (d) => ipcRenderer.invoke('autosave:write', d),
  autosaveRead: () => ipcRenderer.invoke('autosave:read'),
  saveTemplate: () => ipcRenderer.invoke('template:save'),
  liveTemplate: () => ipcRenderer.invoke('liveTemplate'),
  openExternal: (u) => ipcRenderer.invoke('openExternal', u),
  webOpen: (o) => ipcRenderer.invoke('web:open', o),
  webDetect: (k) => ipcRenderer.invoke('web:detect', k),
  netlifyDeploy: (o) => ipcRenderer.invoke('netlify:deploy', o)
});
