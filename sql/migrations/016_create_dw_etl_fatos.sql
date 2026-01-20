-- ============================================================================
-- Migration 016: Criar Funções ETL de Fatos
-- ============================================================================
-- Funções ETL para carregar fatos do Data Warehouse
-- Estas funções populam as tabelas de fato a partir das tabelas detalhadas de coleta
-- Adaptado para usar tenant_id ao invés de cliente_id e schemas corretos
-- ============================================================================

-- ============================================
-- TABELA TEMPORÁRIA: debug_logs
-- Armazena logs de debug para análise
-- ============================================
CREATE TABLE IF NOT EXISTS dw.debug_logs (
    id SERIAL PRIMARY KEY,
    session_id TEXT,
    run_id TEXT,
    hypothesis_id TEXT,
    location TEXT,
    message TEXT,
    data JSONB,
    timestamp BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debug_logs_session_run ON dw.debug_logs(session_id, run_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_hypothesis ON dw.debug_logs(hypothesis_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_timestamp ON dw.debug_logs(timestamp);

-- ============================================
-- FUNÇÃO AUXILIAR: debug_log
-- Função auxiliar para logging em modo debug
-- Armazena logs em tabela temporária
-- ============================================
CREATE OR REPLACE FUNCTION dw.debug_log(
    p_log_entry JSONB,
    p_log_file TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Inserir na tabela de logs
    INSERT INTO dw.debug_logs (
        session_id,
        run_id,
        hypothesis_id,
        location,
        message,
        data,
        timestamp
    ) VALUES (
        p_log_entry->>'sessionId',
        p_log_entry->>'runId',
        p_log_entry->>'hypothesisId',
        p_log_entry->>'location',
        p_log_entry->>'message',
        p_log_entry->'data',
        (p_log_entry->>'timestamp')::BIGINT
    );
    
    -- Tentar escrever em arquivo também (se pg_write_file disponível)
    IF p_log_file IS NOT NULL THEN
        BEGIN
            PERFORM pg_write_file(p_log_file, p_log_entry::text || E'\n', true);
        EXCEPTION WHEN OTHERS THEN
            -- Ignorar erro de arquivo, já salvamos na tabela
            NULL;
        END;
    END IF;
END;
$$;

COMMENT ON FUNCTION dw.debug_log(JSONB, TEXT) IS 'Função auxiliar para logging em modo debug. Armazena logs na tabela dw.debug_logs e tenta escrever em arquivo se pg_write_file disponível.';

-- Função para limpar logs antigos
CREATE OR REPLACE FUNCTION dw.debug_logs_cleanup(p_older_than_hours INTEGER DEFAULT 24)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    DELETE FROM dw.debug_logs
    WHERE created_at < NOW() - (p_older_than_hours || ' hours')::INTERVAL;
    
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted;
END;
$$;

-- ============================================
-- FUNÇÃO: carregar_fato_contas_financeiras
-- Carrega fato unificado de contas a pagar e receber
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_fato_contas_financeiras(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_registros INTEGER := 0;
    v_data_id INTEGER;
BEGIN
    -- Limpar fatos existentes para o tenant (se especificado) ou todos
    IF p_tenant_id IS NOT NULL THEN
        DELETE FROM dw.fato_contas_financeiras WHERE tenant_id = p_tenant_id;
    ELSE
        TRUNCATE TABLE dw.fato_contas_financeiras;
    END IF;
    
    -- Inserir contas a pagar detalhadas
    INSERT INTO dw.fato_contas_financeiras (
        tenant_id,
        data_id,
        categoria_id,
        categoria_dre_id,
        centro_custo_id,
        pessoa_id,
        conta_financeira_id,
        conta_id,
        parcela_id,
        tipo,
        valor_rateio,
        valor_total_parcela,
        valor_pago,
        valor_nao_pago,
        status,
        data_vencimento,
        data_criacao,
        data_alteracao
    )
    SELECT 
        cpd.tenant_id,
        dc.data_id,
        dc_cat.categoria_id,
        dc_cat_dre.categoria_dre_id, -- Relação através de categoria financeira
        dc_cc.centro_custo_id,
        dc_pessoa.pessoa_id, -- Fornecedor
        NULL::UUID AS conta_financeira_id, -- Não disponível nas tabelas detalhadas por enquanto
        cpd.conta_pagar_id,
        cpd.parcela_id,
        TRUE AS tipo, -- TRUE = PAGAR
        cpd.valor_rateio,
        cpd.valor_total_parcela,
        cpd.valor_pago,
        cpd.valor_nao_pago,
        cpd.status,
        cpd.data_vencimento,
        NULL::TIMESTAMP WITH TIME ZONE AS data_criacao,
        NULL::TIMESTAMP WITH TIME ZONE AS data_alteracao
    FROM integrations_conta_azul.contas_pagar_detalhadas cpd
    LEFT JOIN dw.dim_calendario dc ON dc.data = cpd.data_vencimento
    LEFT JOIN dw.dim_categoria dc_cat ON dc_cat.tenant_id = cpd.tenant_id 
                                     AND dc_cat.categoria_api_id = cpd.categoria_id
    LEFT JOIN (
        SELECT DISTINCT ON (tenant_id, categoria_financeira_id) 
            tenant_id,
            categoria_financeira_id,
            categoria_dre_id
        FROM dw.dim_categoria_dre
        WHERE categoria_financeira_id IS NOT NULL
    ) dc_cat_dre ON dc_cat_dre.tenant_id = cpd.tenant_id
                AND dc_cat_dre.categoria_financeira_id = dc_cat.categoria_api_id -- Relação através de categoria financeira
    LEFT JOIN dw.dim_centro_custo dc_cc ON dc_cc.tenant_id = cpd.tenant_id 
                                       AND dc_cc.centro_custo_api_id = cpd.centro_custo_id
    LEFT JOIN dw.dim_pessoa dc_pessoa ON dc_pessoa.tenant_id = cpd.tenant_id 
                                     AND dc_pessoa.pessoa_api_id = cpd.fornecedor_id
    WHERE (p_tenant_id IS NULL OR cpd.tenant_id = p_tenant_id)
    
    UNION ALL
    
    -- Inserir contas a receber detalhadas
    SELECT 
        crd.tenant_id,
        dc.data_id,
        dc_cat.categoria_id,
        dc_cat_dre.categoria_dre_id, -- Relação através de categoria financeira
        dc_cc.centro_custo_id,
        dc_pessoa.pessoa_id, -- Cliente
        NULL::UUID AS conta_financeira_id,
        crd.conta_receber_id,
        crd.parcela_id,
        FALSE AS tipo, -- FALSE = RECEBER
        crd.valor_rateio,
        crd.valor_total_parcela,
        crd.valor_pago,
        crd.valor_nao_pago,
        crd.status,
        crd.data_vencimento,
        NULL::TIMESTAMP WITH TIME ZONE AS data_criacao,
        NULL::TIMESTAMP WITH TIME ZONE AS data_alteracao
    FROM integrations_conta_azul.contas_receber_detalhadas crd
    LEFT JOIN dw.dim_calendario dc ON dc.data = crd.data_vencimento
    LEFT JOIN dw.dim_categoria dc_cat ON dc_cat.tenant_id = crd.tenant_id 
                                     AND dc_cat.categoria_api_id = crd.categoria_id
    LEFT JOIN (
        SELECT DISTINCT ON (tenant_id, categoria_financeira_id) 
            tenant_id,
            categoria_financeira_id,
            categoria_dre_id
        FROM dw.dim_categoria_dre
        WHERE categoria_financeira_id IS NOT NULL
    ) dc_cat_dre ON dc_cat_dre.tenant_id = crd.tenant_id
                AND dc_cat_dre.categoria_financeira_id = dc_cat.categoria_api_id -- Relação através de categoria financeira
    LEFT JOIN dw.dim_centro_custo dc_cc ON dc_cc.tenant_id = crd.tenant_id 
                                       AND dc_cc.centro_custo_api_id = crd.centro_custo_id
    LEFT JOIN dw.dim_pessoa dc_pessoa ON dc_pessoa.tenant_id = crd.tenant_id 
                                     AND dc_pessoa.pessoa_api_id = crd.cliente_conta_id
    WHERE (p_tenant_id IS NULL OR crd.tenant_id = p_tenant_id)
    ON CONFLICT (tenant_id, conta_id, parcela_id, categoria_id, centro_custo_id)
    DO UPDATE SET
        categoria_dre_id = EXCLUDED.categoria_dre_id,
        valor_rateio = EXCLUDED.valor_rateio,
        valor_total_parcela = EXCLUDED.valor_total_parcela,
        valor_pago = EXCLUDED.valor_pago,
        valor_nao_pago = EXCLUDED.valor_nao_pago,
        status = EXCLUDED.status,
        data_vencimento = EXCLUDED.data_vencimento,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_registros = ROW_COUNT;
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_fato_contas_financeiras(UUID) IS 'Carrega fato unificado de contas a pagar e receber. Se p_tenant_id for NULL, carrega todos os tenants.';

-- ============================================
-- FUNÇÃO: carregar_fato_vendas
-- Carrega fato de vendas a partir de vendas_detalhadas
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_fato_vendas(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_registros INTEGER;
    v_log_entry JSONB;
    v_count_null_tipo INTEGER;
    v_count_vendas_sem_match INTEGER;
    v_count_vendas_detalhadas INTEGER;
BEGIN
    -- #region agent log
    v_log_entry := jsonb_build_object(
        'sessionId', 'debug-session',
        'runId', 'run1',
        'hypothesisId', 'A',
        'location', 'etl-fatos.sql:carregar_fato_vendas:entry',
        'message', 'Function entry',
        'data', jsonb_build_object('p_tenant_id', p_tenant_id),
        'timestamp', extract(epoch from now())::bigint * 1000
    );
    PERFORM dw.debug_log(v_log_entry);
    -- #endregion
    
    -- Limpar fatos existentes para o tenant (se especificado) ou todos
    IF p_tenant_id IS NOT NULL THEN
        DELETE FROM dw.fato_vendas WHERE tenant_id = p_tenant_id;
    ELSE
        TRUNCATE TABLE dw.fato_vendas;
    END IF;
    
    -- #region agent log
    -- Contar registros em vendas_detalhadas antes do INSERT
    SELECT COUNT(*) INTO v_count_vendas_detalhadas
    FROM integrations_conta_azul.vendas_detalhadas vd
    WHERE (p_tenant_id IS NULL OR vd.tenant_id = p_tenant_id);
    
    v_log_entry := jsonb_build_object(
        'sessionId', 'debug-session',
        'runId', 'run1',
        'hypothesisId', 'A',
        'location', 'etl-fatos.sql:carregar_fato_vendas:before_insert',
        'message', 'Before INSERT - counting source records',
        'data', jsonb_build_object(
            'vendas_detalhadas_count', v_count_vendas_detalhadas,
            'p_tenant_id', p_tenant_id
        ),
        'timestamp', extract(epoch from now())::bigint * 1000
    );
    PERFORM dw.debug_log(v_log_entry);
    -- #endregion
    
    INSERT INTO dw.fato_vendas (
        tenant_id,
        data_id,
        vendedor_id,
        cliente_venda_id,
        venda_id,
        -- Campos da Venda
        venda_status,
        venda_tipo_negociacao,
        venda_numero,
        venda_versao,
        -- Medidas - Composição de Valor
        valor_total,
        valor_bruto,
        valor_desconto,
        valor_frete,
        valor_impostos,
        valor_impostos_deduzidos,
        valor_seguro,
        valor_despesas_incidentais,
        valor_liquido,
        -- Contagem de Itens
        contagem_produtos,
        contagem_servicos,
        contagem_nao_conciliados,
        -- Dimensões Adicionais (FKs)
        categoria_id,
        centro_custo_id,
        conta_financeira_id,
        -- Condição de Pagamento
        condicao_pagamento_tipo,
        condicao_pagamento_pagamento_a_vista,
        condicao_pagamento_opcao,
        -- Situação e Pendência
        situacao,
        situacao_descricao,
        situacao_ativado,
        tipo_pendencia_nome,
        tipo_pendencia_descricao,
        -- Configuração de Desconto
        desconto_tipo,
        desconto_taxa,
        -- Dimensões adicionais (mantidas para compatibilidade)
        tipo,
        data_venda
    )
    SELECT 
        vd.tenant_id,
        dc.data_id,
        dv.vendedor_id,
        dp.pessoa_id AS cliente_venda_id,
        vd.venda_id,
        -- Campos da Venda
        vd.venda_status,
        vd.venda_tipo_negociacao,
        vd.venda_numero,
        vd.venda_versao,
        -- Medidas - Composição de Valor
        vd.total AS valor_total,
        vd.composicao_valor_bruto AS valor_bruto,
        vd.composicao_desconto AS valor_desconto,
        vd.composicao_frete AS valor_frete,
        vd.composicao_impostos AS valor_impostos,
        vd.composicao_impostos_deduzidos AS valor_impostos_deduzidos,
        vd.composicao_seguro AS valor_seguro,
        vd.composicao_despesas_incidentais AS valor_despesas_incidentais,
        vd.composicao_valor_liquido AS valor_liquido,
        -- Contagem de Itens
        vd.total_itens_contagem_produtos AS contagem_produtos,
        vd.total_itens_contagem_servicos AS contagem_servicos,
        vd.total_itens_contagem_nao_conciliados AS contagem_nao_conciliados,
        -- Dimensões Adicionais (FKs)
        dc_cat.categoria_id,
        dc_cc.centro_custo_id,
        dc_cf.conta_financeira_id,
        -- Condição de Pagamento
        vd.condicao_pagamento_tipo,
        vd.condicao_pagamento_pagamento_a_vista,
        vd.condicao_pagamento_opcao_condicao_pagamento AS condicao_pagamento_opcao,
        -- Situação e Pendência
        vd.situacao_nome AS situacao, -- Usar situacao_nome para manter compatibilidade
        vd.situacao_descricao,
        vd.situacao_ativado,
        vd.tipo_pendencia_nome,
        vd.tipo_pendencia_descricao,
        -- Configuração de Desconto
        vd.configuracao_desconto_tipo AS desconto_tipo,
        vd.configuracao_desconto_taxa AS desconto_taxa,
        -- Dimensões adicionais (mantidas para compatibilidade)
        v.tipo, -- Tipo da venda obtido de vendas (não disponível em vendas_detalhadas)
        vd.data AS data_venda
    FROM integrations_conta_azul.vendas_detalhadas vd
    LEFT JOIN integrations_conta_azul.vendas v ON vd.venda_id = v.venda_id AND vd.tenant_id = v.tenant_id
    -- #region agent log
    -- Log antes do JOIN para verificar dados de entrada
    -- #endregion
    LEFT JOIN dw.dim_calendario dc ON dc.data = vd.data
    LEFT JOIN dw.dim_vendedor dv ON dv.tenant_id = vd.tenant_id 
                                 AND dv.vendedor_api_id = vd.vendedor_id
    LEFT JOIN dw.dim_pessoa dp ON dp.tenant_id = vd.tenant_id 
                               AND (dp.pessoa_api_id = vd.cliente_venda_id OR dp.pessoa_api_id = vd.cliente_uuid)
    LEFT JOIN dw.dim_categoria dc_cat ON dc_cat.tenant_id = vd.tenant_id 
                                      AND dc_cat.categoria_api_id = vd.venda_id_categoria
    LEFT JOIN dw.dim_centro_custo dc_cc ON dc_cc.tenant_id = vd.tenant_id 
                                        AND dc_cc.centro_custo_api_id = vd.venda_id_centro_custo
    LEFT JOIN dw.dim_conta_financeira dc_cf ON dc_cf.tenant_id = vd.tenant_id 
                                            AND dc_cf.conta_financeira_api_id = vd.condicao_pagamento_id_conta_financeira
    WHERE (p_tenant_id IS NULL OR vd.tenant_id = p_tenant_id)
    ON CONFLICT (tenant_id, venda_id)
    DO UPDATE SET
        data_id = EXCLUDED.data_id,
        vendedor_id = EXCLUDED.vendedor_id,
        cliente_venda_id = EXCLUDED.cliente_venda_id,
        -- Campos da Venda
        venda_status = EXCLUDED.venda_status,
        venda_tipo_negociacao = EXCLUDED.venda_tipo_negociacao,
        venda_numero = EXCLUDED.venda_numero,
        venda_versao = EXCLUDED.venda_versao,
        -- Medidas - Composição de Valor
        valor_total = EXCLUDED.valor_total,
        valor_bruto = EXCLUDED.valor_bruto,
        valor_desconto = EXCLUDED.valor_desconto,
        valor_frete = EXCLUDED.valor_frete,
        valor_impostos = EXCLUDED.valor_impostos,
        valor_impostos_deduzidos = EXCLUDED.valor_impostos_deduzidos,
        valor_seguro = EXCLUDED.valor_seguro,
        valor_despesas_incidentais = EXCLUDED.valor_despesas_incidentais,
        valor_liquido = EXCLUDED.valor_liquido,
        -- Contagem de Itens
        contagem_produtos = EXCLUDED.contagem_produtos,
        contagem_servicos = EXCLUDED.contagem_servicos,
        contagem_nao_conciliados = EXCLUDED.contagem_nao_conciliados,
        -- Dimensões Adicionais (FKs)
        categoria_id = EXCLUDED.categoria_id,
        centro_custo_id = EXCLUDED.centro_custo_id,
        conta_financeira_id = EXCLUDED.conta_financeira_id,
        -- Condição de Pagamento
        condicao_pagamento_tipo = EXCLUDED.condicao_pagamento_tipo,
        condicao_pagamento_pagamento_a_vista = EXCLUDED.condicao_pagamento_pagamento_a_vista,
        condicao_pagamento_opcao = EXCLUDED.condicao_pagamento_opcao,
        -- Situação e Pendência
        situacao = EXCLUDED.situacao,
        situacao_descricao = EXCLUDED.situacao_descricao,
        situacao_ativado = EXCLUDED.situacao_ativado,
        tipo_pendencia_nome = EXCLUDED.tipo_pendencia_nome,
        tipo_pendencia_descricao = EXCLUDED.tipo_pendencia_descricao,
        -- Configuração de Desconto
        desconto_tipo = EXCLUDED.desconto_tipo,
        desconto_taxa = EXCLUDED.desconto_taxa,
        -- Dimensões adicionais (mantidas para compatibilidade)
        tipo = EXCLUDED.tipo,
        data_venda = EXCLUDED.data_venda,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_registros = ROW_COUNT;
    
    -- #region agent log
    -- Verificar quantos registros têm tipo NULL (vendas sem match em vendas)
    SELECT COUNT(*) INTO v_count_null_tipo
    FROM dw.fato_vendas fv
    WHERE (p_tenant_id IS NULL OR fv.tenant_id = p_tenant_id)
    AND fv.tipo IS NULL;
    
    -- Verificar quantos registros em vendas_detalhadas não têm match em vendas
    SELECT COUNT(*) INTO v_count_vendas_sem_match
    FROM integrations_conta_azul.vendas_detalhadas vd
    LEFT JOIN integrations_conta_azul.vendas v ON vd.venda_id = v.venda_id AND vd.tenant_id = v.tenant_id
    WHERE (p_tenant_id IS NULL OR vd.tenant_id = p_tenant_id)
    AND v.venda_id IS NULL;
    
    v_log_entry := jsonb_build_object(
        'sessionId', 'debug-session',
        'runId', 'run1',
        'hypothesisId', 'A,F',
        'location', 'etl-fatos.sql:carregar_fato_vendas:exit',
        'message', 'Function exit with ROW_COUNT and NULL tipo checks',
        'data', jsonb_build_object(
            'row_count', v_registros,
            'p_tenant_id', p_tenant_id,
            'null_tipo_count', v_count_null_tipo,
            'vendas_sem_match_count', v_count_vendas_sem_match
        ),
        'timestamp', extract(epoch from now())::bigint * 1000
    );
    PERFORM dw.debug_log(v_log_entry);
    -- #endregion
    
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_fato_vendas(UUID) IS 'Carrega fato de vendas a partir de vendas_detalhadas com todos os campos expandidos. Se p_tenant_id for NULL, carrega todos os tenants.';

-- ============================================
-- FUNÇÃO: carregar_fato_vendas_itens
-- Carrega fato de itens de vendas
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_fato_vendas_itens(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_registros INTEGER;
BEGIN
    -- Limpar fatos existentes para o tenant (se especificado) ou todos
    IF p_tenant_id IS NOT NULL THEN
        DELETE FROM dw.fato_vendas_itens WHERE tenant_id = p_tenant_id;
    ELSE
        TRUNCATE TABLE dw.fato_vendas_itens;
    END IF;
    
    INSERT INTO dw.fato_vendas_itens (
        tenant_id,
        data_id,
        venda_id,
        item_id,
        quantidade,
        valor_unitario,
        valor_total,
        desconto,
        produto_id,
        servico_id
    )
    SELECT 
        vi.tenant_id,
        dc.data_id,
        vi.venda_id,
        vi.item_id,
        vi.quantidade,
        vi.valor_unitario,
        COALESCE(vi.valor_liquido, vi.valor_total - COALESCE(vi.desconto, 0)) AS valor_total,
        COALESCE(vi.desconto, 0) AS desconto,
        vi.produto_id,
        vi.servico_id
    FROM integrations_conta_azul.vendas_itens vi
    INNER JOIN integrations_conta_azul.vendas v ON v.tenant_id = vi.tenant_id AND v.venda_id = vi.venda_id
    LEFT JOIN dw.dim_calendario dc ON dc.data = v.data
    WHERE (p_tenant_id IS NULL OR vi.tenant_id = p_tenant_id)
    ON CONFLICT (tenant_id, venda_id, item_id)
    DO UPDATE SET
        data_id = EXCLUDED.data_id,
        quantidade = EXCLUDED.quantidade,
        valor_unitario = EXCLUDED.valor_unitario,
        valor_total = EXCLUDED.valor_total,
        desconto = EXCLUDED.desconto,
        produto_id = EXCLUDED.produto_id,
        servico_id = EXCLUDED.servico_id,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_registros = ROW_COUNT;
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_fato_vendas_itens(UUID) IS 'Carrega fato de itens de vendas. Se p_tenant_id for NULL, carrega todos os tenants.';

-- ============================================
-- FUNÇÃO: carregar_fato_contratos
-- Carrega fato de contratos
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_fato_contratos(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_registros INTEGER;
    v_log_entry JSONB;
    v_count_null_data INTEGER;
    v_count_null_pessoa INTEGER;
BEGIN
    -- #region agent log
    v_log_entry := jsonb_build_object(
        'sessionId', 'debug-session',
        'runId', 'run1',
        'hypothesisId', 'B,C',
        'location', 'etl-fatos.sql:carregar_fato_contratos:entry',
        'message', 'Function entry',
        'data', jsonb_build_object('p_tenant_id', p_tenant_id),
        'timestamp', extract(epoch from now())::bigint * 1000
    );
    PERFORM dw.debug_log(v_log_entry);
    -- #endregion
    -- Limpar fatos existentes para o tenant (se especificado) ou todos
    IF p_tenant_id IS NOT NULL THEN
        DELETE FROM dw.fato_contratos WHERE tenant_id = p_tenant_id;
    ELSE
        TRUNCATE TABLE dw.fato_contratos;
    END IF;
    
    INSERT INTO dw.fato_contratos (
        tenant_id,
        data_inicio_id,
        cliente_contrato_id,
        contrato_id,
        numero,
        status,
        proximo_vencimento,
        data_criacao,
        data_alteracao,
        versao
    )
    SELECT 
        c.tenant_id,
        dc.data_id,
        dp.pessoa_id AS cliente_contrato_id,
        c.contrato_id,
        c.numero,
        c.status,
        c.proximo_vencimento,
        c.data_criacao,
        c.data_alteracao,
        c.versao
    FROM integrations_conta_azul.contratos c
    LEFT JOIN dw.dim_calendario dc ON dc.data = c.data_inicio
    LEFT JOIN dw.dim_pessoa dp ON dp.tenant_id = c.tenant_id 
                               AND dp.pessoa_api_id = c.cliente_contrato_id
    WHERE (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
    ON CONFLICT (tenant_id, contrato_id)
    DO UPDATE SET
        data_inicio_id = EXCLUDED.data_inicio_id,
        cliente_contrato_id = EXCLUDED.cliente_contrato_id,
        numero = EXCLUDED.numero,
        status = EXCLUDED.status,
        proximo_vencimento = EXCLUDED.proximo_vencimento,
        data_criacao = EXCLUDED.data_criacao,
        data_alteracao = EXCLUDED.data_alteracao,
        versao = EXCLUDED.versao,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_registros = ROW_COUNT;
    
    -- #region agent log
    -- Verificar quantos registros têm data_inicio NULL ou não encontrada no calendário
    SELECT COUNT(*) INTO v_count_null_data
    FROM integrations_conta_azul.contratos c
    LEFT JOIN dw.dim_calendario dc ON dc.data = c.data_inicio
    WHERE (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
    AND (c.data_inicio IS NULL OR dc.data_id IS NULL);
    
    -- Verificar quantos registros têm cliente_contrato_id não encontrado em dim_pessoa
    SELECT COUNT(*) INTO v_count_null_pessoa
    FROM integrations_conta_azul.contratos c
    LEFT JOIN dw.dim_pessoa dp ON dp.tenant_id = c.tenant_id 
                               AND dp.pessoa_api_id = c.cliente_contrato_id
    WHERE (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
    AND (c.cliente_contrato_id IS NOT NULL AND dp.pessoa_id IS NULL);
    
    v_log_entry := jsonb_build_object(
        'sessionId', 'debug-session',
        'runId', 'run1',
        'hypothesisId', 'B,C,F',
        'location', 'etl-fatos.sql:carregar_fato_contratos:exit',
        'message', 'Function exit with ROW_COUNT and NULL join checks',
        'data', jsonb_build_object(
            'row_count', v_registros,
            'p_tenant_id', p_tenant_id,
            'null_data_inicio_count', v_count_null_data,
            'null_pessoa_count', v_count_null_pessoa
        ),
        'timestamp', extract(epoch from now())::bigint * 1000
    );
    PERFORM dw.debug_log(v_log_entry);
    -- #endregion
    
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_fato_contratos(UUID) IS 'Carrega fato de contratos. Se p_tenant_id for NULL, carrega todos os tenants.';

-- ============================================
-- FUNÇÃO: carregar_fato_saldos_contas
-- Carrega fato de saldos de contas financeiras (histórico temporal)
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_fato_saldos_contas(p_tenant_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_registros INTEGER;
    v_log_entry JSONB;
    v_count_null_data INTEGER;
    v_count_null_conta INTEGER;
    v_count_null_data_coleta INTEGER;
BEGIN
    -- #region agent log
    v_log_entry := jsonb_build_object(
        'sessionId', 'debug-session',
        'runId', 'run1',
        'hypothesisId', 'D,E',
        'location', 'etl-fatos.sql:carregar_fato_saldos_contas:entry',
        'message', 'Function entry',
        'data', jsonb_build_object('p_tenant_id', p_tenant_id),
        'timestamp', extract(epoch from now())::bigint * 1000
    );
    PERFORM dw.debug_log(v_log_entry);
    -- #endregion
    -- Limpar fatos existentes para o tenant (se especificado) ou todos
    IF p_tenant_id IS NOT NULL THEN
        DELETE FROM dw.fato_saldos_contas WHERE tenant_id = p_tenant_id;
    ELSE
        TRUNCATE TABLE dw.fato_saldos_contas;
    END IF;
    
    INSERT INTO dw.fato_saldos_contas (
        tenant_id,
        data_coleta_id,
        conta_financeira_id,
        conta_financeira_id_origem,
        saldo_atual,
        data_coleta
    )
    SELECT 
        sc.tenant_id,
        dc.data_id,
        dcf.conta_financeira_id,
        sc.conta_financeira_id AS conta_financeira_id_origem,
        sc.saldo_atual,
        sc.data_coleta
    FROM integrations_conta_azul.saldos_contas sc
    LEFT JOIN dw.dim_calendario dc ON dc.data = DATE(sc.data_coleta)
    LEFT JOIN dw.dim_conta_financeira dcf ON dcf.tenant_id = sc.tenant_id 
                                          AND dcf.conta_financeira_api_id = sc.conta_financeira_id
    WHERE (p_tenant_id IS NULL OR sc.tenant_id = p_tenant_id);
    -- Nota: Não usar ON CONFLICT pois permite múltiplos registros por conta (histórico temporal)
    
    -- #region agent log
    -- Verificar quantos registros têm data_coleta NULL
    SELECT COUNT(*) INTO v_count_null_data_coleta
    FROM integrations_conta_azul.saldos_contas sc
    WHERE (p_tenant_id IS NULL OR sc.tenant_id = p_tenant_id)
    AND sc.data_coleta IS NULL;
    
    -- Verificar quantos registros têm DATE(data_coleta) não encontrado no calendário
    SELECT COUNT(*) INTO v_count_null_data
    FROM integrations_conta_azul.saldos_contas sc
    LEFT JOIN dw.dim_calendario dc ON dc.data = DATE(sc.data_coleta)
    WHERE (p_tenant_id IS NULL OR sc.tenant_id = p_tenant_id)
    AND sc.data_coleta IS NOT NULL
    AND dc.data_id IS NULL;
    
    -- Verificar quantos registros têm conta_financeira_id não encontrado em dim_conta_financeira
    SELECT COUNT(*) INTO v_count_null_conta
    FROM integrations_conta_azul.saldos_contas sc
    LEFT JOIN dw.dim_conta_financeira dcf ON dcf.tenant_id = sc.tenant_id 
                                          AND dcf.conta_financeira_api_id = sc.conta_financeira_id
    WHERE (p_tenant_id IS NULL OR sc.tenant_id = p_tenant_id)
    AND sc.conta_financeira_id IS NOT NULL
    AND dcf.conta_financeira_id IS NULL;
    
    v_log_entry := jsonb_build_object(
        'sessionId', 'debug-session',
        'runId', 'run1',
        'hypothesisId', 'D,E',
        'location', 'etl-fatos.sql:carregar_fato_saldos_contas:after_insert',
        'message', 'After INSERT - checking NULL joins',
        'data', jsonb_build_object(
            'null_data_coleta_count', v_count_null_data_coleta,
            'null_calendario_count', v_count_null_data,
            'null_conta_financeira_count', v_count_null_conta
        ),
        'timestamp', extract(epoch from now())::bigint * 1000
    );
    PERFORM dw.debug_log(v_log_entry);
    -- #endregion
    
    GET DIAGNOSTICS v_registros = ROW_COUNT;
    
    -- #region agent log
    v_log_entry := jsonb_build_object(
        'sessionId', 'debug-session',
        'runId', 'run1',
        'hypothesisId', 'F',
        'location', 'etl-fatos.sql:carregar_fato_saldos_contas:exit',
        'message', 'Function exit with ROW_COUNT',
        'data', jsonb_build_object('row_count', v_registros, 'p_tenant_id', p_tenant_id),
        'timestamp', extract(epoch from now())::bigint * 1000
    );
    PERFORM dw.debug_log(v_log_entry);
    -- #endregion
    
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_fato_saldos_contas(UUID) IS 'Carrega fato de saldos de contas financeiras. Tabela de histórico temporal - permite múltiplos registros por conta. Se p_tenant_id for NULL, carrega todos os tenants.';

-- ============================================
-- FUNÇÃO: carregar_dw_completo
-- Executa todo o processo ETL em ordem (dimensões primeiro, depois fatos)
-- Retorna JSON com estatísticas de cada etapa
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_dw_completo(p_tenant_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
    v_resultado JSON;
    v_dim_calendario INTEGER;
    v_dim_categoria INTEGER;
    v_dim_categoria_dre INTEGER;
    v_dim_centro_custo INTEGER;
    v_dim_pessoa INTEGER;
    v_dim_conta_financeira INTEGER;
    v_dim_vendedor INTEGER;
    v_fato_contas_financeiras INTEGER;
    v_fato_vendas INTEGER;
    v_fato_vendas_itens INTEGER;
    v_fato_contratos INTEGER;
    v_fato_saldos_contas INTEGER;
    v_log_entry JSONB;
BEGIN
    -- #region agent log
    v_log_entry := jsonb_build_object(
        'sessionId', 'debug-session',
        'runId', 'run1',
        'hypothesisId', 'G',
        'location', 'etl-fatos.sql:carregar_dw_completo:entry',
        'message', 'Function entry - checking dimension population',
        'data', jsonb_build_object('p_tenant_id', p_tenant_id),
        'timestamp', extract(epoch from now())::bigint * 1000
    );
    PERFORM dw.debug_log(v_log_entry);
    -- #endregion
    -- Inicializar objeto de resultado
    v_resultado := json_build_object(
        'tenant_id', p_tenant_id,
        'inicio', NOW(),
        'etapas', json_build_array()
    );
    
    -- ETAPA 1: Carregar dimensão calendário (uma vez, não precisa de tenant_id)
    BEGIN
        SELECT dw.carregar_dim_calendario() INTO v_dim_calendario;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_calendario',
                'registros_inseridos', v_dim_calendario,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_calendario',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    -- ETAPA 2: Carregar dimensões (podem ser executadas em paralelo, mas executamos sequencialmente aqui)
    BEGIN
        SELECT dw.carregar_dim_categoria(p_tenant_id) INTO v_dim_categoria;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_categoria',
                'registros_inseridos', v_dim_categoria,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_categoria',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    BEGIN
        SELECT dw.carregar_dim_categoria_dre(p_tenant_id) INTO v_dim_categoria_dre;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_categoria_dre',
                'registros_inseridos', v_dim_categoria_dre,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_categoria_dre',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    BEGIN
        SELECT dw.carregar_dim_centro_custo(p_tenant_id) INTO v_dim_centro_custo;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_centro_custo',
                'registros_inseridos', v_dim_centro_custo,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_centro_custo',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    BEGIN
        SELECT dw.carregar_dim_pessoa(p_tenant_id) INTO v_dim_pessoa;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_pessoa',
                'registros_inseridos', v_dim_pessoa,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_pessoa',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    BEGIN
        SELECT dw.carregar_dim_conta_financeira(p_tenant_id) INTO v_dim_conta_financeira;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_conta_financeira',
                'registros_inseridos', v_dim_conta_financeira,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_conta_financeira',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    BEGIN
        SELECT dw.carregar_dim_vendedor(p_tenant_id) INTO v_dim_vendedor;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_vendedor',
                'registros_inseridos', v_dim_vendedor,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'dim_vendedor',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    -- ETAPA 3: Carregar fatos (após dimensões estarem populadas)
    BEGIN
        SELECT dw.carregar_fato_contas_financeiras(p_tenant_id) INTO v_fato_contas_financeiras;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_contas_financeiras',
                'registros_inseridos', v_fato_contas_financeiras,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_contas_financeiras',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    BEGIN
        SELECT dw.carregar_fato_vendas(p_tenant_id) INTO v_fato_vendas;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_vendas',
                'registros_inseridos', v_fato_vendas,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_vendas',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    BEGIN
        SELECT dw.carregar_fato_vendas_itens(p_tenant_id) INTO v_fato_vendas_itens;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_vendas_itens',
                'registros_inseridos', v_fato_vendas_itens,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_vendas_itens',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    BEGIN
        SELECT dw.carregar_fato_contratos(p_tenant_id) INTO v_fato_contratos;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_contratos',
                'registros_inseridos', v_fato_contratos,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_contratos',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    BEGIN
        SELECT dw.carregar_fato_saldos_contas(p_tenant_id) INTO v_fato_saldos_contas;
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_saldos_contas',
                'registros_inseridos', v_fato_saldos_contas,
                'sucesso', true
            ))
        )::json;
    EXCEPTION WHEN OTHERS THEN
        v_resultado := jsonb_set(
            v_resultado::jsonb,
            '{etapas}',
            (v_resultado->'etapas')::jsonb || jsonb_build_array(jsonb_build_object(
                'nome', 'fato_saldos_contas',
                'sucesso', false,
                'erro', SQLERRM
            ))
        )::json;
    END;
    
    -- Adicionar informações finais
    v_resultado := jsonb_set(v_resultado::jsonb, '{fim}', to_jsonb(NOW()))::json;
    v_resultado := jsonb_set(
        v_resultado::jsonb,
        '{duracao_segundos}',
        to_jsonb(EXTRACT(EPOCH FROM (NOW() - (v_resultado->>'inicio')::timestamp)))
    )::json;
    
    RETURN v_resultado;
END;
$$;

COMMENT ON FUNCTION dw.carregar_dw_completo(UUID) IS 'Executa todo o processo ETL do Data Warehouse em ordem: dimensões primeiro, depois fatos. Retorna JSON com estatísticas de cada etapa. Se p_tenant_id for NULL, processa todos os tenants.';


