-- ============================================================================
-- Função RPC: Buscar configurações do sistema
-- ============================================================================
-- Esta função retorna as configurações do sistema, descriptografando
-- automaticamente valores que estão marcados como is_encrypted = true
-- Utilizada pelo n8n para acessar credenciais do Supabase
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_system_config()
RETURNS TABLE (
    key TEXT,
    value TEXT,
    description TEXT,
    is_encrypted BOOLEAN,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_encryption_key TEXT;
BEGIN
    -- Obter chave de criptografia
    v_encryption_key := public.get_encryption_key();
    
    RETURN QUERY
    SELECT 
        sc.key,
        CASE 
            WHEN sc.is_encrypted THEN 
                public.decrypt_token(sc.value, v_encryption_key)
            ELSE 
                sc.value
        END as value,
        sc.description,
        sc.is_encrypted,
        sc.updated_at
    FROM public.system_config sc
    ORDER BY sc.key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_system_config IS 'Retorna todas as configurações do sistema, descriptografando automaticamente valores criptografados. Utilizada pelo n8n para acessar credenciais do Supabase.';
