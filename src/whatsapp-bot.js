const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

// Estado das conversas (memória temporária do bot)
const userSessions = {};

// Preços simulados ou buscados do DB (Simplificado para o bot)
const menuPrecos = {
    '1': { nome: 'Galeto com Farofa', preco: 55 },
    '2': { nome: 'Salpicão', preco: 25 },
    '3': { nome: 'Feijão Tropeiro', preco: 25 }
};

let qrCodeDataUrl = null;
let isReady = false;
let errorMessage = null;
let wppClient = null;

/**
 * Finaliza o processo de um pedido via WhatsApp, inserindo-o no banco de dados,
 * enviando a confirmação para o cliente e atualizando o estoque e o dashboard.
 * 
 * @param {Object} client Instância do cliente WhatsApp (whatsapp-web.js).
 * @param {string} from O número/ID do chat do cliente.
 * @param {Object} session O objeto de sessão atual do cliente contendo os dados do pedido.
 * @param {Object} db Instância de conexão do banco de dados SQLite.
 * @param {Function} emitUpdateFunc Função para emitir um evento SSE de atualização para o frontend.
 * @returns {Promise<void>}
 */
async function finalizarPedido(client, from, session, db, emitUpdateFunc) {
    const { name, items, total, payment, address, comprovanteUrl, deliveryType, freight, changeFor } = session.order;
    const phone = from; // ex: 552799999999@c.us
    const itemsDesc = items.join(', ');
    
    let pagamentoDesc = payment;
    if (payment === 'Dinheiro' && changeFor && changeFor.toLowerCase() !== 'não' && changeFor.toLowerCase() !== 'nao') {
        pagamentoDesc = `Dinheiro (Troco para R$ ${changeFor})`;
    }

    let enderecoFormatado = deliveryType === 'Entrega' ? `${address} (Taxa: R$ ${freight})` : 'Retirada no Local';

    const payload = {
        cliente_nome: name,
        cliente_tel: phone,
        pedido: itemsDesc,
        itens: JSON.stringify(session.order.items.map(i => ({ produto_nome: i, quantidade: 1, preco_unitario: 0 }))),
        taxa_aplicada: freight,
        total: total,
        forma_pagamento: pagamentoDesc,
        endereco_entrega: enderecoFormatado,
        origem: 'WhatsApp (Robô)'
    };

    try {
        await fetch('https://www.garagemdomarcao.online/api/novo-pedido', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const idPedido = Math.floor(Math.random() * 10000); // Simulando ID já que o Railway é que gera agora
        if (payment === 'Pix') {
            await client.sendMessage(from, `🎉 *PEDIDO RECEBIDO!*\nO seu pedido foi recebido pelo sistema!\n\nRecebemos a foto do seu comprovante. Nossa equipe fará a conferência e já iniciará o preparo!`);
        } else {
            await client.sendMessage(from, `🎉 *PEDIDO CONFIRMADO!*\nO seu pedido já caiu no nosso sistema!\n\nNossa equipe já recebeu e está preparando com muito carinho. O status será atualizado e te avisaremos quando sair para entrega!`);
        }
    } catch (err) {
        console.error('Erro ao enviar pedido do bot para o Railway:', err);
        await client.sendMessage(from, "Ops, ocorreu um erro ao registrar seu pedido. Por favor, tente novamente ou fale com um atendente.");
    }
    session.state = 'IDLE'; // Reseta o estado
    session.order = { items: [], total: 0, payment: '', address: '', name: session.order.name, deliveryType: '', freight: 0, changeFor: '' };
}

/**
 * Envia uma mensagem proativa para um cliente via WhatsApp através do painel.
 * 
 * @param {string} telefone O número de telefone do cliente (com ou sem DDI/DDD).
 * @param {string} mensagem O texto da mensagem a ser enviada.
 * @returns {Promise<boolean>} Retorna true se a mensagem for enviada com sucesso, false caso contrário.
 */
async function enviarMensagemPainel(telefone, mensagem) {
    if (!wppClient || !isReady) return false;
    try {
        let chatId = telefone;
        if (!chatId.includes('@')) {
            let num = chatId.replace(/\D/g, '');
            if (num.length === 10 || num.length === 11) num = '55' + num;
            chatId = num + '@c.us';
        }
        await wppClient.sendMessage(chatId, mensagem);
        return true;
    } catch(e) {
        console.error('Erro ao enviar mensagem pelo robô:', e);
        return false;
    }
}

/**
 * Inicializa a instância do bot de WhatsApp, define os manipuladores de eventos (QR, mensagens) 
 * e controla o fluxo de atendimento automatizado (máquina de estados).
 * 
 * @param {Object} db Instância de conexão do banco de dados SQLite.
 * @param {Function} emitUpdateFunc Função para notificar atualizações ao dashboard.
 * @param {Function} broadcastFunc Função para transmitir eventos do bot (QR code, status) aos clientes conectados via SSE.
 * @returns {void}
 */
function initWhatsApp(db, emitUpdateFunc, broadcastFunc) {
    let authPath = process.env.PORT ? '/app/data/.wwebjs_auth' : './.wwebjs_auth';
    let execPath = undefined;
    
    if (process.env.PORT) {
        const fs = require('fs');
        const linuxPaths = [
            '/nix/var/nix/profiles/default/bin/chromium',
            '/usr/bin/google-chrome', 
            '/usr/bin/chromium-browser', 
            '/usr/bin/chromium', 
            '/usr/bin/google-chrome-stable'
        ];
        for (let p of linuxPaths) {
            if (fs.existsSync(p)) {
                execPath = p;
                break;
            }
        }
        // Se não encontrar nos caminhos padrão, tenta achar o chromium instalado pelo nixPkgs usando o comando 'command -v'
        if (!execPath) {
            try {
                execPath = require('child_process').execSync('command -v chromium').toString().trim();
            } catch (e) {
                execPath = undefined;
            }
        }
    }

    // Correções para o ambiente empacotado do Electron (.exe no Windows)
    try {
        if (process.versions && process.versions.electron) {
            const { app } = require('electron');
            authPath = require('path').join(app.getPath('userData'), '.wwebjs_auth');
            
            // Busca o Chrome nativo apenas se o app estiver empacotado, pois em dev o Chromium do puppeteer funciona melhor
            const fs = require('fs');
            if (process.platform === 'win32' && app.isPackaged) {
                const winPaths = [
                    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
                    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
                    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
                ];
                
                if (process.env.LOCALAPPDATA) {
                    winPaths.push(require('path').join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'));
                    winPaths.push(require('path').join(process.env.LOCALAPPDATA, 'Microsoft\\Edge\\Application\\msedge.exe'));
                }
                
                for (let p of winPaths) {
                    if (fs.existsSync(p)) {
                        execPath = p;
                        break;
                    }
                }
            }
            
            // Fallback usando o puppeteer do node_modules modificado para descompactar do asar
            if (!execPath) {
                const puppeteer = require('puppeteer');
                execPath = puppeteer.executablePath().replace('app.asar', 'app.asar.unpacked');
            }
        }
    } catch (e) {
        console.error('[AVISO] Falha ao configurar caminhos do Bot para Electron:', e.message);
    }

    const client = new Client({
        authStrategy: new LocalAuth({
            dataPath: authPath
        }),
        puppeteer: {
            headless: true,
            executablePath: execPath,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--disable-gpu'
            ]
        }
    });
    wppClient = client;

    client.on('qr', async (qr) => {
        console.log('QR Code recebido. Envie para o frontend.');
        errorMessage = null;
        qrCodeDataUrl = await qrcode.toDataURL(qr);
        isReady = false;
        broadcastFunc({ type: 'qr', data: qrCodeDataUrl });
    });

    client.on('ready', () => {
        console.log('✅ Robô do WhatsApp conectado e pronto!');
        isReady = true;
        qrCodeDataUrl = null;
        errorMessage = null;
        broadcastFunc({ type: 'whatsapp-ready' });
    });

    client.on('disconnected', (reason) => {
        console.log('❌ WhatsApp desconectado:', reason);
        isReady = false;
        qrCodeDataUrl = null;
        errorMessage = 'Desconectado: ' + reason;
        broadcastFunc({ type: 'whatsapp-disconnected', reason });
        // Tentativa de reconexão automática ou limpar LocalAuth
        client.initialize().catch(() => {});
    });

    client.on('message', async msg => {
        const chat = await msg.getChat();
        if (chat.isGroup) return; // Ignora grupos

        const from = msg.from;
        const text = msg.body.trim();

        // Inicializa sessão se não existir
        if (!userSessions[from]) {
            userSessions[from] = { state: 'IDLE', order: { items: [], total: 0, payment: '', address: '', name: msg._data.notifyName || 'Cliente', deliveryType: '', freight: 0, changeFor: '' } };
        }

        const session = userSessions[from];

        if (['cancelar', 'sair', 'menu', 'robo', 'robô'].includes(text.toLowerCase())) {
            session.state = 'IDLE';
            session.order = { items: [], total: 0, payment: '', address: '', name: msg._data.notifyName || 'Cliente', deliveryType: '', freight: 0, changeFor: '' };
            await client.sendMessage(from, "🤖 Atendimento automático reiniciado. Se precisar de algo, é só mandar um 'Oi'.");
            return;
        }

        switch (session.state) {
            case 'IDLE':
                if (['oi', 'olá', 'ola', 'boa noite', 'boa tarde', 'bom dia', 'menu', 'cardapio'].includes(text.toLowerCase())) {
                    await client.sendMessage(from, `Olá, *${session.order.name}*! Sou o assistente virtual da *Garagem do Marcão* 🍗🔥.\n\nSabia que agora ficou muito mais fácil pedir?\n\n🌐 *PELO SITE (Rápido e Prático):*\nAcesse www.garagemdomarcao.online/cardapio.html e monte seu pedido em poucos cliques!\n\n📱 *POR AQUI (WhatsApp):*\nDigite o *número* da opção desejada:\n*1️⃣* - Fazer um Pedido por aqui\n*2️⃣* - Consultar Estoque (O que tem hoje?)\n*3️⃣* - Falar com atendente humano`);
                    session.state = 'MENU';
                } else {
                    await client.sendMessage(from, `Olá! Estamos recebendo pedidos através do nosso site 🌐 www.garagemdomarcao.online/cardapio.html ou por aqui mesmo!\n\nPara iniciar o atendimento automático e ver o cardápio, mande um *"Oi"*. Se quiser interromper o pedido atual, digite *Cancelar*.`);
                }
                break;

            case 'MENU':
                if (text === '1') {
                    let cardapioText = "🍗 *NOSSO CARDÁPIO*\n\nResponda com os *números* dos itens que deseja (Ex: 1, 4, 6).\n\n";
                    for (const [key, item] of Object.entries(menuPrecos)) {
                        cardapioText += `*${key}* - ${item.nome} (R$ ${item.preco.toFixed(2)})\n`;
                    }
                    cardapioText += "\nOu digite *Cancelar* para sair.";
                    await client.sendMessage(from, cardapioText);
                    session.state = 'ORDER_ITEMS';
                } else if (text === '2') {
                    db.all("SELECT item, quantidade FROM estoque", [], async (err, rows) => {
                        if (err) {
                            await client.sendMessage(from, "Desculpe, ocorreu um erro ao consultar o estoque.");
                        } else {
                            let estoqueText = "📦 *ESTOQUE EM TEMPO REAL*\n\n";
                            rows.forEach(r => {
                                estoqueText += `• ${r.item}: ${r.quantidade > 0 ? r.quantidade + ' unidades' : '🚫 ESGOTADO'}\n`;
                            });
                            estoqueText += "\nSe quiser fazer um pedido, digite *1*.";
                            await client.sendMessage(from, estoqueText);
                            session.state = 'MENU';
                        }
                    });
                } else if (text === '3') {
                    await client.sendMessage(from, "Ok! Vou te transferir para um atendente humano. Por favor, aguarde um momento.\n\n*(Se quiser voltar a falar com o robô a qualquer momento, basta digitar *Menu* ou *Sair*)*");
                    session.state = 'HUMAN';
                } else {
                    await client.sendMessage(from, "Opção inválida. Digite 1, 2 ou 3.");
                }
                break;

            case 'ORDER_ITEMS':
                // Extrai números
                const escolhas = text.split(/[\s,]+/).filter(v => menuPrecos[v]);
                if (escolhas.length === 0) {
                    await client.sendMessage(from, "Não entendi os itens. Por favor, digite apenas os *números* separados por vírgula ou espaço. Exemplo: 1, 3, 5");
                    return;
                }
                
                escolhas.forEach(num => {
                    const item = menuPrecos[num];
                    session.order.items.push(item.nome);
                    session.order.total += item.preco;
                });

                await client.sendMessage(from, `Você escolheu:\n${session.order.items.map(i => `• ${i}`).join('\n')}\n*Total parcial: R$ ${session.order.total.toFixed(2)}*\n\nSe quiser adicionar mais itens, digite os números. Se já terminou, digite *OK*.`);
                session.state = 'ORDER_CONFIRM_ITEMS';
                break;

            case 'ORDER_CONFIRM_ITEMS':
                if (text.toLowerCase() === 'ok' || text.toLowerCase() === 'pronto' || text.toLowerCase() === 'finalizar') {
                    await client.sendMessage(from, `🛵 *TIPO DE PEDIDO*\n\nComo você deseja receber o pedido?\n\n*1* - Entrega\n*2* - Retirar no Local`);
                    session.state = 'ORDER_DELIVERY_TYPE';
                } else {
                    // Try to add more items
                    const extras = text.split(/[\s,]+/).filter(v => menuPrecos[v]);
                    if (extras.length > 0) {
                        extras.forEach(num => {
                            const item = menuPrecos[num];
                            session.order.items.push(item.nome);
                            session.order.total += item.preco;
                        });
                        await client.sendMessage(from, `Itens adicionados!\n*Novo Total: R$ ${session.order.total.toFixed(2)}*\n\nDigite *OK* para avançar.`);
                    } else {
                        await client.sendMessage(from, "Por favor, digite *OK* para avançar, ou digite o número de mais itens.");
                    }
                }
                break;

            case 'ORDER_DELIVERY_TYPE':
                if (text === '1') {
                    session.order.deliveryType = 'Entrega';
                    db.all("SELECT id, nome, taxa_entrega as taxa FROM regioes ORDER BY nome", [], async (err, rows) => {
                        if (err || rows.length === 0) {
                            await client.sendMessage(from, `💳 *FORMA DE PAGAMENTO*\n\nComo deseja pagar o total de R$ ${session.order.total.toFixed(2)}?\n\n*1* - Pix\n*2* - Cartão\n*3* - Dinheiro`);
                            session.state = 'ORDER_PAYMENT';
                        } else {
                            session.regioesCache = rows;
                            let regText = `🗺️ *REGIÃO DE ENTREGA*\n\nPor favor, digite o *número* do seu bairro/região:\n\n`;
                            rows.forEach((r, i) => {
                                regText += `*${i+1}* - ${r.nome} (Taxa: R$ ${r.taxa.toFixed(2)})\n`;
                            });
                            await client.sendMessage(from, regText);
                            session.state = 'ORDER_REGION';
                        }
                    });
                } else if (text === '2') {
                    session.order.deliveryType = 'Retirada';
                    session.order.address = 'RETIRADA';
                    await client.sendMessage(from, `💳 *FORMA DE PAGAMENTO*\n\nComo deseja pagar o total de R$ ${session.order.total.toFixed(2)}?\n\n*1* - Pix\n*2* - Cartão\n*3* - Dinheiro`);
                    session.state = 'ORDER_PAYMENT';
                } else {
                    await client.sendMessage(from, "Opção inválida. Digite 1 para Entrega ou 2 para Retirada.");
                }
                break;

            case 'ORDER_REGION':
                const regIdx = parseInt(text) - 1;
                if (session.regioesCache && session.regioesCache[regIdx]) {
                    const regiao = session.regioesCache[regIdx];
                    session.order.freight = regiao.taxa;
                    session.order.total += regiao.taxa;
                    await client.sendMessage(from, `📍 *ENDEREÇO DE ENTREGA*\n\nVocê selecionou ${regiao.nome}. A taxa de entrega é R$ ${regiao.taxa.toFixed(2)}.\n\nPor favor, digite seu *Endereço Completo* (Rua, Número, Referência).`);
                    session.state = 'ORDER_ADDRESS';
                } else {
                    await client.sendMessage(from, "Região inválida. Por favor, digite o número correto da sua região.");
                }
                break;

            case 'ORDER_ADDRESS':
                session.order.address = text;
                await client.sendMessage(from, `💳 *FORMA DE PAGAMENTO*\n\nComo deseja pagar o total de R$ ${session.order.total.toFixed(2)}?\n\n*1* - Pix\n*2* - Cartão\n*3* - Dinheiro`);
                session.state = 'ORDER_PAYMENT';
                break;

            case 'ORDER_PAYMENT':
                const pagMap = { '1': 'Pix', '2': 'Cartão', '3': 'Dinheiro' };
                if (pagMap[text]) {
                    session.order.payment = pagMap[text];
                    
                    if (session.order.payment === 'Pix') {
                        await client.sendMessage(from, `Sua chave Pix é: *27988100200* (Celular)\n\nPor favor, *NÃO* envie o comprovante ainda. Conclua o seu pedido primeiro.`);
                    }

                    if (session.order.payment === 'Dinheiro') {
                        await client.sendMessage(from, `💵 *TROCO*\n\nPrecisa de troco para quanto? (Digite o valor ou digite *Não*)`);
                        session.state = 'ORDER_CHANGE';
                    } else {
                        await client.sendMessage(from, `✅ *RESUMO DO SEU PEDIDO*\n\n*Itens:* ${session.order.items.join(', ')}\n*Frete:* R$ ${session.order.freight.toFixed(2)}\n*Total:* R$ ${session.order.total.toFixed(2)}\n*Pagamento:* ${session.order.payment}\n*Endereço:* ${session.order.address}\n\nTudo certo? Digite *SIM* para confirmar e enviar para a cozinha, ou *NÃO* para cancelar.`);
                        session.state = 'ORDER_CONFIRM_FINAL';
                    }
                } else {
                    await client.sendMessage(from, "Opção de pagamento inválida. Digite 1 (Pix), 2 (Cartão) ou 3 (Dinheiro).");
                }
                break;
                
            case 'ORDER_CHANGE':
                session.order.changeFor = text;
                await client.sendMessage(from, `✅ *RESUMO DO SEU PEDIDO*\n\n*Itens:* ${session.order.items.join(', ')}\n*Frete:* R$ ${session.order.freight.toFixed(2)}\n*Total:* R$ ${session.order.total.toFixed(2)}\n*Pagamento:* ${session.order.payment} (Troco: ${text})\n*Endereço:* ${session.order.address}\n\nTudo certo? Digite *SIM* para confirmar e enviar para a cozinha, ou *NÃO* para cancelar.`);
                session.state = 'ORDER_CONFIRM_FINAL';
                break;

            case 'WAITING_PIX_RECEIPT':
                if (msg.hasMedia) {
                    const media = await msg.downloadMedia();
                    if (media) {
                        const fs = require('fs');
                        const path = require('path');
                        const crypto = require('crypto');
                        const isPackaged = process.mainModule && process.mainModule.filename.indexOf('app.asar') !== -1 || process.argv.some(arg => arg.includes('app.asar')) || (process.resourcesPath && __dirname.includes('app.asar'));
                        let uploadDir = path.join(__dirname, '../public/uploads/');
                        if (process.env.NODE_ENV === 'production' && !isPackaged) {
                            uploadDir = path.join(process.cwd(), 'data', 'uploads');
                        } else if (isPackaged) {
                            const appData = process.env.APPDATA || process.env.HOME;
                            uploadDir = path.join(appData, 'GaletoMaster', 'uploads');
                        }
                        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
                        
                        const ext = media.mimetype.split('/')[1] || 'png';
                        const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
                        const filepath = path.join(uploadDir, filename);
                        
                        fs.writeFileSync(filepath, media.data, 'base64');
                        session.order.comprovanteUrl = `/uploads/${filename}`;
                        
                        await finalizarPedido(client, from, session, db, emitUpdateFunc);
                    } else {
                        await client.sendMessage(from, "Não consegui ler o arquivo. Por favor, envie uma foto válida do comprovante.");
                    }
                } else {
                    await client.sendMessage(from, "Ainda estou aguardando a foto do comprovante do Pix para poder finalizar o seu pedido! 📸\n\n*(Se quiser cancelar, digite Cancelar)*");
                }
                break;

            case 'ORDER_CONFIRM_FINAL':
                if (text.toLowerCase() === 'sim' || text.toLowerCase() === 's') {
                    if (session.order.payment === 'Pix') {
                        await client.sendMessage(from, `⚠️ *COMPROVANTE*\n\nPara enviar o seu pedido para a cozinha, por favor, envie a *FOTO/ARQUIVO DO COMPROVANTE DO PIX* agora.`);
                        session.state = 'WAITING_PIX_RECEIPT';
                    } else {
                        await finalizarPedido(client, from, session, db, emitUpdateFunc);
                    }
                } else if (text.toLowerCase() === 'não' || text.toLowerCase() === 'nao' || text.toLowerCase() === 'n') {
                    await client.sendMessage(from, "Pedido cancelado. Se mudar de ideia, é só dar um 'Oi'!");
                    session.state = 'IDLE';
                } else {
                    await client.sendMessage(from, "Não entendi. Digite *SIM* para confirmar ou *NÃO* para cancelar.");
                }
                break;
                
            case 'HUMAN':
                // Do nothing, let human handle it
                break;
        }
    });

    client.initialize().catch(err => {
        console.error('❌ Erro fatal ao iniciar o Puppeteer do WhatsApp:', err);
        isReady = false;
        qrCodeDataUrl = null;
        errorMessage = err.message;
        broadcastFunc({ type: 'whatsapp-error', message: err.message });
    });
}

/**
 * Retorna o status atual da conexão do robô do WhatsApp.
 * 
 * @returns {Object} Objeto contendo o estado `isReady` e a string do `qrCodeDataUrl` se aplicável.
 */
function getBotStatus() {
    return { isReady, qrCodeDataUrl, errorMessage };
}

module.exports = { initWhatsApp, getBotStatus, enviarMensagemPainel };
