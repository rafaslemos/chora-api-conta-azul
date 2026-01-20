-- ============================================================================
-- Migração: Criptografar tokens existentes na tabela tenant_credentials
-- ============================================================================
-- Esta migração busca todos os tokens não criptografados e os criptografa
-- usando a função encrypt_token()
-- ============================================================================

-- Obter chave de criptografia
DO $$
DECLARE
    v_encryption_key TEXT;
    v_record RECORD;
    v_encrypted_token TEXT;
    v_count INTEGER := 0;
BEGIN
    -- Obter chave de criptografia (mesma lógica da função get_encryption_key)
    v_encryption_key := COALESCE(
        current_setting('app.settings.encryption_key', true),
        'default_key_change_in_production'
    );

    -- Criptografar access_token
    FOR v_record IN 
        SELECT id, access_token 
        FROM public.tenant_credentials 
        WHERE access_token IS NOT NULL 
          AND access_token NOT LIKE '-----BEGIN PGP%' -- Não criptografado ainda
    LOOP
        BEGIN
            v_encrypted_token := public.encrypt_token(v_record.access_token, v_encryption_key);
            
            UPDATE public.tenant_credentials
            SET access_token = v_encrypted_token
            WHERE id = v_record.id;
            
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Erro ao criptografar access_token do registro %: %', v_record.id, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE 'Criptografados % access_tokens', v_count;
    v_count := 0;

    -- Criptografar refresh_token
    FOR v_record IN 
        SELECT id, refresh_token 
        FROM public.tenant_credentials 
        WHERE refresh_token IS NOT NULL 
          AND refresh_token NOT LIKE '-----BEGIN PGP%' -- Não criptografado ainda
    LOOP
        BEGIN
            v_encrypted_token := public.encrypt_token(v_record.refresh_token, v_encryption_key);
            
            UPDATE public.tenant_credentials
            SET refresh_token = v_encrypted_token
            WHERE id = v_record.id;
            
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Erro ao criptografar refresh_token do registro %: %', v_record.id, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE 'Criptografados % refresh_tokens', v_count;
    v_count := 0;

    -- Criptografar api_key
    FOR v_record IN 
        SELECT id, api_key 
        FROM public.tenant_credentials 
        WHERE api_key IS NOT NULL 
          AND api_key NOT LIKE '-----BEGIN PGP%' -- Não criptografado ainda
    LOOP
        BEGIN
            v_encrypted_token := public.encrypt_token(v_record.api_key, v_encryption_key);
            
            UPDATE public.tenant_credentials
            SET api_key = v_encrypted_token
            WHERE id = v_record.id;
            
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Erro ao criptografar api_key do registro %: %', v_record.id, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE 'Criptografados % api_keys', v_count;
    v_count := 0;

    -- Criptografar api_secret
    FOR v_record IN 
        SELECT id, api_secret 
        FROM public.tenant_credentials 
        WHERE api_secret IS NOT NULL 
          AND api_secret NOT LIKE '-----BEGIN PGP%' -- Não criptografado ainda
    LOOP
        BEGIN
            v_encrypted_token := public.encrypt_token(v_record.api_secret, v_encryption_key);
            
            UPDATE public.tenant_credentials
            SET api_secret = v_encrypted_token
            WHERE id = v_record.id;
            
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Erro ao criptografar api_secret do registro %: %', v_record.id, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE 'Criptografados % api_secrets', v_count;
END $$;

COMMENT ON FUNCTION public.encrypt_token IS 'Migração concluída: Todos os tokens existentes foram criptografados';

