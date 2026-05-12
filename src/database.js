const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let dbPath;
// Identifica se está rodando via executável (.exe) empacotado no app.asar
const isPackaged = process.mainModule && process.mainModule.filename.indexOf('app.asar') !== -1 || process.argv.some(arg => arg.includes('app.asar')) || (process.resourcesPath && __dirname.includes('app.asar'));

if (isPackaged) {
    const appData = process.env.APPDATA || process.env.HOME;
    const userDataDir = path.join(appData, 'GaletoMaster');
    
    if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
    }
    
    dbPath = path.join(userDataDir, 'loja.db');
    
    // Copia o banco de dados original embutido no .exe para a pasta do usuário na primeira vez
    if (!fs.existsSync(dbPath)) {
        const bundledDbPath = path.join(process.resourcesPath, 'loja.db');
        if (fs.existsSync(bundledDbPath)) {
            fs.copyFileSync(bundledDbPath, dbPath);
        }
    }
} else {
    dbPath = path.join(__dirname, '../loja.db');
}

const db = new sqlite3.Database(dbPath);

function initDb() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER,
            cliente_nome TEXT,
            cliente_tel TEXT,
            pedido_desc TEXT,
            total REAL,
            forma_pagamento TEXT,
            origem TEXT,
            status TEXT DEFAULT 'Pendente',
            data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
            comprovante TEXT,
            endereco TEXT
        )`, (err) => {
            if (!err) {
                db.run("ALTER TABLE pedidos ADD COLUMN comprovante TEXT", () => {});
                db.run("ALTER TABLE pedidos ADD COLUMN endereco TEXT", () => {});
                db.run("ALTER TABLE pedidos ADD COLUMN cliente_id INTEGER", () => {});
            }
        });

        db.run(`CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE,
            preco REAL DEFAULT 0,
            quantidade_estoque INTEGER DEFAULT 0
        )`, () => {
            db.get("SELECT count(*) as qtd FROM produtos", (err, row) => {
                if (row && row.qtd === 0) {
                    const stmt = db.prepare("INSERT INTO produtos (nome, preco, quantidade_estoque) VALUES (?, ?, ?)");
                    const initial = [
                        ['Galeto Completo Familia', 50, 50],
                        ['Galeto Individual', 28, 50],
                        ['Feijão Tropeiro', 25, 30],
                        ['Salpicão', 25, 30],
                        ['Refrigerante 2L', 12, 50],
                        ['Suco Natural', 9, 40]
                    ];
                    initial.forEach(r => stmt.run(r));
                    stmt.finalize();
                }
            });
        });

        db.run(`CREATE TABLE IF NOT EXISTS pedido_itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER,
            produto_id INTEGER,
            quantidade INTEGER DEFAULT 1,
            preco_unitario REAL,
            FOREIGN KEY(pedido_id) REFERENCES pedidos(id),
            FOREIGN KEY(produto_id) REFERENCES produtos(id)
        )`);

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

        db.run(`CREATE TABLE IF NOT EXISTS regioes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE,
            taxa REAL DEFAULT 0
        )`, () => {
            // Inserir regiões iniciais se vazio
            db.get("SELECT count(*) as qtd FROM regioes", (err, row) => {
                if (row && row.qtd === 0) {
                    const stmt = db.prepare("INSERT INTO regioes (nome, taxa) VALUES (?, ?)");
                    const initial = [['Centro', 5], ['Bairro Norte', 8], ['Bairro Sul', 10]];
                    initial.forEach(r => stmt.run(r));
                    stmt.finalize();
                }
            });
        });

        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario TEXT UNIQUE,
            senha TEXT
        )`, () => {
            // Criar admin padrão se não existirem usuários
            db.get("SELECT count(*) as qtd FROM usuarios", (err, row) => {
                if (row && row.qtd === 0) {
                    const bcrypt = require('bcryptjs');
                    const salt = bcrypt.genSaltSync(10);
                    const hash = bcrypt.hashSync('admin123', salt);
                    db.run("INSERT INTO usuarios (usuario, senha) VALUES (?, ?)", ['admin', hash]);
                }
            });
        });

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

function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

module.exports = { db, query, queryOne, run };
