<<<<<<< HEAD
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
=======
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { startServer } = require('../server'); // Caminho atualizado para o servidor unificado

const PORT = process.env.PORT || 3000;
let mainWindow;
let printWindow; // Janela oculta para impressão térmica

// Inicializa o Servidor Web
const server = startServer(null); // Passaremos a janela depois se necessário
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1366,
        height: 800,
        minWidth: 1100,
        title: "Galeto Master — Sistema de Gestão",
<<<<<<< HEAD
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
=======
        icon: path.join(__dirname, '../../public/img/icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js') // Precisaremos de um preload para IPC seguro
        },
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadURL(`http://localhost:${PORT}/index.html`);

    // Quando o servidor sinalizar novo pedido, podemos disparar ações aqui
    // Nota: O server.js já envia 'atualizar-dashboard' via webContents.send se passarmos a mainWindow
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

    const html = `
        <html>
        <body style="font-family: monospace; font-size: 12px; width: 280px; margin: 0; padding: 10px;">
            <div style="text-align: center; font-weight: bold; font-size: 16px;">GARAGEM DO GALETO</div>
            <hr>
            <div style="text-align: center;">PEDIDO #${dadosPedido.id}</div>
            <div style="text-align: center;">${new Date().toLocaleString('pt-BR')}</div>
            <hr>
            <div><b>Cliente:</b> ${dadosPedido.nome}</div>
            <div><b>Tel:</b> ${dadosPedido.telefone}</div>
            <div style="margin-top: 4px;"><b>Entrega:</b> ${dadosPedido.endereco || 'Retirada no Local'}</div>
            <hr>
            <div><b>PEDIDO:</b></div>
            <div style="margin-top: 5px;">• ${dadosPedido.pedido.replace(/,/g, '<br>• ')}</div>
            <hr>
            <div style="font-size: 14px;"><b>TOTAL: R$ ${dadosPedido.total}</b></div>
            <div>Forma Pgto: ${dadosPedido.pagamento}</div>
            <hr>
            <div style="text-align: center; font-size: 10px;">Obrigado pela preferência!</div>
        </body>
        </html>
    `;

    tempPrintWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    
    tempPrintWindow.webContents.on('did-finish-load', () => {
        tempPrintWindow.webContents.print({ 
            silent: true, 
            printBackground: true,
            deviceName: '' // Deixa vazio para usar a impressora padrão do Windows
        }, (success, failureReason) => {
            if (!success) console.error('Falha na impressão:', failureReason);
            tempPrintWindow.close(); // Fecha a janela após imprimir
        });
    });
});

app.whenReady().then(() => {
    createWindow();
    
    // Agora que a janela existe, podemos vinculá-la ao servidor para eventos IPC
    // (Opcional: se o server precisar mandar mensagens diretas via IPC)
});

app.on('window-all-closed', () => { 
    if (process.platform !== 'darwin') app.quit(); 
});
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
