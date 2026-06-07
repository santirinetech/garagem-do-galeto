const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
const path = require('path');
const fs = require('fs');
const ioClient = require('socket.io-client');
const { startServer } = require('../server'); 
const { initWhatsApp, getBotStatus, enviarMensagemPainel } = require('../whatsapp-bot');
const { db } = require('../database');

const PORT = process.env.PORT || 3000;
// Defina a URL do seu Railway aqui (ou via .env)
const RAILWAY_URL = process.env.RAILWAY_URL || 'https://www.garagemdomarcao.online'; 

let mainWindow;
let workerWindow; // Janela oculta para impressão

// ── Protocolo customizado para servir imagens locais com segurança ──────────
protocol.registerSchemesAsPrivileged([
    { scheme: 'app-media', privileges: { secure: true, standard: true, supportFetchAPI: true } }
]);

// Inicializa o Servidor Web Local (Comentado para forçar o uso da nuvem Railway)
// const server = startServer(null);

function createWindow() {
    try {
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
        // Agora o Electron consome 100% da Nuvem para o Painel, evitando dados locais antigos
        const targetUrl = `${RAILWAY_URL.replace(/\/$/, '')}/login.html`;
        console.log('[ELECTRON] Carregando Dashboard da Nuvem:', targetUrl);
        
        // Limpa o cache para garantir que sempre baixe o dashboard.js mais recente da nuvem (Railway)
        mainWindow.webContents.session.clearCache().then(() => {
            mainWindow.loadURL(targetUrl);
        });
    } catch (e) {
        console.error('[ERRO] Falha ao criar a janela principal:', e.message);
    }
}

function createWorkerWindow() {
    workerWindow = new BrowserWindow({ 
        show: false, 
        webPreferences: { 
            nodeIntegration: true, 
            contextIsolation: false 
        } 
    });
    workerWindow.loadFile(path.join(__dirname, '../../public/cupom.html'));
}

// Lógica de Impressão Térmica Silenciosa (com Try/Catch)
function imprimirPedidoSilencioso(dadosPedido) {
    if (!workerWindow || workerWindow.isDestroyed()) {
        createWorkerWindow();
    }
    
    try {
        workerWindow.webContents.send('render-cupom', dadosPedido);
        
        // Aguarda a renderização do cupom
        setTimeout(() => {
            if (!workerWindow.isDestroyed()) {
                workerWindow.webContents.print({ 
                    silent: true, 
                    printBackground: true,
                    deviceName: '' // Impressora padrão do SO
                }, (success, failureReason) => {
                    if (!success) {
                        console.error('[ERRO IMPRESSÃO] Falha ao imprimir pedido:', failureReason);
                    } else {
                        console.log(`[IMPRESSÃO] Pedido #${dadosPedido.id} impresso com sucesso.`);
                    }
                });
            }
        }, 500);
    } catch (error) {
        console.error('[ERRO] Falha crítica na função de impressão:', error.message);
    }
}

// Permite acionar a impressão também via IPC (se o usuário clicar no botão de reimprimir)
ipcMain.on('solicitar-impressao-automatica', (event, dadosPedido) => {
    imprimirPedidoSilencioso(dadosPedido);
});

// ── INICIALIZAÇÃO DO WHATSAPP BOT NO ELECTRON ──────────
function inicializarBotLocal() {
    try {
        console.log('[BOT] Inicializando WhatsApp Bot localmente no Electron...');
        
        const mockEmitUpdate = () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('atualizar-dashboard'); };
        const mockBroadcastWppEvent = (evt) => { 
            console.log(`[BOT EVENT] ${evt.type}`);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('wpp-event', evt);
            }
        };
        
        initWhatsApp(db, mockEmitUpdate, mockBroadcastWppEvent);
    } catch (e) {
        console.error('[ERRO] Falha ao inicializar o Bot localmente:', e);
    }
}

ipcMain.handle('get-wpp-status', () => {
    const status = getBotStatus();
    console.log('[IPC] Dashboard solicitou get-wpp-status. isReady:', status.isReady, '| Tem QR?', !!status.qrCodeDataUrl, '| Erro:', status.errorMessage);
    return status;
});

