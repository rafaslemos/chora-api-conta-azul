// Edge Function para executar migrations de Integrations (fase 2)
// Contém: 003_dw_tables, 004_rpc_functions, 006_integrations_schemas,
// 007_integrations_shared_tables, 008_conta_azul_entities, 009_financial,
// 010_sales, 011_rpc_functions
// É chamada internamente pela setup-config após run-migrations (fase 1)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { Client } from 'https://deno.land/x/postgres@v0.17.0/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============================================================================
// MIGRATION 003: DW Tables
// ============================================================================
const MIGRATION_003_DW_TABLES = `
-- DW API Keys
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

CREATE INDEX IF NOT EXISTS idx_dw_api_keys_tenant_id ON dw.dw_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dw_api_keys_key_hash ON dw.dw_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_dw_api_keys_is_active ON dw.dw_api_keys(is_active);

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

GRANT SELECT ON dw.vw_conta_azul_credentials TO authenticated;
GRANT SELECT ON dw.vw_conta_azul_credentials TO anon;
`;

// ============================================================================
// MIGRATION 004: RPC Functions (Encryption)
// ============================================================================
const MIGRATION_004_RPC_FUNCTIONS = `
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
        tenant_id, credential_id, user_id, action, entity_type, entity_id,
        status, details, ip_address, user_agent
    ) VALUES (
        p_tenant_id, p_credential_id, COALESCE(p_user_id, auth.uid()),
        p_action, p_entity_type, p_entity_id, p_status, p_details,
        p_ip_address, p_user_agent
    )
    RETURNING id INTO v_log_id;
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

// ============================================================================
// MIGRATION 006: Integrations Conta Azul Schema
// ============================================================================
const MIGRATION_006_INTEGRATIONS_SCHEMA = `
CREATE SCHEMA IF NOT EXISTS integrations_conta_azul;
COMMENT ON SCHEMA integrations_conta_azul IS 'Schema específico para dados coletados da API Conta Azul';
GRANT USAGE ON SCHEMA integrations_conta_azul TO authenticated;
GRANT USAGE ON SCHEMA integrations_conta_azul TO anon;
GRANT USAGE ON SCHEMA integrations_conta_azul TO service_role; -- Necessário caso Edge Functions precisem acessar RPCs
`;

// ============================================================================
// MIGRATION 007: Integrations Shared Tables
// ============================================================================
const MIGRATION_007_SHARED_TABLES = `
CREATE TABLE IF NOT EXISTS integrations.controle_carga (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    platform TEXT NOT NULL CHECK (platform IN ('CONTA_AZUL', 'OLIST', 'HOTMART')),
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
CREATE INDEX IF NOT EXISTS idx_controle_carga_platform ON integrations.controle_carga(platform);

DROP TRIGGER IF EXISTS update_controle_carga_updated_at ON integrations.controle_carga;
CREATE TRIGGER update_controle_carga_updated_at
    BEFORE UPDATE ON integrations.controle_carga
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

CREATE TABLE IF NOT EXISTS integrations.config_periodicidade (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    platform TEXT NOT NULL CHECK (platform IN ('CONTA_AZUL', 'OLIST', 'HOTMART')),
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

DROP TRIGGER IF EXISTS update_config_periodicidade_updated_at ON integrations.config_periodicidade;
CREATE TRIGGER update_config_periodicidade_updated_at
    BEFORE UPDATE ON integrations.config_periodicidade
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();
`;

// ============================================================================
// MIGRATION 008: Conta Azul Entities
// ============================================================================
const MIGRATION_008_ENTITIES = `
-- Pessoas
CREATE TABLE IF NOT EXISTS integrations_conta_azul.pessoas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    pessoa_id TEXT NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_pessoas_pessoa_id ON integrations_conta_azul.pessoas(pessoa_id);

-- Categorias
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

-- Categorias DRE
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

-- Centro de Custos
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

-- Produtos
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
    valor_venda NUMERIC,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, produto_id, credential_id)
);

-- Serviços
CREATE TABLE IF NOT EXISTS integrations_conta_azul.servicos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    servico_id TEXT NOT NULL,
    codigo TEXT,
    descricao TEXT NOT NULL,
    preco NUMERIC,
    status TEXT CHECK (status IS NULL OR status IN ('ATIVO', 'INATIVO')),
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, servico_id, credential_id)
);

-- Vendedores
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

-- Contas Financeiras
CREATE TABLE IF NOT EXISTS integrations_conta_azul.contas_financeiras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    conta_financeira_id TEXT NOT NULL,
    nome TEXT,
    tipo TEXT,
    banco TEXT,
    ativo BOOLEAN,
    conta_padrao BOOLEAN,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, conta_financeira_id, credential_id)
);
`;

// ============================================================================
// MIGRATION 009: Financial Tables
// ============================================================================
const MIGRATION_009_FINANCIAL = `
-- Contas a Pagar
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
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, conta_pagar_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_tenant_id ON integrations_conta_azul.contas_pagar(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_vencimento ON integrations_conta_azul.contas_pagar(data_vencimento);

-- Contas a Receber
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
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, conta_receber_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_contas_receber_tenant_id ON integrations_conta_azul.contas_receber(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_data_vencimento ON integrations_conta_azul.contas_receber(data_vencimento);

-- Contratos
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
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, contrato_id, credential_id)
);

