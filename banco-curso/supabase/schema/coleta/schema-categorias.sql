-- Schema do Supabase para Tabela de Categorias
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: categorias
-- Armazena categorias coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    categoria_id TEXT NOT NULL, -- ID da categoria na API Conta Azul (campo 'id' do JSON)
    versao INTEGER, -- Versão da categoria
    nome TEXT NOT NULL, -- Nome da categoria
    categoria_pai TEXT, -- ID da categoria pai na API (categoria_id). Null se for categoria raiz
    tipo TEXT CHECK (tipo IS NULL OR tipo IN ('RECEITA', 'DESPESA')), -- Tipo da categoria: RECEITA ou DESPESA
    entrada_dre TEXT, -- Entrada na DRE
    considera_custo_dre BOOLEAN DEFAULT FALSE, -- Se considera custo na DRE
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, categoria_id) -- Uma categoria por cliente
);

-- Índices para categorias
CREATE INDEX IF NOT EXISTS idx_categorias_cliente_id ON categorias(cliente_id);
CREATE INDEX IF NOT EXISTS idx_categorias_categoria_id ON categorias(categoria_id);
CREATE INDEX IF NOT EXISTS idx_categorias_cliente_categoria ON categorias(cliente_id, categoria_id);
CREATE INDEX IF NOT EXISTS idx_categorias_created_at ON categorias(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categorias_nome ON categorias(nome);
CREATE INDEX IF NOT EXISTS idx_categorias_tipo ON categorias(tipo);
CREATE INDEX IF NOT EXISTS idx_categorias_categoria_pai ON categorias(cliente_id, categoria_pai) WHERE categoria_pai IS NOT NULL;

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_categorias_dados_originais ON categorias USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_categorias_updated_at ON categorias;
CREATE TRIGGER update_categorias_updated_at
    BEFORE UPDATE ON categorias
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE categorias IS 'Armazena categorias coletadas da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN categorias.categoria_id IS 'ID da categoria na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN categorias.versao IS 'Versão da categoria retornada pela API';
COMMENT ON COLUMN categorias.nome IS 'Nome da categoria';
COMMENT ON COLUMN categorias.categoria_pai IS 'ID da categoria pai na API (categoria_id). Null se for categoria raiz. Permite hierarquia de categorias';
COMMENT ON COLUMN categorias.tipo IS 'Tipo da categoria: RECEITA ou DESPESA';
COMMENT ON COLUMN categorias.entrada_dre IS 'Entrada na Demonstração do Resultado do Exercício (DRE)';
COMMENT ON COLUMN categorias.considera_custo_dre IS 'Indica se a categoria considera custo na DRE';
COMMENT ON COLUMN categorias.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';
