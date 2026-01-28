-- ============================================================================
-- Schema completo do Supabase para plataforma BPO Olist-ContaAzul
-- ============================================================================
-- Este arquivo contém toda a estrutura do banco de dados:
-- - Extensões
-- - Tabelas
-- - Funções
-- - Triggers
-- - Row Level Security (RLS)
-- - Políticas de segurança
-- - Índices
-- ============================================================================

-- ============================================================================
-- 1. EXTENSÕES
-- ============================================================================

-- Habilitar extensão para criptografia
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- UUID já vem habilitado no Supabase, mas garantimos
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 2. TABELAS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tabela: profiles (extensão da auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
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

COMMENT ON TABLE public.profiles IS 'Perfis de usuários parceiros e administradores';
COMMENT ON COLUMN public.profiles.role IS 'PARTNER: parceiro que gerencia clientes, ADMIN: administrador do sistema';

-- ----------------------------------------------------------------------------
-- Tabela: tenants (clientes/empresas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
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
    connections_olist BOOLEAN DEFAULT FALSE,
    connections_conta_azul BOOLEAN DEFAULT FALSE,
    partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.tenants IS 'Clientes/empresas gerenciadas pelos parceiros';
COMMENT ON COLUMN public.tenants.partner_id IS 'Parceiro responsável por este cliente';

-- ----------------------------------------------------------------------------
-- Tabela: tenant_credentials (credenciais por tenant)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('OLIST', 'CONTA_AZUL', 'HOTMART', 'MERCADO_LIVRE', 'SHOPEE')),
    access_token TEXT, -- Será criptografado via função
    refresh_token TEXT, -- Será criptografado via função
    token_expires_at TIMESTAMPTZ,
    api_key TEXT, -- Será criptografado via função
    api_secret TEXT, -- Será criptografado via função
    webhook_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, platform)
);

COMMENT ON TABLE public.tenant_credentials IS 'Credenciais de API por tenant e plataforma';
COMMENT ON COLUMN public.tenant_credentials.access_token IS 'Token de acesso (criptografado)';
COMMENT ON COLUMN public.tenant_credentials.refresh_token IS 'Token de refresh (criptografado)';

-- ----------------------------------------------------------------------------
-- Tabela: integration_flows (fluxos de integração)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.integration_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('OLIST', 'HOTMART', 'MERCADO_LIVRE', 'SHOPEE')),
    destination TEXT NOT NULL CHECK (destination IN ('CONTA_AZUL', 'BLING', 'TINY')),
    active BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}'::jsonb,
    n8n_workflow_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.integration_flows IS 'Fluxos de integração configurados por tenant';
COMMENT ON COLUMN public.integration_flows.config IS 'Configurações do fluxo em formato JSON';

-- ----------------------------------------------------------------------------
-- Tabela: mapping_rules (regras de mapeamento)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.mapping_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    condition_field TEXT NOT NULL CHECK (condition_field IN ('CATEGORY', 'MARKETPLACE', 'SKU', 'PRODUCT_NAME')),
    condition_value TEXT NOT NULL,
    target_account TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.mapping_rules IS 'Regras de mapeamento de produtos/categorias para contas do ContaAzul';

-- ----------------------------------------------------------------------------
-- Tabela: sync_jobs (jobs de sincronização)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('ORDER_SYNC', 'PRODUCT_SYNC', 'FEES_SYNC', 'CUSTOMER_SYNC')),
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'SUCCESS', 'ERROR', 'CANCELLED')),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    details TEXT,
    items_processed INTEGER DEFAULT 0,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.sync_jobs IS 'Jobs de sincronização executados para cada tenant';
COMMENT ON COLUMN public.sync_jobs.retry_count IS 'Número de tentativas de retry em caso de erro';

-- ----------------------------------------------------------------------------
-- Tabela: audit_logs (logs de auditoria)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT CHECK (entity_type IN ('TENANT', 'CREDENTIAL', 'FLOW', 'MAPPING', 'SYNC_JOB', 'USER')),
    entity_id UUID,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'ERROR', 'WARNING')),
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.audit_logs IS 'Logs imutáveis de auditoria para compliance e rastreabilidade';

-- ----------------------------------------------------------------------------
-- Tabela: user_sessions (sessões de usuário - auditoria)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ
);

COMMENT ON TABLE public.user_sessions IS 'Registro de sessões de usuário para auditoria de segurança';

-- ============================================================================
-- 3. FUNÇÕES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Função: Criar perfil automaticamente após signup
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        'PARTNER'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user() IS 'Cria perfil automaticamente quando um novo usuário se cadastra';

