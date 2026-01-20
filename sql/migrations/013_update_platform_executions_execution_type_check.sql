-- ============================================================================
-- Migração: Atualizar constraint de execution_type em platform_executions
-- ============================================================================
-- Esta migração atualiza a constraint para incluir PEDIDOS_DETALHAMENTO
-- caso a tabela tenha sido criada antes da migration 007 ser atualizada
-- ============================================================================

-- Remover constraint antiga
ALTER TABLE public.platform_executions
DROP CONSTRAINT IF EXISTS platform_executions_execution_type_check;

-- Adicionar nova constraint com PEDIDOS_DETALHAMENTO
ALTER TABLE public.platform_executions
ADD CONSTRAINT platform_executions_execution_type_check 
CHECK (execution_type IN (
    'ORDER_SYNC', 
    'PRODUCT_SYNC', 
    'FEES_SYNC', 
    'CUSTOMER_SYNC', 
    'PEDIDOS_PESQUISA', 
    'PEDIDOS_DETALHAMENTO'
));

-- Comentário
COMMENT ON COLUMN public.platform_executions.execution_type IS 'Tipo de execução: ORDER_SYNC, PRODUCT_SYNC, FEES_SYNC, CUSTOMER_SYNC, PEDIDOS_PESQUISA, PEDIDOS_DETALHAMENTO';
