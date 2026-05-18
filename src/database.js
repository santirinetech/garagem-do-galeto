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
        // Tabela Pedidos
        db.run(`CREATE TABLE IF NOT EXISTS pedidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER,
            endereco_entrega TEXT,
            pedido_descricao TEXT,
            origem TEXT DEFAULT 'balcao',
            status TEXT DEFAULT 'pendente',
            taxa_aplicada REAL DEFAULT 0.0,
            total REAL DEFAULT 0.0,
            forma_pagamento TEXT,
            data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
            comprovante_url TEXT,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (!err) {
                // Tenta adicionar colunas legadas caso a tabela já existisse no formato antigo
                db.run("ALTER TABLE pedidos ADD COLUMN cliente_id INTEGER", () => {});
                db.run("ALTER TABLE pedidos ADD COLUMN endereco_entrega TEXT", () => {});
                db.run("ALTER TABLE pedidos ADD COLUMN pedido_descricao TEXT", () => {});
                db.run("ALTER TABLE pedidos ADD COLUMN origem TEXT DEFAULT 'balcao'", () => {});
                db.run("ALTER TABLE pedidos ADD COLUMN status TEXT DEFAULT 'pendente'", () => {});
                db.run("ALTER TABLE pedidos ADD COLUMN taxa_aplicada REAL DEFAULT 0.0", () => {});
                db.run("ALTER TABLE pedidos ADD COLUMN forma_pagamento TEXT", () => {});
                db.run("ALTER TABLE pedidos ADD COLUMN comprovante_url TEXT", () => {});
                db.run("ALTER TABLE pedidos ADD COLUMN atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP", () => {});
            }
        });

        // Tabela Categoria Produtos
        db.run(`CREATE TABLE IF NOT EXISTS categoria_produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE,
            nome_listagem TEXT UNIQUE,
            descricao TEXT,
            status INTEGER DEFAULT 1,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            db.get("SELECT count(*) as qtd FROM categoria_produtos", (err, row) => {
                if (row && row.qtd === 0) {
                    const stmt = db.prepare("INSERT INTO categoria_produtos (nome, nome_listagem) VALUES (?, ?)");
                    [['Assados', 'Nossos Assados'], ['Acompanhamentos', 'Acompanhamentos'], ['Bebidas', 'Bebidas Geladas']].forEach(n => stmt.run(n));
                    stmt.finalize();
                }
            });
        });

        // Tabela Produtos
        db.run(`CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            categoria_id INTEGER,
            nome TEXT UNIQUE,
            descricao TEXT,
            quantidade_estoque INTEGER DEFAULT 0,
            preco_unitario REAL DEFAULT 0.0,
            status INTEGER DEFAULT 1,
            imagem_url TEXT,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(categoria_id) REFERENCES categoria_produtos(id)
        )`, (err) => {
            if (!err) {
                db.run("ALTER TABLE produtos ADD COLUMN categoria_id INTEGER", () => {});
                db.run("ALTER TABLE produtos ADD COLUMN descricao TEXT", () => {});
                db.run("ALTER TABLE produtos ADD COLUMN status INTEGER DEFAULT 1", () => {});
                db.run("ALTER TABLE produtos ADD COLUMN imagem_url TEXT", () => {});
                db.run("ALTER TABLE produtos ADD COLUMN atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP", () => {});
            }
            db.get("SELECT count(*) as qtd FROM produtos", (err, row) => {
                if (row && row.qtd === 0) {
                    const stmt = db.prepare("INSERT INTO produtos (nome, preco_unitario, quantidade_estoque, categoria_id) VALUES (?, ?, ?, ?)");
                    const initial = [
                        ['Galeto Completo Familia', 50, 50, 1],
                        ['Galeto Individual', 28, 50, 1],
                        ['Feijão Tropeiro', 25, 30, 2],
                        ['Salpicão', 25, 30, 2],
                        ['Refrigerante 2L', 12, 50, 3],
                        ['Suco Natural', 9, 40, 3]
                    ];
                    initial.forEach(r => stmt.run(r));
                    stmt.finalize();
                }
            });
        });

        // Tabela Itens Pedido
        db.run(`CREATE TABLE IF NOT EXISTS itens_pedido (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pedido_id INTEGER,
            produto_id INTEGER,
            quantidade INTEGER DEFAULT 1,
            preco_unitario REAL,
            FOREIGN KEY(pedido_id) REFERENCES pedidos(id),
            FOREIGN KEY(produto_id) REFERENCES produtos(id)
        )`);

        // Tabela Categoria Despesas
        db.run(`CREATE TABLE IF NOT EXISTS categoria_despesas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE,
            descricao TEXT,
            status INTEGER DEFAULT 1,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Tabela Despesas
        db.run(`CREATE TABLE IF NOT EXISTS despesas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            descricao TEXT,
            categoria_id INTEGER,
            valor REAL,
            data_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
            FOREIGN KEY(categoria_id) REFERENCES categoria_despesas(id)
        )`, (err) => {
            if (!err) {
                db.run("ALTER TABLE despesas ADD COLUMN usuario_id INTEGER", () => {});
                db.run("ALTER TABLE despesas ADD COLUMN categoria_id INTEGER", () => {});
            }
        });

        // Tabela Clientes
        db.run(`CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            telefone TEXT UNIQUE,
            compras_qtd INTEGER DEFAULT 0,
            valor_gasto REAL DEFAULT 0.0,
            ultimo_pedido DATETIME,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (!err) {
                db.run("ALTER TABLE clientes ADD COLUMN criado_em DATETIME DEFAULT CURRENT_TIMESTAMP", () => {});
            }
        });

        // Tabela Regiões
        db.run(`CREATE TABLE IF NOT EXISTS regioes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE,
            taxa_entrega REAL DEFAULT 0.0
        )`, (err) => {
            if (!err) {
                db.run("ALTER TABLE regioes ADD COLUMN taxa_entrega REAL DEFAULT 0.0", () => {
                    db.run("UPDATE regioes SET taxa_entrega = taxa WHERE taxa_entrega = 0.0 AND taxa IS NOT NULL", () => {});
                });
            }
            db.get("SELECT count(*) as qtd FROM regioes", (err, row) => {
                if (row && row.qtd === 0) {
                    const stmt = db.prepare("INSERT INTO regioes (nome, taxa_entrega) VALUES (?, ?)");
                    const initial = [['Centro', 5], ['Bairro Norte', 8], ['Bairro Sul', 10]];
                    initial.forEach(r => stmt.run(r));
                    stmt.finalize();
                }
            });
        });

        // Tabela Endereços
        db.run(`CREATE TABLE IF NOT EXISTS enderecos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id INTEGER,
            regiao_id INTEGER,
            logradouro TEXT,
            complemento TEXT,
            referencia TEXT,
            FOREIGN KEY(cliente_id) REFERENCES clientes(id),
            FOREIGN KEY(regiao_id) REFERENCES regioes(id)
        )`);

        // Tabela Usuarios
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario TEXT UNIQUE,
            senha_hash TEXT,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (!err) {
                db.run("ALTER TABLE usuarios ADD COLUMN senha_hash TEXT", () => {
                    db.run("UPDATE usuarios SET senha_hash = senha WHERE senha IS NOT NULL");
                });
                db.run("ALTER TABLE usuarios ADD COLUMN criado_em DATETIME DEFAULT CURRENT_TIMESTAMP", () => {});
            }
            db.get("SELECT count(*) as qtd FROM usuarios", (err, row) => {
                if (row && row.qtd === 0) {
                    const bcrypt = require('bcryptjs');
                    const salt = bcrypt.genSaltSync(10);
                    const hash = bcrypt.hashSync('admin123', salt);
                    db.run("INSERT INTO usuarios (usuario, senha_hash) VALUES (?, ?)", ['admin', hash]);
                }
            });
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
