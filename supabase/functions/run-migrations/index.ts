// Edge Function para executar migrations SQL
// Esta função contém as migrations SQL embutidas e executa via conexão direta ao PostgreSQL
// É chamada internamente pela setup-config (não exposta diretamente para o frontend)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// =============================================================================
// MIGRATIONS SQL (em ordem de execução)
// =============================================================================

const MIGRATION_001_SCHEMAS = `
CREATE SCHEMA IF NOT EXISTS app_core;
COMMENT ON SCHEMA app_core IS 'Schema principal da aplicação: autenticação, tenants, credenciais e auditoria';

CREATE SCHEMA IF NOT EXISTS integrations;
COMMENT ON SCHEMA integrations IS 'Schema para integrações e fluxos de dados';

CREATE SCHEMA IF NOT EXISTS dw;
COMMENT ON SCHEMA dw IS 'Schema do Data Warehouse: dados consolidados para consumo via API';

GRANT USAGE ON SCHEMA app_core TO authenticated;
GRANT USAGE ON SCHEMA app_core TO anon;
GRANT USAGE ON SCHEMA integrations TO authenticated;
GRANT USAGE ON SCHEMA dw TO authenticated;
GRANT USAGE ON SCHEMA dw TO anon;
`;

const MIGRATION_002_APP_CORE_TABLES = `
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

COMMENT ON TABLE app_core.tenant_credentials IS 'Credenciais de API por tenant e plataforma';

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_credentials_unique_name 
    ON app_core.tenant_credentials(tenant_id, platform, credential_name) 
    WHERE platform = 'CONTA_AZUL' AND revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tenant_credentials_tenant_id ON app_core.tenant_credentials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_credentials_platform ON app_core.tenant_credentials(platform);
CREATE INDEX IF NOT EXISTS idx_tenant_credentials_is_active ON app_core.tenant_credentials(is_active);

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

-- Permissões GRANT nas tabelas (necessárias mesmo com RLS)
-- RLS controla quais linhas podem ser acessadas, GRANT controla se a tabela pode ser acessada
GRANT SELECT, INSERT, UPDATE, DELETE ON app_core.profiles TO authenticated;
GRANT SELECT ON app_core.profiles TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON app_core.tenants TO authenticated;
GRANT SELECT ON app_core.tenants TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON app_core.tenant_credentials TO authenticated;

GRANT SELECT, INSERT ON app_core.audit_logs TO authenticated;

GRANT SELECT, INSERT ON app_core.user_sessions TO authenticated;
`;

const MIGRATION_003_TRIGGERS = `
CREATE OR REPLACE FUNCTION app_core.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON app_core.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON app_core.profiles
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenants_updated_at ON app_core.tenants;
CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON app_core.tenants
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

DROP TRIGGER IF EXISTS update_tenant_credentials_updated_at ON app_core.tenant_credentials;
CREATE TRIGGER update_tenant_credentials_updated_at
    BEFORE UPDATE ON app_core.tenant_credentials
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();
`;

