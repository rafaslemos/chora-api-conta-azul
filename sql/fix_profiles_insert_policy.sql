-- ============================================================================
-- Correção: Adicionar política RLS para INSERT na tabela profiles
-- ============================================================================
-- Problema: Usuários não conseguiam criar seu próprio perfil após o signup
-- Solução: Adicionar políticas que permitem INSERT do próprio perfil
-- ============================================================================

-- Usuário pode criar seu próprio perfil (fallback caso o trigger falhe)
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ADMIN pode criar perfis de qualquer usuário
CREATE POLICY "Admins can insert any profile"
    ON public.profiles FOR INSERT
    WITH CHECK (public.is_admin(auth.uid()));

-- ============================================================================
-- Para aplicar:
-- 1. Acesse o SQL Editor no Supabase Dashboard
-- 2. Cole este script
-- 3. Execute
-- ============================================================================

