-- ============================================================================
-- Migration 025: Criar função RPC para revogar credenciais
-- ============================================================================
-- Esta função centraliza a lógica de revogação de credenciais, garantindo
-- que todas as revogações sejam feitas de forma consistente e com auditoria
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Função: Revogar credencial (marca como revogada e inativa)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.revoke_tenant_credential(
    p_credential_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    platform TEXT,
    credential_name TEXT,
    is_active BOOLEAN,
    revoked_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_result_id UUID;
    v_result_tenant_id UUID;
    v_result_platform TEXT;
    v_result_credential_name TEXT;
    v_result_is_active BOOLEAN;
    v_result_revoked_at TIMESTAMPTZ;
    v_result_updated_at TIMESTAMPTZ;
BEGIN
    -- Verificar se credencial existe
    IF NOT EXISTS (
        SELECT 1 FROM app_core.tenant_credentials WHERE id = p_credential_id
    ) THEN
        RAISE EXCEPTION 'Credencial não encontrada: %', p_credential_id;
    END IF;

    -- Atualizar credencial: marcar como revogada e inativa
    UPDATE app_core.tenant_credentials tc
    SET 
        revoked_at = NOW(),
        is_active = FALSE,
        updated_at = NOW()
    WHERE tc.id = p_credential_id
    RETURNING 
        tc.id,
        tc.tenant_id,
        tc.platform,
        tc.credential_name,
        tc.is_active,
        tc.revoked_at,
        tc.updated_at
    INTO 
        v_result_id,
        v_result_tenant_id,
        v_result_platform,
        v_result_credential_name,
        v_result_is_active,
        v_result_revoked_at,
        v_result_updated_at;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Erro ao revogar credencial: %', p_credential_id;
    END IF;

    -- Atualizar status de conexão na tabela tenants (verificar se há outras credenciais ativas)
    UPDATE app_core.tenants
    SET connections_conta_azul = EXISTS (
        SELECT 1 FROM app_core.tenant_credentials
        WHERE tenant_id = v_result_tenant_id
        AND platform = 'CONTA_AZUL'
        AND is_active = TRUE
        AND revoked_at IS NULL
    )
    WHERE id = v_result_tenant_id;

    -- Criar log de auditoria
    PERFORM app_core.create_audit_log(
        p_tenant_id => v_result_tenant_id,
        p_credential_id => v_result_id,
        p_action => 'CREDENTIAL_REVOKED',
        p_entity_type => 'CREDENTIAL',
        p_entity_id => v_result_id,
        p_status => 'SUCCESS',
        p_details => COALESCE(
            jsonb_build_object('reason', p_reason),
            '{}'::jsonb
        )::TEXT
    );

    -- Retornar resultado
    RETURN QUERY
    SELECT 
        v_result_id,
        v_result_tenant_id,
        v_result_platform,
        v_result_credential_name,
        v_result_is_active,
        v_result_revoked_at,
        v_result_updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.revoke_tenant_credential IS 'Revoga uma credencial, marcando-a como revogada (revoked_at) e inativa (is_active = FALSE). Atualiza status de conexão do tenant e cria log de auditoria.';
