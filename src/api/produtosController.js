const db = require('../config/db');

// Exemplo de controller para listar produtos garantindo isolamento de Tenant
const listarProdutos = async (req, res) => {
    try {
        // req.tenant foi injetado pelo tenantMiddleware
        const lojaId = req.tenant.id;

        // A query SEMPRE filtra pelo loja_id (Isolamento Multi-Tenant)
        const { rows } = await db.query(
            'SELECT * FROM produtos WHERE loja_id = $1 AND ativo = true ORDER BY nome ASC',
            [lojaId]
        );

        res.json(rows);
    } catch (error) {
        console.error('Erro ao listar produtos:', error);
        res.status(500).json({ error: 'Erro interno ao buscar produtos.' });
    }
};

// Exemplo de controller para criar produto
const criarProduto = async (req, res) => {
    try {
        const lojaId = req.tenant.id;
        const { nome, descricao, preco, categoria_id } = req.body;

        // Inserimos o produto vinculando OBRIGATORIAMENTE à loja do request
        const query = `
            INSERT INTO produtos (loja_id, categoria_id, nome, descricao, preco)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *;
        `;
        const values = [lojaId, categoria_id || null, nome, descricao, preco];

        const { rows } = await db.query(query, values);
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error('Erro ao criar produto:', error);
        res.status(500).json({ error: 'Erro interno ao criar produto.' });
    }
};

module.exports = {
    listarProdutos,
    criarProduto
};
