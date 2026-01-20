-- Schema do Supabase para Tabela de Contas a Pagar
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: contas_pagar
-- Armazena contas a pagar coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS contas_pagar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    conta_pagar_id TEXT NOT NULL, -- ID da conta a pagar na API Conta Azul (campo 'id' do JSON)
    descricao TEXT, -- Descrição da conta a pagar
    data_vencimento DATE, -- Data de vencimento da conta
    status TEXT, -- Status da conta (OVERDUE, PAID, etc.)
    status_traduzido TEXT, -- Status traduzido (ATRASADO, RECEBIDO, EM_ABERTO, RENEGOCIADO, RECEBIDO_PARCIAL, PERDIDO)
    total NUMERIC(15,2), -- Valor total da conta
    nao_pago NUMERIC(15,2), -- Valor não pago
    pago NUMERIC(15,2), -- Valor pago
    data_criacao TIMESTAMP WITH TIME ZONE, -- Data/hora de criação
    data_alteracao TIMESTAMP WITH TIME ZONE, -- Data/hora da última alteração
    fornecedor_id TEXT, -- ID do fornecedor (do objeto fornecedor)
    fornecedor_nome TEXT, -- Nome do fornecedor (do objeto fornecedor)
    detalhado BOOLEAN DEFAULT FALSE, -- Indica se já foi detalhado (busca de rateio, categoria, centro de custo)
    data_detalhamento TIMESTAMP WITH TIME ZONE, -- Data/hora do último detalhamento
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, conta_pagar_id) -- Uma conta a pagar por cliente
);

-- Índices para contas_pagar
CREATE INDEX IF NOT EXISTS idx_contas_pagar_cliente_id ON contas_pagar(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_conta_pagar_id ON contas_pagar(conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_cliente_conta_pagar ON contas_pagar(cliente_id, conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_created_at ON contas_pagar(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_vencimento ON contas_pagar(data_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON contas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status_traduzido ON contas_pagar(status_traduzido);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_criacao ON contas_pagar(data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_alteracao ON contas_pagar(data_alteracao DESC);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_fornecedor_id ON contas_pagar(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_fornecedor_nome ON contas_pagar(fornecedor_nome);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhado ON contas_pagar(detalhado);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_cliente_detalhado ON contas_pagar(cliente_id, detalhado);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_detalhamento ON contas_pagar(data_detalhamento DESC);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_contas_pagar_dados_originais ON contas_pagar USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_contas_pagar_updated_at ON contas_pagar;
CREATE TRIGGER update_contas_pagar_updated_at
    BEFORE UPDATE ON contas_pagar
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE contas_pagar IS 'Armazena contas a pagar coletadas da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN contas_pagar.conta_pagar_id IS 'ID da conta a pagar na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN contas_pagar.descricao IS 'Descrição da conta a pagar';
COMMENT ON COLUMN contas_pagar.data_vencimento IS 'Data de vencimento da conta';
COMMENT ON COLUMN contas_pagar.status IS 'Status da conta na API (OVERDUE, PAID, etc.)';
COMMENT ON COLUMN contas_pagar.status_traduzido IS 'Status traduzido: ATRASADO, RECEBIDO, EM_ABERTO, RENEGOCIADO, RECEBIDO_PARCIAL, PERDIDO';
COMMENT ON COLUMN contas_pagar.total IS 'Valor total da conta';
COMMENT ON COLUMN contas_pagar.nao_pago IS 'Valor não pago da conta';
COMMENT ON COLUMN contas_pagar.pago IS 'Valor pago da conta';
COMMENT ON COLUMN contas_pagar.data_criacao IS 'Data/hora de criação da conta na API';
COMMENT ON COLUMN contas_pagar.data_alteracao IS 'Data/hora da última alteração da conta na API';
COMMENT ON COLUMN contas_pagar.fornecedor_id IS 'ID do fornecedor (extraído do objeto fornecedor)';
COMMENT ON COLUMN contas_pagar.fornecedor_nome IS 'Nome do fornecedor (extraído do objeto fornecedor)';
COMMENT ON COLUMN contas_pagar.detalhado IS 'Indica se a parcela já foi detalhada (busca de rateio, categoria e centro de custo via GET /v1/financeiro/eventos-financeiros/parcelas/{id}). Resetado para FALSE quando dados básicos mudam na coleta incremental.';
COMMENT ON COLUMN contas_pagar.data_detalhamento IS 'Data/hora do último detalhamento. Limpado quando detalhado é resetado para FALSE.';
COMMENT ON COLUMN contas_pagar.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro. Detalhamento completo de parcelas (rateio, categoria, centro de custo) é armazenado na tabela parcelas_detalhes.';

