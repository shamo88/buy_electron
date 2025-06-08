const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    searchJD: (keyword, matchKeyword) => ipcRenderer.invoke('search-jd', keyword, matchKeyword),
    closeEdgeDriver: () => ipcRenderer.invoke('close-edgedriver'),
    startLoginDriver: () => ipcRenderer.invoke('start-login-driver'),
    getConfig: () => ipcRenderer.invoke('get-config'),
    setConfig: (config) => ipcRenderer.invoke('set-config', config),
    getOrders: () => ipcRenderer.invoke('get-orders'),
    onShowSettings: (cb) => ipcRenderer.on('show-settings', cb)
}); 