-- ============================================================================
-- Migration 004: Criar Funções RPC
-- ============================================================================
-- Funções para gerenciar credenciais com criptografia e múltiplas credenciais
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Função: Obter chave de criptografia
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.get_encryption_key()
RETURNS TEXT AS $$
BEGIN
    -- Em produção, buscar do Supabase Vault:
    -- RETURN current_setting('app.settings.encryption_key', true);
    -- Por enquanto, usar chave padrão (DEVE SER ALTERADA EM PRODUÇÃO)
    RETURN COALESCE(
        current_setting('app.settings.encryption_key', true),
        'default_key_change_in_production'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.get_encryption_key() IS 'Retorna a chave de criptografia (deve vir do Supabase Vault em produção)';

-- ----------------------------------------------------------------------------
-- Função: Criptografar token
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.encrypt_token(p_token TEXT, p_key TEXT)
RETURNS TEXT AS $$
BEGIN
    IF p_token IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN encode(encrypt(p_token::bytea, p_key::bytea, 'aes'), 'base64');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION app_core.encrypt_token IS 'Criptografa um token usando AES com a chave fornecida';

-- ----------------------------------------------------------------------------
-- Função: Descriptografar token
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.decrypt_token(p_encrypted_token TEXT, p_key TEXT)
RETURNS TEXT AS $$
BEGIN
    IF p_encrypted_token IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN convert_from(decrypt(decode(p_encrypted_token, 'base64'), p_key::bytea, 'aes'), 'UTF8');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION app_core.decrypt_token IS 'Descriptografa um token usando AES com a chave fornecida';

-- ----------------------------------------------------------------------------
-- Função: Criar credencial com criptografia automática
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.create_tenant_credential(
    p_tenant_id UUID,
    p_platform TEXT,
    p_credential_name TEXT,
    p_access_token TEXT,
    p_refresh_token TEXT DEFAULT NULL,
    p_api_key TEXT DEFAULT NULL,
    p_api_secret TEXT DEFAULT NULL,
    p_webhook_url TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_config JSONB DEFAULT '{}'::jsonb,
    p_expires_in INTEGER DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    platform TEXT,
    credential_name TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_encryption_key TEXT;
    v_encrypted_access_token TEXT;
    v_encrypted_refresh_token TEXT;
    v_encrypted_api_key TEXT;
    v_encrypted_api_secret TEXT;
    v_token_expires_at TIMESTAMPTZ;
    v_result_id UUID;
    v_result_tenant_id UUID;
    v_result_platform TEXT;
    v_result_credential_name TEXT;
    v_result_is_active BOOLEAN;
    v_result_created_at TIMESTAMPTZ;
    v_result_updated_at TIMESTAMPTZ;
BEGIN
    -- Validar que platform é CONTA_AZUL
    IF p_platform != 'CONTA_AZUL' THEN
        RAISE EXCEPTION 'Apenas plataforma CONTA_AZUL é suportada';
    END IF;

    -- Validar que credential_name foi fornecido
    IF p_credential_name IS NULL OR TRIM(p_credential_name) = '' THEN
        RAISE EXCEPTION 'credential_name é obrigatório';
    END IF;

    -- Obter chave de criptografia
    v_encryption_key := app_core.get_encryption_key();
    
    -- Criptografar tokens
    IF p_access_token IS NOT NULL THEN
        v_encrypted_access_token := app_core.encrypt_token(p_access_token, v_encryption_key);
    END IF;
    
    IF p_refresh_token IS NOT NULL THEN
        v_encrypted_refresh_token := app_core.encrypt_token(p_refresh_token, v_encryption_key);
    END IF;
    
    IF p_api_key IS NOT NULL THEN
        v_encrypted_api_key := app_core.encrypt_token(p_api_key, v_encryption_key);
    END IF;
    
    IF p_api_secret IS NOT NULL THEN
        v_encrypted_api_secret := app_core.encrypt_token(p_api_secret, v_encryption_key);
    END IF;
    
    -- Calcular token_expires_at
    IF p_expires_in IS NOT NULL THEN
        v_token_expires_at := NOW() + (p_expires_in * INTERVAL '1 second');
    ELSIF p_config IS NOT NULL AND p_config ? 'expires_in' THEN
        v_token_expires_at := NOW() + ((p_config->>'expires_in')::INTEGER * INTERVAL '1 second');
    ELSIF p_config IS NOT NULL AND p_config ? 'expires_at' THEN
        v_token_expires_at := (p_config->>'expires_at')::TIMESTAMPTZ;
    ELSE
        v_token_expires_at := NULL;
    END IF;
    
    -- Inserir credencial com tokens criptografados
    INSERT INTO app_core.tenant_credentials (
        tenant_id,
        platform,
        credential_name,
        access_token,
        refresh_token,
        api_key,
        api_secret,
        webhook_url,
        is_active,
        config,
        token_expires_at,
        last_authenticated_at
    ) VALUES (
        p_tenant_id,
        p_platform,
        p_credential_name,
        v_encrypted_access_token,
        v_encrypted_refresh_token,
        v_encrypted_api_key,
        v_encrypted_api_secret,
        p_webhook_url,
        p_is_active,
        p_config,
        v_token_expires_at,
        NOW()
    )
    RETURNING 
        id,
        tenant_id,
        platform,
        credential_name,
        is_active,
        created_at,
        updated_at
    INTO 
        v_result_id,
        v_result_tenant_id,
        v_result_platform,
        v_result_credential_name,
        v_result_is_active,
        v_result_created_at,
        v_result_updated_at;
    
    -- Atualizar status de conexão na tabela tenants
    UPDATE app_core.tenants
    SET connections_conta_azul = p_is_active
    WHERE id = p_tenant_id;
    
    -- Retornar resultado
    RETURN QUERY
    SELECT 
        v_result_id,
        v_result_tenant_id,
        v_result_platform,
        v_result_credential_name,
        v_result_is_active,
        v_result_created_at,
        v_result_updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.create_tenant_credential IS 'Cria credencial com criptografia automática dos tokens e suporte a múltiplas credenciais';

-- ----------------------------------------------------------------------------
-- Função: Atualizar credencial com criptografia automática
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.update_tenant_credential(
    p_credential_id UUID,
    p_access_token TEXT DEFAULT NULL,
    p_refresh_token TEXT DEFAULT NULL,
    p_api_key TEXT DEFAULT NULL,
    p_api_secret TEXT DEFAULT NULL,
    p_webhook_url TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL,
    p_config JSONB DEFAULT NULL,
    p_expires_in INTEGER DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    platform TEXT,
    credential_name TEXT,
    is_active BOOLEAN,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_encryption_key TEXT;
    v_encrypted_access_token TEXT;
    v_encrypted_refresh_token TEXT;
    v_encrypted_api_key TEXT;
    v_encrypted_api_secret TEXT;
    v_token_expires_at TIMESTAMPTZ;
    v_result_id UUID;
    v_result_tenant_id UUID;
    v_result_platform TEXT;
    v_result_credential_name TEXT;
    v_result_is_active BOOLEAN;
    v_result_updated_at TIMESTAMPTZ;
BEGIN
    -- Obter chave de criptografia
    v_encryption_key := app_core.get_encryption_key();
    
    -- Criptografar tokens apenas se fornecidos
    IF p_access_token IS NOT NULL THEN
        v_encrypted_access_token := app_core.encrypt_token(p_access_token, v_encryption_key);
    END IF;
    
    IF p_refresh_token IS NOT NULL THEN
        v_encrypted_refresh_token := app_core.encrypt_token(p_refresh_token, v_encryption_key);
    END IF;
    
    IF p_api_key IS NOT NULL THEN
        v_encrypted_api_key := app_core.encrypt_token(p_api_key, v_encryption_key);
    END IF;
    
    IF p_api_secret IS NOT NULL THEN
        v_encrypted_api_secret := app_core.encrypt_token(p_api_secret, v_encryption_key);
    END IF;
    
    -- Calcular token_expires_at
    IF p_expires_in IS NOT NULL THEN
        v_token_expires_at := NOW() + (p_expires_in * INTERVAL '1 second');
    ELSIF p_config IS NOT NULL AND p_config ? 'expires_in' THEN
        v_token_expires_at := NOW() + ((p_config->>'expires_in')::INTEGER * INTERVAL '1 second');
    ELSIF p_config IS NOT NULL AND p_config ? 'expires_at' THEN
        v_token_expires_at := (p_config->>'expires_at')::TIMESTAMPTZ;
    ELSE
        v_token_expires_at := NULL;
    END IF;
    
    -- Atualizar credencial
    -- Se p_is_active = TRUE e p_access_token foi fornecido, limpar revoked_at (reautenticação)
    UPDATE app_core.tenant_credentials tc
    SET 
        access_token = COALESCE(v_encrypted_access_token, tc.access_token),
        refresh_token = COALESCE(v_encrypted_refresh_token, tc.refresh_token),
        api_key = COALESCE(v_encrypted_api_key, tc.api_key),
        api_secret = COALESCE(v_encrypted_api_secret, tc.api_secret),
        webhook_url = COALESCE(p_webhook_url, tc.webhook_url),
        is_active = COALESCE(p_is_active, tc.is_active),
        config = COALESCE(p_config, tc.config),
        token_expires_at = COALESCE(v_token_expires_at, tc.token_expires_at),
        last_authenticated_at = CASE WHEN p_access_token IS NOT NULL THEN NOW() ELSE tc.last_authenticated_at END,
        revoked_at = CASE 
            WHEN p_is_active = TRUE AND p_access_token IS NOT NULL THEN NULL 
            ELSE tc.revoked_at 
        END,
        updated_at = NOW()
    WHERE tc.id = p_credential_id
    RETURNING 
        tc.id,
        tc.tenant_id,
        tc.platform,
        tc.credential_name,
        tc.is_active,
        tc.updated_at
    INTO 
        v_result_id,
        v_result_tenant_id,
        v_result_platform,
        v_result_credential_name,
        v_result_is_active,
        v_result_updated_at;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Credencial não encontrada: %', p_credential_id;
    END IF;
    
    -- Atualizar status de conexão na tabela tenants
    IF p_is_active IS NOT NULL THEN
        UPDATE app_core.tenants
        SET connections_conta_azul = p_is_active
        WHERE id = v_result_tenant_id;
    END IF;
    
    -- Retornar resultado
    RETURN QUERY
    SELECT 
        v_result_id,
        v_result_tenant_id,
        v_result_platform,
        v_result_credential_name,
        v_result_is_active,
        v_result_updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.update_tenant_credential IS 'Atualiza credencial com criptografia automática dos tokens';

-- ----------------------------------------------------------------------------
-- Função: Obter credencial descriptografada (apenas quando necessário)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.get_tenant_credential_decrypted(
    p_credential_id UUID
)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    platform TEXT,
    credential_name TEXT,
    access_token TEXT,
    refresh_token TEXT,
    api_key TEXT,
    api_secret TEXT,
    webhook_url TEXT,
    is_active BOOLEAN,
    last_sync_at TIMESTAMPTZ,
    token_expires_at TIMESTAMPTZ,
    config JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_encryption_key TEXT;
BEGIN
    -- Verificar se o usuário tem permissão para acessar esta credencial
    IF auth.uid() IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM app_core.tenants t
            INNER JOIN app_core.tenant_credentials tc ON tc.tenant_id = t.id
            WHERE tc.id = p_credential_id 
            AND (t.partner_id = auth.uid() OR app_core.is_admin(auth.uid()))
        ) THEN
            RAISE EXCEPTION 'Acesso negado';
        END IF;
    END IF;
    
    -- Obter chave de criptografia
    v_encryption_key := app_core.get_encryption_key();
    
    -- Retornar credencial com tokens descriptografados
    RETURN QUERY
    SELECT 
        tc.id,
        tc.tenant_id,
        tc.platform,
        tc.credential_name,
        CASE WHEN tc.access_token IS NOT NULL 
            THEN app_core.decrypt_token(tc.access_token, v_encryption_key)
            ELSE NULL 
        END as access_token,
        CASE WHEN tc.refresh_token IS NOT NULL 
            THEN app_core.decrypt_token(tc.refresh_token, v_encryption_key)
            ELSE NULL 
        END as refresh_token,
        CASE WHEN tc.api_key IS NOT NULL 
            THEN app_core.decrypt_token(tc.api_key, v_encryption_key)
            ELSE NULL 
        END as api_key,
        CASE WHEN tc.api_secret IS NOT NULL 
            THEN app_core.decrypt_token(tc.api_secret, v_encryption_key)
            ELSE NULL 
        END as api_secret,
        tc.webhook_url,
        tc.is_active,
        tc.last_sync_at,
        tc.token_expires_at,
        tc.config,
        tc.created_at,
        tc.updated_at
    FROM app_core.tenant_credentials tc
    WHERE tc.id = p_credential_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.get_tenant_credential_decrypted IS 'Retorna credencial com tokens descriptografados (usar apenas quando necessário para fazer requisições)';

-- ----------------------------------------------------------------------------
-- Função: Criar log de auditoria
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.create_audit_log(
    p_tenant_id UUID DEFAULT NULL,
    p_credential_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_action TEXT,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT 'SUCCESS',
    p_details TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO app_core.audit_logs (
        tenant_id,
        credential_id,
        user_id,
        action,
        entity_type,
        entity_id,
        status,
        details,
        ip_address,
        user_agent
    ) VALUES (
        p_tenant_id,
        p_credential_id,
        COALESCE(p_user_id, auth.uid()),
        p_action,
        p_entity_type,
        p_entity_id,
        p_status,
        p_details,
        p_ip_address,
        p_user_agent
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.create_audit_log IS 'Cria um log de auditoria de forma padronizada';
