-- Schema do Supabase para Tabela de Saldos de Contas Financeiras
-- Armazena histórico temporal de saldos coletados da API Conta Azul

-- ============================================
-- TABELA: saldos_contas
-- Armazena histórico de saldos das contas financeiras (tabela separada para rastreamento temporal)
-- ============================================
CREATE TABLE IF NOT EXISTS saldos_contas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    conta_financeira_id TEXT NOT NULL, -- ID da conta financeira na API Conta Azul (referência a contas_financeiras.conta_financeira_id)
    saldo_atual NUMERIC(15,2) NOT NULL, -- Saldo atual da conta financeira
    data_coleta TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Data/hora da coleta do saldo
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para saldos_contas
CREATE INDEX IF NOT EXISTS idx_saldos_contas_cliente_id ON saldos_contas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_saldos_contas_conta_financeira_id ON saldos_contas(conta_financeira_id);
CREATE INDEX IF NOT EXISTS idx_saldos_contas_cliente_conta ON saldos_contas(cliente_id, conta_financeira_id);
CREATE INDEX IF NOT EXISTS idx_saldos_contas_data_coleta ON saldos_contas(data_coleta DESC);
CREATE INDEX IF NOT EXISTS idx_saldos_contas_created_at ON saldos_contas(created_at DESC);
-- Índice composto para buscar saldo mais recente por conta
CREATE INDEX IF NOT EXISTS idx_saldos_contas_cliente_conta_data ON saldos_contas(cliente_id, conta_financeira_id, data_coleta DESC);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_saldos_contas_dados_originais ON saldos_contas USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_saldos_contas_updated_at ON saldos_contas;
CREATE TRIGGER update_saldos_contas_updated_at
    BEFORE UPDATE ON saldos_contas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE saldos_contas IS 'Armazena histórico temporal de saldos das contas financeiras coletados da API Conta Azul. Cada coleta cria um novo registro para rastreamento histórico.';
COMMENT ON COLUMN saldos_contas.conta_financeira_id IS 'ID da conta financeira na API Conta Azul (referência a contas_financeiras.conta_financeira_id)';
COMMENT ON COLUMN saldos_contas.saldo_atual IS 'Saldo atual da conta financeira no momento da coleta';
COMMENT ON COLUMN saldos_contas.data_coleta IS 'Data/hora da coleta do saldo. Permite rastreamento histórico de variações de saldo ao longo do tempo.';
COMMENT ON COLUMN saldos_contas.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';

