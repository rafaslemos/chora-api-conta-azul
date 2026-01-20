-- ============================================================================
-- Migration 005: Criar Políticas RLS (Row Level Security)
-- ============================================================================
-- Políticas de segurança para todos os schemas
-- ============================================================================

-- Habilitar RLS em todas as tabelas do app_core
ALTER TABLE app_core.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_core.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_core.tenant_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_core.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_core.user_sessions ENABLE ROW LEVEL SECURITY;

-- Habilitar RLS nas tabelas do dw
ALTER TABLE dw.dw_api_keys ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLÍTICAS PARA app_core.profiles
-- ============================================================================

-- Remover políticas existentes antes de recriar
DROP POLICY IF EXISTS "Users can view own profile" ON app_core.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON app_core.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON app_core.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON app_core.profiles;
DROP POLICY IF EXISTS "Admins can insert any profile" ON app_core.profiles;

-- Usuário pode ver seu próprio perfil
CREATE POLICY "Users can view own profile"
    ON app_core.profiles FOR SELECT
    USING (auth.uid() = id);

-- Usuário pode atualizar seu próprio perfil
CREATE POLICY "Users can update own profile"
    ON app_core.profiles FOR UPDATE
    USING (auth.uid() = id);

-- ADMIN pode ver todos os perfis
CREATE POLICY "Admins can view all profiles"
    ON app_core.profiles FOR SELECT
    USING (app_core.is_admin(auth.uid()));

-- Usuário pode criar seu próprio perfil
CREATE POLICY "Users can insert own profile"
    ON app_core.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ADMIN pode criar perfis de qualquer usuário
CREATE POLICY "Admins can insert any profile"
    ON app_core.profiles FOR INSERT
    WITH CHECK (app_core.is_admin(auth.uid()));

-- ============================================================================
-- POLÍTICAS PARA app_core.tenants
-- ============================================================================

DROP POLICY IF EXISTS "Partners can view own tenants" ON app_core.tenants;
DROP POLICY IF EXISTS "Partners can create own tenants" ON app_core.tenants;
DROP POLICY IF EXISTS "Partners can update own tenants" ON app_core.tenants;
DROP POLICY IF EXISTS "Only admins can delete tenants" ON app_core.tenants;

-- Parceiro pode ver seus próprios tenants
CREATE POLICY "Partners can view own tenants"
    ON app_core.tenants FOR SELECT
    USING (
        partner_id = auth.uid() OR
        app_core.is_admin(auth.uid())
    );

-- Parceiro pode criar tenants associados a ele
CREATE POLICY "Partners can create own tenants"
    ON app_core.tenants FOR INSERT
    WITH CHECK (partner_id = auth.uid());

-- Parceiro pode atualizar seus próprios tenants
CREATE POLICY "Partners can update own tenants"
    ON app_core.tenants FOR UPDATE
    USING (
        partner_id = auth.uid() OR
        app_core.is_admin(auth.uid())
    );

-- Apenas ADMIN pode deletar tenants
CREATE POLICY "Only admins can delete tenants"
    ON app_core.tenants FOR DELETE
    USING (app_core.is_admin(auth.uid()));

-- ============================================================================
-- POLÍTICAS PARA app_core.tenant_credentials
-- ============================================================================

DROP POLICY IF EXISTS "Partners can view own tenant credentials" ON app_core.tenant_credentials;
DROP POLICY IF EXISTS "Partners can create own tenant credentials" ON app_core.tenant_credentials;
DROP POLICY IF EXISTS "Partners can update own tenant credentials" ON app_core.tenant_credentials;
DROP POLICY IF EXISTS "Partners can delete own tenant credentials" ON app_core.tenant_credentials;
DROP POLICY IF EXISTS "Only admins can delete credentials" ON app_core.tenant_credentials;

-- Parceiro pode ver credenciais de seus tenants
CREATE POLICY "Partners can view own tenant credentials"
    ON app_core.tenant_credentials FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app_core.tenants
            WHERE id = tenant_credentials.tenant_id AND partner_id = auth.uid()
        ) OR
        app_core.is_admin(auth.uid())
    );

-- Parceiro pode criar credenciais para seus tenants
CREATE POLICY "Partners can create own tenant credentials"
    ON app_core.tenant_credentials FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app_core.tenants
            WHERE id = tenant_credentials.tenant_id AND partner_id = auth.uid()
        )
    );