-- ----------------------------------------------------------------------------
-- Função: Atualizar updated_at automaticamente
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.update_updated_at_column() IS 'Atualiza o campo updated_at automaticamente';

-- ----------------------------------------------------------------------------
-- Função: Criptografar token (usando pgcrypto)
-- Nota: Em produção, use uma chave segura armazenada no Supabase Vault
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.encrypt_token(plain_text TEXT, encryption_key TEXT DEFAULT 'default_key_change_in_production')
RETURNS TEXT AS $$
BEGIN
    RETURN encode(
        pgp_sym_encrypt(plain_text, encryption_key),
        'base64'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.encrypt_token(TEXT, TEXT) IS 'Criptografa tokens usando pgcrypto';

-- ----------------------------------------------------------------------------
-- Função: Descriptografar token
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decrypt_token(encrypted_text TEXT, encryption_key TEXT DEFAULT 'default_key_change_in_production')
RETURNS TEXT AS $$
BEGIN
    RETURN pgp_sym_decrypt(
        decode(encrypted_text, 'base64'),
        encryption_key
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.decrypt_token(TEXT, TEXT) IS 'Descriptografa tokens usando pgcrypto';

-- ----------------------------------------------------------------------------
-- Função: Verificar se usuário é ADMIN (bypass RLS)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Função: Criar log de auditoria
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_audit_log(
    p_tenant_id UUID,
    p_user_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_status TEXT,
    p_details TEXT,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.audit_logs (
        tenant_id,
        user_id,
        action,
        entity_type,
        entity_id,
        status,
        details,
        ip_address,
        user_agent
    ) VALUES (
        p_tenant_id,
        p_user_id,
        p_action,
        p_entity_type,
        p_entity_id,
        p_status,
        p_details,
        p_ip_address,
        p_user_agent
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_audit_log IS 'Cria um log de auditoria de forma padronizada';

-- ----------------------------------------------------------------------------
-- Função: Criar ou atualizar perfil (bypass RLS)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- Função: Verificar se um email existe no sistema
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.check_email_exists(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM auth.users
        WHERE email = LOWER(TRIM(p_email))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION app_core.check_email_exists(TEXT) IS 'Verifica se um email existe no sistema. Retorna true se existir, false caso contrário. Usa SECURITY DEFINER para acessar auth.users.';

-- Permissões (GRANT EXECUTE) para PostgREST/Supabase RPC
GRANT EXECUTE ON FUNCTION app_core.check_email_exists(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION app_core.check_email_exists(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION app_core.check_email_exists(TEXT) TO service_role;

-- ============================================================================
-- 4. TRIGGERS
-- ============================================================================

-- Trigger: Criar perfil após signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Triggers: Atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenants_updated_at ON public.tenants;
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON public.tenants
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_credentials_updated_at ON public.tenant_credentials;
CREATE TRIGGER update_tenant_credentials_updated_at
    BEFORE UPDATE ON public.tenant_credentials
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_integration_flows_updated_at ON public.integration_flows;
CREATE TRIGGER update_integration_flows_updated_at
    BEFORE UPDATE ON public.integration_flows
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_mapping_rules_updated_at ON public.mapping_rules;
CREATE TRIGGER update_mapping_rules_updated_at
    BEFORE UPDATE ON public.mapping_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 5. ÍNDICES PARA PERFORMANCE
-- ============================================================================

-- Índices para tenants
CREATE INDEX IF NOT EXISTS idx_tenants_partner_id ON public.tenants(partner_id);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_cnpj ON public.tenants(cnpj);

-- Índices para tenant_credentials
CREATE INDEX IF NOT EXISTS idx_tenant_credentials_tenant_id ON public.tenant_credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_credentials_platform ON public.tenant_credentials(platform);
CREATE INDEX IF NOT EXISTS idx_tenant_credentials_is_active ON public.tenant_credentials(is_active);

-- Índices para integration_flows
CREATE INDEX IF NOT EXISTS idx_integration_flows_tenant_id ON public.integration_flows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integration_flows_active ON public.integration_flows(active);
CREATE INDEX IF NOT EXISTS idx_integration_flows_source_destination ON public.integration_flows(source, destination);

-- Índices para mapping_rules
CREATE INDEX IF NOT EXISTS idx_mapping_rules_tenant_id ON public.mapping_rules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mapping_rules_is_active ON public.mapping_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_mapping_rules_priority ON public.mapping_rules(priority DESC);

-- Índices para sync_jobs
CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant_id ON public.sync_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON public.sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_created_at ON public.sync_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant_status_created ON public.sync_jobs(tenant_id, status, created_at DESC);

-- Índices para audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_created ON public.audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);

-- Índices para user_sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON public.user_sessions(expires_at);

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mapping_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. POLÍTICAS RLS
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Políticas para profiles
-- ----------------------------------------------------------------------------

-- Remover políticas existentes antes de recriar (para permitir reexecução)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert any profile" ON public.profiles;

-- Usuário pode ver seu próprio perfil
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Usuário pode atualizar seu próprio perfil
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- ADMIN pode ver todos os perfis (usa função para evitar recursão)
CREATE POLICY "Admins can view all profiles"
    ON public.profiles FOR SELECT
    USING (public.is_admin(auth.uid()));

-- Usuário pode criar seu próprio perfil (fallback caso o trigger falhe)
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- ADMIN pode criar perfis de qualquer usuário
CREATE POLICY "Admins can insert any profile"
    ON public.profiles FOR INSERT
    WITH CHECK (public.is_admin(auth.uid()));

-- ----------------------------------------------------------------------------
-- Políticas para tenants
-- ----------------------------------------------------------------------------

-- Remover políticas existentes antes de recriar
DROP POLICY IF EXISTS "Partners can view own tenants" ON public.tenants;
DROP POLICY IF EXISTS "Partners can create own tenants" ON public.tenants;
DROP POLICY IF EXISTS "Partners can update own tenants" ON public.tenants;
DROP POLICY IF EXISTS "Only admins can delete tenants" ON public.tenants;

-- Parceiro pode ver seus próprios tenants
CREATE POLICY "Partners can view own tenants"
    ON public.tenants FOR SELECT
    USING (
        partner_id = auth.uid() OR
        public.is_admin(auth.uid())
    );

-- Parceiro pode criar tenants associados a ele
CREATE POLICY "Partners can create own tenants"
    ON public.tenants FOR INSERT
    WITH CHECK (partner_id = auth.uid());

-- Parceiro pode atualizar seus próprios tenants
CREATE POLICY "Partners can update own tenants"
    ON public.tenants FOR UPDATE
    USING (
        partner_id = auth.uid() OR
        public.is_admin(auth.uid())
    );

-- Apenas ADMIN pode deletar tenants
CREATE POLICY "Only admins can delete tenants"
    ON public.tenants FOR DELETE
    USING (
        public.is_admin(auth.uid())
    );

-- ----------------------------------------------------------------------------
-- Políticas para tenant_credentials
-- ----------------------------------------------------------------------------

-- Remover políticas existentes antes de recriar
DROP POLICY IF EXISTS "Partners can view own tenant credentials" ON public.tenant_credentials;
DROP POLICY IF EXISTS "Partners can create own tenant credentials" ON public.tenant_credentials;
DROP POLICY IF EXISTS "Partners can update own tenant credentials" ON public.tenant_credentials;
DROP POLICY IF EXISTS "Only admins can delete credentials" ON public.tenant_credentials;

-- Parceiro pode ver credenciais de seus tenants
CREATE POLICY "Partners can view own tenant credentials"
    ON public.tenant_credentials FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = tenant_credentials.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

-- Parceiro pode criar credenciais para seus tenants
CREATE POLICY "Partners can create own tenant credentials"
    ON public.tenant_credentials FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = tenant_credentials.tenant_id AND partner_id = auth.uid()
        )
    );

-- Parceiro pode atualizar credenciais de seus tenants
CREATE POLICY "Partners can update own tenant credentials"
    ON public.tenant_credentials FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = tenant_credentials.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

-- Apenas ADMIN pode deletar credenciais
CREATE POLICY "Only admins can delete credentials"
    ON public.tenant_credentials FOR DELETE
    USING (
        public.is_admin(auth.uid())
    );

-- ----------------------------------------------------------------------------
-- Políticas para integration_flows
-- ----------------------------------------------------------------------------

-- Remover políticas existentes antes de recriar
DROP POLICY IF EXISTS "Partners can view own tenant flows" ON public.integration_flows;
DROP POLICY IF EXISTS "Partners can create own tenant flows" ON public.integration_flows;
DROP POLICY IF EXISTS "Partners can update own tenant flows" ON public.integration_flows;
DROP POLICY IF EXISTS "Partners can delete own tenant flows" ON public.integration_flows;

-- Parceiro pode ver fluxos de seus tenants
CREATE POLICY "Partners can view own tenant flows"
    ON public.integration_flows FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = integration_flows.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

-- Parceiro pode criar fluxos para seus tenants
CREATE POLICY "Partners can create own tenant flows"
    ON public.integration_flows FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = integration_flows.tenant_id AND partner_id = auth.uid()
        )
    );

-- Parceiro pode atualizar fluxos de seus tenants
CREATE POLICY "Partners can update own tenant flows"
    ON public.integration_flows FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = integration_flows.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

-- Parceiro pode deletar fluxos de seus tenants
CREATE POLICY "Partners can delete own tenant flows"
    ON public.integration_flows FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = integration_flows.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

-- ----------------------------------------------------------------------------
-- Políticas para mapping_rules
-- ----------------------------------------------------------------------------

-- Remover políticas existentes antes de recriar
DROP POLICY IF EXISTS "Partners can view own tenant mapping rules" ON public.mapping_rules;
DROP POLICY IF EXISTS "Partners can create own tenant mapping rules" ON public.mapping_rules;
DROP POLICY IF EXISTS "Partners can update own tenant mapping rules" ON public.mapping_rules;
DROP POLICY IF EXISTS "Partners can delete own tenant mapping rules" ON public.mapping_rules;

-- Parceiro pode ver regras de seus tenants
CREATE POLICY "Partners can view own tenant mapping rules"
    ON public.mapping_rules FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = mapping_rules.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

-- Parceiro pode criar regras para seus tenants
CREATE POLICY "Partners can create own tenant mapping rules"
    ON public.mapping_rules FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = mapping_rules.tenant_id AND partner_id = auth.uid()
        )
    );

