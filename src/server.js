const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const { db, query, queryOne, run } = require('./database');
const { initWhatsApp, getBotStatus, enviarMensagemPainel } = require('./whatsapp-bot');
require('dotenv').config(); // Carrega as variaveis de ambiente

// ── SSE: Atualização em tempo real ──────────────────────────
let clients = [];
/**
 * Emite um evento de atualização (SSE - Server-Sent Events) para todos os clientes conectados.
 * Utilizado para atualizar o dashboard em tempo real quando há novos pedidos ou mudanças de status.
 *
 * @returns {void}
 */
function emitUpdate() {
    clients.forEach(c => {
        try { c.res.write('data: update\n\n'); } catch (e) { }
    });
}

const fs = require('fs');

const isPackaged = process.mainModule && process.mainModule.filename.indexOf('app.asar') !== -1 || process.argv.some(arg => arg.includes('app.asar')) || (process.resourcesPath && __dirname.includes('app.asar'));
let uploadDir;
let dataDir;
if (process.env.NODE_ENV === 'production' && !isPackaged) {
    dataDir = path.join(process.cwd(), 'data');
    uploadDir = path.join(dataDir, 'uploads');
} else if (isPackaged) {
    const appData = process.env.APPDATA || process.env.HOME;
    dataDir = path.join(appData, 'GaletoMaster');
    uploadDir = path.join(dataDir, 'uploads');
} else {
    dataDir = path.join(__dirname, '..');
    uploadDir = path.join(__dirname, '../public/uploads/');
}

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '-'))
});
const upload = multer({ storage });

const { Server } = require('socket.io');

/**
 * Inicializa o servidor Express, configurando middlewares, rotas de API e conexões WebSocket.
 *
 * @param {Object} [mainWindow=null] Instância opcional da janela principal do Electron (se rodando no desktop).
 * @returns {Object} A instância do servidor Express configurada.
 */
