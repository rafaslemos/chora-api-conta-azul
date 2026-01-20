-- ============================================================================
-- Função RPC: Atualizar campos de execução em tenant_credentials
-- ============================================================================
-- Esta função atualiza apenas os campos relacionados à execução:
-- - primeira_execucao: indica se é a primeira execução (carga inicial)
-- - data_ultima_execucao: data da última execução bem-sucedida
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_tenant_credential_execution(
    p_tenant_id UUID,
    p_platform TEXT,
    p_primeira_execucao BOOLEAN DEFAULT NULL,
    p_data_ultima_execucao DATE DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.tenant_credentials
    SET 
        primeira_execucao = COALESCE(p_primeira_execucao, primeira_execucao),
        data_ultima_execucao = COALESCE(p_data_ultima_execucao, data_ultima_execucao),
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id 
      AND platform = p_platform;
    
    -- Verificar se algum registro foi atualizado
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Credencial não encontrada para tenant_id: % e platform: %', p_tenant_id, p_platform;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_tenant_credential_execution IS 'Atualiza campos de execução (primeira_execucao e data_ultima_execucao) em tenant_credentials';

