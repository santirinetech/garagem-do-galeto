const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const bcrypt = require('bcryptjs');
<<<<<<< HEAD
const { db, query, queryOne } = require('./database');
=======
const { db, query, queryOne, run } = require('./database');

// ── SSE: Atualização em tempo real ──────────────────────────
let clients = [];
function emitUpdate() {
    clients.forEach(c => {
        try { c.res.write('data: update\n\n'); } catch(e) {}
    });
}
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/uploads/')),
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
        const publicPaths = ['/api/login', '/api/novo-pedido'];
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
<<<<<<< HEAD
        max: 15,
=======
        max: 30, // Aumentado para suportar testes
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
        message: { erro: 'Muitos pedidos enviados deste IP. Tente novamente em uma hora.' }
    });

    // Servir arquivos estáticos da pasta public
<<<<<<< HEAD
    server.use(express.static(path.join(__dirname, '../public')));
=======
    // Garantir que /dashboard e /cardapio funcionem mesmo que o arquivo seja cardapio.html
    server.use(express.static(path.join(__dirname, '../public')));
    
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
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)

    // ──────── APIs DE AUTENTICAÇÃO ────────

    server.post('/api/login', async (req, res) => {
        const { usuario, senha } = req.body;
        
        try {
            const user = await queryOne("SELECT * FROM usuarios WHERE usuario = ?", [usuario]);
            if (!user) {
                return res.status(401).json({ erro: 'Usuário ou senha incorretos' });
            }

            const match = await bcrypt.compare(senha, user.senha);
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

<<<<<<< HEAD
    // POST /api/novo-pedido
    server.post('/api/novo-pedido', pedidoLimiter, upload.single('comprovante'), (req, res) => {
        const { nome, telefone, pedido, total, pagamento, origem } = req.body;
=======
    server.post('/api/novo-pedido', pedidoLimiter, upload.single('comprovante'), (req, res) => {
        const { nome, telefone, pedido, total, pagamento, origem, endereco } = req.body;
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
        const comprovante = req.file ? `/uploads/${req.file.filename}` : null;

        if (!nome || !pedido || total === undefined) {
            return res.status(400).json({ erro: 'Campos obrigatórios: nome, pedido, total' });
        }

<<<<<<< HEAD
        const sql = `INSERT INTO pedidos (cliente_nome, cliente_tel, pedido_desc, total, forma_pagamento, origem, comprovante) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [nome, telefone, pedido, total, pagamento, origem, comprovante], function (err) {
            if (err) return res.status(500).json({ erro: err.message });

=======
        const sql = `INSERT INTO pedidos (cliente_nome, cliente_tel, pedido_desc, total, forma_pagamento, origem, comprovante, endereco) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [nome, telefone, pedido, total, pagamento, origem, comprovante, endereco], function (err) {
            if (err) return res.status(500).json({ erro: err.message });

            const pedidoId = this.lastID;

>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
            // Baixa estoque automaticamente pelo nome do item
            const desc = (pedido || '').toLowerCase();
            if (desc.includes('galeto'))         db.run("UPDATE estoque SET quantidade = MAX(0, quantidade - 1) WHERE item = 'Galetos'");
            if (desc.includes('salpicão') || desc.includes('salpicao')) db.run("UPDATE estoque SET quantidade = MAX(0, quantidade - 1) WHERE item = 'Salpicão'");
            if (desc.includes('feijão') || desc.includes('feijao'))     db.run("UPDATE estoque SET quantidade = MAX(0, quantidade - 1) WHERE item = 'Feijão Tropeiro'");
            if (desc.includes('refrigerante'))   db.run("UPDATE estoque SET quantidade = MAX(0, quantidade - 1) WHERE item = 'Refrigerante'");
            if (desc.includes('suco'))           db.run("UPDATE estoque SET quantidade = MAX(0, quantidade - 1) WHERE item = 'Suco'");

<<<<<<< HEAD
            // Banco de Clientes Silencioso (Fase 4)
=======
            // Banco de Clientes Silencioso
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
            const sqlCliente = `
                INSERT INTO clientes (nome, telefone, compras_qtd, valor_gasto) 
                VALUES (?, ?, 1, ?)
                ON CONFLICT(telefone) DO UPDATE SET 
                nome = excluded.nome,
                compras_qtd = compras_qtd + 1,
                valor_gasto = valor_gasto + excluded.valor_gasto,
                ultimo_pedido = CURRENT_TIMESTAMP
            `;
            db.run(sqlCliente, [nome, telefone, total]);

<<<<<<< HEAD
            if (mainWindow) mainWindow.webContents.send('atualizar-dashboard');
            res.json({ status: 'sucesso', id_pedido: this.lastID });
=======
            // Disparo de Webhook para Novo Pedido (Automação WhatsApp)
            const N8N_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/galeto-pedido';
            fetch(N8N_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: pedidoId, nome, telefone, pedido, total, pagamento, origem, status: 'Pendente', endereco })
            }).catch(() => {});

            emitUpdate(); // Notifica via SSE
            if (mainWindow) mainWindow.webContents.send('atualizar-dashboard');
            res.json({ status: 'sucesso', id_pedido: pedidoId });
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
        });
    });

    // PATCH /pedido/:id/status
    server.patch('/pedido/:id/status', (req, res) => {
        const { id } = req.params;
        const { status } = req.body;
        const validos = ['Pendente', 'Visto', 'Preparando', 'Saiu para Entrega', 'Entregue', 'Cancelado'];
        if (!validos.includes(status)) return res.status(400).json({ erro: 'Status inválido' });

        db.run("UPDATE pedidos SET status = ? WHERE id = ?", [status, id], function (err) {
            if (err) return res.status(500).json({ erro: err.message });
            
            // Disparo de Webhook para o n8n
            // A porta padrão do n8n local é 5678. Ajuste se o n8n estiver na nuvem.
            const N8N_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/galeto-status'; 
            
            queryOne("SELECT * FROM pedidos WHERE id = ?", [id]).then(pedido => {
                if (pedido) {
                    fetch(N8N_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(pedido)
                    }).catch(e => console.error('Aviso: n8n offline ou url incorreta', e.message));
                }
            });

<<<<<<< HEAD
=======
            emitUpdate(); // Notifica via SSE
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
            if (mainWindow) mainWindow.webContents.send('atualizar-dashboard');
            res.json({ status: 'ok' });
        });
    });

    // ──────── APIs DO DASHBOARD ────────

    server.get('/api/pedidos/hoje', async (req, res) => {
        try {
            const rows = await query("SELECT * FROM pedidos WHERE date(data_hora) = date('now','localtime') ORDER BY id DESC");
            res.json(rows);
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.get('/api/resumo', async (req, res) => {
        try {
            const row = await queryOne(`
                SELECT
                    count(*)                                              AS total_pedidos,
                    COALESCE(sum(total), 0)                              AS faturamento,
                    sum(CASE WHEN origem  = 'Site'      THEN 1 ELSE 0 END) AS pedidos_site,
                    sum(CASE WHEN origem  = 'WhatsApp'  THEN 1 ELSE 0 END) AS pedidos_zap,
                    sum(CASE WHEN status  = 'Pendente'  THEN 1 ELSE 0 END) AS pendentes,
                    sum(CASE WHEN status  = 'Preparando'THEN 1 ELSE 0 END) AS em_preparo,
                    sum(CASE WHEN status  = 'Saiu para Entrega'    THEN 1 ELSE 0 END) AS prontos,
                    sum(CASE WHEN status  = 'Entregue'  THEN 1 ELSE 0 END) AS entregues
                FROM pedidos
                WHERE date(data_hora) = date('now','localtime')
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

    server.post('/api/despesas', (req, res) => {
        const { descricao, valor } = req.body;
        db.run("INSERT INTO despesas (descricao, valor) VALUES (?, ?)", [descricao, parseFloat(valor)], function (err) {
            if (err) return res.status(500).json({erro: err.message});
            res.json({ status: 'ok', id: this.lastID });
        });
    });

    server.get('/api/despesas/hoje', async (req, res) => {
        try {
            const rows = await query("SELECT * FROM despesas WHERE date(data_hora) = date('now','localtime') ORDER BY id DESC");
            res.json(rows);
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

<<<<<<< HEAD
    // CRM AUTOMÁTICO - Endpoint para o n8n consultar clientes antigos ("Saudades")
=======
>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
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

<<<<<<< HEAD
=======
    // ──────── APIs DE REGIÕES E FRETE ────────
    
    server.get('/api/regioes', async (req, res) => {
        try {
            const rows = await query("SELECT * FROM regioes ORDER BY nome");
            res.json(rows);
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.post('/api/regioes', (req, res) => {
        const { nome, taxa } = req.body;
        db.run("INSERT INTO regioes (nome, taxa) VALUES (?, ?)", [nome, parseFloat(taxa)], function (err) {
            if (err) return res.status(500).json({erro: err.message});
            res.json({ status: 'ok', id: this.lastID });
        });
    });

    server.delete('/api/regioes/:id', (req, res) => {
        db.run("DELETE FROM regioes WHERE id = ?", [req.params.id], function (err) {
            if (err) return res.status(500).json({erro: err.message});
            res.json({ status: 'ok' });
        });
    });

>>>>>>> f353b28 (Atualizações no no sistema da galeteria: página de login, integração para impressões, status, politica de privacidade)
    server.get('/api/historico', async (req, res) => {
        try {
            const limite = parseInt(req.query.limite) || 200;
            const data = req.query.data;
            let sql = `SELECT * FROM pedidos`;
            let params = [];
            if (data) {
                sql += ` WHERE date(data_hora) = ?`;
                params.push(data);
            }
            sql += ` ORDER BY id DESC LIMIT ?`;
            params.push(limite);
            
            const rows = await query(sql, params);
            res.json(rows);
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.get('/api/pedido/:id', async (req, res) => {
        try {
            const row = await queryOne("SELECT * FROM pedidos WHERE id = ?", [req.params.id]);
            if (!row) return res.status(404).json({erro: 'Pedido não encontrado'});
            res.json(row);
        } catch (e) { res.status(500).json({erro: e.message}); }
    });

    server.listen(3000, () => console.log('✅ Galeto System V3 rodando em http://localhost:3000'));
    return server;
}

module.exports = { startServer };