function startServer(mainWindow = null) {
    const server = express();
    const http = require('http');
    const httpServer = http.createServer(server);

    // Configuração do Socket.io para comunicação em tempo real com o Electron
    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        console.log(`[Socket.io] Novo cliente conectado (Painel/Electron): ${socket.id}`);
        socket.on('disconnect', () => {
            console.log(`[Socket.io] Cliente desconectado: ${socket.id}`);
        });
    });

    server.set('io', io);

    // Segurança: Configuração de Cabeçalhos
    server.use(helmet({
        contentSecurityPolicy: false,
        crossOriginEmbedderPolicy: false
    }));

    server.use(bodyParser.json());

    // Habilitar credenciais no CORS para permitir que o Electron envie cookies de sessão ao servidor remoto
    server.use(cors({ origin: true, credentials: true }));

    // Confiar no proxy reverso
    server.set('trust proxy', 1);

    // Configuração de sessão com persistência no SQLite
    server.use(session({
        store: new SQLiteStore({
            db: 'sessions.db',
            dir: dataDir
        }),
        name: 'galetomaster_sess',
        secret: process.env.SESSION_SECRET || 'secret_fallback_local_inseguro_123',
        resave: false,
        saveUninitialized: false,
        cookie: {
            secure: process.env.NODE_ENV === 'production',
            httpOnly: true,
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 1000 * 60 * 60 * 24
        }
    }));

    // Middleware de Proteção de Rotas
    const authMiddleware = (req, res, next) => {
        const publicPaths = ['/api/login', '/api/novo-pedido', '/api/cardapio-itens'];
        const isPublicApi = publicPaths.includes(req.path);
        const isStaticFile = !req.path.startsWith('/api');

        if (isPublicApi || isStaticFile || req.session.userId) {
            return next();
        }

        res.status(401).json({
            erro: 'Não autorizado. Por favor, faça login.'
        });
    };

    // Rate Limiter
    const pedidoLimiter = rateLimit({
        windowMs: 60 * 60 * 1000,
        max: 30,
        message: {
            erro: 'Muitos pedidos enviados deste IP. Tente novamente em uma hora.'
        }
    });

    // Arquivos públicos
    server.use(express.static(path.join(__dirname, '..', 'public')));

    // Uploads
    server.use('/uploads', express.static(uploadDir));

    // Cardápio
    server.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    });

    // SSE
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

    // ──────── WHATSAPP ────────
    const broadcastWppEvent = (evt) => {
        clients.forEach(c => {
            try {
                c.res.write(`data: ${JSON.stringify(evt)}\n\n`);
            } catch (e) { }
        });
    };

    const wppEnv = process.env.ENABLE_WHATSAPP
        ? process.env.ENABLE_WHATSAPP.toLowerCase()
        : "";

    const isWppEnabled =
        wppEnv === "true";

    if (isWppEnabled) {
        initWhatsApp(db, emitUpdate, broadcastWppEvent);
        console.log("WhatsApp carregado.");
    } else {
        console.log("WhatsApp desabilitado (ENABLE_WHATSAPP não está 'true').");
    }

    server.get('/health', (req, res) => {
        res.json({ status: "ok" });
    });

    server.get('/api/whatsapp/status', (req, res) => {
        res.json(getBotStatus());
    });

    // ──────── AUTENTICAÇÃO ────────
    server.post('/api/login', async (req, res) => {
        const { usuario, senha } = req.body;

        try {
            const user = await queryOne(
                "SELECT * FROM usuarios WHERE usuario = ?",
                [usuario]
            );

            if (!user) {
                return res.status(401).json({
                    erro: 'Usuário ou senha incorretos'
                });
            }

            const match = await bcrypt.compare(senha, user.senha);

            if (!match) {
                return res.status(401).json({
                    erro: 'Usuário ou senha incorretos'
                });
            }

            req.session.userId = user.id;
            req.session.username = user.usuario;

            res.json({
                status: 'sucesso',
                usuario: user.usuario
            });

        } catch (e) {
            res.status(500).json({
                erro: 'Erro interno no servidor'
            });
        }
    });

    server.post('/api/logout', (req, res) => {
        req.session.destroy(err => {
            if (err) {
                return res.status(500).json({
                    erro: 'Erro ao sair'
                });
            }

            res.clearCookie('connect.sid');

            res.json({
                status: 'sucesso'
            });
        });
    });

    server.get('/api/check-session', (req, res) => {
        if (req.session.userId) {
            res.json({
                logado: true,
                usuario: req.session.username
            });
        } else {
            res.json({
                logado: false
            });
        }
    });

    // ──────── NOVO PEDIDO ────────
    server.post(
        '/api/novo-pedido',
        pedidoLimiter,
        upload.single('comprovante'),
        async (req, res) => {

            const {
                nome,
                telefone,
                pedido,
                total,
                pagamento,
                origem,
                endereco,
                itens,
                taxa
            } = req.body;

            const comprovante = req.file
                ? `/uploads/${req.file.filename}`
                : null;

            const taxa_aplicada = parseFloat(taxa) || 0.0;

            if (!nome || (!pedido && !itens) || total === undefined) {
                return res.status(400).json({
                    erro: 'Campos obrigatórios: nome, pedido/itens, total'
                });
            }

            let transacaoAtiva = false;

            try {

                // ── Validação de estoque antes de criar o pedido ──
                if (itens) {
                    const parsedItens = JSON.parse(itens);

                    for (const item of parsedItens) {
                        const quantidadeSolicitada = parseInt(item.quantidade) || 1;

                        const produto = await queryOne(
                            `
                            SELECT
                                id,
                                nome,
                                quantidade_estoque,
                                status,
                                deleted_at
                            FROM produtos
                            WHERE (nome = ? OR id = ?)
                            AND deleted_at IS NULL
                            `,
                            [
                                item.nome,
                                item.id
                            ]
                        );

                        if (!produto) {
                            return res.status(404).json({
                                erro: `Produto "${item.nome}" não encontrado.`
                            });
                        }

                        if (produto.status !== 1) {
                            return res.status(400).json({
                                erro: `O produto "${produto.nome}" está inativo.`
                            });
                        }

                        if (produto.quantidade_estoque < quantidadeSolicitada) {
                            return res.status(400).json({
                                erro:
                                    `Estoque insuficiente para "${produto.nome}". ` +
                                    `Disponível: ${produto.quantidade_estoque}. ` +
                                    `Solicitado: ${quantidadeSolicitada}.`
                            });
                        }
                    }
                }
                
                await run('BEGIN IMMEDIATE TRANSACTION');
                transacaoAtiva = true;

                await run(`
                    INSERT INTO clientes (
                        nome,
                        telefone,
                        compras_qtd,
                        valor_gasto,
                        ultimo_pedido
                    )
                    VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(telefone) DO UPDATE SET
                        nome = CASE
                            WHEN nome LIKE '%' || excluded.nome || '%'
                            THEN nome
                            ELSE nome || ' / ' || excluded.nome
                        END,
                        compras_qtd = compras_qtd + 1,
                        valor_gasto = valor_gasto + excluded.valor_gasto,
                        ultimo_pedido = CURRENT_TIMESTAMP,
                        deleted_at = NULL
                `, [
                    nome,
                    telefone,
                    total
                ]);

                const cliente = await queryOne(
                    "SELECT id FROM clientes WHERE telefone = ?",
                    [telefone]
                );

                const cliente_id = cliente.id;

                let pedidoDescStr = pedido || '';

                const sqlPedido = `
                    INSERT INTO pedidos (
                        cliente_id,
                        endereco_entrega,
                        pedido_descricao,
                        origem,
                        taxa_aplicada,
                        total,
                        forma_pagamento,
                        comprovante_url,
                        status
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pendente')
                `;

                const resultPedido = await run(
                    sqlPedido,
                    [
                        cliente_id,
                        endereco,
                        pedidoDescStr,
                        origem || 'balcao',
                        taxa_aplicada,
                        total,
                        pagamento,
                        comprovante
                    ]
                );

                const pedido_id = resultPedido.lastID;

                // Processamento de itens
                if (itens) {
                    const parsedItens = JSON.parse(itens);
                    pedidoDescStr = '';

                    for (let item of parsedItens) {
                        const prod = await queryOne(
                            `
                            SELECT id, preco_unitario
                            FROM produtos
                            WHERE (nome = ? OR id = ?)
                              AND deleted_at IS NULL
                            `,
                            [
                                item.nome,
                                item.id
                            ]
                        );

                        if (prod) {
                            await run(
                                `
                                INSERT INTO itens_pedido (
                                    pedido_id,
                                    produto_id,
                                    quantidade,
                                    preco_unitario
                                )
                                VALUES (?, ?, ?, ?)
                                `,
                                [
                                    pedido_id,
                                    prod.id,
                                    item.quantidade || 1,
                                    prod.preco_unitario || item.preco
                                ]
                            );

                            const quantidadeComprada =
                                Number(item.quantidade) || 1;

                            const resultadoEstoque = await run(
                                `
                                UPDATE produtos
                                SET quantidade_estoque =
                                        quantidade_estoque - ?,
                                    atualizado_em = CURRENT_TIMESTAMP
                                WHERE id = ?
                                AND deleted_at IS NULL
                                AND quantidade_estoque >= ?
                                `,
                                [
                                    quantidadeComprada,
                                    prod.id,
                                    quantidadeComprada
                                ]
                            );

                            if (resultadoEstoque.changes === 0) {
                                const estoqueAtual = await queryOne(
                                    `
                                    SELECT
                                        nome,
                                        quantidade_estoque
                                    FROM produtos
                                    WHERE id = ?
                                    AND deleted_at IS NULL
                                    `,
                                    [prod.id]
                                );

                                throw new Error(
                                    `Estoque insuficiente para "${item.nome}". ` +
                                    `Disponível: ${estoqueAtual?.quantidade_estoque ?? 0}. ` +
                                    `Solicitado: ${quantidadeComprada}.`
                                );
                            }
                        }

                        pedidoDescStr +=
                            `${item.quantidade || 1}x ${item.nome}, `;
                    }

                    pedidoDescStr =
                        pedidoDescStr.slice(0, -2);

                    await run(
                        `
                        UPDATE pedidos
                        SET pedido_descricao = ?
                        WHERE id = ?
                        `,
                        [
                            pedidoDescStr,
                            pedido_id
                        ]
                    );

                }
                await run('COMMIT');
                transacaoAtiva = false;

                console.log(
                    `[INFO] Recebido novo pedido do site (#${pedido_id}). Despachando para Electron via Socket.io...`
                );

                const io = req.app.get('io');

                if (io) {
                    const dadosPedido = {
                        id: pedido_id,
                        nome,
                        telefone,
                        pedido: pedidoDescStr,
                        itens: itens
                            ? JSON.parse(itens)
                            : [],
                        taxa: taxa_aplicada,
                        data_hora: new Date().toISOString(),
                        total,
                        pagamento,
                        endereco
                    };

                    io.emit(
                        'painel:novo-pedido',
                        dadosPedido
                    );
                }

                emitUpdate();

                if (mainWindow) {
                    mainWindow.webContents.send(
                        'atualizar-dashboard'
                    );
                }

                res.json({
                    mensagem: 'Sucesso',
                    id_pedido: pedido_id,
                    comprovante
                });

            } catch (e) {
                if (transacaoAtiva) {
                    try {
                        await run('ROLLBACK');
                        transacaoAtiva = false;
                    } catch (rollbackError) {
                        console.error(
                            '[ERRO] Falha ao executar rollback:',
                            rollbackError
                        );
                    }
                }

                console.error(
                    '[ERRO] Erro ao registrar pedido:',
                    e
                );

                const estoqueInsuficiente =
                    e.message?.includes('Estoque insuficiente');

                res
                    .status(estoqueInsuficiente ? 409 : 500)
                    .json({
                        erro: e.message
                    });
            }
        }
    );

    // ──────── PEDIDOS ────────
    server.put('/api/pedidos/:id', async (req, res) => {
        const {
            pedido_descricao,
            total,
            endereco_entrega,
            forma_pagamento
        } = req.body;

        try {
            await run(`
                UPDATE pedidos
                SET pedido_descricao = ?,
                    total = ?,
                    endereco_entrega = ?,
                    forma_pagamento = ?
                WHERE id = ?
            `, [
                pedido_descricao,
                parseFloat(total),
                endereco_entrega,
                forma_pagamento,
                req.params.id
            ]);

            res.json({
                status: 'ok'
            });

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    server.patch('/pedido/:id/status', (req, res) => {
        const { id } = req.params;
        const { status } = req.body;

        const validos = [
            'Pendente',
            'Visto',
            'Preparando',
            'Saiu para Entrega',
            'Pronto para Retirada',
            'Entregue',
            'Retirado',
            'Cancelado'
        ];

        if (!validos.includes(status)) {
            return res.status(400).json({
                erro: 'Status inválido'
            });
        }

        db.run(
            "UPDATE pedidos SET status = ? WHERE id = ?",
            [status, id],
            function (err) {
                if (err) {
                    return res.status(500).json({
                        erro: err.message
                    });
                }

                queryOne(`
                    SELECT
                        p.*,
                        c.nome AS cliente_nome,
                        c.telefone AS cliente_tel
                    FROM pedidos p
                    LEFT JOIN clientes c
                        ON p.cliente_id = c.id
                    WHERE p.id = ?
                `, [id]).then(pedido => {
                    if (pedido) {
                        if (
                            [
                                'Preparando',
                                'Saiu para Entrega',
                                'Entregue',
                                'Pronto para Retirada',
                                'Retirado'
                            ].includes(status) &&
                            pedido.cliente_tel
                        ) {
                            let msg = "";

                            if (status === 'Preparando') {
                                msg =
                                    `Olá ${pedido.cliente_nome}! Seu pedido #${pedido.id} já está sendo preparado com muito carinho aqui na Garagem do Galeto! 🔥`;

                            } else if (status === 'Saiu para Entrega') {
                                msg =
                                    `Boas notícias, ${pedido.cliente_nome}! Seu pedido #${pedido.id} acabou de sair para entrega e logo chegará até você! 🛵💨`;

                            } else if (status === 'Entregue') {
                                msg =
                                    `Pedido #${pedido.id} entregue! Esperamos que aproveite sua refeição. Se puder, nos conte o que achou! Obrigado pela preferência. 🍗✨`;

                            } else if (status === 'Pronto para Retirada') {
                                msg =
                                    `Olá ${pedido.cliente_nome}! Seu pedido #${pedido.id} já está PRONTO para retirada! Pode vir buscar o seu Galeto quentinho! 🏃‍♂️💨`;

                            } else if (status === 'Retirado') {
                                msg =
                                    `Pedido #${pedido.id} retirado com sucesso! Bom apetite e muito obrigado pela preferência! 🍗✨`;
                            }

                            enviarMensagemPainel(
                                pedido.cliente_tel,
                                msg
                            );
                        }
                    }
                });

                emitUpdate();

                if (mainWindow) {
                    mainWindow.webContents.send(
                        'atualizar-dashboard'
                    );
                }

                res.json({
                    status: 'ok'
                });
            }
        );
    });

    // ──────── CONFIGURAÇÕES ────────
    server.get('/api/config', async (req, res) => {
        try {
            const rows = await query(
                "SELECT * FROM configuracoes"
            );

            const config = {};

            rows.forEach(r => {
                config[r.chave] = r.valor;
            });

            res.json(config);

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    server.post('/api/config', async (req, res) => {
        const { chave, valor } = req.body;

        if (!chave) {
            return res.status(400).json({
                erro: 'Chave obrigatória'
            });
        }

        try {
            await run(`
                INSERT INTO configuracoes (chave, valor)
                VALUES (?, ?)
                ON CONFLICT(chave)
                DO UPDATE SET valor = excluded.valor
            `, [
                chave,
                valor
            ]);

            res.json({
                status: 'ok'
            });

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    // ──────── DASHBOARD ────────
    server.get('/api/pedidos/hoje', async (req, res) => {
        try {
            const dataFiltro = req.query.data;

            let sql = `
                SELECT
                    p.*,
                    c.nome AS cliente_nome,
                    c.telefone AS cliente_tel
                FROM pedidos p
                LEFT JOIN clientes c
                    ON p.cliente_id = c.id
                WHERE date(p.data_hora, 'localtime') =
                      date('now','localtime')
                ORDER BY p.id DESC
            `;

            const params = [];

            if (dataFiltro) {
                sql = `
                    SELECT
                        p.*,
                        c.nome AS cliente_nome,
                        c.telefone AS cliente_tel
                    FROM pedidos p
                    LEFT JOIN clientes c
                        ON p.cliente_id = c.id
                    WHERE date(p.data_hora, 'localtime') = ?
                    ORDER BY p.id DESC
                `;

                params.push(dataFiltro);
            }

            const rows = await query(
                sql,
                params
            );

            res.json(rows);

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    server.get('/api/resumo', async (req, res) => {
        try {
            const row = await queryOne(`
                SELECT
                    count(*) AS total_pedidos,
                    COALESCE(sum(total), 0) AS faturamento,
                    sum(
                        CASE
                            WHEN origem LIKE 'Site%'
                            THEN 1
                            ELSE 0
                        END
                    ) AS pedidos_site,
                    sum(
                        CASE
                            WHEN origem LIKE 'WhatsApp%'
                            THEN 1
                            ELSE 0
                        END
                    ) AS pedidos_zap,
                    sum(
                        CASE
                            WHEN status = 'pendente'
                              OR status = 'Pendente'
                            THEN 1
                            ELSE 0
                        END
                    ) AS pendentes,
                    sum(
                        CASE
                            WHEN status = 'em_preparo'
                              OR status = 'Preparando'
                            THEN 1
                            ELSE 0
                        END
                    ) AS em_preparo,
                    sum(
                        CASE
                            WHEN status = 'saiu_entrega'
                              OR status = 'Saiu para Entrega'
                            THEN 1
                            ELSE 0
                        END
                    ) AS prontos,
                    sum(
                        CASE
                            WHEN status = 'entregue'
                              OR status = 'Entregue'
                            THEN 1
                            ELSE 0
                        END
                    ) AS entregues,
                    (
                        SELECT COALESCE(sum(total), 0)
                        FROM pedidos
                        WHERE strftime(
                            '%Y-%m',
                            data_hora,
                            'localtime'
                        ) = strftime(
                            '%Y-%m',
                            'now',
                            'localtime'
                        )
                        AND status IN (
                            'Entregue',
                            'Retirado',
                            'entregue',
                            'retirado'
                        )
                    ) AS faturamento_mensal
                FROM pedidos
                WHERE date(
                    data_hora,
                    'localtime'
                ) = date(
                    'now',
                    'localtime'
                )
            `);

            res.json(row);

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    // ──────── ESTOQUE LEGADO ────────
    server.get('/api/estoque', async (req, res) => {
        try {
            const rows = await query(
                "SELECT * FROM estoque ORDER BY item"
            );

            res.json(rows);

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    server.patch('/api/estoque/:id', (req, res) => {
        const { quantidade } = req.body;

        db.run(
            "UPDATE estoque SET quantidade = ? WHERE id = ?",
            [
                parseInt(quantidade),
                req.params.id
            ],
            function (err) {
                if (err) {
                    return res.status(500).json({
                        erro: err.message
                    });
                }

                res.json({
                    status: 'ok'
                });
            }
        );
    });

    // ──────── PRODUTOS E CATEGORIAS ────────

    // Cardápio público
    server.get('/api/cardapio-itens', async (req, res) => {
        try {
            const categorias = await query(
                "SELECT * FROM categoria_produtos WHERE status = 1 ORDER BY nome_listagem"
            );

            const produtos = await query(`
                SELECT *
                FROM produtos
                WHERE status = 1
                  AND deleted_at IS NULL
                ORDER BY nome
            `);

            const menu = categorias
                .map(c => ({
                    id: c.id,
                    nome: c.nome_listagem || c.nome,
                    descricao: c.descricao,
                    produtos: produtos.filter(
                        p => p.categoria_id === c.id
                    )
                }))
                .filter(
                    c => c.produtos.length > 0
                );

            res.json(menu);

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    // Listar produtos
    server.get('/api/produtos', async (req, res) => {
        try {
            const rows = await query(`
                SELECT
                    p.*,
                    c.nome AS categoria_nome
                FROM produtos p
                LEFT JOIN categoria_produtos c
                    ON p.categoria_id = c.id
                WHERE p.deleted_at IS NULL
                ORDER BY c.nome, p.nome
            `);

            res.json(rows);

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    // Buscar produto
    server.get('/api/produtos/:id', async (req, res) => {
        try {
            const row = await queryOne(
                `
                SELECT *
                FROM produtos
                WHERE id = ?
                  AND deleted_at IS NULL
                `,
                [req.params.id]
            );

            if (!row) {
                return res.status(404).json({
                    erro: 'Produto não encontrado.'
                });
            }

            res.json(row);

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    // Criar produto
    server.post('/api/produtos', async (req, res) => {
        const {
            nome,
            categoria_id,
            preco_unitario,
            preco,
            quantidade_estoque,
            imagem_url
        } = req.body;

        const preco_val = parseFloat(
            preco_unitario ??
            preco ??
            0
        );

        try {
            const r = await run(
                `
                INSERT INTO produtos (
                    nome,
                    categoria_id,
                    preco_unitario,
                    quantidade_estoque,
                    imagem_url
                )
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    nome,
                    categoria_id || null,
                    preco_val,
                    parseInt(quantidade_estoque) || 0,
                    imagem_url || null
                ]
            );

            res.json({
                status: 'ok',
                id: r.lastID
            });

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    // Editar produto
    server.put('/api/produtos/:id', async (req, res) => {
        const {
            nome,
            categoria_id,
            preco_unitario,
            preco,
            quantidade_estoque,
            imagem_url
        } = req.body;

        const preco_val = parseFloat(
            preco_unitario ??
            preco ??
            0
        );

        try {
            await run(
                `
                UPDATE produtos
                SET nome = ?,
                    categoria_id = ?,
                    preco_unitario = ?,
                    quantidade_estoque = ?,
                    imagem_url = ?,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND deleted_at IS NULL
                `,
                [
                    nome,
                    categoria_id || null,
                    preco_val,
                    parseInt(quantidade_estoque) || 0,
                    imagem_url || null,
                    req.params.id
                ]
            );

            res.json({
                status: 'ok'
            });

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    // Arquivar produto
    server.delete('/api/produtos/:id', async (req, res) => {
        try {
            const produto = await queryOne(
                `
                SELECT id
                FROM produtos
                WHERE id = ?
                  AND deleted_at IS NULL
                `,
                [req.params.id]
            );

            if (!produto) {
                return res.status(404).json({
                    erro: 'Produto não encontrado.'
                });
            }

            await run(
                `
                UPDATE produtos
                SET deleted_at = CURRENT_TIMESTAMP,
                    status = 0,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
                `,
                [req.params.id]
            );

            res.json({
                status: 'ok',
                mensagem: 'Produto arquivado com sucesso.'
            });

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    // Atualizar estoque
    server.patch('/api/produtos/:id/estoque', async (req, res) => {
        try {
            await run(
                `
                UPDATE produtos
                SET quantidade_estoque = ?,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND deleted_at IS NULL
                `,
                [
                    parseInt(req.body.quantidade) || 0,
                    req.params.id
                ]
            );

            res.json({
                status: 'ok'
            });

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    // Ativar / desativar
    server.patch('/api/produtos/:id/status', async (req, res) => {
        try {
            await run(
                `
                UPDATE produtos
                SET status = ?,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND deleted_at IS NULL
                `,
                [
                    parseInt(req.body.status),
                    req.params.id
                ]
            );

            res.json({
                status: 'ok'
            });

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    // Alias legado
    server.patch('/api/produtos/:id/ativo', async (req, res) => {
        try {
            const s = parseInt(
                req.body.ativo
            );

            await run(
                `
                UPDATE produtos
                SET status = ?,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
                  AND deleted_at IS NULL
                `,
                [
                    s,
                    req.params.id
                ]
            );

            res.json({
                status: 'ok'
            });

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    // ── Categorias ─────────────────────────────
    server.get('/api/categorias', async (req, res) => {
        try {
            const rows = await query(
                "SELECT * FROM categoria_produtos ORDER BY nome"
            );

            res.json(rows);

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    server.post('/api/categorias', async (req, res) => {
        try {
            await run(
                `
                INSERT INTO categoria_produtos (
                    nome,
                    nome_listagem
                )
                VALUES (?, ?)
                `,
                [
                    req.body.nome,
                    req.body.nome
                ]
            );

            res.json({
                status: 'ok'
            });

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    server.put('/api/categorias/:id', async (req, res) => {
        try {
            await run(
                `
                UPDATE categoria_produtos
                SET nome = ?,
                    nome_listagem = ?,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
                `,
                [
                    req.body.nome,
                    req.body.nome,
                    req.params.id
                ]
            );

            res.json({
                status: 'ok'
            });

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    server.delete('/api/categorias/:id', async (req, res) => {
        try {
            await run(
                `
                UPDATE produtos
                SET categoria_id = NULL
                WHERE categoria_id = ?
                `,
                [req.params.id]
            );

            await run(
                `
                DELETE FROM categoria_produtos
                WHERE id = ?
                `,
                [req.params.id]
            );

            res.json({
                status: 'ok'
            });

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    // ──────── DESPESAS ────────
    server.get('/api/despesas', async (req, res) => {
        try {
            const { de, ate } = req.query;

            let sql = `
                SELECT
                    d.*,
                    cd.nome AS categoria_nome
                FROM despesas d
                LEFT JOIN categoria_despesas cd
                    ON d.categoria_id = cd.id
            `;

            const params = [];

            if (de && ate) {
                sql += `
                    WHERE date(
                        d.data_hora,
                        'localtime'
                    ) BETWEEN ? AND ?
                `;

                params.push(
                    de,
                    ate
                );

            } else {
                sql += `
                    WHERE date(
                        d.data_hora,
                        'localtime'
                    ) = date(
                        'now',
                        'localtime'
                    )
                `;
            }

            sql += `
                ORDER BY d.id DESC
            `;

            res.json(
                await query(
                    sql,
                    params
                )
            );

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    server.post('/api/despesas', async (req, res) => {
        const {
            descricao,
            categoria_id,
            valor,
            data
        } = req.body;

        if (!descricao || !valor) {
            return res.status(400).json({
                erro: 'Preencha descrição e valor.'
            });
        }

        try {
            let sql = `
                INSERT INTO despesas (
                    usuario_id,
                    descricao,
                    categoria_id,
                    valor
                )
                VALUES (?, ?, ?, ?)
            `;

            let params = [
                req.session?.userId || null,
                descricao,
                categoria_id || null,
                parseFloat(valor)
            ];

            if (data) {
                sql = `
                    INSERT INTO despesas (
                        usuario_id,
                        descricao,
                        categoria_id,
                        valor,
                        data_hora
                    )
                    VALUES (?, ?, ?, ?, ?)
                `;

                params.push(data);
            }

            const r = await run(
                sql,
                params
            );

            res.json({
                status: 'ok',
                id: r.lastID
            });

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    server.put('/api/despesas/:id', async (req, res) => {
        const {
            descricao,
            categoria_id,
            valor,
            data
        } = req.body;

        try {
            let sql = `
                UPDATE despesas
                SET descricao = ?,
                    categoria_id = ?,
                    valor = ?
                WHERE id = ?
            `;

            let params = [
                descricao,
                categoria_id || null,
                parseFloat(valor),
                req.params.id
            ];

            if (data) {
                sql = `
                    UPDATE despesas
                    SET descricao = ?,
                        categoria_id = ?,
                        valor = ?,
                        data_hora = ?
                    WHERE id = ?
                `;

                params = [
                    descricao,
                    categoria_id || null,
                    parseFloat(valor),
                    data,
                    req.params.id
                ];
            }

            await run(
                sql,
                params
            );

            res.json({
                status: 'ok'
            });

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    server.delete('/api/despesas/:id', async (req, res) => {
        try {
            await run(
                "DELETE FROM despesas WHERE id = ?",
                [req.params.id]
            );

            res.json({
                status: 'ok'
            });

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    // ──────── CATEGORIAS DE DESPESAS ────────
    server.get('/api/categoria-despesas', async (req, res) => {
        try {
            res.json(
                await query(`
                    SELECT *
                    FROM categoria_despesas
                    WHERE status = 1
                    ORDER BY nome
                `)
            );

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    server.post('/api/categoria-despesas', async (req, res) => {
        try {
            await run(
                `
                INSERT INTO categoria_despesas (nome)
                VALUES (?)
                `,
                [req.body.nome]
            );

            res.json({
                status: 'ok'
            });

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    // ──────── CLIENTES ────────
    server.get('/api/clientes', async (req, res) => {
        try {
            const rows = await query(`
                SELECT *
                FROM clientes
                WHERE deleted_at IS NULL
                ORDER BY nome
            `);

            res.json(rows);

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    server.delete('/api/clientes/:id', (req, res) => {
        db.run(
            `
            UPDATE clientes
            SET deleted_at = CURRENT_TIMESTAMP
            WHERE id = ?
            `,
            [req.params.id],
            function (err) {
                if (err) {
                    return res.status(500).json({
                        erro: err.message
                    });
                }

                res.json({
                    status: 'ok'
                });
            }
        );
    });

    server.get('/api/clientes/ausentes', async (req, res) => {
        try {
            const dias =
                parseInt(req.query.dias) || 15;

            const rows = await query(`
                SELECT
                    nome,
                    telefone,
                    ultimo_pedido,
                    total_gasto,
                    qtd_pedidos
                FROM clientes
                WHERE date(ultimo_pedido) <=
                      date(
                          'now',
                          'localtime',
                          '-' || ? || ' days'
                      )
                AND deleted_at IS NULL
            `, [dias]);

            res.json(rows);

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    // ──────── REGIÕES ────────
    server.get('/api/regioes', async (req, res) => {
        try {
            const rows = await query(
                "SELECT * FROM regioes ORDER BY nome"
            );

            res.json(rows);

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    server.post('/api/regioes', async (req, res) => {
        const {
            nome,
            taxa,
            taxa_entrega
        } = req.body;

        const valor = parseFloat(
            taxa_entrega ??
            taxa ??
            0
        );

        try {
            let r;

            try {
                r = await run(
                    `
                    INSERT INTO regioes (
                        nome,
                        taxa_entrega
                    )
                    VALUES (?, ?)
                    `,
                    [
                        nome,
                        valor
                    ]
                );

            } catch (err) {
                if (
                    err.message.includes(
                        'no such column'
                    )
                ) {
                    r = await run(
                        `
                        INSERT INTO regioes (
                            nome,
                            taxa
                        )
                        VALUES (?, ?)
                        `,
                        [
                            nome,
                            valor
                        ]
                    );

                } else {
                    throw err;
                }
            }

            res.json({
                status: 'ok',
                id: r.lastID
            });

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    server.put('/api/regioes/:id', async (req, res) => {
        const {
            nome,
            taxa,
            taxa_entrega
        } = req.body;

        const valor = parseFloat(
            taxa_entrega ??
            taxa ??
            0
        );

        try {
            try {
                await run(
                    `
                    UPDATE regioes
                    SET nome = ?,
                        taxa_entrega = ?
                    WHERE id = ?
                    `,
                    [
                        nome,
                        valor,
                        req.params.id
                    ]
                );

            } catch (err) {
                if (
                    err.message.includes(
                        'no such column'
                    )
                ) {
                    await run(
                        `
                        UPDATE regioes
                        SET nome = ?,
                            taxa = ?
                        WHERE id = ?
                        `,
                        [
                            nome,
                            valor,
                            req.params.id
                        ]
                    );

                } else {
                    throw err;
                }
            }

            res.json({
                status: 'ok'
            });

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    server.delete('/api/regioes/:id', (req, res) => {
        db.run(
            "DELETE FROM regioes WHERE id = ?",
            [req.params.id],
            function (err) {
                if (err) {
                    return res.status(500).json({
                        erro: err.message
                    });
                }

                res.json({
                    status: 'ok'
                });
            }
        );
    });

    // ──────── RELATÓRIOS ────────
    server.get('/api/relatorios', async (req, res) => {
        try {
            const {
                de,
                ate
            } = req.query;

            if (!de || !ate) {
                return res.status(400).json({
                    erro: 'Informe de e ate (YYYY-MM-DD).'
                });
            }

            const statusConcluidos = [
                'Entregue',
                'Retirado',
                'entregue',
                'retirado'
            ];

            const placeholders =
                statusConcluidos
                    .map(() => '?')
                    .join(',');

            const [
                resumo,
                rankCategorias,
                rankProdutos,
                despesas
            ] = await Promise.all([
                queryOne(`
                    SELECT
                        COALESCE(
                            SUM(
                                CASE
                                    WHEN status IN (${placeholders})
                                    THEN total
                                    ELSE 0
                                END
                            ),
                            0
                        ) AS total_entradas,
                        COUNT(
                            CASE
                                WHEN status IN (${placeholders})
                                THEN 1
                            END
                        ) AS pedidos_concluidos,
                        COUNT(*) AS total_pedidos
                    FROM pedidos
                    WHERE date(
                        data_hora,
                        'localtime'
                    ) BETWEEN ? AND ?
                `, [
                    ...statusConcluidos,
                    ...statusConcluidos,
                    de,
                    ate
                ]),

                query(`
                    SELECT
                        cp.nome AS categoria,
                        SUM(ip.quantidade) AS total_vendido
                    FROM itens_pedido ip
                    JOIN produtos pr
                        ON ip.produto_id = pr.id
                    JOIN categoria_produtos cp
                        ON pr.categoria_id = cp.id
                    JOIN pedidos p
                        ON ip.pedido_id = p.id
                    WHERE date(
                        p.data_hora,
                        'localtime'
                    ) BETWEEN ? AND ?
                    AND p.status IN (${placeholders})
                    GROUP BY cp.id
                    ORDER BY total_vendido DESC
                `, [
                    de,
                    ate,
                    ...statusConcluidos
                ]),

                query(`
                    SELECT
                        pr.nome AS produto,
                        SUM(ip.quantidade) AS total_vendido,
                        SUM(
                            ip.quantidade *
                            ip.preco_unitario
                        ) AS receita
                    FROM itens_pedido ip
                    JOIN produtos pr
                        ON ip.produto_id = pr.id
                    JOIN pedidos p
                        ON ip.pedido_id = p.id
                    WHERE date(
                        p.data_hora,
                        'localtime'
                    ) BETWEEN ? AND ?
                    AND p.status IN (${placeholders})
                    GROUP BY pr.id
                    ORDER BY total_vendido DESC
                    LIMIT 10
                `, [
                    de,
                    ate,
                    ...statusConcluidos
                ]),

                queryOne(`
                    SELECT
                        COALESCE(
                            SUM(valor),
                            0
                        ) AS total_despesas
                    FROM despesas
                    WHERE date(
                        data_hora,
                        'localtime'
                    ) BETWEEN ? AND ?
                `, [
                    de,
                    ate
                ])
            ]);

            const total_entradas =
                resumo?.total_entradas || 0;

            const total_saidas =
                despesas?.total_despesas || 0;

            res.json({
                periodo: {
                    de,
                    ate
                },
                total_entradas,
                total_saidas,
                lucro_liquido:
                    total_entradas -
                    total_saidas,
                pedidos_concluidos:
                    resumo?.pedidos_concluidos || 0,
                total_pedidos:
                    resumo?.total_pedidos || 0,
                rank_categorias:
                    rankCategorias,
                rank_produtos:
                    rankProdutos
            });

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    // ──────── HISTÓRICO ────────
    server.get('/api/historico', async (req, res) => {
        try {
            const limite =
                parseInt(req.query.limite) || 200;

            const data =
                req.query.data;

            let sql = `
                SELECT
                    p.*,
                    c.nome AS cliente_nome,
                    c.telefone AS cliente_tel
                FROM pedidos p
                LEFT JOIN clientes c
                    ON p.cliente_id = c.id
            `;

            const params = [];

            if (data) {
                sql += `
                    WHERE date(p.data_hora) = ?
                `;

                params.push(data);
            }

            sql += `
                ORDER BY p.id DESC
                LIMIT ?
            `;

            params.push(limite);

            const rows = await query(
                sql,
                params
            );

            res.json(rows);

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    server.get('/api/pedido/:id', async (req, res) => {
        try {
            const row = await queryOne(`
                SELECT
                    p.*,
                    c.nome AS cliente_nome,
                    c.telefone AS cliente_tel
                FROM pedidos p
                LEFT JOIN clientes c
                    ON p.cliente_id = c.id
                WHERE p.id = ?
            `, [
                req.params.id
            ]);

            if (!row) {
                return res.status(404).json({
                    erro: 'Pedido não encontrado'
                });
            }

            const itens = await query(`
                SELECT
                    i.*,
                    pr.nome AS produto_nome
                FROM itens_pedido i
                LEFT JOIN produtos pr
                    ON i.produto_id = pr.id
                WHERE i.pedido_id = ?
            `, [
                row.id
            ]);

            row.itens = itens;

            res.json(row);

        } catch (e) {
            res.status(500).json({
                erro: e.message
            });
        }
    });

    // ──────── START ────────
    const PORT =
        process.env.PORT || 3000;

    httpServer.listen(
        PORT,
        '0.0.0.0',
        () => {
            console.log("Servidor iniciando...");
            console.log("Banco carregado.");
            console.log("Servidor ouvindo na porta:", PORT);
            console.log(
                `✅ Galeto System V3 rodando na porta ${PORT}`
            );
        }
    );

    return httpServer;
}

module.exports = {
    startServer
};

if (require.main === module) {
    startServer();
}