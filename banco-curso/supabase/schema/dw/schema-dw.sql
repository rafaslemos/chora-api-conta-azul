-- Schema do Data Warehouse para Conta Azul
-- Estrutura dimensional otimizada para Power BI

-- Criar schema DW se não existir
CREATE SCHEMA IF NOT EXISTS dw;

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
-- DIMENSÃO: dim_categoria
-- Categorias financeiras com hierarquia nivelada
-- ============================================
CREATE TABLE IF NOT EXISTS dw.dim_categoria (
    categoria_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    categoria_api_id TEXT NOT NULL, -- ID da categoria na API (categorias.categoria_id)
    
    -- Dados básicos
    nome TEXT NOT NULL,
    tipo TEXT, -- RECEITA ou DESPESA
    
    -- Hierarquia nivelada
    nivel_1_desc TEXT, -- Nome do nível 1 (raiz)
    nivel_2_desc TEXT, -- Nome do nível 2
    nivel_3_desc TEXT, -- Nome do nível 3
    nivel_4_desc TEXT, -- Nome do nível 4
    nivel_5_desc TEXT, -- Nome do nível 5
    nivel_maximo INTEGER, -- Quantidade de níveis (1 a 5)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(cliente_id, categoria_api_id)
);

-- Índices para dim_categoria
CREATE INDEX IF NOT EXISTS idx_dim_categoria_cliente_id ON dw.dim_categoria(cliente_id);
CREATE INDEX IF NOT EXISTS idx_dim_categoria_categoria_api_id ON dw.dim_categoria(categoria_api_id);
CREATE INDEX IF NOT EXISTS idx_dim_categoria_cliente_categoria ON dw.dim_categoria(cliente_id, categoria_api_id);
CREATE INDEX IF NOT EXISTS idx_dim_categoria_tipo ON dw.dim_categoria(tipo);
CREATE INDEX IF NOT EXISTS idx_dim_categoria_nivel_1 ON dw.dim_categoria(nivel_1_desc);
CREATE INDEX IF NOT EXISTS idx_dim_categoria_nivel_2 ON dw.dim_categoria(nivel_2_desc);
CREATE INDEX IF NOT EXISTS idx_dim_categoria_nivel_3 ON dw.dim_categoria(nivel_3_desc);

-- Comentários
COMMENT ON TABLE dw.dim_categoria IS 'Dimensão de categorias financeiras com hierarquia nivelada para drill-down no Power BI';
COMMENT ON COLUMN dw.dim_categoria.categoria_api_id IS 'ID da categoria na API Conta Azul (categorias.categoria_id)';
COMMENT ON COLUMN dw.dim_categoria.nivel_1_desc IS 'Nome do nível 1 da hierarquia (categoria raiz)';
COMMENT ON COLUMN dw.dim_categoria.nivel_maximo IS 'Quantidade de níveis da hierarquia (1 a 5). Calculado automaticamente na função ETL, mas pode ser recalculado dinamicamente usando dw.calcular_nivel_maximo()';

