const { Pool } = require('pg');
require('dotenv').config();

// Configuração da conexão com o PostgreSQL
const pool = new Pool({
    user: process.env.PG_USER || 'postgres',
    host: process.env.PG_HOST || 'localhost',
    database: process.env.PG_DATABASE || 'saas_db',
    password: process.env.PG_PASSWORD || 'sua_senha',
    port: process.env.PG_PORT || 5432,
});

pool.on('error', (err, client) => {
    console.error('Erro inesperado no cliente do banco de dados', err);
    process.exit(-1);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    getPool: () => pool
};
