-- ============================================================================
-- Aplicar apenas a política de INSERT para profiles
-- ============================================================================
-- Execute este script se você já tem o schema aplicado e só precisa
-- adicionar a política de INSERT que estava faltando
-- ============================================================================

-- Usuário pode criar seu próprio perfil (fallback caso o trigger falhe)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ADMIN pode criar perfis de qualquer usuário
DROP POLICY IF EXISTS "Admins can insert any profile" ON public.profiles;
CREATE POLICY "Admins can insert any profile"
    ON public.profiles FOR INSERT
    WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================================
-- Para aplicar:
-- 1. Acesse o SQL Editor no Supabase Dashboard
-- 2. Cole este script
-- 3. Execute
-- ============================================================================

