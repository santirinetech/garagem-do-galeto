-- Habilita a extensão para geração de UUIDs (opcional, mas recomendado para IDs)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabela de Lojas (Tenants)
CREATE TABLE lojas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(255) UNIQUE NOT NULL, -- Ex: 'garagem-do-galeto', 'tabacaria-vip'
    nome VARCHAR(255) NOT NULL,
    logo_url TEXT,
    cor_primaria VARCHAR(50) DEFAULT '#000000',
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabela de Categorias
CREATE TABLE categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    ordem INTEGER DEFAULT 0,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabela de Produtos
CREATE TABLE produtos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
    categoria_id UUID REFERENCES categorias(id) ON DELETE SET NULL,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    preco DECIMAL(10, 2) NOT NULL,
    imagem_url TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabela de Pedidos
CREATE TABLE pedidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE,
    cliente_nome VARCHAR(255) NOT NULL,
    cliente_telefone VARCHAR(50) NOT NULL,
    endereco_entrega TEXT,
    status VARCHAR(50) DEFAULT 'pendente', -- Ex: pendente, preparo, saiu_entrega, concluido, cancelado
    total DECIMAL(10, 2) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabela de Itens do Pedido
CREATE TABLE itens_pedido (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loja_id UUID NOT NULL REFERENCES lojas(id) ON DELETE CASCADE, -- Isolamento do tenant aqui também
    pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
    quantidade INTEGER NOT NULL,
    preco_unitario DECIMAL(10, 2) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- ÍNDICES PARA PERFORMANCE (Multi-tenant)
-- ==========================================
-- Como todas as consultas terão "WHERE loja_id = X", esses índices são cruciais.
CREATE INDEX idx_categorias_loja_id ON categorias(loja_id);
CREATE INDEX idx_produtos_loja_id ON produtos(loja_id);
CREATE INDEX idx_pedidos_loja_id ON pedidos(loja_id);
CREATE INDEX idx_itens_pedido_loja_id ON itens_pedido(loja_id);
