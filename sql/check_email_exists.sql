-- ============================================================================
-- Função: Verificar se um email existe no sistema
-- ============================================================================
-- Esta função permite verificar se um email está cadastrado no sistema
-- sem expor informações sensíveis. Usa SECURITY DEFINER para acessar auth.users
-- ============================================================================

CREATE OR REPLACE FUNCTION app_core.check_email_exists(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM auth.users u
        INNER JOIN app_core.profiles p ON p.id = u.id
        WHERE u.email = LOWER(TRIM(p_email))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION app_core.check_email_exists(TEXT) IS 'Verifica se um email existe em auth.users E se existe um perfil correspondente em app_core.profiles. Retorna true se ambos existirem, false caso contrário. Usa SECURITY DEFINER para acessar auth.users e app_core.profiles.';

-- ----------------------------------------------------------------------------
-- Permissões (GRANT EXECUTE) para PostgREST/Supabase RPC
-- ----------------------------------------------------------------------------
-- Permite que usuários não autenticados (anon) e autenticados (authenticated)
-- possam verificar se um email existe antes de solicitar reset de senha
GRANT EXECUTE ON FUNCTION app_core.check_email_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION app_core.check_email_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION app_core.check_email_exists(TEXT) TO service_role;

