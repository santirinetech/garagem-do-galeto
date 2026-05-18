const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { db, query, queryOne, run } = require('./database');
const { initWhatsApp, getBotStatus, enviarMensagemPainel } = require('./whatsapp-bot');

// ── SSE: Atualização em tempo real ──────────────────────────
let clients = [];
function emitUpdate() {
    clients.forEach(c => {
        try { c.res.write('data: update\n\n'); } catch(e) {}
    });
}

const fs = require('fs');

const isPackaged = process.mainModule && process.mainModule.filename.indexOf('app.asar') !== -1 || process.argv.some(arg => arg.includes('app.asar')) || (process.resourcesPath && __dirname.includes('app.asar'));
let uploadDir;
if (isPackaged) {
    const appData = process.env.APPDATA || process.env.HOME;
    uploadDir = path.join(appData, 'GaletoMaster', 'uploads');
} else {
    uploadDir = path.join(__dirname, '../public/uploads/');
}

if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'))
});
const upload = multer({ storage });

function startServer(mainWindow = null) {
    const server = express();
    
    // Segurança: Configuração de Cabeçalhos
    server.use(helmet({
        contentSecurityPolicy: false, // Desativado para simplificar carregamento de fontes/icones externos por enquanto
        crossOriginEmbedderPolicy: false
    }));

    server.use(bodyParser.json());
    server.use(cors());

    // Configuração de Sessão
    server.use(session({
        secret: 'galeto-master-secret-key-2026',
        resave: false,
        saveUninitialized: false,
        cookie: { 
            secure: false, // true em produção com HTTPS
            maxAge: 1000 * 60 * 60 * 24 // 1 dia
        }
    }));

    // Middleware de Proteção de Rotas
    const authMiddleware = (req, res, next) => {
        // Rotas que NÃO precisam de autenticação
        const publicPaths = ['/api/login', '/api/novo-pedido', '/api/cardapio-itens'];
        const isPublicApi = publicPaths.includes(req.path);
        const isStaticFile = !req.path.startsWith('/api');

        if (isPublicApi || isStaticFile || req.session.userId) {
            return next();
        }

        res.status(401).json({ erro: 'Não autorizado. Por favor, faça login.' });
    };

    // Aplicar proteção apenas em rotas /api (exceto as públicas)
    server.use('/api', authMiddleware);

    // Rate Limiter: Evitar abusos (Max 15 pedidos por hora por IP)
    const pedidoLimiter = rateLimit({
        windowMs: 60 * 60 * 1000, 
        max: 30, // Aumentado para suportar testes
        message: { erro: 'Muitos pedidos enviados deste IP. Tente novamente em uma hora.' }
    });

    // Servir arquivos estáticos da pasta public
    server.use(express.static(path.join(__dirname, '../public')));
    
    // Servir os comprovantes salvos no AppData (ou public/uploads localmente)
    server.use('/uploads', express.static(uploadDir));
    
    // Rota raiz redireciona para o dashboard (index.html)
    server.get('/', (req, res) => res.redirect('/index.html'));
    
    // Endpoint SSE para o Dashboard
    server.get('/api/events', (req, res) => {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();
        
        const clientId = Date.now();
        clients.push({ id: clientId, res });
        req.on('close', () => {
            clients = clients.filter(c => c.id !== clientId);
        });
    });

    // ──────── INICIALIZAÇÃO DO WHATSAPP BOT ────────
    const broadcastWppEvent = (evt) => {
        clients.forEach(c => {
            try { c.res.write(`data: ${JSON.stringify(evt)}\n\n`); } catch(e) {}
        });
    };
    initWhatsApp(db, emitUpdate, broadcastWppEvent);

    server.get('/api/whatsapp/status', (req, res) => {
        res.json(getBotStatus());
    });

    // ──────── APIs DE AUTENTICAÇÃO ────────

    server.post('/api/login', async (req, res) => {
        const { usuario, senha } = req.body;
        
        try {
            const user = await queryOne("SELECT * FROM usuarios WHERE usuario = ?", [usuario]);
            if (!user) {
                return res.status(401).json({ erro: 'Usuário ou senha incorretos' });
            }

            const match = await bcrypt.compare(senha, user.senha_hash || user.senha);
            if (!match) {
                return res.status(401).json({ erro: 'Usuário ou senha incorretos' });
            }

            req.session.userId = user.id;
            req.session.username = user.usuario;
            res.json({ status: 'sucesso', usuario: user.usuario });
        } catch (e) {
            res.status(500).json({ erro: 'Erro interno no servidor' });
        }
    });

    server.post('/api/logout', (req, res) => {
        req.session.destroy(err => {
            if (err) return res.status(500).json({ erro: 'Erro ao sair' });
            res.clearCookie('connect.sid');
            res.json({ status: 'sucesso' });
        });
    });

    server.get('/api/check-session', (req, res) => {
        if (req.session.userId) {
            res.json({ logado: true, usuario: req.session.username });
        } else {
            res.json({ logado: false });
        }
    });

    server.post('/api/novo-pedido', pedidoLimiter, upload.single('comprovante'), async (req, res) => {
        const { nome, telefone, pedido, total, pagamento, origem, endereco, itens, taxa } = req.body;
        const comprovante = req.file ? `/uploads/${req.file.filename}` : null;
        const taxa_aplicada = parseFloat(taxa) || 0.0;

        if (!nome || (!pedido && !itens) || total === undefined) {
            return res.status(400).json({ erro: 'Campos obrigatórios: nome, pedido/itens, total' });
        }

        try {
            // 1. Cliente (UPSERT)
            await run(`
                INSERT INTO clientes (nome, telefone, compras_qtd, valor_gasto) 
                VALUES (?, ?, 1, ?)
                ON CONFLICT(telefone) DO UPDATE SET 
                nome = excluded.nome,
                compras_qtd = compras_qtd + 1,
                valor_gasto = valor_gasto + excluded.valor_gasto,
                ultimo_pedido = CURRENT_TIMESTAMP
            `, [nome, telefone, total]);
            
            const cliente = await queryOne("SELECT id FROM clientes WHERE telefone = ?", [telefone]);
            const cliente_id = cliente.id;

            // 2. Pedido
            let pedidoDescStr = pedido || '';
            const sqlPedido = `INSERT INTO pedidos (cliente_id, endereco_entrega, pedido_descricao, origem, taxa_aplicada, total, forma_pagamento, comprovante_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente')`;
            const resultPedido = await run(sqlPedido, [cliente_id, endereco, pedidoDescStr, origem || 'balcao', taxa_aplicada, total, pagamento, comprovante]);
            const pedido_id = resultPedido.lastID;

            // 3. Processamento Dinâmico de Estoque
            if (itens) {
                const parsedItens = JSON.parse(itens);
                pedidoDescStr = '';
                for (let item of parsedItens) {
                    const prod = await queryOne("SELECT id, preco_unitario FROM produtos WHERE nome = ? OR id = ?", [item.nome, item.id]);
                    if (prod) {
                        await run("INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)", [pedido_id, prod.id, item.quantidade || 1, prod.preco_unitario || item.preco]);
                        await run("UPDATE produtos SET quantidade_estoque = MAX(0, quantidade_estoque - ?) WHERE id = ?", [item.quantidade || 1, prod.id]);
                    }
                    pedidoDescStr += `${item.quantidade || 1}x ${item.nome}, `;
                }
                pedidoDescStr = pedidoDescStr.slice(0, -2);
                await run("UPDATE pedidos SET pedido_descricao = ? WHERE id = ?", [pedidoDescStr, pedido_id]);
            } else if (pedido) {
                // Fallback legado regex
                const desc = pedido.toLowerCase();
                if (desc.includes('galeto'))         await run("UPDATE produtos SET quantidade_estoque = MAX(0, quantidade_estoque - 1) WHERE nome LIKE '%Galeto%'");
                if (desc.includes('salpicão') || desc.includes('salpicao')) await run("UPDATE produtos SET quantidade_estoque = MAX(0, quantidade_estoque - 1) WHERE nome LIKE '%Salpicão%'");
                if (desc.includes('feijão') || desc.includes('feijao'))     await run("UPDATE produtos SET quantidade_estoque = MAX(0, quantidade_estoque - 1) WHERE nome LIKE '%Feijão Tropeiro%'");
            }

            // Webhook removido: Apenas dependência local no banco e envio WS local
            console.log(`[INFO] Novo pedido #${pedido_id} salvo localmente.`);

            emitUpdate(); // Notifica via SSE
            if (mainWindow) mainWindow.webContents.send('atualizar-dashboard');
            res.json({ 
                mensagem: 'Sucesso', 
                id_pedido: pedido_id,
                comprovante: comprovante 
            });
        } catch (e) {
            console.error("Erro ao registrar pedido:", e);
            res.status(500).json({ erro: e.message });
        }
    });

    // PATCH /pedido/:id/status
    server.patch('/pedido/:id/status', (req, res) => {
        const { id } = req.params;
        const { status } = req.body;
        const validos = ['Pendente', 'Visto', 'Preparando', 'Saiu para Entrega', 'Pronto para Retirada', 'Entregue', 'Retirado', 'Cancelado'];
        if (!validos.includes(status)) return res.status(400).json({ erro: 'Status inválido' });

        db.run("UPDATE pedidos SET status = ? WHERE id = ?", [status, id], function (err) {
            if (err) return res.status(500).json({ erro: err.message });
            
            queryOne(`
                SELECT p.*, c.nome as cliente_nome, c.telefone as cliente_tel 
                FROM pedidos p 
                LEFT JOIN clientes c ON p.cliente_id = c.id 
                WHERE p.id = ?
            `, [id]).then(pedido => {
                if (pedido) {
                    // Notificação por WhatsApp Bot (Automática)
                    if (['Preparando', 'Saiu para Entrega', 'Entregue', 'Pronto para Retirada', 'Retirado'].includes(status) && pedido.cliente_tel) {
                        let msg = "";
                        if (status === 'Preparando') {
                            msg = `Olá ${pedido.cliente_nome}! Seu pedido #${pedido.id} já está sendo preparado com muito carinho aqui na Garagem do Galeto! 🔥`;
                        } else if (status === 'Saiu para Entrega') {
                            msg = `Boas notícias, ${pedido.cliente_nome}! Seu pedido #${pedido.id} acabou de sair para entrega e logo chegará até você! 🛵💨`;
                        } else if (status === 'Entregue') {
                            msg = `Pedido #${pedido.id} entregue! Esperamos que aproveite sua refeição. Se puder, nos conte o que achou! Obrigado pela preferência. 🍗✨`;
                        } else if (status === 'Pronto para Retirada') {
                            msg = `Olá ${pedido.cliente_nome}! Seu pedido #${pedido.id} já está PRONTO para retirada! Pode vir buscar o seu Galeto quentinho! 🏃‍♂️💨`;
                        } else if (status === 'Retirado') {
                            msg = `Pedido #${pedido.id} retirado com sucesso! Bom apetite e muito obrigado pela preferência! 🍗✨`;
                        }
                        enviarMensagemPainel(pedido.cliente_tel, msg);
                    }

                    // Disparo n8n removido para garantir fluxo local exclusivo.
                }
            });

            emitUpdate(); // Notifica via SSE
            if (mainWindow) mainWindow.webContents.send('atualizar-dashboard');
            res.json({ status: 'ok' });
        });
    });

    // ──────── APIs DE CONFIGURAÇÃO ────────
    server.get('/api/config', async (req, res) => {
        try {
            const rows = await query("SELECT * FROM configuracoes");
            const config = {};
            rows.forEach(r => config[r.chave] = r.valor);
            res.json(config);
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    // ──────── APIs DO DASHBOARD ────────

    server.get('/api/pedidos/hoje', async (req, res) => {
        try {
            const rows = await query(`
                SELECT p.*, c.nome as cliente_nome, c.telefone as cliente_tel 
                FROM pedidos p 
                LEFT JOIN clientes c ON p.cliente_id = c.id 
                WHERE date(p.data_hora, 'localtime') = date('now','localtime') 
                ORDER BY p.id DESC
            `);
            res.json(rows);
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.get('/api/resumo', async (req, res) => {
        try {
            const row = await queryOne(`
                SELECT
                    count(*)                                              AS total_pedidos,
                    COALESCE(sum(total), 0)                              AS faturamento,
                    sum(CASE WHEN origem LIKE 'Site%' THEN 1 ELSE 0 END) AS pedidos_site,
                    sum(CASE WHEN origem LIKE 'WhatsApp%' THEN 1 ELSE 0 END) AS pedidos_zap,
                    sum(CASE WHEN status  = 'pendente' OR status = 'Pendente'  THEN 1 ELSE 0 END) AS pendentes,
                    sum(CASE WHEN status  = 'em_preparo' OR status = 'Preparando' THEN 1 ELSE 0 END) AS em_preparo,
                    sum(CASE WHEN status  = 'saiu_entrega' OR status = 'Saiu para Entrega'  THEN 1 ELSE 0 END) AS prontos,
                    sum(CASE WHEN status  = 'entregue' OR status = 'Entregue'  THEN 1 ELSE 0 END) AS entregues,
                    COALESCE(sum(CASE WHEN origem LIKE '%Churrasquinho%' OR pedido_descricao LIKE '%Espetinho%' OR pedido_descricao LIKE '%Churrasco%' THEN total ELSE 0 END), 0) AS fat_churrasco,
                    COALESCE(sum(CASE WHEN origem LIKE '%Galeto%' OR pedido_descricao LIKE '%Galeto%' THEN total ELSE 0 END), 0) AS fat_galeto
                FROM pedidos
                WHERE date(data_hora, 'localtime') = date('now','localtime')
            `);
            res.json(row);
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.get('/api/estoque', async (req, res) => {
        try {
            const rows = await query("SELECT * FROM estoque ORDER BY item");
            res.json(rows);
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.patch('/api/estoque/:id', (req, res) => {
        const { quantidade } = req.body;
        db.run("UPDATE estoque SET quantidade = ? WHERE id = ?", [parseInt(quantidade), req.params.id], function (err) {
            if (err) return res.status(500).json({erro: err.message});
            res.json({ status: 'ok' });
        });
    });

    // ──────── APIs DE PRODUTOS E CATEGORIAS ────────
    server.get('/api/cardapio-itens', async (req, res) => {
        try {
            const categorias = await query("SELECT * FROM categoria_produtos WHERE status = 1 ORDER BY nome_listagem");
            const produtos = await query("SELECT * FROM produtos WHERE status = 1 ORDER BY nome");
            
            // Format to match old structure or group them easily for the frontend
            const menu = categorias.map(c => ({
                id: c.id,
                nome: c.nome_listagem || c.nome,
                descricao: c.descricao,
                produtos: produtos.filter(p => p.categoria_id === c.id)
            })).filter(c => c.produtos.length > 0);
            
            res.json(menu);
        } catch (e) { res.status(500).json({erro: e.message}); }
    });
    server.get('/api/produtos', async (req, res) => {
        try {
            const rows = await query(`
                SELECT p.*, c.nome as categoria_nome 
                FROM produtos p 
                LEFT JOIN categoria_produtos c ON p.categoria_id = c.id 
                ORDER BY c.nome, p.nome
            `);
            res.json(rows);
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.get('/api/produtos/:id', async (req, res) => {
        try {
            const row = await queryOne("SELECT * FROM produtos WHERE id = ?", [req.params.id]);
            res.json(row);
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.post('/api/produtos', async (req, res) => {
        const { nome, categoria_id, preco_unitario, preco, quantidade_estoque } = req.body;
        const preco_val = parseFloat(preco_unitario ?? preco ?? 0);
        try {
            const r = await run("INSERT INTO produtos (nome, categoria_id, preco_unitario, quantidade_estoque) VALUES (?, ?, ?, ?)", 
                [nome, categoria_id || null, preco_val, parseInt(quantidade_estoque) || 0]);
            res.json({ status: 'ok', id: r.lastID });
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.put('/api/produtos/:id', async (req, res) => {
        const { nome, categoria_id, preco_unitario, preco, quantidade_estoque } = req.body;
        const preco_val = parseFloat(preco_unitario ?? preco ?? 0);
        try {
            await run("UPDATE produtos SET nome = ?, categoria_id = ?, preco_unitario = ?, quantidade_estoque = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?", 
                [nome, categoria_id || null, preco_val, parseInt(quantidade_estoque) || 0, req.params.id]);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.patch('/api/produtos/:id/estoque', async (req, res) => {
        try {
            await run("UPDATE produtos SET quantidade_estoque = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?", [parseInt(req.body.quantidade) || 0, req.params.id]);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.patch('/api/produtos/:id/status', async (req, res) => {
        try {
            await run("UPDATE produtos SET status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?", [parseInt(req.body.status), req.params.id]);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    // Alias legado
    server.patch('/api/produtos/:id/ativo', async (req, res) => {
        try {
            const s = parseInt(req.body.ativo);
            await run("UPDATE produtos SET status = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?", [s, req.params.id]);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.get('/api/categorias', async (req, res) => {
        try {
            const rows = await query("SELECT * FROM categoria_produtos ORDER BY nome");
            res.json(rows);
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.post('/api/categorias', async (req, res) => {
        try {
            await run("INSERT INTO categoria_produtos (nome, nome_listagem) VALUES (?, ?)", [req.body.nome, req.body.nome]);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.delete('/api/categorias/:id', async (req, res) => {
        try {
            await run("UPDATE produtos SET categoria_id = NULL WHERE categoria_id = ?", [req.params.id]);
            await run("DELETE FROM categoria_produtos WHERE id = ?", [req.params.id]);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    // ──────── APIs DE DESPESAS ────────

    server.get('/api/despesas', async (req, res) => {
        try {
            const { de, ate } = req.query;
            let sql = `
                SELECT d.*, cd.nome as categoria_nome
                FROM despesas d
                LEFT JOIN categoria_despesas cd ON d.categoria_id = cd.id
            `;
            const params = [];
            if (de && ate) {
                sql += ` WHERE date(d.data_hora, 'localtime') BETWEEN ? AND ?`;
                params.push(de, ate);
            } else {
                sql += ` WHERE date(d.data_hora, 'localtime') = date('now','localtime')`;
            }
            sql += ` ORDER BY d.id DESC`;
            res.json(await query(sql, params));
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.post('/api/despesas', async (req, res) => {
        const { descricao, categoria_id, valor } = req.body;
        if (!descricao || !valor) return res.status(400).json({ erro: 'Preencha descrição e valor.' });
        try {
            const r = await run(
                "INSERT INTO despesas (usuario_id, descricao, categoria_id, valor) VALUES (?, ?, ?, ?)",
                [req.session?.userId || null, descricao, categoria_id || null, parseFloat(valor)]
            );
            res.json({ status: 'ok', id: r.lastID });
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.put('/api/despesas/:id', async (req, res) => {
        const { descricao, categoria_id, valor } = req.body;
        try {
            await run(
                "UPDATE despesas SET descricao = ?, categoria_id = ?, valor = ? WHERE id = ?",
                [descricao, categoria_id || null, parseFloat(valor), req.params.id]
            );
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.delete('/api/despesas/:id', async (req, res) => {
        try {
            await run("DELETE FROM despesas WHERE id = ?", [req.params.id]);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    // ──────── APIs DE CATEGORIAS DE DESPESAS ────────

    server.get('/api/categoria-despesas', async (req, res) => {
        try {
            res.json(await query("SELECT * FROM categoria_despesas WHERE status = 1 ORDER BY nome"));
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.post('/api/categoria-despesas', async (req, res) => {
        try {
            await run("INSERT INTO categoria_despesas (nome) VALUES (?)", [req.body.nome]);
            res.json({ status: 'ok' });
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    // ──────── APIs DE GESTÃO DE CLIENTES (LGPD) ────────
    
    server.get('/api/clientes', async (req, res) => {
        try {
            const rows = await query("SELECT * FROM clientes ORDER BY nome");
            res.json(rows);
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.delete('/api/clientes/:id', (req, res) => {
        db.run("DELETE FROM clientes WHERE id = ?", [req.params.id], function (err) {
            if (err) return res.status(500).json({erro: err.message});
            res.json({ status: 'ok' });
        });
    });

    server.get('/api/clientes/ausentes', async (req, res) => {
        try {
            const dias = parseInt(req.query.dias) || 15; // Padrão 15 dias sem pedir
            const rows = await query(`
                SELECT nome, telefone, ultimo_pedido, total_gasto, qtd_pedidos 
                FROM clientes 
                WHERE date(ultimo_pedido) <= date('now', 'localtime', '-' || ? || ' days')
            `, [dias]);
            res.json(rows);
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    // ──────── APIs DE REGIÕES E FRETE ────────
    
    server.get('/api/regioes', async (req, res) => {
        try {
            const rows = await query("SELECT * FROM regioes ORDER BY nome");
            res.json(rows);
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.post('/api/regioes', async (req, res) => {
        const { nome, taxa, taxa_entrega } = req.body;
        const valor = parseFloat(taxa_entrega ?? taxa ?? 0);
        try {
            const r = await run("INSERT INTO regioes (nome, taxa_entrega) VALUES (?, ?)", [nome, valor]);
            res.json({ status: 'ok', id: r.lastID });
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.delete('/api/regioes/:id', (req, res) => {
        db.run("DELETE FROM regioes WHERE id = ?", [req.params.id], function (err) {
            if (err) return res.status(500).json({erro: err.message});
            res.json({ status: 'ok' });
        });
    });

    // ──────── API DE RELATÓRIOS FINANCEIROS ────────

    server.get('/api/relatorios', async (req, res) => {
        try {
            const { de, ate } = req.query;
            if (!de || !ate) return res.status(400).json({ erro: 'Informe de e ate (YYYY-MM-DD).' });

            const statusConcluidos = ['Entregue', 'Retirado', 'entregue', 'retirado'];
            const placeholders = statusConcluidos.map(() => '?').join(',');

            const [resumo, rankCategorias, rankProdutos, despesas] = await Promise.all([
                queryOne(`
                    SELECT
                        COALESCE(SUM(CASE WHEN status IN (${placeholders}) THEN total ELSE 0 END), 0) AS total_entradas,
                        COUNT(CASE WHEN status IN (${placeholders}) THEN 1 END) AS pedidos_concluidos,
                        COUNT(*) AS total_pedidos
                    FROM pedidos
                    WHERE date(data_hora, 'localtime') BETWEEN ? AND ?
                `, [...statusConcluidos, ...statusConcluidos, de, ate]),

                query(`
                    SELECT cp.nome AS categoria, SUM(ip.quantidade) AS total_vendido
                    FROM itens_pedido ip
                    JOIN produtos pr ON ip.produto_id = pr.id
                    JOIN categoria_produtos cp ON pr.categoria_id = cp.id
                    JOIN pedidos p ON ip.pedido_id = p.id
                    WHERE date(p.data_hora, 'localtime') BETWEEN ? AND ?
                    AND p.status IN (${placeholders})
                    GROUP BY cp.id ORDER BY total_vendido DESC
                `, [de, ate, ...statusConcluidos]),

                query(`
                    SELECT pr.nome AS produto, SUM(ip.quantidade) AS total_vendido, SUM(ip.quantidade * ip.preco_unitario) AS receita
                    FROM itens_pedido ip
                    JOIN produtos pr ON ip.produto_id = pr.id
                    JOIN pedidos p ON ip.pedido_id = p.id
                    WHERE date(p.data_hora, 'localtime') BETWEEN ? AND ?
                    AND p.status IN (${placeholders})
                    GROUP BY pr.id ORDER BY total_vendido DESC LIMIT 10
                `, [de, ate, ...statusConcluidos]),

                queryOne(`
                    SELECT COALESCE(SUM(valor), 0) AS total_despesas
                    FROM despesas
                    WHERE date(data_hora, 'localtime') BETWEEN ? AND ?
                `, [de, ate])
            ]);

            const total_entradas = resumo?.total_entradas || 0;
            const total_saidas   = despesas?.total_despesas || 0;

            res.json({
                periodo: { de, ate },
                total_entradas,
                total_saidas,
                lucro_liquido: total_entradas - total_saidas,
                pedidos_concluidos: resumo?.pedidos_concluidos || 0,
                total_pedidos: resumo?.total_pedidos || 0,
                rank_categorias: rankCategorias,
                rank_produtos: rankProdutos
            });
        } catch (e) { res.status(500).json({ erro: e.message }); }
    });

    server.get('/api/historico', async (req, res) => {
        try {
            const limite = parseInt(req.query.limite) || 200;
            const data = req.query.data;
            let sql = `
                SELECT p.*, c.nome as cliente_nome, c.telefone as cliente_tel 
                FROM pedidos p 
                LEFT JOIN clientes c ON p.cliente_id = c.id
            `;
            let params = [];
            if (data) {
                sql += ` WHERE date(p.data_hora) = ?`;
                params.push(data);
            }
            sql += ` ORDER BY p.id DESC LIMIT ?`;
            params.push(limite);
            
            const rows = await query(sql, params);
            res.json(rows);
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.get('/api/pedido/:id', async (req, res) => {
        try {
            const row = await queryOne(`
                SELECT p.*, c.nome as cliente_nome, c.telefone as cliente_tel 
                FROM pedidos p 
                LEFT JOIN clientes c ON p.cliente_id = c.id 
                WHERE p.id = ?
            `, [req.params.id]);
            if (!row) return res.status(404).json({erro: 'Pedido não encontrado'});
            
            // Buscar itens
            const itens = await query(`
                SELECT i.*, pr.nome as produto_nome 
                FROM itens_pedido i 
                LEFT JOIN produtos pr ON i.produto_id = pr.id 
                WHERE i.pedido_id = ?
            `, [row.id]);
            
            row.itens = itens;
            res.json(row);
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.listen(3000, () => console.log('✅ Galeto System V3 rodando em http://localhost:3000'));
    return server;
}

module.exports = { startServer };
