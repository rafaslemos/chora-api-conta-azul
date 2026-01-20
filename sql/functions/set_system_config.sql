-- ============================================================================
-- Função RPC: Salvar/Atualizar configuração do sistema
-- ============================================================================
-- Esta função salva ou atualiza uma configuração do sistema,
-- criptografando automaticamente se is_encrypted = true
-- IMPORTANTE: Apenas para uso via SQL Editor do Supabase (não no n8n)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_system_config(
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
    -- Verificar se usuário é ADMIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL OR NOT public.is_admin(v_user_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Apenas administradores podem modificar configurações do sistema'
        );
    END IF;
    
    -- Obter chave de criptografia
    v_encryption_key := public.get_encryption_key();
    
    -- Criptografar valor se necessário
    IF p_is_encrypted THEN
        v_encrypted_value := public.encrypt_token(p_value, v_encryption_key);
        v_final_value := v_encrypted_value;
    ELSE
        v_final_value := p_value;
    END IF;
    
    -- Inserir ou atualizar
    INSERT INTO public.system_config (key, value, description, is_encrypted, updated_by)
    VALUES (p_key, v_final_value, p_description, p_is_encrypted, v_user_id)
    ON CONFLICT (key) 
    DO UPDATE SET
        value = v_final_value,
        description = COALESCE(p_description, system_config.description),
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

COMMENT ON FUNCTION public.set_system_config IS 'Salva ou atualiza uma configuração do sistema, criptografando automaticamente se is_encrypted = true. Apenas administradores podem usar esta função. Uso exclusivo via SQL Editor do Supabase.';