const MIGRATION_004_AUTH_FUNCTIONS = `
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

const MIGRATION_005_RLS = `
ALTER TABLE app_core.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_core.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_core.tenant_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_core.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_core.user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON app_core.profiles;
CREATE POLICY "Users can view own profile"
    ON app_core.profiles FOR SELECT
    USING (auth.uid() = id OR app_core.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON app_core.profiles;
CREATE POLICY "Users can update own profile"
    ON app_core.profiles FOR UPDATE
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can manage all profiles" ON app_core.profiles;
CREATE POLICY "Admins can manage all profiles"
    ON app_core.profiles FOR ALL
    USING (app_core.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Partners can view own tenants" ON app_core.tenants;
CREATE POLICY "Partners can view own tenants"
    ON app_core.tenants FOR SELECT
    USING (partner_id = auth.uid() OR app_core.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Partners can create tenants" ON app_core.tenants;
CREATE POLICY "Partners can create tenants"
    ON app_core.tenants FOR INSERT
    WITH CHECK (partner_id = auth.uid() OR app_core.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Partners can update own tenants" ON app_core.tenants;
CREATE POLICY "Partners can update own tenants"
    ON app_core.tenants FOR UPDATE
    USING (partner_id = auth.uid() OR app_core.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Partners can view own tenant credentials" ON app_core.tenant_credentials;
CREATE POLICY "Partners can view own tenant credentials"
    ON app_core.tenant_credentials FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app_core.tenants t
            WHERE t.id = tenant_credentials.tenant_id
            AND (t.partner_id = auth.uid() OR app_core.is_admin(auth.uid()))
        )
    );

DROP POLICY IF EXISTS "Partners can manage own tenant credentials" ON app_core.tenant_credentials;
CREATE POLICY "Partners can manage own tenant credentials"
    ON app_core.tenant_credentials FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM app_core.tenants t
            WHERE t.id = tenant_credentials.tenant_id
            AND (t.partner_id = auth.uid() OR app_core.is_admin(auth.uid()))
        )
    );

DROP POLICY IF EXISTS "Users can view own audit logs" ON app_core.audit_logs;
CREATE POLICY "Users can view own audit logs"
    ON app_core.audit_logs FOR SELECT
    USING (user_id = auth.uid() OR app_core.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Users can view own sessions" ON app_core.user_sessions;
CREATE POLICY "Users can view own sessions"
    ON app_core.user_sessions FOR SELECT
    USING (user_id = auth.uid() OR app_core.is_admin(auth.uid()));
`;

const MIGRATION_006_APP_CONFIG = `
CREATE TABLE IF NOT EXISTS app_core.app_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE app_core.app_config IS 'Configurações globais da aplicação (Client ID, Secrets, etc.)';

ALTER TABLE app_core.app_config ENABLE ROW LEVEL SECURITY;

-- Permissões GRANT na tabela app_config
GRANT SELECT ON app_core.app_config TO authenticated;
GRANT SELECT ON app_core.app_config TO anon; -- Anon pode precisar acessar Client ID público

DROP POLICY IF EXISTS "Only admins can manage app_config" ON app_core.app_config;
CREATE POLICY "Only admins can manage app_config"
    ON app_core.app_config FOR ALL
    USING (app_core.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION app_core.get_app_config(p_key TEXT)
RETURNS TEXT AS $$
DECLARE
    v_value TEXT;
    v_is_encrypted BOOLEAN;
BEGIN
    SELECT value, is_encrypted INTO v_value, v_is_encrypted
    FROM app_core.app_config
    WHERE key = p_key;

    IF v_value IS NULL THEN
        RETURN NULL;
    END IF;

    IF v_is_encrypted THEN
        RETURN v_value;
    END IF;

    RETURN v_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION app_core.set_app_config(
    p_key TEXT,
    p_value TEXT,
    p_description TEXT DEFAULT NULL,
    p_is_encrypted BOOLEAN DEFAULT FALSE
)
RETURNS JSONB AS $$
BEGIN
    INSERT INTO app_core.app_config (key, value, description, is_encrypted)
    VALUES (p_key, p_value, p_description, p_is_encrypted)
    ON CONFLICT (key) DO UPDATE
    SET value = p_value,
        description = COALESCE(p_description, app_core.app_config.description),
        is_encrypted = p_is_encrypted,
        updated_at = NOW();

    RETURN jsonb_build_object('success', true, 'key', p_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION app_core.get_conta_azul_client_id()
RETURNS TEXT AS $$
BEGIN
    RETURN app_core.get_app_config('conta_azul_client_id');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

const MIGRATION_007_PROFILE_RPC = `
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

GRANT EXECUTE ON FUNCTION app_core.create_or_update_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION app_core.create_or_update_profile(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
`;

const MIGRATION_008_SYNC_JOBS = `
CREATE TABLE IF NOT EXISTS app_core.sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
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

COMMENT ON TABLE app_core.sync_jobs IS 'Jobs de sincronização executados para cada tenant';
COMMENT ON COLUMN app_core.sync_jobs.retry_count IS 'Número de tentativas de retry em caso de erro';

CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant_id ON app_core.sync_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON app_core.sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_created_at ON app_core.sync_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_tenant_status_created ON app_core.sync_jobs(tenant_id, status, created_at DESC);

ALTER TABLE app_core.sync_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Partners can view own tenant sync jobs" ON app_core.sync_jobs;
CREATE POLICY "Partners can view own tenant sync jobs"
    ON app_core.sync_jobs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM app_core.tenants t
            WHERE t.id = sync_jobs.tenant_id AND t.partner_id = auth.uid()
        ) OR
        app_core.is_admin(auth.uid())
    );

DROP POLICY IF EXISTS "System can create sync jobs" ON app_core.sync_jobs;
CREATE POLICY "System can create sync jobs"
    ON app_core.sync_jobs FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Partners can update own tenant sync jobs" ON app_core.sync_jobs;
CREATE POLICY "Partners can update own tenant sync jobs"
    ON app_core.sync_jobs FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM app_core.tenants t
            WHERE t.id = sync_jobs.tenant_id AND t.partner_id = auth.uid()
        ) OR
        app_core.is_admin(auth.uid())
    );

-- Permissões GRANT na tabela sync_jobs
GRANT SELECT, INSERT, UPDATE ON app_core.sync_jobs TO authenticated;
`;

// Lista de migrations em ordem
const MIGRATIONS = [
  { name: '001_schemas', sql: MIGRATION_001_SCHEMAS },
  { name: '002_app_core_tables', sql: MIGRATION_002_APP_CORE_TABLES },
  { name: '003_triggers', sql: MIGRATION_003_TRIGGERS },
  { name: '004_auth_functions', sql: MIGRATION_004_AUTH_FUNCTIONS },
  { name: '005_rls', sql: MIGRATION_005_RLS },
  { name: '006_app_config', sql: MIGRATION_006_APP_CONFIG },
  { name: '007_profile_rpc', sql: MIGRATION_007_PROFILE_RPC },
  { name: '008_sync_jobs', sql: MIGRATION_008_SYNC_JOBS },
];

// ============================================================================
// Função para executar SQL via conexão PostgreSQL direta
// ============================================================================
async function executeSQLDirect(
  dbHost: string,
  dbPassword: string,
  sql: string
): Promise<{ success: boolean; error?: string }> {
  const client = new Client({
    hostname: dbHost,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: dbPassword,
    tls: { enabled: true },
  });

  try {
    await client.connect();

    // Executar SQL completo (não dividir por ;)
    // O PostgreSQL pode executar múltiplos statements
    await client.queryArray(sql);

    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Ignorar erros de "already exists"
    if (errorMsg.includes('already exists')) {
      return { success: true };
    }
    return { success: false, error: errorMsg };
  } finally {
    try {
      await client.end();
    } catch {
      // Ignorar erros ao fechar conexão
    }
  }
}

serve(async (req) => {
  // Responder OPTIONS imediatamente
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: {
        ...corsHeaders,
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  console.log('[run-migrations] Iniciando...');
  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));

    // Validações
    if (!body.supabase_url || !body.db_password) {
      return jsonResponse({
        success: false,
        error: 'supabase_url e db_password são obrigatórios',
      }, 400);
    }

    // Extrair project_ref e montar host do DB
    const match = body.supabase_url.match(/https:\/\/(.+?)\.supabase\.co/);
    if (!match) {
      return jsonResponse({
        success: false,
        error: 'URL do Supabase inválida',
      }, 400);
    }

    const projectRef = match[1];
    const dbHost = `db.${projectRef}.supabase.co`;

    console.log(`[run-migrations] Conectando a ${dbHost}...`);

    // Executar migrations em ordem
    const results: Array<{ migration: string; success: boolean; error?: string }> = [];

    for (const migration of MIGRATIONS) {
      console.log(`[run-migrations] Executando ${migration.name}...`);
      const result = await executeSQLDirect(dbHost, body.db_password, migration.sql);
      results.push({
        migration: migration.name,
        success: result.success,
        error: result.error,
      });

      if (!result.success) {
        console.error(`[run-migrations] Erro em ${migration.name}:`, result.error);
        // Continuar mesmo com erro (pode ser "already exists")
      } else {
        console.log(`[run-migrations] ${migration.name} OK`);
      }
    }

    // Salvar configurações se fornecidas
    if (body.ca_client_id || body.ca_client_secret || body.system_api_key) {
      console.log('[run-migrations] Salvando configurações...');
      
      const configSql = `
        SELECT app_core.set_app_config('conta_azul_client_id', '${(body.ca_client_id || '').replace(/'/g, "''")}', 'Client ID da Conta Azul', false);
        SELECT app_core.set_app_config('conta_azul_client_secret', '${(body.ca_client_secret || '').replace(/'/g, "''")}', 'Client Secret da Conta Azul (criptografado)', true);
        SELECT app_core.set_app_config('system_api_key', '${(body.system_api_key || '').replace(/'/g, "''")}', 'API Key do sistema', true);
      `;
      
      const configResult = await executeSQLDirect(dbHost, body.db_password, configSql);
      results.push({
        migration: 'config_save',
        success: configResult.success,
        error: configResult.error,
      });
    }

    const elapsed = Date.now() - startTime;
    console.log(`[run-migrations] Concluído em ${elapsed}ms`);

    const allSuccessful = results.every(r => r.success);

    return jsonResponse({
      success: allSuccessful,
      message: allSuccessful ? 'Migrations executadas com sucesso' : 'Algumas migrations falharam',
      migrations_result: {
        executed: results.filter(r => r.success).map(r => r.migration),
        errors: results.filter(r => !r.success).map(r => `${r.migration}: ${r.error}`),
      },
      elapsed_ms: elapsed,
    }, allSuccessful ? 200 : 500);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[run-migrations] Exceção:', errorMessage);

    return jsonResponse({
      success: false,
      error: errorMessage,
    }, 500);
  }
});

function jsonResponse(data: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
