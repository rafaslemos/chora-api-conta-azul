-- ============================================================================
-- Migração: Criar tabela pedidos_tiny
-- ============================================================================
-- Esta migração cria a tabela para armazenar pedidos coletados da API Tiny
-- com rastreamento completo do ciclo de processamento
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pedidos_tiny (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    id_pedido_tiny TEXT NOT NULL,
    numero TEXT NOT NULL,
    data_pedido DATE,
    status_pedido_tiny TEXT CHECK (status_pedido_tiny IN ('aberto', 'aprovado', 'preparando_envio', 'faturado', 'pronto_envio', 'enviado', 'entregue', 'nao_entregue', 'cancelado')),
    valor_total DECIMAL(10,2),
    
    -- Status do processamento interno
    status TEXT DEFAULT 'PENDENTE_DETALHAMENTO' CHECK (
        status IN ('PENDENTE_DETALHAMENTO', 'DETALHADO', 'PENDENTE_ENVIO', 
                   'ENVIANDO', 'ENVIADO_SUCESSO', 'ENVIADO_ERRO', 'IGNORADO')
    ),
    
    -- Datas de processamento
    data_detalhamento TIMESTAMPTZ,
    data_envio TIMESTAMPTZ,
    data_envio_sucesso TIMESTAMPTZ,
    
    -- Controle de envio
    tentativas_envio INTEGER DEFAULT 0,
    erro_envio TEXT,
    id_conta_azul TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    UNIQUE(tenant_id, id_pedido_tiny)
);

-- Comentários para documentação
COMMENT ON TABLE public.pedidos_tiny IS 'Pedidos coletados da API Tiny com rastreamento completo do ciclo de processamento';
COMMENT ON COLUMN public.pedidos_tiny.status_pedido_tiny IS 'Status original do pedido na Tiny';
COMMENT ON COLUMN public.pedidos_tiny.status IS 'Status do processamento interno (PENDENTE_DETALHAMENTO, DETALHADO, etc.)';
COMMENT ON COLUMN public.pedidos_tiny.id_conta_azul IS 'ID do registro criado na Conta Azul após envio bem-sucedido';

-- Índices
CREATE INDEX IF NOT EXISTS idx_pedidos_tiny_tenant_id ON public.pedidos_tiny(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_tiny_id_pedido_tiny ON public.pedidos_tiny(id_pedido_tiny);
CREATE INDEX IF NOT EXISTS idx_pedidos_tiny_data_pedido ON public.pedidos_tiny(data_pedido DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_tiny_status ON public.pedidos_tiny(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_tiny_status_pedido_tiny ON public.pedidos_tiny(status_pedido_tiny);
CREATE INDEX IF NOT EXISTS idx_pedidos_tiny_tenant_status ON public.pedidos_tiny(tenant_id, status);

-- Habilitar RLS
ALTER TABLE public.pedidos_tiny ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Partners can view own tenant pedidos" ON public.pedidos_tiny;
DROP POLICY IF EXISTS "System can insert pedidos" ON public.pedidos_tiny;
DROP POLICY IF EXISTS "Partners can update own tenant pedidos" ON public.pedidos_tiny;

-- Política: Parceiros podem ver pedidos de seus tenants
CREATE POLICY "Partners can view own tenant pedidos"
    ON public.pedidos_tiny FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = pedidos_tiny.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

-- Política: Sistema pode inserir pedidos (via Service Role/RPC)
CREATE POLICY "System can insert pedidos"
    ON public.pedidos_tiny FOR INSERT
    WITH CHECK (true);

-- Política: Parceiros podem atualizar pedidos de seus tenants
CREATE POLICY "Partners can update own tenant pedidos"
    ON public.pedidos_tiny FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = pedidos_tiny.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

