-- ============================================================================
-- Migration 031: Criar Função RPC para Validar/Buscar Tenant
-- ============================================================================
-- Função para buscar tenant por ID de forma robusta, bypassando problemas
-- de RLS/cache do PostgREST. Usa SECURITY DEFINER para garantir acesso.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Função: Obter tenant por ID
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.get_tenant_by_id(p_tenant_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.name, t.status
    FROM app_core.tenants t
    WHERE t.id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.get_tenant_by_id IS 'Retorna informações do tenant por ID (id, name, status). Usa SECURITY DEFINER para bypass RLS. Retorna vazio se tenant não existir.';

-- ----------------------------------------------------------------------------
-- Permissões (GRANT EXECUTE) para PostgREST/Supabase RPC
-- ----------------------------------------------------------------------------
-- OBS: SECURITY DEFINER não substitui GRANT EXECUTE. Sem isso, PostgREST pode
-- retornar 404/PGRST202 ("não encontrado no schema cache") para roles anon/authenticated.

GRANT EXECUTE ON FUNCTION app_core.get_tenant_by_id(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION app_core.get_tenant_by_id(UUID) TO authenticated;