-- Saldos Contas
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
`;

// ============================================================================
// MIGRATION 010: Sales Tables
// ============================================================================
const MIGRATION_010_SALES = `
-- Vendas
CREATE TABLE IF NOT EXISTS integrations_conta_azul.vendas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES app_core.tenant_credentials(id) ON DELETE SET NULL,
    venda_id TEXT NOT NULL,
    numero INTEGER,
    data DATE,
    total NUMERIC(15,2),
    tipo TEXT,
    situacao TEXT,
    cliente_venda_id TEXT,
    cliente_venda_nome TEXT,
    vendedor_id TEXT,
    vendedor_nome TEXT,
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, venda_id, credential_id)
);

CREATE INDEX IF NOT EXISTS idx_vendas_tenant_id ON integrations_conta_azul.vendas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendas_data ON integrations_conta_azul.vendas(data);

-- Vendas Itens
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
    dados_originais JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, venda_id, item_id, credential_id)
);
`;

// ============================================================================
// MIGRATION 011: RPC Functions for Integrations
// ============================================================================
const MIGRATION_011_INTEGRATIONS_RPC = `
-- RPC: Get Controle Carga
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
    SELECT * INTO v_controle
    FROM integrations.controle_carga
    WHERE tenant_id = p_tenant_id 
      AND platform = p_platform
      AND entidade_tipo = p_entidade_tipo
      AND (p_credential_id IS NULL OR credential_id = p_credential_id);
    
    IF v_controle.id IS NULL THEN
        RETURN json_build_object(
            'success', true,
            'controle', json_build_object(
                'tenant_id', p_tenant_id,
                'platform', p_platform,
                'entidade_tipo', p_entidade_tipo,
                'carga_full_realizada', false
            )
        );
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'controle', row_to_json(v_controle)
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Update Controle Carga Full
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
    UPDATE integrations.controle_carga
    SET carga_full_realizada = TRUE, ultima_carga_full = NOW(), updated_at = NOW()
    WHERE tenant_id = p_tenant_id AND platform = p_platform AND entidade_tipo = p_entidade_tipo
      AND (p_credential_id IS NULL OR credential_id = p_credential_id)
    RETURNING id INTO v_id;
    
    IF v_id IS NULL THEN
        INSERT INTO integrations.controle_carga (tenant_id, credential_id, platform, entidade_tipo, carga_full_realizada, ultima_carga_full)
        VALUES (p_tenant_id, p_credential_id, p_platform, p_entidade_tipo, TRUE, NOW())
        RETURNING id INTO v_id;
    END IF;
    
    RETURN json_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

// Lista de migrations em ordem
const MIGRATIONS = [
  { name: '003_dw_tables', sql: MIGRATION_003_DW_TABLES },
  { name: '004_rpc_functions', sql: MIGRATION_004_RPC_FUNCTIONS },
  { name: '006_integrations_schema', sql: MIGRATION_006_INTEGRATIONS_SCHEMA },
  { name: '007_shared_tables', sql: MIGRATION_007_SHARED_TABLES },
  { name: '008_entities', sql: MIGRATION_008_ENTITIES },
  { name: '009_financial', sql: MIGRATION_009_FINANCIAL },
  { name: '010_sales', sql: MIGRATION_010_SALES },
  { name: '011_integrations_rpc', sql: MIGRATION_011_INTEGRATIONS_RPC },
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
    await client.queryArray(sql);
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      status: 200,
      headers: { ...corsHeaders, 'Access-Control-Max-Age': '86400' },
    });
  }

  console.log('[run-migrations-integrations] Iniciando...');
  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));

    if (!body.supabase_url || !body.db_password) {
      return jsonResponse({
        success: false,
        error: 'supabase_url e db_password são obrigatórios',
      }, 400);
    }

    const match = body.supabase_url.match(/https:\/\/(.+?)\.supabase\.co/);
    if (!match) {
      return jsonResponse({ success: false, error: 'URL do Supabase inválida' }, 400);
    }

    const projectRef = match[1];
    const dbHost = `db.${projectRef}.supabase.co`;

    console.log(`[run-migrations-integrations] Conectando a ${dbHost}...`);

    const results: Array<{ migration: string; success: boolean; error?: string }> = [];

    for (const migration of MIGRATIONS) {
      console.log(`[run-migrations-integrations] Executando ${migration.name}...`);
      const result = await executeSQLDirect(dbHost, body.db_password, migration.sql);
      results.push({
        migration: migration.name,
        success: result.success,
        error: result.error,
      });

      if (!result.success) {
        console.error(`[run-migrations-integrations] Erro em ${migration.name}:`, result.error);
      } else {
        console.log(`[run-migrations-integrations] ${migration.name} OK`);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`[run-migrations-integrations] Concluído em ${elapsed}ms`);

    const allSuccessful = results.every(r => r.success);

    return jsonResponse({
      success: allSuccessful,
      message: allSuccessful ? 'Migrations de integrations executadas com sucesso' : 'Algumas migrations falharam',
      migrations_result: {
        executed: results.filter(r => r.success).map(r => r.migration),
        errors: results.filter(r => !r.success).map(r => `${r.migration}: ${r.error}`),
      },
      elapsed_ms: elapsed,
    }, allSuccessful ? 200 : 500);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[run-migrations-integrations] Exceção:', errorMessage);
    return jsonResponse({ success: false, error: errorMessage }, 500);
  }
});

function jsonResponse(data: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
