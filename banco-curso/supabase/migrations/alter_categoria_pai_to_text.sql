-- Migração: Alterar categoria_pai de UUID para TEXT
-- Armazena diretamente o categoria_id da API (TEXT) ao invés do id interno (UUID)
-- Isso alinha com a estrutura de categorias_dre e simplifica as funções ETL

-- ============================================
-- ETAPA 1: Converter dados existentes (se houver)
-- ============================================
-- Se houver dados com categoria_pai como UUID, converter para categoria_id correspondente
-- Primeiro criar coluna temporária para armazenar o categoria_id
ALTER TABLE categorias ADD COLUMN IF NOT EXISTS categoria_pai_temp TEXT;

-- Converter UUIDs existentes para categoria_id correspondente
UPDATE categorias c1
SET categoria_pai_temp = c2.categoria_id
FROM categorias c2
WHERE c1.categoria_pai IS NOT NULL
  AND c2.id::TEXT = c1.categoria_pai::TEXT
  AND c1.cliente_id = c2.cliente_id;

-- ============================================
-- ETAPA 2: Remover coluna antiga e renomear temporária
-- ============================================
-- Remover coluna antiga (UUID)
ALTER TABLE categorias DROP COLUMN IF EXISTS categoria_pai;

-- Renomear coluna temporária
ALTER TABLE categorias RENAME COLUMN categoria_pai_temp TO categoria_pai;

-- ============================================
-- ETAPA 3: Atualizar comentário da coluna
-- ============================================
COMMENT ON COLUMN categorias.categoria_pai IS 'ID da categoria pai na API (categoria_id). Null se for categoria raiz. Permite hierarquia de categorias.';

-- ============================================
-- ETAPA 4: Recriar índice (opcional, mas garante otimização)
-- ============================================
-- O índice existente continuará funcionando, mas podemos recriar para garantir
DROP INDEX IF EXISTS idx_categorias_categoria_pai;
CREATE INDEX IF NOT EXISTS idx_categorias_categoria_pai ON categorias(cliente_id, categoria_pai) WHERE categoria_pai IS NOT NULL;

