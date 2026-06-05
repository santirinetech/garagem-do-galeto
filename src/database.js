const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

let dbPath;
const isPackaged = process.mainModule && process.mainModule.filename.indexOf('app.asar') !== -1
    || process.argv.some(arg => arg.includes('app.asar'))
    || (process.resourcesPath && __dirname.includes('app.asar'));

if (process.env.PORT) {
    // Ambientes Cloud / Railway
    const dataDir = '/app/data';
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    dbPath = path.join(dataDir, 'loja.db');
} else if (isPackaged) {
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

/**
 * Inicializa e estrutura o banco de dados da galeteria, criando as tabelas e inserindo dados padrão.
 * Garante que o banco está pronto para as operações de negócio.
 * 
 * @returns {void}
 */
function initDb() {
    db.serialize(() => {
        db.run('PRAGMA foreign_keys = ON');

        // ── Usuários ─────────────────────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario   TEXT    NOT NULL UNIQUE,
            senha     TEXT    NOT NULL DEFAULT '',
            criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            db.run(`ALTER TABLE usuarios ADD COLUMN criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`, () => {});
            // Criar admin padrão se vazio
            db.get("SELECT count(*) as qtd FROM usuarios", (err, row) => {
                if (row && row.qtd === 0) {
                    const bcrypt = require('bcryptjs');
                    const hash = bcrypt.hashSync('admin123', 10);
                    db.run("INSERT INTO usuarios (usuario, senha) VALUES (?, ?)", ['admin', hash]);
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
            db.run(`ALTER TABLE clientes ADD COLUMN deleted_at DATETIME`, () => {});
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
            // Garante que os bairros pré-cadastrados existam (sem apagar as edições/inserções manuais)
            const bairrosPadrao = [
                ['Presidente Médici', 2.0],
                ['Morro do Sesi', 3.0],
                ['Porto Novo', 3.0],
                ['Vila Oasis', 3.0],
                ['Graúna', 3.0],
                ['Bairro Aparecida', 3.0],
                ['Mangue Seco', 3.0],
                ['Bela Vista (Morro do Quiabo)', 3.0],
                ['Del porto', 3.0],
                ['Retiro Saudoso', 4.0],
                ['Tucum', 4.0],
                ['Flexal', 5.0],
                ['Nova canaã', 5.0],
                ['Santa Rosa', 5.0],
                ['Tabajara', 5.0],
                ['Vila Prudêncio', 5.0],
                ['Itacibá', 7.0],
                ['Campo Grande', 10.0]
            ];
            const stmt = db.prepare("INSERT OR IGNORE INTO regioes (nome, taxa_entrega) VALUES (?, ?)");
            bairrosPadrao.forEach(r => stmt.run(r));
            stmt.finalize();
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

            // Gerenciamento de Produtos: Remove obsoletos e garante os atuais via INSERT OR IGNORE
            setTimeout(() => {
                const removerAntigos = ['Galeto Completo Família', 'Galeto Individual', 'Refrigerante 2L', 'Suco Natural'];
                removerAntigos.forEach(nome => {
                    db.run("DELETE FROM produtos WHERE nome = ?", [nome], () => {});
                });
                
                const produtosPadrao = [
                    ['Galeto com Farofa', 45.0, 50, 1, '/img/galeto.png'], // Categoria 1 (Principais)
                    ['Salpicão',          25.0, 30, 2, '/img/salpicao.png'], // Categoria 2 (Acompanhamentos)
                    ['Feijão Tropeiro',   25.0, 30, 2, '/img/feijao.png']
                ];
                
                const stmt = db.prepare("INSERT OR IGNORE INTO produtos (nome, preco_unitario, quantidade_estoque, categoria_id, imagem_url) VALUES (?, ?, ?, ?, ?)");
                produtosPadrao.forEach(r => stmt.run(r));
                stmt.finalize();
            }, 500);
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
            is_test          INTEGER NOT NULL DEFAULT 0,
            atualizado_em    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            db.run(`ALTER TABLE pedidos ADD COLUMN cliente_id INTEGER`, () => {});
            db.run(`ALTER TABLE pedidos ADD COLUMN endereco_entrega TEXT`, () => {});
            db.run(`ALTER TABLE pedidos ADD COLUMN pedido_descricao TEXT`, () => {});
            db.run(`ALTER TABLE pedidos ADD COLUMN taxa_aplicada REAL NOT NULL DEFAULT 0.0`, () => {});
            db.run(`ALTER TABLE pedidos ADD COLUMN comprovante_url TEXT`, () => {});
            db.run(`ALTER TABLE pedidos ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0`, () => {});
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
            is_test      INTEGER NOT NULL DEFAULT 0,
            data_hora    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`, () => {
            db.run(`ALTER TABLE despesas ADD COLUMN usuario_id INTEGER`, () => {});
            db.run(`ALTER TABLE despesas ADD COLUMN categoria_id INTEGER`, () => {});
            db.run(`ALTER TABLE despesas ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0`, () => {});
        });

        // ── Estoque legado (mantido por compatibilidade) ──────────
        db.run(`CREATE TABLE IF NOT EXISTS estoque (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            item       TEXT,
            quantidade INTEGER
        )`);

        // ── Configurações do Sistema ──────────────────────────────
        db.run(`CREATE TABLE IF NOT EXISTS configuracoes (
            chave TEXT PRIMARY KEY,
            valor TEXT NOT NULL
        )`, () => {
            db.get("SELECT count(*) as qtd FROM configuracoes", (err, row) => {
                if (row && row.qtd === 0) {
                    const stmt = db.prepare("INSERT INTO configuracoes (chave, valor) VALUES (?, ?)");
                    [['whatsapp_dono', '5527988573982'], ['pix_chave', '27988573982']].forEach(r => stmt.run(r));
                    stmt.finalize();
                }
            });
        });
    });
}

initDb();

/**
 * Executa uma consulta no banco de dados e retorna todos os resultados.
 * 
 * @param {string} sql A instrução SQL a ser executada.
 * @param {Array} [params=[]] Parâmetros opcionais para a query SQL.
 * @returns {Promise<Array>} Uma promise que resolve para um array de resultados.
 * @throws {Error} Lança um erro se a execução da consulta falhar.
 */
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
    });
}

/**
 * Executa uma consulta no banco de dados e retorna o primeiro resultado encontrado.
 * 
 * @param {string} sql A instrução SQL a ser executada.
 * @param {Array} [params=[]] Parâmetros opcionais para a query SQL.
 * @returns {Promise<Object|undefined>} Uma promise que resolve para a linha resultante ou undefined.
 * @throws {Error} Lança um erro se a execução da consulta falhar.
 */
function queryOne(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
    });
}

/**
 * Executa uma instrução SQL (INSERT, UPDATE, DELETE) que não retorna linhas, 
 * devolvendo o contexto da execução.
 * 
 * @param {string} sql A instrução SQL a ser executada.
 * @param {Array} [params=[]] Parâmetros opcionais para a instrução SQL.
 * @returns {Promise<Object>} Uma promise que resolve para o contexto da instrução (`this` do sqlite3).
 * @throws {Error} Lança um erro se a execução da instrução falhar.
 */
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

module.exports = { db, query, queryOne, run };