-- Parceiro pode atualizar regras de seus tenants
CREATE POLICY "Partners can update own tenant mapping rules"
    ON public.mapping_rules FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = mapping_rules.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

-- Parceiro pode deletar regras de seus tenants
CREATE POLICY "Partners can delete own tenant mapping rules"
    ON public.mapping_rules FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = mapping_rules.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

-- ----------------------------------------------------------------------------
-- Políticas para sync_jobs
-- ----------------------------------------------------------------------------

-- Remover políticas existentes antes de recriar
DROP POLICY IF EXISTS "Partners can view own tenant sync jobs" ON public.sync_jobs;
DROP POLICY IF EXISTS "System can create sync jobs" ON public.sync_jobs;
DROP POLICY IF EXISTS "Partners can update own tenant sync jobs" ON public.sync_jobs;

-- Parceiro pode ver jobs de seus tenants
CREATE POLICY "Partners can view own tenant sync jobs"
    ON public.sync_jobs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = sync_jobs.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

-- Sistema pode criar jobs (via função SECURITY DEFINER)
CREATE POLICY "System can create sync jobs"
    ON public.sync_jobs FOR INSERT
    WITH CHECK (true);

-- Parceiro pode atualizar jobs de seus tenants
CREATE POLICY "Partners can update own tenant sync jobs"
    ON public.sync_jobs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = sync_jobs.tenant_id AND partner_id = auth.uid()
        ) OR
        public.is_admin(auth.uid())
    );

