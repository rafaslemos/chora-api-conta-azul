-- ============================================================================
-- Função RPC: Buscar tenants ativos com credenciais Olist
-- ============================================================================
-- Esta função retorna tenants ativos que possuem credenciais Olist ativas
-- e que têm pedidos pendentes para detalhamento (status PENDENTE_DETALHAMENTO)
-- Utilizada pelo fluxo de detalhamento de pedidos para processar tenants em lote
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_tenants_ativos_com_olist()
RETURNS TABLE (
    tenant_id UUID,
    partner_id UUID,
    plan_code TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id as tenant_id,
        t.partner_id,
        COALESCE(tc.config->>'plan', 'COMECAR')::TEXT as plan_code
    FROM public.tenants t
    INNER JOIN public.tenant_credentials tc ON tc.tenant_id = t.id
    WHERE t.status = 'ACTIVE'
      AND tc.platform = 'OLIST'
      AND tc.is_active = true
      AND EXISTS (
          SELECT 1 
          FROM public.pedidos_tiny pt 
          WHERE pt.tenant_id = t.id 
            AND pt.status = 'PENDENTE_DETALHAMENTO'
      )
    ORDER BY t.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_tenants_ativos_com_olist IS 'Retorna tenants ativos com credenciais Olist ativas que possuem pedidos pendentes para detalhamento (status PENDENTE_DETALHAMENTO), ordenados por data de criação. Utilizada pelos fluxos n8n para processamento em lote.';