-- ============================================
-- DIMENSÃO: dim_categoria_dre
-- Categorias DRE com hierarquia nivelada
-- ============================================
CREATE TABLE IF NOT EXISTS dw.dim_categoria_dre (
    categoria_dre_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    categoria_dre_api_id TEXT NOT NULL, -- ID da categoria DRE na API (categorias_dre.categoria_dre_id)
    
    -- Dados básicos
    descricao TEXT NOT NULL,
    codigo TEXT,
    posicao INTEGER, -- Posição do item na estrutura DRE (para join com máscara de totalizadores)
    
    -- Hierarquia nivelada
    nivel_1_desc TEXT, -- Descrição do nível 1 (raiz)
    nivel_2_desc TEXT, -- Descrição do nível 2
    nivel_3_desc TEXT, -- Descrição do nível 3
    nivel_4_desc TEXT, -- Descrição do nível 4
    nivel_5_desc TEXT, -- Descrição do nível 5
    nivel_maximo INTEGER, -- Quantidade de níveis (1 a 5)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar colunas se não existirem (para tabelas já criadas)
ALTER TABLE dw.dim_categoria_dre 
ADD COLUMN IF NOT EXISTS categoria_financeira_id TEXT,
ADD COLUMN IF NOT EXISTS posicao INTEGER;

-- Remover constraints UNIQUE antigas e adicionar a nova (idempotente)
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
        AND conname = 'dim_categoria_dre_cliente_categoria_financeira_unique'
        AND contype = 'u'
    ) INTO v_constraint_exists;
    
    -- Se a nova constraint não existe, precisamos remover a antiga e criar a nova
    IF NOT v_constraint_exists THEN
        -- Tentar remover constraint com nome padrão
        BEGIN
            ALTER TABLE dw.dim_categoria_dre
            DROP CONSTRAINT IF EXISTS dim_categoria_dre_cliente_id_categoria_dre_api_id_key;
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
            AND conname != 'dim_categoria_dre_cliente_categoria_financeira_unique'
            AND array_length(conkey, 1) = 2  -- Constraint com 2 colunas (cliente_id, categoria_dre_api_id)
        LOOP
            EXECUTE format('ALTER TABLE dw.dim_categoria_dre DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
        END LOOP;
        
        -- Adicionar nova constraint UNIQUE
        BEGIN
            ALTER TABLE dw.dim_categoria_dre
            ADD CONSTRAINT dim_categoria_dre_cliente_categoria_financeira_unique 
            UNIQUE(cliente_id, categoria_dre_api_id, categoria_financeira_id);
        EXCEPTION
            WHEN duplicate_object THEN
                NULL; -- Constraint já existe, ignorar
        END;
    END IF;
END $$;

-- Índices para dim_categoria_dre
CREATE INDEX IF NOT EXISTS idx_dim_categoria_dre_cliente_id ON dw.dim_categoria_dre(cliente_id);
CREATE INDEX IF NOT EXISTS idx_dim_categoria_dre_categoria_dre_api_id ON dw.dim_categoria_dre(categoria_dre_api_id);
CREATE INDEX IF NOT EXISTS idx_dim_categoria_dre_cliente_categoria ON dw.dim_categoria_dre(cliente_id, categoria_dre_api_id);
CREATE INDEX IF NOT EXISTS idx_dim_categoria_dre_nivel_1 ON dw.dim_categoria_dre(nivel_1_desc);
CREATE INDEX IF NOT EXISTS idx_dim_categoria_dre_nivel_2 ON dw.dim_categoria_dre(nivel_2_desc);
CREATE INDEX IF NOT EXISTS idx_dim_categoria_dre_nivel_3 ON dw.dim_categoria_dre(nivel_3_desc);
CREATE INDEX IF NOT EXISTS idx_dim_categoria_dre_categoria_financeira_id ON dw.dim_categoria_dre(categoria_financeira_id);
CREATE INDEX IF NOT EXISTS idx_dim_categoria_dre_posicao ON dw.dim_categoria_dre(posicao);
CREATE INDEX IF NOT EXISTS idx_dim_categoria_dre_cliente_posicao ON dw.dim_categoria_dre(cliente_id, posicao);

-- Comentários
COMMENT ON TABLE dw.dim_categoria_dre IS 'Dimensão de categorias DRE com hierarquia nivelada para drill-down no Power BI. Inclui expansão de categorias financeiras associadas.';
COMMENT ON COLUMN dw.dim_categoria_dre.categoria_dre_api_id IS 'ID da categoria DRE na API Conta Azul (categorias_dre.categoria_dre_id)';
COMMENT ON COLUMN dw.dim_categoria_dre.categoria_financeira_id IS 'ID da categoria financeira associada (NULL se for registro da categoria DRE, preenchido se for registro expandido de categoria financeira)';
COMMENT ON COLUMN dw.dim_categoria_dre.posicao IS 'Posição do item na estrutura DRE (usado para join com máscara de totalizadores)';
COMMENT ON COLUMN dw.dim_categoria_dre.nivel_1_desc IS 'Descrição do nível 1 da hierarquia (categoria raiz)';
COMMENT ON COLUMN dw.dim_categoria_dre.nivel_maximo IS 'Quantidade de níveis da hierarquia (1 a 5)';

-- ============================================
-- TABELA MÁSCARA: mascara_totalizadores_dre
-- Armazena totalizadores DRE para mapeamento e identificação
-- ============================================
CREATE TABLE IF NOT EXISTS dw.mascara_totalizadores_dre (
    mascara_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    posicao INTEGER NOT NULL, -- Posição do totalizador na estrutura DRE
    categoria_dre_id UUID REFERENCES dw.dim_categoria_dre(categoria_dre_id), -- FK opcional para dim_categoria_dre
    categoria_dre_api_id TEXT NOT NULL, -- ID da categoria DRE na API (categorias_dre.categoria_dre_id)
    descricao TEXT NOT NULL, -- Descrição do totalizador
    codigo TEXT, -- Código (geralmente NULL para totalizadores)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, posicao) -- Uma máscara por cliente/posição
);

-- Índices para mascara_totalizadores_dre
CREATE INDEX IF NOT EXISTS idx_mascara_totalizadores_cliente_id ON dw.mascara_totalizadores_dre(cliente_id);
CREATE INDEX IF NOT EXISTS idx_mascara_totalizadores_posicao ON dw.mascara_totalizadores_dre(posicao);
CREATE INDEX IF NOT EXISTS idx_mascara_totalizadores_cliente_posicao ON dw.mascara_totalizadores_dre(cliente_id, posicao);
CREATE INDEX IF NOT EXISTS idx_mascara_totalizadores_categoria_dre_id ON dw.mascara_totalizadores_dre(categoria_dre_id);
CREATE INDEX IF NOT EXISTS idx_mascara_totalizadores_categoria_dre_api_id ON dw.mascara_totalizadores_dre(categoria_dre_api_id);

