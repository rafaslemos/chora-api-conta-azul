-- Schema do Supabase para Tabela de Contas a Receber Detalhadas
-- Armazena detalhamento de contas a receber com rateio expandido (uma linha por rateio)

-- ============================================
-- TABELA: contas_receber_detalhadas
-- Armazena detalhamento de contas a receber com rateio, categoria e centro de custo
-- Uma linha por rateio de cada parcela
-- ============================================
CREATE TABLE IF NOT EXISTS contas_receber_detalhadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    conta_receber_id TEXT NOT NULL, -- ID da conta a receber (referência a contas_receber.conta_receber_id)
    parcela_id TEXT NOT NULL, -- ID da parcela na API (campo 'id' da resposta do endpoint de detalhes)
    
    -- Dados do rateio
    categoria_id TEXT, -- ID da categoria (id_categoria do rateio)
    categoria_nome TEXT, -- Nome da categoria (nome_categoria do rateio)
    centro_custo_id TEXT, -- ID do centro de custo (primeiro centro de custo do rateio_centro_custo, se houver múltiplos, considerar o primeiro ou agregar)
    centro_custo_nome TEXT, -- Nome do centro de custo
    
    -- Valores
    valor_rateio NUMERIC(15,2), -- Valor do rateio (valor do rateio)
    valor_total_parcela NUMERIC(15,2), -- Valor total da parcela
    valor_pago NUMERIC(15,2), -- Valor pago da parcela
    valor_nao_pago NUMERIC(15,2), -- Valor não pago da parcela
    
    -- Dados da parcela
    data_vencimento DATE, -- Data de vencimento da parcela
    status TEXT, -- Status da parcela
    status_traduzido TEXT, -- Status traduzido
    
    -- Dados do cliente
    cliente_conta_id TEXT, -- ID do cliente (cliente.id)
    cliente_conta_nome TEXT, -- Nome do cliente (cliente.nome)
    
    -- Dados do evento financeiro
    evento_id TEXT, -- ID do evento financeiro (evento.id)
    evento_tipo TEXT, -- Tipo do evento (evento.tipo: RECEITA ou DESPESA)
    data_competencia DATE, -- Data de competência (evento.data_competencia)
    
    -- Backup completo
    dados_originais JSONB NOT NULL, -- Dados completos retornados pelo endpoint GET /v1/financeiro/eventos-financeiros/parcelas/{id}
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(cliente_id, conta_receber_id, parcela_id, categoria_id, centro_custo_id) -- Uma linha por combinação única
);

-- Índices para contas_receber_detalhadas
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_cliente_id ON contas_receber_detalhadas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_conta_receber_id ON contas_receber_detalhadas(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_parcela_id ON contas_receber_detalhadas(parcela_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_cliente_conta_parcela ON contas_receber_detalhadas(cliente_id, conta_receber_id, parcela_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_categoria_id ON contas_receber_detalhadas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_centro_custo_id ON contas_receber_detalhadas(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_data_vencimento ON contas_receber_detalhadas(data_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_status ON contas_receber_detalhadas(status);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_cliente_conta_id ON contas_receber_detalhadas(cliente_conta_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_evento_id ON contas_receber_detalhadas(evento_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_created_at ON contas_receber_detalhadas(created_at DESC);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_dados_originais ON contas_receber_detalhadas USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_contas_receber_detalhadas_updated_at ON contas_receber_detalhadas;
CREATE TRIGGER update_contas_receber_detalhadas_updated_at
    BEFORE UPDATE ON contas_receber_detalhadas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE contas_receber_detalhadas IS 'Armazena detalhamento de contas a receber com rateio expandido. Uma linha por combinação de parcela, categoria e centro de custo.';
COMMENT ON COLUMN contas_receber_detalhadas.conta_receber_id IS 'ID da conta a receber na API (referência a contas_receber.conta_receber_id)';
COMMENT ON COLUMN contas_receber_detalhadas.parcela_id IS 'ID da parcela na API (campo id da resposta do endpoint GET /v1/financeiro/eventos-financeiros/parcelas/{id})';
COMMENT ON COLUMN contas_receber_detalhadas.categoria_id IS 'ID da categoria (id_categoria do rateio)';
COMMENT ON COLUMN contas_receber_detalhadas.categoria_nome IS 'Nome da categoria (nome_categoria do rateio)';
COMMENT ON COLUMN contas_receber_detalhadas.centro_custo_id IS 'ID do centro de custo do rateio_centro_custo';
COMMENT ON COLUMN contas_receber_detalhadas.centro_custo_nome IS 'Nome do centro de custo';
COMMENT ON COLUMN contas_receber_detalhadas.valor_rateio IS 'Valor do rateio para esta categoria e centro de custo';
COMMENT ON COLUMN contas_receber_detalhadas.valor_total_parcela IS 'Valor total da parcela';
COMMENT ON COLUMN contas_receber_detalhadas.valor_pago IS 'Valor já pago da parcela';
COMMENT ON COLUMN contas_receber_detalhadas.valor_nao_pago IS 'Valor ainda não pago da parcela';
COMMENT ON COLUMN contas_receber_detalhadas.cliente_conta_id IS 'ID do cliente (cliente.id)';
COMMENT ON COLUMN contas_receber_detalhadas.cliente_conta_nome IS 'Nome do cliente (cliente.nome)';
COMMENT ON COLUMN contas_receber_detalhadas.evento_id IS 'ID do evento financeiro (evento.id)';
COMMENT ON COLUMN contas_receber_detalhadas.evento_tipo IS 'Tipo do evento: RECEITA ou DESPESA';
COMMENT ON COLUMN contas_receber_detalhadas.dados_originais IS 'Dados completos retornados pelo endpoint GET /v1/financeiro/eventos-financeiros/parcelas/{id}';

