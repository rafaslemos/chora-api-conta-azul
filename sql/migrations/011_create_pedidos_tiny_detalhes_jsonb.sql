-- ============================================================================
-- Migração: Criar tabela pedidos_tiny_detalhes com JSONB
-- ============================================================================
-- Esta migração cria a tabela para armazenar detalhes completos dos pedidos
-- coletados da API Tiny, usando JSONB para arrays (itens, parcelas, 
-- pagamentos_integrados, marcadores)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.pedidos_tiny_detalhes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pedido_tiny_id UUID NOT NULL REFERENCES public.pedidos_tiny(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    
    -- Dados do Cliente (colunas individuais)
    cliente_nome TEXT,
    cliente_codigo TEXT,
    cliente_nome_fantasia TEXT,
    cliente_tipo_pessoa TEXT CHECK (cliente_tipo_pessoa IN ('F', 'J')),
    cliente_cpf_cnpj TEXT,
    cliente_ie TEXT,
    cliente_rg TEXT,
    cliente_endereco TEXT,
    cliente_numero TEXT,
    cliente_complemento TEXT,
    cliente_bairro TEXT,
    cliente_cidade TEXT,
    cliente_uf TEXT,
    cliente_cep TEXT,
    cliente_fone TEXT,
    cliente_email TEXT,
    
    -- Dados do Pedido
    data_faturamento DATE,
    data_envio DATE,
    data_entrega DATE,
    data_prevista DATE,
    id_lista_preco TEXT,
    descricao_lista_preco TEXT,
    valor_frete DECIMAL(10,2),
    valor_desconto DECIMAL(10,2),
    outras_despesas DECIMAL(10,2),
    total_produtos DECIMAL(10,2),
    total_pedido DECIMAL(10,2),
    deposito TEXT,
    forma_envio TEXT,
    forma_frete TEXT,
    frete_por_conta TEXT,
    condicao_pagamento TEXT,
    forma_pagamento TEXT,
    meio_pagamento TEXT,
    nome_transportador TEXT,
    numero_ordem_compra TEXT,
    obs TEXT,
    obs_interna TEXT,
    id_nota_fiscal TEXT,
    id_natureza_operacao TEXT,
    
    -- Marketplace
    ecommerce_id TEXT,
    ecommerce_nome TEXT,
    ecommerce_numero_pedido TEXT,
    ecommerce_numero_pedido_canal_venda TEXT,
    
    -- Vendedor
    id_vendedor TEXT,
    nome_vendedor TEXT,
    
    -- Arrays em JSONB (ESSENCIAIS para criação de vendas no ContaAzul)
    itens JSONB DEFAULT '[]'::jsonb,
    parcelas JSONB DEFAULT '[]'::jsonb,
    pagamentos_integrados JSONB DEFAULT '[]'::jsonb,
    marcadores JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    UNIQUE(pedido_tiny_id)
);

-- Comentários para documentação
COMMENT ON TABLE public.pedidos_tiny_detalhes IS 'Detalhes completos dos pedidos coletados da API Tiny, incluindo dados do cliente, pedido, marketplace e arrays em JSONB';
COMMENT ON COLUMN public.pedidos_tiny_detalhes.pedido_tiny_id IS 'FK para pedidos_tiny.id - referência única ao pedido básico';
COMMENT ON COLUMN public.pedidos_tiny_detalhes.itens IS 'Array JSONB com itens do pedido (id_produto, codigo, descricao, quantidade, valor_unitario)';
COMMENT ON COLUMN public.pedidos_tiny_detalhes.parcelas IS 'Array JSONB com parcelas de pagamento (data de recebimento, valor, forma_pagamento)';
COMMENT ON COLUMN public.pedidos_tiny_detalhes.pagamentos_integrados IS 'Array JSONB com pagamentos via intermediador/marketplace (taxas, sem datas)';
COMMENT ON COLUMN public.pedidos_tiny_detalhes.marcadores IS 'Array JSONB com tags/marcadores do pedido';
COMMENT ON COLUMN public.pedidos_tiny_detalhes.ecommerce_nome IS 'Nome do marketplace (Shopee, wBuy, etc.) - usado para mapeamento';

-- Índices
CREATE INDEX IF NOT EXISTS idx_pedidos_detalhes_pedido_tiny_id ON public.pedidos_tiny_detalhes(pedido_tiny_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_detalhes_tenant_id ON public.pedidos_tiny_detalhes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_detalhes_partner_id ON public.pedidos_tiny_detalhes(partner_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_detalhes_ecommerce_nome ON public.pedidos_tiny_detalhes(ecommerce_nome);
CREATE INDEX IF NOT EXISTS idx_pedidos_detalhes_data_faturamento ON public.pedidos_tiny_detalhes(data_faturamento DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_detalhes_data_envio ON public.pedidos_tiny_detalhes(data_envio DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_detalhes_tenant_ecommerce ON public.pedidos_tiny_detalhes(tenant_id, ecommerce_nome);

-- Índices GIN para JSONB (permite queries eficientes nos arrays)
CREATE INDEX IF NOT EXISTS idx_pedidos_detalhes_itens_gin ON public.pedidos_tiny_detalhes USING GIN (itens);
CREATE INDEX IF NOT EXISTS idx_pedidos_detalhes_parcelas_gin ON public.pedidos_tiny_detalhes USING GIN (parcelas);
CREATE INDEX IF NOT EXISTS idx_pedidos_detalhes_pagamentos_gin ON public.pedidos_tiny_detalhes USING GIN (pagamentos_integrados);
CREATE INDEX IF NOT EXISTS idx_pedidos_detalhes_marcadores_gin ON public.pedidos_tiny_detalhes USING GIN (marcadores);

-- Habilitar RLS
ALTER TABLE public.pedidos_tiny_detalhes ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Partners can view own tenant pedidos detalhes" ON public.pedidos_tiny_detalhes;
DROP POLICY IF EXISTS "System can insert pedidos detalhes" ON public.pedidos_tiny_detalhes;
DROP POLICY IF EXISTS "Partners can update own tenant pedidos detalhes" ON public.pedidos_tiny_detalhes;

-- Política: Parceiros podem ver detalhes de pedidos de seus tenants
CREATE POLICY "Partners can view own tenant pedidos detalhes"
    ON public.pedidos_tiny_detalhes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = pedidos_tiny_detalhes.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

-- Política: Sistema pode inserir detalhes (via Service Role/RPC)
CREATE POLICY "System can insert pedidos detalhes"
    ON public.pedidos_tiny_detalhes FOR INSERT
    WITH CHECK (true);

-- Política: Parceiros podem atualizar detalhes de pedidos de seus tenants
CREATE POLICY "Partners can update own tenant pedidos detalhes"
    ON public.pedidos_tiny_detalhes FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = pedidos_tiny_detalhes.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_pedidos_tiny_detalhes_updated_at
    BEFORE UPDATE ON public.pedidos_tiny_detalhes
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
