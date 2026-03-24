const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Aponta para a raiz do projeto (como o anterior 'loja.db')
const dbPath = path.join(__dirname, '..', '..', 'loja.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Tabela de Pedidos
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

    // Tabela de Estoque
    db.run(`CREATE TABLE IF NOT EXISTS estoque (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        item       TEXT,
        quantidade INTEGER
    )`);

    // Inserir estoque inicial se necessário
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

// Helpers com Promises para o banco
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

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this); // this contém lastID e changes
        });
    });
}

module.exports = { db, query, queryOne, run };
