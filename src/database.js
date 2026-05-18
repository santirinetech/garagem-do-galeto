const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let dbPath;
const isPackaged = process.mainModule && process.mainModule.filename.indexOf('app.asar') !== -1
    || process.argv.some(arg => arg.includes('app.asar'))
    || (process.resourcesPath && __dirname.includes('app.asar'));

if (isPackaged) {
    const appData = process.env.APPDATA || process.env.HOME;
    const userDataDir = path.join(appData, 'GaletoMaster');
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });
    dbPath = path.join(userDataDir, 'loja.db');
    if (!fs.existsSync(dbPath)) {
        const bundledDbPath = path.join(process.resourcesPath, 'loja.db');
        if (fs.existsSync(bundledDbPath)) fs.copyFileSync(bundledDbPath, dbPath);
    }
} else {
    dbPath = path.join(__dirname, '../loja.db');
}

const db = new sqlite3.Database(dbPath);

function initDb() {
    db.serialize(() => {
        db.run('PRAGMA foreign_keys = ON');

        // ── Usuários ─────────────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario   TEXT    NOT NULL UNIQUE,
            senha_hash TEXT   NOT NULL DEFAULT '',
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            // Migração: copiar senha → senha_hash se existir
            db.run(`ALTER TABLE usuarios ADD COLUMN senha_hash TEXT NOT NULL DEFAULT ''`, () => {
                db.run(`UPDATE usuarios SET senha_hash = senha WHERE senha_hash = '' AND senha IS NOT NULL`);
            });
            db.run(`ALTER TABLE usuarios ADD COLUMN criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`, () => {});
            // Criar admin padrão se vazio
            db.get("SELECT count(*) as qtd FROM usuarios", (err, row) => {
                if (row && row.qtd === 0) {
                    const bcrypt = require('bcryptjs');
                    const hash = bcrypt.hashSync('admin123', 10);
                    db.run("INSERT INTO usuarios (usuario, senha_hash) VALUES (?, ?)", ['admin', hash]);
                }
            });
        });

        // ── Clientes ──────────────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS clientes (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            nome          TEXT    NOT NULL,
            telefone      TEXT    NOT NULL UNIQUE,
            compras_qtd   INTEGER NOT NULL DEFAULT 0,
            valor_gasto   REAL    NOT NULL DEFAULT 0.0,
            ultimo_pedido DATETIME,
            criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            db.run(`ALTER TABLE clientes ADD COLUMN criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`, () => {});
        });

        // ── Regiões ───────────────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS regioes (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            nome         TEXT    NOT NULL UNIQUE,
            taxa_entrega REAL    NOT NULL DEFAULT 0.0
        )`, () => {
            // Migração: renomear taxa → taxa_entrega se necessário
            db.run(`ALTER TABLE regioes ADD COLUMN taxa_entrega REAL NOT NULL DEFAULT 0.0`, () => {
                db.run(`UPDATE regioes SET taxa_entrega = taxa WHERE taxa_entrega = 0.0 AND taxa IS NOT NULL AND taxa > 0`, () => {});
            });
            db.get("SELECT count(*) as qtd FROM regioes", (err, row) => {
                if (row && row.qtd === 0) {
                    const stmt = db.prepare("INSERT INTO regioes (nome, taxa_entrega) VALUES (?, ?)");
                    [['Centro', 5.0], ['Bairro Norte', 8.0], ['Bairro Sul', 10.0]].forEach(r => stmt.run(r));
                    stmt.finalize();
                }
            });
        });

        // ── Endereços ─────────────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS enderecos (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id  INTEGER NOT NULL REFERENCES clientes(id),
            regiao_id   INTEGER NOT NULL REFERENCES regioes(id),
            logradouro  TEXT    NOT NULL,
            complemento TEXT,
            referencia  TEXT
        )`);

        // ── Categoria de Produtos ─────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS categoria_produtos (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            nome          TEXT    NOT NULL UNIQUE,
            nome_listagem TEXT    NOT NULL UNIQUE,
            descricao     TEXT,
            status        INTEGER NOT NULL DEFAULT 1,
            criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            db.run(`ALTER TABLE categoria_produtos ADD COLUMN nome_listagem TEXT NOT NULL DEFAULT ''`, () => {
                db.run(`UPDATE categoria_produtos SET nome_listagem = nome WHERE nome_listagem = ''`);
            });
            db.run(`ALTER TABLE categoria_produtos ADD COLUMN descricao TEXT`, () => {});
            db.run(`ALTER TABLE categoria_produtos ADD COLUMN status INTEGER NOT NULL DEFAULT 1`, () => {});
            db.run(`ALTER TABLE categoria_produtos ADD COLUMN criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`, () => {});
            db.run(`ALTER TABLE categoria_produtos ADD COLUMN atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`, () => {});

            db.get("SELECT count(*) as qtd FROM categoria_produtos", (err, row) => {
                if (row && row.qtd === 0) {
                    const stmt = db.prepare("INSERT INTO categoria_produtos (nome, nome_listagem) VALUES (?, ?)");
                    [['Assados', 'Nossos Assados'], ['Acompanhamentos', 'Acompanhamentos'], ['Bebidas', 'Bebidas Geladas']].forEach(r => stmt.run(r));
                    stmt.finalize();
                }
            });
        });

        // ── Produtos ──────────────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS produtos (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            categoria_id       INTEGER REFERENCES categoria_produtos(id),
            nome               TEXT    NOT NULL UNIQUE,
            descricao          TEXT,
            quantidade_estoque INTEGER NOT NULL DEFAULT 0,
            preco_unitario     REAL    NOT NULL DEFAULT 0.0,
            status             INTEGER NOT NULL DEFAULT 1,
            imagem_url         TEXT,
            atualizado_em      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            db.run(`ALTER TABLE produtos ADD COLUMN categoria_id INTEGER`, () => {});
            db.run(`ALTER TABLE produtos ADD COLUMN descricao TEXT`, () => {});
            db.run(`ALTER TABLE produtos ADD COLUMN status INTEGER NOT NULL DEFAULT 1`, () => {});
            db.run(`ALTER TABLE produtos ADD COLUMN imagem_url TEXT`, () => {});
            db.run(`ALTER TABLE produtos ADD COLUMN atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`, () => {});
            // Se só tem preco (legado), adicionar preco_unitario
            db.run(`ALTER TABLE produtos ADD COLUMN preco_unitario REAL NOT NULL DEFAULT 0.0`, () => {
                db.run(`UPDATE produtos SET preco_unitario = preco WHERE preco_unitario = 0.0 AND preco IS NOT NULL AND preco > 0`, () => {});
            });

            db.get("SELECT count(*) as qtd FROM produtos", (err, row) => {
                if (row && row.qtd === 0) {
                    const stmt = db.prepare("INSERT INTO produtos (nome, preco_unitario, quantidade_estoque, categoria_id) VALUES (?, ?, ?, ?)");
                    [
                        ['Galeto Completo Família', 50.0, 50, 1],
                        ['Galeto Individual',       28.0, 50, 1],
                        ['Feijão Tropeiro',         25.0, 30, 2],
                        ['Salpicão',                25.0, 30, 2],
                        ['Refrigerante 2L',         12.0, 50, 3],
                        ['Suco Natural',             9.0, 40, 3],
                    ].forEach(r => stmt.run(r));
                    stmt.finalize();
                }
            });
        });

        // ── Pedidos ───────────────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS pedidos (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id       INTEGER REFERENCES clientes(id),
            endereco_entrega TEXT,
            pedido_descricao TEXT,
            origem           TEXT    NOT NULL DEFAULT 'balcao',
            status           TEXT    NOT NULL DEFAULT 'pendente',
            taxa_aplicada    REAL    NOT NULL DEFAULT 0.0,
            total            REAL    NOT NULL DEFAULT 0.0,
            forma_pagamento  TEXT,
            data_hora        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            comprovante_url  TEXT,
            atualizado_em    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            db.run(`ALTER TABLE pedidos ADD COLUMN cliente_id INTEGER`, () => {});
            db.run(`ALTER TABLE pedidos ADD COLUMN endereco_entrega TEXT`, () => {});
            db.run(`ALTER TABLE pedidos ADD COLUMN pedido_descricao TEXT`, () => {});
            db.run(`ALTER TABLE pedidos ADD COLUMN taxa_aplicada REAL NOT NULL DEFAULT 0.0`, () => {});
            db.run(`ALTER TABLE pedidos ADD COLUMN comprovante_url TEXT`, () => {});
            db.run(`ALTER TABLE pedidos ADD COLUMN atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`, () => {});
        });

        // ── Itens do Pedido ───────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS itens_pedido (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id      INTEGER NOT NULL REFERENCES pedidos(id),
            produto_id     INTEGER NOT NULL REFERENCES produtos(id),
            quantidade     INTEGER NOT NULL DEFAULT 1,
            preco_unitario REAL    NOT NULL DEFAULT 0.0
        )`);

        // ── Categoria de Despesas ─────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS categoria_despesas (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            nome          TEXT    NOT NULL UNIQUE,
            descricao     TEXT,
            status        INTEGER NOT NULL DEFAULT 1,
            criado_em     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            db.get("SELECT count(*) as qtd FROM categoria_despesas", (err, row) => {
                if (row && row.qtd === 0) {
                    const stmt = db.prepare("INSERT INTO categoria_despesas (nome) VALUES (?)");
                    ['Ingredientes', 'Embalagem', 'Gás e Combustível', 'Mão de Obra', 'Marketing', 'Outros'].forEach(n => stmt.run([n]));
                    stmt.finalize();
                }
            });
        });

        // ── Despesas ──────────────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS despesas (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id   INTEGER REFERENCES usuarios(id),
            descricao    TEXT    NOT NULL,
            categoria_id INTEGER REFERENCES categoria_despesas(id),
            valor        REAL    NOT NULL DEFAULT 0.0,
            data_hora    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            db.run(`ALTER TABLE despesas ADD COLUMN usuario_id INTEGER`, () => {});
            db.run(`ALTER TABLE despesas ADD COLUMN categoria_id INTEGER`, () => {});
        });

        // ── Estoque legado (mantido por compatibilidade) ──────────
        db.run(`CREATE TABLE IF NOT EXISTS estoque (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            item       TEXT,
            quantidade INTEGER
        )`);
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
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

module.exports = { db, query, queryOne, run };
