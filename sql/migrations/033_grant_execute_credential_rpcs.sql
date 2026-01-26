-- ============================================================================
-- Migration 033: GRANT EXECUTE nas RPCs de credenciais (app_core)
-- ============================================================================
-- Sem GRANT EXECUTE, o PostgREST não expõe as funções no schema cache e
-- retorna 404/PGRST202. SECURITY DEFINER não substitui GRANT EXECUTE.
-- ============================================================================

GRANT EXECUTE ON FUNCTION app_core.create_tenant_credential(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION app_core.create_tenant_credential(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB, INTEGER) TO service_role;

GRANT EXECUTE ON FUNCTION app_core.update_tenant_credential(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION app_core.update_tenant_credential(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, JSONB, INTEGER) TO service_role;

GRANT EXECUTE ON FUNCTION app_core.get_tenant_credential_decrypted(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION app_core.get_tenant_credential_decrypted(UUID) TO service_role;
