const { db, queryOne, run } = require('../src/database.js');

async function updateStock() {
    console.log('Iniciando cadastro/atualização de estoque...');
    try {
        const produtos = [
            { nome: 'Galeto com Farofa', preco_unitario: 55.0, qtd: 30, cat: 1, img: '/img/galeto.png' },
            { nome: 'Salpicão', preco_unitario: 25.0, qtd: 20, cat: 2, img: '/img/salpicao.png' },
            { nome: 'Feijão Tropeiro', preco_unitario: 25.0, qtd: 20, cat: 2, img: '/img/feijao.png' }
        ];

        for (const p of produtos) {
            const existing = await queryOne("SELECT id FROM produtos WHERE nome = ?", [p.nome]);
            if (existing) {
                console.log(`Atualizando estoque de ${p.nome} para ${p.qtd}`);
                await run("UPDATE produtos SET quantidade_estoque = ?, preco_unitario = ?, status = 1 WHERE id = ?", [p.qtd, p.preco_unitario, existing.id]);
            } else {
                console.log(`Inserindo ${p.nome} com estoque ${p.qtd}`);
                await run("INSERT INTO produtos (nome, preco_unitario, quantidade_estoque, categoria_id, imagem_url, status) VALUES (?, ?, ?, ?, ?, 1)", [p.nome, p.preco_unitario, p.qtd, p.cat, p.img]);
            }
        }
        
        console.log('Finalizado com sucesso!');
        process.exit(0);
    } catch (err) {
        console.error('Erro:', err);
        process.exit(1);
    }
}

setTimeout(updateStock, 500);
