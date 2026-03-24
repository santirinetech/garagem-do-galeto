const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { query, queryOne, run } = require('./database');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// Server-Sent Events (SSE) para atualização em tempo real do Dashboard!
// Isso substitui o ipcRenderer.send('atualizar-dashboard')
let clients = [];
function emitUpdate() {
    clients.forEach(c => c.res.write('data: update\n\n'));
}

// Configuração de rotas estáticas
const publicDir = path.join(__dirname, '..', 'public');
app.use('/dashboard', express.static(path.join(publicDir, 'dashboard')));
app.use('/cardapio', express.static(path.join(publicDir, 'cardapio')));

// Rota raiz redireciona para o dashboard
app.get('/', (req, res) => res.redirect('/dashboard'));

// ─────────────────────────────────────────────
// REST API (Substitui os antigas rotas HTTP e Handlers IPC)
// ─────────────────────────────────────────────

// Endpoint para Stream de Eventos (Dashboard assina para receber updates)
app.get('/api/events', (req, res, next) => {
    try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders(); // Estabelece a conexão SSE
        
        const clientId = Date.now();
        clients.push({ id: clientId, res });

        req.on('close', () => {
            clients = clients.filter(c => c.id !== clientId);
        });
    } catch (e) {
        next(e);
    }
});

// Retorna pedidos do dia atual
app.get('/api/pedidos/hoje', async (req, res, next) => {
    try {
        const rows = await query("SELECT * FROM pedidos WHERE date(data_hora) = date('now','localtime') ORDER BY id DESC");
        res.json(rows);
    } catch (e) { next(e); }
});

// Retorna dados do Dashboard (Faturamento, Resumo de status)
app.get('/api/resumo', async (req, res, next) => {
    try {
        const row = await queryOne(`
            SELECT
                count(*)                                              AS total_pedidos,
                COALESCE(sum(total), 0)                              AS faturamento,
                sum(CASE WHEN origem  = 'Site'      THEN 1 ELSE 0 END) AS pedidos_site,
                sum(CASE WHEN origem  = 'WhatsApp'  THEN 1 ELSE 0 END) AS pedidos_zap,
                sum(CASE WHEN status  = 'Pendente'  THEN 1 ELSE 0 END) AS pendentes,
                sum(CASE WHEN status  = 'Em Preparo'THEN 1 ELSE 0 END) AS em_preparo,
                sum(CASE WHEN status  = 'Pronto'    THEN 1 ELSE 0 END) AS prontos,
                sum(CASE WHEN status  = 'Entregue'  THEN 1 ELSE 0 END) AS entregues
            FROM pedidos
            WHERE date(data_hora) = date('now','localtime')
        `);
        res.json(row);
    } catch(e) { next(e); }
});

// Retorna todos os itens do estoque
app.get('/api/estoque', async (req, res, next) => {
    try {
        const rows = await query("SELECT * FROM estoque ORDER BY item");
        res.json(rows);
    } catch(e) { next(e); }
});

// Retorna histórico com limite
app.get('/api/pedidos/historico', async (req, res, next) => {
    try {
        const limit = Number(req.query.limite) || 200;
        const rows = await query("SELECT * FROM pedidos ORDER BY id DESC LIMIT ?", [limit]);
        res.json(rows);
    } catch(e) { next(e); }
});

// Atualiza o status de um pedido
app.patch('/api/pedidos/:id/status', async (req, res, next) => {
    const { id } = req.params;
    const { status } = req.body;
    const validos = ['Pendente', 'Em Preparo', 'Pronto', 'Entregue'];
    if (!validos.includes(status)) return res.status(400).json({ erro: 'Status inválido' });

    try {
        await run("UPDATE pedidos SET status = ? WHERE id = ?", [status, id]);
        emitUpdate(); // Notifica todos os dashboards web abertos!
        res.json({ ok: true });
    } catch(e) { next(e); }
});

// Cria um novo pedido via Site (Cardápio Mobile)
app.post('/api/pedidos', async (req, res, next) => {
    const { nome, telefone, pedido, total, pagamento, origem = 'Site' } = req.body;
    if (!nome || !pedido || total === undefined) {
        return res.status(400).json({ erro: 'Campos obrigatórios: nome, pedido, total' });
    }

    try {
        const r = await run(
            `INSERT INTO pedidos (cliente_nome, cliente_tel, pedido_desc, total, forma_pagamento, origem) VALUES (?, ?, ?, ?, ?, ?)`, 
            [nome, telefone, pedido, total, pagamento, origem]
        );
        
        // Baixa automática de estoque pelo nome do item
        const desc = (pedido || '').toLowerCase();
        if (desc.includes('galeto')) await run("UPDATE estoque SET quantidade = MAX(0, quantidade - 1) WHERE item = 'Galetos'");
        if (desc.includes('salpicão') || desc.includes('salpicao')) await run("UPDATE estoque SET quantidade = MAX(0, quantidade - 1) WHERE item = 'Salpicão'");
        if (desc.includes('feijão') || desc.includes('feijao')) await run("UPDATE estoque SET quantidade = MAX(0, quantidade - 1) WHERE item = 'Feijão Tropeiro'");
        if (desc.includes('refrigerante')) await run("UPDATE estoque SET quantidade = MAX(0, quantidade - 1) WHERE item = 'Refrigerante'");
        if (desc.includes('suco')) await run("UPDATE estoque SET quantidade = MAX(0, quantidade - 1) WHERE item = 'Suco'");

        emitUpdate(); // Avisa o painel do Desktop (ou via web) da chegada do pedido
        res.json({ status: 'sucesso', id_pedido: r.lastID });
    } catch(e) { next(e); }
});

// Middleware Global de Tratamento de Erros
app.use((err, req, res, next) => {
    console.error('Erro no Servidor:', err);
    res.status(500).json({ erro: 'Ocorreu um erro interno no servidor.', detalhes: err.message });
});

module.exports = app;
