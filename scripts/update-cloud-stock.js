const http = require('http');
const https = require('https');

const APP_URL = process.env.APP_URL || 'https://www.garagemdomarcao.online';
const API_URL = `${APP_URL.replace(/\/$/, '')}/api`;

const USER = process.env.ADMIN_USER;
const PASS = process.env.ADMIN_PASSWORD;

if (!USER || !PASS) {
    console.error('❌ ADMIN_USER e ADMIN_PASSWORD precisam estar configurados no ambiente.');
    process.exit(1);
}

const produtosDesejados = [
    {
        nome: 'Galeto com Farofa',
        preco_unitario: 55.0,
        quantidade_estoque: 30,
        categoria_id: 1,
        imagem_url: '/img/galeto.png'
    },
    {
        nome: 'Salpicão',
        preco_unitario: 25.0,
        quantidade_estoque: 20,
        categoria_id: 2,
        imagem_url: '/img/salpicao.png'
    },
    {
        nome: 'Feijão Tropeiro',
        preco_unitario: 25.0,
        quantidade_estoque: 20,
        categoria_id: 2,
        imagem_url: '/img/feijao.png'
    }
];

async function request(url, options, body = null) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;

        const req = client.request(url, options, (res) => {
            let data = '';

            res.on('data', chunk => data += chunk);

            res.on('end', () => {
                const response = {
                    status: res.statusCode,
                    headers: res.headers,
                    data: null
                };

                try {
                    response.data = data ? JSON.parse(data) : {};
                } catch (e) {
                    response.data = data;
                }

                resolve(response);
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

async function syncStock() {
    console.log('🔄 Iniciando sincronização de estoque com o servidor...');

    console.log('🔑 Autenticando...');

    const loginRes = await request(`${API_URL}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    }, {
        usuario: USER,
        senha: PASS
    });

    if (loginRes.status !== 200) {
        console.error('❌ Falha na autenticação. Verifique as credenciais configuradas.');
        process.exit(1);
    }

    const cookie = loginRes.headers['set-cookie']
        ? loginRes.headers['set-cookie'][0].split(';')[0]
        : '';

    const authHeaders = {
        'Content-Type': 'application/json',
        'Cookie': cookie
    };

    console.log('📦 Buscando produtos no servidor...');

    const getRes = await request(`${API_URL}/produtos`, {
        method: 'GET',
        headers: authHeaders
    });

    const produtosServidor = getRes.data;

    for (const prod of produtosDesejados) {
        const existente = produtosServidor.find(p => p.nome === prod.nome);

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

    console.log('✅ Estoque atualizado no servidor com sucesso!');
}

syncStock();