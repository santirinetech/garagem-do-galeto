const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../loja.db');
const db = new sqlite3.Database(dbPath);

function initDb() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_nome TEXT,
            cliente_tel TEXT,
            pedido_desc TEXT,
            total REAL,
            forma_pagamento TEXT,
            origem TEXT,
            status TEXT DEFAULT 'Pendente',
            data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
            comprovante TEXT
        )`, (err) => {
            if (!err) db.run("ALTER TABLE pedidos ADD COLUMN comprovante TEXT", () => {});
        });

        db.run(`CREATE TABLE IF NOT EXISTS estoque (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            item       TEXT,
            quantidade INTEGER
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS despesas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao TEXT,
            valor REAL,
            data_hora DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            telefone TEXT UNIQUE,
            compras_qtd INTEGER DEFAULT 0,
            valor_gasto REAL DEFAULT 0,
            ultimo_pedido DATETIME DEFAULT CURRENT_TIMESTAMP
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
}
initDb();

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

module.exports = { db, query, queryOne };
