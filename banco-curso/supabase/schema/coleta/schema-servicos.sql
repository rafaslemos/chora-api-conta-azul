-- Schema do Supabase para Tabela de Serviços
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: servicos
-- Armazena serviços coletados da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS servicos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    servico_id TEXT NOT NULL, -- ID do serviço na API Conta Azul (campo 'id' do JSON)
    codigo TEXT, -- Código interno do serviço
    descricao TEXT NOT NULL, -- Descrição do serviço
    codigo_cnae TEXT, -- Código CNAE do serviço
    codigo_municipio_servico TEXT, -- Código do município onde o serviço é prestado
    custo NUMERIC, -- Custo do serviço
    preco NUMERIC, -- Preço de venda do serviço
    status TEXT CHECK (status IS NULL OR status IN ('ATIVO', 'INATIVO')), -- Status do serviço (ATIVO/INATIVO)
    tipo_servico TEXT CHECK (tipo_servico IS NULL OR tipo_servico IN ('PRESTADO', 'TOMADO', 'AMBOS')), -- Tipo do serviço (PRESTADO/TOMADO/AMBOS)
    id_servico INTEGER, -- ID do serviço no sistema legado
    id_externo TEXT, -- ID externo do serviço
    lei_116 TEXT, -- Lei 116 associada ao serviço
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, servico_id) -- Um serviço por cliente
);

-- Índices para servicos
CREATE INDEX IF NOT EXISTS idx_servicos_cliente_id ON servicos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_servicos_servico_id ON servicos(servico_id);
CREATE INDEX IF NOT EXISTS idx_servicos_cliente_servico ON servicos(cliente_id, servico_id);
CREATE INDEX IF NOT EXISTS idx_servicos_created_at ON servicos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_servicos_descricao ON servicos(descricao);
CREATE INDEX IF NOT EXISTS idx_servicos_codigo ON servicos(codigo);
CREATE INDEX IF NOT EXISTS idx_servicos_codigo_cnae ON servicos(codigo_cnae);
CREATE INDEX IF NOT EXISTS idx_servicos_status ON servicos(status);
CREATE INDEX IF NOT EXISTS idx_servicos_tipo_servico ON servicos(tipo_servico);
CREATE INDEX IF NOT EXISTS idx_servicos_id_servico ON servicos(id_servico);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_servicos_dados_originais ON servicos USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_servicos_updated_at ON servicos;
CREATE TRIGGER update_servicos_updated_at
    BEFORE UPDATE ON servicos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE servicos IS 'Armazena serviços coletados da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN servicos.servico_id IS 'ID do serviço na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN servicos.codigo IS 'Código interno do serviço';
COMMENT ON COLUMN servicos.descricao IS 'Descrição detalhada do serviço';
COMMENT ON COLUMN servicos.codigo_cnae IS 'Código CNAE do serviço';
COMMENT ON COLUMN servicos.codigo_municipio_servico IS 'Código do município onde o serviço é prestado';
COMMENT ON COLUMN servicos.custo IS 'Custo do serviço';
COMMENT ON COLUMN servicos.preco IS 'Preço de venda do serviço';
COMMENT ON COLUMN servicos.status IS 'Status do serviço: ATIVO ou INATIVO';
COMMENT ON COLUMN servicos.tipo_servico IS 'Tipo do serviço: PRESTADO, TOMADO ou AMBOS';
COMMENT ON COLUMN servicos.id_servico IS 'ID do serviço no sistema legado';
COMMENT ON COLUMN servicos.id_externo IS 'ID externo do serviço';
COMMENT ON COLUMN servicos.lei_116 IS 'Lei 116 associada ao serviço';
COMMENT ON COLUMN servicos.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';

