const db = require('../config/db');

/**
 * Middleware para identificar a loja (Tenant) pelo slug.
 * O slug pode vir do header, da URL (params) ou de uma query string.
 * Ex: X-Tenant-Slug: 'garagem-do-galeto'
 */
const tenantMiddleware = async (req, res, next) => {
    try {
        // Tentamos pegar o slug de 3 lugares, nessa ordem: Headers, Params e Query.
        const slug = req.headers['x-tenant-slug'] || req.params.lojaSlug || req.query.lojaSlug;

        if (!slug) {
            return res.status(400).json({ 
                error: 'Slug da loja não informado. Envie o cabeçalho X-Tenant-Slug.' 
            });
        }

        // Buscamos a loja no banco
        const { rows } = await db.query('SELECT * FROM lojas WHERE slug = $1 LIMIT 1', [slug]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Loja não encontrada' });
        }

        // Armazena os dados da loja no request para os próximos controllers
        req.tenant = rows[0];

        next();
    } catch (error) {
        console.error('Erro no Tenant Middleware:', error);
        res.status(500).json({ error: 'Erro interno ao validar o Tenant' });
    }
};

module.exports = tenantMiddleware;
