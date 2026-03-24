const { app, BrowserWindow } = require('electron');
const server = require('./server');

const PORT = process.env.PORT || 3000;

// Inicializa o Servidor Web (Express backend + rotas p/ site/painel)
server.listen(PORT, () => {
    console.log(`✅ Servidor Web rodando em http://localhost:${PORT}`);
    console.log(`🌐 Dashboard disponível em http://localhost:${PORT}/dashboard`);
    console.log(`📱 Cardápio disponível em http://localhost:${PORT}/cardapio`);
});

// A configuração abaixo é opcional. Ela abre um app Desktop que
// funciona basicamente como um "Navegador Local" para o sistema web.
// Permitindo que você rode via Desktop ou Acesse remotamente!

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1366,
        height: 800,
        minWidth: 1100,
        title: "Galeto Master — Sistema de Gestão",
        webPreferences: {
            nodeIntegration: false, // Muito mais seguro!
            contextIsolation: true, // Muito mais seguro!
        },
    });

    // Remove menu padrão
    mainWindow.setMenuBarVisibility(false);

    // Carrega o Dashboard diretamente via rede local
    mainWindow.loadURL(`http://localhost:${PORT}/dashboard`);
}

// Só inicia a parte visual se o Electron estiver rodando (Pode ser removido para servidor online dedicado)
if (app) {
    app.whenReady().then(createWindow);

    app.on('window-all-closed', () => { 
        if (process.platform !== 'darwin') app.quit(); 
    });
}
