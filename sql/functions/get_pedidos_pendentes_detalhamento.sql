-- ============================================================================
-- Função RPC: Buscar pedidos pendentes de detalhamento
-- ============================================================================
-- Esta função retorna pedidos com status PENDENTE_DETALHAMENTO para um tenant
-- com suporte a paginação
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_pedidos_pendentes_detalhamento(
    p_tenant_id UUID,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    partner_id UUID,
    id_pedido_tiny TEXT,
    numero TEXT,
    data_pedido DATE,
    status_pedido_tiny TEXT,
    valor_total DECIMAL,
    status TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pt.id,
        pt.tenant_id,
        pt.partner_id,
        pt.id_pedido_tiny,
        pt.numero,
        pt.data_pedido,
        pt.status_pedido_tiny,
        pt.valor_total,
        pt.status,
        pt.created_at
    FROM public.pedidos_tiny pt
    WHERE pt.tenant_id = p_tenant_id
      AND pt.status = 'PENDENTE_DETALHAMENTO'
    ORDER BY pt.data_pedido DESC NULLS LAST, pt.created_at ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_pedidos_pendentes_detalhamento IS 'Retorna pedidos pendentes de detalhamento para um tenant, ordenados por data_pedido DESC e created_at ASC, com paginação';
