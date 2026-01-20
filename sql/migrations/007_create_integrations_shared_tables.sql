-- ============================================================================
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
    platform TEXT NOT NULL CHECK (platform IN ('CONTA_AZUL', 'OLIST', 'HOTMART')), -- Plataforma de origem
    entidade_tipo TEXT NOT NULL, -- 'contas_pagar', 'contas_receber', 'vendas', 'contratos', 'notas_fiscais', 'centro_custos', 'categorias', 'categorias_dre', 'pessoas', 'produtos', 'servicos', 'vendedores', 'protocolos'
    carga_full_realizada BOOLEAN DEFAULT FALSE,
    ultima_carga_full TIMESTAMPTZ,
    ultima_carga_incremental TIMESTAMPTZ,
    ultima_data_processada TIMESTAMPTZ, -- Para controle incremental
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, platform, entidade_tipo, credential_id)
);

-- Índices para controle_carga
CREATE INDEX IF NOT EXISTS idx_controle_carga_tenant_id ON integrations.controle_carga(tenant_id);
CREATE INDEX IF NOT EXISTS idx_controle_carga_credential_id ON integrations.controle_carga(credential_id);
CREATE INDEX IF NOT EXISTS idx_controle_carga_platform ON integrations.controle_carga(platform);
CREATE INDEX IF NOT EXISTS idx_controle_carga_entidade_tipo ON integrations.controle_carga(entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_controle_carga_tenant_platform_entidade ON integrations.controle_carga(tenant_id, platform, entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_controle_carga_full_realizada ON integrations.controle_carga(carga_full_realizada) WHERE carga_full_realizada = FALSE;

-- Trigger para updated_at automático
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
    platform TEXT NOT NULL CHECK (platform IN ('CONTA_AZUL', 'OLIST', 'HOTMART')), -- Plataforma de origem
    entidade_tipo TEXT NOT NULL, -- Configuração específica por tenant, plataforma E entidade
    periodicidade_tipo TEXT NOT NULL CHECK (periodicidade_tipo IN ('minuto', 'hora', 'dia', 'semana', 'mes')), -- 'minuto', 'hora', 'dia', 'semana', 'mes'
    periodicidade_valor INTEGER NOT NULL, -- Ex: 30 minutos, 2 horas, 1 dia
    ativo BOOLEAN DEFAULT TRUE,
    proxima_execucao TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id, platform, entidade_tipo, credential_id) -- Uma configuração por tenant, plataforma, entidade e credencial
);

-- Índices para config_periodicidade
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_tenant_id ON integrations.config_periodicidade(tenant_id);
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_credential_id ON integrations.config_periodicidade(credential_id);
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_platform ON integrations.config_periodicidade(platform);
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_entidade_tipo ON integrations.config_periodicidade(entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_tenant_platform_entidade ON integrations.config_periodicidade(tenant_id, platform, entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_ativo ON integrations.config_periodicidade(ativo) WHERE ativo = TRUE;
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_proxima_execucao ON integrations.config_periodicidade(proxima_execucao);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_config_periodicidade_updated_at ON integrations.config_periodicidade;
CREATE TRIGGER update_config_periodicidade_updated_at
    BEFORE UPDATE ON integrations.config_periodicidade
    FOR EACH ROW
    EXECUTE FUNCTION app_core.update_updated_at_column();

-- Comentários nas tabelas
COMMENT ON TABLE integrations.controle_carga IS 'Controla o status de carga FULL e incremental por tenant, plataforma e entidade. Suporta múltiplas credenciais por tenant.';
COMMENT ON TABLE integrations.config_periodicidade IS 'Configuração de periodicidade por tenant, plataforma e entidade (uso futuro). Suporta múltiplas credenciais por tenant.';

COMMENT ON COLUMN integrations.controle_carga.tenant_id IS 'ID do tenant (cliente)';
COMMENT ON COLUMN integrations.controle_carga.credential_id IS 'ID da credencial específica (opcional, para suportar múltiplas credenciais por tenant)';
COMMENT ON COLUMN integrations.controle_carga.platform IS 'Plataforma de origem: CONTA_AZUL, OLIST, HOTMART';
COMMENT ON COLUMN integrations.controle_carga.entidade_tipo IS 'Tipo da entidade: contas_pagar, contas_receber, vendas, contratos, notas_fiscais, centro_custos, categorias, categorias_dre, pessoas, produtos, servicos, vendedores, protocolos';
COMMENT ON COLUMN integrations.controle_carga.carga_full_realizada IS 'Indica se a carga FULL já foi realizada para este tenant, plataforma e entidade';
COMMENT ON COLUMN integrations.controle_carga.ultima_data_processada IS 'Última data processada para controle incremental';

COMMENT ON COLUMN integrations.config_periodicidade.tenant_id IS 'ID do tenant (cliente)';
COMMENT ON COLUMN integrations.config_periodicidade.credential_id IS 'ID da credencial específica (opcional, para suportar múltiplas credenciais por tenant)';
COMMENT ON COLUMN integrations.config_periodicidade.platform IS 'Plataforma de origem: CONTA_AZUL, OLIST, HOTMART';
COMMENT ON COLUMN integrations.config_periodicidade.entidade_tipo IS 'Tipo da entidade para configuração';
COMMENT ON COLUMN integrations.config_periodicidade.periodicidade_tipo IS 'Tipo de periodicidade: minuto, hora, dia, semana, mes';
COMMENT ON COLUMN integrations.config_periodicidade.periodicidade_valor IS 'Valor numérico da periodicidade (ex: 30 minutos, 2 horas, 1 dia)';
