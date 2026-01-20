-- ============================================================================
-- Migração: Atualizar constraint de tipo em sync_jobs
-- ============================================================================
-- Esta migração adiciona o tipo PEDIDOS_PESQUISA ao sync_jobs
-- ============================================================================

-- Remover constraint antiga
ALTER TABLE public.sync_jobs
DROP CONSTRAINT IF EXISTS sync_jobs_type_check;

-- Adicionar nova constraint com PEDIDOS_PESQUISA e PEDIDOS_DETALHAMENTO
ALTER TABLE public.sync_jobs
ADD CONSTRAINT sync_jobs_type_check 
CHECK (type IN ('ORDER_SYNC', 'PRODUCT_SYNC', 'FEES_SYNC', 'CUSTOMER_SYNC', 'PEDIDOS_PESQUISA', 'PEDIDOS_DETALHAMENTO'));

-- Comentário
COMMENT ON COLUMN public.sync_jobs.type IS 'Tipo de sincronização: ORDER_SYNC, PRODUCT_SYNC, FEES_SYNC, CUSTOMER_SYNC, PEDIDOS_PESQUISA, PEDIDOS_DETALHAMENTO';

