-- ============================================================================
-- Correção: Função para criar/atualizar perfil bypassando RLS
-- ============================================================================
-- Problema: Após signup, quando o código tenta criar o perfil manualmente,
-- a política RLS bloqueia porque auth.uid() pode não estar disponível.
-- Solução: Criar função SECURITY DEFINER que bypassa RLS.
-- ============================================================================

-- Função: Criar ou atualizar perfil (bypass RLS)
CREATE OR REPLACE FUNCTION public.create_or_update_profile(
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
    UPDATE public.profiles
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
        INSERT INTO public.profiles (
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

COMMENT ON FUNCTION public.create_or_update_profile IS 'Cria ou atualiza perfil de usuário, bypassando RLS. Usado após signup quando a sessão ainda não está estabelecida.';

-- ============================================================================
-- Para aplicar:
-- 1. Acesse o SQL Editor no Supabase Dashboard
-- 2. Cole este script
-- 3. Execute
-- ============================================================================

