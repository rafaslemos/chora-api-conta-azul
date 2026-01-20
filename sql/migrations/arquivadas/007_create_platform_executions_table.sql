-- ============================================================================
-- Migração: Criar tabela platform_executions (genérica para múltiplas plataformas)
-- ============================================================================
-- Esta migração cria uma tabela genérica para registrar execuções diárias
-- de sincronização de diferentes plataformas (Tiny, Olist, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('OLIST', 'CONTA_AZUL', 'HOTMART', 'MERCADO_LIVRE', 'SHOPEE', 'TINY')),
    execution_type TEXT NOT NULL CHECK (execution_type IN ('ORDER_SYNC', 'PRODUCT_SYNC', 'FEES_SYNC', 'CUSTOMER_SYNC', 'PEDIDOS_PESQUISA', 'PEDIDOS_DETALHAMENTO')),
    execution_date DATE NOT NULL,
    total_pages INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    is_initial_load BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'ERROR', 'PARTIAL', 'RUNNING')),
    error_message TEXT,
    execution_details JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, platform, execution_type, execution_date)
);

-- Comentários para documentação
COMMENT ON TABLE public.platform_executions IS 'Registro genérico de execuções diárias de sincronização por plataforma';
COMMENT ON COLUMN public.platform_executions.platform IS 'Plataforma da execução (TINY, OLIST, etc.)';
COMMENT ON COLUMN public.platform_executions.execution_type IS 'Tipo de execução (PEDIDOS_PESQUISA, PEDIDOS_DETALHAMENTO, ORDER_SYNC, etc.)';
COMMENT ON COLUMN public.platform_executions.total_pages IS 'Total de páginas processadas';
COMMENT ON COLUMN public.platform_executions.total_items IS 'Total de itens processados';
COMMENT ON COLUMN public.platform_executions.execution_details IS 'Detalhes específicos da execução em formato JSON';

-- Índices
CREATE INDEX IF NOT EXISTS idx_platform_executions_tenant_date ON public.platform_executions(tenant_id, execution_date DESC);
CREATE INDEX IF NOT EXISTS idx_platform_executions_platform_type ON public.platform_executions(platform, execution_type);
CREATE INDEX IF NOT EXISTS idx_platform_executions_status ON public.platform_executions(status);
CREATE INDEX IF NOT EXISTS idx_platform_executions_execution_date ON public.platform_executions(execution_date DESC);

-- Habilitar RLS
ALTER TABLE public.platform_executions ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Partners can view own tenant executions" ON public.platform_executions;
DROP POLICY IF EXISTS "System can create executions" ON public.platform_executions;
DROP POLICY IF EXISTS "Partners can update own tenant executions" ON public.platform_executions;

-- Política: Parceiros podem ver execuções de seus tenants
CREATE POLICY "Partners can view own tenant executions"
    ON public.platform_executions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = platform_executions.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

-- Política: Sistema pode criar execuções (via Service Role)
CREATE POLICY "System can create executions"
    ON public.platform_executions FOR INSERT
    WITH CHECK (true);

-- Política: Parceiros podem atualizar execuções de seus tenants
CREATE POLICY "Partners can update own tenant executions"
    ON public.platform_executions FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = platform_executions.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

