const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

// ─────────────────────────────────────────────
// 1. BANCO DE DADOS
// ─────────────────────────────────────────────
const dbPath = path.join(__dirname, 'loja.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cliente_nome TEXT,
        cliente_tel  TEXT,
        pedido_desc  TEXT,
        total        REAL,
        forma_pagamento TEXT,
        origem       TEXT    DEFAULT 'WhatsApp',
        status       TEXT    DEFAULT 'Pendente',
        data_hora    DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS estoque (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        item       TEXT,
        quantidade INTEGER
    )`);

    // Estoque inicial somente se vazio
    db.get("SELECT count(*) as qtd FROM estoque", (err, row) => {
        if (row && row.qtd === 0) {
            const items = [
                ['Galetos',          50],
                ['Salpicão',         30],
                ['Feijão Tropeiro',  30],
                ['Refrigerante',     50],
                ['Suco',             40],
            ];
            const stmt = db.prepare("INSERT INTO estoque (item, quantidade) VALUES (?, ?)");
            items.forEach(([item, qtd]) => stmt.run(item, qtd));
            stmt.finalize();
        }
    });
});

// ─────────────────────────────────────────────
// 2. SERVIDOR EXPRESS  →  http://localhost:3000
// ─────────────────────────────────────────────
const server = express();
server.use(bodyParser.json());
server.use(cors());

// Servir o cardápio como site público
server.use(express.static(__dirname));

// POST /novo-pedido  — chamado pelo cardapio.html
server.post('/novo-pedido', (req, res) => {
    const { nome, telefone, pedido, total, pagamento, origem = 'WhatsApp' } = req.body;

    if (!nome || !pedido || total === undefined) {
        return res.status(400).json({ erro: 'Campos obrigatórios: nome, pedido, total' });
    }

    const sql = `INSERT INTO pedidos
        (cliente_nome, cliente_tel, pedido_desc, total, forma_pagamento, origem)
        VALUES (?, ?, ?, ?, ?, ?)`;

    db.run(sql, [nome, telefone, pedido, total, pagamento, origem], function (err) {
        if (err) return res.status(500).json({ erro: err.message });

        // Baixa estoque automaticamente pelo nome do item
        const desc = (pedido || '').toLowerCase();
        if (desc.includes('galeto'))         db.run("UPDATE estoque SET quantidade = MAX(0, quantidade - 1) WHERE item = 'Galetos'");
        if (desc.includes('salpicão') || desc.includes('salpicao')) db.run("UPDATE estoque SET quantidade = MAX(0, quantidade - 1) WHERE item = 'Salpicão'");
        if (desc.includes('feijão') || desc.includes('feijao'))     db.run("UPDATE estoque SET quantidade = MAX(0, quantidade - 1) WHERE item = 'Feijão Tropeiro'");
        if (desc.includes('refrigerante'))   db.run("UPDATE estoque SET quantidade = MAX(0, quantidade - 1) WHERE item = 'Refrigerante'");
        if (desc.includes('suco'))           db.run("UPDATE estoque SET quantidade = MAX(0, quantidade - 1) WHERE item = 'Suco'");

        if (mainWindow) mainWindow.webContents.send('atualizar-dashboard');
        res.json({ status: 'sucesso', id_pedido: this.lastID });
    });
});

// PATCH /pedido/:id/status  — atualiza status via dashboard
server.patch('/pedido/:id/status', (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const validos = ['Pendente', 'Em Preparo', 'Pronto', 'Entregue'];
    if (!validos.includes(status)) return res.status(400).json({ erro: 'Status inválido' });

    db.run("UPDATE pedidos SET status = ? WHERE id = ?", [status, id], function (err) {
        if (err) return res.status(500).json({ erro: err.message });
        if (mainWindow) mainWindow.webContents.send('atualizar-dashboard');
        res.json({ status: 'ok' });
    });
});

server.listen(3000, () => console.log('✅ Galeto System V3 rodando em http://localhost:3000'));

// ─────────────────────────────────────────────
// 3. JANELA ELECTRON
// ─────────────────────────────────────────────
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
    mainWindow.loadFile('index.html');
    // mainWindow.webContents.openDevTools(); // Descomente para debugar
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ─────────────────────────────────────────────
// 4. IPC — Dados para o Dashboard
// ─────────────────────────────────────────────

// Pedidos de hoje
ipcMain.handle('get-pedidos-hoje', () =>
    query("SELECT * FROM pedidos WHERE date(data_hora) = date('now','localtime') ORDER BY id DESC")
);

// Resumo financeiro do dia
ipcMain.handle('get-resumo', () =>
    queryOne(`
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
    `)
);

// Estoque
ipcMain.handle('get-estoque', () => query("SELECT * FROM estoque ORDER BY item"));

// Atualizar status via IPC (pelo dashboard)
ipcMain.handle('atualizar-status', (_, { id, status }) =>
    new Promise((resolve, reject) => {
        db.run("UPDATE pedidos SET status = ? WHERE id = ?", [status, id], (err) => {
            if (err) reject(err);
            else { if (mainWindow) mainWindow.webContents.send('atualizar-dashboard'); resolve({ ok: true }); }
        });
    })
);

// Histórico (todos os pedidos, com filtros opcionais)
ipcMain.handle('get-historico', (_, { limite = 200 } = {}) =>
    query(`SELECT * FROM pedidos ORDER BY id DESC LIMIT ?`, [limite])
);

// ─────────────────────────────────────────────
// Helpers Promise para o SQLite
// ─────────────────────────────────────────────
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
}

function queryOne(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
}
