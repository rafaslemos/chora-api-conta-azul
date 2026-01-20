-- Schema do Supabase para Tabela de Detalhes de Parcelas
-- Armazena informações detalhadas de parcelas (rateio, categoria, centro de custo)
-- Suporta múltiplas entidades: contas_pagar, contas_receber, vendas, contratos

-- ============================================
-- TABELA: parcelas_detalhes
-- Armazena detalhamento de parcelas de todas as entidades financeiras
-- ============================================
CREATE TABLE IF NOT EXISTS parcelas_detalhes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    entidade_tipo TEXT NOT NULL, -- 'contas_pagar', 'contas_receber', 'vendas', 'contratos'
    parcela_id TEXT NOT NULL, -- ID da parcela na API (conta_pagar_id, conta_receber_id, etc.)
    detalhado BOOLEAN DEFAULT FALSE, -- Indica se já foi detalhado
    data_detalhamento TIMESTAMP WITH TIME ZONE, -- Data/hora do detalhamento
    detalhes_parcela JSONB, -- Dados completos do endpoint GET /v1/financeiro/eventos-financeiros/parcelas/{id}
    rateio JSONB, -- Array de rateios extraído de evento.rateio (para facilitar consultas)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, entidade_tipo, parcela_id) -- Uma entrada de detalhamento por parcela
);

-- Índices para parcelas_detalhes
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_cliente_id ON parcelas_detalhes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_entidade_tipo ON parcelas_detalhes(entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_parcela_id ON parcelas_detalhes(parcela_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_cliente_entidade_parcela ON parcelas_detalhes(cliente_id, entidade_tipo, parcela_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_detalhado ON parcelas_detalhes(detalhado);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_cliente_entidade_detalhado ON parcelas_detalhes(cliente_id, entidade_tipo, detalhado);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_data_detalhamento ON parcelas_detalhes(data_detalhamento DESC);

-- Índice GIN para busca em detalhes_parcela (JSONB)
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_detalhes_parcela ON parcelas_detalhes USING GIN (detalhes_parcela);

-- Índice GIN para busca em rateio (JSONB)
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_rateio ON parcelas_detalhes USING GIN (rateio);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_parcelas_detalhes_updated_at ON parcelas_detalhes;
CREATE TRIGGER update_parcelas_detalhes_updated_at
    BEFORE UPDATE ON parcelas_detalhes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE parcelas_detalhes IS 'Armazena detalhamento de parcelas (rateio, categoria, centro de custo) de todas as entidades financeiras. Permite reutilização da mesma estrutura para contas_pagar, contas_receber, vendas e contratos.';
COMMENT ON COLUMN parcelas_detalhes.cliente_id IS 'ID do cliente (referência a clientes)';
COMMENT ON COLUMN parcelas_detalhes.entidade_tipo IS 'Tipo de entidade: contas_pagar, contas_receber, vendas ou contratos';
COMMENT ON COLUMN parcelas_detalhes.parcela_id IS 'ID da parcela na API (conta_pagar_id, conta_receber_id, etc.)';
COMMENT ON COLUMN parcelas_detalhes.detalhado IS 'Indica se a parcela já foi detalhada (busca de rateio, categoria e centro de custo via GET /v1/financeiro/eventos-financeiros/parcelas/{id})';
COMMENT ON COLUMN parcelas_detalhes.data_detalhamento IS 'Data/hora em que a parcela foi detalhada';
COMMENT ON COLUMN parcelas_detalhes.detalhes_parcela IS 'Dados completos retornados pelo endpoint GET /v1/financeiro/eventos-financeiros/parcelas/{id} (inclui rateio, categoria, centro de custo)';
COMMENT ON COLUMN parcelas_detalhes.rateio IS 'Array de rateios extraído de evento.rateio para facilitar consultas. Estrutura: [{id_categoria, nome_categoria, valor, rateio_centro_custo: [...]}]';

