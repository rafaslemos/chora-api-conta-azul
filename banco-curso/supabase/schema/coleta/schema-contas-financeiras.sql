-- Schema do Supabase para Tabela de Contas Financeiras
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: contas_financeiras
-- Armazena contas financeiras coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS contas_financeiras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    conta_financeira_id TEXT NOT NULL, -- ID da conta financeira na API Conta Azul (campo 'id' do JSON)
    nome TEXT, -- Nome da conta financeira
    tipo TEXT, -- Tipo da conta (APLICACAO, CAIXINHA, CONTA_CORRENTE, CARTAO_CREDITO, INVESTIMENTO, OUTROS, MEIOS_RECEBIMENTO, POUPANCA, COBRANCAS_CONTA_AZUL, RECEBA_FACIL_CARTAO)
    banco TEXT, -- Instituição bancária
    codigo_banco INTEGER, -- Código da instituição bancária
    ativo BOOLEAN, -- Indica se a conta está ativa
    conta_padrao BOOLEAN, -- Indica se é a conta padrão
    possui_config_boleto_bancario BOOLEAN, -- Indica se a conta possui configuração de boleto bancário
    agencia TEXT, -- Agência da conta
    numero TEXT, -- Número da conta
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, conta_financeira_id) -- Uma conta financeira por cliente
);

-- Índices para contas_financeiras
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_cliente_id ON contas_financeiras(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_conta_financeira_id ON contas_financeiras(conta_financeira_id);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_cliente_conta ON contas_financeiras(cliente_id, conta_financeira_id);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_created_at ON contas_financeiras(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_tipo ON contas_financeiras(tipo);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_ativo ON contas_financeiras(ativo);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_conta_padrao ON contas_financeiras(conta_padrao);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_dados_originais ON contas_financeiras USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_contas_financeiras_updated_at ON contas_financeiras;
CREATE TRIGGER update_contas_financeiras_updated_at
    BEFORE UPDATE ON contas_financeiras
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE contas_financeiras IS 'Armazena contas financeiras coletadas da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN contas_financeiras.conta_financeira_id IS 'ID da conta financeira na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN contas_financeiras.nome IS 'Nome da conta financeira';
COMMENT ON COLUMN contas_financeiras.tipo IS 'Tipo da conta: APLICACAO, CAIXINHA, CONTA_CORRENTE, CARTAO_CREDITO, INVESTIMENTO, OUTROS, MEIOS_RECEBIMENTO, POUPANCA, COBRANCAS_CONTA_AZUL, RECEBA_FACIL_CARTAO';
COMMENT ON COLUMN contas_financeiras.banco IS 'Instituição bancária';
COMMENT ON COLUMN contas_financeiras.codigo_banco IS 'Código da instituição bancária';
COMMENT ON COLUMN contas_financeiras.ativo IS 'Indica se a conta está ativa';
COMMENT ON COLUMN contas_financeiras.conta_padrao IS 'Indica se é a conta padrão';
COMMENT ON COLUMN contas_financeiras.possui_config_boleto_bancario IS 'Indica se a conta possui configuração de boleto bancário';
COMMENT ON COLUMN contas_financeiras.agencia IS 'Agência da conta';
COMMENT ON COLUMN contas_financeiras.numero IS 'Número da conta';
COMMENT ON COLUMN contas_financeiras.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';

