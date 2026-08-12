const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require('@whiskeysockets/baileys');

const qrcode = require('qrcode-terminal');
const { db } = require('./database');

const userSessions = {};

function normalizarTexto(texto = '') {
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
}

function agruparItens(items = []) {
    const agrupados = {};

    for (const item of items) {
        if (!agrupados[item.id]) {
            agrupados[item.id] = {
                id: item.id,
                nome: item.nome,
                quantidade: 0,
                preco: Number(item.preco) || 0
            };
        }

        agrupados[item.id].quantidade += 1;
    }

    return Object.values(agrupados);
}

function limparSessao(session) {
    session.state = 'IDLE';
    session.order = null;
    session.menuCache = null;
    session.regioesCache = null;
}

async function iniciarBaileys() {
    const { state, saveCreds } =
        await useMultiFileAuthState('./baileys_auth');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        syncFullHistory: false,

        shouldSyncHistoryMessage: (msg) => {
            return msg.syncType !== 2;
        },

        markOnlineOnConnect: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const {
            connection,
            lastDisconnect,
            qr
        } = update;

        if (qr) {
            console.log('\n📱 QR CODE BAILEYS:\n');

            qrcode.generate(qr, {
                small: true
            });
        }

        if (connection === 'open') {
            console.log(
                '✅ Baileys conectado ao WhatsApp!'
            );
        }

        if (connection === 'close') {
            const statusCode =
                lastDisconnect?.error?.output?.statusCode;

            const deveReconectar =
                statusCode !==
                DisconnectReason.loggedOut;

            console.log(
                '❌ Conexão fechada.',
                deveReconectar
                    ? 'Tentando reconectar...'
                    : 'Sessão desconectada.'
            );

            if (deveReconectar) {
                iniciarBaileys();
            }
        }
    });

    sock.ev.on(
        'messages.upsert',
        async ({ type, messages }) => {

            if (type !== 'notify') {
                return;
            }

            for (const msg of messages) {

                if (!msg?.message) {
                    continue;
                }

                if (msg.key.fromMe) {
                    continue;
                }

                const jid =
                    msg.key.remoteJid;

                if (
                    !jid ||
                    jid.endsWith('@g.us') ||
                    jid === 'status@broadcast'
                ) {
                    continue;
                }

                const texto =
                    msg.message.conversation ||
                    msg.message
                        .extendedTextMessage?.text ||
                    '';

                const textoNormalizado =
                    normalizarTexto(texto);

                console.log(
                    '📩 NOVA MENSAGEM:',
                    jid,
                    texto
                );

                if (!userSessions[jid]) {
                    userSessions[jid] = {
                        state: 'IDLE'
                    };
                }

                const session =
                    userSessions[jid];

                // =====================================
                // MENU PRINCIPAL
                // =====================================

                if (
                    [
                        'oi',
                        'ola',
                        'bom dia',
                        'boa tarde',
                        'boa noite',
                        'menu'
                    ].includes(textoNormalizado)
                ) {
                    limparSessao(session);

                    await sock.sendMessage(
                        jid,
                        {
                            text:
                                '🍗 *GARAGEM DO MARCÃO*\n\n' +
                                'Olá! 👋 Como posso te ajudar?\n\n' +
                                '*1* - Fazer um pedido\n' +
                                '*2* - Falar com atendente'
                        }
                    );

                    session.state = 'MENU';

                    continue;
                }

                // =====================================
                // MENU
                // =====================================

                if (session.state === 'MENU') {

                    // -----------------------------
                    // FAZER PEDIDO
                    // -----------------------------

                    if (textoNormalizado === '1') {

                        db.all(
                            `
                            SELECT
                                id,
                                nome,
                                preco_unitario,
                                quantidade_estoque
                            FROM produtos
                            WHERE deleted_at IS NULL
                              AND status = 1
                            ORDER BY categoria_id, nome
                            `,
                            [],
                            async (err, produtos) => {

                                if (err) {
                                    console.error(
                                        'Erro ao carregar cardápio:',
                                        err
                                    );

                                    await sock.sendMessage(
                                        jid,
                                        {
                                            text:
                                                '❌ Não consegui carregar o cardápio agora.'
                                        }
                                    );

                                    return;
                                }

                                if (
                                    !produtos ||
                                    produtos.length === 0
                                ) {
                                    await sock.sendMessage(
                                        jid,
                                        {
                                            text:
                                                'No momento não temos produtos disponíveis.'
                                        }
                                    );

                                    return;
                                }

                                session.menuCache = {};

                                session.order = {
                                    items: [],
                                    totalProdutos: 0,
                                    total: 0,

                                    deliveryType: '',
                                    region: '',
                                    address: '',
                                    freight: 0,

                                    payment: '',
                                    changeFor: '',

                                    customerName: '',
                                    customerPhone: ''
                                };

                                let cardapio =
                                    '🍗 *NOSSO CARDÁPIO*\n\n';

                                produtos.forEach(
                                    (produto, index) => {

                                        const numero =
                                            String(index + 1);

                                        const estoque =
                                            Number(
                                                produto
                                                    .quantidade_estoque
                                            ) || 0;

                                        const preco =
                                            Number(
                                                produto
                                                    .preco_unitario
                                            ) || 0;

                                        session.menuCache[
                                            numero
                                        ] = {
                                            id: produto.id,
                                            nome: produto.nome,
                                            preco,
                                            estoque
                                        };

                                        cardapio +=
                                            `*${numero}* - ` +
                                            `${produto.nome}` +
                                            ` — R$ ${preco.toFixed(2)}`;

                                        if (estoque <= 0) {
                                            cardapio +=
                                                '\n🚫 ESGOTADO';

                                        } else if (
                                            estoque === 1
                                        ) {
                                            cardapio +=
                                                '\n🔥 Última unidade';

                                        } else if (
                                            estoque <= 5
                                        ) {
                                            cardapio +=
                                                `\n🔥 Últimas ${estoque} unidades`;
                                        }

                                        cardapio += '\n\n';
                                    }
                                );

                                cardapio +=
                                    'Digite o *número do produto* que deseja pedir.\n' +
                                    'Ou digite *Menu* para voltar.';

                                await sock.sendMessage(
                                    jid,
                                    {
                                        text: cardapio
                                    }
                                );

                                session.state =
                                    'ORDER_ITEMS';
                            }
                        );

                        continue;
                    }

                    // -----------------------------
                    // ATENDENTE
                    // -----------------------------

                    if (textoNormalizado === '2') {
                        await sock.sendMessage(
                            jid,
                            {
                                text:
                                    '👤 Certo! O atendimento ficará com uma pessoa da equipe.\n\n' +
                                    'Para voltar ao robô, digite *Menu*.'
                            }
                        );

                        session.state = 'HUMAN';

                        continue;
                    }

                    await sock.sendMessage(
                        jid,
                        {
                            text:
                                'Opção inválida. Digite *1* ou *2*.'
                        }
                    );

                    continue;
                }

                // =====================================
                // ATENDIMENTO HUMANO
                // =====================================

                if (session.state === 'HUMAN') {
                    continue;
                }

                // =====================================
                // PRIMEIRO ITEM
                // =====================================

                if (
                    session.state ===
                    'ORDER_ITEMS'
                ) {
                    const item =
                        session.menuCache?.[
                            textoNormalizado
                        ];

                    if (!item) {
                        await sock.sendMessage(
                            jid,
                            {
                                text:
                                    '❌ Não encontrei esse produto.\n\n' +
                                    'Digite o número de um produto do cardápio.'
                            }
                        );

                        continue;
                    }

                    if (item.estoque <= 0) {
                        await sock.sendMessage(
                            jid,
                            {
                                text:
                                    `🚫 *${item.nome}* está esgotado no momento.`
                            }
                        );

                        continue;
                    }

                    const quantidadeNoCarrinho =
                        session.order.items.filter(
                            produto =>
                                produto.id === item.id
                        ).length;

                    if (
                        quantidadeNoCarrinho >=
                        item.estoque
                    ) {
                        await sock.sendMessage(
                            jid,
                            {
                                text:
                                    `⚠️ Só temos ${item.estoque} unidade(s) disponível(is) de *${item.nome}*.`
                            }
                        );

                        continue;
                    }

                    session.order.items.push({
                        id: item.id,
                        nome: item.nome,
                        preco: item.preco
                    });

                    session.order.totalProdutos +=
                        item.preco;

                    session.order.total =
                        session.order.totalProdutos;

                    const quantidadeAtual =
                        session.order.items.filter(
                            produto =>
                                produto.id === item.id
                        ).length;

                    await sock.sendMessage(
                        jid,
                        {
                            text:
                                `✅ *${item.nome}* adicionado ao pedido.\n\n` +
                                `Quantidade no carrinho: ${quantidadeAtual}\n` +
                                `Total parcial: *R$ ${session.order.totalProdutos.toFixed(2)}*\n\n` +
                                'Digite outro número para adicionar mais itens.\n' +
                                'Ou digite *OK* para continuar.'
                        }
                    );

                    session.state =
                        'ORDER_CONFIRM_ITEMS';

                    continue;
                }

                // =====================================
                // MAIS ITENS / FINALIZAR CARRINHO
                // =====================================

                if (
                    session.state ===
                    'ORDER_CONFIRM_ITEMS'
                ) {

                    if (
                        [
                            'ok',
                            'pronto',
                            'finalizar'
                        ].includes(textoNormalizado)
                    ) {
                        await sock.sendMessage(
                            jid,
                            {
                                text:
                                    '🛵 *TIPO DE PEDIDO*\n\n' +
                                    'Como você deseja receber?\n\n' +
                                    '*1* - Entrega\n' +
                                    '*2* - Retirar no local'
                            }
                        );

                        session.state =
                            'ORDER_DELIVERY_TYPE';

                        continue;
                    }

                    const item =
                        session.menuCache?.[
                            textoNormalizado
                        ];

                    if (!item) {
                        await sock.sendMessage(
                            jid,
                            {
                                text:
                                    'Digite o número de outro produto ou *OK* para continuar.'
                            }
                        );

                        continue;
                    }

                    if (item.estoque <= 0) {
                        await sock.sendMessage(
                            jid,
                            {
                                text:
                                    `🚫 *${item.nome}* está esgotado no momento.`
                            }
                        );

                        continue;
                    }

                    const quantidadeNoCarrinho =
                        session.order.items.filter(
                            produto =>
                                produto.id === item.id
                        ).length;

                    if (
                        quantidadeNoCarrinho >=
                        item.estoque
                    ) {
                        await sock.sendMessage(
                            jid,
                            {
                                text:
                                    `⚠️ Você já adicionou toda a quantidade disponível de *${item.nome}*.\n` +
                                    `Disponível: ${item.estoque}.`
                            }
                        );

                        continue;
                    }

                    session.order.items.push({
                        id: item.id,
                        nome: item.nome,
                        preco: item.preco
                    });

                    session.order.totalProdutos +=
                        item.preco;

                    session.order.total =
                        session.order.totalProdutos;

                    const quantidadeAtual =
                        session.order.items.filter(
                            produto =>
                                produto.id === item.id
                        ).length;

                    await sock.sendMessage(
                        jid,
                        {
                            text:
                                `✅ *${item.nome}* adicionado novamente.\n\n` +
                                `Quantidade no carrinho: ${quantidadeAtual}\n` +
                                `Total parcial: *R$ ${session.order.totalProdutos.toFixed(2)}*\n\n` +
                                'Digite outro número ou *OK* para continuar.'
                        }
                    );

                    continue;
                }

                // =====================================
                // ENTREGA OU RETIRADA
                // =====================================

                if (
                    session.state ===
                    'ORDER_DELIVERY_TYPE'
                ) {

                    // -----------------------------
                    // ENTREGA
                    // -----------------------------

                    if (textoNormalizado === '1') {
                        session.order.deliveryType =
                            'Entrega';

                        session.order.freight = 0;

                        session.order.total =
                            session.order.totalProdutos;

                        await sock.sendMessage(
                            jid,
                            {
                                text:
                                    '🗺️ *REGIÃO DE ENTREGA*\n\n' +
                                    'Qual é o seu bairro/região?\n\n' +
                                    'Digite o nome do bairro onde será realizada a entrega.'
                            }
                        );

                        session.state =
                            'ORDER_REGION';

                        continue;
                    }

                    // -----------------------------
                    // RETIRADA
                    // -----------------------------

                    if (textoNormalizado === '2') {
                        session.order.deliveryType =
                            'Retirada';

                        session.order.region = '';

                        session.order.address =
                            'Retirada no Local';

                        session.order.freight = 0;

                        session.order.total =
                            session.order.totalProdutos;

                        await sock.sendMessage(
                            jid,
                            {
                                text:
                                    '📍 *RETIRADA NO LOCAL*\n\n' +
                                    'Perfeito! Seu pedido será para retirada no local.\n\n' +
                                    `Total: *R$ ${session.order.total.toFixed(2)}*\n\n` +
                                    'Agora vamos escolher a forma de pagamento.'
                            }
                        );

                        session.state =
                            'ORDER_PAYMENT';

                        continue;
                    }

                    await sock.sendMessage(
                        jid,
                        {
                            text:
                                'Opção inválida.\n\n' +
                                '*1* - Entrega\n' +
                                '*2* - Retirar no local'
                        }
                    );

                    continue;
                }

                // =====================================
                // REGIÃO
                // =====================================

                if (
                    session.state ===
                    'ORDER_REGION'
                ) {
                    db.all(
                        `
                        SELECT
                            id,
                            nome,
                            taxa_entrega
                        FROM regioes
                        ORDER BY nome
                        `,
                        [],
                        async (err, regioes) => {

                            if (err) {
                                console.error(
                                    'Erro ao consultar região:',
                                    err
                                );

                                await sock.sendMessage(
                                    jid,
                                    {
                                        text:
                                            '❌ Ocorreu um erro ao consultar as regiões de entrega.'
                                    }
                                );

                                return;
                            }

                            const digitado =
                                normalizarTexto(texto);

                            let encontrada =
                                regioes.find(
                                    regiao =>
                                        normalizarTexto(
                                            regiao.nome
                                        ) === digitado
                                );

                            if (!encontrada) {
                                const parecidas =
                                    regioes.filter(
                                        regiao => {
                                            const nome =
                                                normalizarTexto(
                                                    regiao.nome
                                                );

                                            return (
                                                nome.includes(
                                                    digitado
                                                ) ||
                                                digitado.includes(
                                                    nome
                                                )
                                            );
                                        }
                                    );

                                if (
                                    parecidas.length === 1
                                ) {
                                    encontrada =
                                        parecidas[0];
                                }

                                if (
                                    parecidas.length > 1
                                ) {
                                    let resposta =
                                        '🤔 Encontrei mais de uma região parecida:\n\n';

                                    for (
                                        const regiao
                                        of parecidas
                                    ) {
                                        resposta +=
                                            `• ${regiao.nome}\n`;
                                    }

                                    resposta +=
                                        '\nDigite o nome completo da sua região.';

                                    await sock.sendMessage(
                                        jid,
                                        {
                                            text: resposta
                                        }
                                    );

                                    return;
                                }
                            }

                            if (!encontrada) {
                                await sock.sendMessage(
                                    jid,
                                    {
                                        text:
                                            '❌ Não encontrei essa região entre nossas áreas de entrega.\n\n' +
                                            'Confira o nome do bairro e tente novamente.'
                                    }
                                );

                                return;
                            }

                            const taxa =
                                Number(
                                    encontrada
                                        .taxa_entrega
                                ) || 0;

                            session.order.region =
                                encontrada.nome;

                            session.order.freight =
                                taxa;

                            // Recalcula em vez de simplesmente
                            // somar, evitando frete duplicado.
                            session.order.total =
                                session.order
                                    .totalProdutos +
                                taxa;

                            await sock.sendMessage(
                                jid,
                                {
                                    text:
                                        `✅ Região encontrada: *${encontrada.nome}*\n` +
                                        `🛵 Taxa de entrega: *R$ ${taxa.toFixed(2)}*\n\n` +
                                        `Total com entrega: *R$ ${session.order.total.toFixed(2)}*\n\n` +
                                        '📍 Agora informe seu endereço completo:\n' +
                                        'Rua, número e referência.'
                                }
                            );

                            session.state =
                                'ORDER_ADDRESS';
                        }
                    );

                    continue;
                }

                // =====================================
                // ENDEREÇO
                // =====================================

                if (
                    session.state ===
                    'ORDER_ADDRESS'
                ) {
                    const endereco =
                        texto.trim();

                    if (endereco.length < 5) {
                        await sock.sendMessage(
                            jid,
                            {
                                text:
                                    '⚠️ Informe um endereço mais completo, com rua e número.'
                            }
                        );

                        continue;
                    }

                    session.order.address =
                        endereco;

                    await sock.sendMessage(
                        jid,
                        {
                            text:
                                '💳 *FORMA DE PAGAMENTO*\n\n' +
                                `Total do pedido: *R$ ${session.order.total.toFixed(2)}*\n\n` +
                                '*1* - Pix\n' +
                                '*2* - Cartão\n' +
                                '*3* - Dinheiro'
                        }
                    );

                    session.state =
                        'ORDER_PAYMENT';

                    continue;
                }
                                // =====================================
                // PAGAMENTO
                // =====================================

                if (
                    session.state ===
                    'ORDER_PAYMENT'
                ) {
                    const opcoesPagamento = {
                        '1': 'Pix',
                        '2': 'Cartão',
                        '3': 'Dinheiro'
                    };

                    const pagamentoEscolhido =
                        opcoesPagamento[
                            textoNormalizado
                        ];

                    if (!pagamentoEscolhido) {
                        await sock.sendMessage(
                            jid,
                            {
                                text:
                                    'Opção inválida.\n\n' +
                                    '*1* - Pix\n' +
                                    '*2* - Cartão\n' +
                                    '*3* - Dinheiro'
                            }
                        );

                        continue;
                    }

                    session.order.payment =
                        pagamentoEscolhido;

                    if (
                        pagamentoEscolhido ===
                        'Dinheiro'
                    ) {
                        await sock.sendMessage(
                            jid,
                            {
                                text:
                                    '💵 *TROCO*\n\n' +
                                    'Precisa de troco para quanto?\n\n' +
                                    'Digite o valor, por exemplo *100*, ou digite *Não*.'
                            }
                        );

                        session.state =
                            'ORDER_CHANGE';

                        continue;
                    }

                    const itensAgrupados =
                        agruparItens(
                            session.order.items
                        );

                    let resumo =
                        '🧾 *RESUMO DO PEDIDO*\n\n';

                    for (
                        const item
                        of itensAgrupados
                    ) {
                        resumo +=
                            `• ${item.quantidade}x ${item.nome}` +
                            ` — R$ ${(item.quantidade * item.preco).toFixed(2)}\n`;
                    }

                    resumo +=
                        `\n🛵 Tipo: *${session.order.deliveryType}*\n`;

                    if (
                        session.order
                            .deliveryType ===
                        'Entrega'
                    ) {
                        resumo +=
                            `📍 Região: *${session.order.region}*\n` +
                            `🏠 Endereço: *${session.order.address}*\n` +
                            `🚚 Taxa: *R$ ${session.order.freight.toFixed(2)}*\n`;
                    }

                    resumo +=
                        `💳 Pagamento: *${session.order.payment}*\n\n` +
                        `💰 Total: *R$ ${session.order.total.toFixed(2)}*\n\n` +
                        'Digite *CONFIRMAR* para concluir.\n' +
                        'Ou digite *Menu* para cancelar.';

                    await sock.sendMessage(
                        jid,
                        {
                            text: resumo
                        }
                    );

                    session.state =
                        'ORDER_CONFIRM';

                    continue;
                }

                // =====================================
                // TROCO
                // =====================================

                if (
                    session.state ===
                    'ORDER_CHANGE'
                ) {
                    session.order.changeFor =
                        texto.trim();

                    const itensAgrupados =
                        agruparItens(
                            session.order.items
                        );

                    let resumo =
                        '🧾 *RESUMO DO PEDIDO*\n\n';

                    for (
                        const item
                        of itensAgrupados
                    ) {
                        resumo +=
                            `• ${item.quantidade}x ${item.nome}` +
                            ` — R$ ${(item.quantidade * item.preco).toFixed(2)}\n`;
                    }

                    resumo +=
                        `\n🛵 Tipo: *${session.order.deliveryType}*\n`;

                    if (
                        session.order
                            .deliveryType ===
                        'Entrega'
                    ) {
                        resumo +=
                            `📍 Região: *${session.order.region}*\n` +
                            `🏠 Endereço: *${session.order.address}*\n` +
                            `🚚 Taxa: *R$ ${session.order.freight.toFixed(2)}*\n`;
                    }

                    resumo +=
                        `💳 Pagamento: *Dinheiro*\n`;

                    if (
                        normalizarTexto(
                            session.order.changeFor
                        ) !== 'nao'
                    ) {
                        resumo +=
                            `💵 Troco para: *R$ ${session.order.changeFor}*\n`;
                    } else {
                        resumo +=
                            '💵 Troco: *Não precisa*\n';
                    }

                    resumo +=
                        `\n💰 Total: *R$ ${session.order.total.toFixed(2)}*\n\n` +
                        'Digite *CONFIRMAR* para concluir.\n' +
                        'Ou digite *Menu* para cancelar.';

                    await sock.sendMessage(
                        jid,
                        {
                            text: resumo
                        }
                    );

                    session.state =
                        'ORDER_CONFIRM';

                    continue;
                }

                // =====================================
                // CONFIRMAÇÃO FINAL
                // =====================================

                if (
                    session.state ===
                    'ORDER_CONFIRM'
                ) {
                    if (
                        textoNormalizado !==
                        'confirmar'
                    ) {
                        await sock.sendMessage(
                            jid,
                            {
                                text:
                                    'Digite *CONFIRMAR* para concluir o pedido ou *Menu* para cancelar.'
                            }
                        );

                        continue;
                    }

                    const itensAgrupados =
                        agruparItens(
                            session.order.items
                        );

                    const telefoneAlternativo =
                        msg.key.remoteJidAlt;

                    let telefone =
                        '';

                    if (
                        telefoneAlternativo &&
                        telefoneAlternativo.includes(
                            '@s.whatsapp.net'
                        )
                    ) {
                        telefone =
                            telefoneAlternativo
                                .split('@')[0]
                                .split(':')[0];
                    } else if (
                        jid.includes(
                            '@s.whatsapp.net'
                        )
                    ) {
                        telefone =
                            jid
                                .split('@')[0]
                                .split(':')[0];
                    }

                    session.order.customerPhone =
                        telefone;

                    if (!telefone) {
                        await sock.sendMessage(
                            jid,
                            {
                                text:
                                    '📱 Antes de concluir, preciso do seu número de WhatsApp com DDD.\n\n' +
                                    'Exemplo: *27999999999*.'
                            }
                        );

                        session.state =
                            'ORDER_PHONE';

                        continue;
                    }

                    await finalizarPedidoBaileys(
                        sock,
                        jid,
                        session,
                        telefone
                    );

                    continue;
                }

                // =====================================
                // TELEFONE MANUAL
                // =====================================

                if (
                    session.state ===
                    'ORDER_PHONE'
                ) {
                    const telefone =
                        texto.replace(
                            /\D/g,
                            ''
                        );

                    if (
                        telefone.length < 10 ||
                        telefone.length > 13
                    ) {
                        await sock.sendMessage(
                            jid,
                            {
                                text:
                                    '⚠️ Número inválido.\n\n' +
                                    'Digite apenas o número com DDD.\n' +
                                    'Exemplo: *27999999999*.'
                            }
                        );

                        continue;
                    }

                    session.order.customerPhone =
                        telefone;

                    await finalizarPedidoBaileys(
                        sock,
                        jid,
                        session,
                        telefone
                    );

                    continue;
                }
            }
        }
    );
}

