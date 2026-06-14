const http = require('http');
const https = require('https');

const API_URL = 'https://www.garagemdomarcao.online/api';
// Tente usar as credenciais padrão se não for especificado no arquivo .env
const USER = 'admin';
const PASS = 'admin123';

const produtosDesejados = [
    { nome: 'Galeto com Farofa', preco_unitario: 55.0, quantidade_estoque: 30, categoria_id: 1, imagem_url: '/img/galeto.png' },
    { nome: 'Salpicão', preco_unitario: 25.0, quantidade_estoque: 20, categoria_id: 2, imagem_url: '/img/salpicao.png' },
    { nome: 'Feijão Tropeiro', preco_unitario: 25.0, quantidade_estoque: 20, categoria_id: 2, imagem_url: '/img/feijao.png' }
];

async function request(url, options, body = null) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const response = { status: res.statusCode, headers: res.headers, data: null };
                try {
                    response.data = data ? JSON.parse(data) : {};
                } catch (e) {
                    response.data = data;
                }
                resolve(response);
            });
        });
        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function syncStock() {
    console.log('🔄 Iniciando sincronização de estoque com a Nuvem (Railway)...');
    
    // 1. Fazer Login para pegar o cookie de sessão
    console.log('🔑 Autenticando...');
    const loginRes = await request(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, { usuario: USER, senha: PASS });

    if (loginRes.status !== 200) {
        console.error('❌ Falha na autenticação. Verifique se a senha do admin na nuvem é diferente de "admin123".');
        process.exit(1);
    }

    const cookie = loginRes.headers['set-cookie'] ? loginRes.headers['set-cookie'][0].split(';')[0] : '';
    const authHeaders = { 'Content-Type': 'application/json', 'Cookie': cookie };

    // 2. Obter lista de produtos atuais
    console.log('📦 Buscando produtos na nuvem...');
    const getRes = await request(`${API_URL}/produtos`, { method: 'GET', headers: authHeaders });
    const produtosNuvem = getRes.data;

    // 3. Atualizar ou Criar produtos
    for (const prod of produtosDesejados) {
        const existente = produtosNuvem.find(p => p.nome === prod.nome);
        
        if (existente) {
            console.log(`Atualizando estoque de "${prod.nome}" para ${prod.quantidade_estoque}...`);
            await request(`${API_URL}/produtos/${existente.id}`, {
                method: 'PUT',
                headers: authHeaders
            }, {
                ...existente,
                quantidade_estoque: prod.quantidade_estoque,
                preco_unitario: prod.preco_unitario
            });
        } else {
            console.log(`Criando novo produto "${prod.nome}"...`);
            await request(`${API_URL}/produtos`, {
                method: 'POST',
                headers: authHeaders
            }, prod);
        }
    }

    console.log('✅ Estoque atualizado na nuvem com sucesso!');
}

syncStock();
