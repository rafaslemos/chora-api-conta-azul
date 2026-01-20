-- ============================================================================
-- Função: Verificar se um email existe no sistema
-- ============================================================================
-- Esta função permite verificar se um email está cadastrado no sistema
-- sem expor informações sensíveis. Usa SECURITY DEFINER para acessar auth.users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_email_exists(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM auth.users
        WHERE email = LOWER(TRIM(p_email))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.check_email_exists(TEXT) IS 'Verifica se um email existe no sistema. Retorna true se existir, false caso contrário.';

