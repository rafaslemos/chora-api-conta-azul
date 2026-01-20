-- Schema do Supabase para Tabela de Contas a Receber
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: contas_receber
-- Armazena contas a receber coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS contas_receber (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    conta_receber_id TEXT NOT NULL, -- ID da conta a receber na API Conta Azul (campo 'id' do JSON)
    descricao TEXT, -- Descrição da conta a receber
    data_vencimento DATE, -- Data de vencimento da conta
    status TEXT, -- Status da conta (OVERDUE, PAID, etc.)
    status_traduzido TEXT, -- Status traduzido (PERDIDO, RECEBIDO, EM_ABERTO, RENEGOCIADO, RECEBIDO_PARCIAL, ATRASADO)
    total NUMERIC(15,2), -- Valor total da conta
    nao_pago NUMERIC(15,2), -- Valor não pago
    pago NUMERIC(15,2), -- Valor pago
    data_criacao TIMESTAMP WITH TIME ZONE, -- Data/hora de criação
    data_alteracao TIMESTAMP WITH TIME ZONE, -- Data/hora da última alteração
    cliente_conta_id TEXT, -- ID do cliente (do objeto cliente)
    cliente_conta_nome TEXT, -- Nome do cliente (do objeto cliente)
    detalhado BOOLEAN DEFAULT FALSE, -- Indica se já foi detalhado (busca de rateio, categoria, centro de custo)
    data_detalhamento TIMESTAMP WITH TIME ZONE, -- Data/hora do último detalhamento
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, conta_receber_id) -- Uma conta a receber por cliente
);

-- Índices para contas_receber
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente_id ON contas_receber(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_conta_receber_id ON contas_receber(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente_conta_receber ON contas_receber(cliente_id, conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_created_at ON contas_receber(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contas_receber_data_vencimento ON contas_receber(data_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_contas_receber_status ON contas_receber(status);
CREATE INDEX IF NOT EXISTS idx_contas_receber_status_traduzido ON contas_receber(status_traduzido);
CREATE INDEX IF NOT EXISTS idx_contas_receber_data_criacao ON contas_receber(data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_contas_receber_data_alteracao ON contas_receber(data_alteracao DESC);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente_conta_id ON contas_receber(cliente_conta_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente_conta_nome ON contas_receber(cliente_conta_nome);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhado ON contas_receber(detalhado);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente_detalhado ON contas_receber(cliente_id, detalhado);
CREATE INDEX IF NOT EXISTS idx_contas_receber_data_detalhamento ON contas_receber(data_detalhamento DESC);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_contas_receber_dados_originais ON contas_receber USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_contas_receber_updated_at ON contas_receber;
CREATE TRIGGER update_contas_receber_updated_at
    BEFORE UPDATE ON contas_receber
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE contas_receber IS 'Armazena contas a receber coletadas da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN contas_receber.conta_receber_id IS 'ID da conta a receber na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN contas_receber.descricao IS 'Descrição da conta a receber';
COMMENT ON COLUMN contas_receber.data_vencimento IS 'Data de vencimento da conta';
COMMENT ON COLUMN contas_receber.status IS 'Status da conta na API (OVERDUE, PAID, etc.)';
COMMENT ON COLUMN contas_receber.status_traduzido IS 'Status traduzido: PERDIDO, RECEBIDO, EM_ABERTO, RENEGOCIADO, RECEBIDO_PARCIAL, ATRASADO';
COMMENT ON COLUMN contas_receber.total IS 'Valor total da conta';
COMMENT ON COLUMN contas_receber.nao_pago IS 'Valor não pago da conta';
COMMENT ON COLUMN contas_receber.pago IS 'Valor pago da conta';
COMMENT ON COLUMN contas_receber.data_criacao IS 'Data/hora de criação da conta na API';
COMMENT ON COLUMN contas_receber.data_alteracao IS 'Data/hora da última alteração da conta na API';
COMMENT ON COLUMN contas_receber.cliente_conta_id IS 'ID do cliente (extraído do objeto cliente)';
COMMENT ON COLUMN contas_receber.cliente_conta_nome IS 'Nome do cliente (extraído do objeto cliente)';
COMMENT ON COLUMN contas_receber.detalhado IS 'Indica se a parcela já foi detalhada (busca de rateio, categoria e centro de custo via GET /v1/financeiro/eventos-financeiros/parcelas/{id}). Resetado para FALSE quando dados básicos mudam na coleta incremental.';
COMMENT ON COLUMN contas_receber.data_detalhamento IS 'Data/hora do último detalhamento. Limpado quando detalhado é resetado para FALSE.';
COMMENT ON COLUMN contas_receber.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro. Detalhamento completo de parcelas (rateio, categoria, centro de custo) é armazenado na tabela parcelas_detalhes.';