-- Comentários
COMMENT ON TABLE dw.mascara_totalizadores_dre IS 'Tabela máscara que armazena totalizadores DRE identificados automaticamente. Permite mapeamento e identificação de categorias totalizadoras através de cliente_id e posicao.';
COMMENT ON COLUMN dw.mascara_totalizadores_dre.posicao IS 'Posição do totalizador na estrutura DRE (usado para join com dim_categoria_dre)';
COMMENT ON COLUMN dw.mascara_totalizadores_dre.categoria_dre_id IS 'Referência opcional à dim_categoria_dre (FK). Atualizada após popular dim_categoria_dre.';
COMMENT ON COLUMN dw.mascara_totalizadores_dre.categoria_dre_api_id IS 'ID da categoria DRE na API Conta Azul (categorias_dre.categoria_dre_id)';

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_mascara_totalizadores_dre_updated_at ON dw.mascara_totalizadores_dre;
CREATE TRIGGER update_mascara_totalizadores_dre_updated_at
    BEFORE UPDATE ON dw.mascara_totalizadores_dre
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DIMENSÃO: dim_centro_custo
-- Centros de custo
-- ============================================
CREATE TABLE IF NOT EXISTS dw.dim_centro_custo (
    centro_custo_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    centro_custo_api_id TEXT NOT NULL, -- ID do centro de custo na API (centro_custos.centro_custo_id)
    
    nome TEXT NOT NULL,
    codigo TEXT,
    ativo BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(cliente_id, centro_custo_api_id)
);

-- Índices para dim_centro_custo
CREATE INDEX IF NOT EXISTS idx_dim_centro_custo_cliente_id ON dw.dim_centro_custo(cliente_id);
CREATE INDEX IF NOT EXISTS idx_dim_centro_custo_centro_custo_api_id ON dw.dim_centro_custo(centro_custo_api_id);
CREATE INDEX IF NOT EXISTS idx_dim_centro_custo_cliente_centro ON dw.dim_centro_custo(cliente_id, centro_custo_api_id);
CREATE INDEX IF NOT EXISTS idx_dim_centro_custo_ativo ON dw.dim_centro_custo(ativo);

-- Comentários
COMMENT ON TABLE dw.dim_centro_custo IS 'Dimensão de centros de custo';
COMMENT ON COLUMN dw.dim_centro_custo.centro_custo_api_id IS 'ID do centro de custo na API Conta Azul (centro_custos.centro_custo_id)';

-- ============================================
-- DIMENSÃO: dim_pessoa
-- Pessoas (clientes/fornecedores)
-- ============================================
CREATE TABLE IF NOT EXISTS dw.dim_pessoa (
    pessoa_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    pessoa_api_id TEXT NOT NULL, -- ID da pessoa na API (pessoas.pessoa_id)
    
    nome TEXT NOT NULL,
    documento TEXT,
    tipo_pessoa TEXT, -- FISICA, JURIDICA, ESTRANGEIRA
    tipo_perfil TEXT, -- CLIENTE, FORNECEDOR, TRANSPORTADORA (primeiro perfil do array perfis)
    cidade TEXT,
    uf TEXT,
    pais TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(cliente_id, pessoa_api_id)
);

-- Índices para dim_pessoa
CREATE INDEX IF NOT EXISTS idx_dim_pessoa_cliente_id ON dw.dim_pessoa(cliente_id);
CREATE INDEX IF NOT EXISTS idx_dim_pessoa_pessoa_api_id ON dw.dim_pessoa(pessoa_api_id);
CREATE INDEX IF NOT EXISTS idx_dim_pessoa_cliente_pessoa ON dw.dim_pessoa(cliente_id, pessoa_api_id);
CREATE INDEX IF NOT EXISTS idx_dim_pessoa_tipo_perfil ON dw.dim_pessoa(tipo_perfil);
CREATE INDEX IF NOT EXISTS idx_dim_pessoa_uf ON dw.dim_pessoa(uf);

-- Comentários
COMMENT ON TABLE dw.dim_pessoa IS 'Dimensão de pessoas (clientes/fornecedores)';
COMMENT ON COLUMN dw.dim_pessoa.pessoa_api_id IS 'ID da pessoa na API Conta Azul (pessoas.pessoa_id)';
COMMENT ON COLUMN dw.dim_pessoa.tipo_perfil IS 'Tipo de perfil principal: CLIENTE, FORNECEDOR, TRANSPORTADORA';

-- ============================================
-- DIMENSÃO: dim_conta_financeira
-- Contas financeiras
-- ============================================
CREATE TABLE IF NOT EXISTS dw.dim_conta_financeira (
    conta_financeira_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    conta_financeira_api_id TEXT NOT NULL, -- ID da conta financeira na API (contas_financeiras.conta_financeira_id)
    
    nome TEXT NOT NULL,
    tipo TEXT, -- Tipo da conta (APLICACAO, CAIXINHA, CONTA_CORRENTE, etc.)
    ativa BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(cliente_id, conta_financeira_api_id)
);

-- Índices para dim_conta_financeira
CREATE INDEX IF NOT EXISTS idx_dim_conta_financeira_cliente_id ON dw.dim_conta_financeira(cliente_id);
CREATE INDEX IF NOT EXISTS idx_dim_conta_financeira_conta_api_id ON dw.dim_conta_financeira(conta_financeira_api_id);
CREATE INDEX IF NOT EXISTS idx_dim_conta_financeira_cliente_conta ON dw.dim_conta_financeira(cliente_id, conta_financeira_api_id);
CREATE INDEX IF NOT EXISTS idx_dim_conta_financeira_ativa ON dw.dim_conta_financeira(ativa);

-- Comentários
COMMENT ON TABLE dw.dim_conta_financeira IS 'Dimensão de contas financeiras';
COMMENT ON COLUMN dw.dim_conta_financeira.conta_financeira_api_id IS 'ID da conta financeira na API Conta Azul (contas_financeiras.conta_financeira_id)';

