const { app, BrowserWindow } = require('electron');
const path = require('path');
const { startServer } = require('./src/server');
const { setupIpc } = require('./src/ipc');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1366,
        height: 800,
        minWidth: 1100,
        title: "Galeto Master — Sistema de Gestão",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    });

    // Load static HTML
    mainWindow.loadFile(path.join(__dirname, 'public/index.html'));
    
    // Start Express server and IPC
    startServer(mainWindow);
    setupIpc(mainWindow);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
