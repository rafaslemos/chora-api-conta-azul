-- ============================================================================
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
