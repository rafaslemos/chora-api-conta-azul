-- Schema do Supabase para Tabela de Vendedores
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: vendedores
-- Armazena vendedores coletados da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS vendedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    vendedor_id TEXT NOT NULL, -- ID do vendedor na API Conta Azul (campo 'id' do JSON)
    nome TEXT NOT NULL, -- Nome do vendedor
    id_legado INTEGER, -- ID legado do vendedor
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, vendedor_id) -- Um vendedor por cliente
);

-- Índices para vendedores
CREATE INDEX IF NOT EXISTS idx_vendedores_cliente_id ON vendedores(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendedores_vendedor_id ON vendedores(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_vendedores_cliente_vendedor ON vendedores(cliente_id, vendedor_id);
CREATE INDEX IF NOT EXISTS idx_vendedores_created_at ON vendedores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendedores_nome ON vendedores(nome);
CREATE INDEX IF NOT EXISTS idx_vendedores_id_legado ON vendedores(id_legado);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_vendedores_dados_originais ON vendedores USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_vendedores_updated_at ON vendedores;
CREATE TRIGGER update_vendedores_updated_at
    BEFORE UPDATE ON vendedores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE vendedores IS 'Armazena vendedores coletados da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN vendedores.vendedor_id IS 'ID do vendedor na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN vendedores.nome IS 'Nome do vendedor';
COMMENT ON COLUMN vendedores.id_legado IS 'ID legado do vendedor (do sistema anterior)';
COMMENT ON COLUMN vendedores.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';

