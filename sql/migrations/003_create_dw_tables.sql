-- ============================================================================
-- Migration 003: Criar Tabelas do Schema dw (Data Warehouse)
-- ============================================================================
-- Tabelas e estruturas para acesso ao Data Warehouse via API
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tabela: dw_api_keys (chaves de API para acesso ao DW)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dw.dw_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES app_core.tenants(id) ON DELETE CASCADE,
    key_hash TEXT NOT NULL UNIQUE, -- Hash da API key (SHA-256 ou similar)
    key_name TEXT NOT NULL, -- Nome descritivo da chave (ex: "Chave DW Cliente XYZ")
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ, -- Última vez que a chave foi usada
    expires_at TIMESTAMPTZ, -- Data de expiração (NULL = sem expiração)
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE dw.dw_api_keys IS 'Chaves de API para acesso read-only ao Data Warehouse por tenant';
COMMENT ON COLUMN dw.dw_api_keys.key_hash IS 'Hash SHA-256 da API key (nunca armazenar a chave em texto plano)';
COMMENT ON COLUMN dw.dw_api_keys.key_name IS 'Nome descritivo para identificação da chave';

-- Índices
CREATE INDEX IF NOT EXISTS idx_dw_api_keys_tenant_id ON dw.dw_api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dw_api_keys_key_hash ON dw.dw_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_dw_api_keys_is_active ON dw.dw_api_keys(is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_dw_api_keys_tenant_name ON dw.dw_api_keys(tenant_id, key_name) WHERE is_active = TRUE;

-- Trigger para updated_at
CREATE TRIGGER update_dw_api_keys_updated_at
    BEFORE UPDATE ON dw.dw_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- Função auxiliar: Gerar hash SHA-256 (para validação de API keys)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dw.hash_api_key(p_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(digest(p_key, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION dw.hash_api_key IS 'Gera hash SHA-256 de uma API key';

-- ----------------------------------------------------------------------------
-- Função auxiliar: Validar e buscar API key
-- ----------------------------------------------------------------------------
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

COMMENT ON FUNCTION dw.validate_api_key IS 'Valida uma API key pelo hash e retorna informações do tenant';

-- ----------------------------------------------------------------------------
-- Exemplo de view para dados do DW (ajustar conforme necessidade)
-- ----------------------------------------------------------------------------
-- Esta é uma view de exemplo que pode ser expandida conforme necessário
-- Por enquanto, retorna informações básicas das credenciais Conta Azul

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

-- Conceder permissões na view
GRANT SELECT ON dw.vw_conta_azul_credentials TO authenticated;
GRANT SELECT ON dw.vw_conta_azul_credentials TO anon;
