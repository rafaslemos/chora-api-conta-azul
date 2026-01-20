-- Schema do Supabase para Tabela de Centro de Custos
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: centro_custos
-- Armazena centros de custo coletados da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS centro_custos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    centro_custo_id TEXT NOT NULL, -- ID do centro de custo na API Conta Azul (campo 'id' do JSON)
    codigo TEXT, -- Código do centro de custo
    nome TEXT NOT NULL, -- Nome do centro de custo
    ativo BOOLEAN DEFAULT TRUE, -- Indica se o centro de custo está ativo
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, centro_custo_id) -- Um centro de custo por cliente
);

-- Índices para centro_custos
CREATE INDEX IF NOT EXISTS idx_centro_custos_cliente_id ON centro_custos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_centro_custos_centro_custo_id ON centro_custos(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_centro_custos_cliente_centro_custo ON centro_custos(cliente_id, centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_centro_custos_created_at ON centro_custos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_centro_custos_nome ON centro_custos(nome);
CREATE INDEX IF NOT EXISTS idx_centro_custos_codigo ON centro_custos(codigo);
CREATE INDEX IF NOT EXISTS idx_centro_custos_ativo ON centro_custos(ativo);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_centro_custos_dados_originais ON centro_custos USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_centro_custos_updated_at ON centro_custos;
CREATE TRIGGER update_centro_custos_updated_at
    BEFORE UPDATE ON centro_custos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE centro_custos IS 'Armazena centros de custo coletados da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN centro_custos.centro_custo_id IS 'ID do centro de custo na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN centro_custos.codigo IS 'Código do centro de custo';
COMMENT ON COLUMN centro_custos.nome IS 'Nome do centro de custo';
COMMENT ON COLUMN centro_custos.ativo IS 'Indica se o centro de custo está ativo';
COMMENT ON COLUMN centro_custos.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';

