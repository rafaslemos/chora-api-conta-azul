-- Schema do Supabase para Tabela de Itens de Vendas
-- Armazena itens detalhados de vendas coletados da API Conta Azul

-- ============================================
-- TABELA: vendas_itens
-- Armazena itens detalhados de vendas (produtos e serviços)
-- Uma linha por item de venda
-- ============================================
CREATE TABLE IF NOT EXISTS vendas_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    venda_id TEXT NOT NULL, -- ID da venda (referência a vendas.venda_id)
    item_id TEXT, -- ID do item na API (campo 'id' do item, se disponível)
    
    -- Produto ou Serviço
    produto_id TEXT, -- ID do produto (se o item for um produto)
    produto_nome TEXT, -- Nome do produto
    servico_id TEXT, -- ID do serviço (se o item for um serviço)
    servico_nome TEXT, -- Nome do serviço
    
    -- Quantidades e Valores
    quantidade NUMERIC(15,4), -- Quantidade do item
    valor_unitario NUMERIC(15,2), -- Valor unitário do item
    valor_total NUMERIC(15,2), -- Valor total do item (quantidade * valor_unitario, antes de descontos)
    desconto NUMERIC(15,2), -- Valor do desconto aplicado ao item
    valor_liquido NUMERIC(15,2), -- Valor líquido (valor_total - desconto)
    
    -- Informações adicionais
    unidade_medida TEXT, -- Unidade de medida do item
    codigo TEXT, -- Código do produto/serviço (SKU, código interno, etc.)
    descricao TEXT, -- Descrição adicional do item
    
    -- Backup completo
    dados_originais JSONB NOT NULL, -- Dados completos retornados pelo endpoint GET /v1/venda/{id_venda}/itens
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(cliente_id, venda_id, item_id) -- Uma linha por item de venda
);

-- Índices para vendas_itens
CREATE INDEX IF NOT EXISTS idx_vendas_itens_cliente_id ON vendas_itens(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_venda_id ON vendas_itens(venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_cliente_venda ON vendas_itens(cliente_id, venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_item_id ON vendas_itens(item_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_produto_id ON vendas_itens(produto_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_servico_id ON vendas_itens(servico_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_created_at ON vendas_itens(created_at DESC);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_vendas_itens_dados_originais ON vendas_itens USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_vendas_itens_updated_at ON vendas_itens;
CREATE TRIGGER update_vendas_itens_updated_at
    BEFORE UPDATE ON vendas_itens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE vendas_itens IS 'Armazena itens detalhados de vendas coletados da API Conta Azul. Uma linha por item (produto ou serviço) de cada venda.';
COMMENT ON COLUMN vendas_itens.venda_id IS 'ID da venda na API (referência a vendas.venda_id)';
COMMENT ON COLUMN vendas_itens.item_id IS 'ID do item na API (campo id do item, se disponível)';
COMMENT ON COLUMN vendas_itens.produto_id IS 'ID do produto (se o item for um produto)';
COMMENT ON COLUMN vendas_itens.produto_nome IS 'Nome do produto';
COMMENT ON COLUMN vendas_itens.servico_id IS 'ID do serviço (se o item for um serviço)';
COMMENT ON COLUMN vendas_itens.servico_nome IS 'Nome do serviço';
COMMENT ON COLUMN vendas_itens.quantidade IS 'Quantidade do item';
COMMENT ON COLUMN vendas_itens.valor_unitario IS 'Valor unitário do item';
COMMENT ON COLUMN vendas_itens.valor_total IS 'Valor total do item (quantidade * valor_unitario, antes de descontos)';
COMMENT ON COLUMN vendas_itens.desconto IS 'Valor do desconto aplicado ao item';
COMMENT ON COLUMN vendas_itens.valor_liquido IS 'Valor líquido do item (valor_total - desconto)';
COMMENT ON COLUMN vendas_itens.dados_originais IS 'Dados completos retornados pelo endpoint GET /v1/venda/{id_venda}/itens';

