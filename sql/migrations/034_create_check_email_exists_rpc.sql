-- ============================================================================
-- Migration 034: Criar RPC check_email_exists em app_core
-- ============================================================================
-- Função para verificar se um email existe no sistema antes de solicitar
-- reset de senha. Usa SECURITY DEFINER para acessar auth.users.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Função: Verificar se um email existe no sistema
-- ----------------------------------------------------------------------------
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
-- OBS: SECURITY DEFINER não substitui GRANT EXECUTE. Sem isso, PostgREST pode
-- retornar 404/PGRST202 ("não encontrado no schema cache") para roles anon/authenticated.
--
-- Permite que usuários não autenticados (anon) e autenticados (authenticated)
-- possam verificar se um email existe antes de solicitar reset de senha
GRANT EXECUTE ON FUNCTION app_core.check_email_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION app_core.check_email_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION app_core.check_email_exists(TEXT) TO service_role;
