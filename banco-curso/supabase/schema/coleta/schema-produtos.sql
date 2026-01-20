-- Schema do Supabase para Tabela de Produtos
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: produtos
-- Armazena produtos coletados da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS produtos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    produto_id TEXT NOT NULL, -- ID do produto na API Conta Azul (campo 'id' do JSON)
    codigo TEXT, -- Código do produto
    nome TEXT NOT NULL, -- Nome do produto
    ean TEXT, -- EAN do produto
    sku TEXT, -- SKU do produto
    status TEXT, -- Status do produto (ATIVO, INATIVO)
    tipo TEXT, -- Tipo do produto
    custo_medio NUMERIC, -- Custo médio do produto
    estoque_minimo NUMERIC, -- Estoque mínimo
    estoque_maximo NUMERIC, -- Estoque máximo
    saldo NUMERIC, -- Saldo atual do produto
    valor_venda NUMERIC, -- Valor de venda do produto
    id_legado INTEGER, -- ID legado do produto
    integracao_ecommerce_ativada BOOLEAN DEFAULT FALSE, -- Se integração com ecommerce está ativada
    movido BOOLEAN DEFAULT FALSE, -- Indica se o produto foi movido
    nivel_estoque TEXT, -- Nível de estoque (PADRAO, MINIMO, MAXIMO, etc)
    ultima_atualizacao TIMESTAMP WITH TIME ZONE, -- Data da última atualização do produto
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, produto_id) -- Um produto por cliente
);

-- Índices para produtos
CREATE INDEX IF NOT EXISTS idx_produtos_cliente_id ON produtos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_produtos_produto_id ON produtos(produto_id);
CREATE INDEX IF NOT EXISTS idx_produtos_cliente_produto ON produtos(cliente_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_produtos_created_at ON produtos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos(codigo);
CREATE INDEX IF NOT EXISTS idx_produtos_ean ON produtos(ean);
CREATE INDEX IF NOT EXISTS idx_produtos_sku ON produtos(sku);
CREATE INDEX IF NOT EXISTS idx_produtos_status ON produtos(status);
CREATE INDEX IF NOT EXISTS idx_produtos_tipo ON produtos(tipo);
CREATE INDEX IF NOT EXISTS idx_produtos_ultima_atualizacao ON produtos(ultima_atualizacao DESC);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_produtos_dados_originais ON produtos USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_produtos_updated_at ON produtos;
CREATE TRIGGER update_produtos_updated_at
    BEFORE UPDATE ON produtos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE produtos IS 'Armazena produtos coletados da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN produtos.produto_id IS 'ID do produto na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN produtos.codigo IS 'Código do produto';
COMMENT ON COLUMN produtos.nome IS 'Nome do produto';
COMMENT ON COLUMN produtos.ean IS 'EAN (European Article Number) do produto';
COMMENT ON COLUMN produtos.sku IS 'SKU (Stock Keeping Unit) do produto';
COMMENT ON COLUMN produtos.status IS 'Status do produto: ATIVO ou INATIVO';
COMMENT ON COLUMN produtos.tipo IS 'Tipo do produto';
COMMENT ON COLUMN produtos.custo_medio IS 'Custo médio do produto';
COMMENT ON COLUMN produtos.estoque_minimo IS 'Estoque mínimo configurado para o produto';
COMMENT ON COLUMN produtos.estoque_maximo IS 'Estoque máximo configurado para o produto';
COMMENT ON COLUMN produtos.saldo IS 'Saldo atual do produto em estoque';
COMMENT ON COLUMN produtos.valor_venda IS 'Valor de venda do produto';
COMMENT ON COLUMN produtos.id_legado IS 'ID legado do produto (do sistema anterior)';
COMMENT ON COLUMN produtos.integracao_ecommerce_ativada IS 'Indica se a integração com ecommerce está ativada para este produto';
COMMENT ON COLUMN produtos.movido IS 'Indica se o produto foi movido';
COMMENT ON COLUMN produtos.nivel_estoque IS 'Nível atual de estoque (PADRAO, MINIMO, MAXIMO, etc)';
COMMENT ON COLUMN produtos.ultima_atualizacao IS 'Data da última atualização do produto na API';
COMMENT ON COLUMN produtos.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';
