// Supabase Edge Function para setup automático do banco de dados
// Esta função executa todas as migrations SQL necessárias usando conexão direta ao PostgreSQL
//
// IMPORTANTE: Esta função deve ser deployada ANTES de ser usada pela primeira vez
// Comando de deploy: supabase functions deploy setup-database
//
// Esta função só funciona uma vez por projeto (protege contra re-execução acidental)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { postgres } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Migrations SQL embutidas (executadas em ordem)
// Migration 001: Criar Schemas
const MIGRATION_001 = `
CREATE SCHEMA IF NOT EXISTS app_core;
COMMENT ON SCHEMA app_core IS 'Schema principal da aplicação: autenticação, tenants, credenciais e auditoria';

CREATE SCHEMA IF NOT EXISTS integrations;
COMMENT ON SCHEMA integrations IS 'Schema para integrações e fluxos de dados';

CREATE SCHEMA IF NOT EXISTS dw;
COMMENT ON SCHEMA dw IS 'Schema do Data Warehouse: dados consolidados para consumo via API';

GRANT USAGE ON SCHEMA app_core TO authenticated;
GRANT USAGE ON SCHEMA app_core TO anon;
GRANT USAGE ON SCHEMA app_core TO service_role; -- Necessário para Edge Functions acessarem RPCs
GRANT USAGE ON SCHEMA integrations TO authenticated;
GRANT USAGE ON SCHEMA integrations TO service_role; -- Necessário caso Edge Functions precisem acessar RPCs
GRANT USAGE ON SCHEMA dw TO authenticated;
GRANT USAGE ON SCHEMA dw TO anon;
GRANT USAGE ON SCHEMA dw TO service_role; -- Necessário para Edge Function dw-api acessar RPCs
`;

// Migration 002: Criar Tabelas app_core (simplificada - versão completa será embutida)
const MIGRATION_002 = `
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

CREATE TABLE IF NOT EXISTS app_core.tenant_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform = 'CONTA_AZUL'),
    credential_name TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    api_key TEXT,
    api_secret TEXT,
    webhook_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_sync_at TIMESTAMPTZ,
    last_authenticated_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE app_core.tenant_credentials IS 'Credenciais de API por tenant e plataforma - permite múltiplas credenciais ContaAzul por tenant';

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_credentials_unique_name 
    ON app_core.tenant_credentials(tenant_id, platform, credential_name) 
    WHERE platform = 'CONTA_AZUL' AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_credentials_tenant_id ON app_core.tenant_credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_credentials_platform ON app_core.tenant_credentials(platform);
CREATE INDEX IF NOT EXISTS idx_tenant_credentials_is_active ON app_core.tenant_credentials(is_active);
CREATE INDEX IF NOT EXISTS idx_tenant_credentials_tenant_platform ON app_core.tenant_credentials(tenant_id, platform);

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

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON app_core.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_credential_id ON app_core.audit_logs(credential_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON app_core.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON app_core.audit_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS app_core.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON app_core.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON app_core.user_sessions(expires_at);

CREATE OR REPLACE FUNCTION app_core.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION app_core.handle_new_user();

CREATE OR REPLACE FUNCTION app_core.is_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_core.profiles
        WHERE id = p_user_id AND role = 'ADMIN'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

// Migration 003: Criar Tabelas DW
const MIGRATION_003 = `
CREATE TABLE IF NOT EXISTS dw.dw_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE,
    key_name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE dw.dw_api_keys IS 'Chaves de API para acesso read-only ao Data Warehouse por tenant';