-- ============================================
-- DIMENSÃO: dim_vendedor
-- Vendedores
-- ============================================
CREATE TABLE IF NOT EXISTS dw.dim_vendedor (
    vendedor_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    vendedor_api_id TEXT NOT NULL, -- ID do vendedor na API (vendedores.vendedor_id)
    
    nome TEXT NOT NULL,
    ativo BOOLEAN DEFAULT TRUE, -- Assumir ativo se não houver flag na tabela origem
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(cliente_id, vendedor_api_id)
);

-- Índices para dim_vendedor
CREATE INDEX IF NOT EXISTS idx_dim_vendedor_cliente_id ON dw.dim_vendedor(cliente_id);
CREATE INDEX IF NOT EXISTS idx_dim_vendedor_vendedor_api_id ON dw.dim_vendedor(vendedor_api_id);
CREATE INDEX IF NOT EXISTS idx_dim_vendedor_cliente_vendedor ON dw.dim_vendedor(cliente_id, vendedor_api_id);
CREATE INDEX IF NOT EXISTS idx_dim_vendedor_ativo ON dw.dim_vendedor(ativo);

-- Comentários
COMMENT ON TABLE dw.dim_vendedor IS 'Dimensão de vendedores';
COMMENT ON COLUMN dw.dim_vendedor.vendedor_api_id IS 'ID do vendedor na API Conta Azul (vendedores.vendedor_id)';

-- ============================================
-- FATO: fato_contas_financeiras
-- Fato unificado de contas a pagar e receber
-- ============================================
CREATE TABLE IF NOT EXISTS dw.fato_contas_financeiras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    
    -- Chaves estrangeiras para dimensões
    data_id INTEGER REFERENCES dw.dim_calendario(data_id),
    categoria_id UUID REFERENCES dw.dim_categoria(categoria_id),
    categoria_dre_id UUID REFERENCES dw.dim_categoria_dre(categoria_dre_id), -- Relação com categoria DRE através de categoria financeira
    centro_custo_id UUID REFERENCES dw.dim_centro_custo(centro_custo_id),
    pessoa_id UUID REFERENCES dw.dim_pessoa(pessoa_id), -- Fornecedor (PAGAR) ou Cliente (RECEBER)
    conta_financeira_id UUID REFERENCES dw.dim_conta_financeira(conta_financeira_id),
    
    -- Identificadores da origem
    conta_id TEXT NOT NULL, -- ID da conta (conta_pagar_id ou conta_receber_id)
    parcela_id TEXT NOT NULL, -- ID da parcela
    
    -- Flag de tipo
    tipo BOOLEAN NOT NULL, -- TRUE = PAGAR, FALSE = RECEBER
    
    -- Medidas
    valor_rateio NUMERIC(15,2) NOT NULL,
    valor_total_parcela NUMERIC(15,2) NOT NULL,
    valor_pago NUMERIC(15,2) NOT NULL DEFAULT 0,
    valor_nao_pago NUMERIC(15,2) NOT NULL DEFAULT 0,
    
    -- Dimensões adicionais
    status TEXT,
    data_vencimento DATE,
    data_criacao TIMESTAMP WITH TIME ZONE,
    data_alteracao TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(cliente_id, conta_id, parcela_id, categoria_id, centro_custo_id)
);

-- Adicionar coluna categoria_dre_id se não existir (para tabelas já criadas)
ALTER TABLE dw.fato_contas_financeiras 
ADD COLUMN IF NOT EXISTS categoria_dre_id UUID REFERENCES dw.dim_categoria_dre(categoria_dre_id);

