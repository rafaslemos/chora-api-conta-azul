-- ============================================================================
-- Migration 024: Criar Funções RPC para Configurações Globais
-- ============================================================================
-- Funções para ler e escrever configurações globais com criptografia automática
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Função: Obter configuração (com descriptografia automática)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.get_app_config(p_key TEXT)
RETURNS TEXT AS $$
DECLARE
    v_encryption_key TEXT;
    v_config_value TEXT;
    v_is_encrypted BOOLEAN;
BEGIN
    -- Buscar configuração
    SELECT value, is_encrypted INTO v_config_value, v_is_encrypted
    FROM app_core.app_config
    WHERE key = p_key;

    -- Se não encontrou, retornar NULL
    IF v_config_value IS NULL THEN
        RETURN NULL;
    END IF;

    -- Se não está criptografado, retornar direto
    IF NOT v_is_encrypted THEN
        RETURN v_config_value;
    END IF;

    -- Se está criptografado, tentar descriptografar
    BEGIN
        v_encryption_key := app_core.get_encryption_key();
        RETURN app_core.decrypt_token(v_config_value, v_encryption_key);
    EXCEPTION
        WHEN OTHERS THEN
            -- Se falhar a descriptografia (valor não está realmente criptografado),
            -- retornar o valor original como fallback
            -- Isso permite que dados antigos (não criptografados) ainda funcionem
            RAISE WARNING 'Erro ao descriptografar %: %. Retornando valor original como fallback.', p_key, SQLERRM;
            RETURN v_config_value;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.get_app_config IS 'Retorna uma configuração do sistema, descriptografando automaticamente se is_encrypted = true. Usa SECURITY DEFINER para bypass RLS quando necessário (ex: Edge Functions com Service Role).';

-- ----------------------------------------------------------------------------
-- Função: Salvar/Atualizar configuração (com criptografia automática)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.set_app_config(
    p_key TEXT,
    p_value TEXT,
    p_description TEXT DEFAULT NULL,
    p_is_encrypted BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    v_encryption_key TEXT;
    v_encrypted_value TEXT;
    v_final_value TEXT;
    v_user_id UUID;
BEGIN
    -- Verificar se usuário é ADMIN ou se é Service Role (para setup)
    v_user_id := auth.uid();
    
    -- Se não tem user_id (Service Role) ou é ADMIN, permitir
    IF v_user_id IS NULL THEN
        -- Service Role (setup-database) - permitir
        v_user_id := NULL;
    ELSIF NOT EXISTS (
        SELECT 1 FROM app_core.profiles
        WHERE id = v_user_id AND role = 'ADMIN'
    ) THEN
        -- Não é ADMIN e não é Service Role - negar
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Apenas administradores ou sistema podem modificar configurações'
        );
    END IF;
    
    -- Obter chave de criptografia
    v_encryption_key := app_core.get_encryption_key();
    
    -- Criptografar valor se necessário
    IF p_is_encrypted THEN
        v_encrypted_value := app_core.encrypt_token(p_value, v_encryption_key);
        v_final_value := v_encrypted_value;
    ELSE
        v_final_value := p_value;
    END IF;
    
    -- Inserir ou atualizar
    INSERT INTO app_core.app_config (key, value, description, is_encrypted, updated_by)
    VALUES (p_key, v_final_value, p_description, p_is_encrypted, v_user_id)
    ON CONFLICT (key) 
    DO UPDATE SET
        value = v_final_value,
        description = COALESCE(p_description, app_core.app_config.description),
        is_encrypted = p_is_encrypted,
        updated_by = v_user_id,
        updated_at = NOW();
    
    RETURN jsonb_build_object(
        'success', true,
        'key', p_key,
        'message', 'Configuração salva com sucesso'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.set_app_config IS 'Salva ou atualiza uma configuração do sistema, criptografando automaticamente se is_encrypted = true. Permite Service Role (para setup) ou ADMIN. Usa SECURITY DEFINER para bypass RLS.';

-- ----------------------------------------------------------------------------
-- Função: Obter Client ID da Conta Azul (público, sem criptografia)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.get_conta_azul_client_id()
RETURNS TEXT AS $$
BEGIN
    -- Buscar Client ID (não criptografado, pode ser público)
    RETURN app_core.get_app_config('conta_azul_client_id');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.get_conta_azul_client_id IS 'Retorna o Client ID da Conta Azul (público, não criptografado). Acessível por authenticated e anon. Usa SECURITY DEFINER para garantir acesso mesmo sem autenticação.';

-- ----------------------------------------------------------------------------
-- Função: Obter Client Secret da Conta Azul (criptografado, apenas Service Role/ADMIN)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.get_conta_azul_client_secret()
RETURNS TEXT AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Verificar se é Service Role (v_user_id será NULL) ou ADMIN
    v_user_id := auth.uid();
    
    -- Se não tem user_id (Service Role) ou é ADMIN, permitir
    IF v_user_id IS NULL THEN
        -- Service Role - permitir
    ELSIF NOT EXISTS (
        SELECT 1 FROM app_core.profiles
        WHERE id = v_user_id AND role = 'ADMIN'
    ) THEN
        -- Não é ADMIN e não é Service Role - negar
        RETURN NULL;
    END IF;
    
    -- Buscar Client Secret (criptografado)
    RETURN app_core.get_app_config('conta_azul_client_secret');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.get_conta_azul_client_secret IS 'Retorna o Client Secret da Conta Azul (criptografado, descriptografado automaticamente). Apenas Service Role ou ADMIN podem acessar. Usa SECURITY DEFINER para bypass RLS.';

-- ----------------------------------------------------------------------------
-- Permissões (GRANT EXECUTE) para PostgREST/Supabase RPC
-- ----------------------------------------------------------------------------
-- OBS: SECURITY DEFINER não substitui GRANT EXECUTE. Sem isso, PostgREST pode
-- retornar 404/PGRST202 (“não encontrado no schema cache”) para roles anon/authenticated.

-- Client ID: pode ser público
GRANT EXECUTE ON FUNCTION app_core.get_conta_azul_client_id() TO anon;
GRANT EXECUTE ON FUNCTION app_core.get_conta_azul_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION app_core.get_conta_azul_client_id() TO service_role;

-- Client Secret: permitir chamada, mas a função retorna NULL se não for ADMIN/Service Role
GRANT EXECUTE ON FUNCTION app_core.get_conta_azul_client_secret() TO authenticated;
GRANT EXECUTE ON FUNCTION app_core.get_conta_azul_client_secret() TO service_role;

-- Base config helpers (útil para ADMIN/Service Role)
GRANT EXECUTE ON FUNCTION app_core.get_app_config(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION app_core.get_app_config(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION app_core.set_app_config(TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION app_core.set_app_config(TEXT, TEXT, TEXT, BOOLEAN) TO service_role;
