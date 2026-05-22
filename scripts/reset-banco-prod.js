const path = require('path');
const { db } = require('../src/database'); // Importa a configuração atual do banco
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log("=================================================");
console.log("⚠️ AVISO DE PREPARAÇÃO PARA PRODUÇÃO ⚠️");
console.log("Este script vai APAGAR TODOS os dados de testes:");
console.log("- Pedidos e Itens de Pedido");
console.log("- Despesas (todas)");
console.log("- Clientes e Endereços");
console.log("");
console.log("Serão MANTIDOS os cadastros base:");
console.log("- Usuários e Configurações");
console.log("- Produtos e Categorias");
console.log("- Regiões (Bairros)");
console.log("=================================================\n");

rl.question("Tem certeza que deseja limpar o banco para iniciar em produção? (s/n): ", (resposta) => {
    if (resposta.toLowerCase() !== 's') {
        console.log("Cancelado. Nenhuma alteração foi feita.");
        process.exit(0);
    }

    console.log("Iniciando limpeza...");

    db.serialize(() => {
        db.run("BEGIN TRANSACTION;");

        // Tabelas de transações
        db.run("DELETE FROM itens_pedido;");
        db.run("DELETE FROM pedidos;");
        db.run("DELETE FROM despesas;");
        
        // Tabelas de clientes
        db.run("DELETE FROM enderecos;");
        db.run("DELETE FROM clientes;");

        // Opcional: Resetar sequências AUTOINCREMENT
        db.run("DELETE FROM sqlite_sequence WHERE name IN ('pedidos', 'itens_pedido', 'despesas', 'enderecos', 'clientes');");

        db.run("COMMIT;", (err) => {
            if (err) {
                console.error("Erro ao resetar o banco:", err);
            } else {
                console.log("✅ Banco de dados limpo com sucesso!");
                console.log("O sistema está pronto para produção.");
            }
            process.exit(0);
        });
    });
});