-- Índices para fato_contas_financeiras
CREATE INDEX IF NOT EXISTS idx_fato_contas_fin_cliente_id ON dw.fato_contas_financeiras(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fato_contas_fin_data_id ON dw.fato_contas_financeiras(data_id);
CREATE INDEX IF NOT EXISTS idx_fato_contas_fin_categoria_id ON dw.fato_contas_financeiras(categoria_id);
CREATE INDEX IF NOT EXISTS idx_fato_contas_fin_categoria_dre_id ON dw.fato_contas_financeiras(categoria_dre_id);
CREATE INDEX IF NOT EXISTS idx_fato_contas_fin_centro_custo_id ON dw.fato_contas_financeiras(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_fato_contas_fin_pessoa_id ON dw.fato_contas_financeiras(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_fato_contas_fin_tipo ON dw.fato_contas_financeiras(tipo);
CREATE INDEX IF NOT EXISTS idx_fato_contas_fin_data_vencimento ON dw.fato_contas_financeiras(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_fato_contas_fin_cliente_data_tipo ON dw.fato_contas_financeiras(cliente_id, data_id, tipo);

-- Comentários
COMMENT ON TABLE dw.fato_contas_financeiras IS 'Fato unificado de contas a pagar e receber. Uma linha por rateio de cada parcela.';
COMMENT ON COLUMN dw.fato_contas_financeiras.tipo IS 'TRUE = Conta a Pagar, FALSE = Conta a Receber';
COMMENT ON COLUMN dw.fato_contas_financeiras.pessoa_id IS 'Referência a fornecedor (se tipo=TRUE) ou cliente (se tipo=FALSE)';
COMMENT ON COLUMN dw.fato_contas_financeiras.categoria_dre_id IS 'Referência à categoria DRE relacionada através da categoria financeira (dim_categoria.categoria_api_id = dim_categoria_dre.categoria_financeira_id)';

-- ============================================
-- FATO: fato_vendas
-- Fato de vendas
-- ============================================
CREATE TABLE IF NOT EXISTS dw.fato_vendas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    
    -- Chaves estrangeiras para dimensões
    data_id INTEGER REFERENCES dw.dim_calendario(data_id),
    vendedor_id UUID REFERENCES dw.dim_vendedor(vendedor_id),
    cliente_venda_id UUID REFERENCES dw.dim_pessoa(pessoa_id), -- Cliente da venda
    
    -- Identificadores da origem
    venda_id TEXT NOT NULL, -- ID da venda
    
    -- Campos da Venda
    venda_status TEXT, -- Status da venda (venda.status)
    venda_tipo_negociacao TEXT, -- Tipo de negociação (venda.tipo_negociacao)
    venda_numero INTEGER, -- Número da venda (venda.numero)
    venda_versao INTEGER, -- Versão da venda (venda.versao)
    
    -- Medidas - Composição de Valor
    valor_total NUMERIC(15,2) NOT NULL, -- Valor total (mantido para compatibilidade)
    valor_bruto NUMERIC(15,2), -- Valor bruto (composicao_valor.valor_bruto)
    valor_desconto NUMERIC(15,2), -- Valor do desconto (composicao_valor.desconto)
    valor_frete NUMERIC(15,2), -- Valor do frete (composicao_valor.frete)
    valor_impostos NUMERIC(15,2), -- Valor dos impostos (composicao_valor.impostos)
    valor_impostos_deduzidos NUMERIC(15,2), -- Impostos deduzidos (composicao_valor.impostos_deduzidos)
    valor_seguro NUMERIC(15,2), -- Valor do seguro (composicao_valor.seguro)
    valor_despesas_incidentais NUMERIC(15,2), -- Despesas incidentais (composicao_valor.despesas_incidentais)
    valor_liquido NUMERIC(15,2), -- Valor líquido (composicao_valor.valor_liquido)
    
    -- Contagem de Itens
    contagem_produtos INTEGER, -- Quantidade de produtos (total_itens.contagem_produtos)
    contagem_servicos INTEGER, -- Quantidade de serviços (total_itens.contagem_servicos)
    contagem_nao_conciliados INTEGER, -- Itens não conciliados (total_itens.contagem_nao_conciliados)
    
    -- Dimensões Adicionais (FKs)
    categoria_id UUID REFERENCES dw.dim_categoria(categoria_id), -- Categoria da venda
    centro_custo_id UUID REFERENCES dw.dim_centro_custo(centro_custo_id), -- Centro de custo
    conta_financeira_id UUID REFERENCES dw.dim_conta_financeira(conta_financeira_id), -- Conta financeira da condição de pagamento
    
    -- Condição de Pagamento
    condicao_pagamento_tipo TEXT, -- Tipo de pagamento (condicao_pagamento.tipo_pagamento)
    condicao_pagamento_pagamento_a_vista BOOLEAN, -- Se é à vista (condicao_pagamento.pagamento_a_vista)
    condicao_pagamento_opcao TEXT, -- Opção de condição de pagamento (condicao_pagamento.opcao_condicao_pagamento)
    
    -- Situação e Pendência
    situacao TEXT, -- Situação da venda (mantido para compatibilidade, equivalente a situacao_nome)
    situacao_descricao TEXT, -- Descrição da situação (situacao.descricao)
    situacao_ativado BOOLEAN, -- Se situação está ativada (situacao.ativado)
    tipo_pendencia_nome TEXT, -- Nome do tipo de pendência (tipo_pendencia.nome)
    tipo_pendencia_descricao TEXT, -- Descrição da pendência (tipo_pendencia.descricao)
    
    -- Configuração de Desconto
    desconto_tipo TEXT, -- Tipo de desconto (configuracao_de_desconto.tipo_desconto)
    desconto_taxa NUMERIC(10,2), -- Taxa de desconto (configuracao_de_desconto.taxa_desconto)
    
    -- Dimensões adicionais (mantidas para compatibilidade)
    tipo TEXT, -- Tipo da venda (PRODUTO, SERVICO, etc.)
    data_venda DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(cliente_id, venda_id)
);

-- ============================================
-- Garantir que colunas expandidas existem (para tabelas já criadas)
-- ============================================
ALTER TABLE dw.fato_vendas 
ADD COLUMN IF NOT EXISTS venda_status TEXT,
ADD COLUMN IF NOT EXISTS venda_tipo_negociacao TEXT,
ADD COLUMN IF NOT EXISTS venda_numero INTEGER,
ADD COLUMN IF NOT EXISTS venda_versao INTEGER,
ADD COLUMN IF NOT EXISTS valor_bruto NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_desconto NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_frete NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_impostos NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_impostos_deduzidos NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_seguro NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_despesas_incidentais NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS contagem_produtos INTEGER,
ADD COLUMN IF NOT EXISTS contagem_servicos INTEGER,
ADD COLUMN IF NOT EXISTS contagem_nao_conciliados INTEGER,
ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES dw.dim_categoria(categoria_id),
ADD COLUMN IF NOT EXISTS centro_custo_id UUID REFERENCES dw.dim_centro_custo(centro_custo_id),
ADD COLUMN IF NOT EXISTS conta_financeira_id UUID REFERENCES dw.dim_conta_financeira(conta_financeira_id),
ADD COLUMN IF NOT EXISTS condicao_pagamento_tipo TEXT,
ADD COLUMN IF NOT EXISTS condicao_pagamento_pagamento_a_vista BOOLEAN,
ADD COLUMN IF NOT EXISTS condicao_pagamento_opcao TEXT,
ADD COLUMN IF NOT EXISTS situacao_descricao TEXT,
ADD COLUMN IF NOT EXISTS situacao_ativado BOOLEAN,
ADD COLUMN IF NOT EXISTS tipo_pendencia_nome TEXT,
ADD COLUMN IF NOT EXISTS tipo_pendencia_descricao TEXT,
ADD COLUMN IF NOT EXISTS desconto_tipo TEXT,
ADD COLUMN IF NOT EXISTS desconto_taxa NUMERIC(10,2);

-- Índices para fato_vendas
CREATE INDEX IF NOT EXISTS idx_fato_vendas_cliente_id ON dw.fato_vendas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_data_id ON dw.fato_vendas(data_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_vendedor_id ON dw.fato_vendas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_cliente_venda_id ON dw.fato_vendas(cliente_venda_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_data_venda ON dw.fato_vendas(data_venda);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_cliente_data ON dw.fato_vendas(cliente_id, data_id);

-- Índices para novos campos frequentemente consultados
CREATE INDEX IF NOT EXISTS idx_fato_vendas_venda_status ON dw.fato_vendas(venda_status);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_venda_tipo_negociacao ON dw.fato_vendas(venda_tipo_negociacao);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_venda_numero ON dw.fato_vendas(venda_numero);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_categoria_id ON dw.fato_vendas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_centro_custo_id ON dw.fato_vendas(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_conta_financeira_id ON dw.fato_vendas(conta_financeira_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_condicao_pagamento_tipo ON dw.fato_vendas(condicao_pagamento_tipo);

-- Comentários
COMMENT ON TABLE dw.fato_vendas IS 'Fato de vendas com composição de valor detalhada, dimensões e medidas expandidas';
COMMENT ON COLUMN dw.fato_vendas.cliente_venda_id IS 'Referência ao cliente que realizou a venda (dim_pessoa)';
COMMENT ON COLUMN dw.fato_vendas.venda_status IS 'Status da venda. Extraído de vendas_detalhadas.venda_status';
COMMENT ON COLUMN dw.fato_vendas.valor_liquido IS 'Valor líquido da venda. Extraído de vendas_detalhadas.composicao_valor_liquido';
COMMENT ON COLUMN dw.fato_vendas.categoria_id IS 'Referência à categoria da venda (dim_categoria)';
COMMENT ON COLUMN dw.fato_vendas.centro_custo_id IS 'Referência ao centro de custo da venda (dim_centro_custo)';
COMMENT ON COLUMN dw.fato_vendas.conta_financeira_id IS 'Referência à conta financeira da condição de pagamento (dim_conta_financeira)';

-- ============================================
-- FATO: fato_vendas_itens
-- Fato de itens de vendas
-- ============================================
CREATE TABLE IF NOT EXISTS dw.fato_vendas_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    
    -- Chaves estrangeiras para dimensões
    data_id INTEGER REFERENCES dw.dim_calendario(data_id),
    venda_id TEXT NOT NULL, -- ID da venda (referência a fato_vendas.venda_id)
    
    -- Identificadores do item
    item_id TEXT, -- ID do item
    
    -- Medidas
    quantidade NUMERIC(15,4) NOT NULL,
    valor_unitario NUMERIC(15,2) NOT NULL,
    valor_total NUMERIC(15,2) NOT NULL,
    desconto NUMERIC(15,2) DEFAULT 0,
    
    -- Referências opcionais (podem ser NULL se não for produto/serviço cadastrado)
    produto_id TEXT, -- ID do produto (se aplicável)
    servico_id TEXT, -- ID do serviço (se aplicável)
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(cliente_id, venda_id, item_id)
);

-- Índices para fato_vendas_itens
CREATE INDEX IF NOT EXISTS idx_fato_vendas_itens_cliente_id ON dw.fato_vendas_itens(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_itens_data_id ON dw.fato_vendas_itens(data_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_itens_venda_id ON dw.fato_vendas_itens(venda_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_itens_cliente_venda ON dw.fato_vendas_itens(cliente_id, venda_id);

-- Comentários
COMMENT ON TABLE dw.fato_vendas_itens IS 'Fato de itens de vendas. Uma linha por item de cada venda.';
COMMENT ON COLUMN dw.fato_vendas_itens.venda_id IS 'ID da venda (referência a fato_vendas.venda_id)';

-- ============================================
-- FATO: fato_contratos
-- Fato de contratos
-- ============================================
CREATE TABLE IF NOT EXISTS dw.fato_contratos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    
    -- Chaves estrangeiras para dimensões
    data_inicio_id INTEGER REFERENCES dw.dim_calendario(data_id),
    cliente_contrato_id UUID REFERENCES dw.dim_pessoa(pessoa_id),
    
    -- Identificadores da origem
    contrato_id TEXT NOT NULL, -- ID do contrato na origem
    
    -- Campos do contrato
    numero INTEGER,
    status TEXT,
    proximo_vencimento DATE,
    data_criacao TIMESTAMP WITH TIME ZONE,
    data_alteracao TIMESTAMP WITH TIME ZONE,
    versao INTEGER,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(cliente_id, contrato_id)
);

-- Índices para fato_contratos
CREATE INDEX IF NOT EXISTS idx_fato_contratos_cliente_id ON dw.fato_contratos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fato_contratos_data_inicio_id ON dw.fato_contratos(data_inicio_id);
CREATE INDEX IF NOT EXISTS idx_fato_contratos_cliente_contrato_id ON dw.fato_contratos(cliente_contrato_id);
CREATE INDEX IF NOT EXISTS idx_fato_contratos_status ON dw.fato_contratos(status);
CREATE INDEX IF NOT EXISTS idx_fato_contratos_proximo_vencimento ON dw.fato_contratos(proximo_vencimento);
CREATE INDEX IF NOT EXISTS idx_fato_contratos_cliente_data ON dw.fato_contratos(cliente_id, data_inicio_id);

-- Comentários
COMMENT ON TABLE dw.fato_contratos IS 'Fato de contratos. Uma linha por contrato.';
COMMENT ON COLUMN dw.fato_contratos.cliente_contrato_id IS 'Referência ao cliente do contrato (dim_pessoa)';
COMMENT ON COLUMN dw.fato_contratos.data_inicio_id IS 'Referência à data de início do contrato (dim_calendario)';

-- ============================================
-- FATO: fato_saldos_contas
-- Fato de saldos de contas financeiras (histórico temporal)
-- ============================================
CREATE TABLE IF NOT EXISTS dw.fato_saldos_contas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    
    -- Chaves estrangeiras para dimensões
    data_coleta_id INTEGER REFERENCES dw.dim_calendario(data_id),
    conta_financeira_id UUID REFERENCES dw.dim_conta_financeira(conta_financeira_id),
    
    -- Identificadores da origem
    conta_financeira_id_origem TEXT NOT NULL, -- ID da conta financeira na origem
    
    -- Medidas
    saldo_atual NUMERIC(15,2) NOT NULL,
    
    -- Dimensões adicionais
    data_coleta TIMESTAMP WITH TIME ZONE, -- Mantido para rastreamento temporal preciso
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para fato_saldos_contas
CREATE INDEX IF NOT EXISTS idx_fato_saldos_contas_cliente_id ON dw.fato_saldos_contas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_fato_saldos_contas_data_coleta_id ON dw.fato_saldos_contas(data_coleta_id);
CREATE INDEX IF NOT EXISTS idx_fato_saldos_contas_conta_financeira_id ON dw.fato_saldos_contas(conta_financeira_id);
CREATE INDEX IF NOT EXISTS idx_fato_saldos_contas_data_coleta ON dw.fato_saldos_contas(data_coleta DESC);
CREATE INDEX IF NOT EXISTS idx_fato_saldos_contas_cliente_conta_data ON dw.fato_saldos_contas(cliente_id, conta_financeira_id, data_coleta DESC);

-- Comentários
COMMENT ON TABLE dw.fato_saldos_contas IS 'Fato de saldos de contas financeiras. Tabela de histórico temporal - permite múltiplos registros por conta para rastreamento de variações de saldo ao longo do tempo.';
COMMENT ON COLUMN dw.fato_saldos_contas.conta_financeira_id_origem IS 'ID da conta financeira na origem (saldos_contas.conta_financeira_id)';
COMMENT ON COLUMN dw.fato_saldos_contas.data_coleta IS 'Data/hora exata da coleta do saldo. Mantido para rastreamento temporal preciso além da dimensão calendário.';
COMMENT ON COLUMN dw.fato_saldos_contas.data_coleta_id IS 'Referência à data de coleta (dim_calendario) - calculado a partir de DATE(data_coleta)';

-- ============================================
-- Triggers para updated_at automático
-- ============================================
DROP TRIGGER IF EXISTS update_dim_categoria_updated_at ON dw.dim_categoria;
CREATE TRIGGER update_dim_categoria_updated_at
    BEFORE UPDATE ON dw.dim_categoria
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dim_categoria_dre_updated_at ON dw.dim_categoria_dre;
CREATE TRIGGER update_dim_categoria_dre_updated_at
    BEFORE UPDATE ON dw.dim_categoria_dre
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dim_centro_custo_updated_at ON dw.dim_centro_custo;
CREATE TRIGGER update_dim_centro_custo_updated_at
    BEFORE UPDATE ON dw.dim_centro_custo
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dim_pessoa_updated_at ON dw.dim_pessoa;
CREATE TRIGGER update_dim_pessoa_updated_at
    BEFORE UPDATE ON dw.dim_pessoa
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dim_conta_financeira_updated_at ON dw.dim_conta_financeira;
CREATE TRIGGER update_dim_conta_financeira_updated_at
    BEFORE UPDATE ON dw.dim_conta_financeira
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dim_vendedor_updated_at ON dw.dim_vendedor;
CREATE TRIGGER update_dim_vendedor_updated_at
    BEFORE UPDATE ON dw.dim_vendedor
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fato_contas_financeiras_updated_at ON dw.fato_contas_financeiras;
CREATE TRIGGER update_fato_contas_financeiras_updated_at
    BEFORE UPDATE ON dw.fato_contas_financeiras
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fato_vendas_updated_at ON dw.fato_vendas;
CREATE TRIGGER update_fato_vendas_updated_at
    BEFORE UPDATE ON dw.fato_vendas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fato_vendas_itens_updated_at ON dw.fato_vendas_itens;
CREATE TRIGGER update_fato_vendas_itens_updated_at
    BEFORE UPDATE ON dw.fato_vendas_itens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fato_contratos_updated_at ON dw.fato_contratos;
CREATE TRIGGER update_fato_contratos_updated_at
    BEFORE UPDATE ON dw.fato_contratos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fato_saldos_contas_updated_at ON dw.fato_saldos_contas;
CREATE TRIGGER update_fato_saldos_contas_updated_at
    BEFORE UPDATE ON dw.fato_saldos_contas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS PARA POWER BI
-- ============================================

-- View de Fluxo de Caixa
CREATE OR REPLACE VIEW dw.vw_fluxo_caixa AS
SELECT 
    c.data,
    c.ano,
    c.mes,
    c.trimestre,
    c.ano_mes,
    c.ano_trimestre,
    f.cliente_id,
    f.tipo, -- TRUE=PAGAR, FALSE=RECEBER
    SUM(f.valor_pago) AS total_pago,
    SUM(f.valor_nao_pago) AS total_nao_pago,
    SUM(f.valor_total_parcela) AS total_parcela,
    COUNT(*) AS quantidade_parcelas
FROM dw.fato_contas_financeiras f
INNER JOIN dw.dim_calendario c ON f.data_id = c.data_id
WHERE f.data_vencimento IS NOT NULL
GROUP BY c.data, c.ano, c.mes, c.trimestre, c.ano_mes, c.ano_trimestre, f.cliente_id, f.tipo
ORDER BY c.data DESC, f.tipo;

COMMENT ON VIEW dw.vw_fluxo_caixa IS 'View de fluxo de caixa agregado por data de vencimento. Separado por tipo (PAGAR/RECEBER).';

-- View de DRE
CREATE OR REPLACE VIEW dw.vw_dre AS
SELECT 
    cd.cliente_id,
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
GROUP BY cd.cliente_id, cd.nivel_1_desc, cd.nivel_2_desc, cd.nivel_3_desc, cd.nivel_4_desc, cd.nivel_5_desc, 
         cd.descricao, c.ano, c.mes, c.trimestre, c.ano_mes, c.ano_trimestre, f.tipo
ORDER BY cd.nivel_1_desc, cd.nivel_2_desc, cd.nivel_3_desc, c.ano DESC, c.mes DESC;

COMMENT ON VIEW dw.vw_dre IS 'View de DRE (Demonstração do Resultado do Exercício) agregado por categoria DRE com hierarquia nivelada. Usa JOIN direto através da FK categoria_dre_id em fato_contas_financeiras.';

-- View de Performance de Vendedores
CREATE OR REPLACE VIEW dw.vw_performance_vendedores AS
SELECT 
    v.cliente_id,
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
LEFT JOIN dw.fato_vendas_itens vi ON v.cliente_id = vi.cliente_id AND v.venda_id = vi.venda_id
GROUP BY v.cliente_id, vd.nome, c.ano, c.mes, c.trimestre, c.ano_mes
ORDER BY c.ano DESC, c.mes DESC, valor_total_vendas DESC;

COMMENT ON VIEW dw.vw_performance_vendedores IS 'View de performance de vendedores com métricas agregadas de vendas e itens.';

-- View de Análise de Categorias
CREATE OR REPLACE VIEW dw.vw_analise_categorias AS
SELECT 
    cat.cliente_id,
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
GROUP BY cat.cliente_id, cat.nivel_1_desc, cat.nivel_2_desc, cat.nivel_3_desc, cat.nivel_4_desc, cat.nivel_5_desc,
         cat.nome, cat.tipo, c.ano, c.mes, c.trimestre, c.ano_mes, f.tipo
ORDER BY cat.nivel_1_desc, cat.nivel_2_desc, cat.nivel_3_desc, c.ano DESC, c.mes DESC;

COMMENT ON VIEW dw.vw_analise_categorias IS 'View de análise de categorias com hierarquia nivelada e totais agregados por período.';

-- View de Categoria DRE com Totalizador
-- Usa join por cliente_id + categoria_dre_api_id para identificar apenas categorias que são realmente totalizadoras
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
    mt_exato.cliente_id = dcd.cliente_id 
    AND mt_exato.categoria_dre_api_id = dcd.categoria_dre_api_id
-- Join por posição: categorias que compartilham posição com totalizadores (mas podem não ser totalizadoras)
LEFT JOIN dw.mascara_totalizadores_dre mt_posicao ON 
    mt_posicao.cliente_id = dcd.cliente_id 
    AND mt_posicao.posicao = dcd.posicao
    AND mt_posicao.categoria_dre_api_id != dcd.categoria_dre_api_id; -- Diferente do join exato

COMMENT ON VIEW dw.vw_categoria_dre_com_totalizador IS 'View que faz join entre dim_categoria_dre e mascara_totalizadores_dre. Usa join exato (cliente_id + categoria_dre_api_id) para identificar categorias que são realmente totalizadoras. Também inclui join por posição para identificar categorias que compartilham posição com totalizadores.';

