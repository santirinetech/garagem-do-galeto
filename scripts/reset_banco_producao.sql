-- SCRIPT DE RESET PARA PRODUÇÃO (GARAGEM DO GALETO)
-- ⚠️ CUIDADO: Este script apaga permanentemente todos os dados de vendas e clientes.

BEGIN TRANSACTION;

-- 1. Remover transações (Financeiro e Entregas)
DELETE FROM itens_pedido;
DELETE FROM pedidos;
DELETE FROM despesas;

-- 2. Remover Cadastros Relacionais Base (Clientes e Endereços de Teste)
DELETE FROM enderecos;
DELETE FROM clientes;

-- 3. Resetar os IDs (AutoIncrement) para voltar ao número 1
DELETE FROM sqlite_sequence WHERE name IN ('pedidos', 'itens_pedido', 'despesas', 'enderecos', 'clientes');

-- (Opcional) Limpar configurações e recriar, ou deixar intactas.
-- As linhas abaixo NÃO removem Usuários, Produtos, Regiões e Categorias.

COMMIT;

-- VACUUM limpa o espaço não utilizado em disco para otimizar o arquivo do banco
VACUUM;
