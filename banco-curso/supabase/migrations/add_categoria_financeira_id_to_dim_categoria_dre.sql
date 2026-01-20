-- Migração: Adicionar categoria_financeira_id à tabela dw.dim_categoria_dre
-- Data: 2025-01-XX
-- Descrição: Adiciona coluna categoria_financeira_id para suportar expansão de categorias financeiras
--            e modifica constraint UNIQUE para permitir múltiplos registros por categoria DRE

-- ============================================
-- Adicionar coluna categoria_financeira_id
-- ============================================
ALTER TABLE dw.dim_categoria_dre 
ADD COLUMN IF NOT EXISTS categoria_financeira_id TEXT;

-- ============================================
-- Remover constraint UNIQUE antiga
-- ============================================
-- Remover constraint antiga (pode ter nomes diferentes dependendo do PostgreSQL)
DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    -- Tentar remover a constraint com nome padrão
    BEGIN
        ALTER TABLE dw.dim_categoria_dre
        DROP CONSTRAINT IF EXISTS dim_categoria_dre_cliente_id_categoria_dre_api_id_key;
    EXCEPTION
        WHEN undefined_object THEN
            NULL; -- Constraint não existe, continuar
    END;
    
    -- Tentar encontrar e remover constraint por padrão
    SELECT conname INTO v_constraint_name
    FROM pg_constraint 
    WHERE conrelid = 'dw.dim_categoria_dre'::regclass
    AND contype = 'u'
    AND array_length(conkey, 1) = 2  -- Constraint com 2 colunas (cliente_id, categoria_dre_api_id)
    LIMIT 1;
    
    IF v_constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE dw.dim_categoria_dre DROP CONSTRAINT %I', v_constraint_name);
    END IF;
END $$;

-- ============================================
-- Adicionar nova constraint UNIQUE
-- ============================================
ALTER TABLE dw.dim_categoria_dre
ADD CONSTRAINT dim_categoria_dre_cliente_categoria_financeira_unique 
UNIQUE(cliente_id, categoria_dre_api_id, categoria_financeira_id);

-- ============================================
-- Adicionar índice para categoria_financeira_id
-- ============================================
CREATE INDEX IF NOT EXISTS idx_dim_categoria_dre_categoria_financeira_id 
ON dw.dim_categoria_dre(categoria_financeira_id);

-- ============================================
-- Adicionar comentários
-- ============================================
COMMENT ON COLUMN dw.dim_categoria_dre.categoria_financeira_id IS 'ID da categoria financeira associada (NULL se for registro da categoria DRE, preenchido se for registro expandido de categoria financeira)';

COMMENT ON TABLE dw.dim_categoria_dre IS 'Dimensão de categorias DRE com hierarquia nivelada para drill-down no Power BI. Inclui expansão de categorias financeiras associadas.';