async function finalizarPedidoBaileys(
    sock,
    jid,
    session,
    telefone
) {
    const itensAgrupados =
        agruparItens(
            session.order.items
        );

    let pagamento =
        session.order.payment;

    if (
        pagamento === 'Dinheiro' &&
        session.order.changeFor &&
        normalizarTexto(
            session.order.changeFor
        ) !== 'nao'
    ) {
        pagamento =
            `Dinheiro (Troco para R$ ${session.order.changeFor})`;
    }

    const endereco =
        session.order.deliveryType ===
        'Entrega'
            ? session.order.address
            : 'Retirada no Local';

    const pedidoDescricao =
        itensAgrupados
            .map(
                item =>
                    `${item.quantidade}x ${item.nome}`
            )
            .join(', ');

    const itensPayload =
        itensAgrupados.map(
            item => ({
                id: item.id,
                nome: item.nome,
                quantidade:
                    item.quantidade,
                preco:
                    item.preco
            })
        );

    const payload = {
        nome:
            session.order.customerName ||
            'Cliente WhatsApp',

        telefone,

        pedido:
            pedidoDescricao,

        itens:
            JSON.stringify(
                itensPayload
            ),

        taxa:
            session.order.freight || 0,

        total:
            session.order.total,

        pagamento,

        endereco,

        origem:
            'WhatsApp (Baileys)'
    };

    try {
        const response =
            await fetch(
                'http://localhost:3000/api/novo-pedido',
                {
                    method: 'POST',

                    headers: {
                        'Content-Type':
                            'application/json'
                    },

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );

        let data = {};

        try {
            data =
                await response.json();
        } catch (e) {
            data = {};
        }

        if (!response.ok) {
            await sock.sendMessage(
                jid,
                {
                    text:
                        '❌ *Não foi possível concluir o pedido.*\n\n' +
                        `${data.erro || 'Verifique os itens e tente novamente.'}`
                }
            );

            return;
        }

        const idPedido =
            data.id_pedido ||
            data.id ||
            '';

        let mensagem =
            '🎉 *PEDIDO CONFIRMADO!*\n\n';

        if (idPedido) {
            mensagem +=
                `Pedido *#${idPedido}* registrado com sucesso.\n\n`;
        }

        mensagem +=
            `💰 Total: *R$ ${session.order.total.toFixed(2)}*\n\n`;

        if (
            session.order
                .deliveryType ===
            'Entrega'
        ) {
            mensagem +=
                '🛵 Seu pedido foi enviado para a equipe e você receberá atualizações pelo WhatsApp.';
        } else {
            mensagem +=
                '📍 Seu pedido foi enviado para a equipe. Avisaremos quando estiver pronto para retirada.';
        }

        await sock.sendMessage(
            jid,
            {
                text: mensagem
            }
        );

        limparSessao(
            session
        );

    } catch (err) {
        console.error(
            '❌ Erro ao registrar pedido pelo Baileys:',
            err
        );

        await sock.sendMessage(
            jid,
            {
                text:
                    '❌ Não consegui registrar o pedido no sistema agora.\n\n' +
                    'Seu pedido não foi confirmado. Tente novamente em alguns instantes.'
            }
        );
    }
}

iniciarBaileys().catch(
    (err) => {
        console.error(
            'Erro ao iniciar Baileys:',
            err
        );
    }
);
