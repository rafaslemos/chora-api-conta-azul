-- ============================================================================
-- SCHEMA COMPLETO DE COLETA - CONSOLIDADO
-- ============================================================================
-- Este arquivo consolida todos os schemas de coleta em uma Ãºnica query SQL
-- para facilitar a criaÃ§Ã£o completa do banco de dados.
--
-- Ordem de criaÃ§Ã£o (respeitando dependÃªncias):
-- 1. Tabelas de controle (controle_carga, config_periodicidade)
-- 2. Tabelas cadastrais sem dependÃªncias (pessoas, categorias, categorias_dre, centro_custos, produtos, servicos, vendedores)
-- 3. Tabelas com dependÃªncias (contas_financeiras)
-- 4. Tabelas financeiras (contas_pagar, contas_receber)
-- 5. Tabelas de vendas (vendas)
-- 6. Tabelas detalhadas (vendas_detalhadas, contas_pagar_detalhadas, contas_receber_detalhadas, vendas_itens, parcelas_detalhes)
-- 7. Tabelas auxiliares (saldos_contas, contratos)
-- 8. Views (vw_contas_financeiras_unificadas)
--
-- Data: 2025-01-XX
-- ============================================================================

-- ============================================================================
-- Arquivo: schema-coleta.sql
-- ============================================================================

-- Schema do Supabase para Sistema de Coleta de Dados Conta Azul
-- Tabelas de controle e configuração para coleta de dados

-- ============================================
-- TABELA: controle_carga
-- Controla o status de carga FULL e incremental por cliente e entidade
-- ============================================
CREATE TABLE IF NOT EXISTS controle_carga (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    entidade_tipo TEXT NOT NULL, -- 'contas_pagar', 'contas_receber', 'vendas', 'contratos', 'notas_fiscais', 'centro_custos', 'categorias', 'categorias_dre', 'pessoas', 'produtos', 'servicos', 'vendedores', 'protocolos'
    carga_full_realizada BOOLEAN DEFAULT FALSE,
    ultima_carga_full TIMESTAMP WITH TIME ZONE,
    ultima_carga_incremental TIMESTAMP WITH TIME ZONE,
    ultima_data_processada TIMESTAMP WITH TIME ZONE, -- Para controle incremental
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, entidade_tipo)
);

-- Índices para controle_carga
CREATE INDEX IF NOT EXISTS idx_controle_carga_cliente_id ON controle_carga(cliente_id);
CREATE INDEX IF NOT EXISTS idx_controle_carga_entidade_tipo ON controle_carga(entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_controle_carga_cliente_entidade ON controle_carga(cliente_id, entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_controle_carga_full_realizada ON controle_carga(carga_full_realizada) WHERE carga_full_realizada = FALSE;

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_controle_carga_updated_at ON controle_carga;
CREATE TRIGGER update_controle_carga_updated_at
    BEFORE UPDATE ON controle_carga
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TABELA: config_periodicidade
-- Configuração de periodicidade por cliente e entidade (uso futuro)
-- ============================================
CREATE TABLE IF NOT EXISTS config_periodicidade (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    entidade_tipo TEXT NOT NULL, -- Configuração específica por cliente E entidade
    periodicidade_tipo TEXT NOT NULL, -- 'minuto', 'hora', 'dia', 'semana', 'mes'
    periodicidade_valor INTEGER NOT NULL, -- Ex: 30 minutos, 2 horas, 1 dia
    ativo BOOLEAN DEFAULT TRUE,
    proxima_execucao TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, entidade_tipo) -- Uma configuração por cliente E entidade
);

-- Índices para config_periodicidade
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_cliente_id ON config_periodicidade(cliente_id);
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_entidade_tipo ON config_periodicidade(entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_cliente_entidade ON config_periodicidade(cliente_id, entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_ativo ON config_periodicidade(ativo) WHERE ativo = TRUE;
CREATE INDEX IF NOT EXISTS idx_config_periodicidade_proxima_execucao ON config_periodicidade(proxima_execucao);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_config_periodicidade_updated_at ON config_periodicidade;
CREATE TRIGGER update_config_periodicidade_updated_at
    BEFORE UPDATE ON config_periodicidade
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários nas tabelas
COMMENT ON TABLE controle_carga IS 'Controla o status de carga FULL e incremental por cliente e entidade';
COMMENT ON TABLE config_periodicidade IS 'Configuração de periodicidade por cliente e entidade (uso futuro)';

COMMENT ON COLUMN controle_carga.entidade_tipo IS 'Tipo da entidade: contas_pagar, contas_receber, vendas, contratos, notas_fiscais, centro_custos, categorias, categorias_dre, pessoas, produtos, servicos, vendedores, protocolos';
COMMENT ON COLUMN controle_carga.carga_full_realizada IS 'Indica se a carga FULL já foi realizada para este cliente e entidade';
COMMENT ON COLUMN controle_carga.ultima_data_processada IS 'Última data processada para controle incremental';

COMMENT ON COLUMN config_periodicidade.periodicidade_tipo IS 'Tipo de periodicidade: minuto, hora, dia, semana, mes';
COMMENT ON COLUMN config_periodicidade.periodicidade_valor IS 'Valor numérico da periodicidade (ex: 30 minutos, 2 horas, 1 dia)';


-- ============================================================================
-- Arquivo: schema-pessoas.sql
-- ============================================================================

-- Schema do Supabase para Tabela de Pessoas
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: pessoas
-- Armazena pessoas (clientes/fornecedores) coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS pessoas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    pessoa_id TEXT NOT NULL, -- ID da pessoa na API Conta Azul (campo 'id' do JSON)
    id_legado INTEGER, -- ID legado da pessoa
    uuid_legado TEXT, -- UUID legado da pessoa
    nome TEXT NOT NULL, -- Nome da pessoa
    documento TEXT, -- Documento da pessoa (CPF/CNPJ)
    email TEXT, -- Email da pessoa
    telefone TEXT, -- Telefone da pessoa
    tipo_pessoa TEXT, -- Tipo de pessoa (FISICA, JURIDICA, ESTRANGEIRA)
    ativo BOOLEAN DEFAULT TRUE, -- Indica se a pessoa está ativa
    codigo TEXT, -- Código da pessoa
    perfis TEXT[], -- Array de perfis (CLIENTE, FORNECEDOR, TRANSPORTADORA)
    data_alteracao TIMESTAMP WITH TIME ZONE, -- Data/hora da última alteração
    data_criacao TIMESTAMP WITH TIME ZONE, -- Data/hora de criação
    observacoes_gerais TEXT, -- Observações gerais sobre a pessoa
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, pessoa_id) -- Uma pessoa por cliente
);

-- Índices para pessoas
CREATE INDEX IF NOT EXISTS idx_pessoas_cliente_id ON pessoas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_pessoa_id ON pessoas(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_cliente_pessoa ON pessoas(cliente_id, pessoa_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_created_at ON pessoas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pessoas_nome ON pessoas(nome);
CREATE INDEX IF NOT EXISTS idx_pessoas_documento ON pessoas(documento);
CREATE INDEX IF NOT EXISTS idx_pessoas_email ON pessoas(email);
CREATE INDEX IF NOT EXISTS idx_pessoas_tipo_pessoa ON pessoas(tipo_pessoa);
CREATE INDEX IF NOT EXISTS idx_pessoas_ativo ON pessoas(ativo);
CREATE INDEX IF NOT EXISTS idx_pessoas_codigo ON pessoas(codigo);
CREATE INDEX IF NOT EXISTS idx_pessoas_data_alteracao ON pessoas(data_alteracao DESC);
CREATE INDEX IF NOT EXISTS idx_pessoas_data_criacao ON pessoas(data_criacao DESC);

-- Índice GIN para busca em perfis (array)
CREATE INDEX IF NOT EXISTS idx_pessoas_perfis ON pessoas USING GIN (perfis);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_pessoas_dados_originais ON pessoas USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_pessoas_updated_at ON pessoas;
CREATE TRIGGER update_pessoas_updated_at
    BEFORE UPDATE ON pessoas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE pessoas IS 'Armazena pessoas (clientes/fornecedores) coletadas da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN pessoas.pessoa_id IS 'ID da pessoa na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN pessoas.id_legado IS 'ID legado da pessoa (do sistema anterior)';
COMMENT ON COLUMN pessoas.uuid_legado IS 'UUID legado da pessoa';
COMMENT ON COLUMN pessoas.nome IS 'Nome da pessoa (física, jurídica ou estrangeira)';
COMMENT ON COLUMN pessoas.documento IS 'Documento da pessoa (CPF/CNPJ)';
COMMENT ON COLUMN pessoas.email IS 'Email da pessoa';
COMMENT ON COLUMN pessoas.telefone IS 'Telefone da pessoa';
COMMENT ON COLUMN pessoas.tipo_pessoa IS 'Tipo de pessoa: FISICA, JURIDICA ou ESTRANGEIRA';
COMMENT ON COLUMN pessoas.ativo IS 'Indica se a pessoa está ativa ou inativa';
COMMENT ON COLUMN pessoas.codigo IS 'Código da pessoa';
COMMENT ON COLUMN pessoas.perfis IS 'Array de perfis associados à pessoa (CLIENTE, FORNECEDOR, TRANSPORTADORA)';
COMMENT ON COLUMN pessoas.data_alteracao IS 'Data/hora da última alteração da pessoa na API';
COMMENT ON COLUMN pessoas.data_criacao IS 'Data/hora de criação da pessoa na API';
COMMENT ON COLUMN pessoas.observacoes_gerais IS 'Observações gerais sobre a pessoa';
COMMENT ON COLUMN pessoas.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';



-- ============================================================================
-- Arquivo: schema-categorias.sql
-- ============================================================================

-- Schema do Supabase para Tabela de Categorias
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: categorias
-- Armazena categorias coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    categoria_id TEXT NOT NULL, -- ID da categoria na API Conta Azul (campo 'id' do JSON)
    versao INTEGER, -- Versão da categoria
    nome TEXT NOT NULL, -- Nome da categoria
    categoria_pai TEXT, -- ID da categoria pai na API (categoria_id). Null se for categoria raiz
    tipo TEXT CHECK (tipo IS NULL OR tipo IN ('RECEITA', 'DESPESA')), -- Tipo da categoria: RECEITA ou DESPESA
    entrada_dre TEXT, -- Entrada na DRE
    considera_custo_dre BOOLEAN DEFAULT FALSE, -- Se considera custo na DRE
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, categoria_id) -- Uma categoria por cliente
);

-- Índices para categorias
CREATE INDEX IF NOT EXISTS idx_categorias_cliente_id ON categorias(cliente_id);
CREATE INDEX IF NOT EXISTS idx_categorias_categoria_id ON categorias(categoria_id);
CREATE INDEX IF NOT EXISTS idx_categorias_cliente_categoria ON categorias(cliente_id, categoria_id);
CREATE INDEX IF NOT EXISTS idx_categorias_created_at ON categorias(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categorias_nome ON categorias(nome);
CREATE INDEX IF NOT EXISTS idx_categorias_tipo ON categorias(tipo);
CREATE INDEX IF NOT EXISTS idx_categorias_categoria_pai ON categorias(cliente_id, categoria_pai) WHERE categoria_pai IS NOT NULL;

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_categorias_dados_originais ON categorias USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_categorias_updated_at ON categorias;
CREATE TRIGGER update_categorias_updated_at
    BEFORE UPDATE ON categorias
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE categorias IS 'Armazena categorias coletadas da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN categorias.categoria_id IS 'ID da categoria na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN categorias.versao IS 'Versão da categoria retornada pela API';
COMMENT ON COLUMN categorias.nome IS 'Nome da categoria';
COMMENT ON COLUMN categorias.categoria_pai IS 'ID da categoria pai na API (categoria_id). Null se for categoria raiz. Permite hierarquia de categorias';
COMMENT ON COLUMN categorias.tipo IS 'Tipo da categoria: RECEITA ou DESPESA';
COMMENT ON COLUMN categorias.entrada_dre IS 'Entrada na Demonstração do Resultado do Exercício (DRE)';
COMMENT ON COLUMN categorias.considera_custo_dre IS 'Indica se a categoria considera custo na DRE';
COMMENT ON COLUMN categorias.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';


-- ============================================================================
-- Arquivo: schema-categorias-dre.sql
-- ============================================================================

-- Schema do Supabase para Tabela de Categorias DRE
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: categorias_dre
-- Armazena categorias DRE coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS categorias_dre (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    categoria_dre_id TEXT NOT NULL, -- ID da categoria DRE na API Conta Azul (campo 'id' do JSON)
    descricao TEXT NOT NULL, -- Descrição do item
    codigo TEXT, -- Código de identificação do item
    posicao INTEGER, -- Ordem de posicionamento do item na estrutura
    indica_totalizador BOOLEAN DEFAULT FALSE, -- Indica se o item é um totalizador de subitens
    representa_soma_custo_medio BOOLEAN DEFAULT FALSE, -- Indica se o item representa a soma do custo médio do produto
    categoria_dre_pai_id TEXT, -- ID do item pai (null se for item raiz)
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup) - inclui subitens e categorias_financeiras
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, categoria_dre_id) -- Uma categoria DRE por cliente
);

