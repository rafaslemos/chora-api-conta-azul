-- Schema do Supabase para Tabela de Contratos
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: contratos
-- Armazena contratos coletados da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS contratos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    contrato_id TEXT NOT NULL, -- ID do contrato na API Conta Azul (campo 'id' do JSON)
    numero INTEGER, -- Número do contrato
    data_inicio DATE, -- Data de início do contrato
    status TEXT, -- Status do contrato (ATIVO, INATIVO)
    proximo_vencimento DATE, -- Data do próximo vencimento
    cliente_contrato_id TEXT, -- ID do cliente (extraído do objeto cliente)
    cliente_contrato_nome TEXT, -- Nome do cliente (extraído do objeto cliente)
    data_criacao TIMESTAMP WITH TIME ZONE, -- Data/hora de criação
    data_alteracao TIMESTAMP WITH TIME ZONE, -- Data/hora da última alteração
    versao INTEGER, -- Versão do contrato
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, contrato_id) -- Um contrato por cliente
);

-- Índices para contratos
CREATE INDEX IF NOT EXISTS idx_contratos_cliente_id ON contratos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contratos_contrato_id ON contratos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contratos_cliente_contrato_id ON contratos(cliente_id, contrato_id);
CREATE INDEX IF NOT EXISTS idx_contratos_created_at ON contratos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_data_inicio ON contratos(data_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_numero ON contratos(numero);
CREATE INDEX IF NOT EXISTS idx_contratos_status ON contratos(status);
CREATE INDEX IF NOT EXISTS idx_contratos_proximo_vencimento ON contratos(proximo_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_data_criacao ON contratos(data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_data_alteracao ON contratos(data_alteracao DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_cliente_contrato_id_field ON contratos(cliente_contrato_id);
CREATE INDEX IF NOT EXISTS idx_contratos_cliente_contrato_nome ON contratos(cliente_contrato_nome);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_contratos_dados_originais ON contratos USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_contratos_updated_at ON contratos;
CREATE TRIGGER update_contratos_updated_at
    BEFORE UPDATE ON contratos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE contratos IS 'Armazena contratos coletados da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN contratos.contrato_id IS 'ID do contrato na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN contratos.numero IS 'Número do contrato';
COMMENT ON COLUMN contratos.data_inicio IS 'Data de início do contrato';
COMMENT ON COLUMN contratos.status IS 'Status do contrato (ATIVO, INATIVO)';
COMMENT ON COLUMN contratos.proximo_vencimento IS 'Data do próximo vencimento do contrato';
COMMENT ON COLUMN contratos.cliente_contrato_id IS 'ID do cliente (extraído do objeto cliente)';
COMMENT ON COLUMN contratos.cliente_contrato_nome IS 'Nome do cliente (extraído do objeto cliente)';
COMMENT ON COLUMN contratos.data_criacao IS 'Data/hora de criação do contrato na API';
COMMENT ON COLUMN contratos.data_alteracao IS 'Data/hora da última alteração do contrato na API';
COMMENT ON COLUMN contratos.versao IS 'Versão do contrato';
COMMENT ON COLUMN contratos.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';

