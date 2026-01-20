-- ============================================================================
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