-- Índices para categorias_dre
CREATE INDEX IF NOT EXISTS idx_categorias_dre_cliente_id ON categorias_dre(cliente_id);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_categoria_dre_id ON categorias_dre(categoria_dre_id);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_cliente_categoria ON categorias_dre(cliente_id, categoria_dre_id);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_created_at ON categorias_dre(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_descricao ON categorias_dre(descricao);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_codigo ON categorias_dre(codigo);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_posicao ON categorias_dre(posicao);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_indica_totalizador ON categorias_dre(indica_totalizador);
CREATE INDEX IF NOT EXISTS idx_categorias_dre_categoria_dre_pai_id ON categorias_dre(categoria_dre_pai_id);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_categorias_dre_dados_originais ON categorias_dre USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_categorias_dre_updated_at ON categorias_dre;
CREATE TRIGGER update_categorias_dre_updated_at
    BEFORE UPDATE ON categorias_dre
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE categorias_dre IS 'Armazena categorias DRE coletadas da API Conta Azul com colunas específicas para facilitar consultas e análises. A hierarquia completa é mantida em dados_originais.';
COMMENT ON COLUMN categorias_dre.categoria_dre_id IS 'ID da categoria DRE na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN categorias_dre.descricao IS 'Descrição do item da categoria DRE';
COMMENT ON COLUMN categorias_dre.codigo IS 'Código de identificação do item';
COMMENT ON COLUMN categorias_dre.posicao IS 'Ordem de posicionamento do item na estrutura DRE';
COMMENT ON COLUMN categorias_dre.indica_totalizador IS 'Indica se o item é um totalizador de subitens';
COMMENT ON COLUMN categorias_dre.representa_soma_custo_medio IS 'Indica se o item representa a soma do custo médio do produto';
COMMENT ON COLUMN categorias_dre.categoria_dre_pai_id IS 'ID do item pai (null se for item raiz). Permite hierarquia de categorias DRE';
COMMENT ON COLUMN categorias_dre.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura hierárquica (incluindo subitens e categorias_financeiras)';



-- ============================================================================
-- Arquivo: schema-centro-custos.sql
-- ============================================================================

-- Schema do Supabase para Tabela de Centro de Custos
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: centro_custos
-- Armazena centros de custo coletados da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS centro_custos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    centro_custo_id TEXT NOT NULL, -- ID do centro de custo na API Conta Azul (campo 'id' do JSON)
    codigo TEXT, -- Código do centro de custo
    nome TEXT NOT NULL, -- Nome do centro de custo
    ativo BOOLEAN DEFAULT TRUE, -- Indica se o centro de custo está ativo
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, centro_custo_id) -- Um centro de custo por cliente
);

-- Índices para centro_custos
CREATE INDEX IF NOT EXISTS idx_centro_custos_cliente_id ON centro_custos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_centro_custos_centro_custo_id ON centro_custos(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_centro_custos_cliente_centro_custo ON centro_custos(cliente_id, centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_centro_custos_created_at ON centro_custos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_centro_custos_nome ON centro_custos(nome);
CREATE INDEX IF NOT EXISTS idx_centro_custos_codigo ON centro_custos(codigo);
CREATE INDEX IF NOT EXISTS idx_centro_custos_ativo ON centro_custos(ativo);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_centro_custos_dados_originais ON centro_custos USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_centro_custos_updated_at ON centro_custos;
CREATE TRIGGER update_centro_custos_updated_at
    BEFORE UPDATE ON centro_custos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE centro_custos IS 'Armazena centros de custo coletados da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN centro_custos.centro_custo_id IS 'ID do centro de custo na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN centro_custos.codigo IS 'Código do centro de custo';
COMMENT ON COLUMN centro_custos.nome IS 'Nome do centro de custo';
COMMENT ON COLUMN centro_custos.ativo IS 'Indica se o centro de custo está ativo';
COMMENT ON COLUMN centro_custos.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';



-- ============================================================================
-- Arquivo: schema-produtos.sql
-- ============================================================================

-- Schema do Supabase para Tabela de Produtos
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: produtos
-- Armazena produtos coletados da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS produtos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    produto_id TEXT NOT NULL, -- ID do produto na API Conta Azul (campo 'id' do JSON)
    codigo TEXT, -- Código do produto
    nome TEXT NOT NULL, -- Nome do produto
    ean TEXT, -- EAN do produto
    sku TEXT, -- SKU do produto
    status TEXT, -- Status do produto (ATIVO, INATIVO)
    tipo TEXT, -- Tipo do produto
    custo_medio NUMERIC, -- Custo médio do produto
    estoque_minimo NUMERIC, -- Estoque mínimo
    estoque_maximo NUMERIC, -- Estoque máximo
    saldo NUMERIC, -- Saldo atual do produto
    valor_venda NUMERIC, -- Valor de venda do produto
    id_legado INTEGER, -- ID legado do produto
    integracao_ecommerce_ativada BOOLEAN DEFAULT FALSE, -- Se integração com ecommerce está ativada
    movido BOOLEAN DEFAULT FALSE, -- Indica se o produto foi movido
    nivel_estoque TEXT, -- Nível de estoque (PADRAO, MINIMO, MAXIMO, etc)
    ultima_atualizacao TIMESTAMP WITH TIME ZONE, -- Data da última atualização do produto
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, produto_id) -- Um produto por cliente
);

-- Índices para produtos
CREATE INDEX IF NOT EXISTS idx_produtos_cliente_id ON produtos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_produtos_produto_id ON produtos(produto_id);
CREATE INDEX IF NOT EXISTS idx_produtos_cliente_produto ON produtos(cliente_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_produtos_created_at ON produtos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_produtos_nome ON produtos(nome);
CREATE INDEX IF NOT EXISTS idx_produtos_codigo ON produtos(codigo);
CREATE INDEX IF NOT EXISTS idx_produtos_ean ON produtos(ean);
CREATE INDEX IF NOT EXISTS idx_produtos_sku ON produtos(sku);
CREATE INDEX IF NOT EXISTS idx_produtos_status ON produtos(status);
CREATE INDEX IF NOT EXISTS idx_produtos_tipo ON produtos(tipo);
CREATE INDEX IF NOT EXISTS idx_produtos_ultima_atualizacao ON produtos(ultima_atualizacao DESC);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_produtos_dados_originais ON produtos USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_produtos_updated_at ON produtos;
CREATE TRIGGER update_produtos_updated_at
    BEFORE UPDATE ON produtos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE produtos IS 'Armazena produtos coletados da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN produtos.produto_id IS 'ID do produto na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN produtos.codigo IS 'Código do produto';
COMMENT ON COLUMN produtos.nome IS 'Nome do produto';
COMMENT ON COLUMN produtos.ean IS 'EAN (European Article Number) do produto';
COMMENT ON COLUMN produtos.sku IS 'SKU (Stock Keeping Unit) do produto';
COMMENT ON COLUMN produtos.status IS 'Status do produto: ATIVO ou INATIVO';
COMMENT ON COLUMN produtos.tipo IS 'Tipo do produto';
COMMENT ON COLUMN produtos.custo_medio IS 'Custo médio do produto';
COMMENT ON COLUMN produtos.estoque_minimo IS 'Estoque mínimo configurado para o produto';
COMMENT ON COLUMN produtos.estoque_maximo IS 'Estoque máximo configurado para o produto';
COMMENT ON COLUMN produtos.saldo IS 'Saldo atual do produto em estoque';
COMMENT ON COLUMN produtos.valor_venda IS 'Valor de venda do produto';
COMMENT ON COLUMN produtos.id_legado IS 'ID legado do produto (do sistema anterior)';
COMMENT ON COLUMN produtos.integracao_ecommerce_ativada IS 'Indica se a integração com ecommerce está ativada para este produto';
COMMENT ON COLUMN produtos.movido IS 'Indica se o produto foi movido';
COMMENT ON COLUMN produtos.nivel_estoque IS 'Nível atual de estoque (PADRAO, MINIMO, MAXIMO, etc)';
COMMENT ON COLUMN produtos.ultima_atualizacao IS 'Data da última atualização do produto na API';
COMMENT ON COLUMN produtos.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';


-- ============================================================================
-- Arquivo: schema-servicos.sql
-- ============================================================================

-- Schema do Supabase para Tabela de Serviços
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: servicos
-- Armazena serviços coletados da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS servicos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    servico_id TEXT NOT NULL, -- ID do serviço na API Conta Azul (campo 'id' do JSON)
    codigo TEXT, -- Código interno do serviço
    descricao TEXT NOT NULL, -- Descrição do serviço
    codigo_cnae TEXT, -- Código CNAE do serviço
    codigo_municipio_servico TEXT, -- Código do município onde o serviço é prestado
    custo NUMERIC, -- Custo do serviço
    preco NUMERIC, -- Preço de venda do serviço
    status TEXT CHECK (status IS NULL OR status IN ('ATIVO', 'INATIVO')), -- Status do serviço (ATIVO/INATIVO)
    tipo_servico TEXT CHECK (tipo_servico IS NULL OR tipo_servico IN ('PRESTADO', 'TOMADO', 'AMBOS')), -- Tipo do serviço (PRESTADO/TOMADO/AMBOS)
    id_servico INTEGER, -- ID do serviço no sistema legado
    id_externo TEXT, -- ID externo do serviço
    lei_116 TEXT, -- Lei 116 associada ao serviço
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, servico_id) -- Um serviço por cliente
);