// ── CONEXÃO COM O SERVIDOR RAILWAY VIA SOCKET.IO ──────────
function setupSocketIO() {
    console.log(`[SOCKET] Conectando ao servidor Railway: ${RAILWAY_URL}...`);
    
    const socket = ioClient(RAILWAY_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity
    });

    socket.on('connect', () => {
        console.log('[SOCKET] ✅ Conectado com sucesso ao servidor Railway!');
    });

    socket.on('disconnect', () => {
        console.warn('[SOCKET] ⚠️ Desconectado do Railway. Tentando reconectar automaticamente...');
    });

    socket.on('painel:novo-pedido', (pedido) => {
        console.log(`[SOCKET] 🍕 Novo pedido recebido (#${pedido.id}) via Railway Socket!`);
        
        if (lastPollId === -1 || pedido.id > lastPollId) {
            lastPollId = pedido.id;
        }
        
        if (mainWindow) {
            mainWindow.webContents.send('atualizar-dashboard', pedido);
        }
        imprimirPedidoSilencioso(pedido);
    });
}

// ── FALLBACK / CONTINGÊNCIA (HTTP POLLING) ──────────
let lastPollId = -1; // -1 indica que ainda não foi inicializado
function setupContingenciaPolling() {
    setInterval(async () => {
        try {
            const res = await net.fetch(`${RAILWAY_URL}/api/pedidos/hoje`);
            if (res.ok) {
                const pedidos = await res.json();
                
                // Inicializa o ID máximo na primeira execução para não reimprimir pedidos antigos ao abrir o app
                if (lastPollId === -1) {
                    lastPollId = pedidos.length > 0 ? Math.max(...pedidos.map(p => p.id)) : 0;
                    return;
                }

                const pendentes = pedidos.filter(p => p.status === 'Pendente' || p.status === 'pendente');
                
                let novosPedidos = false;
                pendentes.forEach(p => {
                    if (p.id > lastPollId) {
                        console.log(`[CONTINGÊNCIA] Pedido pendente não processado (#${p.id}) encontrado via HTTP Polling.`);
                        
                        // Formata o pedido para os nomes de colunas que o cupom.html espera (evita valores null)
                        const pFormatado = {
                            id: p.id,
                            nome: p.cliente_nome,
                            telefone: p.cliente_tel,
                            pedido: p.pedido_descricao || p.pedido_desc,
                            itens: typeof p.itens === 'string' ? JSON.parse(p.itens || '[]') : (p.itens || []),
                            taxa: p.taxa_aplicada || 0,
                            data_hora: p.data_hora,
                            total: p.total,
                            pagamento: p.forma_pagamento,
                            endereco: p.endereco_entrega || p.endereco
                        };

                        if (mainWindow) mainWindow.webContents.send('atualizar-dashboard', pFormatado);
                        imprimirPedidoSilencioso(pFormatado);
                        lastPollId = p.id;
                        novosPedidos = true;
                    }
                });

                if (pedidos.length > 0) {
                    const maxId = Math.max(...pedidos.map(p => p.id));
                    if (maxId > lastPollId && !novosPedidos) {
                        lastPollId = maxId;
                    }
                }
            }
        } catch (error) {
            console.error('[CONTINGÊNCIA ERRO] Falha ao realizar polling na API do Railway:', error.message);
        }
    }, 30000); // 30 segundos
}

app.whenReady().then(() => {
    const uploadsBase = path.join(__dirname, '../../public/uploads');
    protocol.handle('app-media', (req) => {
        const url = new URL(req.url);
        const relativePath = url.hostname + decodeURIComponent(url.pathname);
        const filePath = path.join(__dirname, '../../public', relativePath);
        if (!filePath.startsWith(path.join(__dirname, '../../public'))) {
            return new Response('Forbidden', { status: 403 });
        }
        if (!fs.existsSync(filePath)) {
            return new Response('Not Found', { status: 404 });
        }
        return net.fetch(`file://${filePath}`);
    });

    createWindow();
    createWorkerWindow();
    
    inicializarBotLocal();
    setupSocketIO();
    setupContingenciaPolling();
});

app.on('window-all-closed', () => { 
    if (process.platform !== 'darwin') app.quit(); 
});