CREATE INDEX IF NOT EXISTS idx_dw_api_keys_tenant_id ON dw.dw_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dw_api_keys_key_hash ON dw.dw_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_dw_api_keys_is_active ON dw.dw_api_keys(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dw_api_keys_tenant_name ON dw.dw_api_keys(tenant_id, key_name) WHERE is_active = TRUE;

CREATE TRIGGER update_dw_api_keys_updated_at
    BEFORE UPDATE ON dw.dw_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

CREATE OR REPLACE FUNCTION dw.hash_api_key(p_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(digest(p_key, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION dw.validate_api_key(p_key_hash TEXT)
RETURNS TABLE (
    tenant_id UUID,
    key_id UUID,
    key_name TEXT,
    is_valid BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dak.tenant_id,
        dak.id,
        dak.key_name,
        CASE 
            WHEN dak.is_active = FALSE THEN FALSE
            WHEN dak.expires_at IS NOT NULL AND dak.expires_at < NOW() THEN FALSE
            ELSE TRUE
        END as is_valid
    FROM dw.dw_api_keys dak
    WHERE dak.key_hash = p_key_hash;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE VIEW dw.vw_conta_azul_credentials AS
SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    t.cnpj as tenant_cnpj,
    tc.id as credential_id,
    tc.credential_name,
    tc.is_active,
    tc.last_authenticated_at,
    tc.last_sync_at,
    tc.created_at,
    tc.updated_at
FROM app_core.tenants t
INNER JOIN app_core.tenant_credentials tc ON tc.tenant_id = t.id
WHERE tc.platform = 'CONTA_AZUL'
  AND tc.revoked_at IS NULL;

COMMENT ON VIEW dw.vw_conta_azul_credentials IS 'View consolidada das credenciais Conta Azul ativas por tenant';

GRANT SELECT ON dw.vw_conta_azul_credentials TO authenticated;
GRANT SELECT ON dw.vw_conta_azul_credentials TO anon;
`;

// Migration 004: Funções RPC (simplificada - funções críticas)
const MIGRATION_004 = `
CREATE OR REPLACE FUNCTION app_core.get_encryption_key()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.settings.encryption_key', true),
        'default_key_change_in_production'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION app_core.encrypt_token(p_token TEXT, p_key TEXT)
RETURNS TEXT AS $$
BEGIN
    IF p_token IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN encode(encrypt(p_token::bytea, p_key::bytea, 'aes'), 'base64');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION app_core.decrypt_token(p_encrypted_token TEXT, p_key TEXT)
RETURNS TEXT AS $$
BEGIN
    IF p_encrypted_token IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN convert_from(decrypt(decode(p_encrypted_token, 'base64'), p_key::bytea, 'aes'), 'UTF8');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função create_tenant_credential (versão completa)
CREATE OR REPLACE FUNCTION app_core.create_tenant_credential(
    p_tenant_id UUID,
    p_platform TEXT,
    p_credential_name TEXT,
    p_access_token TEXT,
    p_refresh_token TEXT DEFAULT NULL,
    p_api_key TEXT DEFAULT NULL,
    p_api_secret TEXT DEFAULT NULL,
    p_webhook_url TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_config JSONB DEFAULT '{}'::jsonb,
    p_expires_in INTEGER DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    platform TEXT,
    credential_name TEXT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_encryption_key TEXT;
    v_encrypted_access_token TEXT;
    v_encrypted_refresh_token TEXT;
    v_encrypted_api_key TEXT;
    v_encrypted_api_secret TEXT;
    v_token_expires_at TIMESTAMPTZ;
    v_result_id UUID;
    v_result_tenant_id UUID;
    v_result_platform TEXT;
    v_result_credential_name TEXT;
    v_result_is_active BOOLEAN;
    v_result_created_at TIMESTAMPTZ;
    v_result_updated_at TIMESTAMPTZ;
BEGIN
    IF p_platform != 'CONTA_AZUL' THEN
        RAISE EXCEPTION 'Apenas plataforma CONTA_AZUL é suportada';
    END IF;

    IF p_credential_name IS NULL OR TRIM(p_credential_name) = '' THEN
        RAISE EXCEPTION 'credential_name é obrigatório';
    END IF;

    v_encryption_key := app_core.get_encryption_key();
    
    IF p_access_token IS NOT NULL THEN
        v_encrypted_access_token := app_core.encrypt_token(p_access_token, v_encryption_key);
    END IF;
    
    IF p_refresh_token IS NOT NULL THEN
        v_encrypted_refresh_token := app_core.encrypt_token(p_refresh_token, v_encryption_key);
    END IF;
    
    IF p_api_key IS NOT NULL THEN
        v_encrypted_api_key := app_core.encrypt_token(p_api_key, v_encryption_key);
    END IF;
    
    IF p_api_secret IS NOT NULL THEN
        v_encrypted_api_secret := app_core.encrypt_token(p_api_secret, v_encryption_key);
    END IF;
    
    IF p_expires_in IS NOT NULL THEN
        v_token_expires_at := NOW() + (p_expires_in * INTERVAL '1 second');
    ELSIF p_config IS NOT NULL AND p_config ? 'expires_in' THEN
        v_token_expires_at := NOW() + ((p_config->>'expires_in')::INTEGER * INTERVAL '1 second');
    ELSIF p_config IS NOT NULL AND p_config ? 'expires_at' THEN
        v_token_expires_at := (p_config->>'expires_at')::TIMESTAMPTZ;
    ELSE
        v_token_expires_at := NULL;
    END IF;
    
    INSERT INTO app_core.tenant_credentials (
        tenant_id,
        platform,
        credential_name,
        access_token,
        refresh_token,
        api_key,
        api_secret,
        webhook_url,
        is_active,
        config,
        token_expires_at,
        last_authenticated_at
    ) VALUES (
        p_tenant_id,
        p_platform,
        p_credential_name,
        v_encrypted_access_token,
        v_encrypted_refresh_token,
        v_encrypted_api_key,
        v_encrypted_api_secret,
        p_webhook_url,
        p_is_active,
        p_config,
        v_token_expires_at,
        NOW()
    )
    RETURNING 
        id,
        tenant_id,
        platform,
        credential_name,
        is_active,
        created_at,
        updated_at
    INTO 
        v_result_id,
        v_result_tenant_id,
        v_result_platform,
        v_result_credential_name,
        v_result_is_active,
        v_result_created_at,
        v_result_updated_at;
    
    UPDATE app_core.tenants
    SET connections_conta_azul = p_is_active
    WHERE id = p_tenant_id;
    
    RETURN QUERY
    SELECT 
        v_result_id,
        v_result_tenant_id,
        v_result_platform,
        v_result_credential_name,
        v_result_is_active,
        v_result_created_at,
        v_result_updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função update_tenant_credential (simplificada)
CREATE OR REPLACE FUNCTION app_core.update_tenant_credential(
    p_credential_id UUID,
    p_access_token TEXT DEFAULT NULL,
    p_refresh_token TEXT DEFAULT NULL,
    p_api_key TEXT DEFAULT NULL,
    p_api_secret TEXT DEFAULT NULL,
    p_webhook_url TEXT DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL,
    p_config JSONB DEFAULT NULL,
    p_expires_in INTEGER DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    platform TEXT,
    credential_name TEXT,
    is_active BOOLEAN,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_encryption_key TEXT;
    v_encrypted_access_token TEXT;
    v_encrypted_refresh_token TEXT;
    v_encrypted_api_key TEXT;
    v_encrypted_api_secret TEXT;
    v_token_expires_at TIMESTAMPTZ;
    v_result_id UUID;
    v_result_tenant_id UUID;
    v_result_platform TEXT;
    v_result_credential_name TEXT;
    v_result_is_active BOOLEAN;
    v_result_updated_at TIMESTAMPTZ;
BEGIN
    v_encryption_key := app_core.get_encryption_key();
    
    IF p_access_token IS NOT NULL THEN
        v_encrypted_access_token := app_core.encrypt_token(p_access_token, v_encryption_key);
    END IF;
    
    IF p_refresh_token IS NOT NULL THEN
        v_encrypted_refresh_token := app_core.encrypt_token(p_refresh_token, v_encryption_key);
    END IF;
    
    IF p_api_key IS NOT NULL THEN
        v_encrypted_api_key := app_core.encrypt_token(p_api_key, v_encryption_key);
    END IF;
    
    IF p_api_secret IS NOT NULL THEN
        v_encrypted_api_secret := app_core.encrypt_token(p_api_secret, v_encryption_key);
    END IF;
    
    IF p_expires_in IS NOT NULL THEN
        v_token_expires_at := NOW() + (p_expires_in * INTERVAL '1 second');
    ELSIF p_config IS NOT NULL AND p_config ? 'expires_in' THEN
        v_token_expires_at := NOW() + ((p_config->>'expires_in')::INTEGER * INTERVAL '1 second');
    ELSIF p_config IS NOT NULL AND p_config ? 'expires_at' THEN
        v_token_expires_at := (p_config->>'expires_at')::TIMESTAMPTZ;
    ELSE
        v_token_expires_at := NULL;
    END IF;
    
    UPDATE app_core.tenant_credentials tc
    SET 
        access_token = COALESCE(v_encrypted_access_token, tc.access_token),
        refresh_token = COALESCE(v_encrypted_refresh_token, tc.refresh_token),
        api_key = COALESCE(v_encrypted_api_key, tc.api_key),
        api_secret = COALESCE(v_encrypted_api_secret, tc.api_secret),
        webhook_url = COALESCE(p_webhook_url, tc.webhook_url),
        is_active = COALESCE(p_is_active, tc.is_active),
        config = COALESCE(p_config, tc.config),
        token_expires_at = COALESCE(v_token_expires_at, tc.token_expires_at),
        last_authenticated_at = CASE WHEN p_access_token IS NOT NULL THEN NOW() ELSE tc.last_authenticated_at END,
        updated_at = NOW()
    WHERE tc.id = p_credential_id
    RETURNING 
        tc.id,
        tc.tenant_id,
        tc.platform,
        tc.credential_name,
        tc.is_active,
        tc.updated_at
    INTO 
        v_result_id,
        v_result_tenant_id,
        v_result_platform,
        v_result_credential_name,
        v_result_is_active,
        v_result_updated_at;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Credencial não encontrada: %', p_credential_id;
    END IF;
    
    IF p_is_active IS NOT NULL THEN
        UPDATE app_core.tenants
        SET connections_conta_azul = p_is_active
        WHERE id = v_result_tenant_id;
    END IF;
    
    RETURN QUERY
    SELECT 
        v_result_id,
        v_result_tenant_id,
        v_result_platform,
        v_result_credential_name,
        v_result_is_active,
        v_result_updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função get_tenant_credential_decrypted (simplificada)
CREATE OR REPLACE FUNCTION app_core.get_tenant_credential_decrypted(
    p_credential_id UUID
)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    platform TEXT,
    credential_name TEXT,
    access_token TEXT,
    refresh_token TEXT,
    api_key TEXT,
    api_secret TEXT,
    webhook_url TEXT,
    is_active BOOLEAN,
    last_sync_at TIMESTAMPTZ,
    token_expires_at TIMESTAMPTZ,
    config JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_encryption_key TEXT;
BEGIN
    IF auth.uid() IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM app_core.tenants t
            INNER JOIN app_core.tenant_credentials tc ON tc.tenant_id = t.id
            WHERE tc.id = p_credential_id 
            AND (t.partner_id = auth.uid() OR app_core.is_admin(auth.uid()))
        ) THEN
            RAISE EXCEPTION 'Acesso negado';
        END IF;
    END IF;
    
    v_encryption_key := app_core.get_encryption_key();
    
    RETURN QUERY
    SELECT 
        tc.id,
        tc.tenant_id,
        tc.platform,
        tc.credential_name,
        CASE WHEN tc.access_token IS NOT NULL 
            THEN app_core.decrypt_token(tc.access_token, v_encryption_key)
            ELSE NULL 
        END as access_token,
        CASE WHEN tc.refresh_token IS NOT NULL 
            THEN app_core.decrypt_token(tc.refresh_token, v_encryption_key)
            ELSE NULL 
        END as refresh_token,
        CASE WHEN tc.api_key IS NOT NULL 
            THEN app_core.decrypt_token(tc.api_key, v_encryption_key)
            ELSE NULL 
        END as api_key,
        CASE WHEN tc.api_secret IS NOT NULL 
            THEN app_core.decrypt_token(tc.api_secret, v_encryption_key)
            ELSE NULL 
        END as api_secret,
        tc.webhook_url,
        tc.is_active,
        tc.last_sync_at,
        tc.token_expires_at,
        tc.config,
        tc.created_at,
        tc.updated_at
    FROM app_core.tenant_credentials tc
    WHERE tc.id = p_credential_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função create_audit_log
CREATE OR REPLACE FUNCTION app_core.create_audit_log(
    p_tenant_id UUID DEFAULT NULL,
    p_credential_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_action TEXT DEFAULT NULL,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_status TEXT DEFAULT 'SUCCESS',
    p_details TEXT DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO app_core.audit_logs (
        tenant_id,
        credential_id,
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
        p_credential_id,
        COALESCE(p_user_id, auth.uid()),
        p_action,
        p_entity_type,
        p_entity_id,
        p_status,
        p_details,
        p_ip_address,
        p_user_agent
    )
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

// Migration 005: Políticas RLS (simplificada - políticas principais)
const MIGRATION_005 = `
ALTER TABLE app_core.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_core.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_core.tenant_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_core.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_core.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dw.dw_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON app_core.profiles;
CREATE POLICY "Users can view own profile"
    ON app_core.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON app_core.profiles;
CREATE POLICY "Users can update own profile"
    ON app_core.profiles FOR UPDATE
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON app_core.profiles;
CREATE POLICY "Admins can view all profiles"
    ON app_core.profiles FOR SELECT
    USING (app_core.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON app_core.profiles;
CREATE POLICY "Users can insert own profile"
    ON app_core.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Partners can view own tenants" ON app_core.tenants;
CREATE POLICY "Partners can view own tenants"
    ON app_core.tenants FOR SELECT
    USING (
        partner_id = auth.uid() OR
        app_core.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Partners can create own tenants" ON app_core.tenants;
CREATE POLICY "Partners can create own tenants"
    ON app_core.tenants FOR INSERT
    WITH CHECK (partner_id = auth.uid());

DROP POLICY IF EXISTS "Partners can update own tenants" ON app_core.tenants;
CREATE POLICY "Partners can update own tenants"
    ON app_core.tenants FOR UPDATE
    USING (
        partner_id = auth.uid() OR
        app_core.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Only admins can delete tenants" ON app_core.tenants;
CREATE POLICY "Only admins can delete tenants"
    ON app_core.tenants FOR DELETE
    USING (app_core.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Partners can view own tenant credentials" ON app_core.tenant_credentials;
CREATE POLICY "Partners can view own tenant credentials"
    ON app_core.tenant_credentials FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app_core.tenants
            WHERE id = tenant_credentials.tenant_id AND partner_id = auth.uid()
        ) OR
        app_core.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Partners can create own tenant credentials" ON app_core.tenant_credentials;
CREATE POLICY "Partners can create own tenant credentials"
    ON app_core.tenant_credentials FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app_core.tenants
            WHERE id = tenant_credentials.tenant_id AND partner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Partners can update own tenant credentials" ON app_core.tenant_credentials;
CREATE POLICY "Partners can update own tenant credentials"
    ON app_core.tenant_credentials FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM app_core.tenants
            WHERE id = tenant_credentials.tenant_id AND partner_id = auth.uid()
        ) OR
        app_core.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Partners can delete own tenant credentials" ON app_core.tenant_credentials;
CREATE POLICY "Partners can delete own tenant credentials"
    ON app_core.tenant_credentials FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM app_core.tenants
            WHERE id = tenant_credentials.tenant_id AND partner_id = auth.uid()
        ) OR
        app_core.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Partners can view own tenant audit logs" ON app_core.audit_logs;
CREATE POLICY "Partners can view own tenant audit logs"
    ON app_core.audit_logs FOR SELECT
    USING (
        (tenant_id IS NULL OR EXISTS (
            SELECT 1 FROM app_core.tenants
            WHERE id = audit_logs.tenant_id AND partner_id = auth.uid()
        )) OR
        app_core.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "System can create audit logs" ON app_core.audit_logs;
CREATE POLICY "System can create audit logs"
    ON app_core.audit_logs FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own sessions" ON app_core.user_sessions;
CREATE POLICY "Users can view own sessions"
    ON app_core.user_sessions FOR SELECT
    USING (user_id = auth.uid() OR app_core.is_admin(auth.uid()));

DROP POLICY IF EXISTS "System can create sessions" ON app_core.user_sessions;
CREATE POLICY "System can create sessions"
    ON app_core.user_sessions FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Partners can view own dw api keys" ON dw.dw_api_keys;
CREATE POLICY "Partners can view own dw api keys"
    ON dw.dw_api_keys FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app_core.tenants
            WHERE id = dw_api_keys.tenant_id AND partner_id = auth.uid()
        ) OR
        app_core.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Partners can create own dw api keys" ON dw.dw_api_keys;
CREATE POLICY "Partners can create own dw api keys"
    ON dw.dw_api_keys FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app_core.tenants
            WHERE id = dw_api_keys.tenant_id AND partner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Partners can update own dw api keys" ON dw.dw_api_keys;
CREATE POLICY "Partners can update own dw api keys"
    ON dw.dw_api_keys FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM app_core.tenants
            WHERE id = dw_api_keys.tenant_id AND partner_id = auth.uid()
        ) OR
        app_core.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "Partners can delete own dw api keys" ON dw.dw_api_keys;
CREATE POLICY "Partners can delete own dw api keys"
    ON dw.dw_api_keys FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM app_core.tenants
            WHERE id = dw_api_keys.tenant_id AND partner_id = auth.uid()
        ) OR
        app_core.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "System can validate api keys" ON dw.dw_api_keys;
CREATE POLICY "System can validate api keys"
    ON dw.dw_api_keys FOR SELECT
    USING (true);
`;

// Migration 006: Criar Schema de Integração Conta Azul
const MIGRATION_006 = `-- ============================================================================
-- Migration 006: Criar Schema de Integração Conta Azul
-- ============================================================================
-- Cria o schema específico para dados da Conta Azul.
-- Nota: O schema 'integrations' (compartilhado) já foi criado na migration 001.
-- ============================================================================

-- Criar schema integrations_conta_azul (específico da Conta Azul)
CREATE SCHEMA IF NOT EXISTS integrations_conta_azul;

COMMENT ON SCHEMA integrations_conta_azul IS 'Schema específico para dados coletados da API Conta Azul (categorias, pessoas, produtos, vendas, contas financeiras, etc.)';

-- Conceder permissões básicas
GRANT USAGE ON SCHEMA integrations_conta_azul TO authenticated;
GRANT USAGE ON SCHEMA integrations_conta_azul TO anon;
GRANT USAGE ON SCHEMA integrations_conta_azul TO service_role; -- Necessário caso Edge Functions precisem acessar RPCs

-- Nota: As permissões específicas de SELECT/INSERT/UPDATE/DELETE serão configuradas
-- através de RLS (Row Level Security) nas migrations de RLS
`;

// Migration 007: Criar Tabelas Compartilhadas de Controle
const MIGRATION_007 = `-- ============================================================================
-- Migration 007: Criar Tabelas Compartilhadas de Controle
-- ============================================================================
-- Tabelas compartilhadas entre todas as plataformas de integração:
-- - controle_carga: Controla status de carga FULL e incremental
-- - config_periodicidade: Configuração de periodicidade
-- ============================================================================

-- ============================================
-- TABELA: controle_carga
-- Controla o status de carga FULL e incremental por tenant, plataforma e entidade
-- ============================================
CREATE TABLE IF NOT EXISTS integrations.controle_carga (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    platform TEXT NOT NULL CHECK (platform = 'CONTA_AZUL'),
    entidade_tipo TEXT NOT NULL,
    carga_full_realizada BOOLEAN DEFAULT FALSE,
    ultima_carga_full TIMESTAMPTZ,
    ultima_carga_incremental TIMESTAMPTZ,
    ultima_data_processada TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, platform, entidade_tipo, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_controle_carga_tenant_id ON integrations.controle_carga(tenant_id);
CREATE INDEX IF NOT EXISTS idx_controle_carga_credential_id ON integrations.controle_carga(credential_id);
CREATE INDEX IF NOT EXISTS idx_controle_carga_platform ON integrations.controle_carga(platform);
CREATE INDEX IF NOT EXISTS idx_controle_carga_entidade_tipo ON integrations.controle_carga(entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_controle_carga_tenant_platform_entidade ON integrations.controle_carga(tenant_id, platform, entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_controle_carga_full_realizada ON integrations.controle_carga(carga_full_realizada) WHERE carga_full_realizada = FALSE;

DROP TRIGGER IF EXISTS update_controle_carga_updated_at ON integrations.controle_carga;
CREATE TRIGGER update_controle_carga_updated_at
    BEFORE UPDATE ON integrations.controle_carga
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

-- ============================================
-- TABELA: config_periodicidade
-- Configuração de periodicidade por tenant, plataforma e entidade (uso futuro)
-- ============================================
CREATE TABLE IF NOT EXISTS integrations.config_periodicidade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    platform TEXT NOT NULL CHECK (platform = 'CONTA_AZUL'),
    entidade_tipo TEXT NOT NULL,
    periodicidade_tipo TEXT NOT NULL CHECK (periodicidade_tipo IN ('minuto', 'hora', 'dia', 'semana', 'mes')),
    periodicidade_valor INTEGER NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    proxima_execucao TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, platform, entidade_tipo, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_config_periodicidade_tenant_id ON integrations.config_periodicidade(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_credential_id ON integrations.config_periodicidade(credential_id);
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_platform ON integrations.config_periodicidade(platform);
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_entidade_tipo ON integrations.config_periodicidade(entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_tenant_platform_entidade ON integrations.config_periodicidade(tenant_id, platform, entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_ativo ON integrations.config_periodicidade(ativo) WHERE ativo = TRUE;
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_proxima_execucao ON integrations.config_periodicidade(proxima_execucao);

DROP TRIGGER IF EXISTS update_config_periodicidade_updated_at ON integrations.config_periodicidade;
CREATE TRIGGER update_config_periodicidade_updated_at
    BEFORE UPDATE ON integrations.config_periodicidade
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations.controle_carga IS 'Controla o status de carga FULL e incremental por tenant, plataforma e entidade. Suporta múltiplas credenciais por tenant.';
COMMENT ON TABLE integrations.config_periodicidade IS 'Configuração de periodicidade por tenant, plataforma e entidade (uso futuro). Suporta múltiplas credenciais por tenant.';
`;

// Migration 008: 008 Create Integrations Conta Azul Entities
const MIGRATION_008 = `-- ============================================================================
-- Migration 008: Criar Tabelas de Entidades Conta Azul
-- ============================================================================
-- Tabelas cadastrais sem dependências: pessoas, categorias, categorias_dre,
-- centro_custos, produtos, servicos, vendedores, contas_financeiras
-- ============================================================================

-- ============================================
-- TABELA: pessoas
-- Armazena pessoas (clientes/fornecedores) coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_conta_azul.pessoas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    pessoa_id TEXT NOT NULL, -- ID da pessoa na API Conta Azul (campo 'id' do JSON)
    id_legado INTEGER,
    uuid_legado TEXT,
    nome TEXT NOT NULL,
    documento TEXT,
    email TEXT,
    telefone TEXT,
    tipo_pessoa TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    codigo TEXT,
    perfis TEXT[],
    data_alteracao TIMESTAMPTZ,
    data_criacao TIMESTAMPTZ,
    observacoes_gerais TEXT,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, pessoa_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_pessoas_tenant_id ON integrations_conta_azul.pessoas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_credential_id ON integrations_conta_azul.pessoas(credential_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_pessoa_id ON integrations_conta_azul.pessoas(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_tenant_pessoa ON integrations_conta_azul.pessoas(tenant_id, pessoa_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_created_at ON integrations_conta_azul.pessoas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pessoas_nome ON integrations_conta_azul.pessoas(nome);
CREATE INDEX IF NOT EXISTS idx_pessoas_documento ON integrations_conta_azul.pessoas(documento);
CREATE INDEX IF NOT EXISTS idx_pessoas_email ON integrations_conta_azul.pessoas(email);
CREATE INDEX IF NOT EXISTS idx_pessoas_tipo_pessoa ON integrations_conta_azul.pessoas(tipo_pessoa);
CREATE INDEX IF NOT EXISTS idx_pessoas_ativo ON integrations_conta_azul.pessoas(ativo);
CREATE INDEX IF NOT EXISTS idx_pessoas_codigo ON integrations_conta_azul.pessoas(codigo);
CREATE INDEX IF NOT EXISTS idx_pessoas_data_alteracao ON integrations_conta_azul.pessoas(data_alteracao DESC);
CREATE INDEX IF NOT EXISTS idx_pessoas_data_criacao ON integrations_conta_azul.pessoas(data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_pessoas_perfis ON integrations_conta_azul.pessoas USING GIN (perfis);
CREATE INDEX IF NOT EXISTS idx_pessoas_dados_originais ON integrations_conta_azul.pessoas USING GIN (dados_originais);

DROP TRIGGER IF EXISTS update_pessoas_updated_at ON integrations_conta_azul.pessoas;
CREATE TRIGGER update_pessoas_updated_at
    BEFORE UPDATE ON integrations_conta_azul.pessoas
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations_conta_azul.pessoas IS 'Armazena pessoas (clientes/fornecedores) coletadas da API Conta Azul';
COMMENT ON COLUMN integrations_conta_azul.pessoas.tenant_id IS 'ID do tenant (cliente)';
COMMENT ON COLUMN integrations_conta_azul.pessoas.credential_id IS 'ID da credencial específica (opcional, para suportar múltiplas credenciais por tenant)';
COMMENT ON COLUMN integrations_conta_azul.pessoas.pessoa_id IS 'ID da pessoa na API Conta Azul';

-- ============================================
-- TABELA: categorias
-- Armazena categorias coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_conta_azul.categorias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    categoria_id TEXT NOT NULL,
    versao INTEGER,
    nome TEXT NOT NULL,
    categoria_pai TEXT,
    tipo TEXT CHECK (tipo IS NULL OR tipo IN ('RECEITA', 'DESPESA')),
    entrada_dre TEXT,
    considera_custo_dre BOOLEAN DEFAULT FALSE,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, categoria_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_categorias_tenant_id ON integrations_conta_azul.categorias(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categorias_credential_id ON integrations_conta_azul.categorias(credential_id);
CREATE INDEX IF NOT EXISTS idx_categorias_categoria_id ON integrations_conta_azul.categorias(categoria_id);
CREATE INDEX IF NOT EXISTS idx_categorias_tenant_categoria ON integrations_conta_azul.categorias(tenant_id, categoria_id);
CREATE INDEX IF NOT EXISTS idx_categorias_created_at ON integrations_conta_azul.categorias(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categorias_nome ON integrations_conta_azul.categorias(nome);
CREATE INDEX IF NOT EXISTS idx_categorias_tipo ON integrations_conta_azul.categorias(tipo);
CREATE INDEX IF NOT EXISTS idx_categorias_categoria_pai ON integrations_conta_azul.categorias(tenant_id, categoria_pai) WHERE categoria_pai IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_categorias_dados_originais ON integrations_conta_azul.categorias USING GIN (dados_originais);

DROP TRIGGER IF EXISTS update_categorias_updated_at ON integrations_conta_azul.categorias;
CREATE TRIGGER update_categorias_updated_at
    BEFORE UPDATE ON integrations_conta_azul.categorias
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations_conta_azul.categorias IS 'Armazena categorias coletadas da API Conta Azul';

-- ============================================
-- TABELA: categorias_dre
-- Armazena categorias DRE coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_conta_azul.categorias_dre (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    categoria_dre_id TEXT NOT NULL,
    descricao TEXT NOT NULL,
    codigo TEXT,
    posicao INTEGER,
    indica_totalizador BOOLEAN DEFAULT FALSE,
    representa_soma_custo_medio BOOLEAN DEFAULT FALSE,
    categoria_dre_pai_id TEXT,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, categoria_dre_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_categorias_dre_tenant_id ON integrations_conta_azul.categorias_dre(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_credential_id ON integrations_conta_azul.categorias_dre(credential_id);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_categoria_dre_id ON integrations_conta_azul.categorias_dre(categoria_dre_id);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_tenant_categoria ON integrations_conta_azul.categorias_dre(tenant_id, categoria_dre_id);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_created_at ON integrations_conta_azul.categorias_dre(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_descricao ON integrations_conta_azul.categorias_dre(descricao);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_codigo ON integrations_conta_azul.categorias_dre(codigo);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_posicao ON integrations_conta_azul.categorias_dre(posicao);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_indica_totalizador ON integrations_conta_azul.categorias_dre(indica_totalizador);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_categoria_dre_pai_id ON integrations_conta_azul.categorias_dre(categoria_dre_pai_id);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_dados_originais ON integrations_conta_azul.categorias_dre USING GIN (dados_originais);

DROP TRIGGER IF EXISTS update_categorias_dre_updated_at ON integrations_conta_azul.categorias_dre;
CREATE TRIGGER update_categorias_dre_updated_at
    BEFORE UPDATE ON integrations_conta_azul.categorias_dre
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations_conta_azul.categorias_dre IS 'Armazena categorias DRE coletadas da API Conta Azul';

-- ============================================
-- TABELA: centro_custos
-- Armazena centros de custo coletados da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_conta_azul.centro_custos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    centro_custo_id TEXT NOT NULL,
    codigo TEXT,
    nome TEXT NOT NULL,
    ativo BOOLEAN DEFAULT TRUE,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, centro_custo_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_centro_custos_tenant_id ON integrations_conta_azul.centro_custos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_centro_custos_credential_id ON integrations_conta_azul.centro_custos(credential_id);
CREATE INDEX IF NOT EXISTS idx_centro_custos_centro_custo_id ON integrations_conta_azul.centro_custos(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_centro_custos_tenant_centro_custo ON integrations_conta_azul.centro_custos(tenant_id, centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_centro_custos_created_at ON integrations_conta_azul.centro_custos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_centro_custos_nome ON integrations_conta_azul.centro_custos(nome);
CREATE INDEX IF NOT EXISTS idx_centro_custos_codigo ON integrations_conta_azul.centro_custos(codigo);
CREATE INDEX IF NOT EXISTS idx_centro_custos_ativo ON integrations_conta_azul.centro_custos(ativo);
CREATE INDEX IF NOT EXISTS idx_centro_custos_dados_originais ON integrations_conta_azul.centro_custos USING GIN (dados_originais);

DROP TRIGGER IF EXISTS update_centro_custos_updated_at ON integrations_conta_azul.centro_custos;
CREATE TRIGGER update_centro_custos_updated_at
    BEFORE UPDATE ON integrations_conta_azul.centro_custos
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations_conta_azul.centro_custos IS 'Armazena centros de custo coletados da API Conta Azul';

-- ============================================
-- TABELA: produtos
-- Armazena produtos coletados da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_conta_azul.produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    produto_id TEXT NOT NULL,
    codigo TEXT,
    nome TEXT NOT NULL,
    ean TEXT,
    sku TEXT,
    status TEXT,
    tipo TEXT,
    custo_medio NUMERIC,
    estoque_minimo NUMERIC,
    estoque_maximo NUMERIC,
    saldo NUMERIC,
    valor_venda NUMERIC,
    id_legado INTEGER,
    integracao_ecommerce_ativada BOOLEAN DEFAULT FALSE,
    movido BOOLEAN DEFAULT FALSE,
    nivel_estoque TEXT,
    ultima_atualizacao TIMESTAMPTZ,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, produto_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_produtos_tenant_id ON integrations_conta_azul.produtos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_produtos_credential_id ON integrations_conta_azul.produtos(credential_id);
CREATE INDEX IF NOT EXISTS idx_produtos_produto_id ON integrations_conta_azul.produtos(produto_id);
CREATE INDEX IF NOT EXISTS idx_produtos_tenant_produto ON integrations_conta_azul.produtos(tenant_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_produtos_created_at ON integrations_conta_azul.produtos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_produtos_nome ON integrations_conta_azul.produtos(nome);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON integrations_conta_azul.produtos(codigo);
CREATE INDEX IF NOT EXISTS idx_produtos_ean ON integrations_conta_azul.produtos(ean);
CREATE INDEX IF NOT EXISTS idx_produtos_sku ON integrations_conta_azul.produtos(sku);
CREATE INDEX IF NOT EXISTS idx_produtos_status ON integrations_conta_azul.produtos(status);
CREATE INDEX IF NOT EXISTS idx_produtos_tipo ON integrations_conta_azul.produtos(tipo);
CREATE INDEX IF NOT EXISTS idx_produtos_ultima_atualizacao ON integrations_conta_azul.produtos(ultima_atualizacao DESC);
CREATE INDEX IF NOT EXISTS idx_produtos_dados_originais ON integrations_conta_azul.produtos USING GIN (dados_originais);

DROP TRIGGER IF EXISTS update_produtos_updated_at ON integrations_conta_azul.produtos;
CREATE TRIGGER update_produtos_updated_at
    BEFORE UPDATE ON integrations_conta_azul.produtos
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations_conta_azul.produtos IS 'Armazena produtos coletados da API Conta Azul';

-- ============================================
-- TABELA: servicos
-- Armazena serviços coletados da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_conta_azul.servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    servico_id TEXT NOT NULL,
    codigo TEXT,
    descricao TEXT NOT NULL,
    codigo_cnae TEXT,
    codigo_municipio_servico TEXT,
    custo NUMERIC,
    preco NUMERIC,
    status TEXT CHECK (status IS NULL OR status IN ('ATIVO', 'INATIVO')),
    tipo_servico TEXT CHECK (tipo_servico IS NULL OR tipo_servico IN ('PRESTADO', 'TOMADO', 'AMBOS')),
    id_servico INTEGER,
    id_externo TEXT,
    lei_116 TEXT,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, servico_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_servicos_tenant_id ON integrations_conta_azul.servicos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_servicos_credential_id ON integrations_conta_azul.servicos(credential_id);
CREATE INDEX IF NOT EXISTS idx_servicos_servico_id ON integrations_conta_azul.servicos(servico_id);
CREATE INDEX IF NOT EXISTS idx_servicos_tenant_servico ON integrations_conta_azul.servicos(tenant_id, servico_id);
CREATE INDEX IF NOT EXISTS idx_servicos_created_at ON integrations_conta_azul.servicos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_servicos_descricao ON integrations_conta_azul.servicos(descricao);
CREATE INDEX IF NOT EXISTS idx_servicos_codigo ON integrations_conta_azul.servicos(codigo);
CREATE INDEX IF NOT EXISTS idx_servicos_codigo_cnae ON integrations_conta_azul.servicos(codigo_cnae);
CREATE INDEX IF NOT EXISTS idx_servicos_status ON integrations_conta_azul.servicos(status);
CREATE INDEX IF NOT EXISTS idx_servicos_tipo_servico ON integrations_conta_azul.servicos(tipo_servico);
CREATE INDEX IF NOT EXISTS idx_servicos_id_servico ON integrations_conta_azul.servicos(id_servico);
CREATE INDEX IF NOT EXISTS idx_servicos_dados_originais ON integrations_conta_azul.servicos USING GIN (dados_originais);

DROP TRIGGER IF EXISTS update_servicos_updated_at ON integrations_conta_azul.servicos;
CREATE TRIGGER update_servicos_updated_at
    BEFORE UPDATE ON integrations_conta_azul.servicos
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations_conta_azul.servicos IS 'Armazena serviços coletados da API Conta Azul';

-- ============================================
-- TABELA: vendedores
-- Armazena vendedores coletados da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_conta_azul.vendedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    vendedor_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    id_legado INTEGER,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, vendedor_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_vendedores_tenant_id ON integrations_conta_azul.vendedores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendedores_credential_id ON integrations_conta_azul.vendedores(credential_id);
CREATE INDEX IF NOT EXISTS idx_vendedores_vendedor_id ON integrations_conta_azul.vendedores(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_vendedores_tenant_vendedor ON integrations_conta_azul.vendedores(tenant_id, vendedor_id);
CREATE INDEX IF NOT EXISTS idx_vendedores_created_at ON integrations_conta_azul.vendedores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendedores_nome ON integrations_conta_azul.vendedores(nome);
CREATE INDEX IF NOT EXISTS idx_vendedores_id_legado ON integrations_conta_azul.vendedores(id_legado);
CREATE INDEX IF NOT EXISTS idx_vendedores_dados_originais ON integrations_conta_azul.vendedores USING GIN (dados_originais);

DROP TRIGGER IF EXISTS update_vendedores_updated_at ON integrations_conta_azul.vendedores;
CREATE TRIGGER update_vendedores_updated_at
    BEFORE UPDATE ON integrations_conta_azul.vendedores
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations_conta_azul.vendedores IS 'Armazena vendedores coletados da API Conta Azul';

-- ============================================
-- TABELA: contas_financeiras
-- Armazena contas financeiras coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_conta_azul.contas_financeiras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    conta_financeira_id TEXT NOT NULL,
    nome TEXT,
    tipo TEXT,
    banco TEXT,
    codigo_banco INTEGER,
    ativo BOOLEAN,
    conta_padrao BOOLEAN,
    possui_config_boleto_bancario BOOLEAN,
    agencia TEXT,
    numero TEXT,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, conta_financeira_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_contas_financeiras_tenant_id ON integrations_conta_azul.contas_financeiras(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_credential_id ON integrations_conta_azul.contas_financeiras(credential_id);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_conta_financeira_id ON integrations_conta_azul.contas_financeiras(conta_financeira_id);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_tenant_conta ON integrations_conta_azul.contas_financeiras(tenant_id, conta_financeira_id);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_created_at ON integrations_conta_azul.contas_financeiras(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_tipo ON integrations_conta_azul.contas_financeiras(tipo);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_ativo ON integrations_conta_azul.contas_financeiras(ativo);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_conta_padrao ON integrations_conta_azul.contas_financeiras(conta_padrao);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_dados_originais ON integrations_conta_azul.contas_financeiras USING GIN (dados_originais);

DROP TRIGGER IF EXISTS update_contas_financeiras_updated_at ON integrations_conta_azul.contas_financeiras;
CREATE TRIGGER update_contas_financeiras_updated_at
    BEFORE UPDATE ON integrations_conta_azul.contas_financeiras
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations_conta_azul.contas_financeiras IS 'Armazena contas financeiras coletadas da API Conta Azul';
`;

// Migration 009: 009 Create Integrations Conta Azul Financial
const MIGRATION_009 = `-- ============================================================================
-- Migration 009: Criar Tabelas Financeiras Conta Azul
-- ============================================================================
-- Tabelas financeiras: contas_pagar, contas_receber, contas_pagar_detalhadas,
-- contas_receber_detalhadas, parcelas_detalhes, contratos, saldos_contas
-- ============================================================================

-- ============================================
-- TABELA: contas_pagar
-- Armazena contas a pagar coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_conta_azul.contas_pagar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    conta_pagar_id TEXT NOT NULL,
    descricao TEXT,
    data_vencimento DATE,
    status TEXT,
    status_traduzido TEXT,
    total NUMERIC(15,2),
    nao_pago NUMERIC(15,2),
    pago NUMERIC(15,2),
    data_criacao TIMESTAMPTZ,
    data_alteracao TIMESTAMPTZ,
    fornecedor_id TEXT,
    fornecedor_nome TEXT,
    detalhado BOOLEAN DEFAULT FALSE,
    data_detalhamento TIMESTAMPTZ,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, conta_pagar_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_tenant_id ON integrations_conta_azul.contas_pagar(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_credential_id ON integrations_conta_azul.contas_pagar(credential_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_conta_pagar_id ON integrations_conta_azul.contas_pagar(conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_tenant_conta_pagar ON integrations_conta_azul.contas_pagar(tenant_id, conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_created_at ON integrations_conta_azul.contas_pagar(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_vencimento ON integrations_conta_azul.contas_pagar(data_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON integrations_conta_azul.contas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status_traduzido ON integrations_conta_azul.contas_pagar(status_traduzido);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_criacao ON integrations_conta_azul.contas_pagar(data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_alteracao ON integrations_conta_azul.contas_pagar(data_alteracao DESC);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_fornecedor_id ON integrations_conta_azul.contas_pagar(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_fornecedor_nome ON integrations_conta_azul.contas_pagar(fornecedor_nome);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhado ON integrations_conta_azul.contas_pagar(detalhado);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_tenant_detalhado ON integrations_conta_azul.contas_pagar(tenant_id, detalhado);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_detalhamento ON integrations_conta_azul.contas_pagar(data_detalhamento DESC);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_dados_originais ON integrations_conta_azul.contas_pagar USING GIN (dados_originais);

DROP TRIGGER IF EXISTS update_contas_pagar_updated_at ON integrations_conta_azul.contas_pagar;
CREATE TRIGGER update_contas_pagar_updated_at
    BEFORE UPDATE ON integrations_conta_azul.contas_pagar
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations_conta_azul.contas_pagar IS 'Armazena contas a pagar coletadas da API Conta Azul';

-- ============================================
-- TABELA: contas_receber
-- Armazena contas a receber coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_conta_azul.contas_receber (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    conta_receber_id TEXT NOT NULL,
    descricao TEXT,
    data_vencimento DATE,
    status TEXT,
    status_traduzido TEXT,
    total NUMERIC(15,2),
    nao_pago NUMERIC(15,2),
    pago NUMERIC(15,2),
    data_criacao TIMESTAMPTZ,
    data_alteracao TIMESTAMPTZ,
    cliente_conta_id TEXT,
    cliente_conta_nome TEXT,
    detalhado BOOLEAN DEFAULT FALSE,
    data_detalhamento TIMESTAMPTZ,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, conta_receber_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_contas_receber_tenant_id ON integrations_conta_azul.contas_receber(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_credential_id ON integrations_conta_azul.contas_receber(credential_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_conta_receber_id ON integrations_conta_azul.contas_receber(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_tenant_conta_receber ON integrations_conta_azul.contas_receber(tenant_id, conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_created_at ON integrations_conta_azul.contas_receber(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contas_receber_data_vencimento ON integrations_conta_azul.contas_receber(data_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_contas_receber_status ON integrations_conta_azul.contas_receber(status);
CREATE INDEX IF NOT EXISTS idx_contas_receber_status_traduzido ON integrations_conta_azul.contas_receber(status_traduzido);
CREATE INDEX IF NOT EXISTS idx_contas_receber_data_criacao ON integrations_conta_azul.contas_receber(data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_contas_receber_data_alteracao ON integrations_conta_azul.contas_receber(data_alteracao DESC);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente_conta_id ON integrations_conta_azul.contas_receber(cliente_conta_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente_conta_nome ON integrations_conta_azul.contas_receber(cliente_conta_nome);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhado ON integrations_conta_azul.contas_receber(detalhado);
CREATE INDEX IF NOT EXISTS idx_contas_receber_tenant_detalhado ON integrations_conta_azul.contas_receber(tenant_id, detalhado);
CREATE INDEX IF NOT EXISTS idx_contas_receber_data_detalhamento ON integrations_conta_azul.contas_receber(data_detalhamento DESC);
CREATE INDEX IF NOT EXISTS idx_contas_receber_dados_originais ON integrations_conta_azul.contas_receber USING GIN (dados_originais);

DROP TRIGGER IF EXISTS update_contas_receber_updated_at ON integrations_conta_azul.contas_receber;
CREATE TRIGGER update_contas_receber_updated_at
    BEFORE UPDATE ON integrations_conta_azul.contas_receber
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations_conta_azul.contas_receber IS 'Armazena contas a receber coletadas da API Conta Azul';

-- ============================================
-- TABELA: contas_pagar_detalhadas
-- Armazena detalhamento de contas a pagar com rateio expandido
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_conta_azul.contas_pagar_detalhadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    conta_pagar_id TEXT NOT NULL,
    parcela_id TEXT NOT NULL,
    categoria_id TEXT,
    categoria_nome TEXT,
    centro_custo_id TEXT,
    centro_custo_nome TEXT,
    valor_rateio NUMERIC(15,2),
    valor_total_parcela NUMERIC(15,2),
    valor_pago NUMERIC(15,2),
    valor_nao_pago NUMERIC(15,2),
    data_vencimento DATE,
    status TEXT,
    status_traduzido TEXT,
    fornecedor_id TEXT,
    fornecedor_nome TEXT,
    evento_id TEXT,
    evento_tipo TEXT,
    data_competencia DATE,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, conta_pagar_id, parcela_id, categoria_id, centro_custo_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_tenant_id ON integrations_conta_azul.contas_pagar_detalhadas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_credential_id ON integrations_conta_azul.contas_pagar_detalhadas(credential_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_conta_pagar_id ON integrations_conta_azul.contas_pagar_detalhadas(conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_parcela_id ON integrations_conta_azul.contas_pagar_detalhadas(parcela_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_tenant_conta_parcela ON integrations_conta_azul.contas_pagar_detalhadas(tenant_id, conta_pagar_id, parcela_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_categoria_id ON integrations_conta_azul.contas_pagar_detalhadas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_centro_custo_id ON integrations_conta_azul.contas_pagar_detalhadas(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_data_vencimento ON integrations_conta_azul.contas_pagar_detalhadas(data_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_status ON integrations_conta_azul.contas_pagar_detalhadas(status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_fornecedor_id ON integrations_conta_azul.contas_pagar_detalhadas(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_evento_id ON integrations_conta_azul.contas_pagar_detalhadas(evento_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_created_at ON integrations_conta_azul.contas_pagar_detalhadas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_dados_originais ON integrations_conta_azul.contas_pagar_detalhadas USING GIN (dados_originais);

DROP TRIGGER IF EXISTS update_contas_pagar_detalhadas_updated_at ON integrations_conta_azul.contas_pagar_detalhadas;
CREATE TRIGGER update_contas_pagar_detalhadas_updated_at
    BEFORE UPDATE ON integrations_conta_azul.contas_pagar_detalhadas
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations_conta_azul.contas_pagar_detalhadas IS 'Armazena detalhamento de contas a pagar com rateio expandido';

-- ============================================
-- TABELA: contas_receber_detalhadas
-- Armazena detalhamento de contas a receber com rateio expandido
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_conta_azul.contas_receber_detalhadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    conta_receber_id TEXT NOT NULL,
    parcela_id TEXT NOT NULL,
    categoria_id TEXT,
    categoria_nome TEXT,
    centro_custo_id TEXT,
    centro_custo_nome TEXT,
    valor_rateio NUMERIC(15,2),
    valor_total_parcela NUMERIC(15,2),
    valor_pago NUMERIC(15,2),
    valor_nao_pago NUMERIC(15,2),
    data_vencimento DATE,
    status TEXT,
    status_traduzido TEXT,
    cliente_conta_id TEXT,
    cliente_conta_nome TEXT,
    evento_id TEXT,
    evento_tipo TEXT,
    data_competencia DATE,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, conta_receber_id, parcela_id, categoria_id, centro_custo_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_tenant_id ON integrations_conta_azul.contas_receber_detalhadas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_credential_id ON integrations_conta_azul.contas_receber_detalhadas(credential_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_conta_receber_id ON integrations_conta_azul.contas_receber_detalhadas(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_parcela_id ON integrations_conta_azul.contas_receber_detalhadas(parcela_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_tenant_conta_parcela ON integrations_conta_azul.contas_receber_detalhadas(tenant_id, conta_receber_id, parcela_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_categoria_id ON integrations_conta_azul.contas_receber_detalhadas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_centro_custo_id ON integrations_conta_azul.contas_receber_detalhadas(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_data_vencimento ON integrations_conta_azul.contas_receber_detalhadas(data_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_status ON integrations_conta_azul.contas_receber_detalhadas(status);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_cliente_conta_id ON integrations_conta_azul.contas_receber_detalhadas(cliente_conta_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_evento_id ON integrations_conta_azul.contas_receber_detalhadas(evento_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_created_at ON integrations_conta_azul.contas_receber_detalhadas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_dados_originais ON integrations_conta_azul.contas_receber_detalhadas USING GIN (dados_originais);

DROP TRIGGER IF EXISTS update_contas_receber_detalhadas_updated_at ON integrations_conta_azul.contas_receber_detalhadas;
CREATE TRIGGER update_contas_receber_detalhadas_updated_at
    BEFORE UPDATE ON integrations_conta_azul.contas_receber_detalhadas
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations_conta_azul.contas_receber_detalhadas IS 'Armazena detalhamento de contas a receber com rateio expandido';

-- ============================================
-- TABELA: parcelas_detalhes
-- Armazena detalhamento de parcelas de todas as entidades financeiras
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_conta_azul.parcelas_detalhes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    entidade_tipo TEXT NOT NULL,
    parcela_id TEXT NOT NULL,
    detalhado BOOLEAN DEFAULT FALSE,
    data_detalhamento TIMESTAMPTZ,
    detalhes_parcela JSONB,
    rateio JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, entidade_tipo, parcela_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_tenant_id ON integrations_conta_azul.parcelas_detalhes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_credential_id ON integrations_conta_azul.parcelas_detalhes(credential_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_entidade_tipo ON integrations_conta_azul.parcelas_detalhes(entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_parcela_id ON integrations_conta_azul.parcelas_detalhes(parcela_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_tenant_entidade_parcela ON integrations_conta_azul.parcelas_detalhes(tenant_id, entidade_tipo, parcela_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_detalhado ON integrations_conta_azul.parcelas_detalhes(detalhado);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_tenant_entidade_detalhado ON integrations_conta_azul.parcelas_detalhes(tenant_id, entidade_tipo, detalhado);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_data_detalhamento ON integrations_conta_azul.parcelas_detalhes(data_detalhamento DESC);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_detalhes_parcela ON integrations_conta_azul.parcelas_detalhes USING GIN (detalhes_parcela);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_rateio ON integrations_conta_azul.parcelas_detalhes USING GIN (rateio);

DROP TRIGGER IF EXISTS update_parcelas_detalhes_updated_at ON integrations_conta_azul.parcelas_detalhes;
CREATE TRIGGER update_parcelas_detalhes_updated_at
    BEFORE UPDATE ON integrations_conta_azul.parcelas_detalhes
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations_conta_azul.parcelas_detalhes IS 'Armazena detalhamento de parcelas de todas as entidades financeiras';

-- ============================================
-- TABELA: contratos
-- Armazena contratos coletados da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_conta_azul.contratos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    contrato_id TEXT NOT NULL,
    numero INTEGER,
    data_inicio DATE,
    status TEXT,
    proximo_vencimento DATE,
    cliente_contrato_id TEXT,
    cliente_contrato_nome TEXT,
    data_criacao TIMESTAMPTZ,
    data_alteracao TIMESTAMPTZ,
    versao INTEGER,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, contrato_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_contratos_tenant_id ON integrations_conta_azul.contratos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contratos_credential_id ON integrations_conta_azul.contratos(credential_id);
CREATE INDEX IF NOT EXISTS idx_contratos_contrato_id ON integrations_conta_azul.contratos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contratos_tenant_contrato_id ON integrations_conta_azul.contratos(tenant_id, contrato_id);
CREATE INDEX IF NOT EXISTS idx_contratos_created_at ON integrations_conta_azul.contratos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_data_inicio ON integrations_conta_azul.contratos(data_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_numero ON integrations_conta_azul.contratos(numero);
CREATE INDEX IF NOT EXISTS idx_contratos_status ON integrations_conta_azul.contratos(status);
CREATE INDEX IF NOT EXISTS idx_contratos_proximo_vencimento ON integrations_conta_azul.contratos(proximo_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_data_criacao ON integrations_conta_azul.contratos(data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_data_alteracao ON integrations_conta_azul.contratos(data_alteracao DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_cliente_contrato_id_field ON integrations_conta_azul.contratos(cliente_contrato_id);
CREATE INDEX IF NOT EXISTS idx_contratos_cliente_contrato_nome ON integrations_conta_azul.contratos(cliente_contrato_nome);
CREATE INDEX IF NOT EXISTS idx_contratos_dados_originais ON integrations_conta_azul.contratos USING GIN (dados_originais);

DROP TRIGGER IF EXISTS update_contratos_updated_at ON integrations_conta_azul.contratos;
CREATE TRIGGER update_contratos_updated_at
    BEFORE UPDATE ON integrations_conta_azul.contratos
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations_conta_azul.contratos IS 'Armazena contratos coletados da API Conta Azul';

-- ============================================
-- TABELA: saldos_contas
-- Armazena histórico temporal de saldos das contas financeiras
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_conta_azul.saldos_contas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    conta_financeira_id TEXT NOT NULL,
    saldo_atual NUMERIC(15,2) NOT NULL,
    data_coleta TIMESTAMPTZ DEFAULT NOW(),
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_saldos_contas_tenant_id ON integrations_conta_azul.saldos_contas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saldos_contas_credential_id ON integrations_conta_azul.saldos_contas(credential_id);
CREATE INDEX IF NOT EXISTS idx_saldos_contas_conta_financeira_id ON integrations_conta_azul.saldos_contas(conta_financeira_id);
CREATE INDEX IF NOT EXISTS idx_saldos_contas_tenant_conta ON integrations_conta_azul.saldos_contas(tenant_id, conta_financeira_id);
CREATE INDEX IF NOT EXISTS idx_saldos_contas_data_coleta ON integrations_conta_azul.saldos_contas(data_coleta DESC);
CREATE INDEX IF NOT EXISTS idx_saldos_contas_created_at ON integrations_conta_azul.saldos_contas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saldos_contas_tenant_conta_data ON integrations_conta_azul.saldos_contas(tenant_id, conta_financeira_id, data_coleta DESC);
CREATE INDEX IF NOT EXISTS idx_saldos_contas_dados_originais ON integrations_conta_azul.saldos_contas USING GIN (dados_originais);

DROP TRIGGER IF EXISTS update_saldos_contas_updated_at ON integrations_conta_azul.saldos_contas;
CREATE TRIGGER update_saldos_contas_updated_at
    BEFORE UPDATE ON integrations_conta_azul.saldos_contas
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations_conta_azul.saldos_contas IS 'Armazena histórico temporal de saldos das contas financeiras';
`;

// Migration 010: 010 Create Integrations Conta Azul Sales
const MIGRATION_010 = `-- ============================================================================
-- Migration 010: Criar Tabelas de Vendas Conta Azul
-- ============================================================================
-- Tabelas de vendas: vendas, vendas_detalhadas, vendas_itens
-- ============================================================================

-- ============================================
-- TABELA: vendas
-- Armazena vendas coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_conta_azul.vendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    venda_id TEXT NOT NULL,
    numero INTEGER,
    data DATE,
    data_inicio DATE,
    total NUMERIC(15,2),
    tipo TEXT,
    itens TEXT,
    situacao TEXT,
    condicao_pagamento BOOLEAN,
    id_legado INTEGER,
    cliente_venda_id TEXT,
    cliente_venda_nome TEXT,
    vendedor_id TEXT,
    vendedor_nome TEXT,
    data_criacao TIMESTAMPTZ,
    data_alteracao TIMESTAMPTZ,
    versao INTEGER,
    itens_detalhados BOOLEAN DEFAULT FALSE,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, venda_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_vendas_tenant_id ON integrations_conta_azul.vendas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendas_credential_id ON integrations_conta_azul.vendas(credential_id);
CREATE INDEX IF NOT EXISTS idx_vendas_venda_id ON integrations_conta_azul.vendas(venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_tenant_venda_id ON integrations_conta_azul.vendas(tenant_id, venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_created_at ON integrations_conta_azul.vendas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_data ON integrations_conta_azul.vendas(data DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_data_inicio ON integrations_conta_azul.vendas(data_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_numero ON integrations_conta_azul.vendas(numero);
CREATE INDEX IF NOT EXISTS idx_vendas_tipo ON integrations_conta_azul.vendas(tipo);
CREATE INDEX IF NOT EXISTS idx_vendas_situacao ON integrations_conta_azul.vendas(situacao);
CREATE INDEX IF NOT EXISTS idx_vendas_data_criacao ON integrations_conta_azul.vendas(data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_data_alteracao ON integrations_conta_azul.vendas(data_alteracao DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente_venda_id ON integrations_conta_azul.vendas(cliente_venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente_venda_nome ON integrations_conta_azul.vendas(cliente_venda_nome);
CREATE INDEX IF NOT EXISTS idx_vendas_vendedor_id ON integrations_conta_azul.vendas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_detalhados ON integrations_conta_azul.vendas(itens_detalhados) WHERE itens_detalhados = FALSE;
CREATE INDEX IF NOT EXISTS idx_vendas_tenant_itens_detalhados ON integrations_conta_azul.vendas(tenant_id, itens_detalhados) WHERE itens_detalhados = FALSE;
CREATE INDEX IF NOT EXISTS idx_vendas_dados_originais ON integrations_conta_azul.vendas USING GIN (dados_originais);

DROP TRIGGER IF EXISTS update_vendas_updated_at ON integrations_conta_azul.vendas;
CREATE TRIGGER update_vendas_updated_at
    BEFORE UPDATE ON integrations_conta_azul.vendas
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations_conta_azul.vendas IS 'Armazena vendas coletadas da API Conta Azul';

-- ============================================
-- TABELA: vendas_detalhadas
-- Armazena dados completos de vendas (retornados pelo GET /v1/venda/{id})
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_conta_azul.vendas_detalhadas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    venda_id TEXT NOT NULL,
    data DATE,
    total NUMERIC(15,2),
    situacao TEXT,
    cliente_venda_id TEXT,
    cliente_venda_nome TEXT,
    cliente_uuid TEXT,
    cliente_tipo_pessoa TEXT,
    cliente_documento TEXT,
    evento_financeiro_id TEXT,
    notificacao_id_referencia TEXT,
    notificacao_enviado_para TEXT,
    notificacao_enviado_em TIMESTAMPTZ,
    notificacao_aberto_em TIMESTAMPTZ,
    notificacao_status TEXT,
    natureza_operacao_uuid TEXT,
    natureza_operacao_tipo_operacao TEXT,
    natureza_operacao_template_operacao TEXT,
    natureza_operacao_label TEXT,
    natureza_operacao_mudanca_financeira BOOLEAN,
    natureza_operacao_mudanca_estoque TEXT,
    venda_status TEXT,
    venda_id_legado TEXT,
    venda_tipo_negociacao TEXT,
    venda_numero INTEGER,
    venda_id_categoria TEXT,
    venda_data_compromisso DATE,
    venda_id_cliente TEXT,
    venda_versao INTEGER,
    venda_id_natureza_operacao TEXT,
    venda_id_centro_custo TEXT,
    venda_introducao TEXT,
    venda_observacoes TEXT,
    composicao_valor_bruto NUMERIC(15,2),
    composicao_desconto NUMERIC(15,2),
    composicao_frete NUMERIC(15,2),
    composicao_impostos NUMERIC(15,2),
    composicao_impostos_deduzidos NUMERIC(15,2),
    composicao_seguro NUMERIC(15,2),
    composicao_despesas_incidentais NUMERIC(15,2),
    composicao_valor_liquido NUMERIC(15,2),
    configuracao_desconto_tipo TEXT,
    configuracao_desconto_taxa NUMERIC(10,2),
    total_itens_contagem_produtos INTEGER,
    total_itens_contagem_servicos INTEGER,
    total_itens_contagem_nao_conciliados INTEGER,
    situacao_nome TEXT,
    situacao_descricao TEXT,
    situacao_ativado BOOLEAN,
    tipo_pendencia_nome TEXT,
    tipo_pendencia_descricao TEXT,
    condicao_pagamento_tipo TEXT,
    condicao_pagamento_id_conta_financeira TEXT,
    condicao_pagamento_pagamento_a_vista BOOLEAN,
    condicao_pagamento_observacoes TEXT,
    condicao_pagamento_opcao_condicao_pagamento TEXT,
    condicao_pagamento_nsu TEXT,
    condicao_pagamento_cartao_tipo_bandeira TEXT,
    condicao_pagamento_cartao_codigo_transacao TEXT,
    condicao_pagamento_cartao_id_adquirente TEXT,
    vendedor_id TEXT,
    vendedor_nome TEXT,
    vendedor_id_legado TEXT,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, venda_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_tenant_id ON integrations_conta_azul.vendas_detalhadas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_credential_id ON integrations_conta_azul.vendas_detalhadas(credential_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_id ON integrations_conta_azul.vendas_detalhadas(venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_tenant_venda ON integrations_conta_azul.vendas_detalhadas(tenant_id, venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_data ON integrations_conta_azul.vendas_detalhadas(data DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_created_at ON integrations_conta_azul.vendas_detalhadas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_cliente_venda_id ON integrations_conta_azul.vendas_detalhadas(cliente_venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_situacao ON integrations_conta_azul.vendas_detalhadas(situacao);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_status ON integrations_conta_azul.vendas_detalhadas(venda_status);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_tipo_negociacao ON integrations_conta_azul.vendas_detalhadas(venda_tipo_negociacao);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_numero ON integrations_conta_azul.vendas_detalhadas(venda_numero);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_data_compromisso ON integrations_conta_azul.vendas_detalhadas(venda_data_compromisso DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_evento_financeiro_id ON integrations_conta_azul.vendas_detalhadas(evento_financeiro_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_natureza_operacao_uuid ON integrations_conta_azul.vendas_detalhadas(natureza_operacao_uuid);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_vendedor_id ON integrations_conta_azul.vendas_detalhadas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_cliente_uuid ON integrations_conta_azul.vendas_detalhadas(cliente_uuid);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_dados_originais ON integrations_conta_azul.vendas_detalhadas USING GIN (dados_originais);

DROP TRIGGER IF EXISTS update_vendas_detalhadas_updated_at ON integrations_conta_azul.vendas_detalhadas;
CREATE TRIGGER update_vendas_detalhadas_updated_at
    BEFORE UPDATE ON integrations_conta_azul.vendas_detalhadas
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations_conta_azul.vendas_detalhadas IS 'Armazena dados completos de vendas coletados da API Conta Azul via GET /v1/venda/{id}';

-- ============================================
-- TABELA: vendas_itens
-- Armazena itens detalhados de vendas (produtos e serviços)
-- ============================================
CREATE TABLE IF NOT EXISTS integrations_conta_azul.vendas_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    venda_id TEXT NOT NULL,
    item_id TEXT,
    produto_id TEXT,
    produto_nome TEXT,
    servico_id TEXT,
    servico_nome TEXT,
    quantidade NUMERIC(15,4),
    valor_unitario NUMERIC(15,2),
    valor_total NUMERIC(15,2),
    desconto NUMERIC(15,2),
    valor_liquido NUMERIC(15,2),
    unidade_medida TEXT,
    codigo TEXT,
    descricao TEXT,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, venda_id, item_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_vendas_itens_tenant_id ON integrations_conta_azul.vendas_itens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_credential_id ON integrations_conta_azul.vendas_itens(credential_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_venda_id ON integrations_conta_azul.vendas_itens(venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_tenant_venda ON integrations_conta_azul.vendas_itens(tenant_id, venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_item_id ON integrations_conta_azul.vendas_itens(item_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_produto_id ON integrations_conta_azul.vendas_itens(produto_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_servico_id ON integrations_conta_azul.vendas_itens(servico_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_created_at ON integrations_conta_azul.vendas_itens(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_dados_originais ON integrations_conta_azul.vendas_itens USING GIN (dados_originais);

DROP TRIGGER IF EXISTS update_vendas_itens_updated_at ON integrations_conta_azul.vendas_itens;
CREATE TRIGGER update_vendas_itens_updated_at
    BEFORE UPDATE ON integrations_conta_azul.vendas_itens
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

COMMENT ON TABLE integrations_conta_azul.vendas_itens IS 'Armazena itens detalhados de vendas coletados da API Conta Azul';
`;

// Migration 011: 011 Create Integrations Conta Azul Rpc Functions
const MIGRATION_011 = `-- ============================================================================
-- Migration 011: Criar Funções RPC de Coleta Conta Azul Adaptadas
-- ============================================================================
-- Adapta funções RPC para usar tenant_id, credential_id e novos schemas
-- ============================================================================

-- ============================================
-- RPC: Buscar Controle de Carga
-- Busca status de carga para um tenant, plataforma, entidade e credencial
-- ============================================
DROP FUNCTION IF EXISTS integrations.rpc_get_controle_carga(UUID, TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION integrations.rpc_get_controle_carga(
    p_tenant_id UUID,
    p_platform TEXT,
    p_entidade_tipo TEXT,
    p_credential_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_controle RECORD;
BEGIN
    -- Buscar controle de carga
    SELECT 
        id,
        tenant_id,
        credential_id,
        platform,
        entidade_tipo,
        carga_full_realizada,
        ultima_carga_full,
        ultima_carga_incremental,
        ultima_data_processada,
        created_at,
        updated_at
    INTO v_controle
    FROM integrations.controle_carga
    WHERE tenant_id = p_tenant_id 
      AND platform = p_platform
      AND entidade_tipo = p_entidade_tipo
      AND (p_credential_id IS NULL OR credential_id = p_credential_id);
    
    -- Se não encontrou, retornar controle padrão (carga FULL não realizada)
    IF v_controle.id IS NULL THEN
        RETURN json_build_object(
            'success', true,
            'controle', json_build_object(
                'tenant_id', p_tenant_id,
                'credential_id', p_credential_id,
                'platform', p_platform,
                'entidade_tipo', p_entidade_tipo,
                'carga_full_realizada', false,
                'ultima_carga_full', NULL,
                'ultima_carga_incremental', NULL,
                'ultima_data_processada', NULL
            )
        );
    END IF;
    
    -- Retornar controle encontrado
    RETURN json_build_object(
        'success', true,
        'controle', json_build_object(
            'id', v_controle.id,
            'tenant_id', v_controle.tenant_id,
            'credential_id', v_controle.credential_id,
            'platform', v_controle.platform,
            'entidade_tipo', v_controle.entidade_tipo,
            'carga_full_realizada', v_controle.carga_full_realizada,
            'ultima_carga_full', v_controle.ultima_carga_full,
            'ultima_carga_incremental', v_controle.ultima_carga_incremental,
            'ultima_data_processada', v_controle.ultima_data_processada,
            'created_at', v_controle.created_at,
            'updated_at', v_controle.updated_at
        )
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Atualizar Controle de Carga FULL
-- Marca carga FULL como realizada
-- ============================================
DROP FUNCTION IF EXISTS integrations.rpc_update_controle_carga_full(UUID, TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION integrations.rpc_update_controle_carga_full(
    p_tenant_id UUID,
    p_platform TEXT,
    p_entidade_tipo TEXT,
    p_credential_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Tentar atualizar registro existente
    UPDATE integrations.controle_carga
    SET
        carga_full_realizada = TRUE,
        ultima_carga_full = NOW(),
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id 
      AND platform = p_platform
      AND entidade_tipo = p_entidade_tipo
      AND (p_credential_id IS NULL OR credential_id = p_credential_id)
    RETURNING id INTO v_id;
    
    -- Se não encontrou, criar novo registro
    IF v_id IS NULL THEN
        INSERT INTO integrations.controle_carga (
            tenant_id,
            credential_id,
            platform,
            entidade_tipo,
            carga_full_realizada,
            ultima_carga_full
        )
        VALUES (
            p_tenant_id,
            p_credential_id,
            p_platform,
            p_entidade_tipo,
            TRUE,
            NOW()
        )
        RETURNING id INTO v_id;
    END IF;
    
    -- Retornar sucesso
    RETURN json_build_object(
        'success', true,
        'id', v_id,
        'message', 'Controle de carga FULL atualizado com sucesso'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Atualizar Controle de Carga Incremental
-- Atualiza última carga incremental e data processada
-- ============================================
DROP FUNCTION IF EXISTS integrations.rpc_update_controle_carga_incremental(UUID, TEXT, TEXT, TIMESTAMPTZ, UUID);
CREATE OR REPLACE FUNCTION integrations.rpc_update_controle_carga_incremental(
    p_tenant_id UUID,
    p_platform TEXT,
    p_entidade_tipo TEXT,
    p_ultima_data TIMESTAMPTZ,
    p_credential_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Tentar atualizar registro existente
    UPDATE integrations.controle_carga
    SET
        ultima_carga_incremental = NOW(),
        ultima_data_processada = COALESCE(p_ultima_data, NOW()),
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id 
      AND platform = p_platform
      AND entidade_tipo = p_entidade_tipo
      AND (p_credential_id IS NULL OR credential_id = p_credential_id)
    RETURNING id INTO v_id;
    
    -- Se não encontrou, criar novo registro
    IF v_id IS NULL THEN
        INSERT INTO integrations.controle_carga (
            tenant_id,
            credential_id,
            platform,
            entidade_tipo,
            carga_full_realizada,
            ultima_carga_incremental,
            ultima_data_processada
        )
        VALUES (
            p_tenant_id,
            p_credential_id,
            p_platform,
            p_entidade_tipo,
            FALSE,
            NOW(),
            COALESCE(p_ultima_data, NOW())
        )
        RETURNING id INTO v_id;
    END IF;
    
    -- Retornar sucesso
    RETURN json_build_object(
        'success', true,
        'id', v_id,
        'message', 'Controle de carga incremental atualizado com sucesso'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Listar Todos os Tenants com Credenciais Conta Azul
-- Retorna lista de todos os tenants com credenciais Conta Azul ativas
-- ============================================
DROP FUNCTION IF EXISTS integrations.rpc_list_all_tenants_conta_azul();
CREATE OR REPLACE FUNCTION integrations.rpc_list_all_tenants_conta_azul()
RETURNS JSON AS $$
DECLARE
    v_tenants JSON;
BEGIN
    -- Buscar todos os tenants com credenciais Conta Azul ativas
    SELECT json_agg(
        json_build_object(
            'tenant_id', t.id,
            'tenant_name', t.name,
            'tenant_cnpj', t.cnpj,
            'credential_id', tc.id,
            'credential_name', tc.credential_name,
            'is_active', tc.is_active,
            'last_authenticated_at', tc.last_authenticated_at,
            'created_at', t.created_at
        ) ORDER BY t.created_at DESC
    )
    INTO v_tenants
    FROM app_core.tenants t
    INNER JOIN app_core.tenant_credentials tc ON tc.tenant_id = t.id
    WHERE tc.platform = 'CONTA_AZUL'
      AND tc.revoked_at IS NULL
      AND tc.is_active = TRUE;
    
    -- Se não encontrou tenants, retornar array vazio
    IF v_tenants IS NULL THEN
        v_tenants := '[]'::JSON;
    END IF;
    
    -- Retornar lista de tenants
    RETURN json_build_object(
        'success', true,
        'tenants', v_tenants,
        'total', json_array_length(v_tenants)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'tenants', '[]'::JSON,
            'total', 0
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Upsert Categorias
-- Insere ou atualiza categorias coletadas da API
-- ============================================
DROP FUNCTION IF EXISTS integrations_conta_azul.rpc_upsert_categorias(UUID, UUID, JSONB);
CREATE OR REPLACE FUNCTION integrations_conta_azul.rpc_upsert_categorias(
    p_tenant_id UUID,
    p_credential_id UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_categoria JSONB;
    v_categoria_id TEXT;
    v_count INTEGER := 0;
    v_inserted INTEGER := 0;
    v_updated INTEGER := 0;
BEGIN
    -- Verificar se p_dados é um array
    IF jsonb_typeof(p_dados) != 'array' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'p_dados deve ser um array JSONB'
        );
    END IF;
    
    -- Processar cada categoria no array
    FOR v_categoria IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        -- Extrair categoria_id (campo 'id' da API)
        v_categoria_id := v_categoria->>'id';
        
        -- Se não tem id, usar hash do JSON como fallback
        IF v_categoria_id IS NULL THEN
            v_categoria_id := md5(v_categoria::TEXT);
        END IF;
        
        -- Verificar se já existe antes do upsert
        IF EXISTS (SELECT 1 FROM integrations_conta_azul.categorias 
                   WHERE tenant_id = p_tenant_id 
                     AND categoria_id = v_categoria_id 
                     AND credential_id = p_credential_id) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert categoria
        INSERT INTO integrations_conta_azul.categorias (
            tenant_id,
            credential_id,
            categoria_id,
            versao,
            nome,
            categoria_pai,
            tipo,
            entrada_dre,
            considera_custo_dre,
            dados_originais,
            updated_at
        )
        VALUES (
            p_tenant_id,
            p_credential_id,
            v_categoria_id,
            CASE 
                WHEN v_categoria->>'versao' IS NULL OR v_categoria->>'versao' = 'null' THEN NULL
                ELSE (v_categoria->>'versao')::INTEGER
            END,
            COALESCE(v_categoria->>'nome', 'Sem nome'),
            NULLIF(v_categoria->>'categoria_pai', ''),
            v_categoria->>'tipo',
            NULLIF(v_categoria->>'entrada_dre', 'null'),
            COALESCE((v_categoria->>'considera_custo_dre')::BOOLEAN, FALSE),
            v_categoria,
            NOW()
        )
        ON CONFLICT (tenant_id, categoria_id, credential_id)
        DO UPDATE SET
            versao = EXCLUDED.versao,
            nome = EXCLUDED.nome,
            categoria_pai = EXCLUDED.categoria_pai,
            tipo = EXCLUDED.tipo,
            entrada_dre = EXCLUDED.entrada_dre,
            considera_custo_dre = EXCLUDED.considera_custo_dre,
            dados_originais = EXCLUDED.dados_originais,
            updated_at = NOW();
        
        v_count := v_count + 1;
    END LOOP;
    
    -- Retornar resultado
    RETURN json_build_object(
        'success', true,
        'total_processado', v_count,
        'inseridos', v_inserted,
        'atualizados', v_updated,
        'message', format('Processadas %s categorias', v_count)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Upsert Pessoas
-- Insere ou atualiza pessoas coletadas da API
-- ============================================
DROP FUNCTION IF EXISTS integrations_conta_azul.rpc_upsert_pessoas(UUID, UUID, JSONB);
CREATE OR REPLACE FUNCTION integrations_conta_azul.rpc_upsert_pessoas(
    p_tenant_id UUID,
    p_credential_id UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_pessoa JSONB;
    v_pessoa_id TEXT;
    v_perfis TEXT[];
    v_count INTEGER := 0;
    v_inserted INTEGER := 0;
    v_updated INTEGER := 0;
BEGIN
    -- Verificar se p_dados é um array
    IF jsonb_typeof(p_dados) != 'array' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'p_dados deve ser um array JSONB'
        );
    END IF;
    
    -- Processar cada pessoa no array
    FOR v_pessoa IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        -- Extrair pessoa_id (campo 'id' da API)
        v_pessoa_id := v_pessoa->>'id';
        
        -- Se não tem id, usar hash do JSON como fallback
        IF v_pessoa_id IS NULL THEN
            v_pessoa_id := md5(v_pessoa::TEXT);
        END IF;
        
        -- Processar perfis (array de strings)
        IF v_pessoa->'perfis' IS NOT NULL AND jsonb_typeof(v_pessoa->'perfis') = 'array' THEN
            SELECT ARRAY(
                SELECT jsonb_array_elements_text(v_pessoa->'perfis')
            ) INTO v_perfis;
        ELSE
            v_perfis := NULL;
        END IF;
        
        -- Verificar se já existe antes do upsert
        IF EXISTS (SELECT 1 FROM integrations_conta_azul.pessoas 
                   WHERE tenant_id = p_tenant_id 
                     AND pessoa_id = v_pessoa_id 
                     AND credential_id = p_credential_id) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert pessoa
        INSERT INTO integrations_conta_azul.pessoas (
            tenant_id,
            credential_id,
            pessoa_id,
            id_legado,
            uuid_legado,
            nome,
            documento,
            email,
            telefone,
            tipo_pessoa,
            ativo,
            codigo,
            perfis,
            data_alteracao,
            data_criacao,
            observacoes_gerais,
            dados_originais,
            updated_at
        )
        VALUES (
            p_tenant_id,
            p_credential_id,
            v_pessoa_id,
            CASE WHEN v_pessoa->>'id_legado' IS NULL OR v_pessoa->>'id_legado' = 'null' THEN NULL ELSE (v_pessoa->>'id_legado')::INTEGER END,
            NULLIF(v_pessoa->>'uuid_legado', 'null'),
            COALESCE(v_pessoa->>'nome', 'Sem nome'),
            NULLIF(v_pessoa->>'documento', 'null'),
            NULLIF(v_pessoa->>'email', 'null'),
            NULLIF(v_pessoa->>'telefone', 'null'),
            NULLIF(v_pessoa->>'tipo_pessoa', 'null'),
            COALESCE((v_pessoa->>'ativo')::BOOLEAN, TRUE),
            NULLIF(v_pessoa->>'codigo', 'null'),
            v_perfis,
            CASE WHEN v_pessoa->>'data_alteracao' IS NULL OR v_pessoa->>'data_alteracao' = 'null' THEN NULL ELSE (v_pessoa->>'data_alteracao')::TIMESTAMPTZ END,
            CASE WHEN v_pessoa->>'data_criacao' IS NULL OR v_pessoa->>'data_criacao' = 'null' THEN NULL ELSE (v_pessoa->>'data_criacao')::TIMESTAMPTZ END,
            NULLIF(v_pessoa->>'observacoes_gerais', 'null'),
            v_pessoa,
            NOW()
        )
        ON CONFLICT (tenant_id, pessoa_id, credential_id)
        DO UPDATE SET
            id_legado = EXCLUDED.id_legado,
            uuid_legado = EXCLUDED.uuid_legado,
            nome = EXCLUDED.nome,
            documento = EXCLUDED.documento,
            email = EXCLUDED.email,
            telefone = EXCLUDED.telefone,
            tipo_pessoa = EXCLUDED.tipo_pessoa,
            ativo = EXCLUDED.ativo,
            codigo = EXCLUDED.codigo,
            perfis = EXCLUDED.perfis,
            data_alteracao = EXCLUDED.data_alteracao,
            data_criacao = EXCLUDED.data_criacao,
            observacoes_gerais = EXCLUDED.observacoes_gerais,
            dados_originais = EXCLUDED.dados_originais,
            updated_at = NOW();
        
        v_count := v_count + 1;
    END LOOP;
    
    -- Retornar resultado
    RETURN json_build_object(
        'success', true,
        'total_processado', v_count,
        'inseridos', v_inserted,
        'atualizados', v_updated,
        'message', format('Processadas %s pessoas', v_count)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Upsert Contas a Pagar
-- Insere ou atualiza contas a pagar coletadas da API
-- ============================================
DROP FUNCTION IF EXISTS integrations_conta_azul.rpc_upsert_contas_pagar(UUID, UUID, JSONB);
CREATE OR REPLACE FUNCTION integrations_conta_azul.rpc_upsert_contas_pagar(
    p_tenant_id UUID,
    p_credential_id UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_conta_pagar JSONB;
    v_conta_pagar_id TEXT;
    v_fornecedor JSONB;
    v_count INTEGER := 0;
    v_inserted INTEGER := 0;
    v_updated INTEGER := 0;
BEGIN
    -- Verificar se p_dados é um array
    IF jsonb_typeof(p_dados) != 'array' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'p_dados deve ser um array JSONB'
        );
    END IF;
    
    -- Processar cada conta a pagar no array
    FOR v_conta_pagar IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        -- Extrair conta_pagar_id (campo 'id' da API)
        v_conta_pagar_id := v_conta_pagar->>'id';
        
        -- Se não tem id, usar hash do JSON como fallback
        IF v_conta_pagar_id IS NULL THEN
            v_conta_pagar_id := md5(v_conta_pagar::TEXT);
        END IF;
        
        -- Extrair dados do fornecedor (objeto aninhado)
        v_fornecedor := v_conta_pagar->'fornecedor';
        
        -- Verificar se já existe antes do upsert
        IF EXISTS (SELECT 1 FROM integrations_conta_azul.contas_pagar 
                   WHERE tenant_id = p_tenant_id 
                     AND conta_pagar_id = v_conta_pagar_id 
                     AND credential_id = p_credential_id) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert conta a pagar
        INSERT INTO integrations_conta_azul.contas_pagar (
            tenant_id,
            credential_id,
            conta_pagar_id,
            descricao,
            data_vencimento,
            status,
            status_traduzido,
            total,
            nao_pago,
            pago,
            data_criacao,
            data_alteracao,
            fornecedor_id,
            fornecedor_nome,
            dados_originais,
            updated_at
        )
        VALUES (
            p_tenant_id,
            p_credential_id,
            v_conta_pagar_id,
            NULLIF(v_conta_pagar->>'descricao', 'null'),
            CASE WHEN v_conta_pagar->>'data_vencimento' IS NULL OR v_conta_pagar->>'data_vencimento' = 'null' THEN NULL ELSE (v_conta_pagar->>'data_vencimento')::DATE END,
            NULLIF(v_conta_pagar->>'status', 'null'),
            NULLIF(v_conta_pagar->>'status_traduzido', 'null'),
            CASE WHEN v_conta_pagar->>'total' IS NULL OR v_conta_pagar->>'total' = 'null' THEN NULL ELSE (v_conta_pagar->>'total')::NUMERIC(15,2) END,
            CASE WHEN v_conta_pagar->>'nao_pago' IS NULL OR v_conta_pagar->>'nao_pago' = 'null' THEN NULL ELSE (v_conta_pagar->>'nao_pago')::NUMERIC(15,2) END,
            CASE WHEN v_conta_pagar->>'pago' IS NULL OR v_conta_pagar->>'pago' = 'null' THEN NULL ELSE (v_conta_pagar->>'pago')::NUMERIC(15,2) END,
            CASE WHEN v_conta_pagar->>'data_criacao' IS NULL OR v_conta_pagar->>'data_criacao' = 'null' THEN NULL ELSE (v_conta_pagar->>'data_criacao')::TIMESTAMPTZ END,
            CASE WHEN v_conta_pagar->>'data_alteracao' IS NULL OR v_conta_pagar->>'data_alteracao' = 'null' THEN NULL ELSE (v_conta_pagar->>'data_alteracao')::TIMESTAMPTZ END,
            CASE WHEN v_fornecedor IS NULL OR v_fornecedor = 'null'::jsonb THEN NULL ELSE v_fornecedor->>'id' END,
            CASE WHEN v_fornecedor IS NULL OR v_fornecedor = 'null'::jsonb THEN NULL ELSE v_fornecedor->>'nome' END,
            v_conta_pagar,
            NOW()
        )
        ON CONFLICT (tenant_id, conta_pagar_id, credential_id)
        DO UPDATE SET
            descricao = EXCLUDED.descricao,
            data_vencimento = EXCLUDED.data_vencimento,
            status = EXCLUDED.status,
            status_traduzido = EXCLUDED.status_traduzido,
            total = EXCLUDED.total,
            nao_pago = EXCLUDED.nao_pago,
            pago = EXCLUDED.pago,
            data_criacao = EXCLUDED.data_criacao,
            data_alteracao = EXCLUDED.data_alteracao,
            fornecedor_id = EXCLUDED.fornecedor_id,
            fornecedor_nome = EXCLUDED.fornecedor_nome,
            dados_originais = EXCLUDED.dados_originais,
            detalhado = CASE 
                WHEN (integrations_conta_azul.contas_pagar.descricao IS DISTINCT FROM EXCLUDED.descricao
                      OR integrations_conta_azul.contas_pagar.total IS DISTINCT FROM EXCLUDED.total
                      OR integrations_conta_azul.contas_pagar.data_vencimento IS DISTINCT FROM EXCLUDED.data_vencimento
                      OR integrations_conta_azul.contas_pagar.status IS DISTINCT FROM EXCLUDED.status
                      OR integrations_conta_azul.contas_pagar.fornecedor_id IS DISTINCT FROM EXCLUDED.fornecedor_id)
                THEN FALSE
                ELSE integrations_conta_azul.contas_pagar.detalhado
            END,
            data_detalhamento = CASE 
                WHEN (integrations_conta_azul.contas_pagar.descricao IS DISTINCT FROM EXCLUDED.descricao
                      OR integrations_conta_azul.contas_pagar.total IS DISTINCT FROM EXCLUDED.total
                      OR integrations_conta_azul.contas_pagar.data_vencimento IS DISTINCT FROM EXCLUDED.data_vencimento
                      OR integrations_conta_azul.contas_pagar.status IS DISTINCT FROM EXCLUDED.status
                      OR integrations_conta_azul.contas_pagar.fornecedor_id IS DISTINCT FROM EXCLUDED.fornecedor_id)
                      AND integrations_conta_azul.contas_pagar.detalhado = TRUE
                THEN NULL
                ELSE integrations_conta_azul.contas_pagar.data_detalhamento
            END,
            updated_at = NOW();
        
        v_count := v_count + 1;
    END LOOP;
    
    -- Retornar resultado
    RETURN json_build_object(
        'success', true,
        'total_processado', v_count,
        'inseridos', v_inserted,
        'atualizados', v_updated,
        'message', format('Processadas %s contas a pagar', v_count)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON FUNCTION integrations.rpc_get_controle_carga IS 'Busca status de carga para um tenant, plataforma, entidade e credencial';
COMMENT ON FUNCTION integrations.rpc_update_controle_carga_full IS 'Marca carga FULL como realizada';
COMMENT ON FUNCTION integrations.rpc_update_controle_carga_incremental IS 'Atualiza última carga incremental e data processada';
COMMENT ON FUNCTION integrations.rpc_list_all_tenants_conta_azul IS 'Lista todos os tenants com credenciais Conta Azul ativas';
COMMENT ON FUNCTION integrations_conta_azul.rpc_upsert_categorias IS 'Insere ou atualiza categorias coletadas da API';
COMMENT ON FUNCTION integrations_conta_azul.rpc_upsert_pessoas IS 'Insere ou atualiza pessoas coletadas da API';
COMMENT ON FUNCTION integrations_conta_azul.rpc_upsert_contas_pagar IS 'Insere ou atualiza contas a pagar coletadas da API';
`;

// Migration 012: 012 Update Dw References To Tenants
const MIGRATION_012 = `-- ============================================================================
-- Migration 012: Atualizar Referências no DW de clientes para tenants
-- ============================================================================
-- Atualiza todas as FOREIGN KEY e referências de clientes(id) para 
-- app_core.tenants(id) no schema dw
-- ============================================================================

-- ============================================
-- DIM_CATEGORIA: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.dim_categoria
DROP CONSTRAINT IF EXISTS dim_categoria_cliente_id_fkey;

ALTER TABLE dw.dim_categoria
ADD CONSTRAINT dim_categoria_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- Renomear coluna cliente_id para tenant_id (opcional, mantendo compatibilidade)
-- ALTER TABLE dw.dim_categoria RENAME COLUMN cliente_id TO tenant_id;
-- ALTER TABLE dw.dim_categoria RENAME CONSTRAINT dim_categoria_cliente_id_fkey TO dim_categoria_tenant_id_fkey;

-- ============================================
-- DIM_CATEGORIA_DRE: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.dim_categoria_dre
DROP CONSTRAINT IF EXISTS dim_categoria_dre_cliente_id_fkey;

ALTER TABLE dw.dim_categoria_dre
ADD CONSTRAINT dim_categoria_dre_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- MASCARA_TOTALIZADORES_DRE: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.mascara_totalizadores_dre
DROP CONSTRAINT IF EXISTS mascara_totalizadores_dre_cliente_id_fkey;

ALTER TABLE dw.mascara_totalizadores_dre
ADD CONSTRAINT mascara_totalizadores_dre_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- DIM_CENTRO_CUSTO: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.dim_centro_custo
DROP CONSTRAINT IF EXISTS dim_centro_custo_cliente_id_fkey;

ALTER TABLE dw.dim_centro_custo
ADD CONSTRAINT dim_centro_custo_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- DIM_PESSOA: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.dim_pessoa
DROP CONSTRAINT IF EXISTS dim_pessoa_cliente_id_fkey;

ALTER TABLE dw.dim_pessoa
ADD CONSTRAINT dim_pessoa_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- DIM_CONTA_FINANCEIRA: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.dim_conta_financeira
DROP CONSTRAINT IF EXISTS dim_conta_financeira_cliente_id_fkey;

ALTER TABLE dw.dim_conta_financeira
ADD CONSTRAINT dim_conta_financeira_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- DIM_VENDEDOR: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.dim_vendedor
DROP CONSTRAINT IF EXISTS dim_vendedor_cliente_id_fkey;

ALTER TABLE dw.dim_vendedor
ADD CONSTRAINT dim_vendedor_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- FATO_CONTAS_FINANCEIRAS: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.fato_contas_financeiras
DROP CONSTRAINT IF EXISTS fato_contas_financeiras_cliente_id_fkey;

ALTER TABLE dw.fato_contas_financeiras
ADD CONSTRAINT fato_contas_financeiras_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- FATO_VENDAS: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.fato_vendas
DROP CONSTRAINT IF EXISTS fato_vendas_cliente_id_fkey;

ALTER TABLE dw.fato_vendas
ADD CONSTRAINT fato_vendas_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- FATO_VENDAS_ITENS: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.fato_vendas_itens
DROP CONSTRAINT IF EXISTS fato_vendas_itens_cliente_id_fkey;

ALTER TABLE dw.fato_vendas_itens
ADD CONSTRAINT fato_vendas_itens_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- FATO_CONTRATOS: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.fato_contratos
DROP CONSTRAINT IF EXISTS fato_contratos_cliente_id_fkey;

ALTER TABLE dw.fato_contratos
ADD CONSTRAINT fato_contratos_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- FATO_SALDOS_CONTAS: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.fato_saldos_contas
DROP CONSTRAINT IF EXISTS fato_saldos_contas_cliente_id_fkey;

ALTER TABLE dw.fato_saldos_contas
ADD CONSTRAINT fato_saldos_contas_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- Comentários atualizados
-- ============================================
COMMENT ON COLUMN dw.dim_categoria.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.dim_categoria_dre.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.mascara_totalizadores_dre.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.dim_centro_custo.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.dim_pessoa.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.dim_conta_financeira.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.dim_vendedor.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.fato_contas_financeiras.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.fato_vendas.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.fato_vendas_itens.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.fato_contratos.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.fato_saldos_contas.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
`;

// Migration 013: 013 Create Integrations Rls Policies
const MIGRATION_013 = `-- ============================================================================
-- Migration 013: Criar Políticas RLS para Schemas integrations e integrations_conta_azul
-- ============================================================================
-- Cria políticas RLS para todas as tabelas dos schemas integrations e 
-- integrations_conta_azul, garantindo isolamento por tenant
-- ============================================================================

-- ============================================
-- SCHEMA: integrations
-- ============================================

-- Habilitar RLS em todas as tabelas do schema integrations
ALTER TABLE integrations.controle_carga ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.config_periodicidade ENABLE ROW LEVEL SECURITY;

-- Políticas para integrations.controle_carga
DROP POLICY IF EXISTS "Users can view controle_carga for their tenants" ON integrations.controle_carga;
CREATE POLICY "Users can view controle_carga for their tenants"
    ON integrations.controle_carga
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM app_core.profiles 
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert controle_carga for their tenants" ON integrations.controle_carga;
CREATE POLICY "Users can insert controle_carga for their tenants"
    ON integrations.controle_carga
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM app_core.profiles 
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update controle_carga for their tenants" ON integrations.controle_carga;
CREATE POLICY "Users can update controle_carga for their tenants"
    ON integrations.controle_carga
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM app_core.profiles 
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete controle_carga for their tenants" ON integrations.controle_carga;
CREATE POLICY "Users can delete controle_carga for their tenants"
    ON integrations.controle_carga
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM app_core.profiles 
            WHERE user_id = auth.uid()
        )
    );

-- Políticas para integrations.config_periodicidade
DROP POLICY IF EXISTS "Users can view config_periodicidade for their tenants" ON integrations.config_periodicidade;
CREATE POLICY "Users can view config_periodicidade for their tenants"
    ON integrations.config_periodicidade
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM app_core.profiles 
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert config_periodicidade for their tenants" ON integrations.config_periodicidade;
CREATE POLICY "Users can insert config_periodicidade for their tenants"
    ON integrations.config_periodicidade
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM app_core.profiles 
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update config_periodicidade for their tenants" ON integrations.config_periodicidade;
CREATE POLICY "Users can update config_periodicidade for their tenants"
    ON integrations.config_periodicidade
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM app_core.profiles 
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete config_periodicidade for their tenants" ON integrations.config_periodicidade;
CREATE POLICY "Users can delete config_periodicidade for their tenants"
    ON integrations.config_periodicidade
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM app_core.profiles 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================
-- SCHEMA: integrations_conta_azul
-- ============================================

-- Habilitar RLS em todas as tabelas do schema integrations_conta_azul
ALTER TABLE integrations_conta_azul.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.categorias_dre ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.centro_custos ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.contas_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.contas_pagar_detalhadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.contas_receber_detalhadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.parcelas_detalhes ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.saldos_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.vendas_detalhadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.vendas_itens ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para verificar acesso ao tenant
CREATE OR REPLACE FUNCTION integrations_conta_azul.user_has_tenant_access(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_core.profiles 
        WHERE user_id = auth.uid() 
        AND tenant_id = p_tenant_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas genéricas para todas as tabelas de entidades
-- Usando uma função auxiliar para simplificar

-- Categorias
DROP POLICY IF EXISTS "Users can view categorias for their tenants" ON integrations_conta_azul.categorias;
CREATE POLICY "Users can view categorias for their tenants"
    ON integrations_conta_azul.categorias FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert categorias for their tenants" ON integrations_conta_azul.categorias;
CREATE POLICY "Users can insert categorias for their tenants"
    ON integrations_conta_azul.categorias FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update categorias for their tenants" ON integrations_conta_azul.categorias;
CREATE POLICY "Users can update categorias for their tenants"
    ON integrations_conta_azul.categorias FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete categorias for their tenants" ON integrations_conta_azul.categorias;
CREATE POLICY "Users can delete categorias for their tenants"
    ON integrations_conta_azul.categorias FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Categorias DRE
DROP POLICY IF EXISTS "Users can view categorias_dre for their tenants" ON integrations_conta_azul.categorias_dre;
CREATE POLICY "Users can view categorias_dre for their tenants"
    ON integrations_conta_azul.categorias_dre FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert categorias_dre for their tenants" ON integrations_conta_azul.categorias_dre;
CREATE POLICY "Users can insert categorias_dre for their tenants"
    ON integrations_conta_azul.categorias_dre FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update categorias_dre for their tenants" ON integrations_conta_azul.categorias_dre;
CREATE POLICY "Users can update categorias_dre for their tenants"
    ON integrations_conta_azul.categorias_dre FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete categorias_dre for their tenants" ON integrations_conta_azul.categorias_dre;
CREATE POLICY "Users can delete categorias_dre for their tenants"
    ON integrations_conta_azul.categorias_dre FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Centro Custos
DROP POLICY IF EXISTS "Users can view centro_custos for their tenants" ON integrations_conta_azul.centro_custos;
CREATE POLICY "Users can view centro_custos for their tenants"
    ON integrations_conta_azul.centro_custos FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert centro_custos for their tenants" ON integrations_conta_azul.centro_custos;
CREATE POLICY "Users can insert centro_custos for their tenants"
    ON integrations_conta_azul.centro_custos FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update centro_custos for their tenants" ON integrations_conta_azul.centro_custos;
CREATE POLICY "Users can update centro_custos for their tenants"
    ON integrations_conta_azul.centro_custos FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete centro_custos for their tenants" ON integrations_conta_azul.centro_custos;
CREATE POLICY "Users can delete centro_custos for their tenants"
    ON integrations_conta_azul.centro_custos FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Pessoas
DROP POLICY IF EXISTS "Users can view pessoas for their tenants" ON integrations_conta_azul.pessoas;
CREATE POLICY "Users can view pessoas for their tenants"
    ON integrations_conta_azul.pessoas FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert pessoas for their tenants" ON integrations_conta_azul.pessoas;
CREATE POLICY "Users can insert pessoas for their tenants"
    ON integrations_conta_azul.pessoas FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update pessoas for their tenants" ON integrations_conta_azul.pessoas;
CREATE POLICY "Users can update pessoas for their tenants"
    ON integrations_conta_azul.pessoas FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete pessoas for their tenants" ON integrations_conta_azul.pessoas;
CREATE POLICY "Users can delete pessoas for their tenants"
    ON integrations_conta_azul.pessoas FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Produtos
DROP POLICY IF EXISTS "Users can view produtos for their tenants" ON integrations_conta_azul.produtos;
CREATE POLICY "Users can view produtos for their tenants"
    ON integrations_conta_azul.produtos FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert produtos for their tenants" ON integrations_conta_azul.produtos;
CREATE POLICY "Users can insert produtos for their tenants"
    ON integrations_conta_azul.produtos FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update produtos for their tenants" ON integrations_conta_azul.produtos;
CREATE POLICY "Users can update produtos for their tenants"
    ON integrations_conta_azul.produtos FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete produtos for their tenants" ON integrations_conta_azul.produtos;
CREATE POLICY "Users can delete produtos for their tenants"
    ON integrations_conta_azul.produtos FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Serviços
DROP POLICY IF EXISTS "Users can view servicos for their tenants" ON integrations_conta_azul.servicos;
CREATE POLICY "Users can view servicos for their tenants"
    ON integrations_conta_azul.servicos FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert servicos for their tenants" ON integrations_conta_azul.servicos;
CREATE POLICY "Users can insert servicos for their tenants"
    ON integrations_conta_azul.servicos FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update servicos for their tenants" ON integrations_conta_azul.servicos;
CREATE POLICY "Users can update servicos for their tenants"
    ON integrations_conta_azul.servicos FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete servicos for their tenants" ON integrations_conta_azul.servicos;
CREATE POLICY "Users can delete servicos for their tenants"
    ON integrations_conta_azul.servicos FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Vendedores
DROP POLICY IF EXISTS "Users can view vendedores for their tenants" ON integrations_conta_azul.vendedores;
CREATE POLICY "Users can view vendedores for their tenants"
    ON integrations_conta_azul.vendedores FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert vendedores for their tenants" ON integrations_conta_azul.vendedores;
CREATE POLICY "Users can insert vendedores for their tenants"
    ON integrations_conta_azul.vendedores FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update vendedores for their tenants" ON integrations_conta_azul.vendedores;
CREATE POLICY "Users can update vendedores for their tenants"
    ON integrations_conta_azul.vendedores FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete vendedores for their tenants" ON integrations_conta_azul.vendedores;
CREATE POLICY "Users can delete vendedores for their tenants"
    ON integrations_conta_azul.vendedores FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Contas Financeiras
DROP POLICY IF EXISTS "Users can view contas_financeiras for their tenants" ON integrations_conta_azul.contas_financeiras;
CREATE POLICY "Users can view contas_financeiras for their tenants"
    ON integrations_conta_azul.contas_financeiras FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert contas_financeiras for their tenants" ON integrations_conta_azul.contas_financeiras;
CREATE POLICY "Users can insert contas_financeiras for their tenants"
    ON integrations_conta_azul.contas_financeiras FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update contas_financeiras for their tenants" ON integrations_conta_azul.contas_financeiras;
CREATE POLICY "Users can update contas_financeiras for their tenants"
    ON integrations_conta_azul.contas_financeiras FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete contas_financeiras for their tenants" ON integrations_conta_azul.contas_financeiras;
CREATE POLICY "Users can delete contas_financeiras for their tenants"
    ON integrations_conta_azul.contas_financeiras FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Contas a Pagar
DROP POLICY IF EXISTS "Users can view contas_pagar for their tenants" ON integrations_conta_azul.contas_pagar;
CREATE POLICY "Users can view contas_pagar for their tenants"
    ON integrations_conta_azul.contas_pagar FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert contas_pagar for their tenants" ON integrations_conta_azul.contas_pagar;
CREATE POLICY "Users can insert contas_pagar for their tenants"
    ON integrations_conta_azul.contas_pagar FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update contas_pagar for their tenants" ON integrations_conta_azul.contas_pagar;
CREATE POLICY "Users can update contas_pagar for their tenants"
    ON integrations_conta_azul.contas_pagar FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete contas_pagar for their tenants" ON integrations_conta_azul.contas_pagar;
CREATE POLICY "Users can delete contas_pagar for their tenants"
    ON integrations_conta_azul.contas_pagar FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Contas a Receber
DROP POLICY IF EXISTS "Users can view contas_receber for their tenants" ON integrations_conta_azul.contas_receber;
CREATE POLICY "Users can view contas_receber for their tenants"
    ON integrations_conta_azul.contas_receber FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert contas_receber for their tenants" ON integrations_conta_azul.contas_receber;
CREATE POLICY "Users can insert contas_receber for their tenants"
    ON integrations_conta_azul.contas_receber FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update contas_receber for their tenants" ON integrations_conta_azul.contas_receber;
CREATE POLICY "Users can update contas_receber for their tenants"
    ON integrations_conta_azul.contas_receber FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete contas_receber for their tenants" ON integrations_conta_azul.contas_receber;
CREATE POLICY "Users can delete contas_receber for their tenants"
    ON integrations_conta_azul.contas_receber FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Contas a Pagar Detalhadas
DROP POLICY IF EXISTS "Users can view contas_pagar_detalhadas for their tenants" ON integrations_conta_azul.contas_pagar_detalhadas;
CREATE POLICY "Users can view contas_pagar_detalhadas for their tenants"
    ON integrations_conta_azul.contas_pagar_detalhadas FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert contas_pagar_detalhadas for their tenants" ON integrations_conta_azul.contas_pagar_detalhadas;
CREATE POLICY "Users can insert contas_pagar_detalhadas for their tenants"
    ON integrations_conta_azul.contas_pagar_detalhadas FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update contas_pagar_detalhadas for their tenants" ON integrations_conta_azul.contas_pagar_detalhadas;
CREATE POLICY "Users can update contas_pagar_detalhadas for their tenants"
    ON integrations_conta_azul.contas_pagar_detalhadas FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete contas_pagar_detalhadas for their tenants" ON integrations_conta_azul.contas_pagar_detalhadas;
CREATE POLICY "Users can delete contas_pagar_detalhadas for their tenants"
    ON integrations_conta_azul.contas_pagar_detalhadas FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Contas a Receber Detalhadas
DROP POLICY IF EXISTS "Users can view contas_receber_detalhadas for their tenants" ON integrations_conta_azul.contas_receber_detalhadas;
CREATE POLICY "Users can view contas_receber_detalhadas for their tenants"
    ON integrations_conta_azul.contas_receber_detalhadas FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert contas_receber_detalhadas for their tenants" ON integrations_conta_azul.contas_receber_detalhadas;
CREATE POLICY "Users can insert contas_receber_detalhadas for their tenants"
    ON integrations_conta_azul.contas_receber_detalhadas FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update contas_receber_detalhadas for their tenants" ON integrations_conta_azul.contas_receber_detalhadas;
CREATE POLICY "Users can update contas_receber_detalhadas for their tenants"
    ON integrations_conta_azul.contas_receber_detalhadas FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete contas_receber_detalhadas for their tenants" ON integrations_conta_azul.contas_receber_detalhadas;
CREATE POLICY "Users can delete contas_receber_detalhadas for their tenants"
    ON integrations_conta_azul.contas_receber_detalhadas FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Parcelas Detalhes
DROP POLICY IF EXISTS "Users can view parcelas_detalhes for their tenants" ON integrations_conta_azul.parcelas_detalhes;
CREATE POLICY "Users can view parcelas_detalhes for their tenants"
    ON integrations_conta_azul.parcelas_detalhes FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert parcelas_detalhes for their tenants" ON integrations_conta_azul.parcelas_detalhes;
CREATE POLICY "Users can insert parcelas_detalhes for their tenants"
    ON integrations_conta_azul.parcelas_detalhes FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update parcelas_detalhes for their tenants" ON integrations_conta_azul.parcelas_detalhes;
CREATE POLICY "Users can update parcelas_detalhes for their tenants"
    ON integrations_conta_azul.parcelas_detalhes FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete parcelas_detalhes for their tenants" ON integrations_conta_azul.parcelas_detalhes;
CREATE POLICY "Users can delete parcelas_detalhes for their tenants"
    ON integrations_conta_azul.parcelas_detalhes FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Contratos
DROP POLICY IF EXISTS "Users can view contratos for their tenants" ON integrations_conta_azul.contratos;
CREATE POLICY "Users can view contratos for their tenants"
    ON integrations_conta_azul.contratos FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert contratos for their tenants" ON integrations_conta_azul.contratos;
CREATE POLICY "Users can insert contratos for their tenants"
    ON integrations_conta_azul.contratos FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update contratos for their tenants" ON integrations_conta_azul.contratos;
CREATE POLICY "Users can update contratos for their tenants"
    ON integrations_conta_azul.contratos FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete contratos for their tenants" ON integrations_conta_azul.contratos;
CREATE POLICY "Users can delete contratos for their tenants"
    ON integrations_conta_azul.contratos FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Saldos Contas
DROP POLICY IF EXISTS "Users can view saldos_contas for their tenants" ON integrations_conta_azul.saldos_contas;
CREATE POLICY "Users can view saldos_contas for their tenants"
    ON integrations_conta_azul.saldos_contas FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert saldos_contas for their tenants" ON integrations_conta_azul.saldos_contas;
CREATE POLICY "Users can insert saldos_contas for their tenants"
    ON integrations_conta_azul.saldos_contas FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update saldos_contas for their tenants" ON integrations_conta_azul.saldos_contas;
CREATE POLICY "Users can update saldos_contas for their tenants"
    ON integrations_conta_azul.saldos_contas FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete saldos_contas for their tenants" ON integrations_conta_azul.saldos_contas;
CREATE POLICY "Users can delete saldos_contas for their tenants"
    ON integrations_conta_azul.saldos_contas FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Vendas
DROP POLICY IF EXISTS "Users can view vendas for their tenants" ON integrations_conta_azul.vendas;
CREATE POLICY "Users can view vendas for their tenants"
    ON integrations_conta_azul.vendas FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert vendas for their tenants" ON integrations_conta_azul.vendas;
CREATE POLICY "Users can insert vendas for their tenants"
    ON integrations_conta_azul.vendas FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update vendas for their tenants" ON integrations_conta_azul.vendas;
CREATE POLICY "Users can update vendas for their tenants"
    ON integrations_conta_azul.vendas FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete vendas for their tenants" ON integrations_conta_azul.vendas;
CREATE POLICY "Users can delete vendas for their tenants"
    ON integrations_conta_azul.vendas FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Vendas Detalhadas
DROP POLICY IF EXISTS "Users can view vendas_detalhadas for their tenants" ON integrations_conta_azul.vendas_detalhadas;
CREATE POLICY "Users can view vendas_detalhadas for their tenants"
    ON integrations_conta_azul.vendas_detalhadas FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert vendas_detalhadas for their tenants" ON integrations_conta_azul.vendas_detalhadas;
CREATE POLICY "Users can insert vendas_detalhadas for their tenants"
    ON integrations_conta_azul.vendas_detalhadas FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update vendas_detalhadas for their tenants" ON integrations_conta_azul.vendas_detalhadas;
CREATE POLICY "Users can update vendas_detalhadas for their tenants"
    ON integrations_conta_azul.vendas_detalhadas FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete vendas_detalhadas for their tenants" ON integrations_conta_azul.vendas_detalhadas;
CREATE POLICY "Users can delete vendas_detalhadas for their tenants"
    ON integrations_conta_azul.vendas_detalhadas FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Vendas Itens
DROP POLICY IF EXISTS "Users can view vendas_itens for their tenants" ON integrations_conta_azul.vendas_itens;
CREATE POLICY "Users can view vendas_itens for their tenants"
    ON integrations_conta_azul.vendas_itens FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert vendas_itens for their tenants" ON integrations_conta_azul.vendas_itens;
CREATE POLICY "Users can insert vendas_itens for their tenants"
    ON integrations_conta_azul.vendas_itens FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update vendas_itens for their tenants" ON integrations_conta_azul.vendas_itens;
CREATE POLICY "Users can update vendas_itens for their tenants"
    ON integrations_conta_azul.vendas_itens FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete vendas_itens for their tenants" ON integrations_conta_azul.vendas_itens;
CREATE POLICY "Users can delete vendas_itens for their tenants"
    ON integrations_conta_azul.vendas_itens FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));
`;
// Array de migrations na ordem
const MIGRATIONS = [
  { name: '001_create_schemas', sql: MIGRATION_001 },
  { name: '002_create_app_core_tables', sql: MIGRATION_002 },
  { name: '003_create_dw_tables', sql: MIGRATION_003 },
  { name: '004_create_rpc_functions', sql: MIGRATION_004 },
  { name: '005_create_rls_policies', sql: MIGRATION_005 },
  { name: '006_create_integrations_schemas', sql: MIGRATION_006 },
  { name: '007_create_integrations_shared_tables', sql: MIGRATION_007 },
  { name: '008_create_integrations_conta_azul_entities', sql: MIGRATION_008 },
  { name: '009_create_integrations_conta_azul_financial', sql: MIGRATION_009 },
  { name: '010_create_integrations_conta_azul_sales', sql: MIGRATION_010 },
  { name: '011_create_integrations_conta_azul_rpc_functions', sql: MIGRATION_011 },
  { name: '012_update_dw_references_to_tenants', sql: MIGRATION_012 },
  { name: '013_create_integrations_rls_policies', sql: MIGRATION_013 },
  { name: '014_create_dw_dim_calendario', sql: MIGRATION_014 },
  { name: '015_create_dw_etl_dimensoes', sql: MIGRATION_015 },
  { name: '016_create_dw_etl_fatos', sql: MIGRATION_016 },
  { name: '017_create_dw_views', sql: MIGRATION_017 },
  { name: '018_create_dw_ajustes', sql: MIGRATION_018 },
  { name: '019_add_additional_migrations', sql: MIGRATION_019 },
  { name: '020_create_view_contas_unificadas', sql: MIGRATION_020 },
  { name: '021_expand_mapping_rules', sql: MIGRATION_021 },
  { name: '022_create_tenant_conta_azul_config', sql: MIGRATION_022 },
  { name: '023_create_app_config_table', sql: MIGRATION_023 },
  { name: '024_create_app_config_rpc_functions', sql: MIGRATION_024 },
  { name: '025_fix_service_role_schema_permissions', sql: MIGRATION_025 },
  { name: '026_fix_unencrypted_data', sql: MIGRATION_026 },
  { name: '031_create_tenant_validation_rpc', sql: MIGRATION_031 },
];

// Função para extrair credenciais do PostgreSQL da URL do Supabase
function extractPostgresConnection(supabaseUrl: string, serviceRoleKey: string): string {
  // A URL do Supabase segue o padrão: https://[project-ref].supabase.co
  // Para conectar ao PostgreSQL, precisamos:
  // - Host: db.[project-ref].supabase.co
  // - Port: 5432
  // - Database: postgres
  // - User: postgres
  // - Password: precisa ser extraído do SERVICE_ROLE_KEY ou fornecido separadamente
  
  // Como o SERVICE_ROLE_KEY não é a senha do PostgreSQL,
  // precisamos pedir a senha do PostgreSQL ao usuário OU
  // usar uma abordagem diferente: executar via Management API ou Supabase SQL Editor API
  
  // Por limitação: não podemos obter a senha do PostgreSQL diretamente
  // Vamos retornar null e usar uma abordagem alternativa
  return '';
}

// Função para executar SQL via conexão PostgreSQL direta
async function executeSQLDirect(
  supabaseUrl: string,
  serviceRoleKey: string,
  dbPassword: string,
  sql: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Extrair project_ref da URL
    const match = supabaseUrl.match(/https:\/\/(.+?)\.supabase\.co/);
    if (!match) {
      return { success: false, error: 'URL do Supabase inválida' };
    }

    const projectRef = match[1];
    const dbHost = `db.${projectRef}.supabase.co`;
    const dbPort = 5432;
    const dbName = 'postgres';
    const dbUser = 'postgres';

    // Criar string de conexão
    const connectionString = `postgres://${dbUser}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort}/${dbName}`;

    // Conectar ao PostgreSQL
    const client = await postgres(connectionString);

    try {
      // Executar SQL (dividir em statements)
      // Nota: postgres library executa statements separadamente
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        if (statement.length === 0) continue;
        try {
          await client.queryObject(statement);
        } catch (err) {
          // Alguns erros podem ser ignorados (ex: "already exists")
          const errorMsg = err instanceof Error ? err.message : String(err);
          if (!errorMsg.includes('already exists') && !errorMsg.includes('does not exist')) {
            throw err;
          }
        }
      }

      return { success: true };
    } finally {
      // Fechar conexão
      await client.end();
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao executar SQL',
    };
  }
}

// Migration 021: 021 Expand Mapping Rules (renomeada de 015)
const MIGRATION_021 = `-- ============================================================================
-- Migração 015: Expandir tabela mapping_rules com novos campos
-- ============================================================================
-- Adiciona campos para suportar diferentes tipos de lançamento e configurações
-- Adiciona triggers para validar conteúdo de campos JSONB (segurança)
-- ============================================================================

-- Adicionar novos campos à tabela mapping_rules
ALTER TABLE public.mapping_rules
ADD COLUMN IF NOT EXISTS lancamento_type TEXT CHECK (lancamento_type IN ('RECEITA', 'DESPESA', 'TAXA', 'FRETE')),
ADD COLUMN IF NOT EXISTS conta_padrao BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

-- Comentários
COMMENT ON COLUMN public.mapping_rules.lancamento_type IS 'Tipo de lançamento: RECEITA, DESPESA, TAXA ou FRETE';
COMMENT ON COLUMN public.mapping_rules.conta_padrao IS 'Se true, usa como fallback quando nenhuma regra específica aplicar';
COMMENT ON COLUMN public.mapping_rules.config IS 'Configurações adicionais em JSONB (ex: percentual de taxa, condições especiais)';

-- ⚠️ SEGURANÇA: Função para validar que config JSONB não contém tokens ou credenciais
CREATE OR REPLACE FUNCTION public.validate_mapping_rule_config(p_config JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    v_key TEXT;
    v_value TEXT;
    v_sensitive_fields TEXT[] := ARRAY[
        'access_token', 'refresh_token', 'api_key', 'api_secret', 
        'token', 'password', 'secret', 'authorization', 'x-api-key'
    ];
BEGIN
    -- Se config for null ou vazio, é válido
    IF p_config IS NULL OR p_config = '{}'::jsonb THEN
        RETURN TRUE;
    END IF;

    -- Verificar cada chave no JSONB
    FOR v_key IN SELECT jsonb_object_keys(p_config) LOOP
        -- Verificar se a chave contém campos sensíveis
        FOREACH v_value IN ARRAY v_sensitive_fields LOOP
            IF LOWER(v_key) LIKE '%' || LOWER(v_value) || '%' THEN
                RAISE EXCEPTION 'Campo sensível detectado no config: %', v_key;
            END IF;
        END LOOP;

        -- Verificar se o valor contém tokens (strings que parecem tokens)
        v_value := p_config->>v_key;
        IF v_value IS NOT NULL AND (
            LENGTH(v_value) > 50 AND v_value ~ '^[A-Za-z0-9_-]+$' OR
            v_value ILIKE '%token%' OR
            v_value ILIKE '%bearer%' OR
            v_value ILIKE '%authorization%'
        ) THEN
            RAISE EXCEPTION 'Valor suspeito detectado no config para chave: %', v_key;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.validate_mapping_rule_config(JSONB) IS 'Valida que config JSONB não contém tokens ou credenciais';

-- ⚠️ SEGURANÇA: Trigger para validar config antes de inserir/atualizar
CREATE OR REPLACE FUNCTION public.check_mapping_rule_config()
RETURNS TRIGGER AS $$
BEGIN
    -- Validar config se não for null ou vazio
    IF NEW.config IS NOT NULL AND NEW.config != '{}'::jsonb THEN
        PERFORM public.validate_mapping_rule_config(NEW.config);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.check_mapping_rule_config() IS 'Trigger para validar config antes de inserir/atualizar mapping_rules';

-- Criar trigger
DROP TRIGGER IF EXISTS validate_mapping_rule_config_trigger ON public.mapping_rules;
CREATE TRIGGER validate_mapping_rule_config_trigger
    BEFORE INSERT OR UPDATE ON public.mapping_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.check_mapping_rule_config();

-- ⚠️ SEGURANÇA: Validar tamanho máximo de campos de texto
ALTER TABLE public.mapping_rules
ADD CONSTRAINT mapping_rules_name_length CHECK (LENGTH(name) <= 100),
ADD CONSTRAINT mapping_rules_condition_value_length CHECK (LENGTH(condition_value) <= 255),
ADD CONSTRAINT mapping_rules_target_account_length CHECK (LENGTH(target_account) <= 100);

-- ⚠️ SEGURANÇA: Validar range de prioridade
ALTER TABLE public.mapping_rules
ADD CONSTRAINT mapping_rules_priority_range CHECK (priority >= 0 AND priority <= 9999);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_mapping_rules_lancamento_type ON public.mapping_rules(tenant_id, lancamento_type);
CREATE INDEX IF NOT EXISTS idx_mapping_rules_conta_padrao ON public.mapping_rules(tenant_id, conta_padrao) WHERE conta_padrao = TRUE;
CREATE INDEX IF NOT EXISTS idx_mapping_rules_config_gin ON public.mapping_rules USING GIN (config);

-- Atualizar updated_at quando config mudar
CREATE OR REPLACE FUNCTION public.update_mapping_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_mapping_rules_updated_at_trigger ON public.mapping_rules;
CREATE TRIGGER update_mapping_rules_updated_at_trigger
    BEFORE UPDATE ON public.mapping_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_mapping_rules_updated_at();
`;

// Migration 022: 022 Create Tenant Conta Azul Config (renomeada de 016)
const MIGRATION_022 = `-- ============================================================================
-- Migração 016: Criar tabela tenant_conta_azul_config
-- ============================================================================
-- Tabela para armazenar configurações específicas do Conta Azul por tenant
-- Inclui contas padrão e configurações gerais
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_conta_azul_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    conta_receita_padrao TEXT, -- ID da conta padrão para receitas
    conta_despesa_padrao TEXT, -- ID da conta padrão para despesas
    conta_taxa_padrao TEXT, -- ID da conta padrão para taxas
    conta_frete_padrao TEXT, -- ID da conta padrão para frete
    criar_clientes_automaticamente BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}'::jsonb, -- ⚠️ SEGURANÇA: Validar que não contém tokens ou credenciais
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id)
);

COMMENT ON TABLE public.tenant_conta_azul_config IS 'Configurações específicas do Conta Azul por tenant';
COMMENT ON COLUMN public.tenant_conta_azul_config.conta_receita_padrao IS 'ID da conta padrão para receitas';
COMMENT ON COLUMN public.tenant_conta_azul_config.conta_despesa_padrao IS 'ID da conta padrão para despesas';
COMMENT ON COLUMN public.tenant_conta_azul_config.conta_taxa_padrao IS 'ID da conta padrão para taxas';
COMMENT ON COLUMN public.tenant_conta_azul_config.conta_frete_padrao IS 'ID da conta padrão para frete';
COMMENT ON COLUMN public.tenant_conta_azul_config.config IS 'Configurações adicionais em JSONB (validado para não conter tokens)';

-- ⚠️ SEGURANÇA: Validar formato UUID dos IDs de conta
ALTER TABLE public.tenant_conta_azul_config
ADD CONSTRAINT tenant_conta_azul_config_conta_receita_uuid CHECK (
    conta_receita_padrao IS NULL OR conta_receita_padrao ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
ADD CONSTRAINT tenant_conta_azul_config_conta_despesa_uuid CHECK (
    conta_despesa_padrao IS NULL OR conta_despesa_padrao ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
ADD CONSTRAINT tenant_conta_azul_config_conta_taxa_uuid CHECK (
    conta_taxa_padrao IS NULL OR conta_taxa_padrao ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
ADD CONSTRAINT tenant_conta_azul_config_conta_frete_uuid CHECK (
    conta_frete_padrao IS NULL OR conta_frete_padrao ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

-- ⚠️ SEGURANÇA: Trigger para validar config JSONB (reutilizar função existente)
CREATE OR REPLACE FUNCTION public.check_tenant_conta_azul_config()
RETURNS TRIGGER AS $$
BEGIN
    -- Validar config se não for null ou vazio
    IF NEW.config IS NOT NULL AND NEW.config != '{}'::jsonb THEN
        PERFORM public.validate_mapping_rule_config(NEW.config);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.check_tenant_conta_azul_config() IS 'Trigger para validar config antes de inserir/atualizar tenant_conta_azul_config';

-- Criar trigger
DROP TRIGGER IF EXISTS validate_tenant_conta_azul_config_trigger ON public.tenant_conta_azul_config;
CREATE TRIGGER validate_tenant_conta_azul_config_trigger
    BEFORE INSERT OR UPDATE ON public.tenant_conta_azul_config
    FOR EACH ROW
    EXECUTE FUNCTION public.check_tenant_conta_azul_config();

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_tenant_conta_azul_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tenant_conta_azul_config_updated_at_trigger ON public.tenant_conta_azul_config;
CREATE TRIGGER update_tenant_conta_azul_config_updated_at_trigger
    BEFORE UPDATE ON public.tenant_conta_azul_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tenant_conta_azul_config_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_tenant_conta_azul_config_tenant_id ON public.tenant_conta_azul_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_conta_azul_config_config_gin ON public.tenant_conta_azul_config USING GIN (config);

-- Habilitar RLS
ALTER TABLE public.tenant_conta_azul_config ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (similar às outras tabelas)
DROP POLICY IF EXISTS "Partners can view own tenant conta azul config" ON public.tenant_conta_azul_config;
CREATE POLICY "Partners can view own tenant conta azul config"
    ON public.tenant_conta_azul_config FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_conta_azul_config.tenant_id AND t.partner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Partners can create own tenant conta azul config" ON public.tenant_conta_azul_config;
CREATE POLICY "Partners can create own tenant conta azul config"
    ON public.tenant_conta_azul_config FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_conta_azul_config.tenant_id AND t.partner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Partners can update own tenant conta azul config" ON public.tenant_conta_azul_config;
CREATE POLICY "Partners can update own tenant conta azul config"
    ON public.tenant_conta_azul_config FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_conta_azul_config.tenant_id AND t.partner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Partners can delete own tenant conta azul config" ON public.tenant_conta_azul_config;
CREATE POLICY "Partners can delete own tenant conta azul config"
    ON public.tenant_conta_azul_config FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_conta_azul_config.tenant_id AND t.partner_id = auth.uid()
        )
    );
`;

// Migration 023: Criar Tabela de Configurações Globais do App
const MIGRATION_023 = `-- ============================================================================
-- Migration 023: Criar Tabela de Configurações Globais do App
-- ============================================================================
-- Tabela para armazenar configurações globais como Client ID e Client Secret
-- da Conta Azul, permitindo configuração via setup e acesso centralizado
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tabela: app_config (configurações globais)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_core.app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Comentários
COMMENT ON TABLE app_core.app_config IS 'Configurações globais do sistema (Client ID/Secret Conta Azul, API Keys, etc.)';
COMMENT ON COLUMN app_core.app_config.key IS 'Chave única da configuração (ex: conta_azul_client_id, conta_azul_client_secret, system_api_key)';
COMMENT ON COLUMN app_core.app_config.value IS 'Valor da configuração (criptografado se is_encrypted = true)';
COMMENT ON COLUMN app_core.app_config.is_encrypted IS 'Indica se o valor está criptografado no banco';
COMMENT ON COLUMN app_core.app_config.updated_by IS 'Usuário que fez a última atualização';

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_app_config_key ON app_core.app_config(key);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_app_config_updated_at
    BEFORE UPDATE ON app_core.app_config
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE app_core.app_config ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- Políticas RLS
-- ----------------------------------------------------------------------------

-- Política: Apenas ADMIN pode ver todas as configurações
DROP POLICY IF EXISTS "Admins can view all app config" ON app_core.app_config;
CREATE POLICY "Admins can view all app config"
    ON app_core.app_config FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app_core.profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Política: Usuários autenticados podem ver configurações públicas (is_encrypted = false)
DROP POLICY IF EXISTS "Authenticated can view public config" ON app_core.app_config;
CREATE POLICY "Authenticated can view public config"
    ON app_core.app_config FOR SELECT
    USING (
        auth.role() = 'authenticated' AND is_encrypted = FALSE
    );

-- Política: Anon pode ver apenas configurações públicas específicas (Client ID)
DROP POLICY IF EXISTS "Anon can view public client id" ON app_core.app_config;
CREATE POLICY "Anon can view public client id"
    ON app_core.app_config FOR SELECT
    USING (
        auth.role() = 'anon' AND key = 'conta_azul_client_id' AND is_encrypted = FALSE
    );

-- Política: Apenas ADMIN pode inserir configurações
DROP POLICY IF EXISTS "Admins can insert app config" ON app_core.app_config;
CREATE POLICY "Admins can insert app config"
    ON app_core.app_config FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM app_core.profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Política: Apenas ADMIN pode atualizar configurações
DROP POLICY IF EXISTS "Admins can update app config" ON app_core.app_config;
CREATE POLICY "Admins can update app config"
    ON app_core.app_config FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM app_core.profiles
            WHERE id = auth.uid() AND role = 'ADMIN'
        )
    );

-- Nota: Service Role (usado pelo setup-database) pode bypassar RLS usando SECURITY DEFINER nas funções RPC
`;

// Migration 024: Criar Funções RPC para Configurações Globais
const MIGRATION_024 = `-- ============================================================================
-- Migration 024: Criar Funções RPC para Configurações Globais
-- ============================================================================
-- Funções para ler e escrever configurações globais com criptografia automática
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Função: Obter configuração (com descriptografia automática)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.get_app_config(p_key TEXT)
RETURNS TEXT AS $$
DECLARE
    v_encryption_key TEXT;
    v_config_value TEXT;
    v_is_encrypted BOOLEAN;
BEGIN
    -- Buscar configuração
    SELECT value, is_encrypted INTO v_config_value, v_is_encrypted
    FROM app_core.app_config
    WHERE key = p_key;

    -- Se não encontrou, retornar NULL
    IF v_config_value IS NULL THEN
        RETURN NULL;
    END IF;

    -- Se não está criptografado, retornar direto
    IF NOT v_is_encrypted THEN
        RETURN v_config_value;
    END IF;

    -- Se está criptografado, tentar descriptografar
    BEGIN
        v_encryption_key := app_core.get_encryption_key();
        RETURN app_core.decrypt_token(v_config_value, v_encryption_key);
    EXCEPTION
        WHEN OTHERS THEN
            -- Se falhar a descriptografia (valor não está realmente criptografado),
            -- retornar o valor original como fallback
            -- Isso permite que dados antigos (não criptografados) ainda funcionem
            RAISE WARNING 'Erro ao descriptografar %: %. Retornando valor original como fallback.', p_key, SQLERRM;
            RETURN v_config_value;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.get_app_config IS 'Retorna uma configuração do sistema, descriptografando automaticamente se is_encrypted = true. Usa SECURITY DEFINER para bypass RLS quando necessário (ex: Edge Functions com Service Role).';

-- ----------------------------------------------------------------------------
-- Função: Salvar/Atualizar configuração (com criptografia automática)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.set_app_config(
    p_key TEXT,
    p_value TEXT,
    p_description TEXT DEFAULT NULL,
    p_is_encrypted BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
DECLARE
    v_encryption_key TEXT;
    v_encrypted_value TEXT;
    v_final_value TEXT;
    v_user_id UUID;
BEGIN
    -- Verificar se usuário é ADMIN ou se é Service Role (para setup)
    v_user_id := auth.uid();
    
    -- Se não tem user_id (Service Role) ou é ADMIN, permitir
    IF v_user_id IS NULL THEN
        -- Service Role (setup-database) - permitir
        v_user_id := NULL;
    ELSIF NOT EXISTS (
        SELECT 1 FROM app_core.profiles
        WHERE id = v_user_id AND role = 'ADMIN'
    ) THEN
        -- Não é ADMIN e não é Service Role - negar
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Apenas administradores ou sistema podem modificar configurações'
        );
    END IF;
    
    -- Obter chave de criptografia
    v_encryption_key := app_core.get_encryption_key();
    
    -- Criptografar valor se necessário
    IF p_is_encrypted THEN
        v_encrypted_value := app_core.encrypt_token(p_value, v_encryption_key);
        v_final_value := v_encrypted_value;
    ELSE
        v_final_value := p_value;
    END IF;
    
    -- Inserir ou atualizar
    INSERT INTO app_core.app_config (key, value, description, is_encrypted, updated_by)
    VALUES (p_key, v_final_value, p_description, p_is_encrypted, v_user_id)
    ON CONFLICT (key) 
    DO UPDATE SET
        value = v_final_value,
        description = COALESCE(p_description, app_core.app_config.description),
        is_encrypted = p_is_encrypted,
        updated_by = v_user_id,
        updated_at = NOW();
    
    RETURN jsonb_build_object(
        'success', true,
        'key', p_key,
        'message', 'Configuração salva com sucesso'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.set_app_config IS 'Salva ou atualiza uma configuração do sistema, criptografando automaticamente se is_encrypted = true. Permite Service Role (para setup) ou ADMIN. Usa SECURITY DEFINER para bypass RLS.';

-- ----------------------------------------------------------------------------
-- Função: Obter Client ID da Conta Azul (público, sem criptografia)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.get_conta_azul_client_id()
RETURNS TEXT AS $$
BEGIN
    -- Buscar Client ID (não criptografado, pode ser público)
    RETURN app_core.get_app_config('conta_azul_client_id');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.get_conta_azul_client_id IS 'Retorna o Client ID da Conta Azul (público, não criptografado). Acessível por authenticated e anon. Usa SECURITY DEFINER para garantir acesso mesmo sem autenticação.';

-- ----------------------------------------------------------------------------
-- Função: Obter Client Secret da Conta Azul (criptografado, apenas Service Role/ADMIN)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.get_conta_azul_client_secret()
RETURNS TEXT AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Verificar se é Service Role (v_user_id será NULL) ou ADMIN
    v_user_id := auth.uid();
    
    -- Se não tem user_id (Service Role) ou é ADMIN, permitir
    IF v_user_id IS NULL THEN
        -- Service Role - permitir
    ELSIF NOT EXISTS (
        SELECT 1 FROM app_core.profiles
        WHERE id = v_user_id AND role = 'ADMIN'
    ) THEN
        -- Não é ADMIN e não é Service Role - negar
        RETURN NULL;
    END IF;
    
    -- Buscar Client Secret (criptografado)
    RETURN app_core.get_app_config('conta_azul_client_secret');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.get_conta_azul_client_secret IS 'Retorna o Client Secret da Conta Azul (criptografado, descriptografado automaticamente). Apenas Service Role ou ADMIN podem acessar. Usa SECURITY DEFINER para bypass RLS.';

-- ----------------------------------------------------------------------------
-- Permissões (GRANT EXECUTE) para PostgREST/Supabase RPC
-- ----------------------------------------------------------------------------
-- OBS: SECURITY DEFINER não substitui GRANT EXECUTE. Sem isso, PostgREST pode
-- retornar 404/PGRST202 (“não encontrado no schema cache”) para roles anon/authenticated.

-- Client ID: pode ser público
GRANT EXECUTE ON FUNCTION app_core.get_conta_azul_client_id() TO anon;
GRANT EXECUTE ON FUNCTION app_core.get_conta_azul_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION app_core.get_conta_azul_client_id() TO service_role;

-- Client Secret: permitir chamada, mas a função retorna NULL se não for ADMIN/Service Role
GRANT EXECUTE ON FUNCTION app_core.get_conta_azul_client_secret() TO authenticated;
GRANT EXECUTE ON FUNCTION app_core.get_conta_azul_client_secret() TO service_role;

-- Base config helpers (útil para ADMIN/Service Role)
GRANT EXECUTE ON FUNCTION app_core.get_app_config(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION app_core.get_app_config(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION app_core.set_app_config(TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION app_core.set_app_config(TEXT, TEXT, TEXT, BOOLEAN) TO service_role;
`;

// Migration 025: Corrigir Permissões de Schema para service_role
const MIGRATION_025 = `-- ============================================================================
-- Migration 025: Corrigir Permissões de Schema para service_role
-- ============================================================================
-- Adiciona GRANT USAGE nos schemas para service_role
-- Necessário para Edge Functions acessarem funções RPC nos schemas
-- ============================================================================

-- Schema app_core: usado por todas as Edge Functions principais
GRANT USAGE ON SCHEMA app_core TO service_role;

-- Schema dw: usado pela Edge Function dw-api (dw.hash_api_key, dw.validate_api_key)
GRANT USAGE ON SCHEMA dw TO service_role;

-- Schema integrations: usado por RPCs de controle de carga
GRANT USAGE ON SCHEMA integrations TO service_role;

-- Schema integrations_conta_azul: usado por RPCs de upsert de dados
GRANT USAGE ON SCHEMA integrations_conta_azul TO service_role;
`;

// Migration 026: Corrigir Dados Não Criptografados
const MIGRATION_026 = `-- ============================================================================
-- Migration 026: Corrigir Dados Não Criptografados Marcados como Criptografados
-- ============================================================================
-- Melhora get_app_config para tratar erros de descriptografia retornando
-- o valor original como fallback (para dados antigos não criptografados)
-- ============================================================================

CREATE OR REPLACE FUNCTION app_core.get_app_config(p_key TEXT)
RETURNS TEXT AS $$
DECLARE
    v_encryption_key TEXT;
    v_config_value TEXT;
    v_is_encrypted BOOLEAN;
    v_decrypted_value TEXT;
BEGIN
    -- Buscar configuração
    SELECT value, is_encrypted INTO v_config_value, v_is_encrypted
    FROM app_core.app_config
    WHERE key = p_key;

    -- Se não encontrou, retornar NULL
    IF v_config_value IS NULL THEN
        RETURN NULL;
    END IF;

    -- Se não está criptografado, retornar direto
    IF NOT v_is_encrypted THEN
        RETURN v_config_value;
    END IF;

    -- Se está criptografado, tentar descriptografar
    BEGIN
        v_encryption_key := app_core.get_encryption_key();
        v_decrypted_value := app_core.decrypt_token(v_config_value, v_encryption_key);
        RETURN v_decrypted_value;
    EXCEPTION
        WHEN OTHERS THEN
            -- Se falhar a descriptografia (valor não está realmente criptografado),
            -- retornar o valor original como fallback
            RAISE WARNING 'Erro ao descriptografar %: %. Retornando valor original como fallback.', p_key, SQLERRM;
            RETURN v_config_value;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

// Migration 031: Criar Função RPC para Validar/Buscar Tenant
const MIGRATION_031 = `-- ============================================================================
-- Migration 031: Criar Função RPC para Validar/Buscar Tenant
-- ============================================================================
-- Função para buscar tenant por ID de forma robusta, bypassando problemas
-- de RLS/cache do PostgREST. Usa SECURITY DEFINER para garantir acesso.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Função: Obter tenant por ID
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_core.get_tenant_by_id(p_tenant_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.name, t.status
    FROM app_core.tenants t
    WHERE t.id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION app_core.get_tenant_by_id IS 'Retorna informações do tenant por ID (id, name, status). Usa SECURITY DEFINER para bypass RLS. Retorna vazio se tenant não existir.';

-- ----------------------------------------------------------------------------
-- Permissões (GRANT EXECUTE) para PostgREST/Supabase RPC
-- ----------------------------------------------------------------------------
-- OBS: SECURITY DEFINER não substitui GRANT EXECUTE. Sem isso, PostgREST pode
-- retornar 404/PGRST202 ("não encontrado no schema cache") para roles anon/authenticated.

GRANT EXECUTE ON FUNCTION app_core.get_tenant_by_id(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION app_core.get_tenant_by_id(UUID) TO authenticated;
`;

// Migration 014: 014 Create Dw Dim Calendario
const MIGRATION_014 = `-- ============================================================================
-- Migration 014: Criar Tabela dim_calendario e Função carregar_dim_calendario
-- ============================================================================
-- Cria a dimensão calendário para análise temporal e função para preenchê-la
-- Adaptado para usar tenant_id ao invés de cliente_id
-- ============================================================================

-- ============================================
-- FUNÇÃO AUXILIAR: calcular_nivel_maximo
-- Calcula nivel_maximo dinamicamente baseado nos níveis preenchidos
-- ============================================
CREATE OR REPLACE FUNCTION dw.calcular_nivel_maximo(
    nivel_1_desc TEXT,
    nivel_2_desc TEXT,
    nivel_3_desc TEXT,
    nivel_4_desc TEXT,
    nivel_5_desc TEXT
)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT GREATEST(
        CASE WHEN nivel_1_desc IS NOT NULL THEN 1 ELSE 0 END,
        CASE WHEN nivel_2_desc IS NOT NULL THEN 2 ELSE 0 END,
        CASE WHEN nivel_3_desc IS NOT NULL THEN 3 ELSE 0 END,
        CASE WHEN nivel_4_desc IS NOT NULL THEN 4 ELSE 0 END,
        CASE WHEN nivel_5_desc IS NOT NULL THEN 5 ELSE 0 END
    );
$$;

COMMENT ON FUNCTION dw.calcular_nivel_maximo IS 'Calcula nivel_maximo dinamicamente baseado nos níveis preenchidos (nivel_1_desc a nivel_5_desc)';

-- ============================================
-- DIMENSÃO: dim_calendario
-- Tabela de dimensão tempo para análise temporal
-- ============================================
CREATE TABLE IF NOT EXISTS dw.dim_calendario (
    data_id SERIAL PRIMARY KEY,
    data DATE NOT NULL UNIQUE,
    ano INTEGER NOT NULL,
    mes INTEGER NOT NULL,
    dia INTEGER NOT NULL,
    trimestre INTEGER NOT NULL,
    semestre INTEGER NOT NULL,
    dia_semana INTEGER NOT NULL, -- 1=Domingo, 7=Sábado
    mes_nome TEXT NOT NULL,
    trimestre_nome TEXT NOT NULL,
    semestre_nome TEXT NOT NULL,
    dia_semana_nome TEXT NOT NULL,
    ano_mes TEXT NOT NULL, -- Formato: YYYY-MM
    ano_trimestre TEXT NOT NULL, -- Formato: YYYY-Q
    ano_semestre TEXT NOT NULL, -- Formato: YYYY-S
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para dim_calendario
CREATE INDEX IF NOT EXISTS idx_dim_calendario_data ON dw.dim_calendario(data);
CREATE INDEX IF NOT EXISTS idx_dim_calendario_ano ON dw.dim_calendario(ano);
CREATE INDEX IF NOT EXISTS idx_dim_calendario_ano_mes ON dw.dim_calendario(ano_mes);
CREATE INDEX IF NOT EXISTS idx_dim_calendario_ano_trimestre ON dw.dim_calendario(ano_trimestre);

-- Comentários
COMMENT ON TABLE dw.dim_calendario IS 'Dimensão calendário para análise temporal. Preencher com datas de 2020 a 2030.';
COMMENT ON COLUMN dw.dim_calendario.data_id IS 'ID único da data (chave primária)';
COMMENT ON COLUMN dw.dim_calendario.data IS 'Data (formato DATE)';
COMMENT ON COLUMN dw.dim_calendario.ano_mes IS 'Ano e mês no formato YYYY-MM';
COMMENT ON COLUMN dw.dim_calendario.ano_trimestre IS 'Ano e trimestre no formato YYYY-Q';

-- ============================================
-- FUNÇÃO: carregar_dim_calendario
-- Preenche a dimensão calendário com datas de 2020 a 2030
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_dim_calendario()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    data_atual DATE;
    data_fim DATE;
    registros_inseridos INTEGER := 0;
BEGIN
    -- Limpar dados existentes (opcional - comentar se não quiser limpar)
    -- TRUNCATE TABLE dw.dim_calendario;
    
    data_atual := '2020-01-01'::DATE;
    data_fim := '2030-12-31'::DATE;
    
    WHILE data_atual <= data_fim LOOP
        INSERT INTO dw.dim_calendario (
            data,
            ano,
            mes,
            dia,
            trimestre,
            semestre,
            dia_semana,
            mes_nome,
            trimestre_nome,
            semestre_nome,
            dia_semana_nome,
            ano_mes,
            ano_trimestre,
            ano_semestre
        )
        VALUES (
            data_atual,
            EXTRACT(YEAR FROM data_atual)::INTEGER,
            EXTRACT(MONTH FROM data_atual)::INTEGER,
            EXTRACT(DAY FROM data_atual)::INTEGER,
            EXTRACT(QUARTER FROM data_atual)::INTEGER,
            CASE WHEN EXTRACT(QUARTER FROM data_atual) <= 2 THEN 1 ELSE 2 END,
            EXTRACT(DOW FROM data_atual) + 1, -- PostgreSQL DOW: 0=Domingo, ajustar para 1=Domingo
            TO_CHAR(data_atual, 'TMMonth'), -- Nome do mês
            'T' || EXTRACT(QUARTER FROM data_atual)::TEXT || 'º Trimestre',
            CASE WHEN EXTRACT(QUARTER FROM data_atual) <= 2 THEN '1º Semestre' ELSE '2º Semestre' END,
            CASE EXTRACT(DOW FROM data_atual)
                WHEN 0 THEN 'Domingo'
                WHEN 1 THEN 'Segunda-feira'
                WHEN 2 THEN 'Terça-feira'
                WHEN 3 THEN 'Quarta-feira'
                WHEN 4 THEN 'Quinta-feira'
                WHEN 5 THEN 'Sexta-feira'
                WHEN 6 THEN 'Sábado'
            END,
            TO_CHAR(data_atual, 'YYYY-MM'),
            TO_CHAR(data_atual, 'YYYY') || '-Q' || EXTRACT(QUARTER FROM data_atual)::TEXT,
            TO_CHAR(data_atual, 'YYYY') || '-S' || CASE WHEN EXTRACT(QUARTER FROM data_atual) <= 2 THEN '1' ELSE '2' END
        )
        ON CONFLICT (data) DO NOTHING;
        
        registros_inseridos := registros_inseridos + 1;
        data_atual := data_atual + INTERVAL '1 day';
    END LOOP;
    
    RETURN registros_inseridos;
END;
$$;

COMMENT ON FUNCTION dw.carregar_dim_calendario() IS 'Preenche a dimensão calendário com datas de 2020 a 2030';
`;

// Migration 015: 015 Create Dw Etl Dimensoes
const MIGRATION_015 = `-- ============================================================================
-- Migration 015: Criar Funções ETL de Dimensões
-- ============================================================================
-- Funções ETL para carregar dimensões do Data Warehouse
-- Estas funções populam as dimensões a partir das tabelas de coleta
-- Adaptado para usar tenant_id ao invés de cliente_id e schemas corretos
-- ============================================================================

-- NOTA: A função calcular_nivel_maximo e carregar_dim_calendario foram movidas para a migration 014
-- Esta migration contém apenas as funções ETL de dimensões (categorias, pessoas, etc.)

-- ============================================
-- FUNÇÃO AUXILIAR: construir_hierarquia_categoria
-- Constrói hierarquia nivelada de categoria recursivamente
-- ============================================
-- IMPORTANTE: Se houver erro de "function is not unique", execute primeiro:
-- DO $$ 
-- DECLARE 
--     r RECORD;
-- BEGIN
--     FOR r IN (SELECT oid, proname, pronargs FROM pg_proc WHERE proname = 'construir_hierarquia_categoria' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dw'))
--     LOOP
--         EXECUTE 'DROP FUNCTION IF EXISTS dw.construir_hierarquia_categoria CASCADE';
--     END LOOP;
-- END $$;
--
-- Remover TODAS as versões da função antiga (pode ter múltiplas assinaturas)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT 'DROP FUNCTION IF EXISTS dw.' || proname || '(' || 
               pg_get_function_identity_arguments(oid) || ') CASCADE' AS drop_cmd
        FROM pg_proc 
        WHERE proname = 'construir_hierarquia_categoria' 
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dw')
    )
    LOOP
        EXECUTE r.drop_cmd;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION dw.construir_hierarquia_categoria(
    p_tenant_id UUID,
    p_categoria_id TEXT,
    p_categorias_visitadas TEXT[] DEFAULT ARRAY[]::TEXT[],
    p_profundidade INTEGER DEFAULT 0
)
RETURNS TABLE(
    nivel_1_desc TEXT,
    nivel_2_desc TEXT,
    nivel_3_desc TEXT,
    nivel_4_desc TEXT,
    nivel_5_desc TEXT,
    nivel_maximo INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_categoria RECORD;
    v_max_profundidade CONSTANT INTEGER := 10; -- Limite máximo de profundidade para evitar loops infinitos
BEGIN
    -- Proteção contra loops infinitos: verificar se já visitamos esta categoria
    IF p_categoria_id = ANY(p_categorias_visitadas) THEN
        RAISE WARNING 'Loop detectado na hierarquia de categorias. tenant: %, Categoria: %, Caminho: %', 
            p_tenant_id, p_categoria_id, array_to_string(p_categorias_visitadas || ARRAY[p_categoria_id], ' -> ');
        -- Retornar hierarquia parcial até o ponto do loop
        RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Proteção contra profundidade excessiva
    IF p_profundidade >= v_max_profundidade THEN
        RAISE WARNING 'Profundidade máxima (% níveis) atingida na hierarquia. tenant: %, Categoria: %', 
            v_max_profundidade, p_tenant_id, p_categoria_id;
        RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Buscar categoria atual
    SELECT nome, categoria_pai
    INTO v_categoria
    FROM integrations_conta_azul.categorias
    WHERE tenant_id = p_tenant_id
      AND categoria_id = p_categoria_id;
    
    -- Se não encontrou, retornar NULLs
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Se tem pai, buscar recursivamente primeiro (construir hierarquia da raiz até o filho)
    -- categoria_pai agora armazena diretamente o categoria_id (TEXT)
    IF v_categoria.categoria_pai IS NOT NULL THEN
        -- Chamar recursivamente para construir a hierarquia do pai primeiro
        -- O resultado já terá os níveis preenchidos [raiz, filho, ...] até o pai
        DECLARE
            v_hierarquia_pai RECORD;
            v_proximo_nivel INTEGER;
            v_pai_existe BOOLEAN;
        BEGIN
            -- Verificar se o pai existe antes de chamar recursivamente
            SELECT EXISTS(
                SELECT 1 FROM integrations_conta_azul.categorias 
                WHERE tenant_id = p_tenant_id 
                  AND categoria_id = v_categoria.categoria_pai
            ) INTO v_pai_existe;
            
            -- Se o pai não existe, tratar como raiz (pode ser categoria órfã)
            IF NOT v_pai_existe THEN
                RETURN QUERY SELECT
                    v_categoria.nome AS nivel_1_desc,
                    NULL::TEXT AS nivel_2_desc,
                    NULL::TEXT AS nivel_3_desc,
                    NULL::TEXT AS nivel_4_desc,
                    NULL::TEXT AS nivel_5_desc,
                    1::INTEGER AS nivel_maximo;
                RETURN;
            END IF;
            
            SELECT * INTO v_hierarquia_pai
            FROM dw.construir_hierarquia_categoria(
                p_tenant_id,
                v_categoria.categoria_pai,
                p_categorias_visitadas || ARRAY[p_categoria_id], -- Adicionar categoria atual ao caminho visitado
                p_profundidade + 1 -- Incrementar profundidade
            );
            
            -- Encontrar o próximo nível disponível (primeiro NULL após o último preenchido)
            -- O pai já tem nivel_1_desc preenchido (sempre), então o próximo é nivel_2_desc
            IF v_hierarquia_pai.nivel_2_desc IS NULL THEN
                v_proximo_nivel := 2;
            ELSIF v_hierarquia_pai.nivel_3_desc IS NULL THEN
                v_proximo_nivel := 3;
            ELSIF v_hierarquia_pai.nivel_4_desc IS NULL THEN
                v_proximo_nivel := 4;
            ELSIF v_hierarquia_pai.nivel_5_desc IS NULL THEN
                v_proximo_nivel := 5;
            ELSE
                v_proximo_nivel := 6;  -- Limite de 5 níveis atingido
            END IF;
            
            -- Retornar hierarquia com o nome atual adicionado no próximo nível
            RETURN QUERY SELECT
                v_hierarquia_pai.nivel_1_desc,
                CASE WHEN v_proximo_nivel = 2 THEN v_categoria.nome ELSE v_hierarquia_pai.nivel_2_desc END,
                CASE WHEN v_proximo_nivel = 3 THEN v_categoria.nome ELSE v_hierarquia_pai.nivel_3_desc END,
                CASE WHEN v_proximo_nivel = 4 THEN v_categoria.nome ELSE v_hierarquia_pai.nivel_4_desc END,
                CASE WHEN v_proximo_nivel = 5 THEN v_categoria.nome ELSE v_hierarquia_pai.nivel_5_desc END,
                CASE 
                    WHEN v_proximo_nivel = 6 THEN 5  -- Limite atingido: retornar 5 (máximo permitido)
                    ELSE v_proximo_nivel  -- nivel_maximo é simplesmente o próximo nível onde adicionamos o nome
                END AS nivel_maximo;
            RETURN;
        END;
    END IF;
    
    -- É raiz (sem pai), retornar hierarquia com apenas este nível
    RETURN QUERY SELECT
        v_categoria.nome AS nivel_1_desc,
        NULL::TEXT AS nivel_2_desc,
        NULL::TEXT AS nivel_3_desc,
        NULL::TEXT AS nivel_4_desc,
        NULL::TEXT AS nivel_5_desc,
        1::INTEGER AS nivel_maximo;
END;
$$;

COMMENT ON FUNCTION dw.construir_hierarquia_categoria(UUID, TEXT, TEXT[], INTEGER) IS 'Constrói hierarquia nivelada de categoria recursivamente. Protegida contra loops infinitos (detecta ciclos) e profundidade excessiva (máximo 10 níveis). Parâmetros: p_tenant_id, p_categoria_id, p_categorias_visitadas (interno), p_profundidade (interno).';

-- ============================================
-- FUNÇÃO: carregar_dim_categoria
-- Carrega dimensão de categorias com hierarquia nivelada
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_dim_categoria(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_categoria RECORD;
    v_hierarquia RECORD;
    v_registros INTEGER := 0;
    v_erros INTEGER := 0;
BEGIN
    -- Validação de entrada
    IF p_tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app_core.tenants WHERE id = p_tenant_id) THEN
        RAISE EXCEPTION 'Tenant não encontrado: %', p_tenant_id;
    END IF;
    
    -- Loop através das categorias
    FOR v_categoria IN
        SELECT 
            c.id,
            c.tenant_id,
            c.categoria_id,
            c.nome,
            c.tipo
        FROM integrations_conta_azul.categorias c
        WHERE (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
        ORDER BY c.tenant_id, c.categoria_id -- Ordenar para processamento consistente
    LOOP
        BEGIN
            -- Construir hierarquia
            SELECT * INTO v_hierarquia
            FROM dw.construir_hierarquia_categoria(
                v_categoria.tenant_id,
                v_categoria.categoria_id
            );
            
            -- Inserir ou atualizar dimensão
            INSERT INTO dw.dim_categoria (
                tenant_id,
                categoria_api_id,
                nome,
                tipo,
                nivel_1_desc,
                nivel_2_desc,
                nivel_3_desc,
                nivel_4_desc,
                nivel_5_desc,
                nivel_maximo
            )
            VALUES (
                v_categoria.tenant_id,
                v_categoria.categoria_id,
                v_categoria.nome,
                v_categoria.tipo,
                v_hierarquia.nivel_1_desc,
                v_hierarquia.nivel_2_desc,
                v_hierarquia.nivel_3_desc,
                v_hierarquia.nivel_4_desc,
                v_hierarquia.nivel_5_desc,
                v_hierarquia.nivel_maximo
            )
            ON CONFLICT (tenant_id, categoria_api_id)
            DO UPDATE SET
                nome = EXCLUDED.nome,
                tipo = EXCLUDED.tipo,
                nivel_1_desc = EXCLUDED.nivel_1_desc,
                nivel_2_desc = EXCLUDED.nivel_2_desc,
                nivel_3_desc = EXCLUDED.nivel_3_desc,
                nivel_4_desc = EXCLUDED.nivel_4_desc,
                nivel_5_desc = EXCLUDED.nivel_5_desc,
                nivel_maximo = EXCLUDED.nivel_maximo,
                updated_at = NOW();
            
            v_registros := v_registros + 1;
        EXCEPTION
            WHEN OTHERS THEN
                v_erros := v_erros + 1;
                RAISE WARNING 'Erro ao processar categoria % (tenant: %): %', 
                    v_categoria.categoria_id, v_categoria.tenant_id, SQLERRM;
        END;
    END LOOP;
    
    IF v_erros > 0 THEN
        RAISE WARNING 'Processamento concluído com % erros de % categorias processadas', v_erros, v_registros + v_erros;
    END IF;
    
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_dim_categoria(UUID) IS 'Carrega dimensão de categorias com hierarquia nivelada. Se p_tenant_id for NULL, carrega todos os tenants.';

-- ============================================
-- FUNÇÃO AUXILIAR: construir_hierarquia_categoria_dre
-- Constrói hierarquia nivelada de categoria DRE recursivamente
-- ============================================
-- Remover TODAS as versões da função antiga (pode ter múltiplas assinaturas)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT 'DROP FUNCTION IF EXISTS dw.' || proname || '(' || 
               pg_get_function_identity_arguments(oid) || ') CASCADE' AS drop_cmd
        FROM pg_proc 
        WHERE proname = 'construir_hierarquia_categoria_dre' 
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dw')
    )
    LOOP
        EXECUTE r.drop_cmd;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION dw.construir_hierarquia_categoria_dre(
    p_tenant_id UUID,
    p_categoria_dre_id TEXT,
    p_nivel INTEGER DEFAULT 1,
    p_niveis TEXT[] DEFAULT ARRAY[]::TEXT[],
    p_categorias_visitadas TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS TABLE(
    nivel_1_desc TEXT,
    nivel_2_desc TEXT,
    nivel_3_desc TEXT,
    nivel_4_desc TEXT,
    nivel_5_desc TEXT,
    nivel_maximo INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_categoria RECORD;
    v_niveis TEXT[];
    v_max_profundidade CONSTANT INTEGER := 10; -- Limite máximo de profundidade
BEGIN
    -- Proteção contra loops infinitos: verificar se já visitamos esta categoria
    IF p_categoria_dre_id = ANY(p_categorias_visitadas) THEN
        RAISE WARNING 'Loop detectado na hierarquia de categorias DRE. tenant: %, Categoria: %, Caminho: %', 
            p_tenant_id, p_categoria_dre_id, array_to_string(p_categorias_visitadas || ARRAY[p_categoria_dre_id], ' -> ');
        RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Proteção contra profundidade excessiva
    IF p_nivel >= v_max_profundidade THEN
        RAISE WARNING 'Profundidade máxima (% níveis) atingida na hierarquia DRE. tenant: %, Categoria: %', 
            v_max_profundidade, p_tenant_id, p_categoria_dre_id;
        RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Buscar categoria atual
    SELECT descricao, categoria_dre_pai_id
    INTO v_categoria
    FROM integrations_conta_azul.categorias_dre
    WHERE tenant_id = p_tenant_id
      AND categoria_dre_id = p_categoria_dre_id;
    
    -- Se não encontrou, retornar NULLs
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Adicionar descrição atual aos níveis
    v_niveis := ARRAY[v_categoria.descricao] || p_niveis;
    
    -- Se tem pai, buscar recursivamente
    IF v_categoria.categoria_dre_pai_id IS NOT NULL THEN
        RETURN QUERY
        SELECT * FROM dw.construir_hierarquia_categoria_dre(
            p_tenant_id,
            v_categoria.categoria_dre_pai_id,
            p_nivel + 1,
            v_niveis,
            p_categorias_visitadas || ARRAY[p_categoria_dre_id] -- Adicionar categoria atual ao caminho visitado
        );
    ELSE
        -- É raiz, retornar hierarquia
        RETURN QUERY SELECT
            COALESCE(v_niveis[1], NULL)::TEXT AS nivel_1_desc,
            COALESCE(v_niveis[2], NULL)::TEXT AS nivel_2_desc,
            COALESCE(v_niveis[3], NULL)::TEXT AS nivel_3_desc,
            COALESCE(v_niveis[4], NULL)::TEXT AS nivel_4_desc,
            COALESCE(v_niveis[5], NULL)::TEXT AS nivel_5_desc,
            LEAST(array_length(v_niveis, 1), 5)::INTEGER AS nivel_maximo;
    END IF;
END;
$$;

COMMENT ON FUNCTION dw.construir_hierarquia_categoria_dre(UUID, TEXT, INTEGER, TEXT[], TEXT[]) IS 'Constrói hierarquia nivelada de categoria DRE recursivamente. Protegida contra loops infinitos (detecta ciclos) e profundidade excessiva (máximo 10 níveis). Parâmetros: p_tenant_id, p_categoria_dre_id, p_nivel (interno), p_niveis (interno), p_categorias_visitadas (interno).';

-- ============================================
-- FUNÇÃO: carregar_dim_categoria_dre
-- Carrega dimensão de categorias DRE com hierarquia nivelada
-- Expande categorias financeiras associadas como nível adicional
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_dim_categoria_dre(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_categoria RECORD;
    v_hierarquia RECORD;
    v_categoria_financeira JSONB;
    v_registros INTEGER := 0;
    v_erros INTEGER := 0;
    v_nivel_proximo INTEGER;
    v_nome_cf TEXT;
BEGIN
    -- Validação de entrada
    IF p_tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app_core.tenants WHERE id = p_tenant_id) THEN
        RAISE EXCEPTION 'Tenant não encontrado: %', p_tenant_id;
    END IF;
    
    FOR v_categoria IN
        SELECT 
            cd.id,
            cd.tenant_id,
            cd.categoria_dre_id,
            cd.descricao,
            cd.codigo,
            cd.posicao,
            cd.dados_originais
        FROM integrations_conta_azul.categorias_dre cd
        WHERE (p_tenant_id IS NULL OR cd.tenant_id = p_tenant_id)
        ORDER BY cd.tenant_id, cd.categoria_dre_id -- Ordenar para processamento consistente
    LOOP
        BEGIN
            -- Construir hierarquia da categoria DRE
            SELECT * INTO v_hierarquia
            FROM dw.construir_hierarquia_categoria_dre(
                v_categoria.tenant_id,
                v_categoria.categoria_dre_id
            );
            
            -- Inserir ou atualizar registro da categoria DRE (sem expansão)
            INSERT INTO dw.dim_categoria_dre (
                tenant_id,
                categoria_dre_api_id,
                descricao,
                codigo,
                posicao,
                categoria_financeira_id,
                nivel_1_desc,
                nivel_2_desc,
                nivel_3_desc,
                nivel_4_desc,
                nivel_5_desc,
                nivel_maximo
            )
            VALUES (
                v_categoria.tenant_id,
                v_categoria.categoria_dre_id,
                v_categoria.descricao,
                v_categoria.codigo,
                v_categoria.posicao,
                NULL, -- Registro da categoria DRE (sem expansão)
                v_hierarquia.nivel_1_desc,
                v_hierarquia.nivel_2_desc,
                v_hierarquia.nivel_3_desc,
                v_hierarquia.nivel_4_desc,
                v_hierarquia.nivel_5_desc,
                v_hierarquia.nivel_maximo
            )
            ON CONFLICT (tenant_id, categoria_dre_api_id, categoria_financeira_id)
            DO UPDATE SET
                descricao = EXCLUDED.descricao,
                codigo = EXCLUDED.codigo,
                posicao = EXCLUDED.posicao,
                nivel_1_desc = EXCLUDED.nivel_1_desc,
                nivel_2_desc = EXCLUDED.nivel_2_desc,
                nivel_3_desc = EXCLUDED.nivel_3_desc,
                nivel_4_desc = EXCLUDED.nivel_4_desc,
                nivel_5_desc = EXCLUDED.nivel_5_desc,
                nivel_maximo = EXCLUDED.nivel_maximo,
                updated_at = NOW();
            
            v_registros := v_registros + 1;
            
            -- Expandir categorias financeiras (apenas se ainda há espaço na hierarquia)
            IF v_hierarquia.nivel_maximo < 5 AND 
               v_categoria.dados_originais ? 'categorias_financeiras' AND
               jsonb_typeof(v_categoria.dados_originais->'categorias_financeiras') = 'array' THEN
                
                -- Processar cada categoria financeira
                FOR v_categoria_financeira IN
                    SELECT value
                    FROM jsonb_array_elements(v_categoria.dados_originais->'categorias_financeiras')
                    WHERE (value->>'ativo')::boolean = true  -- Apenas categorias ativas
                LOOP
                    -- Calcular próximo nível
                    v_nivel_proximo := v_hierarquia.nivel_maximo + 1;
                    v_nome_cf := v_categoria_financeira->>'nome';
                    
                    -- Inserir ou atualizar registro expandido
                    -- O nome da categoria financeira vai no próximo nível disponível
                    INSERT INTO dw.dim_categoria_dre (
                        tenant_id,
                        categoria_dre_api_id,
                        descricao,
                        codigo,
                        posicao,
                        categoria_financeira_id,
                        nivel_1_desc,
                        nivel_2_desc,
                        nivel_3_desc,
                        nivel_4_desc,
                        nivel_5_desc,
                        nivel_maximo
                    )
                    VALUES (
                        v_categoria.tenant_id,
                        v_categoria.categoria_dre_id,
                        v_categoria.descricao,
                        v_categoria.codigo,
                        v_categoria.posicao, -- Manter mesma posição da categoria DRE base
                        v_categoria_financeira->>'id', -- ID da categoria financeira
                        v_hierarquia.nivel_1_desc,
                        CASE WHEN v_nivel_proximo = 2 THEN v_nome_cf ELSE v_hierarquia.nivel_2_desc END,
                        CASE WHEN v_nivel_proximo = 3 THEN v_nome_cf ELSE v_hierarquia.nivel_3_desc END,
                        CASE WHEN v_nivel_proximo = 4 THEN v_nome_cf ELSE v_hierarquia.nivel_4_desc END,
                        CASE WHEN v_nivel_proximo = 5 THEN v_nome_cf ELSE v_hierarquia.nivel_5_desc END,
                        v_nivel_proximo
                    )
                    ON CONFLICT (tenant_id, categoria_dre_api_id, categoria_financeira_id)
                    DO UPDATE SET
                        descricao = EXCLUDED.descricao,
                        codigo = EXCLUDED.codigo,
                        posicao = EXCLUDED.posicao,
                        nivel_1_desc = EXCLUDED.nivel_1_desc,
                        nivel_2_desc = EXCLUDED.nivel_2_desc,
                        nivel_3_desc = EXCLUDED.nivel_3_desc,
                        nivel_4_desc = EXCLUDED.nivel_4_desc,
                        nivel_5_desc = EXCLUDED.nivel_5_desc,
                        nivel_maximo = EXCLUDED.nivel_maximo,
                        updated_at = NOW();
                    
                    v_registros := v_registros + 1;
                END LOOP;
            END IF;
            
        EXCEPTION
            WHEN OTHERS THEN
                v_erros := v_erros + 1;
                RAISE WARNING 'Erro ao processar categoria DRE % (tenant: %): %', 
                    v_categoria.categoria_dre_id, v_categoria.tenant_id, SQLERRM;
        END;
    END LOOP;
    
    IF v_erros > 0 THEN
        RAISE WARNING 'Processamento concluído com % erros de % categorias DRE processadas', v_erros, v_registros + v_erros;
    END IF;
    
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_dim_categoria_dre(UUID) IS 'Carrega dimensão de categorias DRE com hierarquia nivelada. Expande categorias financeiras associadas como nível adicional na hierarquia. Se p_tenant_id for NULL, carrega todos os tenants.';

-- ============================================
-- FUNÇÃO: carregar_mascara_totalizadores_dre
-- Identifica e popula tabela máscara com totalizadores DRE
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_mascara_totalizadores_dre(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE(
    total_inseridos INTEGER,
    total_atualizados INTEGER,
    detalhes JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_inseridos INTEGER := 0;
    v_atualizados INTEGER := 0;
    v_detalhes JSONB;
    v_antes INTEGER;
    v_depois INTEGER;
BEGIN
    -- Validação de entrada
    IF p_tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app_core.tenants WHERE id = p_tenant_id) THEN
        RAISE EXCEPTION 'Tenant não encontrado: %', p_tenant_id;
    END IF;
    
    -- Contar registros antes
    SELECT COUNT(*) INTO v_antes
    FROM dw.mascara_totalizadores_dre
    WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id);
    
    -- Inserir ou atualizar totalizadores identificados
    WITH totalizadores AS (
        SELECT DISTINCT
            cd.tenant_id,
            cd.posicao,
            cd.categoria_dre_id,
            cd.descricao,
            cd.codigo
        FROM integrations_conta_azul.categorias_dre cd
        WHERE cd.categoria_dre_pai_id IS NULL
          AND cd.codigo IS NULL
          AND (cd.dados_originais->'subitens')::jsonb = '[]'::jsonb
          AND (cd.dados_originais->'categorias_financeiras')::jsonb = '[]'::jsonb
          AND (p_tenant_id IS NULL OR cd.tenant_id = p_tenant_id)
    )
    INSERT INTO dw.mascara_totalizadores_dre (
        tenant_id,
        posicao,
        categoria_dre_api_id,
        descricao,
        codigo
    )
    SELECT 
        t.tenant_id,
        t.posicao,
        t.categoria_dre_id,
        t.descricao,
        t.codigo
    FROM totalizadores t
    ON CONFLICT (tenant_id, posicao)
    DO UPDATE SET
        categoria_dre_api_id = EXCLUDED.categoria_dre_api_id,
        descricao = EXCLUDED.descricao,
        codigo = EXCLUDED.codigo,
        updated_at = NOW();
    
    -- Contar registros depois
    SELECT COUNT(*) INTO v_depois
    FROM dw.mascara_totalizadores_dre
    WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id);
    
    -- Calcular inseridos e atualizados
    v_inseridos := v_depois - v_antes;
    v_atualizados := GREATEST(0, (SELECT COUNT(*) 
                                  FROM dw.mascara_totalizadores_dre
                                  WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
                                    AND updated_at > created_at
                                    AND updated_at > NOW() - INTERVAL '1 minute'));
    
    -- Atualizar FK categoria_dre_id na máscara (após popular dim_categoria_dre)
    UPDATE dw.mascara_totalizadores_dre mt
    SET categoria_dre_id = dcd.categoria_dre_id
    FROM dw.dim_categoria_dre dcd
    WHERE dcd.tenant_id = mt.tenant_id
      AND dcd.categoria_dre_api_id = mt.categoria_dre_api_id
      AND dcd.categoria_financeira_id IS NULL -- Apenas registros base, não expandidos
      AND mt.categoria_dre_id IS NULL -- Apenas atualizar se ainda não tem FK
      AND (p_tenant_id IS NULL OR mt.tenant_id = p_tenant_id);
    
    -- Coletar detalhes dos totalizadores
    SELECT jsonb_agg(
        jsonb_build_object(
            'tenant_id', tenant_id,
            'posicao', posicao,
            'categoria_dre_api_id', categoria_dre_api_id,
            'descricao', descricao,
            'codigo', codigo
        )
        ORDER BY tenant_id, posicao
    ) INTO v_detalhes
    FROM dw.mascara_totalizadores_dre
    WHERE (p_tenant_id IS NULL OR tenant_id = p_tenant_id);
    
    RETURN QUERY SELECT v_inseridos, v_atualizados, v_detalhes;
END;
$$;

COMMENT ON FUNCTION dw.carregar_mascara_totalizadores_dre(UUID) IS 'Identifica e popula tabela máscara com totalizadores DRE. Totalizadores são categorias raiz (sem pai) com codigo NULL, subitens vazios e categorias_financeiras vazias. Se p_tenant_id for NULL, processa todos os tenants.';

-- ============================================
-- FUNÇÃO: carregar_dim_centro_custo
-- Carrega dimensão de centros de custo
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_dim_centro_custo(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_registros INTEGER;
BEGIN
    -- Validação de entrada
    IF p_tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app_core.tenants WHERE id = p_tenant_id) THEN
        RAISE EXCEPTION 'Tenant não encontrado: %', p_tenant_id;
    END IF;
    
    INSERT INTO dw.dim_centro_custo (
        tenant_id,
        centro_custo_api_id,
        nome,
        codigo,
        ativo
    )
    SELECT 
        cc.tenant_id,
        cc.centro_custo_id,
        cc.nome,
        cc.codigo,
        cc.ativo
    FROM integrations_conta_azul.centro_custos cc
    WHERE (p_tenant_id IS NULL OR cc.tenant_id = p_tenant_id)
    ON CONFLICT (tenant_id, centro_custo_api_id)
    DO UPDATE SET
        nome = EXCLUDED.nome,
        codigo = EXCLUDED.codigo,
        ativo = EXCLUDED.ativo,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_registros = ROW_COUNT;
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_dim_centro_custo(UUID) IS 'Carrega dimensão de centros de custo. Se p_tenant_id for NULL, carrega todos os tenants.';

-- ============================================
-- FUNÇÃO: carregar_dim_pessoa
-- Carrega dimensão de pessoas (clientes/fornecedores do tenant)
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_dim_pessoa(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_pessoa RECORD;
    v_registros INTEGER := 0;
    v_erros INTEGER := 0;
    v_tipo_perfil TEXT;
    v_endereco JSONB;
    v_cidade TEXT;
    v_uf TEXT;
    v_pais TEXT;
BEGIN
    -- Validação de entrada
    IF p_tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app_core.tenants WHERE id = p_tenant_id) THEN
        RAISE EXCEPTION 'Tenant não encontrado: %', p_tenant_id;
    END IF;
    
    FOR v_pessoa IN
        SELECT 
            p.id,
            p.tenant_id,
            p.pessoa_id,
            p.nome,
            p.documento,
            p.tipo_pessoa,
            p.perfis,
            p.dados_originais
        FROM integrations_conta_azul.pessoas p
        WHERE (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
        ORDER BY p.tenant_id, p.pessoa_id -- Ordenar para processamento consistente
    LOOP
        BEGIN
        -- Extrair primeiro perfil do array
        v_tipo_perfil := CASE 
            WHEN v_pessoa.perfis IS NOT NULL AND array_length(v_pessoa.perfis, 1) > 0 
            THEN v_pessoa.perfis[1]
            ELSE NULL
        END;
        
        -- Extrair endereço do JSONB (se disponível)
        IF v_pessoa.dados_originais ? 'enderecos' AND jsonb_array_length(v_pessoa.dados_originais->'enderecos') > 0 THEN
            v_endereco := v_pessoa.dados_originais->'enderecos'->0;
            v_cidade := v_endereco->>'cidade';
            v_uf := v_endereco->>'estado';
            v_pais := v_endereco->>'pais';
        ELSE
            v_cidade := NULL;
            v_uf := NULL;
            v_pais := NULL;
        END IF;
        
        INSERT INTO dw.dim_pessoa (
            tenant_id,
            pessoa_api_id,
            nome,
            documento,
            tipo_pessoa,
            tipo_perfil,
            cidade,
            uf,
            pais
        )
        VALUES (
            v_pessoa.tenant_id,
            v_pessoa.pessoa_id,
            v_pessoa.nome,
            v_pessoa.documento,
            v_pessoa.tipo_pessoa,
            v_tipo_perfil,
            v_cidade,
            v_uf,
            v_pais
        )
        ON CONFLICT (tenant_id, pessoa_api_id)
        DO UPDATE SET
            nome = EXCLUDED.nome,
            documento = EXCLUDED.documento,
            tipo_pessoa = EXCLUDED.tipo_pessoa,
            tipo_perfil = EXCLUDED.tipo_perfil,
            cidade = EXCLUDED.cidade,
            uf = EXCLUDED.uf,
            pais = EXCLUDED.pais,
            updated_at = NOW();
        
            v_registros := v_registros + 1;
        EXCEPTION
            WHEN OTHERS THEN
                v_erros := v_erros + 1;
                RAISE WARNING 'Erro ao processar pessoa % (tenant: %): %', 
                    v_pessoa.pessoa_id, v_pessoa.tenant_id, SQLERRM;
        END;
    END LOOP;
    
    IF v_erros > 0 THEN
        RAISE WARNING 'Processamento concluído com % erros de % pessoas processadas', v_erros, v_registros + v_erros;
    END IF;
    
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_dim_pessoa(UUID) IS 'Carrega dimensão de pessoas. Se p_tenant_id for NULL, carrega todos os tenants.';

-- ============================================
-- FUNÇÃO: carregar_dim_conta_financeira
-- Carrega dimensão de contas financeiras
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_dim_conta_financeira(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_registros INTEGER;
BEGIN
    -- Validação de entrada
    IF p_tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app_core.tenants WHERE id = p_tenant_id) THEN
        RAISE EXCEPTION 'Tenant não encontrado: %', p_tenant_id;
    END IF;
    
    INSERT INTO dw.dim_conta_financeira (
        tenant_id,
        conta_financeira_api_id,
        nome,
        tipo,
        ativa
    )
    SELECT 
        cf.tenant_id,
        cf.conta_financeira_id,
        cf.nome,
        cf.tipo,
        cf.ativo
    FROM integrations_conta_azul.contas_financeiras cf
    WHERE (p_tenant_id IS NULL OR cf.tenant_id = p_tenant_id)
    ON CONFLICT (tenant_id, conta_financeira_api_id)
    DO UPDATE SET
        nome = EXCLUDED.nome,
        tipo = EXCLUDED.tipo,
        ativa = EXCLUDED.ativa,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_registros = ROW_COUNT;
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_dim_conta_financeira(UUID) IS 'Carrega dimensão de contas financeiras. Se p_tenant_id for NULL, carrega todos os tenants.';

-- ============================================
-- FUNÇÃO: carregar_dim_vendedor
-- Carrega dimensão de vendedores
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_dim_vendedor(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_registros INTEGER;
BEGIN
    -- Validação de entrada
    IF p_tenant_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM app_core.tenants WHERE id = p_tenant_id) THEN
        RAISE EXCEPTION 'Tenant não encontrado: %', p_tenant_id;
    END IF;
    
    INSERT INTO dw.dim_vendedor (
        tenant_id,
        vendedor_api_id,
        nome,
        ativo
    )
    SELECT 
        v.tenant_id,
        v.vendedor_id,
        v.nome,
        TRUE -- Assumir ativo se não houver flag na tabela origem
    FROM integrations_conta_azul.vendedores v
    WHERE (p_tenant_id IS NULL OR v.tenant_id = p_tenant_id)
    ON CONFLICT (tenant_id, vendedor_api_id)
    DO UPDATE SET
        nome = EXCLUDED.nome,
        ativo = EXCLUDED.ativo,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_registros = ROW_COUNT;
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_dim_vendedor(UUID) IS 'Carrega dimensão de vendedores. Se p_tenant_id for NULL, carrega todos os tenants.';


`;

// Migration 016: 016 Create Dw Etl Fatos
const MIGRATION_016 = `-- ============================================================================
-- Migration 016: Criar Funções ETL de Fatos
-- ============================================================================
-- Funções ETL para carregar fatos do Data Warehouse
-- Estas funções populam as tabelas de fato a partir das tabelas detalhadas de coleta
-- Adaptado para usar tenant_id ao invés de cliente_id e schemas corretos
-- ============================================================================

-- ============================================
-- TABELA TEMPORÁRIA: debug_logs
-- Armazena logs de debug para análise
-- ============================================
CREATE TABLE IF NOT EXISTS dw.debug_logs (
    id SERIAL PRIMARY KEY,
    session_id TEXT,
    run_id TEXT,
    hypothesis_id TEXT,
    location TEXT,
    message TEXT,
    data JSONB,
    timestamp BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debug_logs_session_run ON dw.debug_logs(session_id, run_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_hypothesis ON dw.debug_logs(hypothesis_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_timestamp ON dw.debug_logs(timestamp);

-- ============================================
-- FUNÇÃO AUXILIAR: debug_log
-- Função auxiliar para logging em modo debug
-- Armazena logs em tabela temporária
-- ============================================
CREATE OR REPLACE FUNCTION dw.debug_log(
    p_log_entry JSONB,
    p_log_file TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Inserir na tabela de logs
    INSERT INTO dw.debug_logs (
        session_id,
        run_id,
        hypothesis_id,
        location,
        message,
        data,
        timestamp
    ) VALUES (
        p_log_entry->>'sessionId',
        p_log_entry->>'runId',
        p_log_entry->>'hypothesisId',
        p_log_entry->>'location',
        p_log_entry->>'message',
        p_log_entry->'data',
        (p_log_entry->>'timestamp')::BIGINT
    );
    
    -- Tentar escrever em arquivo também (se pg_write_file disponível)
    IF p_log_file IS NOT NULL THEN
        BEGIN
            PERFORM pg_write_file(p_log_file, p_log_entry::text || E'\\n', true);
        EXCEPTION WHEN OTHERS THEN
            -- Ignorar erro de arquivo, já salvamos na tabela
            NULL;
        END;
    END IF;
END;
$$;

COMMENT ON FUNCTION dw.debug_log(JSONB, TEXT) IS 'Função auxiliar para logging em modo debug. Armazena logs na tabela dw.debug_logs e tenta escrever em arquivo se pg_write_file disponível.';

-- Função para limpar logs antigos
CREATE OR REPLACE FUNCTION dw.debug_logs_cleanup(p_older_than_hours INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM dw.debug_logs
    WHERE created_at < NOW() - (p_older_than_hours || ' hours')::INTERVAL;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

-- ============================================
-- FUNÇÃO: carregar_fato_contas_financeiras
-- Carrega fato unificado de contas a pagar e receber
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_fato_contas_financeiras(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_registros INTEGER := 0;
    v_data_id INTEGER;
BEGIN
    -- Limpar fatos existentes para o tenant (se especificado) ou todos
    IF p_tenant_id IS NOT NULL THEN
        DELETE FROM dw.fato_contas_financeiras WHERE tenant_id = p_tenant_id;
    ELSE
        TRUNCATE TABLE dw.fato_contas_financeiras;
    END IF;
    
    -- Inserir contas a pagar detalhadas
    INSERT INTO dw.fato_contas_financeiras (
        tenant_id,
        data_id,
        categoria_id,
        categoria_dre_id,
        centro_custo_id,
        pessoa_id,
        conta_financeira_id,
        conta_id,
        parcela_id,
        tipo,
        valor_rateio,
        valor_total_parcela,
        valor_pago,
        valor_nao_pago,
        status,
        data_vencimento,
        data_criacao,
        data_alteracao
    )
    SELECT 
        cpd.tenant_id,
        dc.data_id,
        dc_cat.categoria_id,
        dc_cat_dre.categoria_dre_id, -- Relação através de categoria financeira
        dc_cc.centro_custo_id,
        dc_pessoa.pessoa_id, -- Fornecedor
        NULL::UUID AS conta_financeira_id, -- Não disponível nas tabelas detalhadas por enquanto
        cpd.conta_pagar_id,
        cpd.parcela_id,
        TRUE AS tipo, -- TRUE = PAGAR
        cpd.valor_rateio,
        cpd.valor_total_parcela,
        cpd.valor_pago,
        cpd.valor_nao_pago,
        cpd.status,
        cpd.data_vencimento,
        NULL::TIMESTAMP WITH TIME ZONE AS data_criacao,
        NULL::TIMESTAMP WITH TIME ZONE AS data_alteracao
    FROM integrations_conta_azul.contas_pagar_detalhadas cpd
    LEFT JOIN dw.dim_calendario dc ON dc.data = cpd.data_vencimento
    LEFT JOIN dw.dim_categoria dc_cat ON dc_cat.tenant_id = cpd.tenant_id 
                                     AND dc_cat.categoria_api_id = cpd.categoria_id
    LEFT JOIN (
        SELECT DISTINCT ON (tenant_id, categoria_financeira_id) 
            tenant_id,
            categoria_financeira_id,
            categoria_dre_id
        FROM dw.dim_categoria_dre
        WHERE categoria_financeira_id IS NOT NULL
    ) dc_cat_dre ON dc_cat_dre.tenant_id = cpd.tenant_id
                AND dc_cat_dre.categoria_financeira_id = dc_cat.categoria_api_id -- Relação através de categoria financeira
    LEFT JOIN dw.dim_centro_custo dc_cc ON dc_cc.tenant_id = cpd.tenant_id 
                                       AND dc_cc.centro_custo_api_id = cpd.centro_custo_id
    LEFT JOIN dw.dim_pessoa dc_pessoa ON dc_pessoa.tenant_id = cpd.tenant_id 
                                     AND dc_pessoa.pessoa_api_id = cpd.fornecedor_id
    WHERE (p_tenant_id IS NULL OR cpd.tenant_id = p_tenant_id)
    
    UNION ALL
    
    -- Inserir contas a receber detalhadas
    SELECT 
        crd.tenant_id,
        dc.data_id,
        dc_cat.categoria_id,
        dc_cat_dre.categoria_dre_id, -- Relação através de categoria financeira
        dc_cc.centro_custo_id,
        dc_pessoa.pessoa_id, -- Cliente
        NULL::UUID AS conta_financeira_id,
        crd.conta_receber_id,
        crd.parcela_id,
        FALSE AS tipo, -- FALSE = RECEBER
        crd.valor_rateio,
        crd.valor_total_parcela,
        crd.valor_pago,
        crd.valor_nao_pago,
        crd.status,
        crd.data_vencimento,
        NULL::TIMESTAMP WITH TIME ZONE AS data_criacao,
        NULL::TIMESTAMP WITH TIME ZONE AS data_alteracao
    FROM integrations_conta_azul.contas_receber_detalhadas crd
    LEFT JOIN dw.dim_calendario dc ON dc.data = crd.data_vencimento
    LEFT JOIN dw.dim_categoria dc_cat ON dc_cat.tenant_id = crd.tenant_id 
                                     AND dc_cat.categoria_api_id = crd.categoria_id
    LEFT JOIN (
        SELECT DISTINCT ON (tenant_id, categoria_financeira_id) 
            tenant_id,
            categoria_financeira_id,
            categoria_dre_id
        FROM dw.dim_categoria_dre
        WHERE categoria_financeira_id IS NOT NULL
    ) dc_cat_dre ON dc_cat_dre.tenant_id = crd.tenant_id
                AND dc_cat_dre.categoria_financeira_id = dc_cat.categoria_api_id -- Relação através de categoria financeira
    LEFT JOIN dw.dim_centro_custo dc_cc ON dc_cc.tenant_id = crd.tenant_id 
                                       AND dc_cc.centro_custo_api_id = crd.centro_custo_id
    LEFT JOIN dw.dim_pessoa dc_pessoa ON dc_pessoa.tenant_id = crd.tenant_id 
                                     AND dc_pessoa.pessoa_api_id = crd.cliente_conta_id
    WHERE (p_tenant_id IS NULL OR crd.tenant_id = p_tenant_id)
    ON CONFLICT (tenant_id, conta_id, parcela_id, categoria_id, centro_custo_id)
    DO UPDATE SET
        categoria_dre_id = EXCLUDED.categoria_dre_id,
        valor_rateio = EXCLUDED.valor_rateio,
        valor_total_parcela = EXCLUDED.valor_total_parcela,
        valor_pago = EXCLUDED.valor_pago,
        valor_nao_pago = EXCLUDED.valor_nao_pago,
        status = EXCLUDED.status,
        data_vencimento = EXCLUDED.data_vencimento,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_registros = ROW_COUNT;
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_fato_contas_financeiras(UUID) IS 'Carrega fato unificado de contas a pagar e receber. Se p_tenant_id for NULL, carrega todos os tenants.';

-- ============================================
-- FUNÇÃO: carregar_fato_vendas
-- Carrega fato de vendas a partir de vendas_detalhadas
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_fato_vendas(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_registros INTEGER;
    v_log_entry JSONB;
    v_count_null_tipo INTEGER;
    v_count_vendas_sem_match INTEGER;
    v_count_vendas_detalhadas INTEGER;
BEGIN
    -- #region agent log
    v_log_entry := jsonb_build_object(
        'sessionId', 'debug-session',
        'runId', 'run1',
        'hypothesisId', 'A',
        'location', 'etl-fatos.sql:carregar_fato_vendas:entry',
        'message', 'Function entry',
        'data', jsonb_build_object('p_tenant_id', p_tenant_id),
        'timestamp', extract(epoch from now())::bigint * 1000
    );
    PERFORM dw.debug_log(v_log_entry);
    -- #endregion
    
    -- Limpar fatos existentes para o tenant (se especificado) ou todos
    IF p_tenant_id IS NOT NULL THEN
        DELETE FROM dw.fato_vendas WHERE tenant_id = p_tenant_id;
    ELSE
        TRUNCATE TABLE dw.fato_vendas;
    END IF;
    
    -- #region agent log
    -- Contar registros em vendas_detalhadas antes do INSERT
    SELECT COUNT(*) INTO v_count_vendas_detalhadas
    FROM integrations_conta_azul.vendas_detalhadas vd
    WHERE (p_tenant_id IS NULL OR vd.tenant_id = p_tenant_id);
    
    v_log_entry := jsonb_build_object(
        'sessionId', 'debug-session',
        'runId', 'run1',
        'hypothesisId', 'A',
        'location', 'etl-fatos.sql:carregar_fato_vendas:before_insert',
        'message', 'Before INSERT - counting source records',
        'data', jsonb_build_object(
            'vendas_detalhadas_count', v_count_vendas_detalhadas,
            'p_tenant_id', p_tenant_id
        ),
        'timestamp', extract(epoch from now())::bigint * 1000
    );
    PERFORM dw.debug_log(v_log_entry);
    -- #endregion
    
    INSERT INTO dw.fato_vendas (
        tenant_id,
        data_id,
        vendedor_id,
        cliente_venda_id,
        venda_id,
        -- Campos da Venda
        venda_status,
        venda_tipo_negociacao,
        venda_numero,
        venda_versao,
        -- Medidas - Composição de Valor
        valor_total,
        valor_bruto,
        valor_desconto,
        valor_frete,
        valor_impostos,
        valor_impostos_deduzidos,
        valor_seguro,
        valor_despesas_incidentais,
        valor_liquido,
        -- Contagem de Itens
        contagem_produtos,
        contagem_servicos,
        contagem_nao_conciliados,
        -- Dimensões Adicionais (FKs)
        categoria_id,
        centro_custo_id,
        conta_financeira_id,
        -- Condição de Pagamento
        condicao_pagamento_tipo,
        condicao_pagamento_pagamento_a_vista,
        condicao_pagamento_opcao,
        -- Situação e Pendência
        situacao,
        situacao_descricao,
        situacao_ativado,
        tipo_pendencia_nome,
        tipo_pendencia_descricao,
        -- Configuração de Desconto
        desconto_tipo,
        desconto_taxa,
        -- Dimensões adicionais (mantidas para compatibilidade)
        tipo,
        data_venda
    )
    SELECT 
        vd.tenant_id,
        dc.data_id,
        dv.vendedor_id,
        dp.pessoa_id AS cliente_venda_id,
        vd.venda_id,
        -- Campos da Venda
        vd.venda_status,
        vd.venda_tipo_negociacao,
        vd.venda_numero,
        vd.venda_versao,
        -- Medidas - Composição de Valor
        vd.total AS valor_total,
        vd.composicao_valor_bruto AS valor_bruto,
        vd.composicao_desconto AS valor_desconto,
        vd.composicao_frete AS valor_frete,
        vd.composicao_impostos AS valor_impostos,
        vd.composicao_impostos_deduzidos AS valor_impostos_deduzidos,
        vd.composicao_seguro AS valor_seguro,
        vd.composicao_despesas_incidentais AS valor_despesas_incidentais,
        vd.composicao_valor_liquido AS valor_liquido,
        -- Contagem de Itens
        vd.total_itens_contagem_produtos AS contagem_produtos,
        vd.total_itens_contagem_servicos AS contagem_servicos,
        vd.total_itens_contagem_nao_conciliados AS contagem_nao_conciliados,
        -- Dimensões Adicionais (FKs)
        dc_cat.categoria_id,
        dc_cc.centro_custo_id,
        dc_cf.conta_financeira_id,
        -- Condição de Pagamento
        vd.condicao_pagamento_tipo,
        vd.condicao_pagamento_pagamento_a_vista,
        vd.condicao_pagamento_opcao_condicao_pagamento AS condicao_pagamento_opcao,
        -- Situação e Pendência
        vd.situacao_nome AS situacao, -- Usar situacao_nome para manter compatibilidade
        vd.situacao_descricao,
        vd.situacao_ativado,
        vd.tipo_pendencia_nome,
        vd.tipo_pendencia_descricao,
        -- Configuração de Desconto
        vd.configuracao_desconto_tipo AS desconto_tipo,
        vd.configuracao_desconto_taxa AS desconto_taxa,
        -- Dimensões adicionais (mantidas para compatibilidade)
        v.tipo, -- Tipo da venda obtido de vendas (não disponível em vendas_detalhadas)
        vd.data AS data_venda
    FROM integrations_conta_azul.vendas_detalhadas vd
    LEFT JOIN integrations_conta_azul.vendas v ON vd.venda_id = v.venda_id AND vd.tenant_id = v.tenant_id
    -- #region agent log
    -- Log antes do JOIN para verificar dados de entrada
    -- #endregion
    LEFT JOIN dw.dim_calendario dc ON dc.data = vd.data
    LEFT JOIN dw.dim_vendedor dv ON dv.tenant_id = vd.tenant_id 
                                 AND dv.vendedor_api_id = vd.vendedor_id
    LEFT JOIN dw.dim_pessoa dp ON dp.tenant_id = vd.tenant_id 
                               AND (dp.pessoa_api_id = vd.cliente_venda_id OR dp.pessoa_api_id = vd.cliente_uuid)
    LEFT JOIN dw.dim_categoria dc_cat ON dc_cat.tenant_id = vd.tenant_id 
                                      AND dc_cat.categoria_api_id = vd.venda_id_categoria
    LEFT JOIN dw.dim_centro_custo dc_cc ON dc_cc.tenant_id = vd.tenant_id 
                                        AND dc_cc.centro_custo_api_id = vd.venda_id_centro_custo
    LEFT JOIN dw.dim_conta_financeira dc_cf ON dc_cf.tenant_id = vd.tenant_id 
                                            AND dc_cf.conta_financeira_api_id = vd.condicao_pagamento_id_conta_financeira
    WHERE (p_tenant_id IS NULL OR vd.tenant_id = p_tenant_id)
    ON CONFLICT (tenant_id, venda_id)
    DO UPDATE SET
        data_id = EXCLUDED.data_id,
        vendedor_id = EXCLUDED.vendedor_id,
        cliente_venda_id = EXCLUDED.cliente_venda_id,
        -- Campos da Venda
        venda_status = EXCLUDED.venda_status,
        venda_tipo_negociacao = EXCLUDED.venda_tipo_negociacao,
        venda_numero = EXCLUDED.venda_numero,
        venda_versao = EXCLUDED.venda_versao,
        -- Medidas - Composição de Valor
        valor_total = EXCLUDED.valor_total,
        valor_bruto = EXCLUDED.valor_bruto,
        valor_desconto = EXCLUDED.valor_desconto,
        valor_frete = EXCLUDED.valor_frete,
        valor_impostos = EXCLUDED.valor_impostos,
        valor_impostos_deduzidos = EXCLUDED.valor_impostos_deduzidos,
        valor_seguro = EXCLUDED.valor_seguro,
        valor_despesas_incidentais = EXCLUDED.valor_despesas_incidentais,
        valor_liquido = EXCLUDED.valor_liquido,
        -- Contagem de Itens
        contagem_produtos = EXCLUDED.contagem_produtos,
        contagem_servicos = EXCLUDED.contagem_servicos,
        contagem_nao_conciliados = EXCLUDED.contagem_nao_conciliados,
        -- Dimensões Adicionais (FKs)
        categoria_id = EXCLUDED.categoria_id,
        centro_custo_id = EXCLUDED.centro_custo_id,
        conta_financeira_id = EXCLUDED.conta_financeira_id,
        -- Condição de Pagamento
        condicao_pagamento_tipo = EXCLUDED.condicao_pagamento_tipo,
        condicao_pagamento_pagamento_a_vista = EXCLUDED.condicao_pagamento_pagamento_a_vista,
        condicao_pagamento_opcao = EXCLUDED.condicao_pagamento_opcao,
        -- Situação e Pendência
        situacao = EXCLUDED.situacao,
        situacao_descricao = EXCLUDED.situacao_descricao,
        situacao_ativado = EXCLUDED.situacao_ativado,
        tipo_pendencia_nome = EXCLUDED.tipo_pendencia_nome,
        tipo_pendencia_descricao = EXCLUDED.tipo_pendencia_descricao,
        -- Configuração de Desconto
        desconto_tipo = EXCLUDED.desconto_tipo,
        desconto_taxa = EXCLUDED.desconto_taxa,
        -- Dimensões adicionais (mantidas para compatibilidade)
        tipo = EXCLUDED.tipo,
        data_venda = EXCLUDED.data_venda,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_registros = ROW_COUNT;
    
    -- #region agent log
    -- Verificar quantos registros têm tipo NULL (vendas sem match em vendas)
    SELECT COUNT(*) INTO v_count_null_tipo
    FROM dw.fato_vendas fv
    WHERE (p_tenant_id IS NULL OR fv.tenant_id = p_tenant_id)
    AND fv.tipo IS NULL;
    
    -- Verificar quantos registros em vendas_detalhadas não têm match em vendas
    SELECT COUNT(*) INTO v_count_vendas_sem_match
    FROM integrations_conta_azul.vendas_detalhadas vd
    LEFT JOIN integrations_conta_azul.vendas v ON vd.venda_id = v.venda_id AND vd.tenant_id = v.tenant_id
    WHERE (p_tenant_id IS NULL OR vd.tenant_id = p_tenant_id)
    AND v.venda_id IS NULL;
    
    v_log_entry := jsonb_build_object(
        'sessionId', 'debug-session',
        'runId', 'run1',
        'hypothesisId', 'A,F',
        'location', 'etl-fatos.sql:carregar_fato_vendas:exit',
        'message', 'Function exit with ROW_COUNT and NULL tipo checks',
        'data', jsonb_build_object(
            'row_count', v_registros,
            'p_tenant_id', p_tenant_id,
            'null_tipo_count', v_count_null_tipo,
            'vendas_sem_match_count', v_count_vendas_sem_match
        ),
        'timestamp', extract(epoch from now())::bigint * 1000
    );
    PERFORM dw.debug_log(v_log_entry);
    -- #endregion
    
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_fato_vendas(UUID) IS 'Carrega fato de vendas a partir de vendas_detalhadas com todos os campos expandidos. Se p_tenant_id for NULL, carrega todos os tenants.';

-- ============================================
-- FUNÇÃO: carregar_fato_vendas_itens
-- Carrega fato de itens de vendas
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_fato_vendas_itens(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_registros INTEGER;
BEGIN
    -- Limpar fatos existentes para o tenant (se especificado) ou todos
    IF p_tenant_id IS NOT NULL THEN
        DELETE FROM dw.fato_vendas_itens WHERE tenant_id = p_tenant_id;
    ELSE
        TRUNCATE TABLE dw.fato_vendas_itens;
    END IF;
    
    INSERT INTO dw.fato_vendas_itens (
        tenant_id,
        data_id,
        venda_id,
        item_id,
        quantidade,
        valor_unitario,
        valor_total,
        desconto,
        produto_id,
        servico_id
    )
    SELECT 
        vi.tenant_id,
        dc.data_id,
        vi.venda_id,
        vi.item_id,
        vi.quantidade,
        vi.valor_unitario,
        COALESCE(vi.valor_liquido, vi.valor_total - COALESCE(vi.desconto, 0)) AS valor_total,
        COALESCE(vi.desconto, 0) AS desconto,
        vi.produto_id,
        vi.servico_id
    FROM integrations_conta_azul.vendas_itens vi
    INNER JOIN integrations_conta_azul.vendas v ON v.tenant_id = vi.tenant_id AND v.venda_id = vi.venda_id
    LEFT JOIN dw.dim_calendario dc ON dc.data = v.data
    WHERE (p_tenant_id IS NULL OR vi.tenant_id = p_tenant_id)
    ON CONFLICT (tenant_id, venda_id, item_id)
    DO UPDATE SET
        data_id = EXCLUDED.data_id,
        quantidade = EXCLUDED.quantidade,
        valor_unitario = EXCLUDED.valor_unitario,
        valor_total = EXCLUDED.valor_total,
        desconto = EXCLUDED.desconto,
        produto_id = EXCLUDED.produto_id,
        servico_id = EXCLUDED.servico_id,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_registros = ROW_COUNT;
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_fato_vendas_itens(UUID) IS 'Carrega fato de itens de vendas. Se p_tenant_id for NULL, carrega todos os tenants.';

-- ============================================
-- FUNÇÃO: carregar_fato_contratos
-- Carrega fato de contratos
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_fato_contratos(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_registros INTEGER;
    v_log_entry JSONB;
    v_count_null_data INTEGER;
    v_count_null_pessoa INTEGER;
BEGIN
    -- #region agent log
    v_log_entry := jsonb_build_object(
        'sessionId', 'debug-session',
        'runId', 'run1',
        'hypothesisId', 'B,C',
        'location', 'etl-fatos.sql:carregar_fato_contratos:entry',
        'message', 'Function entry',
        'data', jsonb_build_object('p_tenant_id', p_tenant_id),
        'timestamp', extract(epoch from now())::bigint * 1000
    );
    PERFORM dw.debug_log(v_log_entry);
    -- #endregion
    -- Limpar fatos existentes para o tenant (se especificado) ou todos
    IF p_tenant_id IS NOT NULL THEN
        DELETE FROM dw.fato_contratos WHERE tenant_id = p_tenant_id;
    ELSE
        TRUNCATE TABLE dw.fato_contratos;
    END IF;
    
    INSERT INTO dw.fato_contratos (
        tenant_id,
        data_inicio_id,
        cliente_contrato_id,
        contrato_id,
        numero,
        status,
        proximo_vencimento,
        data_criacao,
        data_alteracao,
        versao
    )
    SELECT 
        c.tenant_id,
        dc.data_id,
        dp.pessoa_id AS cliente_contrato_id,
        c.contrato_id,
        c.numero,
        c.status,
        c.proximo_vencimento,
        c.data_criacao,
        c.data_alteracao,
        c.versao
    FROM integrations_conta_azul.contratos c
    LEFT JOIN dw.dim_calendario dc ON dc.data = c.data_inicio
    LEFT JOIN dw.dim_pessoa dp ON dp.tenant_id = c.tenant_id 
                               AND dp.pessoa_api_id = c.cliente_contrato_id
    WHERE (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
    ON CONFLICT (tenant_id, contrato_id)
    DO UPDATE SET
        data_inicio_id = EXCLUDED.data_inicio_id,
        cliente_contrato_id = EXCLUDED.cliente_contrato_id,
        numero = EXCLUDED.numero,
        status = EXCLUDED.status,
        proximo_vencimento = EXCLUDED.proximo_vencimento,
        data_criacao = EXCLUDED.data_criacao,
        data_alteracao = EXCLUDED.data_alteracao,
        versao = EXCLUDED.versao,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_registros = ROW_COUNT;
    
    -- #region agent log
    -- Verificar quantos registros têm data_inicio NULL ou não encontrada no calendário
    SELECT COUNT(*) INTO v_count_null_data
    FROM integrations_conta_azul.contratos c
    LEFT JOIN dw.dim_calendario dc ON dc.data = c.data_inicio
    WHERE (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
    AND (c.data_inicio IS NULL OR dc.data_id IS NULL);
    
    -- Verificar quantos registros têm cliente_contrato_id não encontrado em dim_pessoa
    SELECT COUNT(*) INTO v_count_null_pessoa
    FROM integrations_conta_azul.contratos c
    LEFT JOIN dw.dim_pessoa dp ON dp.tenant_id = c.tenant_id 
                               AND dp.pessoa_api_id = c.cliente_contrato_id
    WHERE (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
    AND (c.cliente_contrato_id IS NOT NULL AND dp.pessoa_id IS NULL);
    
    v_log_entry := jsonb_build_object(
        'sessionId', 'debug-session',
        'runId', 'run1',
        'hypothesisId', 'B,C,F',
        'location', 'etl-fatos.sql:carregar_fato_contratos:exit',
        'message', 'Function exit with ROW_COUNT and NULL join checks',
        'data', jsonb_build_object(
            'row_count', v_registros,
            'p_tenant_id', p_tenant_id,
            'null_data_inicio_count', v_count_null_data,
            'null_pessoa_count', v_count_null_pessoa
        ),
        'timestamp', extract(epoch from now())::bigint * 1000
    );
    PERFORM dw.debug_log(v_log_entry);
    -- #endregion
    
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_fato_contratos(UUID) IS 'Carrega fato de contratos. Se p_tenant_id for NULL, carrega todos os tenants.';

-- ============================================
-- FUNÇÃO: carregar_fato_saldos_contas
-- Carrega fato de saldos de contas financeiras (histórico temporal)
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_fato_saldos_contas(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_registros INTEGER;
    v_log_entry JSONB;
    v_count_null_data INTEGER;
    v_count_null_conta INTEGER;
    v_count_null_data_coleta INTEGER;
BEGIN
    -- #region agent log
    v_log_entry := jsonb_build_object(
        'sessionId', 'debug-session',
        'runId', 'run1',
        'hypothesisId', 'D,E',
        'location', 'etl-fatos.sql:carregar_fato_saldos_contas:entry',
        'message', 'Function entry',
        'data', jsonb_build_object('p_tenant_id', p_tenant_id),
        'timestamp', extract(epoch from now())::bigint * 1000
    );
    PERFORM dw.debug_log(v_log_entry);
    -- #endregion
    -- Limpar fatos existentes para o tenant (se especificado) ou todos
    IF p_tenant_id IS NOT NULL THEN
        DELETE FROM dw.fato_saldos_contas WHERE tenant_id = p_tenant_id;
    ELSE
        TRUNCATE TABLE dw.fato_saldos_contas;
    END IF;
    
    INSERT INTO dw.fato_saldos_contas (
        tenant_id,
        data_coleta_id,
        conta_financeira_id,
        conta_financeira_id_origem,
        saldo_atual,
        data_coleta
    )
    SELECT 
        sc.tenant_id,
        dc.data_id,
        dcf.conta_financeira_id,
        sc.conta_financeira_id AS conta_financeira_id_origem,
        sc.saldo_atual,
        sc.data_coleta
    FROM integrations_conta_azul.saldos_contas sc
    LEFT JOIN dw.dim_calendario dc ON dc.data = DATE(sc.data_coleta)
    LEFT JOIN dw.dim_conta_financeira dcf ON dcf.tenant_id = sc.tenant_id 
                                          AND dcf.conta_financeira_api_id = sc.conta_financeira_id
    WHERE (p_tenant_id IS NULL OR sc.tenant_id = p_tenant_id);
    -- Nota: Não usar ON CONFLICT pois permite múltiplos registros por conta (histórico temporal)
    
    -- #region agent log
    -- Verificar quantos registros têm data_coleta NULL
    SELECT COUNT(*) INTO v_count_null_data_coleta
    FROM integrations_conta_azul.saldos_contas sc
    WHERE (p_tenant_id IS NULL OR sc.tenant_id = p_tenant_id)
    AND sc.data_coleta IS NULL;
    
    -- Verificar quantos registros têm DATE(data_coleta) não encontrado no calendário
    SELECT COUNT(*) INTO v_count_null_data
    FROM integrations_conta_azul.saldos_contas sc
    LEFT JOIN dw.dim_calendario dc ON dc.data = DATE(sc.data_coleta)
    WHERE (p_tenant_id IS NULL OR sc.tenant_id = p_tenant_id)
    AND sc.data_coleta IS NOT NULL
    AND dc.data_id IS NULL;
    
    -- Verificar quantos registros têm conta_financeira_id não encontrado em dim_conta_financeira
    SELECT COUNT(*) INTO v_count_null_conta
    FROM integrations_conta_azul.saldos_contas sc
    LEFT JOIN dw.dim_conta_financeira dcf ON dcf.tenant_id = sc.tenant_id 
                                          AND dcf.conta_financeira_api_id = sc.conta_financeira_id
    WHERE (p_tenant_id IS NULL OR sc.tenant_id = p_tenant_id)
    AND sc.conta_financeira_id IS NOT NULL
    AND dcf.conta_financeira_id IS NULL;
    
    v_log_entry := jsonb_build_object(
        'sessionId', 'debug-session',
        'runId', 'run1',
        'hypothesisId', 'D,E',
        'location', 'etl-fatos.sql:carregar_fato_saldos_contas:after_insert',
        'message', 'After INSERT - checking NULL joins',
        'data', jsonb_build_object(
            'null_data_coleta_count', v_count_null_data_coleta,
            'null_calendario_count', v_count_null_data,
            'null_conta_financeira_count', v_count_null_conta
        ),
        'timestamp', extract(epoch from now())::bigint * 1000
    );
    PERFORM dw.debug_log(v_log_entry);
    -- #endregion
    
    GET DIAGNOSTICS v_registros = ROW_COUNT;
    
    -- #region agent log
    v_log_entry := jsonb_build_object(
        'sessionId', 'debug-session',
        'runId', 'run1',
        'hypothesisId', 'F',
        'location', 'etl-fatos.sql:carregar_fato_saldos_contas:exit',
        'message', 'Function exit with ROW_COUNT',
        'data', jsonb_build_object('row_count', v_registros, 'p_tenant_id', p_tenant_id),
        'timestamp', extract(epoch from now())::bigint * 1000
    );
    PERFORM dw.debug_log(v_log_entry);
    -- #endregion
    
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_fato_saldos_contas(UUID) IS 'Carrega fato de saldos de contas financeiras. Tabela de histórico temporal - permite múltiplos registros por conta. Se p_tenant_id for NULL, carrega todos os tenants.';

-- ============================================
-- FUNÇÃO: carregar_dw_completo
-- Executa todo o processo ETL em ordem (dimensões primeiro, depois fatos)
-- Retorna JSON com estatísticas de cada etapa
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_dw_completo(p_tenant_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_resultado JSON;
    v_dim_calendario INTEGER;
    v_dim_categoria INTEGER;
    v_dim_categoria_dre INTEGER;
    v_dim_centro_custo INTEGER;
    v_dim_pessoa INTEGER;
    v_dim_conta_financeira INTEGER;
    v_dim_vendedor INTEGER;
    v_fato_contas_financeiras INTEGER;
    v_fato_vendas INTEGER;
    v_fato_vendas_itens INTEGER;
    v_fato_contratos INTEGER;
    v_fato_saldos_contas INTEGER;
    v_log_entry JSONB;
BEGIN
    -- #region agent log
    v_log_entry := jsonb_build_object(
        'sessionId', 'debug-session',
        'runId', 'run1',
        'hypothesisId', 'G',
        'location', 'etl-fatos.sql:carregar_dw_completo:entry',
        'message', 'Function entry - checking dimension population',
        'data', jsonb_build_object('p_tenant_id', p_tenant_id),
        'timestamp', extract(epoch from now())::bigint * 1000
    );
    PERFORM dw.debug_log(v_log_entry);
    -- #endregion
    -- Inicializar objeto de resultado
    v_resultado := json_build_object(
        'tenant_id', p_tenant_id,
        'inicio', NOW(),
        'etapas', json_build_array()
    );
    
    -- ETAPA 1: Carregar dimensão calendário (uma vez, não precisa de tenant_id)
    BEGIN
        SELECT dw.carregar_dim_calendario() INTO v_dim_calendario;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_calendario',
                'registros_inseridos', v_dim_calendario,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_calendario',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    -- ETAPA 2: Carregar dimensões (podem ser executadas em paralelo, mas executamos sequencialmente aqui)
    BEGIN
        SELECT dw.carregar_dim_categoria(p_tenant_id) INTO v_dim_categoria;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_categoria',
                'registros_inseridos', v_dim_categoria,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_categoria',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    BEGIN
        SELECT dw.carregar_dim_categoria_dre(p_tenant_id) INTO v_dim_categoria_dre;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_categoria_dre',
                'registros_inseridos', v_dim_categoria_dre,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_categoria_dre',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    BEGIN
        SELECT dw.carregar_dim_centro_custo(p_tenant_id) INTO v_dim_centro_custo;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_centro_custo',
                'registros_inseridos', v_dim_centro_custo,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_centro_custo',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    BEGIN
        SELECT dw.carregar_dim_pessoa(p_tenant_id) INTO v_dim_pessoa;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_pessoa',
                'registros_inseridos', v_dim_pessoa,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_pessoa',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    BEGIN
        SELECT dw.carregar_dim_conta_financeira(p_tenant_id) INTO v_dim_conta_financeira;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_conta_financeira',
                'registros_inseridos', v_dim_conta_financeira,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_conta_financeira',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    BEGIN
        SELECT dw.carregar_dim_vendedor(p_tenant_id) INTO v_dim_vendedor;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_vendedor',
                'registros_inseridos', v_dim_vendedor,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_vendedor',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    -- ETAPA 3: Carregar fatos (após dimensões estarem populadas)
    BEGIN
        SELECT dw.carregar_fato_contas_financeiras(p_tenant_id) INTO v_fato_contas_financeiras;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_contas_financeiras',
                'registros_inseridos', v_fato_contas_financeiras,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_contas_financeiras',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    BEGIN
        SELECT dw.carregar_fato_vendas(p_tenant_id) INTO v_fato_vendas;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_vendas',
                'registros_inseridos', v_fato_vendas,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_vendas',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    BEGIN
        SELECT dw.carregar_fato_vendas_itens(p_tenant_id) INTO v_fato_vendas_itens;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_vendas_itens',
                'registros_inseridos', v_fato_vendas_itens,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_vendas_itens',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    BEGIN
        SELECT dw.carregar_fato_contratos(p_tenant_id) INTO v_fato_contratos;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_contratos',
                'registros_inseridos', v_fato_contratos,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_contratos',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    BEGIN
        SELECT dw.carregar_fato_saldos_contas(p_tenant_id) INTO v_fato_saldos_contas;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_saldos_contas',
                'registros_inseridos', v_fato_saldos_contas,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_saldos_contas',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    -- Adicionar informações finais
    v_resultado := jsonb_set(v_resultado::jsonb, '{fim}', to_jsonb(NOW()))::json;
    v_resultado := jsonb_set(
        v_resultado::jsonb,
        '{duracao_segundos}',
        to_jsonb(EXTRACT(EPOCH FROM (NOW() - (v_resultado->>'inicio')::timestamp)))
    )::json;
    
    RETURN v_resultado;
END;
$$;

COMMENT ON FUNCTION dw.carregar_dw_completo(UUID) IS 'Executa todo o processo ETL do Data Warehouse em ordem: dimensões primeiro, depois fatos. Retorna JSON com estatísticas de cada etapa. Se p_tenant_id for NULL, processa todos os tenants.';


`;

// Migration 017: 017 Create Dw Views
const MIGRATION_017 = `-- ============================================================================
-- Migration 017: Criar Views do Data Warehouse
-- ============================================================================
-- Views para análise e relatórios do Data Warehouse
-- Adaptado para usar tenant_id ao invés de cliente_id
-- ============================================================================

-- View de Fluxo de Caixa
CREATE OR REPLACE VIEW dw.vw_fluxo_caixa AS
SELECT 
    c.data,
    c.ano,
    c.mes,
    c.trimestre,
    c.ano_mes,
    c.ano_trimestre,
    f.tenant_id,
    f.tipo, -- TRUE=PAGAR, FALSE=RECEBER
    SUM(f.valor_pago) AS total_pago,
    SUM(f.valor_nao_pago) AS total_nao_pago,
    SUM(f.valor_total_parcela) AS total_parcela,
    COUNT(*) AS quantidade_parcelas
FROM dw.fato_contas_financeiras f
INNER JOIN dw.dim_calendario c ON f.data_id = c.data_id
WHERE f.data_vencimento IS NOT NULL
GROUP BY c.data, c.ano, c.mes, c.trimestre, c.ano_mes, c.ano_trimestre, f.tenant_id, f.tipo
ORDER BY c.data DESC, f.tipo;

COMMENT ON VIEW dw.vw_fluxo_caixa IS 'View de fluxo de caixa agregado por data de vencimento. Separado por tipo (PAGAR/RECEBER).';

-- View de DRE
CREATE OR REPLACE VIEW dw.vw_dre AS
SELECT 
    cd.tenant_id,
    cd.nivel_1_desc,
    cd.nivel_2_desc,
    cd.nivel_3_desc,
    cd.nivel_4_desc,
    cd.nivel_5_desc,
    cd.descricao AS categoria_dre_desc,
    c.ano,
    c.mes,
    c.trimestre,
    c.ano_mes,
    c.ano_trimestre,
    f.tipo, -- TRUE=PAGAR (despesa), FALSE=RECEBER (receita)
    SUM(CASE WHEN f.tipo = FALSE THEN f.valor_rateio ELSE 0 END) AS receitas,
    SUM(CASE WHEN f.tipo = TRUE THEN f.valor_rateio ELSE 0 END) AS despesas,
    SUM(CASE WHEN f.tipo = FALSE THEN f.valor_rateio ELSE -f.valor_rateio END) AS resultado
FROM dw.fato_contas_financeiras f
INNER JOIN dw.dim_calendario c ON f.data_id = c.data_id
LEFT JOIN dw.dim_categoria_dre cd ON f.categoria_dre_id = cd.categoria_dre_id
GROUP BY cd.tenant_id, cd.nivel_1_desc, cd.nivel_2_desc, cd.nivel_3_desc, cd.nivel_4_desc, cd.nivel_5_desc, 
         cd.descricao, c.ano, c.mes, c.trimestre, c.ano_mes, c.ano_trimestre, f.tipo
ORDER BY cd.nivel_1_desc, cd.nivel_2_desc, cd.nivel_3_desc, c.ano DESC, c.mes DESC;

COMMENT ON VIEW dw.vw_dre IS 'View de DRE (Demonstração do Resultado do Exercício) agregado por categoria DRE com hierarquia nivelada. Usa JOIN direto através da FK categoria_dre_id em fato_contas_financeiras.';

-- View de Performance de Vendedores
CREATE OR REPLACE VIEW dw.vw_performance_vendedores AS
SELECT 
    v.tenant_id,
    vd.nome AS vendedor_nome,
    c.ano,
    c.mes,
    c.trimestre,
    c.ano_mes,
    COUNT(DISTINCT v.venda_id) AS quantidade_vendas,
    SUM(v.valor_total) AS valor_total_vendas,
    SUM(vi.valor_total) AS valor_total_itens,
    SUM(vi.quantidade) AS quantidade_total_itens,
    AVG(v.valor_total) AS ticket_medio
FROM dw.fato_vendas v
INNER JOIN dw.dim_calendario c ON v.data_id = c.data_id
LEFT JOIN dw.dim_vendedor vd ON v.vendedor_id = vd.vendedor_id
LEFT JOIN dw.fato_vendas_itens vi ON v.tenant_id = vi.tenant_id AND v.venda_id = vi.venda_id
GROUP BY v.tenant_id, vd.nome, c.ano, c.mes, c.trimestre, c.ano_mes
ORDER BY c.ano DESC, c.mes DESC, valor_total_vendas DESC;

COMMENT ON VIEW dw.vw_performance_vendedores IS 'View de performance de vendedores com métricas agregadas de vendas e itens.';

-- View de Análise de Categorias
CREATE OR REPLACE VIEW dw.vw_analise_categorias AS
SELECT 
    cat.tenant_id,
    cat.nivel_1_desc,
    cat.nivel_2_desc,
    cat.nivel_3_desc,
    cat.nivel_4_desc,
    cat.nivel_5_desc,
    cat.nome AS categoria_nome,
    cat.tipo AS categoria_tipo,
    c.ano,
    c.mes,
    c.trimestre,
    c.ano_mes,
    f.tipo AS conta_tipo, -- TRUE=PAGAR, FALSE=RECEBER
    SUM(f.valor_rateio) AS total_rateio,
    SUM(f.valor_total_parcela) AS total_parcela,
    COUNT(DISTINCT f.parcela_id) AS quantidade_parcelas,
    COUNT(*) AS quantidade_rateios
FROM dw.fato_contas_financeiras f
INNER JOIN dw.dim_calendario c ON f.data_id = c.data_id
LEFT JOIN dw.dim_categoria cat ON f.categoria_id = cat.categoria_id
GROUP BY cat.tenant_id, cat.nivel_1_desc, cat.nivel_2_desc, cat.nivel_3_desc, cat.nivel_4_desc, cat.nivel_5_desc,
         cat.nome, cat.tipo, c.ano, c.mes, c.trimestre, c.ano_mes, f.tipo
ORDER BY cat.nivel_1_desc, cat.nivel_2_desc, cat.nivel_3_desc, c.ano DESC, c.mes DESC;

COMMENT ON VIEW dw.vw_analise_categorias IS 'View de análise de categorias com hierarquia nivelada e totais agregados por período.';

-- View de Categoria DRE com Totalizador
-- Usa join por tenant_id + categoria_dre_api_id para identificar apenas categorias que são realmente totalizadoras
-- Também inclui join por posicao para identificar categorias que compartilham posição com totalizadores
CREATE OR REPLACE VIEW dw.vw_categoria_dre_com_totalizador AS
SELECT 
    dcd.*,
    mt_exato.mascara_id AS totalizador_mascara_id,
    mt_exato.descricao AS totalizador_descricao,
    mt_exato.categoria_dre_api_id AS totalizador_api_id,
    mt_exato.codigo AS totalizador_codigo,
    CASE WHEN mt_exato.mascara_id IS NOT NULL THEN TRUE ELSE FALSE END AS eh_totalizador,
    CASE WHEN mt_posicao.mascara_id IS NOT NULL AND mt_exato.mascara_id IS NULL THEN TRUE ELSE FALSE END AS compartilha_posicao_com_totalizador,
    mt_posicao.descricao AS totalizador_da_posicao_descricao
FROM dw.dim_categoria_dre dcd
-- Join exato: apenas categorias que são realmente totalizadoras
LEFT JOIN dw.mascara_totalizadores_dre mt_exato ON 
    mt_exato.tenant_id = dcd.tenant_id 
    AND mt_exato.categoria_dre_api_id = dcd.categoria_dre_api_id
-- Join por posição: categorias que compartilham posição com totalizadores (mas podem não ser totalizadoras)
LEFT JOIN dw.mascara_totalizadores_dre mt_posicao ON 
    mt_posicao.tenant_id = dcd.tenant_id 
    AND mt_posicao.posicao = dcd.posicao
    AND mt_posicao.categoria_dre_api_id != dcd.categoria_dre_api_id; -- Diferente do join exato

COMMENT ON VIEW dw.vw_categoria_dre_com_totalizador IS 'View que faz join entre dim_categoria_dre e mascara_totalizadores_dre. Usa join exato (tenant_id + categoria_dre_api_id) para identificar categorias que são realmente totalizadoras. Também inclui join por posição para identificar categorias que compartilham posição com totalizadores.';
`;

// Migration 018: 018 Create Dw Ajustes
const MIGRATION_018 = `-- ============================================================================
-- Migration 018: Ajustes do Data Warehouse
-- ============================================================================
-- Este script aplica melhorias identificadas na análise da estrutura do DW
-- Inclui constraints CHECK, funções de verificação de integridade e atualização de estatísticas
-- Adaptado para usar tenant_id ao invés de cliente_id
-- ============================================================================

-- ============================================
-- 1. CONSTRAINTS CHECK PARA INTEGRIDADE (MÉDIA PRIORIDADE)
-- ============================================
-- O que são: Regras de validação que garantem dados válidos
-- Por que são importantes: Previnem dados inválidos antes que entrem no DW
-- Benefício esperado: Dados sempre válidos, erros claros, confiança nos relatórios
--
-- Exemplo prático:
-- Sem constraint: Pode inserir valor_total = -100 (inválido)
-- Com constraint CHECK (valor_total >= 0): PostgreSQL rejeita e retorna erro claro
-- ============================================

-- Validar valores monetários não negativos
DO $$
BEGIN
    -- fato_contas_financeiras
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.fato_contas_financeiras'::regclass 
        AND conname = 'chk_valor_rateio_nao_negativo'
    ) THEN
        ALTER TABLE dw.fato_contas_financeiras
        ADD CONSTRAINT chk_valor_rateio_nao_negativo 
        CHECK (valor_rateio >= 0);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.fato_contas_financeiras'::regclass 
        AND conname = 'chk_valor_total_parcela_nao_negativo'
    ) THEN
        ALTER TABLE dw.fato_contas_financeiras
        ADD CONSTRAINT chk_valor_total_parcela_nao_negativo 
        CHECK (valor_total_parcela >= 0);
    END IF;
    
    -- fato_vendas
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.fato_vendas'::regclass 
        AND conname = 'chk_valor_total_nao_negativo'
    ) THEN
        ALTER TABLE dw.fato_vendas
        ADD CONSTRAINT chk_valor_total_nao_negativo 
        CHECK (valor_total >= 0);
    END IF;
    
    -- fato_vendas_itens
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.fato_vendas_itens'::regclass 
        AND conname = 'chk_valor_total_item_nao_negativo'
    ) THEN
        ALTER TABLE dw.fato_vendas_itens
        ADD CONSTRAINT chk_valor_total_item_nao_negativo 
        CHECK (valor_total >= 0);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.fato_vendas_itens'::regclass 
        AND conname = 'chk_quantidade_positiva'
    ) THEN
        ALTER TABLE dw.fato_vendas_itens
        ADD CONSTRAINT chk_quantidade_positiva 
        CHECK (quantidade > 0);
    END IF;
    
    -- dim_categoria
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.dim_categoria'::regclass 
        AND conname = 'chk_nivel_maximo_valido'
    ) THEN
        ALTER TABLE dw.dim_categoria
        ADD CONSTRAINT chk_nivel_maximo_valido 
        CHECK (nivel_maximo IS NULL OR (nivel_maximo >= 1 AND nivel_maximo <= 5));
    END IF;
    
    -- dim_categoria_dre
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.dim_categoria_dre'::regclass 
        AND conname = 'chk_nivel_maximo_dre_valido'
    ) THEN
        ALTER TABLE dw.dim_categoria_dre
        ADD CONSTRAINT chk_nivel_maximo_dre_valido 
        CHECK (nivel_maximo IS NULL OR (nivel_maximo >= 1 AND nivel_maximo <= 5));
    END IF;
    
    -- dim_conta_financeira
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.dim_conta_financeira'::regclass 
        AND conname = 'chk_tipo_conta_valido'
    ) THEN
        ALTER TABLE dw.dim_conta_financeira
        ADD CONSTRAINT chk_tipo_conta_valido 
        CHECK (tipo IS NULL OR tipo IN (
            'APLICACAO', 
            'CAIXINHA', 
            'CONTA_CORRENTE', 
            'CARTAO_CREDITO',
            'INVESTIMENTO',
            'OUTROS', 
            'MEIOS_RECEBIMENTO', 
            'POUPANCA', 
            'COBRANCAS_CONTA_AZUL', 
            'RECEBA_FACIL_CARTAO'
        ));
    END IF;
    
    -- dim_pessoa
    -- Nota: A API retorna valores com acentos ("Física", "Jurídica", "Estrangeira")
    -- mas podem ser armazenados sem acentos. Aceitar ambos os formatos.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.dim_pessoa'::regclass 
        AND conname = 'chk_tipo_pessoa_valido'
    ) THEN
        ALTER TABLE dw.dim_pessoa
        ADD CONSTRAINT chk_tipo_pessoa_valido 
        CHECK (tipo_pessoa IS NULL OR tipo_pessoa IN (
            'FISICA', 'JURIDICA', 'ESTRANGEIRA',  -- Formato sem acentos
            'Física', 'Jurídica', 'Estrangeira'   -- Formato com acentos (da API)
        ));
    END IF;
    
    -- Nota: A API retorna perfis com primeira letra maiúscula ("Cliente", "Fornecedor", "Transportadora")
    -- mas podem ser armazenados em maiúsculas. Aceitar ambos os formatos.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.dim_pessoa'::regclass 
        AND conname = 'chk_tipo_perfil_valido'
    ) THEN
        ALTER TABLE dw.dim_pessoa
        ADD CONSTRAINT chk_tipo_perfil_valido 
        CHECK (tipo_perfil IS NULL OR tipo_perfil IN (
            'CLIENTE', 'FORNECEDOR', 'TRANSPORTADORA',  -- Formato maiúsculas
            'Cliente', 'Fornecedor', 'Transportadora'   -- Formato da API (primeira letra maiúscula)
        ));
    END IF;
END $$;

-- ============================================
-- 2. FUNÇÃO DE VERIFICAÇÃO DE INTEGRIDADE (BAIXA PRIORIDADE)
-- ============================================
-- O que são: Funções que verificam se os dados estão consistentes após ETL
-- Por que são importantes: Identificam problemas rapidamente, garantem qualidade
-- Benefício esperado: Detecção rápida de problemas, relatórios confiáveis
--
-- Exemplo de uso:
-- SELECT * FROM dw.verificar_integridade_dw();
-- Retorna: tabela, problema, quantidade de registros afetados
-- ============================================

CREATE OR REPLACE FUNCTION dw.verificar_integridade_dw(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE(
    tabela TEXT,
    problema TEXT,
    quantidade BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    -- Fatos sem dimensão calendário
    SELECT 
        'fato_contas_financeiras'::TEXT,
        'Registros sem data_id (data não encontrada no calendário)'::TEXT,
        COUNT(*)::BIGINT
    FROM dw.fato_contas_financeiras
    WHERE data_id IS NULL
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    
    UNION ALL
    
    -- Vendas sem dimensão calendário
    SELECT 
        'fato_vendas'::TEXT,
        'Registros sem data_id'::TEXT,
        COUNT(*)::BIGINT
    FROM dw.fato_vendas
    WHERE data_id IS NULL
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    
    UNION ALL
    
    -- Contas financeiras sem categoria (mas categoria_id não é obrigatório)
    SELECT 
        'fato_contas_financeiras'::TEXT,
        'Registros sem categoria_id (categoria não encontrada)'::TEXT,
        COUNT(*)::BIGINT
    FROM dw.fato_contas_financeiras
    WHERE categoria_id IS NULL
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    
    UNION ALL
    
    -- Vendas sem vendedor (mas vendedor_id não é obrigatório)
    SELECT 
        'fato_vendas'::TEXT,
        'Registros sem vendedor_id'::TEXT,
        COUNT(*)::BIGINT
    FROM dw.fato_vendas
    WHERE vendedor_id IS NULL
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    
    UNION ALL
    
    -- Saldos sem conta financeira
    SELECT 
        'fato_saldos_contas'::TEXT,
        'Registros sem conta_financeira_id'::TEXT,
        COUNT(*)::BIGINT
    FROM dw.fato_saldos_contas
    WHERE conta_financeira_id IS NULL
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);
END;
$$;

COMMENT ON FUNCTION dw.verificar_integridade_dw(UUID) IS 'Verifica integridade referencial do DW. Retorna problemas encontrados com quantidade de registros afetados. Se p_tenant_id for NULL, verifica todos os tenants.';

-- ============================================
-- 3. FUNÇÃO DE ATUALIZAÇÃO DE ESTATÍSTICAS (BAIXA PRIORIDADE)
-- ============================================
-- O que são: Atualiza estatísticas do PostgreSQL sobre distribuição de dados
-- Por que são importantes: PostgreSQL escolhe melhor plano de execução de queries
-- Benefício esperado: Queries mais rápidas, performance consistente
--
-- Exemplo prático:
-- Tabela tem 1000 registros, mas estatísticas dizem 100
-- PostgreSQL pode escolher plano ruim (scan completo quando poderia usar índice)
-- Após ANALYZE: Estatísticas atualizadas, plano otimizado escolhido
--
-- Quando executar: Após cada ETL completo (carregar_dw_completo)
-- ============================================

CREATE OR REPLACE FUNCTION dw.atualizar_estatisticas_dw()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    ANALYZE dw.dim_calendario;
    ANALYZE dw.dim_categoria;
    ANALYZE dw.dim_categoria_dre;
    ANALYZE dw.dim_centro_custo;
    ANALYZE dw.dim_pessoa;
    ANALYZE dw.dim_conta_financeira;
    ANALYZE dw.dim_vendedor;
    ANALYZE dw.fato_contas_financeiras;
    ANALYZE dw.fato_vendas;
    ANALYZE dw.fato_vendas_itens;
    ANALYZE dw.fato_contratos;
    ANALYZE dw.fato_saldos_contas;
    ANALYZE dw.mascara_totalizadores_dre;
END;
$$;

COMMENT ON FUNCTION dw.atualizar_estatisticas_dw() IS 'Atualiza estatísticas do PostgreSQL para todas as tabelas do DW. Deve ser executado após cada ETL para otimizar performance de queries.';

-- ============================================
-- 4. MELHORAR DOCUMENTAÇÃO DAS VIEWS (BAIXA PRIORIDADE)
-- ============================================

COMMENT ON VIEW dw.vw_fluxo_caixa IS 'View de fluxo de caixa agregado por data de vencimento. Separado por tipo (PAGAR/RECEBER). Agrupa valores pagos e não pagos por data de vencimento.';

-- View vw_dre foi removida - ver seção 0 acima para detalhes

COMMENT ON VIEW dw.vw_performance_vendedores IS 'View de performance de vendedores com métricas agregadas de vendas e itens. Inclui quantidade de vendas, valor total, ticket médio e quantidade de itens vendidos por período.';

COMMENT ON VIEW dw.vw_analise_categorias IS 'View de análise de categorias financeiras com hierarquia nivelada e totais agregados por período. Permite análise de receitas e despesas por categoria com drill-down por níveis hierárquicos.';


`;

// Migration 019: 019 Add Additional Migrations
const MIGRATION_019 = `-- ============================================================================
-- Migration 019: Migrations Adicionais de Ajustes
-- ============================================================================
-- Migrations adicionais para ajustes e campos expandidos
-- Adaptado para usar tenant_id ao invés de cliente_id e schemas corretos
-- ============================================================================

-- ============================================
-- 1. Adicionar campos expandidos à tabela dw.fato_vendas
-- ============================================
-- Campos da Venda
ALTER TABLE dw.fato_vendas 
ADD COLUMN IF NOT EXISTS venda_status TEXT,
ADD COLUMN IF NOT EXISTS venda_tipo_negociacao TEXT,
ADD COLUMN IF NOT EXISTS venda_numero INTEGER,
ADD COLUMN IF NOT EXISTS venda_versao INTEGER;

-- Composição de Valor (Medidas)
ALTER TABLE dw.fato_vendas 
ADD COLUMN IF NOT EXISTS valor_bruto NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_desconto NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_frete NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_impostos NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_impostos_deduzidos NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_seguro NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_despesas_incidentais NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC(15,2);

-- Contagem de Itens
ALTER TABLE dw.fato_vendas 
ADD COLUMN IF NOT EXISTS contagem_produtos INTEGER,
ADD COLUMN IF NOT EXISTS contagem_servicos INTEGER,
ADD COLUMN IF NOT EXISTS contagem_nao_conciliados INTEGER;

-- Dimensões Adicionais (FKs)
ALTER TABLE dw.fato_vendas 
ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES dw.dim_categoria(categoria_id),
ADD COLUMN IF NOT EXISTS centro_custo_id UUID REFERENCES dw.dim_centro_custo(centro_custo_id),
ADD COLUMN IF NOT EXISTS conta_financeira_id UUID REFERENCES dw.dim_conta_financeira(conta_financeira_id);

-- Condição de Pagamento
ALTER TABLE dw.fato_vendas 
ADD COLUMN IF NOT EXISTS condicao_pagamento_tipo TEXT,
ADD COLUMN IF NOT EXISTS condicao_pagamento_pagamento_a_vista BOOLEAN,
ADD COLUMN IF NOT EXISTS condicao_pagamento_opcao TEXT;

-- Situação e Pendência
ALTER TABLE dw.fato_vendas 
ADD COLUMN IF NOT EXISTS situacao_descricao TEXT,
ADD COLUMN IF NOT EXISTS situacao_ativado BOOLEAN,
ADD COLUMN IF NOT EXISTS tipo_pendencia_nome TEXT,
ADD COLUMN IF NOT EXISTS tipo_pendencia_descricao TEXT;

-- Configuração de Desconto
ALTER TABLE dw.fato_vendas 
ADD COLUMN IF NOT EXISTS desconto_tipo TEXT,
ADD COLUMN IF NOT EXISTS desconto_taxa NUMERIC(10,2);

-- Índices para campos frequentemente consultados
CREATE INDEX IF NOT EXISTS idx_fato_vendas_venda_status ON dw.fato_vendas(venda_status);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_venda_tipo_negociacao ON dw.fato_vendas(venda_tipo_negociacao);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_venda_numero ON dw.fato_vendas(venda_numero);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_categoria_id ON dw.fato_vendas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_centro_custo_id ON dw.fato_vendas(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_conta_financeira_id ON dw.fato_vendas(conta_financeira_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_condicao_pagamento_tipo ON dw.fato_vendas(condicao_pagamento_tipo);

-- Comentários dos novos campos
COMMENT ON COLUMN dw.fato_vendas.venda_status IS 'Status da venda. Extraído de vendas_detalhadas.venda_status';
COMMENT ON COLUMN dw.fato_vendas.venda_tipo_negociacao IS 'Tipo de negociação. Extraído de vendas_detalhadas.venda_tipo_negociacao';
COMMENT ON COLUMN dw.fato_vendas.venda_numero IS 'Número da venda. Extraído de vendas_detalhadas.venda_numero';
COMMENT ON COLUMN dw.fato_vendas.valor_liquido IS 'Valor líquido da venda. Extraído de vendas_detalhadas.composicao_valor_liquido';
COMMENT ON COLUMN dw.fato_vendas.valor_bruto IS 'Valor bruto da venda. Extraído de vendas_detalhadas.composicao_valor_bruto';
COMMENT ON COLUMN dw.fato_vendas.categoria_id IS 'Referência à categoria da venda (dim_categoria)';
COMMENT ON COLUMN dw.fato_vendas.centro_custo_id IS 'Referência ao centro de custo da venda (dim_centro_custo)';
COMMENT ON COLUMN dw.fato_vendas.conta_financeira_id IS 'Referência à conta financeira da condição de pagamento (dim_conta_financeira)';
COMMENT ON COLUMN dw.fato_vendas.contagem_produtos IS 'Quantidade de produtos na venda. Extraído de vendas_detalhadas.total_itens_contagem_produtos';
COMMENT ON COLUMN dw.fato_vendas.contagem_servicos IS 'Quantidade de serviços na venda. Extraído de vendas_detalhadas.total_itens_contagem_servicos';

-- ============================================
-- 2. Adicionar campos expandidos à tabela integrations_conta_azul.vendas_detalhadas
-- ============================================
-- Campos do Cliente (venda.cliente)
ALTER TABLE integrations_conta_azul.vendas_detalhadas 
ADD COLUMN IF NOT EXISTS cliente_uuid TEXT,
ADD COLUMN IF NOT EXISTS cliente_tipo_pessoa TEXT,
ADD COLUMN IF NOT EXISTS cliente_documento TEXT;

-- Campos do Evento Financeiro (venda.evento_financeiro)
ALTER TABLE integrations_conta_azul.vendas_detalhadas 
ADD COLUMN IF NOT EXISTS evento_financeiro_id TEXT;

-- Campos de Notificação (venda.notificacao) - Opcional
ALTER TABLE integrations_conta_azul.vendas_detalhadas 
ADD COLUMN IF NOT EXISTS notificacao_id_referencia TEXT,
ADD COLUMN IF NOT EXISTS notificacao_enviado_para TEXT,
ADD COLUMN IF NOT EXISTS notificacao_enviado_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notificacao_aberto_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notificacao_status TEXT;

-- Campos da Natureza Operação (venda.natureza_operacao)
ALTER TABLE integrations_conta_azul.vendas_detalhadas 
ADD COLUMN IF NOT EXISTS natureza_operacao_uuid TEXT,
ADD COLUMN IF NOT EXISTS natureza_operacao_tipo_operacao TEXT,
ADD COLUMN IF NOT EXISTS natureza_operacao_template_operacao TEXT,
ADD COLUMN IF NOT EXISTS natureza_operacao_label TEXT,
ADD COLUMN IF NOT EXISTS natureza_operacao_mudanca_financeira BOOLEAN,
ADD COLUMN IF NOT EXISTS natureza_operacao_mudanca_estoque TEXT;

-- Campos da Venda (venda.*)
ALTER TABLE integrations_conta_azul.vendas_detalhadas 
ADD COLUMN IF NOT EXISTS venda_status TEXT,
ADD COLUMN IF NOT EXISTS venda_id_legado TEXT,
ADD COLUMN IF NOT EXISTS venda_tipo_negociacao TEXT,
ADD COLUMN IF NOT EXISTS venda_numero INTEGER,
ADD COLUMN IF NOT EXISTS venda_id_categoria TEXT,
ADD COLUMN IF NOT EXISTS venda_data_compromisso DATE,
ADD COLUMN IF NOT EXISTS venda_id_cliente TEXT,
ADD COLUMN IF NOT EXISTS venda_versao INTEGER,
ADD COLUMN IF NOT EXISTS venda_id_natureza_operacao TEXT,
ADD COLUMN IF NOT EXISTS venda_id_centro_custo TEXT,
ADD COLUMN IF NOT EXISTS venda_introducao TEXT,
ADD COLUMN IF NOT EXISTS venda_observacoes TEXT;

-- Composição de Valor (venda.composicao_valor)
ALTER TABLE integrations_conta_azul.vendas_detalhadas 
ADD COLUMN IF NOT EXISTS composicao_valor_bruto NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS composicao_desconto NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS composicao_frete NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS composicao_impostos NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS composicao_impostos_deduzidos NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS composicao_seguro NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS composicao_despesas_incidentais NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS composicao_valor_liquido NUMERIC(15,2);

-- Configuração de Desconto (venda.configuracao_de_desconto)
ALTER TABLE integrations_conta_azul.vendas_detalhadas 
ADD COLUMN IF NOT EXISTS configuracao_desconto_tipo TEXT,
ADD COLUMN IF NOT EXISTS configuracao_desconto_taxa NUMERIC(10,2);

-- Total de Itens (venda.total_itens)
ALTER TABLE integrations_conta_azul.vendas_detalhadas 
ADD COLUMN IF NOT EXISTS total_itens_contagem_produtos INTEGER,
ADD COLUMN IF NOT EXISTS total_itens_contagem_servicos INTEGER,
ADD COLUMN IF NOT EXISTS total_itens_contagem_nao_conciliados INTEGER;

-- Situação (venda.situacao)
ALTER TABLE integrations_conta_azul.vendas_detalhadas 
ADD COLUMN IF NOT EXISTS situacao_nome TEXT,
ADD COLUMN IF NOT EXISTS situacao_descricao TEXT,
ADD COLUMN IF NOT EXISTS situacao_ativado BOOLEAN;

-- Tipo de Pendência (venda.tipo_pendencia)
ALTER TABLE integrations_conta_azul.vendas_detalhadas 
ADD COLUMN IF NOT EXISTS tipo_pendencia_nome TEXT,
ADD COLUMN IF NOT EXISTS tipo_pendencia_descricao TEXT;

-- Condição de Pagamento (venda.condicao_pagamento)
ALTER TABLE integrations_conta_azul.vendas_detalhadas 
ADD COLUMN IF NOT EXISTS condicao_pagamento_tipo TEXT,
ADD COLUMN IF NOT EXISTS condicao_pagamento_id_conta_financeira TEXT,
ADD COLUMN IF NOT EXISTS condicao_pagamento_pagamento_a_vista BOOLEAN,
ADD COLUMN IF NOT EXISTS condicao_pagamento_observacoes TEXT,
ADD COLUMN IF NOT EXISTS condicao_pagamento_opcao_condicao_pagamento TEXT,
ADD COLUMN IF NOT EXISTS condicao_pagamento_nsu TEXT,
ADD COLUMN IF NOT EXISTS condicao_pagamento_cartao_tipo_bandeira TEXT,
ADD COLUMN IF NOT EXISTS condicao_pagamento_cartao_codigo_transacao TEXT,
ADD COLUMN IF NOT EXISTS condicao_pagamento_cartao_id_adquirente TEXT;

-- Campos do Vendedor (venda.vendedor)
ALTER TABLE integrations_conta_azul.vendas_detalhadas 
ADD COLUMN IF NOT EXISTS vendedor_id TEXT,
ADD COLUMN IF NOT EXISTS vendedor_nome TEXT,
ADD COLUMN IF NOT EXISTS vendedor_id_legado TEXT;

-- Índices para campos frequentemente consultados
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_status ON integrations_conta_azul.vendas_detalhadas(venda_status);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_tipo_negociacao ON integrations_conta_azul.vendas_detalhadas(venda_tipo_negociacao);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_numero ON integrations_conta_azul.vendas_detalhadas(venda_numero);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_data_compromisso ON integrations_conta_azul.vendas_detalhadas(venda_data_compromisso DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_evento_financeiro_id ON integrations_conta_azul.vendas_detalhadas(evento_financeiro_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_natureza_operacao_uuid ON integrations_conta_azul.vendas_detalhadas(natureza_operacao_uuid);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_vendedor_id ON integrations_conta_azul.vendas_detalhadas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_cliente_uuid ON integrations_conta_azul.vendas_detalhadas(cliente_uuid);

-- Comentários dos novos campos
COMMENT ON COLUMN integrations_conta_azul.vendas_detalhadas.cliente_uuid IS 'UUID do cliente. Extraído de dados_originais->cliente->uuid';
COMMENT ON COLUMN integrations_conta_azul.vendas_detalhadas.cliente_tipo_pessoa IS 'Tipo de pessoa do cliente (Física/Jurídica). Extraído de dados_originais->cliente->tipo_pessoa';
COMMENT ON COLUMN integrations_conta_azul.vendas_detalhadas.cliente_documento IS 'Documento do cliente (CPF/CNPJ). Extraído de dados_originais->cliente->documento';
COMMENT ON COLUMN integrations_conta_azul.vendas_detalhadas.evento_financeiro_id IS 'ID do evento financeiro. Extraído de dados_originais->evento_financeiro->id';
COMMENT ON COLUMN integrations_conta_azul.vendas_detalhadas.venda_status IS 'Status da venda. Extraído de dados_originais->venda->status';
COMMENT ON COLUMN integrations_conta_azul.vendas_detalhadas.venda_tipo_negociacao IS 'Tipo de negociação. Extraído de dados_originais->venda->tipo_negociacao';
COMMENT ON COLUMN integrations_conta_azul.vendas_detalhadas.venda_numero IS 'Número da venda. Extraído de dados_originais->venda->numero';
COMMENT ON COLUMN integrations_conta_azul.vendas_detalhadas.composicao_valor_liquido IS 'Valor líquido da venda. Extraído de dados_originais->venda->composicao_valor->valor_liquido';

-- ============================================
-- 3. Adicionar categoria_financeira_id à tabela dw.dim_categoria_dre
-- ============================================
-- Adicionar coluna categoria_financeira_id
ALTER TABLE dw.dim_categoria_dre 
ADD COLUMN IF NOT EXISTS categoria_financeira_id TEXT;

-- Remover constraint UNIQUE antiga (se existir) e adicionar a nova
DO $$
DECLARE
    v_constraint_name TEXT;
    v_constraint_exists BOOLEAN;
BEGIN
    -- Verificar se a nova constraint já existe
    SELECT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conrelid = 'dw.dim_categoria_dre'::regclass
        AND conname = 'dim_categoria_dre_tenant_categoria_financeira_unique'
        AND contype = 'u'
    ) INTO v_constraint_exists;
    
    -- Se a nova constraint não existe, precisamos remover a antiga e criar a nova
    IF NOT v_constraint_exists THEN
        -- Tentar remover constraint com nome padrão
        BEGIN
            ALTER TABLE dw.dim_categoria_dre
            DROP CONSTRAINT IF EXISTS dim_categoria_dre_tenant_id_categoria_dre_api_id_key;
        EXCEPTION
            WHEN undefined_object THEN
                NULL;
        END;
        
        -- Tentar encontrar e remover outras constraints UNIQUE com 2 colunas
        FOR v_constraint_name IN
            SELECT conname
            FROM pg_constraint 
            WHERE conrelid = 'dw.dim_categoria_dre'::regclass
            AND contype = 'u'
            AND conname != 'dim_categoria_dre_tenant_categoria_financeira_unique'
            AND array_length(conkey, 1) = 2  -- Constraint com 2 colunas (tenant_id, categoria_dre_api_id)
        LOOP
            EXECUTE format('ALTER TABLE dw.dim_categoria_dre DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
        END LOOP;
        
        -- Adicionar nova constraint UNIQUE
        BEGIN
            ALTER TABLE dw.dim_categoria_dre
            ADD CONSTRAINT dim_categoria_dre_tenant_categoria_financeira_unique 
            UNIQUE(tenant_id, categoria_dre_api_id, categoria_financeira_id);
        EXCEPTION
            WHEN duplicate_object THEN
                NULL; -- Constraint já existe, ignorar
        END;
    END IF;
END $$;

-- Adicionar índice para categoria_financeira_id
CREATE INDEX IF NOT EXISTS idx_dim_categoria_dre_categoria_financeira_id 
ON dw.dim_categoria_dre(categoria_financeira_id);

-- Adicionar comentários
COMMENT ON COLUMN dw.dim_categoria_dre.categoria_financeira_id IS 'ID da categoria financeira associada (NULL se for registro da categoria DRE, preenchido se for registro expandido de categoria financeira)';

COMMENT ON TABLE dw.dim_categoria_dre IS 'Dimensão de categorias DRE com hierarquia nivelada para drill-down no Power BI. Inclui expansão de categorias financeiras associadas.';

-- ============================================
-- 4. Adicionar coluna itens_detalhados na tabela integrations_conta_azul.vendas
-- ============================================
-- Adicionar coluna itens_detalhados
ALTER TABLE integrations_conta_azul.vendas
ADD COLUMN IF NOT EXISTS itens_detalhados BOOLEAN DEFAULT FALSE;

-- Criar índice para otimizar busca de vendas sem itens detalhados
CREATE INDEX IF NOT EXISTS idx_vendas_itens_detalhados ON integrations_conta_azul.vendas(itens_detalhados) WHERE itens_detalhados = FALSE;

-- Criar índice composto para otimizar busca por tenant e status de detalhamento
CREATE INDEX IF NOT EXISTS idx_vendas_tenant_itens_detalhados ON integrations_conta_azul.vendas(tenant_id, itens_detalhados) WHERE itens_detalhados = FALSE;

-- Comentário na coluna
COMMENT ON COLUMN integrations_conta_azul.vendas.itens_detalhados IS 'Indica se os itens da venda já foram detalhados (busca de itens via GET /v1/venda/{id_venda}/itens). Resetado para FALSE quando dados básicos da venda mudam na coleta incremental.';

-- ============================================
-- 5. Alterar categoria_pai de UUID para TEXT em integrations_conta_azul.categorias
-- ============================================
-- NOTA: Esta migration assume que categoria_pai já foi alterado para TEXT na migration 008
-- Se ainda estiver como UUID, executar o código abaixo:

DO $$
BEGIN
    -- Verificar se categoria_pai ainda é UUID
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'integrations_conta_azul' 
        AND table_name = 'categorias' 
        AND column_name = 'categoria_pai'
        AND data_type = 'uuid'
    ) THEN
        -- Criar coluna temporária para armazenar o categoria_id
        ALTER TABLE integrations_conta_azul.categorias ADD COLUMN IF NOT EXISTS categoria_pai_temp TEXT;

        -- Converter UUIDs existentes para categoria_id correspondente
        UPDATE integrations_conta_azul.categorias c1
        SET categoria_pai_temp = c2.categoria_id
        FROM integrations_conta_azul.categorias c2
        WHERE c1.categoria_pai IS NOT NULL
          AND c2.id::TEXT = c1.categoria_pai::TEXT
          AND c1.tenant_id = c2.tenant_id;

        -- Remover coluna antiga (UUID)
        ALTER TABLE integrations_conta_azul.categorias DROP COLUMN IF EXISTS categoria_pai;

        -- Renomear coluna temporária
        ALTER TABLE integrations_conta_azul.categorias RENAME COLUMN categoria_pai_temp TO categoria_pai;

        -- Atualizar comentário da coluna
        COMMENT ON COLUMN integrations_conta_azul.categorias.categoria_pai IS 'ID da categoria pai na API (categoria_id). Null se for categoria raiz. Permite hierarquia de categorias.';

        -- Recriar índice (opcional, mas garante otimização)
        DROP INDEX IF EXISTS idx_categorias_categoria_pai;
        CREATE INDEX IF NOT EXISTS idx_categorias_categoria_pai ON integrations_conta_azul.categorias(tenant_id, categoria_pai) WHERE categoria_pai IS NOT NULL;
    END IF;
END $$;
`;

// Migration 020: 020 Create View Contas Unificadas
const MIGRATION_020 = `-- ============================================================================
-- Migration 020: Criar View de Contas Financeiras Unificadas
-- ============================================================================
-- View unificada que combina contas a pagar e receber detalhadas
-- Adaptado para usar tenant_id ao invés de cliente_id e schemas corretos
-- ============================================================================

-- ============================================
-- VIEW: vw_contas_financeiras_unificadas
-- Unifica contas_pagar_detalhadas e contas_receber_detalhadas
-- ============================================
CREATE OR REPLACE VIEW integrations_conta_azul.vw_contas_financeiras_unificadas AS
SELECT 
    -- Identificação
    id,
    tenant_id,
    conta_id, -- conta_pagar_id ou conta_receber_id
    parcela_id,
    tipo, -- 'PAGAR' ou 'RECEBER'
    
    -- Dados do rateio
    categoria_id,
    categoria_nome,
    centro_custo_id,
    centro_custo_nome,
    
    -- Valores
    valor_rateio,
    valor_total_parcela,
    valor_pago,
    valor_nao_pago,
    
    -- Dados da parcela
    data_vencimento,
    status,
    status_traduzido,
    
    -- Dados da pessoa (fornecedor ou cliente)
    pessoa_id, -- fornecedor_id ou cliente_conta_id
    pessoa_nome, -- fornecedor_nome ou cliente_conta_nome
    
    -- Dados do evento financeiro
    evento_id,
    evento_tipo,
    data_competencia,
    
    -- Timestamps
    created_at,
    updated_at
    
FROM (
    -- Contas a Pagar
    SELECT 
        id,
        tenant_id,
        conta_pagar_id AS conta_id,
        parcela_id,
        'PAGAR' AS tipo,
        categoria_id,
        categoria_nome,
        centro_custo_id,
        centro_custo_nome,
        valor_rateio,
        valor_total_parcela,
        valor_pago,
        valor_nao_pago,
        data_vencimento,
        status,
        status_traduzido,
        fornecedor_id AS pessoa_id,
        fornecedor_nome AS pessoa_nome,
        evento_id,
        evento_tipo,
        data_competencia,
        created_at,
        updated_at
    FROM integrations_conta_azul.contas_pagar_detalhadas
    
    UNION ALL
    
    -- Contas a Receber
    SELECT 
        id,
        tenant_id,
        conta_receber_id AS conta_id,
        parcela_id,
        'RECEBER' AS tipo,
        categoria_id,
        categoria_nome,
        centro_custo_id,
        centro_custo_nome,
        valor_rateio,
        valor_total_parcela,
        valor_pago,
        valor_nao_pago,
        data_vencimento,
        status,
        status_traduzido,
        cliente_conta_id AS pessoa_id,
        cliente_conta_nome AS pessoa_nome,
        evento_id,
        evento_tipo,
        data_competencia,
        created_at,
        updated_at
    FROM integrations_conta_azul.contas_receber_detalhadas
) AS contas_unificadas;

-- Comentário na view
COMMENT ON VIEW integrations_conta_azul.vw_contas_financeiras_unificadas IS 'View unificada que combina contas a pagar e receber detalhadas. A coluna tipo indica se é PAGAR ou RECEBER, e pessoa_id/pessoa_nome referenciam fornecedor (PAGAR) ou cliente (RECEBER).';

-- Conceder permissões na view
GRANT SELECT ON integrations_conta_azul.vw_contas_financeiras_unificadas TO authenticated;
GRANT SELECT ON integrations_conta_azul.vw_contas_financeiras_unificadas TO anon;
`;
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  try {
    const {
      supabase_url,
      supabase_anon_key,
      service_role_key,
      db_password, // Senha do PostgreSQL (necessária para conexão direta)
      ca_client_id,
      ca_client_secret,
      system_api_key,
    } = await req.json().catch(() => ({}));

    // Validações
    if (!supabase_url || !service_role_key) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'supabase_url e service_role_key são obrigatórios',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (!ca_client_id || !ca_client_secret) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'ca_client_id e ca_client_secret são obrigatórios',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Se não tiver db_password, vamos tentar executar via Management API
    // ou retornar instruções para execução manual
    if (!db_password) {
      // Extrair project-ref da URL do Supabase
      const projectRefMatch = supabase_url.match(/https?:\/\/([^.]+)\.supabase\.co/);
      const projectRef = projectRefMatch ? projectRefMatch[1] : null;
      
      // Construir links diretos para o Dashboard
      const dashboardBaseUrl = projectRef 
        ? `https://app.supabase.com/project/${projectRef}`
        : 'https://app.supabase.com/project/[seu-project-ref]';
      
      const sqlEditorLink = `${dashboardBaseUrl}/sql/new`;
      const exposedSchemasLink = `${dashboardBaseUrl}/settings/api`;
      const edgeFunctionsSecretsLink = `${dashboardBaseUrl}/settings/functions`;

      // Retornar migrations SQL para execução manual
      return new Response(
        JSON.stringify({
          success: false,
          requires_db_password: true,
          error: 'A senha do banco PostgreSQL (db_password) é necessária para executar as migrations automaticamente.',
          message: 'Forneça a senha do PostgreSQL ou execute as migrations manualmente no SQL Editor.',
          migrations_sql: MIGRATIONS.map(m => ({ name: m.name, sql: m.sql })),
          manual: {
            execute_migrations: {
              link: sqlEditorLink,
              instructions: [
                `1. Acesse o SQL Editor: ${sqlEditorLink}`,
                '2. Execute cada migration SQL na ordem: 001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020',
                '3. Copie e cole o conteúdo de cada arquivo SQL (disponível em migrations_sql acima)',
                '4. Execute uma migration por vez e verifique se não há erros antes de prosseguir',
              ],
              migrations_list: MIGRATIONS.map(m => m.name),
            },
            exposed_schemas: {
              link: exposedSchemasLink,
              instructions: [
                `1. Acesse: ${exposedSchemasLink}`,
                '2. Marque "app_core" (OBRIGATÓRIO)',
                '3. Opcionalmente, marque "dw" (apenas se precisar acesso via API REST)',
                '4. NÃO marque "integrations" e "integrations_conta_azul" (segurança)',
              ],
            },
            edge_function_secrets: {
              link: edgeFunctionsSecretsLink,
              values: {
                CA_CLIENT_ID: ca_client_id,
                CA_CLIENT_SECRET: ca_client_secret,
                SYSTEM_API_KEY: system_api_key || 'gerar_chave_aleatoria',
              },
              instructions: [
                `1. Acesse: ${edgeFunctionsSecretsLink}`,
                '2. Adicione cada secret com os valores acima',
              ],
            },
          },
        }),
        {
          status: 200, // 200 porque retornou informações válidas
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Validar SERVICE_ROLE_KEY tentando criar cliente Supabase
    try {
      // Criar cliente temporário para validação
      const testClient = await fetch(`${supabase_url}/rest/v1/`, {
        method: 'GET',
        headers: {
          'apikey': service_role_key,
          'Authorization': `Bearer ${service_role_key}`,
        },
      });

      if (!testClient.ok && testClient.status !== 200 && testClient.status !== 404) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'SERVICE_ROLE_KEY inválido ou sem permissões adequadas',
          }),
          {
            status: 401,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao validar SERVICE_ROLE_KEY: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Verificar se banco já está configurado
    try {
      const checkResult = await executeSQLDirect(
        supabase_url,
        service_role_key,
        db_password,
        `SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'app_core' 
          AND table_name = 'profiles'
        ) as exists;`
      );

      // Se conseguiu executar a query de verificação, verificar resultado
      // Por enquanto, vamos tentar executar as migrations e deixar o PostgreSQL lidar com "already exists"
    } catch (error) {
      // Se erro ao verificar, assumir que não está configurado
      console.warn('Não foi possível verificar se banco está configurado:', error);
    }

    // Executar migrations na ordem
    const executionResults: Array<{ migration: string; success: boolean; error?: string }> = [];

    for (const migration of MIGRATIONS) {
      const result = await executeSQLDirect(
        supabase_url,
        service_role_key,
        db_password,
        migration.sql
      );

      executionResults.push({
        migration: migration.name,
        success: result.success,
        error: result.error,
      });

      if (!result.success && !result.error?.includes('already exists')) {
        // Se erro não for "already exists", parar execução
        break;
      }
    }

    const allSuccessful = executionResults.every(r => r.success || r.error?.includes('already exists'));

    if (allSuccessful) {
      // Salvar configurações no banco de dados (Client ID e Secret)
      const configResults: Array<{ key: string; success: boolean; error?: string }> = [];
      
      if (ca_client_id) {
        const clientIdResult = await executeSQLDirect(
          supabase_url,
          service_role_key,
          db_password,
          `SELECT app_core.set_app_config(
            'conta_azul_client_id',
            '${ca_client_id.replace(/'/g, "''")}',
            'Client ID da Conta Azul (público)',
            false
          ) as result;`
        );
        configResults.push({ key: 'conta_azul_client_id', success: clientIdResult.success, error: clientIdResult.error });
      }
      
      if (ca_client_secret) {
        const clientSecretResult = await executeSQLDirect(
          supabase_url,
          service_role_key,
          db_password,
          `SELECT app_core.set_app_config(
            'conta_azul_client_secret',
            '${ca_client_secret.replace(/'/g, "''")}',
            'Client Secret da Conta Azul (criptografado)',
            true
          ) as result;`
        );
        configResults.push({ key: 'conta_azul_client_secret', success: clientSecretResult.success, error: clientSecretResult.error });
      }
      
      if (system_api_key) {
        const apiKeyResult = await executeSQLDirect(
          supabase_url,
          service_role_key,
          db_password,
          `SELECT app_core.set_app_config(
            'system_api_key',
            '${system_api_key.replace(/'/g, "''")}',
            'API Key do sistema (criptografado)',
            true
          ) as result;`
        );
        configResults.push({ key: 'system_api_key', success: apiKeyResult.success, error: apiKeyResult.error });
      }

      // Extrair project-ref da URL do Supabase
      // Formato: https://[project-ref].supabase.co
      const projectRefMatch = supabase_url.match(/https?:\/\/([^.]+)\.supabase\.co/);
      const projectRef = projectRefMatch ? projectRefMatch[1] : null;
      
      // Construir links diretos para o Dashboard
      const dashboardBaseUrl = projectRef 
        ? `https://app.supabase.com/project/${projectRef}`
        : 'https://app.supabase.com/project/[seu-project-ref]';
      
      const exposedSchemasLink = `${dashboardBaseUrl}/settings/api`;
      const edgeFunctionsSecretsLink = `${dashboardBaseUrl}/settings/functions`;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Setup concluído com sucesso! Todas as migrations foram executadas.',
          automated: {
            message: 'Todas as migrations (001-024) foram executadas automaticamente!',
            migrations_executed: executionResults.map(r => r.migration),
            total_migrations: executionResults.length,
            config_saved: configResults.length > 0,
            config_results: configResults,
          },
          manual: {
            exposed_schemas: {
              link: exposedSchemasLink,
              instructions: [
                '1. Acesse o link acima ou vá em Settings > API > Exposed Schemas no Supabase Dashboard',
                '2. Marque "app_core" (OBRIGATÓRIO - necessário para autenticação e perfis)',
                '3. Opcionalmente, marque "dw" (apenas se precisar acesso via API REST ao Data Warehouse)',
                '4. IMPORTANTE: NÃO marque "integrations" e "integrations_conta_azul" (schemas internos, não devem ser expostos por segurança)',
              ],
              explanation: {
                what_are_exposed_schemas: 'Exposed Schemas são schemas do PostgreSQL que ficam acessíveis via API REST do Supabase. Quando um schema é exposto, todas as suas tabelas automaticamente ganham endpoints REST.',
                why_configure: 'O schema "app_core" precisa ser exposto para que o Supabase Auth funcione corretamente. O schema "dw" é opcional e só deve ser exposto se você precisar acesso direto via API REST ao Data Warehouse.',
                security_note: 'Os schemas "integrations" e "integrations_conta_azul" contêm dados sensíveis e lógica de negócio interna. Eles NÃO devem ser expostos para manter a segurança e evitar acesso não autorizado.',
              },
            },
            edge_function_secrets: {
              link: edgeFunctionsSecretsLink,
              note: 'OPCIONAL: As configurações já foram salvas no banco de dados. Você pode configurar Edge Functions Secrets apenas como fallback durante a transição.',
              values: {
                CA_CLIENT_ID: ca_client_id,
                CA_CLIENT_SECRET: ca_client_secret,
                SYSTEM_API_KEY: system_api_key || 'gerar_chave_aleatoria',
              },
              instructions: [
                'NOTA: As configurações (Client ID e Secret) já foram salvas automaticamente no banco de dados.',
                'As Edge Functions podem ler do banco OU das variáveis de ambiente (fallback).',
                'Você pode configurar os secrets abaixo apenas se quiser manter o fallback durante a transição:',
                `1. CA_CLIENT_ID: ${ca_client_id}`,
                `2. CA_CLIENT_SECRET: ${ca_client_secret}`,
                `3. SYSTEM_API_KEY: ${system_api_key || 'gerar_chave_aleatoria'}`,
              ],
            },
            deploy_functions: {
              commands: [
                '# Instalar Supabase CLI (se ainda não tiver)',
                'npm install -g supabase',
                '',
                '# Login no Supabase',
                'supabase login',
                '',
                '# Linkar ao projeto (usar o Project Reference ID do Dashboard)',
                projectRef ? `supabase link --project-ref ${projectRef}` : 'supabase link --project-ref [seu-project-ref]',
                '',
                '# Deploy das Edge Functions necessárias',
                'supabase functions deploy setup-database',
                'supabase functions deploy exchange-conta-azul-token',
                'supabase functions deploy get-conta-azul-accounts',
                'supabase functions deploy get-conta-azul-categories',
                'supabase functions deploy get-valid-token',
                'supabase functions deploy dw-api',
              ],
              instructions: [
                '1. Abra um terminal na raiz do projeto',
                '2. Execute os comandos acima na ordem',
                '3. Certifique-se de estar autenticado no Supabase CLI (`supabase login`)',
                '4. Após o deploy, as Edge Functions estarão disponíveis e poderão usar os secrets configurados',
                '5. IMPORTANTE: A Edge Function `setup-database` já está deployada e funcionando (você acabou de usá-la!)',
              ],
            },
          },
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } else {
      // Algumas migrations falharam
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Algumas migrations falharam durante a execução.',
          migrations_results: executionResults,
          migrations_sql: MIGRATIONS.map(m => ({ name: m.name, sql: m.sql })),
        }),
        {
          status: 200, // Retorna 200 porque tem instruções
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }
  } catch (error) {
    console.error('Erro na Edge Function de setup:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao processar setup',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
