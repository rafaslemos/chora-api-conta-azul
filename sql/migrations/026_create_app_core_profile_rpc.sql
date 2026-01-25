-- ============================================================================
-- Migration 026: RPC create_or_update_profile em app_core
-- ============================================================================
-- Cria ou atualiza perfil bypassando RLS. Usado após signup quando a sessão
-- ainda não está estabelecida (ex.: confirmação de email ativa).
-- ============================================================================

CREATE OR REPLACE FUNCTION app_core.create_or_update_profile(
    p_user_id UUID,
    p_full_name TEXT,
    p_cnpj TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_company_name TEXT DEFAULT NULL,
    p_role TEXT DEFAULT 'PARTNER'
)
RETURNS UUID AS $$
DECLARE
    v_profile_id UUID;
BEGIN
    -- Tentar atualizar primeiro
    UPDATE app_core.profiles
    SET
        full_name = p_full_name,
        cnpj = COALESCE(p_cnpj, cnpj),
        phone = COALESCE(p_phone, phone),
        company_name = COALESCE(p_company_name, company_name),
        role = COALESCE(p_role, role),
        updated_at = NOW()
    WHERE id = p_user_id
    RETURNING id INTO v_profile_id;

    -- Se não encontrou, inserir
    IF v_profile_id IS NULL THEN
        INSERT INTO app_core.profiles (
            id,
            full_name,
            cnpj,
            phone,
            company_name,
            role
        ) VALUES (
            p_user_id,
            p_full_name,
            p_cnpj,
            p_phone,
            p_company_name,
            p_role
        ) RETURNING id INTO v_profile_id;
    END IF;

    RETURN v_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.create_or_update_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) IS
    'Cria ou atualiza perfil de usuário, bypassando RLS. Usado após signup quando a sessão ainda não está estabelecida.';

GRANT EXECUTE ON FUNCTION app_core.create_or_update_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION app_core.create_or_update_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