-- Parceiro pode atualizar credenciais de seus tenants
CREATE POLICY "Partners can update own tenant credentials"
    ON app_core.tenant_credentials FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM app_core.tenants
            WHERE id = tenant_credentials.tenant_id AND partner_id = auth.uid()
        ) OR
        app_core.is_admin(auth.uid())
    );

-- Parceiro pode deletar credenciais de seus tenants (soft delete via revoked_at)
CREATE POLICY "Partners can delete own tenant credentials"
    ON app_core.tenant_credentials FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM app_core.tenants
            WHERE id = tenant_credentials.tenant_id AND partner_id = auth.uid()
        ) OR
        app_core.is_admin(auth.uid())
    );

-- ============================================================================
-- POLÍTICAS PARA app_core.audit_logs
-- ============================================================================

DROP POLICY IF EXISTS "Partners can view own tenant audit logs" ON app_core.audit_logs;
DROP POLICY IF EXISTS "System can create audit logs" ON app_core.audit_logs;
DROP POLICY IF EXISTS "Only admins can delete audit logs" ON app_core.audit_logs;

-- Parceiro pode ver logs de seus tenants
CREATE POLICY "Partners can view own tenant audit logs"
    ON app_core.audit_logs FOR SELECT
    USING (
        (tenant_id IS NULL OR EXISTS (
            SELECT 1 FROM app_core.tenants
            WHERE id = audit_logs.tenant_id AND partner_id = auth.uid()
        )) OR
        app_core.is_admin(auth.uid())
    );

-- Sistema pode criar logs (via Service Role ou RPC)
CREATE POLICY "System can create audit logs"
    ON app_core.audit_logs FOR INSERT
    WITH CHECK (true);

-- Apenas ADMIN pode deletar logs
CREATE POLICY "Only admins can delete audit logs"
    ON app_core.audit_logs FOR DELETE
    USING (app_core.is_admin(auth.uid()));

-- ============================================================================
-- POLÍTICAS PARA app_core.user_sessions
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own sessions" ON app_core.user_sessions;
DROP POLICY IF EXISTS "System can create sessions" ON app_core.user_sessions;

-- Usuário pode ver suas próprias sessões
CREATE POLICY "Users can view own sessions"
    ON app_core.user_sessions FOR SELECT
    USING (user_id = auth.uid() OR app_core.is_admin(auth.uid()));

-- Sistema pode criar sessões
CREATE POLICY "System can create sessions"
    ON app_core.user_sessions FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- POLÍTICAS PARA dw.dw_api_keys
-- ============================================================================

DROP POLICY IF EXISTS "Partners can view own dw api keys" ON dw.dw_api_keys;
DROP POLICY IF EXISTS "Partners can create own dw api keys" ON dw.dw_api_keys;
DROP POLICY IF EXISTS "Partners can update own dw api keys" ON dw.dw_api_keys;
DROP POLICY IF EXISTS "Partners can delete own dw api keys" ON dw.dw_api_keys;
DROP POLICY IF EXISTS "System can validate api keys" ON dw.dw_api_keys;

-- Parceiro pode ver suas próprias chaves API do DW
CREATE POLICY "Partners can view own dw api keys"
    ON dw.dw_api_keys FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app_core.tenants
            WHERE id = dw_api_keys.tenant_id AND partner_id = auth.uid()
        ) OR
        app_core.is_admin(auth.uid())
    );

-- Parceiro pode criar chaves API para seus tenants
CREATE POLICY "Partners can create own dw api keys"
    ON dw.dw_api_keys FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app_core.tenants
            WHERE id = dw_api_keys.tenant_id AND partner_id = auth.uid()
        )
    );

-- Parceiro pode atualizar chaves API de seus tenants
CREATE POLICY "Partners can update own dw api keys"
    ON dw.dw_api_keys FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM app_core.tenants
            WHERE id = dw_api_keys.tenant_id AND partner_id = auth.uid()
        ) OR
        app_core.is_admin(auth.uid())
    );

-- Parceiro pode deletar chaves API de seus tenants
CREATE POLICY "Partners can delete own dw api keys"
    ON dw.dw_api_keys FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM app_core.tenants
            WHERE id = dw_api_keys.tenant_id AND partner_id = auth.uid()
        ) OR
        app_core.is_admin(auth.uid())
    );

-- Sistema pode validar API keys (para Edge Functions)
CREATE POLICY "System can validate api keys"
    ON dw.dw_api_keys FOR SELECT
    USING (true);
