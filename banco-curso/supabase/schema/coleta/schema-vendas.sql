-- Schema do Supabase para Tabela de Vendas
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: vendas
-- Armazena vendas coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS vendas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    venda_id TEXT NOT NULL, -- ID da venda na API Conta Azul (campo 'id' do JSON)
    numero INTEGER, -- Número da venda
    data DATE, -- Data da venda (data de emissão)
    data_inicio DATE, -- Data de início da venda (pode ser igual a data)
    total NUMERIC(15,2), -- Valor total da venda
    tipo TEXT, -- Tipo da venda (PRODUTO, SERVICO, etc.)
    itens TEXT, -- Tipo de itens (PRODUTO, SERVICO, etc.)
    situacao TEXT, -- Situação da venda (extraído do objeto situacao)
    condicao_pagamento BOOLEAN, -- Condição de pagamento
    id_legado INTEGER, -- ID legado da venda
    cliente_venda_id TEXT, -- ID do cliente (extraído do objeto cliente)
    cliente_venda_nome TEXT, -- Nome do cliente (extraído do objeto cliente)
    vendedor_id TEXT, -- ID do vendedor (se disponível)
    vendedor_nome TEXT, -- Nome do vendedor (se disponível)
    data_criacao TIMESTAMP WITH TIME ZONE, -- Data/hora de criação (criado_em)
    data_alteracao TIMESTAMP WITH TIME ZONE, -- Data/hora da última alteração
    versao INTEGER, -- Versão da venda
    itens_detalhados BOOLEAN DEFAULT FALSE, -- Indica se os itens da venda já foram detalhados (busca de itens via GET /v1/venda/{id_venda}/itens)
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, venda_id) -- Uma venda por cliente
);

-- Índices para vendas
CREATE INDEX IF NOT EXISTS idx_vendas_cliente_id ON vendas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_venda_id ON vendas(venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente_venda_id ON vendas(cliente_id, venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_created_at ON vendas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_data_inicio ON vendas(data_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_numero ON vendas(numero);
CREATE INDEX IF NOT EXISTS idx_vendas_tipo ON vendas(tipo);
CREATE INDEX IF NOT EXISTS idx_vendas_situacao ON vendas(situacao);
CREATE INDEX IF NOT EXISTS idx_vendas_data_criacao ON vendas(data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_data_alteracao ON vendas(data_alteracao DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente_venda_id ON vendas(cliente_venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente_venda_nome ON vendas(cliente_venda_nome);
CREATE INDEX IF NOT EXISTS idx_vendas_vendedor_id ON vendas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_detalhados ON vendas(itens_detalhados) WHERE itens_detalhados = FALSE;
CREATE INDEX IF NOT EXISTS idx_vendas_cliente_itens_detalhados ON vendas(cliente_id, itens_detalhados) WHERE itens_detalhados = FALSE;

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_vendas_dados_originais ON vendas USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_vendas_updated_at ON vendas;
CREATE TRIGGER update_vendas_updated_at
    BEFORE UPDATE ON vendas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE vendas IS 'Armazena vendas coletadas da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN vendas.venda_id IS 'ID da venda na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN vendas.numero IS 'Número da venda';
COMMENT ON COLUMN vendas.data IS 'Data da venda (data de emissão)';
COMMENT ON COLUMN vendas.data_inicio IS 'Data de início da venda (pode ser igual a data)';
COMMENT ON COLUMN vendas.total IS 'Valor total da venda';
COMMENT ON COLUMN vendas.tipo IS 'Tipo da venda (PRODUTO, SERVICO, etc.)';
COMMENT ON COLUMN vendas.itens IS 'Tipo de itens (PRODUTO, SERVICO, etc.)';
COMMENT ON COLUMN vendas.situacao IS 'Situação da venda (extraído do objeto situacao)';
COMMENT ON COLUMN vendas.condicao_pagamento IS 'Condição de pagamento';
COMMENT ON COLUMN vendas.id_legado IS 'ID legado da venda';
COMMENT ON COLUMN vendas.cliente_venda_id IS 'ID do cliente (extraído do objeto cliente)';
COMMENT ON COLUMN vendas.cliente_venda_nome IS 'Nome do cliente (extraído do objeto cliente)';
COMMENT ON COLUMN vendas.vendedor_id IS 'ID do vendedor (se disponível)';
COMMENT ON COLUMN vendas.vendedor_nome IS 'Nome do vendedor (se disponível)';
COMMENT ON COLUMN vendas.data_criacao IS 'Data/hora de criação da venda na API (criado_em)';
COMMENT ON COLUMN vendas.data_alteracao IS 'Data/hora da última alteração da venda na API';
COMMENT ON COLUMN vendas.versao IS 'Versão da venda';
COMMENT ON COLUMN vendas.itens_detalhados IS 'Indica se os itens da venda já foram detalhados (busca de itens via GET /v1/venda/{id_venda}/itens). Resetado para FALSE quando dados básicos da venda mudam na coleta incremental.';
COMMENT ON COLUMN vendas.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';

