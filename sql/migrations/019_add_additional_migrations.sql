-- ============================================================================
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
