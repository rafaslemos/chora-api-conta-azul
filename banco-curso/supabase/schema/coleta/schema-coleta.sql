-- Schema do Supabase para Sistema de Coleta de Dados Conta Azul
-- Tabelas de controle e configuração para coleta de dados

-- ============================================
-- TABELA: controle_carga
-- Controla o status de carga FULL e incremental por cliente e entidade
-- ============================================
CREATE TABLE IF NOT EXISTS controle_carga (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    entidade_tipo TEXT NOT NULL, -- 'contas_pagar', 'contas_receber', 'vendas', 'contratos', 'notas_fiscais', 'centro_custos', 'categorias', 'categorias_dre', 'pessoas', 'produtos', 'servicos', 'vendedores', 'protocolos'
    carga_full_realizada BOOLEAN DEFAULT FALSE,
    ultima_carga_full TIMESTAMP WITH TIME ZONE,
    ultima_carga_incremental TIMESTAMP WITH TIME ZONE,
    ultima_data_processada TIMESTAMP WITH TIME ZONE, -- Para controle incremental
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, entidade_tipo)
);

-- Índices para controle_carga
CREATE INDEX IF NOT EXISTS idx_controle_carga_cliente_id ON controle_carga(cliente_id);
CREATE INDEX IF NOT EXISTS idx_controle_carga_entidade_tipo ON controle_carga(entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_controle_carga_cliente_entidade ON controle_carga(cliente_id, entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_controle_carga_full_realizada ON controle_carga(carga_full_realizada) WHERE carga_full_realizada = FALSE;

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_controle_carga_updated_at ON controle_carga;
CREATE TRIGGER update_controle_carga_updated_at
    BEFORE UPDATE ON controle_carga
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABELA: config_periodicidade
-- Configuração de periodicidade por cliente e entidade (uso futuro)
-- ============================================
CREATE TABLE IF NOT EXISTS config_periodicidade (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    entidade_tipo TEXT NOT NULL, -- Configuração específica por cliente E entidade
    periodicidade_tipo TEXT NOT NULL, -- 'minuto', 'hora', 'dia', 'semana', 'mes'
    periodicidade_valor INTEGER NOT NULL, -- Ex: 30 minutos, 2 horas, 1 dia
    ativo BOOLEAN DEFAULT TRUE,
    proxima_execucao TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, entidade_tipo) -- Uma configuração por cliente E entidade
);

-- Índices para config_periodicidade
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_cliente_id ON config_periodicidade(cliente_id);
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_entidade_tipo ON config_periodicidade(entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_cliente_entidade ON config_periodicidade(cliente_id, entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_ativo ON config_periodicidade(ativo) WHERE ativo = TRUE;
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_proxima_execucao ON config_periodicidade(proxima_execucao);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_config_periodicidade_updated_at ON config_periodicidade;
CREATE TRIGGER update_config_periodicidade_updated_at
    BEFORE UPDATE ON config_periodicidade
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários nas tabelas
COMMENT ON TABLE controle_carga IS 'Controla o status de carga FULL e incremental por cliente e entidade';
COMMENT ON TABLE config_periodicidade IS 'Configuração de periodicidade por cliente e entidade (uso futuro)';

COMMENT ON COLUMN controle_carga.entidade_tipo IS 'Tipo da entidade: contas_pagar, contas_receber, vendas, contratos, notas_fiscais, centro_custos, categorias, categorias_dre, pessoas, produtos, servicos, vendedores, protocolos';
COMMENT ON COLUMN controle_carga.carga_full_realizada IS 'Indica se a carga FULL já foi realizada para este cliente e entidade';
COMMENT ON COLUMN controle_carga.ultima_data_processada IS 'Última data processada para controle incremental';

COMMENT ON COLUMN config_periodicidade.periodicidade_tipo IS 'Tipo de periodicidade: minuto, hora, dia, semana, mes';
COMMENT ON COLUMN config_periodicidade.periodicidade_valor IS 'Valor numérico da periodicidade (ex: 30 minutos, 2 horas, 1 dia)';