-- Índices para servicos
CREATE INDEX IF NOT EXISTS idx_servicos_cliente_id ON servicos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_servicos_servico_id ON servicos(servico_id);
CREATE INDEX IF NOT EXISTS idx_servicos_cliente_servico ON servicos(cliente_id, servico_id);
CREATE INDEX IF NOT EXISTS idx_servicos_created_at ON servicos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_servicos_descricao ON servicos(descricao);
CREATE INDEX IF NOT EXISTS idx_servicos_codigo ON servicos(codigo);
CREATE INDEX IF NOT EXISTS idx_servicos_codigo_cnae ON servicos(codigo_cnae);
CREATE INDEX IF NOT EXISTS idx_servicos_status ON servicos(status);
CREATE INDEX IF NOT EXISTS idx_servicos_tipo_servico ON servicos(tipo_servico);
CREATE INDEX IF NOT EXISTS idx_servicos_id_servico ON servicos(id_servico);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_servicos_dados_originais ON servicos USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_servicos_updated_at ON servicos;
CREATE TRIGGER update_servicos_updated_at
    BEFORE UPDATE ON servicos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE servicos IS 'Armazena serviços coletados da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN servicos.servico_id IS 'ID do serviço na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN servicos.codigo IS 'Código interno do serviço';
COMMENT ON COLUMN servicos.descricao IS 'Descrição detalhada do serviço';
COMMENT ON COLUMN servicos.codigo_cnae IS 'Código CNAE do serviço';
COMMENT ON COLUMN servicos.codigo_municipio_servico IS 'Código do município onde o serviço é prestado';
COMMENT ON COLUMN servicos.custo IS 'Custo do serviço';
COMMENT ON COLUMN servicos.preco IS 'Preço de venda do serviço';
COMMENT ON COLUMN servicos.status IS 'Status do serviço: ATIVO ou INATIVO';
COMMENT ON COLUMN servicos.tipo_servico IS 'Tipo do serviço: PRESTADO, TOMADO ou AMBOS';
COMMENT ON COLUMN servicos.id_servico IS 'ID do serviço no sistema legado';
COMMENT ON COLUMN servicos.id_externo IS 'ID externo do serviço';
COMMENT ON COLUMN servicos.lei_116 IS 'Lei 116 associada ao serviço';
COMMENT ON COLUMN servicos.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';



-- ============================================================================
-- Arquivo: schema-vendedores.sql
-- ============================================================================

-- Schema do Supabase para Tabela de Vendedores
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: vendedores
-- Armazena vendedores coletados da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS vendedores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    vendedor_id TEXT NOT NULL, -- ID do vendedor na API Conta Azul (campo 'id' do JSON)
    nome TEXT NOT NULL, -- Nome do vendedor
    id_legado INTEGER, -- ID legado do vendedor
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, vendedor_id) -- Um vendedor por cliente
);

-- Índices para vendedores
CREATE INDEX IF NOT EXISTS idx_vendedores_cliente_id ON vendedores(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendedores_vendedor_id ON vendedores(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_vendedores_cliente_vendedor ON vendedores(cliente_id, vendedor_id);
CREATE INDEX IF NOT EXISTS idx_vendedores_created_at ON vendedores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendedores_nome ON vendedores(nome);
CREATE INDEX IF NOT EXISTS idx_vendedores_id_legado ON vendedores(id_legado);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_vendedores_dados_originais ON vendedores USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_vendedores_updated_at ON vendedores;
CREATE TRIGGER update_vendedores_updated_at
    BEFORE UPDATE ON vendedores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE vendedores IS 'Armazena vendedores coletados da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN vendedores.vendedor_id IS 'ID do vendedor na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN vendedores.nome IS 'Nome do vendedor';
COMMENT ON COLUMN vendedores.id_legado IS 'ID legado do vendedor (do sistema anterior)';
COMMENT ON COLUMN vendedores.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';



-- ============================================================================
-- Arquivo: schema-contas-financeiras.sql
-- ============================================================================

-- Schema do Supabase para Tabela de Contas Financeiras
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: contas_financeiras
-- Armazena contas financeiras coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS contas_financeiras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    conta_financeira_id TEXT NOT NULL, -- ID da conta financeira na API Conta Azul (campo 'id' do JSON)
    nome TEXT, -- Nome da conta financeira
    tipo TEXT, -- Tipo da conta (APLICACAO, CAIXINHA, CONTA_CORRENTE, CARTAO_CREDITO, INVESTIMENTO, OUTROS, MEIOS_RECEBIMENTO, POUPANCA, COBRANCAS_CONTA_AZUL, RECEBA_FACIL_CARTAO)
    banco TEXT, -- Instituição bancária
    codigo_banco INTEGER, -- Código da instituição bancária
    ativo BOOLEAN, -- Indica se a conta está ativa
    conta_padrao BOOLEAN, -- Indica se é a conta padrão
    possui_config_boleto_bancario BOOLEAN, -- Indica se a conta possui configuração de boleto bancário
    agencia TEXT, -- Agência da conta
    numero TEXT, -- Número da conta
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, conta_financeira_id) -- Uma conta financeira por cliente
);

-- Índices para contas_financeiras
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_cliente_id ON contas_financeiras(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_conta_financeira_id ON contas_financeiras(conta_financeira_id);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_cliente_conta ON contas_financeiras(cliente_id, conta_financeira_id);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_created_at ON contas_financeiras(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_tipo ON contas_financeiras(tipo);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_ativo ON contas_financeiras(ativo);
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_conta_padrao ON contas_financeiras(conta_padrao);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_contas_financeiras_dados_originais ON contas_financeiras USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_contas_financeiras_updated_at ON contas_financeiras;
CREATE TRIGGER update_contas_financeiras_updated_at
    BEFORE UPDATE ON contas_financeiras
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE contas_financeiras IS 'Armazena contas financeiras coletadas da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN contas_financeiras.conta_financeira_id IS 'ID da conta financeira na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN contas_financeiras.nome IS 'Nome da conta financeira';
COMMENT ON COLUMN contas_financeiras.tipo IS 'Tipo da conta: APLICACAO, CAIXINHA, CONTA_CORRENTE, CARTAO_CREDITO, INVESTIMENTO, OUTROS, MEIOS_RECEBIMENTO, POUPANCA, COBRANCAS_CONTA_AZUL, RECEBA_FACIL_CARTAO';
COMMENT ON COLUMN contas_financeiras.banco IS 'Instituição bancária';
COMMENT ON COLUMN contas_financeiras.codigo_banco IS 'Código da instituição bancária';
COMMENT ON COLUMN contas_financeiras.ativo IS 'Indica se a conta está ativa';
COMMENT ON COLUMN contas_financeiras.conta_padrao IS 'Indica se é a conta padrão';
COMMENT ON COLUMN contas_financeiras.possui_config_boleto_bancario IS 'Indica se a conta possui configuração de boleto bancário';
COMMENT ON COLUMN contas_financeiras.agencia IS 'Agência da conta';
COMMENT ON COLUMN contas_financeiras.numero IS 'Número da conta';
COMMENT ON COLUMN contas_financeiras.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';



-- ============================================================================
-- Arquivo: schema-contas-pagar.sql
-- ============================================================================

-- Schema do Supabase para Tabela de Contas a Pagar
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: contas_pagar
-- Armazena contas a pagar coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS contas_pagar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    conta_pagar_id TEXT NOT NULL, -- ID da conta a pagar na API Conta Azul (campo 'id' do JSON)
    descricao TEXT, -- Descrição da conta a pagar
    data_vencimento DATE, -- Data de vencimento da conta
    status TEXT, -- Status da conta (OVERDUE, PAID, etc.)
    status_traduzido TEXT, -- Status traduzido (ATRASADO, RECEBIDO, EM_ABERTO, RENEGOCIADO, RECEBIDO_PARCIAL, PERDIDO)
    total NUMERIC(15,2), -- Valor total da conta
    nao_pago NUMERIC(15,2), -- Valor não pago
    pago NUMERIC(15,2), -- Valor pago
    data_criacao TIMESTAMP WITH TIME ZONE, -- Data/hora de criação
    data_alteracao TIMESTAMP WITH TIME ZONE, -- Data/hora da última alteração
    fornecedor_id TEXT, -- ID do fornecedor (do objeto fornecedor)
    fornecedor_nome TEXT, -- Nome do fornecedor (do objeto fornecedor)
    detalhado BOOLEAN DEFAULT FALSE, -- Indica se já foi detalhado (busca de rateio, categoria, centro de custo)
    data_detalhamento TIMESTAMP WITH TIME ZONE, -- Data/hora do último detalhamento
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, conta_pagar_id) -- Uma conta a pagar por cliente
);

