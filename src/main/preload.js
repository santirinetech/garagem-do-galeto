const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    solicitarImpressao: (dados) => ipcRenderer.send('solicitar-impressao-automatica', dados),
    onAtualizarDashboard: (callback) => ipcRenderer.on('atualizar-dashboard', (_event, value) => callback(value)),
    onWppEvent: (callback) => ipcRenderer.on('wpp-event', (_event, value) => callback(value)),
    getWppStatus: () => ipcRenderer.invoke('get-wpp-status')
});