-- ----------------------------------------------------------------------------
-- Políticas para audit_logs
-- ----------------------------------------------------------------------------

-- Remover políticas existentes antes de recriar
DROP POLICY IF EXISTS "Partners can view own tenant audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can create audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Only admins can delete audit logs" ON public.audit_logs;

-- Parceiro pode ver logs de seus tenants
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

-- Sistema pode criar logs (via função SECURITY DEFINER)
CREATE POLICY "System can create audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (true);

-- Apenas ADMIN pode deletar logs (logs são imutáveis)
CREATE POLICY "Only admins can delete audit logs"
    ON public.audit_logs FOR DELETE
    USING (
        public.is_admin(auth.uid())
    );

-- ----------------------------------------------------------------------------
-- Políticas para user_sessions
-- ----------------------------------------------------------------------------

-- Remover políticas existentes antes de recriar
DROP POLICY IF EXISTS "Users can view own sessions" ON public.user_sessions;
DROP POLICY IF EXISTS "System can create user sessions" ON public.user_sessions;

-- Usuário pode ver suas próprias sessões
CREATE POLICY "Users can view own sessions"
    ON public.user_sessions FOR SELECT
    USING (user_id = auth.uid());

-- Sistema pode criar sessões
CREATE POLICY "System can create user sessions"
    ON public.user_sessions FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- FIM DO SCHEMA
-- ============================================================================

-- Para aplicar este schema no Supabase:
-- 1. Acesse o SQL Editor no Supabase Dashboard
-- 2. Cole todo este conteúdo
-- 3. Execute o script
-- 4. Verifique se todas as tabelas, políticas e triggers foram criados