-- Índices para contas_pagar
CREATE INDEX IF NOT EXISTS idx_contas_pagar_cliente_id ON contas_pagar(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_conta_pagar_id ON contas_pagar(conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_cliente_conta_pagar ON contas_pagar(cliente_id, conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_created_at ON contas_pagar(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_vencimento ON contas_pagar(data_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status ON contas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_status_traduzido ON contas_pagar(status_traduzido);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_criacao ON contas_pagar(data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_alteracao ON contas_pagar(data_alteracao DESC);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_fornecedor_id ON contas_pagar(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_fornecedor_nome ON contas_pagar(fornecedor_nome);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhado ON contas_pagar(detalhado);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_cliente_detalhado ON contas_pagar(cliente_id, detalhado);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_data_detalhamento ON contas_pagar(data_detalhamento DESC);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_contas_pagar_dados_originais ON contas_pagar USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_contas_pagar_updated_at ON contas_pagar;
CREATE TRIGGER update_contas_pagar_updated_at
    BEFORE UPDATE ON contas_pagar
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE contas_pagar IS 'Armazena contas a pagar coletadas da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN contas_pagar.conta_pagar_id IS 'ID da conta a pagar na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN contas_pagar.descricao IS 'Descrição da conta a pagar';
COMMENT ON COLUMN contas_pagar.data_vencimento IS 'Data de vencimento da conta';
COMMENT ON COLUMN contas_pagar.status IS 'Status da conta na API (OVERDUE, PAID, etc.)';
COMMENT ON COLUMN contas_pagar.status_traduzido IS 'Status traduzido: ATRASADO, RECEBIDO, EM_ABERTO, RENEGOCIADO, RECEBIDO_PARCIAL, PERDIDO';
COMMENT ON COLUMN contas_pagar.total IS 'Valor total da conta';
COMMENT ON COLUMN contas_pagar.nao_pago IS 'Valor não pago da conta';
COMMENT ON COLUMN contas_pagar.pago IS 'Valor pago da conta';
COMMENT ON COLUMN contas_pagar.data_criacao IS 'Data/hora de criação da conta na API';
COMMENT ON COLUMN contas_pagar.data_alteracao IS 'Data/hora da última alteração da conta na API';
COMMENT ON COLUMN contas_pagar.fornecedor_id IS 'ID do fornecedor (extraído do objeto fornecedor)';
COMMENT ON COLUMN contas_pagar.fornecedor_nome IS 'Nome do fornecedor (extraído do objeto fornecedor)';
COMMENT ON COLUMN contas_pagar.detalhado IS 'Indica se a parcela já foi detalhada (busca de rateio, categoria e centro de custo via GET /v1/financeiro/eventos-financeiros/parcelas/{id}). Resetado para FALSE quando dados básicos mudam na coleta incremental.';
COMMENT ON COLUMN contas_pagar.data_detalhamento IS 'Data/hora do último detalhamento. Limpado quando detalhado é resetado para FALSE.';
COMMENT ON COLUMN contas_pagar.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro. Detalhamento completo de parcelas (rateio, categoria, centro de custo) é armazenado na tabela parcelas_detalhes.';



-- ============================================================================
-- Arquivo: schema-contas-receber.sql
-- ============================================================================

-- Schema do Supabase para Tabela de Contas a Receber
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: contas_receber
-- Armazena contas a receber coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS contas_receber (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    conta_receber_id TEXT NOT NULL, -- ID da conta a receber na API Conta Azul (campo 'id' do JSON)
    descricao TEXT, -- Descrição da conta a receber
    data_vencimento DATE, -- Data de vencimento da conta
    status TEXT, -- Status da conta (OVERDUE, PAID, etc.)
    status_traduzido TEXT, -- Status traduzido (PERDIDO, RECEBIDO, EM_ABERTO, RENEGOCIADO, RECEBIDO_PARCIAL, ATRASADO)
    total NUMERIC(15,2), -- Valor total da conta
    nao_pago NUMERIC(15,2), -- Valor não pago
    pago NUMERIC(15,2), -- Valor pago
    data_criacao TIMESTAMP WITH TIME ZONE, -- Data/hora de criação
    data_alteracao TIMESTAMP WITH TIME ZONE, -- Data/hora da última alteração
    cliente_conta_id TEXT, -- ID do cliente (do objeto cliente)
    cliente_conta_nome TEXT, -- Nome do cliente (do objeto cliente)
    detalhado BOOLEAN DEFAULT FALSE, -- Indica se já foi detalhado (busca de rateio, categoria, centro de custo)
    data_detalhamento TIMESTAMP WITH TIME ZONE, -- Data/hora do último detalhamento
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, conta_receber_id) -- Uma conta a receber por cliente
);

-- Índices para contas_receber
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente_id ON contas_receber(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_conta_receber_id ON contas_receber(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente_conta_receber ON contas_receber(cliente_id, conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_created_at ON contas_receber(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contas_receber_data_vencimento ON contas_receber(data_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_contas_receber_status ON contas_receber(status);
CREATE INDEX IF NOT EXISTS idx_contas_receber_status_traduzido ON contas_receber(status_traduzido);
CREATE INDEX IF NOT EXISTS idx_contas_receber_data_criacao ON contas_receber(data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_contas_receber_data_alteracao ON contas_receber(data_alteracao DESC);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente_conta_id ON contas_receber(cliente_conta_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente_conta_nome ON contas_receber(cliente_conta_nome);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhado ON contas_receber(detalhado);
CREATE INDEX IF NOT EXISTS idx_contas_receber_cliente_detalhado ON contas_receber(cliente_id, detalhado);
CREATE INDEX IF NOT EXISTS idx_contas_receber_data_detalhamento ON contas_receber(data_detalhamento DESC);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_contas_receber_dados_originais ON contas_receber USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_contas_receber_updated_at ON contas_receber;
CREATE TRIGGER update_contas_receber_updated_at
    BEFORE UPDATE ON contas_receber
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE contas_receber IS 'Armazena contas a receber coletadas da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN contas_receber.conta_receber_id IS 'ID da conta a receber na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN contas_receber.descricao IS 'Descrição da conta a receber';
COMMENT ON COLUMN contas_receber.data_vencimento IS 'Data de vencimento da conta';
COMMENT ON COLUMN contas_receber.status IS 'Status da conta na API (OVERDUE, PAID, etc.)';
COMMENT ON COLUMN contas_receber.status_traduzido IS 'Status traduzido: PERDIDO, RECEBIDO, EM_ABERTO, RENEGOCIADO, RECEBIDO_PARCIAL, ATRASADO';
COMMENT ON COLUMN contas_receber.total IS 'Valor total da conta';
COMMENT ON COLUMN contas_receber.nao_pago IS 'Valor não pago da conta';
COMMENT ON COLUMN contas_receber.pago IS 'Valor pago da conta';
COMMENT ON COLUMN contas_receber.data_criacao IS 'Data/hora de criação da conta na API';
COMMENT ON COLUMN contas_receber.data_alteracao IS 'Data/hora da última alteração da conta na API';
COMMENT ON COLUMN contas_receber.cliente_conta_id IS 'ID do cliente (extraído do objeto cliente)';
COMMENT ON COLUMN contas_receber.cliente_conta_nome IS 'Nome do cliente (extraído do objeto cliente)';
COMMENT ON COLUMN contas_receber.detalhado IS 'Indica se a parcela já foi detalhada (busca de rateio, categoria e centro de custo via GET /v1/financeiro/eventos-financeiros/parcelas/{id}). Resetado para FALSE quando dados básicos mudam na coleta incremental.';
COMMENT ON COLUMN contas_receber.data_detalhamento IS 'Data/hora do último detalhamento. Limpado quando detalhado é resetado para FALSE.';
COMMENT ON COLUMN contas_receber.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro. Detalhamento completo de parcelas (rateio, categoria, centro de custo) é armazenado na tabela parcelas_detalhes.';



-- ============================================================================
-- Arquivo: schema-vendas.sql
-- ============================================================================

-- Schema do Supabase para Tabela de Vendas
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: vendas
-- Armazena vendas coletadas da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS vendas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    venda_id TEXT NOT NULL, -- ID da venda na API Conta Azul (campo 'id' do JSON)
    numero INTEGER, -- Número da venda
    data DATE, -- Data da venda (data de emissão)
    data_inicio DATE, -- Data de início da venda (pode ser igual a data)
    total NUMERIC(15,2), -- Valor total da venda
    tipo TEXT, -- Tipo da venda (PRODUTO, SERVICO, etc.)
    itens TEXT, -- Tipo de itens (PRODUTO, SERVICO, etc.)
    situacao TEXT, -- Situação da venda (extraído do objeto situacao)
    condicao_pagamento BOOLEAN, -- Condição de pagamento
    id_legado INTEGER, -- ID legado da venda
    cliente_venda_id TEXT, -- ID do cliente (extraído do objeto cliente)
    cliente_venda_nome TEXT, -- Nome do cliente (extraído do objeto cliente)
    vendedor_id TEXT, -- ID do vendedor (se disponível)
    vendedor_nome TEXT, -- Nome do vendedor (se disponível)
    data_criacao TIMESTAMP WITH TIME ZONE, -- Data/hora de criação (criado_em)
    data_alteracao TIMESTAMP WITH TIME ZONE, -- Data/hora da última alteração
    versao INTEGER, -- Versão da venda
    itens_detalhados BOOLEAN DEFAULT FALSE, -- Indica se os itens da venda já foram detalhados (busca de itens via GET /v1/venda/{id_venda}/itens)
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, venda_id) -- Uma venda por cliente
);

-- Índices para vendas
CREATE INDEX IF NOT EXISTS idx_vendas_cliente_id ON vendas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_venda_id ON vendas(venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente_venda_id ON vendas(cliente_id, venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_created_at ON vendas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(data DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_data_inicio ON vendas(data_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_numero ON vendas(numero);
CREATE INDEX IF NOT EXISTS idx_vendas_tipo ON vendas(tipo);
CREATE INDEX IF NOT EXISTS idx_vendas_situacao ON vendas(situacao);
CREATE INDEX IF NOT EXISTS idx_vendas_data_criacao ON vendas(data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_data_alteracao ON vendas(data_alteracao DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente_venda_id ON vendas(cliente_venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente_venda_nome ON vendas(cliente_venda_nome);
CREATE INDEX IF NOT EXISTS idx_vendas_vendedor_id ON vendas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_detalhados ON vendas(itens_detalhados) WHERE itens_detalhados = FALSE;
CREATE INDEX IF NOT EXISTS idx_vendas_cliente_itens_detalhados ON vendas(cliente_id, itens_detalhados) WHERE itens_detalhados = FALSE;

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_vendas_dados_originais ON vendas USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_vendas_updated_at ON vendas;
CREATE TRIGGER update_vendas_updated_at
    BEFORE UPDATE ON vendas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE vendas IS 'Armazena vendas coletadas da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN vendas.venda_id IS 'ID da venda na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN vendas.numero IS 'Número da venda';
COMMENT ON COLUMN vendas.data IS 'Data da venda (data de emissão)';
COMMENT ON COLUMN vendas.data_inicio IS 'Data de início da venda (pode ser igual a data)';
COMMENT ON COLUMN vendas.total IS 'Valor total da venda';
COMMENT ON COLUMN vendas.tipo IS 'Tipo da venda (PRODUTO, SERVICO, etc.)';
COMMENT ON COLUMN vendas.itens IS 'Tipo de itens (PRODUTO, SERVICO, etc.)';
COMMENT ON COLUMN vendas.situacao IS 'Situação da venda (extraído do objeto situacao)';
COMMENT ON COLUMN vendas.condicao_pagamento IS 'Condição de pagamento';
COMMENT ON COLUMN vendas.id_legado IS 'ID legado da venda';
COMMENT ON COLUMN vendas.cliente_venda_id IS 'ID do cliente (extraído do objeto cliente)';
COMMENT ON COLUMN vendas.cliente_venda_nome IS 'Nome do cliente (extraído do objeto cliente)';
COMMENT ON COLUMN vendas.vendedor_id IS 'ID do vendedor (se disponível)';
COMMENT ON COLUMN vendas.vendedor_nome IS 'Nome do vendedor (se disponível)';
COMMENT ON COLUMN vendas.data_criacao IS 'Data/hora de criação da venda na API (criado_em)';
COMMENT ON COLUMN vendas.data_alteracao IS 'Data/hora da última alteração da venda na API';
COMMENT ON COLUMN vendas.versao IS 'Versão da venda';
COMMENT ON COLUMN vendas.itens_detalhados IS 'Indica se os itens da venda já foram detalhados (busca de itens via GET /v1/venda/{id_venda}/itens). Resetado para FALSE quando dados básicos da venda mudam na coleta incremental.';
COMMENT ON COLUMN vendas.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';



-- ============================================================================
-- Arquivo: schema-contratos.sql
-- ============================================================================

-- Schema do Supabase para Tabela de Contratos
-- Armazena dados coletados da API Conta Azul

-- ============================================
-- TABELA: contratos
-- Armazena contratos coletados da API Conta Azul
-- ============================================
CREATE TABLE IF NOT EXISTS contratos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    contrato_id TEXT NOT NULL, -- ID do contrato na API Conta Azul (campo 'id' do JSON)
    numero INTEGER, -- Número do contrato
    data_inicio DATE, -- Data de início do contrato
    status TEXT, -- Status do contrato (ATIVO, INATIVO)
    proximo_vencimento DATE, -- Data do próximo vencimento
    cliente_contrato_id TEXT, -- ID do cliente (extraído do objeto cliente)
    cliente_contrato_nome TEXT, -- Nome do cliente (extraído do objeto cliente)
    data_criacao TIMESTAMP WITH TIME ZONE, -- Data/hora de criação
    data_alteracao TIMESTAMP WITH TIME ZONE, -- Data/hora da última alteração
    versao INTEGER, -- Versão do contrato
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, contrato_id) -- Um contrato por cliente
);

-- Índices para contratos
CREATE INDEX IF NOT EXISTS idx_contratos_cliente_id ON contratos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contratos_contrato_id ON contratos(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contratos_cliente_contrato_id ON contratos(cliente_id, contrato_id);
CREATE INDEX IF NOT EXISTS idx_contratos_created_at ON contratos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_data_inicio ON contratos(data_inicio DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_numero ON contratos(numero);
CREATE INDEX IF NOT EXISTS idx_contratos_status ON contratos(status);
CREATE INDEX IF NOT EXISTS idx_contratos_proximo_vencimento ON contratos(proximo_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_data_criacao ON contratos(data_criacao DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_data_alteracao ON contratos(data_alteracao DESC);
CREATE INDEX IF NOT EXISTS idx_contratos_cliente_contrato_id_field ON contratos(cliente_contrato_id);
CREATE INDEX IF NOT EXISTS idx_contratos_cliente_contrato_nome ON contratos(cliente_contrato_nome);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_contratos_dados_originais ON contratos USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_contratos_updated_at ON contratos;
CREATE TRIGGER update_contratos_updated_at
    BEFORE UPDATE ON contratos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE contratos IS 'Armazena contratos coletados da API Conta Azul com colunas específicas para facilitar consultas e análises';
COMMENT ON COLUMN contratos.contrato_id IS 'ID do contrato na API Conta Azul (campo id do JSON retornado)';
COMMENT ON COLUMN contratos.numero IS 'Número do contrato';
COMMENT ON COLUMN contratos.data_inicio IS 'Data de início do contrato';
COMMENT ON COLUMN contratos.status IS 'Status do contrato (ATIVO, INATIVO)';
COMMENT ON COLUMN contratos.proximo_vencimento IS 'Data do próximo vencimento do contrato';
COMMENT ON COLUMN contratos.cliente_contrato_id IS 'ID do cliente (extraído do objeto cliente)';
COMMENT ON COLUMN contratos.cliente_contrato_nome IS 'Nome do cliente (extraído do objeto cliente)';
COMMENT ON COLUMN contratos.data_criacao IS 'Data/hora de criação do contrato na API';
COMMENT ON COLUMN contratos.data_alteracao IS 'Data/hora da última alteração do contrato na API';
COMMENT ON COLUMN contratos.versao IS 'Versão do contrato';
COMMENT ON COLUMN contratos.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';



-- ============================================================================
-- Arquivo: schema-saldos-contas.sql
-- ============================================================================

-- Schema do Supabase para Tabela de Saldos de Contas Financeiras
-- Armazena histórico temporal de saldos coletados da API Conta Azul

-- ============================================
-- TABELA: saldos_contas
-- Armazena histórico de saldos das contas financeiras (tabela separada para rastreamento temporal)
-- ============================================
CREATE TABLE IF NOT EXISTS saldos_contas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    conta_financeira_id TEXT NOT NULL, -- ID da conta financeira na API Conta Azul (referência a contas_financeiras.conta_financeira_id)
    saldo_atual NUMERIC(15,2) NOT NULL, -- Saldo atual da conta financeira
    data_coleta TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Data/hora da coleta do saldo
    dados_originais JSONB NOT NULL, -- Dados completos retornados pela API (backup)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para saldos_contas
CREATE INDEX IF NOT EXISTS idx_saldos_contas_cliente_id ON saldos_contas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_saldos_contas_conta_financeira_id ON saldos_contas(conta_financeira_id);
CREATE INDEX IF NOT EXISTS idx_saldos_contas_cliente_conta ON saldos_contas(cliente_id, conta_financeira_id);
CREATE INDEX IF NOT EXISTS idx_saldos_contas_data_coleta ON saldos_contas(data_coleta DESC);
CREATE INDEX IF NOT EXISTS idx_saldos_contas_created_at ON saldos_contas(created_at DESC);
-- Índice composto para buscar saldo mais recente por conta
CREATE INDEX IF NOT EXISTS idx_saldos_contas_cliente_conta_data ON saldos_contas(cliente_id, conta_financeira_id, data_coleta DESC);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_saldos_contas_dados_originais ON saldos_contas USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_saldos_contas_updated_at ON saldos_contas;
CREATE TRIGGER update_saldos_contas_updated_at
    BEFORE UPDATE ON saldos_contas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE saldos_contas IS 'Armazena histórico temporal de saldos das contas financeiras coletados da API Conta Azul. Cada coleta cria um novo registro para rastreamento histórico.';
COMMENT ON COLUMN saldos_contas.conta_financeira_id IS 'ID da conta financeira na API Conta Azul (referência a contas_financeiras.conta_financeira_id)';
COMMENT ON COLUMN saldos_contas.saldo_atual IS 'Saldo atual da conta financeira no momento da coleta';
COMMENT ON COLUMN saldos_contas.data_coleta IS 'Data/hora da coleta do saldo. Permite rastreamento histórico de variações de saldo ao longo do tempo.';
COMMENT ON COLUMN saldos_contas.dados_originais IS 'Dados completos retornados pela API em formato JSONB para preservar toda a estrutura e tratamento futuro';



-- ============================================================================
-- Arquivo: schema-parcelas-detalhes.sql
-- ============================================================================

-- Schema do Supabase para Tabela de Detalhes de Parcelas
-- Armazena informações detalhadas de parcelas (rateio, categoria, centro de custo)
-- Suporta múltiplas entidades: contas_pagar, contas_receber, vendas, contratos

-- ============================================
-- TABELA: parcelas_detalhes
-- Armazena detalhamento de parcelas de todas as entidades financeiras
-- ============================================
CREATE TABLE IF NOT EXISTS parcelas_detalhes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    entidade_tipo TEXT NOT NULL, -- 'contas_pagar', 'contas_receber', 'vendas', 'contratos'
    parcela_id TEXT NOT NULL, -- ID da parcela na API (conta_pagar_id, conta_receber_id, etc.)
    detalhado BOOLEAN DEFAULT FALSE, -- Indica se já foi detalhado
    data_detalhamento TIMESTAMP WITH TIME ZONE, -- Data/hora do detalhamento
    detalhes_parcela JSONB, -- Dados completos do endpoint GET /v1/financeiro/eventos-financeiros/parcelas/{id}
    rateio JSONB, -- Array de rateios extraído de evento.rateio (para facilitar consultas)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, entidade_tipo, parcela_id) -- Uma entrada de detalhamento por parcela
);

-- Índices para parcelas_detalhes
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_cliente_id ON parcelas_detalhes(cliente_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_entidade_tipo ON parcelas_detalhes(entidade_tipo);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_parcela_id ON parcelas_detalhes(parcela_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_cliente_entidade_parcela ON parcelas_detalhes(cliente_id, entidade_tipo, parcela_id);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_detalhado ON parcelas_detalhes(detalhado);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_cliente_entidade_detalhado ON parcelas_detalhes(cliente_id, entidade_tipo, detalhado);
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_data_detalhamento ON parcelas_detalhes(data_detalhamento DESC);

-- Índice GIN para busca em detalhes_parcela (JSONB)
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_detalhes_parcela ON parcelas_detalhes USING GIN (detalhes_parcela);

-- Índice GIN para busca em rateio (JSONB)
CREATE INDEX IF NOT EXISTS idx_parcelas_detalhes_rateio ON parcelas_detalhes USING GIN (rateio);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_parcelas_detalhes_updated_at ON parcelas_detalhes;
CREATE TRIGGER update_parcelas_detalhes_updated_at
    BEFORE UPDATE ON parcelas_detalhes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE parcelas_detalhes IS 'Armazena detalhamento de parcelas (rateio, categoria, centro de custo) de todas as entidades financeiras. Permite reutilização da mesma estrutura para contas_pagar, contas_receber, vendas e contratos.';
COMMENT ON COLUMN parcelas_detalhes.cliente_id IS 'ID do cliente (referência a clientes)';
COMMENT ON COLUMN parcelas_detalhes.entidade_tipo IS 'Tipo de entidade: contas_pagar, contas_receber, vendas ou contratos';
COMMENT ON COLUMN parcelas_detalhes.parcela_id IS 'ID da parcela na API (conta_pagar_id, conta_receber_id, etc.)';
COMMENT ON COLUMN parcelas_detalhes.detalhado IS 'Indica se a parcela já foi detalhada (busca de rateio, categoria e centro de custo via GET /v1/financeiro/eventos-financeiros/parcelas/{id})';
COMMENT ON COLUMN parcelas_detalhes.data_detalhamento IS 'Data/hora em que a parcela foi detalhada';
COMMENT ON COLUMN parcelas_detalhes.detalhes_parcela IS 'Dados completos retornados pelo endpoint GET /v1/financeiro/eventos-financeiros/parcelas/{id} (inclui rateio, categoria, centro de custo)';
COMMENT ON COLUMN parcelas_detalhes.rateio IS 'Array de rateios extraído de evento.rateio para facilitar consultas. Estrutura: [{id_categoria, nome_categoria, valor, rateio_centro_custo: [...]}]';



-- ============================================================================
-- Arquivo: schema-vendas-detalhadas.sql
-- ============================================================================

-- Schema do Supabase para Tabela de Vendas Detalhadas
-- Armazena dados completos de vendas coletados da API Conta Azul
-- Retornados pelo endpoint GET /v1/venda/{id}

-- ============================================
-- TABELA: vendas_detalhadas
-- Armazena dados completos de vendas (retornados pelo GET /v1/venda/{id})
-- Uma linha por venda detalhada
-- ============================================
CREATE TABLE IF NOT EXISTS vendas_detalhadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    venda_id TEXT NOT NULL, -- ID da venda na API (referência a vendas.venda_id)
    
    -- ============================================
    -- Campos principais extraídos (manter compatibilidade)
    -- ============================================
    data DATE, -- Data da venda (data de emissão)
    total NUMERIC(15,2), -- Valor total da venda
    situacao TEXT, -- Situação da venda (mantido para compatibilidade, equivalente a situacao_nome)
    cliente_venda_id TEXT, -- ID do cliente (extraído do objeto cliente)
    cliente_venda_nome TEXT, -- Nome do cliente (extraído do objeto cliente)
    
    -- ============================================
    -- Campos do Cliente (venda.cliente)
    -- ============================================
    cliente_uuid TEXT, -- UUID do cliente (cliente.uuid)
    cliente_tipo_pessoa TEXT, -- Tipo de pessoa do cliente (cliente.tipo_pessoa)
    cliente_documento TEXT, -- Documento do cliente (cliente.documento)
    
    -- ============================================
    -- Campos do Evento Financeiro (venda.evento_financeiro)
    -- ============================================
    evento_financeiro_id TEXT, -- ID do evento financeiro (evento_financeiro.id)
    
    -- ============================================
    -- Campos de Notificação (venda.notificacao) - Opcional
    -- ============================================
    notificacao_id_referencia TEXT, -- ID de referência da notificação (notificacao.id_referencia)
    notificacao_enviado_para TEXT, -- Email para onde foi enviado (notificacao.enviado_para)
    notificacao_enviado_em TIMESTAMP WITH TIME ZONE, -- Data/hora de envio (notificacao.enviado_em)
    notificacao_aberto_em TIMESTAMP WITH TIME ZONE, -- Data/hora de abertura (notificacao.aberto_em)
    notificacao_status TEXT, -- Status da notificação (notificacao.status)
    
    -- ============================================
    -- Campos da Natureza Operação (venda.natureza_operacao)
    -- ============================================
    natureza_operacao_uuid TEXT, -- UUID da natureza de operação (natureza_operacao.uuid)
    natureza_operacao_tipo_operacao TEXT, -- Tipo de operação (natureza_operacao.tipo_operacao)
    natureza_operacao_template_operacao TEXT, -- Template da operação (natureza_operacao.template_operacao)
    natureza_operacao_label TEXT, -- Label da natureza de operação (natureza_operacao.label)
    natureza_operacao_mudanca_financeira BOOLEAN, -- Indica se há mudança financeira (natureza_operacao.mudanca_financeira)
    natureza_operacao_mudanca_estoque TEXT, -- Mudança de estoque (natureza_operacao.mudanca_estoque)
    
    -- ============================================
    -- Campos da Venda (venda.*)
    -- ============================================
    venda_status TEXT, -- Status da venda (venda.status)
    venda_id_legado TEXT, -- ID legado da venda (venda.id_legado)
    venda_tipo_negociacao TEXT, -- Tipo de negociação (venda.tipo_negociacao)
    venda_numero INTEGER, -- Número da venda (venda.numero)
    venda_id_categoria TEXT, -- ID da categoria (venda.id_categoria)
    venda_data_compromisso DATE, -- Data de compromisso (venda.data_compromisso)
    venda_id_cliente TEXT, -- ID do cliente na venda (venda.id_cliente) - equivalente a cliente_venda_id
    venda_versao INTEGER, -- Versão da venda (venda.versao)
    venda_id_natureza_operacao TEXT, -- ID da natureza de operação (venda.id_natureza_operacao)
    venda_id_centro_custo TEXT, -- ID do centro de custo (venda.id_centro_custo)
    venda_introducao TEXT, -- Introdução da venda (venda.introducao)
    venda_observacoes TEXT, -- Observações da venda (venda.observacoes)
    
    -- ============================================
    -- Composição de Valor (venda.composicao_valor)
    -- ============================================
    composicao_valor_bruto NUMERIC(15,2), -- Valor bruto (composicao_valor.valor_bruto)
    composicao_desconto NUMERIC(15,2), -- Valor do desconto (composicao_valor.desconto)
    composicao_frete NUMERIC(15,2), -- Valor do frete (composicao_valor.frete)
    composicao_impostos NUMERIC(15,2), -- Valor dos impostos (composicao_valor.impostos)
    composicao_impostos_deduzidos NUMERIC(15,2), -- Impostos deduzidos (composicao_valor.impostos_deduzidos)
    composicao_seguro NUMERIC(15,2), -- Valor do seguro (composicao_valor.seguro)
    composicao_despesas_incidentais NUMERIC(15,2), -- Despesas incidentais (composicao_valor.despesas_incidentais)
    composicao_valor_liquido NUMERIC(15,2), -- Valor líquido (composicao_valor.valor_liquido)
    
    -- ============================================
    -- Configuração de Desconto (venda.configuracao_de_desconto)
    -- ============================================
    configuracao_desconto_tipo TEXT, -- Tipo de desconto (configuracao_de_desconto.tipo_desconto)
    configuracao_desconto_taxa NUMERIC(10,2), -- Taxa de desconto (configuracao_de_desconto.taxa_desconto)
    
    -- ============================================
    -- Total de Itens (venda.total_itens)
    -- ============================================
    total_itens_contagem_produtos INTEGER, -- Contagem de produtos (total_itens.contagem_produtos)
    total_itens_contagem_servicos INTEGER, -- Contagem de serviços (total_itens.contagem_servicos)
    total_itens_contagem_nao_conciliados INTEGER, -- Contagem de não conciliados (total_itens.contagem_nao_conciliados)
    
    -- ============================================
    -- Situação (venda.situacao)
    -- ============================================
    situacao_nome TEXT, -- Nome da situação (situacao.nome) - equivalente a situacao (mantido para compatibilidade)
    situacao_descricao TEXT, -- Descrição da situação (situacao.descricao)
    situacao_ativado BOOLEAN, -- Se a situação está ativada (situacao.ativado)
    
    -- ============================================
    -- Tipo de Pendência (venda.tipo_pendencia)
    -- ============================================
    tipo_pendencia_nome TEXT, -- Nome do tipo de pendência (tipo_pendencia.nome)
    tipo_pendencia_descricao TEXT, -- Descrição do tipo de pendência (tipo_pendencia.descricao)
    
    -- ============================================
    -- Condição de Pagamento (venda.condicao_pagamento)
    -- ============================================
    condicao_pagamento_tipo TEXT, -- Tipo de pagamento (condicao_pagamento.tipo_pagamento)
    condicao_pagamento_id_conta_financeira TEXT, -- ID da conta financeira (condicao_pagamento.id_conta_financeira)
    condicao_pagamento_pagamento_a_vista BOOLEAN, -- Se é pagamento à vista (condicao_pagamento.pagamento_a_vista)
    condicao_pagamento_observacoes TEXT, -- Observações do pagamento (condicao_pagamento.observacoes_pagamento)
    condicao_pagamento_opcao_condicao_pagamento TEXT, -- Opção de condição de pagamento (condicao_pagamento.opcao_condicao_pagamento)
    condicao_pagamento_nsu TEXT, -- NSU do pagamento (condicao_pagamento.nsu)
    condicao_pagamento_cartao_tipo_bandeira TEXT, -- Tipo de bandeira do cartão (condicao_pagamento.pagamento_cartao.tipo_bandeira)
    condicao_pagamento_cartao_codigo_transacao TEXT, -- Código da transação (condicao_pagamento.pagamento_cartao.codigo_transacao)
    condicao_pagamento_cartao_id_adquirente TEXT, -- ID do adquirente (condicao_pagamento.pagamento_cartao.id_adquirente)
    -- Nota: parcelas (condicao_pagamento.parcelas) permanece apenas no JSONB, pois é um array
    
    -- ============================================
    -- Campos do Vendedor (venda.vendedor)
    -- ============================================
    vendedor_id TEXT, -- ID do vendedor (vendedor.id)
    vendedor_nome TEXT, -- Nome do vendedor (vendedor.nome)
    vendedor_id_legado TEXT, -- ID legado do vendedor (vendedor.id_legado)
    
    -- ============================================
    -- Backup completo
    -- ============================================
    dados_originais JSONB NOT NULL, -- Dados completos retornados pelo endpoint GET /v1/venda/{id}
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(cliente_id, venda_id) -- Uma linha por venda detalhada
);

-- Índices para vendas_detalhadas
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_cliente_id ON vendas_detalhadas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_id ON vendas_detalhadas(venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_cliente_venda ON vendas_detalhadas(cliente_id, venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_data ON vendas_detalhadas(data DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_created_at ON vendas_detalhadas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_cliente_venda_id ON vendas_detalhadas(cliente_venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_situacao ON vendas_detalhadas(situacao);

-- Índices para campos frequentemente consultados
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_status ON vendas_detalhadas(venda_status);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_tipo_negociacao ON vendas_detalhadas(venda_tipo_negociacao);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_numero ON vendas_detalhadas(venda_numero);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_data_compromisso ON vendas_detalhadas(venda_data_compromisso DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_evento_financeiro_id ON vendas_detalhadas(evento_financeiro_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_natureza_operacao_uuid ON vendas_detalhadas(natureza_operacao_uuid);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_vendedor_id ON vendas_detalhadas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_cliente_uuid ON vendas_detalhadas(cliente_uuid);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_dados_originais ON vendas_detalhadas USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_vendas_detalhadas_updated_at ON vendas_detalhadas;
CREATE TRIGGER update_vendas_detalhadas_updated_at
    BEFORE UPDATE ON vendas_detalhadas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE vendas_detalhadas IS 'Armazena dados completos de vendas coletados da API Conta Azul via GET /v1/venda/{id}. Uma linha por venda detalhada. Todos os campos são extraídos do JSONB dados_originais para facilitar consultas e relatórios.';

-- Comentários dos campos principais
COMMENT ON COLUMN vendas_detalhadas.venda_id IS 'ID da venda na API (referência a vendas.venda_id)';
COMMENT ON COLUMN vendas_detalhadas.data IS 'Data da venda (data de emissão). Extraído de dados_originais->data ou dados_originais->data_emissao';
COMMENT ON COLUMN vendas_detalhadas.total IS 'Valor total da venda. Extraído de dados_originais->total';
COMMENT ON COLUMN vendas_detalhadas.situacao IS 'Situação da venda (mantido para compatibilidade). Equivalente a situacao_nome. Extraído de dados_originais->venda->situacao->nome';
COMMENT ON COLUMN vendas_detalhadas.cliente_venda_id IS 'ID do cliente (extraído de dados_originais->cliente->id ou dados_originais->venda->id_cliente)';
COMMENT ON COLUMN vendas_detalhadas.cliente_venda_nome IS 'Nome do cliente (extraído de dados_originais->cliente->nome)';
COMMENT ON COLUMN vendas_detalhadas.dados_originais IS 'Dados completos retornados pelo endpoint GET /v1/venda/{id} em formato JSONB. Mantido como backup completo para casos especiais e arrays complexos (ex: parcelas)';

-- Comentários dos campos do cliente
COMMENT ON COLUMN vendas_detalhadas.cliente_uuid IS 'UUID do cliente. Extraído de dados_originais->cliente->uuid';
COMMENT ON COLUMN vendas_detalhadas.cliente_tipo_pessoa IS 'Tipo de pessoa do cliente (Física/Jurídica). Extraído de dados_originais->cliente->tipo_pessoa';
COMMENT ON COLUMN vendas_detalhadas.cliente_documento IS 'Documento do cliente (CPF/CNPJ). Extraído de dados_originais->cliente->documento';

-- Comentários dos campos do evento financeiro
COMMENT ON COLUMN vendas_detalhadas.evento_financeiro_id IS 'ID do evento financeiro. Extraído de dados_originais->evento_financeiro->id';

-- Comentários dos campos da venda
COMMENT ON COLUMN vendas_detalhadas.venda_status IS 'Status da venda. Extraído de dados_originais->venda->status';
COMMENT ON COLUMN vendas_detalhadas.venda_tipo_negociacao IS 'Tipo de negociação. Extraído de dados_originais->venda->tipo_negociacao';
COMMENT ON COLUMN vendas_detalhadas.venda_numero IS 'Número da venda. Extraído de dados_originais->venda->numero';
COMMENT ON COLUMN vendas_detalhadas.composicao_valor_liquido IS 'Valor líquido da venda. Extraído de dados_originais->venda->composicao_valor->valor_liquido';



-- ============================================================================
-- Arquivo: schema-contas-pagar-detalhadas.sql
-- ============================================================================

-- Schema do Supabase para Tabela de Contas a Pagar Detalhadas
-- Armazena detalhamento de contas a pagar com rateio expandido (uma linha por rateio)

-- ============================================
-- TABELA: contas_pagar_detalhadas
-- Armazena detalhamento de contas a pagar com rateio, categoria e centro de custo
-- Uma linha por rateio de cada parcela
-- ============================================
CREATE TABLE IF NOT EXISTS contas_pagar_detalhadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    conta_pagar_id TEXT NOT NULL, -- ID da conta a pagar (referência a contas_pagar.conta_pagar_id)
    parcela_id TEXT NOT NULL, -- ID da parcela na API (campo 'id' da resposta do endpoint de detalhes)
    
    -- Dados do rateio
    categoria_id TEXT, -- ID da categoria (id_categoria do rateio)
    categoria_nome TEXT, -- Nome da categoria (nome_categoria do rateio)
    centro_custo_id TEXT, -- ID do centro de custo (primeiro centro de custo do rateio_centro_custo, se houver múltiplos, considerar o primeiro ou agregar)
    centro_custo_nome TEXT, -- Nome do centro de custo
    
    -- Valores
    valor_rateio NUMERIC(15,2), -- Valor do rateio (valor do rateio)
    valor_total_parcela NUMERIC(15,2), -- Valor total da parcela
    valor_pago NUMERIC(15,2), -- Valor pago da parcela
    valor_nao_pago NUMERIC(15,2), -- Valor não pago da parcela
    
    -- Dados da parcela
    data_vencimento DATE, -- Data de vencimento da parcela
    status TEXT, -- Status da parcela
    status_traduzido TEXT, -- Status traduzido
    
    -- Dados do fornecedor
    fornecedor_id TEXT, -- ID do fornecedor
    fornecedor_nome TEXT, -- Nome do fornecedor
    
    -- Dados do evento financeiro
    evento_id TEXT, -- ID do evento financeiro (evento.id)
    evento_tipo TEXT, -- Tipo do evento (evento.tipo: RECEITA ou DESPESA)
    data_competencia DATE, -- Data de competência (evento.data_competencia)
    
    -- Backup completo
    dados_originais JSONB NOT NULL, -- Dados completos retornados pelo endpoint GET /v1/financeiro/eventos-financeiros/parcelas/{id}
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(cliente_id, conta_pagar_id, parcela_id, categoria_id, centro_custo_id) -- Uma linha por combinação única
);

-- Índices para contas_pagar_detalhadas
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_cliente_id ON contas_pagar_detalhadas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_conta_pagar_id ON contas_pagar_detalhadas(conta_pagar_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_parcela_id ON contas_pagar_detalhadas(parcela_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_cliente_conta_parcela ON contas_pagar_detalhadas(cliente_id, conta_pagar_id, parcela_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_categoria_id ON contas_pagar_detalhadas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_centro_custo_id ON contas_pagar_detalhadas(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_data_vencimento ON contas_pagar_detalhadas(data_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_status ON contas_pagar_detalhadas(status);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_fornecedor_id ON contas_pagar_detalhadas(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_evento_id ON contas_pagar_detalhadas(evento_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_created_at ON contas_pagar_detalhadas(created_at DESC);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_contas_pagar_detalhadas_dados_originais ON contas_pagar_detalhadas USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_contas_pagar_detalhadas_updated_at ON contas_pagar_detalhadas;
CREATE TRIGGER update_contas_pagar_detalhadas_updated_at
    BEFORE UPDATE ON contas_pagar_detalhadas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE contas_pagar_detalhadas IS 'Armazena detalhamento de contas a pagar com rateio expandido. Uma linha por combinação de parcela, categoria e centro de custo.';
COMMENT ON COLUMN contas_pagar_detalhadas.conta_pagar_id IS 'ID da conta a pagar na API (referência a contas_pagar.conta_pagar_id)';
COMMENT ON COLUMN contas_pagar_detalhadas.parcela_id IS 'ID da parcela na API (campo id da resposta do endpoint GET /v1/financeiro/eventos-financeiros/parcelas/{id})';
COMMENT ON COLUMN contas_pagar_detalhadas.categoria_id IS 'ID da categoria (id_categoria do rateio)';
COMMENT ON COLUMN contas_pagar_detalhadas.categoria_nome IS 'Nome da categoria (nome_categoria do rateio)';
COMMENT ON COLUMN contas_pagar_detalhadas.centro_custo_id IS 'ID do centro de custo do rateio_centro_custo';
COMMENT ON COLUMN contas_pagar_detalhadas.centro_custo_nome IS 'Nome do centro de custo';
COMMENT ON COLUMN contas_pagar_detalhadas.valor_rateio IS 'Valor do rateio para esta categoria e centro de custo';
COMMENT ON COLUMN contas_pagar_detalhadas.valor_total_parcela IS 'Valor total da parcela';
COMMENT ON COLUMN contas_pagar_detalhadas.valor_pago IS 'Valor já pago da parcela';
COMMENT ON COLUMN contas_pagar_detalhadas.valor_nao_pago IS 'Valor ainda não pago da parcela';
COMMENT ON COLUMN contas_pagar_detalhadas.evento_id IS 'ID do evento financeiro (evento.id)';
COMMENT ON COLUMN contas_pagar_detalhadas.evento_tipo IS 'Tipo do evento: RECEITA ou DESPESA';
COMMENT ON COLUMN contas_pagar_detalhadas.dados_originais IS 'Dados completos retornados pelo endpoint GET /v1/financeiro/eventos-financeiros/parcelas/{id}';



-- ============================================================================
-- Arquivo: schema-contas-receber-detalhadas.sql
-- ============================================================================

-- Schema do Supabase para Tabela de Contas a Receber Detalhadas
-- Armazena detalhamento de contas a receber com rateio expandido (uma linha por rateio)

-- ============================================
-- TABELA: contas_receber_detalhadas
-- Armazena detalhamento de contas a receber com rateio, categoria e centro de custo
-- Uma linha por rateio de cada parcela
-- ============================================
CREATE TABLE IF NOT EXISTS contas_receber_detalhadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    conta_receber_id TEXT NOT NULL, -- ID da conta a receber (referência a contas_receber.conta_receber_id)
    parcela_id TEXT NOT NULL, -- ID da parcela na API (campo 'id' da resposta do endpoint de detalhes)
    
    -- Dados do rateio
    categoria_id TEXT, -- ID da categoria (id_categoria do rateio)
    categoria_nome TEXT, -- Nome da categoria (nome_categoria do rateio)
    centro_custo_id TEXT, -- ID do centro de custo (primeiro centro de custo do rateio_centro_custo, se houver múltiplos, considerar o primeiro ou agregar)
    centro_custo_nome TEXT, -- Nome do centro de custo
    
    -- Valores
    valor_rateio NUMERIC(15,2), -- Valor do rateio (valor do rateio)
    valor_total_parcela NUMERIC(15,2), -- Valor total da parcela
    valor_pago NUMERIC(15,2), -- Valor pago da parcela
    valor_nao_pago NUMERIC(15,2), -- Valor não pago da parcela
    
    -- Dados da parcela
    data_vencimento DATE, -- Data de vencimento da parcela
    status TEXT, -- Status da parcela
    status_traduzido TEXT, -- Status traduzido
    
    -- Dados do cliente
    cliente_conta_id TEXT, -- ID do cliente (cliente.id)
    cliente_conta_nome TEXT, -- Nome do cliente (cliente.nome)
    
    -- Dados do evento financeiro
    evento_id TEXT, -- ID do evento financeiro (evento.id)
    evento_tipo TEXT, -- Tipo do evento (evento.tipo: RECEITA ou DESPESA)
    data_competencia DATE, -- Data de competência (evento.data_competencia)
    
    -- Backup completo
    dados_originais JSONB NOT NULL, -- Dados completos retornados pelo endpoint GET /v1/financeiro/eventos-financeiros/parcelas/{id}
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(cliente_id, conta_receber_id, parcela_id, categoria_id, centro_custo_id) -- Uma linha por combinação única
);

-- Índices para contas_receber_detalhadas
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_cliente_id ON contas_receber_detalhadas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_conta_receber_id ON contas_receber_detalhadas(conta_receber_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_parcela_id ON contas_receber_detalhadas(parcela_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_cliente_conta_parcela ON contas_receber_detalhadas(cliente_id, conta_receber_id, parcela_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_categoria_id ON contas_receber_detalhadas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_centro_custo_id ON contas_receber_detalhadas(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_data_vencimento ON contas_receber_detalhadas(data_vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_status ON contas_receber_detalhadas(status);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_cliente_conta_id ON contas_receber_detalhadas(cliente_conta_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_evento_id ON contas_receber_detalhadas(evento_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_created_at ON contas_receber_detalhadas(created_at DESC);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_contas_receber_detalhadas_dados_originais ON contas_receber_detalhadas USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_contas_receber_detalhadas_updated_at ON contas_receber_detalhadas;
CREATE TRIGGER update_contas_receber_detalhadas_updated_at
    BEFORE UPDATE ON contas_receber_detalhadas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE contas_receber_detalhadas IS 'Armazena detalhamento de contas a receber com rateio expandido. Uma linha por combinação de parcela, categoria e centro de custo.';
COMMENT ON COLUMN contas_receber_detalhadas.conta_receber_id IS 'ID da conta a receber na API (referência a contas_receber.conta_receber_id)';
COMMENT ON COLUMN contas_receber_detalhadas.parcela_id IS 'ID da parcela na API (campo id da resposta do endpoint GET /v1/financeiro/eventos-financeiros/parcelas/{id})';
COMMENT ON COLUMN contas_receber_detalhadas.categoria_id IS 'ID da categoria (id_categoria do rateio)';
COMMENT ON COLUMN contas_receber_detalhadas.categoria_nome IS 'Nome da categoria (nome_categoria do rateio)';
COMMENT ON COLUMN contas_receber_detalhadas.centro_custo_id IS 'ID do centro de custo do rateio_centro_custo';
COMMENT ON COLUMN contas_receber_detalhadas.centro_custo_nome IS 'Nome do centro de custo';
COMMENT ON COLUMN contas_receber_detalhadas.valor_rateio IS 'Valor do rateio para esta categoria e centro de custo';
COMMENT ON COLUMN contas_receber_detalhadas.valor_total_parcela IS 'Valor total da parcela';
COMMENT ON COLUMN contas_receber_detalhadas.valor_pago IS 'Valor já pago da parcela';
COMMENT ON COLUMN contas_receber_detalhadas.valor_nao_pago IS 'Valor ainda não pago da parcela';
COMMENT ON COLUMN contas_receber_detalhadas.cliente_conta_id IS 'ID do cliente (cliente.id)';
COMMENT ON COLUMN contas_receber_detalhadas.cliente_conta_nome IS 'Nome do cliente (cliente.nome)';
COMMENT ON COLUMN contas_receber_detalhadas.evento_id IS 'ID do evento financeiro (evento.id)';
COMMENT ON COLUMN contas_receber_detalhadas.evento_tipo IS 'Tipo do evento: RECEITA ou DESPESA';
COMMENT ON COLUMN contas_receber_detalhadas.dados_originais IS 'Dados completos retornados pelo endpoint GET /v1/financeiro/eventos-financeiros/parcelas/{id}';



-- ============================================================================
-- Arquivo: schema-vendas-itens.sql
-- ============================================================================

-- Schema do Supabase para Tabela de Itens de Vendas
-- Armazena itens detalhados de vendas coletados da API Conta Azul

-- ============================================
-- TABELA: vendas_itens
-- Armazena itens detalhados de vendas (produtos e serviços)
-- Uma linha por item de venda
-- ============================================
CREATE TABLE IF NOT EXISTS vendas_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    venda_id TEXT NOT NULL, -- ID da venda (referência a vendas.venda_id)
    item_id TEXT, -- ID do item na API (campo 'id' do item, se disponível)
    
    -- Produto ou Serviço
    produto_id TEXT, -- ID do produto (se o item for um produto)
    produto_nome TEXT, -- Nome do produto
    servico_id TEXT, -- ID do serviço (se o item for um serviço)
    servico_nome TEXT, -- Nome do serviço
    
    -- Quantidades e Valores
    quantidade NUMERIC(15,4), -- Quantidade do item
    valor_unitario NUMERIC(15,2), -- Valor unitário do item
    valor_total NUMERIC(15,2), -- Valor total do item (quantidade * valor_unitario, antes de descontos)
    desconto NUMERIC(15,2), -- Valor do desconto aplicado ao item
    valor_liquido NUMERIC(15,2), -- Valor líquido (valor_total - desconto)
    
    -- Informações adicionais
    unidade_medida TEXT, -- Unidade de medida do item
    codigo TEXT, -- Código do produto/serviço (SKU, código interno, etc.)
    descricao TEXT, -- Descrição adicional do item
    
    -- Backup completo
    dados_originais JSONB NOT NULL, -- Dados completos retornados pelo endpoint GET /v1/venda/{id_venda}/itens
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(cliente_id, venda_id, item_id) -- Uma linha por item de venda
);

-- Índices para vendas_itens
CREATE INDEX IF NOT EXISTS idx_vendas_itens_cliente_id ON vendas_itens(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_venda_id ON vendas_itens(venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_cliente_venda ON vendas_itens(cliente_id, venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_item_id ON vendas_itens(item_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_produto_id ON vendas_itens(produto_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_servico_id ON vendas_itens(servico_id);
CREATE INDEX IF NOT EXISTS idx_vendas_itens_created_at ON vendas_itens(created_at DESC);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_vendas_itens_dados_originais ON vendas_itens USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_vendas_itens_updated_at ON vendas_itens;
CREATE TRIGGER update_vendas_itens_updated_at
    BEFORE UPDATE ON vendas_itens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE vendas_itens IS 'Armazena itens detalhados de vendas coletados da API Conta Azul. Uma linha por item (produto ou serviço) de cada venda.';
COMMENT ON COLUMN vendas_itens.venda_id IS 'ID da venda na API (referência a vendas.venda_id)';
COMMENT ON COLUMN vendas_itens.item_id IS 'ID do item na API (campo id do item, se disponível)';
COMMENT ON COLUMN vendas_itens.produto_id IS 'ID do produto (se o item for um produto)';
COMMENT ON COLUMN vendas_itens.produto_nome IS 'Nome do produto';
COMMENT ON COLUMN vendas_itens.servico_id IS 'ID do serviço (se o item for um serviço)';
COMMENT ON COLUMN vendas_itens.servico_nome IS 'Nome do serviço';
COMMENT ON COLUMN vendas_itens.quantidade IS 'Quantidade do item';
COMMENT ON COLUMN vendas_itens.valor_unitario IS 'Valor unitário do item';
COMMENT ON COLUMN vendas_itens.valor_total IS 'Valor total do item (quantidade * valor_unitario, antes de descontos)';
COMMENT ON COLUMN vendas_itens.desconto IS 'Valor do desconto aplicado ao item';
COMMENT ON COLUMN vendas_itens.valor_liquido IS 'Valor líquido do item (valor_total - desconto)';
COMMENT ON COLUMN vendas_itens.dados_originais IS 'Dados completos retornados pelo endpoint GET /v1/venda/{id_venda}/itens';



-- ============================================================================
-- Arquivo: view-contas-financeiras-unificadas.sql
-- ============================================================================

-- View Unificada de Contas Financeiras
-- Une contas a pagar e receber detalhadas em uma única view para facilitar consultas

-- ============================================
-- VIEW: vw_contas_financeiras_unificadas
-- Unifica contas_pagar_detalhadas e contas_receber_detalhadas
-- ============================================
CREATE OR REPLACE VIEW vw_contas_financeiras_unificadas AS
SELECT 
    -- Identificação
    id,
    cliente_id,
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
        cliente_id,
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
    FROM contas_pagar_detalhadas
    
    UNION ALL
    
    -- Contas a Receber
    SELECT 
        id,
        cliente_id,
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
    FROM contas_receber_detalhadas
) AS contas_unificadas;

-- Comentário na view
COMMENT ON VIEW vw_contas_financeiras_unificadas IS 'View unificada que combina contas a pagar e receber detalhadas. A coluna tipo indica se é PAGAR ou RECEBER, e pessoa_id/pessoa_nome referenciam fornecedor (PAGAR) ou cliente (RECEBER).';


