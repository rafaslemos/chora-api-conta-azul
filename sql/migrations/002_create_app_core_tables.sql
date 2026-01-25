-- ============================================================================
-- Migration 002: Criar Tabelas do Schema app_core
-- ============================================================================
-- Tabelas principais da aplicação: profiles, tenants, tenant_credentials, audit_logs
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tabela: profiles (perfis de usuários)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_core.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    cnpj TEXT UNIQUE,
    phone TEXT,
    company_name TEXT,
    role TEXT DEFAULT 'PARTNER' CHECK (role IN ('PARTNER', 'ADMIN')),
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE app_core.profiles IS 'Perfis de usuários parceiros e administradores';
COMMENT ON COLUMN app_core.profiles.role IS 'PARTNER: parceiro que gerencia clientes, ADMIN: administrador do sistema';

-- ----------------------------------------------------------------------------
-- Tabela: tenants (clientes/empresas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_core.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    cnpj TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    razao_social TEXT,
    nome_fantasia TEXT,
    phone TEXT,
    address_logradouro TEXT,
    address_numero TEXT,
    address_bairro TEXT,
    address_cidade TEXT,
    address_estado TEXT,
    address_cep TEXT,
    status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
    plan TEXT DEFAULT 'BASIC' CHECK (plan IN ('BASIC', 'PRO', 'ENTERPRISE')),
    connections_conta_azul BOOLEAN DEFAULT FALSE,
    partner_id UUID NOT NULL REFERENCES app_core.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE app_core.tenants IS 'Clientes/empresas gerenciadas pelos parceiros';
COMMENT ON COLUMN app_core.tenants.partner_id IS 'Parceiro responsável por este cliente';

-- ----------------------------------------------------------------------------
-- Tabela: tenant_credentials (credenciais por tenant - MÚLTIPLAS POR PLATAFORMA)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_core.tenant_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform = 'CONTA_AZUL'), -- Apenas Conta Azul suportado
    credential_name TEXT NOT NULL, -- Nome amigável da credencial (ex: "Matriz SP", "Filial RJ")
    access_token TEXT, -- Será criptografado via função
    refresh_token TEXT, -- Será criptografado via função
    token_expires_at TIMESTAMPTZ,
    api_key TEXT, -- Será criptografado via função (para compatibilidade futura)
    api_secret TEXT, -- Será criptografado via função (para compatibilidade futura)
    webhook_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    last_authenticated_at TIMESTAMPTZ, -- Última vez que a credencial foi autenticada
    revoked_at TIMESTAMPTZ, -- Data em que a credencial foi revogada (se aplicável)
    config JSONB DEFAULT '{}'::jsonb, -- Configurações adicionais específicas da credencial
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE app_core.tenant_credentials IS 'Credenciais de API por tenant e plataforma - permite múltiplas credenciais ContaAzul por tenant';
COMMENT ON COLUMN app_core.tenant_credentials.credential_name IS 'Nome amigável da credencial para identificação no DW';
COMMENT ON COLUMN app_core.tenant_credentials.access_token IS 'Token de acesso (criptografado)';
COMMENT ON COLUMN app_core.tenant_credentials.refresh_token IS 'Token de refresh (criptografado)';
COMMENT ON COLUMN app_core.tenant_credentials.last_authenticated_at IS 'Data da última autenticação OAuth bem-sucedida';
COMMENT ON COLUMN app_core.tenant_credentials.revoked_at IS 'Data em que a credencial foi revogada (null = ativa)';

-- Índice único parcial: garantir nome único por tenant+platform (mas permitir múltiplas credenciais)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_credentials_unique_name 
    ON app_core.tenant_credentials(tenant_id, platform, credential_name) 
    WHERE platform = 'CONTA_AZUL' AND revoked_at IS NULL;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tenant_credentials_tenant_id ON app_core.tenant_credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_credentials_platform ON app_core.tenant_credentials(platform);
CREATE INDEX IF NOT EXISTS idx_tenant_credentials_is_active ON app_core.tenant_credentials(is_active);
CREATE INDEX IF NOT EXISTS idx_tenant_credentials_tenant_platform ON app_core.tenant_credentials(tenant_id, platform);

-- ----------------------------------------------------------------------------
-- Tabela: audit_logs (logs de auditoria)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_core.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES app_core.tenants(id) ON DELETE SET NULL,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT CHECK (entity_type IN ('TENANT', 'CREDENTIAL', 'USER', 'AUTH')),
    entity_id UUID,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'ERROR', 'WARNING')),
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE app_core.audit_logs IS 'Logs imutáveis de auditoria para compliance e rastreabilidade';
COMMENT ON COLUMN app_core.audit_logs.credential_id IS 'ID da credencial relacionada à ação (se aplicável)';

-- Índices para audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON app_core.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_credential_id ON app_core.audit_logs(credential_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON app_core.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON app_core.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON app_core.audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON app_core.audit_logs(entity_type, entity_id);

-- ----------------------------------------------------------------------------
-- Tabela: user_sessions (sessões de usuário - auditoria)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_core.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ
);

COMMENT ON TABLE app_core.user_sessions IS 'Registro de sessões de usuário para auditoria de segurança';

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON app_core.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON app_core.user_sessions(expires_at);

-- ----------------------------------------------------------------------------
-- Permissões GRANT nas tabelas (necessárias mesmo com RLS)
-- ----------------------------------------------------------------------------
-- RLS controla quais linhas podem ser acessadas, GRANT controla se a tabela pode ser acessada
GRANT SELECT, INSERT, UPDATE, DELETE ON app_core.profiles TO authenticated;
GRANT SELECT ON app_core.profiles TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON app_core.tenants TO authenticated;
GRANT SELECT ON app_core.tenants TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON app_core.tenant_credentials TO authenticated;

GRANT SELECT, INSERT ON app_core.audit_logs TO authenticated;

GRANT SELECT, INSERT ON app_core.user_sessions TO authenticated;

-- ----------------------------------------------------------------------------
-- Função auxiliar: Atualizar updated_at automaticamente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON app_core.profiles
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON app_core.tenants
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

CREATE TRIGGER update_tenant_credentials_updated_at
    BEFORE UPDATE ON app_core.tenant_credentials
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Função: Criar perfil automaticamente após signup
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO app_core.profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'PARTNER'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.handle_new_user() IS 'Cria perfil automaticamente quando um novo usuário se cadastra';

-- Trigger para criar perfil automaticamente
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION app_core.handle_new_user();

-- ----------------------------------------------------------------------------
-- Função auxiliar: Verificar se usuário é ADMIN
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_core.profiles
        WHERE id = p_user_id AND role = 'ADMIN'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.is_admin IS 'Verifica se o usuário tem role ADMIN';
