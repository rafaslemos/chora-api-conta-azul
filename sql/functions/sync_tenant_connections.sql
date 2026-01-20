-- ============================================================================
-- Função: Sincronizar status de conexões na tabela tenants
-- ============================================================================
-- Esta função sincroniza os campos connections_olist e connections_conta_azul
-- na tabela tenants com base nas credenciais ativas em tenant_credentials
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_tenant_connections()
RETURNS TABLE (
    tenant_id UUID,
    connections_olist BOOLEAN,
    connections_conta_azul BOOLEAN,
    updated_count INTEGER
) AS $$
DECLARE
    v_updated_count INTEGER := 0;
BEGIN
    -- Atualizar connections_olist para todos os tenants
    UPDATE public.tenants t
    SET connections_olist = COALESCE(
        (SELECT is_active FROM public.tenant_credentials tc 
         WHERE tc.tenant_id = t.id 
           AND tc.platform = 'OLIST' 
           AND tc.is_active = TRUE
         LIMIT 1),
        FALSE
    )
    WHERE EXISTS (
        SELECT 1 FROM public.tenant_credentials tc
        WHERE tc.tenant_id = t.id AND tc.platform = 'OLIST'
    ) OR t.connections_olist = TRUE;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    -- Atualizar connections_conta_azul para todos os tenants
    UPDATE public.tenants t
    SET connections_conta_azul = COALESCE(
        (SELECT is_active FROM public.tenant_credentials tc 
         WHERE tc.tenant_id = t.id 
           AND tc.platform = 'CONTA_AZUL' 
           AND tc.is_active = TRUE
         LIMIT 1),
        FALSE
    )
    WHERE EXISTS (
        SELECT 1 FROM public.tenant_credentials tc
        WHERE tc.tenant_id = t.id AND tc.platform = 'CONTA_AZUL'
    ) OR t.connections_conta_azul = TRUE;
    
    -- Retornar resultado
    RETURN QUERY
    SELECT 
        t.id,
        t.connections_olist,
        t.connections_conta_azul,
        v_updated_count
    FROM public.tenants t
    WHERE EXISTS (
        SELECT 1 FROM public.tenant_credentials tc
        WHERE tc.tenant_id = t.id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.sync_tenant_connections() IS 'Sincroniza os campos connections_olist e connections_conta_azul na tabela tenants com base nas credenciais ativas';

