-- Schema do Supabase para Tabela de Categorias DRE
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: categorias_dre
-- Armazena categorias DRE coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS categorias_dre (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    categoria_dre_id TEXT NOT NULL, -- ID da categoria DRE na API Conta Azul (campo 'id' do JSON)
    descricao TEXT NOT NULL, -- Descrição do item
    codigo TEXT, -- Código de identificação do item
    posicao INTEGER, -- Ordem de posicionamento do item na estrutura
    indica_totalizador BOOLEAN DEFAULT FALSE, -- Indica se o item é um totalizador de subitens
    representa_soma_custo_medio BOOLEAN DEFAULT FALSE, -- Indica se o item representa a soma do custo médio do produto
    categoria_dre_pai_id TEXT, -- ID do item pai (null se for item raiz)
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup) - inclui subitens e categorias_financeiras
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, categoria_dre_id) -- Uma categoria DRE por cliente
);

-- Índices para categorias_dre
CREATE INDEX IF NOT EXISTS idx_categorias_dre_cliente_id ON categorias_dre(cliente_id);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_categoria_dre_id ON categorias_dre(categoria_dre_id);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_cliente_categoria ON categorias_dre(cliente_id, categoria_dre_id);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_created_at ON categorias_dre(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_descricao ON categorias_dre(descricao);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_codigo ON categorias_dre(codigo);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_posicao ON categorias_dre(posicao);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_indica_totalizador ON categorias_dre(indica_totalizador);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_categoria_dre_pai_id ON categorias_dre(categoria_dre_pai_id);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_categorias_dre_dados_originais ON categorias_dre USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_categorias_dre_updated_at ON categorias_dre;
CREATE TRIGGER update_categorias_dre_updated_at
    BEFORE UPDATE ON categorias_dre
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE categorias_dre IS 'Armazena categorias DRE coletadas da API Conta Azul com colunas específicas para facilitar consultas e análises. A hierarquia completa é mantida em dados_originais.';
COMMENT ON COLUMN categorias_dre.categoria_dre_id IS 'ID da categoria DRE na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN categorias_dre.descricao IS 'Descrição do item da categoria DRE';
COMMENT ON COLUMN categorias_dre.codigo IS 'Código de identificação do item';
COMMENT ON COLUMN categorias_dre.posicao IS 'Ordem de posicionamento do item na estrutura DRE';
COMMENT ON COLUMN categorias_dre.indica_totalizador IS 'Indica se o item é um totalizador de subitens';
COMMENT ON COLUMN categorias_dre.representa_soma_custo_medio IS 'Indica se o item representa a soma do custo médio do produto';
COMMENT ON COLUMN categorias_dre.categoria_dre_pai_id IS 'ID do item pai (null se for item raiz). Permite hierarquia de categorias DRE';
COMMENT ON COLUMN categorias_dre.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura hierárquica (incluindo subitens e categorias_financeiras)';

