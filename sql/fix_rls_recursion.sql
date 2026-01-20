-- ============================================================================
-- Correção: Remover recursão infinita nas políticas RLS
-- ============================================================================
-- Este script corrige o problema de recursão infinita nas políticas RLS
-- que ocorre quando uma política tenta consultar a própria tabela profiles
-- para verificar se o usuário é ADMIN.
-- ============================================================================

-- 1. Criar função para verificar se usuário é ADMIN (bypass RLS)
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = user_id AND role = 'ADMIN'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.is_admin(UUID) IS 'Verifica se um usuário é ADMIN, bypassando RLS para evitar recursão';

-- 2. Remover política problemática e recriar
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin(auth.uid()));

-- 3. Atualizar todas as outras políticas que verificam ADMIN
-- tenant_credentials
DROP POLICY IF EXISTS "Partners can view own tenant credentials" ON public.tenant_credentials;
CREATE POLICY "Partners can view own tenant credentials"
    ON public.tenant_credentials FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = tenant_credentials.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Partners can update own tenant credentials" ON public.tenant_credentials;
CREATE POLICY "Partners can update own tenant credentials"
    ON public.tenant_credentials FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = tenant_credentials.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Only admins can delete credentials" ON public.tenant_credentials;
CREATE POLICY "Only admins can delete credentials"
    ON public.tenant_credentials FOR DELETE
    USING (public.is_admin(auth.uid()));

-- tenants
DROP POLICY IF EXISTS "Partners can view own tenants" ON public.tenants;
CREATE POLICY "Partners can view own tenants"
    ON public.tenants FOR SELECT
    USING (
        partner_id = auth.uid() OR
        public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Partners can update own tenants" ON public.tenants;
CREATE POLICY "Partners can update own tenants"
    ON public.tenants FOR UPDATE
    USING (
        partner_id = auth.uid() OR
        public.is_admin(auth.uid())
    );

-- integration_flows
DROP POLICY IF EXISTS "Partners can view own tenant flows" ON public.integration_flows;
CREATE POLICY "Partners can view own tenant flows"
    ON public.integration_flows FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = integration_flows.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Partners can update own tenant flows" ON public.integration_flows;
CREATE POLICY "Partners can update own tenant flows"
    ON public.integration_flows FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = integration_flows.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Partners can delete own tenant flows" ON public.integration_flows;
CREATE POLICY "Partners can delete own tenant flows"
    ON public.integration_flows FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = integration_flows.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

-- mapping_rules
DROP POLICY IF EXISTS "Partners can view own tenant mapping rules" ON public.mapping_rules;
CREATE POLICY "Partners can view own tenant mapping rules"
    ON public.mapping_rules FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = mapping_rules.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Partners can update own tenant mapping rules" ON public.mapping_rules;
CREATE POLICY "Partners can update own tenant mapping rules"
    ON public.mapping_rules FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = mapping_rules.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Partners can delete own tenant mapping rules" ON public.mapping_rules;
CREATE POLICY "Partners can delete own tenant mapping rules"
    ON public.mapping_rules FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = mapping_rules.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

-- sync_jobs
DROP POLICY IF EXISTS "Partners can view own tenant sync jobs" ON public.sync_jobs;
CREATE POLICY "Partners can view own tenant sync jobs"
    ON public.sync_jobs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = sync_jobs.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Partners can update own tenant sync jobs" ON public.sync_jobs;
CREATE POLICY "Partners can update own tenant sync jobs"
    ON public.sync_jobs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = sync_jobs.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

-- audit_logs
DROP POLICY IF EXISTS "Partners can view own tenant audit logs" ON public.audit_logs;
CREATE POLICY "Partners can view own tenant audit logs"
    ON public.audit_logs FOR SELECT
    USING (
        tenant_id IS NULL OR
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = audit_logs.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Only admins can delete audit logs" ON public.audit_logs;
CREATE POLICY "Only admins can delete audit logs"
    ON public.audit_logs FOR DELETE
    USING (public.is_admin(auth.uid()));

-- ============================================================================
-- FIM DA CORREÇÃO
-- ============================================================================
-- Execute este script no SQL Editor do Supabase para corrigir a recursão
-- ============================================================================

