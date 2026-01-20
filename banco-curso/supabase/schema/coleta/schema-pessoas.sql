-- Schema do Supabase para Tabela de Pessoas
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: pessoas
-- Armazena pessoas (clientes/fornecedores) coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS pessoas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    pessoa_id TEXT NOT NULL, -- ID da pessoa na API Conta Azul (campo 'id' do JSON)
    id_legado INTEGER, -- ID legado da pessoa
    uuid_legado TEXT, -- UUID legado da pessoa
    nome TEXT NOT NULL, -- Nome da pessoa
    documento TEXT, -- Documento da pessoa (CPF/CNPJ)
    email TEXT, -- Email da pessoa
    telefone TEXT, -- Telefone da pessoa
    tipo_pessoa TEXT, -- Tipo de pessoa (FISICA, JURIDICA, ESTRANGEIRA)
    ativo BOOLEAN DEFAULT TRUE, -- Indica se a pessoa está ativa
    codigo TEXT, -- Código da pessoa
    perfis TEXT[], -- Array de perfis (CLIENTE, FORNECEDOR, TRANSPORTADORA)
    data_alteracao TIMESTAMP WITH TIME ZONE, -- Data/hora da última alteração
    data_criacao TIMESTAMP WITH TIME ZONE, -- Data/hora de criação
    observacoes_gerais TEXT, -- Observações gerais sobre a pessoa
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, pessoa_id) -- Uma pessoa por cliente
);

-- Índices para pessoas
CREATE INDEX IF NOT EXISTS idx_pessoas_cliente_id ON pessoas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_pessoa_id ON pessoas(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_cliente_pessoa ON pessoas(cliente_id, pessoa_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_created_at ON pessoas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pessoas_nome ON pessoas(nome);
CREATE INDEX IF NOT EXISTS idx_pessoas_documento ON pessoas(documento);
CREATE INDEX IF NOT EXISTS idx_pessoas_email ON pessoas(email);
CREATE INDEX IF NOT EXISTS idx_pessoas_tipo_pessoa ON pessoas(tipo_pessoa);
CREATE INDEX IF NOT EXISTS idx_pessoas_ativo ON pessoas(ativo);
CREATE INDEX IF NOT EXISTS idx_pessoas_codigo ON pessoas(codigo);
CREATE INDEX IF NOT EXISTS idx_pessoas_data_alteracao ON pessoas(data_alteracao DESC);
CREATE INDEX IF NOT EXISTS idx_pessoas_data_criacao ON pessoas(data_criacao DESC);

-- Índice GIN para busca em perfis (array)
CREATE INDEX IF NOT EXISTS idx_pessoas_perfis ON pessoas USING GIN (perfis);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_pessoas_dados_originais ON pessoas USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_pessoas_updated_at ON pessoas;
CREATE TRIGGER update_pessoas_updated_at
    BEFORE UPDATE ON pessoas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE pessoas IS 'Armazena pessoas (clientes/fornecedores) coletadas da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN pessoas.pessoa_id IS 'ID da pessoa na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN pessoas.id_legado IS 'ID legado da pessoa (do sistema anterior)';
COMMENT ON COLUMN pessoas.uuid_legado IS 'UUID legado da pessoa';
COMMENT ON COLUMN pessoas.nome IS 'Nome da pessoa (física, jurídica ou estrangeira)';
COMMENT ON COLUMN pessoas.documento IS 'Documento da pessoa (CPF/CNPJ)';
COMMENT ON COLUMN pessoas.email IS 'Email da pessoa';
COMMENT ON COLUMN pessoas.telefone IS 'Telefone da pessoa';
COMMENT ON COLUMN pessoas.tipo_pessoa IS 'Tipo de pessoa: FISICA, JURIDICA ou ESTRANGEIRA';
COMMENT ON COLUMN pessoas.ativo IS 'Indica se a pessoa está ativa ou inativa';
COMMENT ON COLUMN pessoas.codigo IS 'Código da pessoa';
COMMENT ON COLUMN pessoas.perfis IS 'Array de perfis associados à pessoa (CLIENTE, FORNECEDOR, TRANSPORTADORA)';
COMMENT ON COLUMN pessoas.data_alteracao IS 'Data/hora da última alteração da pessoa na API';
COMMENT ON COLUMN pessoas.data_criacao IS 'Data/hora de criação da pessoa na API';
COMMENT ON COLUMN pessoas.observacoes_gerais IS 'Observações gerais sobre a pessoa';
COMMENT ON COLUMN pessoas.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';

