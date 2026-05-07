const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    solicitarImpressao: (dados) => ipcRenderer.send('solicitar-impressao-automatica', dados),
    onAtualizarDashboard: (callback) => ipcRenderer.on('atualizar-dashboard', (_event, value) => callback(value))
});
