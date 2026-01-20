-- ============================================================================
-- Funções RPC para gerenciar credenciais com criptografia automática
-- ============================================================================
-- Estas funções garantem que todos os tokens sejam criptografados antes
-- de serem salvos no banco de dados
-- ============================================================================

-- Obter chave de criptografia (em produção, usar Supabase Vault)
-- Por enquanto, usando variável de ambiente ou chave padrão
CREATE OR REPLACE FUNCTION public.get_encryption_key()
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

COMMENT ON FUNCTION public.get_encryption_key() IS 'Retorna a chave de criptografia (deve vir do Supabase Vault em produção)';

-- ----------------------------------------------------------------------------
-- Função: Criar credencial com criptografia automática
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_tenant_credential(
    p_tenant_id UUID,
    p_platform TEXT,
    p_access_token TEXT,
    p_refresh_token TEXT DEFAULT NULL,
    p_api_key TEXT DEFAULT NULL,
    p_api_secret TEXT DEFAULT NULL,
    p_webhook_url TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_config JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    platform TEXT,
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
    v_result_is_active BOOLEAN;
    v_result_created_at TIMESTAMPTZ;
    v_result_updated_at TIMESTAMPTZ;
BEGIN
    -- Obter chave de criptografia
    v_encryption_key := public.get_encryption_key();
    
    -- Criptografar tokens
    IF p_access_token IS NOT NULL THEN
        v_encrypted_access_token := public.encrypt_token(p_access_token, v_encryption_key);
    END IF;
    
    IF p_refresh_token IS NOT NULL THEN
        v_encrypted_refresh_token := public.encrypt_token(p_refresh_token, v_encryption_key);
    END IF;
    
    IF p_api_key IS NOT NULL THEN
        v_encrypted_api_key := public.encrypt_token(p_api_key, v_encryption_key);
    END IF;
    
    IF p_api_secret IS NOT NULL THEN
        v_encrypted_api_secret := public.encrypt_token(p_api_secret, v_encryption_key);
    END IF;
    
    -- Calcular token_expires_at se expires_in estiver no config
    IF p_config IS NOT NULL AND p_config ? 'expires_in' THEN
        v_token_expires_at := NOW() + (p_config->>'expires_in')::INTEGER * INTERVAL '1 second';
    ELSIF p_config IS NOT NULL AND p_config ? 'expires_at' THEN
        -- Se já tiver expires_at no config, usar ele
        v_token_expires_at := (p_config->>'expires_at')::TIMESTAMPTZ;
    ELSE
        v_token_expires_at := NULL;
    END IF;
    
    -- Inserir credencial com tokens criptografados
    INSERT INTO public.tenant_credentials (
        tenant_id,
        platform,
        access_token,
        refresh_token,
        api_key,
        api_secret,
        webhook_url,
        is_active,
        config,
        token_expires_at
    ) VALUES (
        p_tenant_id,
        p_platform,
        v_encrypted_access_token,
        v_encrypted_refresh_token,
        v_encrypted_api_key,
        v_encrypted_api_secret,
        p_webhook_url,
        p_is_active,
        p_config,
        v_token_expires_at
    )
    RETURNING 
        public.tenant_credentials.id,
        public.tenant_credentials.tenant_id,
        public.tenant_credentials.platform,
        public.tenant_credentials.is_active,
        public.tenant_credentials.created_at,
        public.tenant_credentials.updated_at
    INTO 
        v_result_id,
        v_result_tenant_id,
        v_result_platform,
        v_result_is_active,
        v_result_created_at,
        v_result_updated_at;
    
    -- Atualizar status de conexão na tabela tenants baseado no is_active
    IF p_platform = 'OLIST' THEN
        UPDATE public.tenants
        SET connections_olist = p_is_active
        WHERE public.tenants.id = p_tenant_id;
    END IF;
    
    IF p_platform = 'CONTA_AZUL' THEN
        UPDATE public.tenants
        SET connections_conta_azul = p_is_active
        WHERE public.tenants.id = p_tenant_id;
    END IF;
    
    -- Retornar resultado usando RETURN QUERY para evitar ambiguidade
    RETURN QUERY
    SELECT 
        v_result_id,
        v_result_tenant_id,
        v_result_platform,
        v_result_is_active,
        v_result_created_at,
        v_result_updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_tenant_credential IS 'Cria credencial com criptografia automática dos tokens';

-- ----------------------------------------------------------------------------
-- Função: Atualizar credencial com criptografia automática
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_tenant_credential(
    p_tenant_id UUID,
    p_platform TEXT,
    p_access_token TEXT DEFAULT NULL,
    p_refresh_token TEXT DEFAULT NULL,
    p_api_key TEXT DEFAULT NULL,
    p_api_secret TEXT DEFAULT NULL,
    p_webhook_url TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL,
    p_config JSONB DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    platform TEXT,
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
    v_result_is_active BOOLEAN;
    v_result_updated_at TIMESTAMPTZ;
BEGIN
    -- Obter chave de criptografia
    v_encryption_key := public.get_encryption_key();
    
    -- Criptografar tokens apenas se fornecidos
    IF p_access_token IS NOT NULL THEN
        v_encrypted_access_token := public.encrypt_token(p_access_token, v_encryption_key);
    END IF;
    
    IF p_refresh_token IS NOT NULL THEN
        v_encrypted_refresh_token := public.encrypt_token(p_refresh_token, v_encryption_key);
    END IF;
    
    IF p_api_key IS NOT NULL THEN
        v_encrypted_api_key := public.encrypt_token(p_api_key, v_encryption_key);
    END IF;
    
    IF p_api_secret IS NOT NULL THEN
        v_encrypted_api_secret := public.encrypt_token(p_api_secret, v_encryption_key);
    END IF;
    
    -- Calcular token_expires_at se expires_in estiver no config
    IF p_config IS NOT NULL AND p_config ? 'expires_in' THEN
        v_token_expires_at := NOW() + (p_config->>'expires_in')::INTEGER * INTERVAL '1 second';
    ELSIF p_config IS NOT NULL AND p_config ? 'expires_at' THEN
        -- Se já tiver expires_at no config, usar ele
        v_token_expires_at := (p_config->>'expires_at')::TIMESTAMPTZ;
    ELSE
        -- Se não forneceu novo config, manter o existente ou NULL
        v_token_expires_at := NULL;
    END IF;
    
    -- Atualizar credencial (usar alias para evitar ambiguidade)
    UPDATE public.tenant_credentials tc
    SET 
        access_token = COALESCE(v_encrypted_access_token, tc.access_token),
        refresh_token = COALESCE(v_encrypted_refresh_token, tc.refresh_token),
        api_key = COALESCE(v_encrypted_api_key, tc.api_key),
        api_secret = COALESCE(v_encrypted_api_secret, tc.api_secret),
        webhook_url = COALESCE(p_webhook_url, tc.webhook_url),
        is_active = COALESCE(p_is_active, tc.is_active),
        config = COALESCE(p_config, tc.config),
        token_expires_at = COALESCE(v_token_expires_at, tc.token_expires_at),
        updated_at = NOW()
    WHERE tc.tenant_id = p_tenant_id AND tc.platform = p_platform
    RETURNING 
        tc.id,
        tc.tenant_id,
        tc.platform,
        tc.is_active,
        tc.updated_at
    INTO 
        v_result_id,
        v_result_tenant_id,
        v_result_platform,
        v_result_is_active,
        v_result_updated_at;
    
    -- Atualizar status de conexão na tabela tenants baseado no is_active da credencial atualizada
    IF p_platform = 'OLIST' THEN
        UPDATE public.tenants
        SET connections_olist = v_result_is_active
        WHERE public.tenants.id = p_tenant_id;
    END IF;
    
    IF p_platform = 'CONTA_AZUL' THEN
        UPDATE public.tenants
        SET connections_conta_azul = v_result_is_active
        WHERE public.tenants.id = p_tenant_id;
    END IF;
    
    -- Retornar resultado usando RETURN QUERY para evitar ambiguidade
    RETURN QUERY
    SELECT 
        v_result_id,
        v_result_tenant_id,
        v_result_platform,
        v_result_is_active,
        v_result_updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.update_tenant_credential IS 'Atualiza credencial com criptografia automática dos tokens e atualiza status de conexão na tabela tenants';

-- ----------------------------------------------------------------------------
-- Função: Obter credencial descriptografada (apenas quando necessário)
-- ----------------------------------------------------------------------------
-- Remover função existente se houver (necessário quando a assinatura muda)
DROP FUNCTION IF EXISTS public.get_tenant_credential_decrypted(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.get_tenant_credential_decrypted(
    p_tenant_id UUID,
    p_platform TEXT
)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    platform TEXT,
    access_token TEXT,
    refresh_token TEXT,
    api_key TEXT,
    api_secret TEXT,
    webhook_url TEXT,
    is_active BOOLEAN,
    last_sync_at TIMESTAMPTZ,
    primeira_execucao BOOLEAN,
    data_ultima_execucao DATE,
    config JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_encryption_key TEXT;
BEGIN
    -- Verificar se o usuário tem permissão para acessar esta credencial
    -- Se auth.uid() é NULL, significa que está sendo chamado via Service Role Key (Edge Function)
    -- Nesse caso, permitir acesso direto (Service Role Key já bypassa RLS)
    IF auth.uid() IS NOT NULL THEN
        -- Verificação de permissão para usuários autenticados
        IF NOT EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = p_tenant_id 
            AND (t.partner_id = auth.uid() OR public.is_admin(auth.uid()))
        ) THEN
            RAISE EXCEPTION 'Acesso negado';
        END IF;
    END IF;
    -- Se auth.uid() é NULL (Service Role Key), não verificar permissões (bypass RLS)
    
    -- Obter chave de criptografia
    v_encryption_key := public.get_encryption_key();
    
    -- Retornar credencial com tokens descriptografados
    RETURN QUERY
    SELECT 
        tc.id,
        tc.tenant_id,
        tc.platform,
        CASE WHEN tc.access_token IS NOT NULL 
            THEN public.decrypt_token(tc.access_token, v_encryption_key)
            ELSE NULL 
        END as access_token,
        CASE WHEN tc.refresh_token IS NOT NULL 
            THEN public.decrypt_token(tc.refresh_token, v_encryption_key)
            ELSE NULL 
        END as refresh_token,
        CASE WHEN tc.api_key IS NOT NULL 
            THEN public.decrypt_token(tc.api_key, v_encryption_key)
            ELSE NULL 
        END as api_key,
        CASE WHEN tc.api_secret IS NOT NULL 
            THEN public.decrypt_token(tc.api_secret, v_encryption_key)
            ELSE NULL 
        END as api_secret,
        tc.webhook_url,
        tc.is_active,
        tc.last_sync_at,
        tc.primeira_execucao,
        tc.data_ultima_execucao,
        tc.config,
        tc.created_at,
        tc.updated_at
    FROM public.tenant_credentials tc
    WHERE tc.tenant_id = p_tenant_id 
      AND tc.platform = p_platform;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_tenant_credential_decrypted IS 'Retorna credencial com tokens descriptografados (usar apenas quando necessário para fazer requisições)';

