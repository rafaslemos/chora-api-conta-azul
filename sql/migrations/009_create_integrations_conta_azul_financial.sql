-- ============================================================================
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
