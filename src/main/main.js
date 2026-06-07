const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { startServer } = require('../server'); 

const PORT = process.env.PORT || 3000;
let mainWindow;

// ── Protocolo customizado para servir imagens locais com segurança ──────────
// Registrar ANTES de app.whenReady()
protocol.registerSchemesAsPrivileged([
    { scheme: 'app-media', privileges: { secure: true, standard: true, supportFetchAPI: true } }
]);

// Inicializa o Servidor Web
const server = startServer(null);

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1366,
        height: 800,
        minWidth: 1100,
        title: "Galeto Master — Sistema de Gestão",
        icon: path.join(__dirname, '../../public/img/icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js') 
        },
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadURL(`http://localhost:${PORT}/login.html`);
}

// Lógica de Impressão Térmica Automática
ipcMain.on('solicitar-impressao-automatica', (event, dadosPedido) => {
    let tempPrintWindow = new BrowserWindow({ 
        show: false, 
        webPreferences: { 
            nodeIntegration: true, 
            contextIsolation: false 
        } 
    });

    tempPrintWindow.loadFile(path.join(__dirname, '../../public/cupom.html'));
    
    tempPrintWindow.webContents.on('did-finish-load', () => {
        tempPrintWindow.webContents.send('render-cupom', dadosPedido);
        
        // Aguarda 500ms para a renderização do JS no cupom.html concluir
        setTimeout(() => {
            if (!tempPrintWindow.isDestroyed()) {
                tempPrintWindow.webContents.print({ 
                    silent: true, 
                    printBackground: true,
                    deviceName: '' // Deixa vazio para usar a impressora padrão do Windows
                }, (success, failureReason) => {
                    if (!success) console.error('Falha na impressão térmica:', failureReason);
                    if (!tempPrintWindow.isDestroyed()) tempPrintWindow.close(); // Fecha a janela após imprimir
                });
            }
        }, 500);
    });
});

app.whenReady().then(() => {
    // Servir imagens da pasta uploads/ com o protocolo seguro app-media://
    // Uso no frontend: <img src="app-media://uploads/arquivo.jpg">
    const uploadsBase = path.join(__dirname, '../../public/uploads');
    protocol.handle('app-media', (req) => {
        const url = new URL(req.url);
        // O hostname é a pasta (ex: 'uploads'), pathname é o arquivo
        const relativePath = url.hostname + decodeURIComponent(url.pathname);
        const filePath = path.join(__dirname, '../../public', relativePath);
        // Segurança: não permitir path traversal
        if (!filePath.startsWith(path.join(__dirname, '../../public'))) {
            return new Response('Forbidden', { status: 403 });
        }
        if (!fs.existsSync(filePath)) {
            return new Response('Not Found', { status: 404 });
        }
        const ext = path.extname(filePath).toLowerCase();
        const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' };
        return net.fetch(`file://${filePath}`);
    });

    createWindow();
});

app.on('window-all-closed', () => { 
    if (process.platform !== 'darwin') app.quit(); 
});
