-- Funções RPC para Detalhamento de Dados
-- Funções para inserir dados detalhados expandidos no n8n

-- ============================================
-- RPC: Upsert Contas a Pagar Detalhadas
-- Insere ou atualiza dados detalhados de contas a pagar com rateio expandido
-- Recebe array de objetos já expandidos (uma linha por rateio)
-- ============================================
DROP FUNCTION IF EXISTS rpc_upsert_contas_pagar_detalhadas(UUID, JSONB);
CREATE OR REPLACE FUNCTION rpc_upsert_contas_pagar_detalhadas(
    p_cliente_uuid UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_item JSONB;
    v_conta_pagar_id TEXT;
    v_parcela_id TEXT;
    v_count INTEGER := 0;
    v_inserted INTEGER := 0;
    v_updated INTEGER := 0;
BEGIN
    -- Verificar se p_dados é um array
    IF jsonb_typeof(p_dados) != 'array' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'p_dados deve ser um array JSONB'
        );
    END IF;
    
    -- Processar cada item no array (cada item é uma linha de rateio)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        v_conta_pagar_id := v_item->>'conta_pagar_id';
        v_parcela_id := v_item->>'parcela_id';
        
        IF v_conta_pagar_id IS NULL OR v_parcela_id IS NULL THEN
            CONTINUE; -- Pular se não tem IDs obrigatórios
        END IF;
        
        -- Verificar se já existe
        IF EXISTS (
            SELECT 1 FROM contas_pagar_detalhadas 
            WHERE cliente_id = p_cliente_uuid 
              AND conta_pagar_id = v_item->>'conta_pagar_id'
              AND parcela_id = v_item->>'parcela_id'
              AND categoria_id = COALESCE(v_item->>'categoria_id', '')
              AND centro_custo_id = COALESCE(v_item->>'centro_custo_id', '')
        ) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert
        INSERT INTO contas_pagar_detalhadas (
            cliente_id,
            conta_pagar_id,
            parcela_id,
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
            fornecedor_id,
            fornecedor_nome,
            evento_id,
            evento_tipo,
            data_competencia,
            dados_originais
        )
        VALUES (
            p_cliente_uuid,
            v_item->>'conta_pagar_id',
            v_item->>'parcela_id',
            NULLIF(v_item->>'categoria_id', ''),
            NULLIF(v_item->>'categoria_nome', ''),
            NULLIF(v_item->>'centro_custo_id', ''),
            NULLIF(v_item->>'centro_custo_nome', ''),
            CASE WHEN v_item->>'valor_rateio' IS NULL OR v_item->>'valor_rateio' = 'null' THEN NULL ELSE (v_item->>'valor_rateio')::NUMERIC END,
            CASE WHEN v_item->>'valor_total_parcela' IS NULL OR v_item->>'valor_total_parcela' = 'null' THEN NULL ELSE (v_item->>'valor_total_parcela')::NUMERIC END,
            CASE WHEN v_item->>'valor_pago' IS NULL OR v_item->>'valor_pago' = 'null' THEN NULL ELSE (v_item->>'valor_pago')::NUMERIC END,
            CASE WHEN v_item->>'valor_nao_pago' IS NULL OR v_item->>'valor_nao_pago' = 'null' THEN NULL ELSE (v_item->>'valor_nao_pago')::NUMERIC END,
            CASE WHEN v_item->>'data_vencimento' IS NULL OR v_item->>'data_vencimento' = 'null' THEN NULL ELSE (v_item->>'data_vencimento')::DATE END,
            NULLIF(v_item->>'status', ''),
            NULLIF(v_item->>'status_traduzido', ''),
            NULLIF(v_item->>'fornecedor_id', ''),
            NULLIF(v_item->>'fornecedor_nome', ''),
            NULLIF(v_item->>'evento_id', ''),
            NULLIF(v_item->>'evento_tipo', ''),
            CASE WHEN v_item->>'data_competencia' IS NULL OR v_item->>'data_competencia' = 'null' THEN NULL ELSE (v_item->>'data_competencia')::DATE END,
            COALESCE(v_item->'dados_originais', '{}'::jsonb)
        )
        ON CONFLICT (cliente_id, conta_pagar_id, parcela_id, categoria_id, centro_custo_id)
        DO UPDATE SET
            categoria_nome = EXCLUDED.categoria_nome,
            centro_custo_nome = EXCLUDED.centro_custo_nome,
            valor_rateio = EXCLUDED.valor_rateio,
            valor_total_parcela = EXCLUDED.valor_total_parcela,
            valor_pago = EXCLUDED.valor_pago,
            valor_nao_pago = EXCLUDED.valor_nao_pago,
            data_vencimento = EXCLUDED.data_vencimento,
            status = EXCLUDED.status,
            status_traduzido = EXCLUDED.status_traduzido,
            fornecedor_nome = EXCLUDED.fornecedor_nome,
            evento_tipo = EXCLUDED.evento_tipo,
            data_competencia = EXCLUDED.data_competencia,
            dados_originais = EXCLUDED.dados_originais,
            updated_at = NOW();
        
        v_count := v_count + 1;
    END LOOP;
    
    -- Retornar resultado
    RETURN json_build_object(
        'success', true,
        'total_processado', v_count,
        'inseridos', v_inserted,
        'atualizados', v_updated,
        'message', format('Processados %s registros detalhados de contas a pagar', v_count)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_upsert_contas_pagar_detalhadas IS 'Insere ou atualiza dados detalhados de contas a pagar com rateio expandido. Recebe array JSONB de objetos já expandidos (uma linha por rateio).';

-- ============================================
-- RPC: Upsert Contas a Receber Detalhadas
-- Insere ou atualiza dados detalhados de contas a receber com rateio expandido
-- Recebe array de objetos já expandidos (uma linha por rateio)
-- ============================================
DROP FUNCTION IF EXISTS rpc_upsert_contas_receber_detalhadas(UUID, JSONB);
CREATE OR REPLACE FUNCTION rpc_upsert_contas_receber_detalhadas(
    p_cliente_uuid UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_item JSONB;
    v_conta_receber_id TEXT;
    v_parcela_id TEXT;
    v_count INTEGER := 0;
    v_inserted INTEGER := 0;
    v_updated INTEGER := 0;
BEGIN
    -- Verificar se p_dados é um array
    IF jsonb_typeof(p_dados) != 'array' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'p_dados deve ser um array JSONB'
        );
    END IF;
    
    -- Processar cada item no array (cada item é uma linha de rateio)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        v_conta_receber_id := v_item->>'conta_receber_id';
        v_parcela_id := v_item->>'parcela_id';
        
        IF v_conta_receber_id IS NULL OR v_parcela_id IS NULL THEN
            CONTINUE; -- Pular se não tem IDs obrigatórios
        END IF;
        
        -- Verificar se já existe
        IF EXISTS (
            SELECT 1 FROM contas_receber_detalhadas 
            WHERE cliente_id = p_cliente_uuid 
              AND conta_receber_id = v_item->>'conta_receber_id'
              AND parcela_id = v_item->>'parcela_id'
              AND categoria_id = COALESCE(v_item->>'categoria_id', '')
              AND centro_custo_id = COALESCE(v_item->>'centro_custo_id', '')
        ) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert
        INSERT INTO contas_receber_detalhadas (
            cliente_id,
            conta_receber_id,
            parcela_id,
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
            cliente_conta_id,
            cliente_conta_nome,
            evento_id,
            evento_tipo,
            data_competencia,
            dados_originais
        )
        VALUES (
            p_cliente_uuid,
            v_item->>'conta_receber_id',
            v_item->>'parcela_id',
            NULLIF(v_item->>'categoria_id', ''),
            NULLIF(v_item->>'categoria_nome', ''),
            NULLIF(v_item->>'centro_custo_id', ''),
            NULLIF(v_item->>'centro_custo_nome', ''),
            CASE WHEN v_item->>'valor_rateio' IS NULL OR v_item->>'valor_rateio' = 'null' THEN NULL ELSE (v_item->>'valor_rateio')::NUMERIC END,
            CASE WHEN v_item->>'valor_total_parcela' IS NULL OR v_item->>'valor_total_parcela' = 'null' THEN NULL ELSE (v_item->>'valor_total_parcela')::NUMERIC END,
            CASE WHEN v_item->>'valor_pago' IS NULL OR v_item->>'valor_pago' = 'null' THEN NULL ELSE (v_item->>'valor_pago')::NUMERIC END,
            CASE WHEN v_item->>'valor_nao_pago' IS NULL OR v_item->>'valor_nao_pago' = 'null' THEN NULL ELSE (v_item->>'valor_nao_pago')::NUMERIC END,
            CASE WHEN v_item->>'data_vencimento' IS NULL OR v_item->>'data_vencimento' = 'null' THEN NULL ELSE (v_item->>'data_vencimento')::DATE END,
            NULLIF(v_item->>'status', ''),
            NULLIF(v_item->>'status_traduzido', ''),
            NULLIF(v_item->>'cliente_conta_id', ''),
            NULLIF(v_item->>'cliente_conta_nome', ''),
            NULLIF(v_item->>'evento_id', ''),
            NULLIF(v_item->>'evento_tipo', ''),
            CASE WHEN v_item->>'data_competencia' IS NULL OR v_item->>'data_competencia' = 'null' THEN NULL ELSE (v_item->>'data_competencia')::DATE END,
            COALESCE(v_item->'dados_originais', '{}'::jsonb)
        )
        ON CONFLICT (cliente_id, conta_receber_id, parcela_id, categoria_id, centro_custo_id)
        DO UPDATE SET
            categoria_nome = EXCLUDED.categoria_nome,
            centro_custo_nome = EXCLUDED.centro_custo_nome,
            valor_rateio = EXCLUDED.valor_rateio,
            valor_total_parcela = EXCLUDED.valor_total_parcela,
            valor_pago = EXCLUDED.valor_pago,
            valor_nao_pago = EXCLUDED.valor_nao_pago,
            data_vencimento = EXCLUDED.data_vencimento,
            status = EXCLUDED.status,
            status_traduzido = EXCLUDED.status_traduzido,
            cliente_conta_nome = EXCLUDED.cliente_conta_nome,
            evento_tipo = EXCLUDED.evento_tipo,
            data_competencia = EXCLUDED.data_competencia,
            dados_originais = EXCLUDED.dados_originais,
            updated_at = NOW();
        
        v_count := v_count + 1;
    END LOOP;
    
    -- Retornar resultado
    RETURN json_build_object(
        'success', true,
        'total_processado', v_count,
        'inseridos', v_inserted,
        'atualizados', v_updated,
        'message', format('Processados %s registros detalhados de contas a receber', v_count)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_upsert_contas_receber_detalhadas IS 'Insere ou atualiza dados detalhados de contas a receber com rateio expandido. Recebe array JSONB de objetos já expandidos (uma linha por rateio).';

-- ============================================
-- RPC: Upsert Vendas Itens
-- Insere ou atualiza itens detalhados de vendas
-- Recebe array de objetos já expandidos (uma linha por item)
-- ============================================
DROP FUNCTION IF EXISTS rpc_upsert_vendas_itens(UUID, JSONB);
CREATE OR REPLACE FUNCTION rpc_upsert_vendas_itens(
    p_cliente_uuid UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_item JSONB;
    v_venda_id TEXT;
    v_item_id TEXT;
    v_count INTEGER := 0;
    v_inserted INTEGER := 0;
    v_updated INTEGER := 0;
BEGIN
    -- Verificar se p_dados é um array
    IF jsonb_typeof(p_dados) != 'array' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'p_dados deve ser um array JSONB'
        );
    END IF;
    
    -- Processar cada item no array
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        v_venda_id := v_item->>'venda_id';
        v_item_id := v_item->>'item_id' || COALESCE(v_item->>'produto_id', '') || COALESCE(v_item->>'servico_id', '');
        
        IF v_venda_id IS NULL THEN
            CONTINUE; -- Pular se não tem ID obrigatório
        END IF;
        
        -- Verificar se já existe
        IF EXISTS (
            SELECT 1 FROM vendas_itens 
            WHERE cliente_id = p_cliente_uuid 
              AND venda_id = v_item->>'venda_id'
              AND item_id = COALESCE(v_item->>'item_id', v_item_id)
        ) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert
        INSERT INTO vendas_itens (
            cliente_id,
            venda_id,
            item_id,
            produto_id,
            produto_nome,
            servico_id,
            servico_nome,
            quantidade,
            valor_unitario,
            valor_total,
            desconto,
            valor_liquido,
            unidade_medida,
            codigo,
            descricao,
            dados_originais
        )
        VALUES (
            p_cliente_uuid,
            v_item->>'venda_id',
            COALESCE(NULLIF(v_item->>'item_id', ''), v_item_id),
            NULLIF(v_item->>'produto_id', ''),
            NULLIF(v_item->>'produto_nome', ''),
            NULLIF(v_item->>'servico_id', ''),
            NULLIF(v_item->>'servico_nome', ''),
            CASE WHEN v_item->>'quantidade' IS NULL OR v_item->>'quantidade' = 'null' THEN NULL ELSE (v_item->>'quantidade')::NUMERIC END,
            CASE WHEN v_item->>'valor_unitario' IS NULL OR v_item->>'valor_unitario' = 'null' THEN NULL ELSE (v_item->>'valor_unitario')::NUMERIC END,
            CASE WHEN v_item->>'valor_total' IS NULL OR v_item->>'valor_total' = 'null' THEN NULL ELSE (v_item->>'valor_total')::NUMERIC END,
            CASE WHEN v_item->>'desconto' IS NULL OR v_item->>'desconto' = 'null' THEN 0 ELSE (v_item->>'desconto')::NUMERIC END,
            CASE 
                WHEN v_item->>'valor_liquido' IS NOT NULL AND v_item->>'valor_liquido' != 'null' THEN (v_item->>'valor_liquido')::NUMERIC
                WHEN v_item->>'valor_total' IS NOT NULL AND v_item->>'valor_total' != 'null' THEN (v_item->>'valor_total')::NUMERIC - COALESCE((v_item->>'desconto')::NUMERIC, 0)
                ELSE NULL
            END,
            NULLIF(v_item->>'unidade_medida', ''),
            NULLIF(v_item->>'codigo', ''),
            NULLIF(v_item->>'descricao', ''),
            COALESCE(v_item->'dados_originais', '{}'::jsonb)
        )
        ON CONFLICT (cliente_id, venda_id, item_id)
        DO UPDATE SET
            produto_id = EXCLUDED.produto_id,
            produto_nome = EXCLUDED.produto_nome,
            servico_id = EXCLUDED.servico_id,
            servico_nome = EXCLUDED.servico_nome,
            quantidade = EXCLUDED.quantidade,
            valor_unitario = EXCLUDED.valor_unitario,
            valor_total = EXCLUDED.valor_total,
            desconto = EXCLUDED.desconto,
            valor_liquido = EXCLUDED.valor_liquido,
            unidade_medida = EXCLUDED.unidade_medida,
            codigo = EXCLUDED.codigo,
            descricao = EXCLUDED.descricao,
            dados_originais = EXCLUDED.dados_originais,
            updated_at = NOW();
        
        v_count := v_count + 1;
    END LOOP;
    
    -- Retornar resultado
    RETURN json_build_object(
        'success', true,
        'total_processado', v_count,
        'inseridos', v_inserted,
        'atualizados', v_updated,
        'message', format('Processados %s itens de vendas', v_count)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_upsert_vendas_itens IS 'Insere ou atualiza itens detalhados de vendas. Recebe array JSONB de objetos já expandidos (uma linha por item).';

-- ============================================
-- RPC: Marcar Conta como Detalhada
-- Marca conta a pagar ou receber como detalhada
-- ============================================
DROP FUNCTION IF EXISTS rpc_marcar_conta_detalhada(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION rpc_marcar_conta_detalhada(
    p_cliente_uuid UUID,
    p_conta_id TEXT,
    p_tipo TEXT -- 'PAGAR' ou 'RECEBER'
)
RETURNS JSON AS $$
BEGIN
    IF p_tipo = 'PAGAR' THEN
        UPDATE contas_pagar
        SET detalhado = TRUE,
            data_detalhamento = NOW()
        WHERE cliente_id = p_cliente_uuid
          AND conta_pagar_id = p_conta_id;
    ELSIF p_tipo = 'RECEBER' THEN
        UPDATE contas_receber
        SET detalhado = TRUE,
            data_detalhamento = NOW()
        WHERE cliente_id = p_cliente_uuid
          AND conta_receber_id = p_conta_id;
    ELSE
        RETURN json_build_object(
            'success', false,
            'error', 'Tipo deve ser PAGAR ou RECEBER'
        );
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'message', format('Conta %s marcada como detalhada', p_tipo)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_marcar_conta_detalhada IS 'Marca uma conta a pagar ou receber como detalhada. Atualiza flag detalhado e data_detalhamento.';

-- ============================================
-- RPC: Marcar Venda como Itens Detalhados
-- Marca venda como tendo itens detalhados
-- ============================================
DROP FUNCTION IF EXISTS rpc_marcar_venda_itens_detalhados(UUID, TEXT);
CREATE OR REPLACE FUNCTION rpc_marcar_venda_itens_detalhados(
    p_cliente_uuid UUID,
    p_venda_id TEXT
)
RETURNS JSON AS $$
BEGIN
    UPDATE vendas
    SET itens_detalhados = TRUE
    WHERE cliente_id = p_cliente_uuid
      AND venda_id = p_venda_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Venda marcada como itens detalhados'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_marcar_venda_itens_detalhados IS 'Marca uma venda como tendo itens detalhados. Atualiza flag itens_detalhados.';

-- ============================================
-- RPC: Buscar Contas Não Detalhadas
-- Retorna lista de contas a pagar ou receber que ainda não foram detalhadas
-- ============================================
DROP FUNCTION IF EXISTS rpc_get_contas_nao_detalhadas(UUID, TEXT, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION rpc_get_contas_nao_detalhadas(
    p_cliente_uuid UUID,
    p_tipo TEXT, -- 'PAGAR' ou 'RECEBER'
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    v_result JSONB;
    v_count INTEGER;
BEGIN
    IF p_tipo = 'PAGAR' THEN
        -- Buscar contas a pagar não detalhadas
        SELECT 
            jsonb_agg(
                jsonb_build_object(
                    'conta_pagar_id', conta_pagar_id,
                    'cliente_id', cliente_id
                )
            ),
            COUNT(*)
        INTO v_result, v_count
        FROM contas_pagar
        WHERE cliente_id = p_cliente_uuid
          AND detalhado = FALSE
        LIMIT p_limit
        OFFSET p_offset;
        
    ELSIF p_tipo = 'RECEBER' THEN
        -- Buscar contas a receber não detalhadas
        SELECT 
            jsonb_agg(
                jsonb_build_object(
                    'conta_receber_id', conta_receber_id,
                    'cliente_id', cliente_id
                )
            ),
            COUNT(*)
        INTO v_result, v_count
        FROM contas_receber
        WHERE cliente_id = p_cliente_uuid
          AND detalhado = FALSE
        LIMIT p_limit
        OFFSET p_offset;
    ELSE
        RETURN json_build_object(
            'success', false,
            'error', 'Tipo deve ser PAGAR ou RECEBER'
        );
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'total', v_count,
        'itens', COALESCE(v_result, '[]'::jsonb)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_get_contas_nao_detalhadas IS 'Retorna lista de contas a pagar ou receber que ainda não foram detalhadas, com paginação.';

-- ============================================
-- RPC: Buscar Vendas Sem Itens Detalhados
-- Retorna lista de vendas que ainda não tiveram itens detalhados
-- ============================================
DROP FUNCTION IF EXISTS rpc_get_vendas_sem_itens_detalhados(UUID, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION rpc_get_vendas_sem_itens_detalhados(
    p_cliente_uuid UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    v_result JSONB;
    v_count INTEGER;
BEGIN
    SELECT 
        jsonb_agg(
            jsonb_build_object(
                'venda_id', venda_id,
                'cliente_id', cliente_id
            )
        ),
        COUNT(*)
    INTO v_result, v_count
    FROM vendas
    WHERE cliente_id = p_cliente_uuid
      AND itens_detalhados = FALSE
    LIMIT p_limit
    OFFSET p_offset;
    
    RETURN json_build_object(
        'success', true,
        'total', v_count,
        'itens', COALESCE(v_result, '[]'::jsonb)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_get_vendas_sem_itens_detalhados IS 'Retorna lista de vendas que ainda não tiveram itens detalhados, com paginação.';

-- ============================================
-- RPC: Buscar Vendas Sem Detalhamento
-- Retorna lista de vendas que ainda não foram detalhadas (não estão em vendas_detalhadas)
-- ============================================
DROP FUNCTION IF EXISTS rpc_get_vendas_sem_detalhamento(UUID, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION rpc_get_vendas_sem_detalhamento(
    p_cliente_uuid UUID,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    v_result JSONB;
    v_count INTEGER;
BEGIN
    -- Buscar vendas que não estão na tabela vendas_detalhadas
    SELECT 
        jsonb_agg(
            jsonb_build_object(
                'venda_id', v.venda_id,
                'cliente_id', v.cliente_id
            )
        ),
        COUNT(*)
    INTO v_result, v_count
    FROM vendas v
    WHERE v.cliente_id = p_cliente_uuid
      AND NOT EXISTS (
          SELECT 1 
          FROM vendas_detalhadas vd 
          WHERE vd.cliente_id = v.cliente_id 
            AND vd.venda_id = v.venda_id
      )
    LIMIT p_limit
    OFFSET p_offset;
    
    RETURN json_build_object(
        'success', true,
        'total', v_count,
        'itens', COALESCE(v_result, '[]'::jsonb)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_get_vendas_sem_detalhamento IS 'Retorna lista de vendas que ainda não foram detalhadas (não estão em vendas_detalhadas), com paginação.';

-- ============================================
-- RPC: Upsert Vendas Detalhadas
-- Insere ou atualiza vendas detalhadas na tabela vendas_detalhadas
-- Recebe objeto JSONB com dados da venda detalhada
-- ============================================
DROP FUNCTION IF EXISTS rpc_upsert_vendas_detalhadas(UUID, JSONB);
CREATE OR REPLACE FUNCTION rpc_upsert_vendas_detalhadas(
    p_cliente_uuid UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_venda_id TEXT;
    v_dados_originais JSONB;
    v_venda_obj JSONB;
    v_cliente_obj JSONB;
    v_inserted BOOLEAN := FALSE;
BEGIN
    -- Extrair dados principais
    v_venda_id := p_dados->>'venda_id';
    v_dados_originais := p_dados->'dados_originais';
    
    -- Extrair objetos principais do dados_originais
    IF v_dados_originais IS NOT NULL THEN
        v_venda_obj := v_dados_originais->'venda';
        v_cliente_obj := v_dados_originais->'cliente';
        
        -- Se venda_id não veio em p_dados, tentar extrair de venda.id
        IF v_venda_id IS NULL AND v_venda_obj IS NOT NULL THEN
            v_venda_id := v_venda_obj->>'id';
        END IF;
    END IF;
    
    IF v_venda_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'venda_id é obrigatório'
        );
    END IF;
    
    -- Verificar se já existe
    IF NOT EXISTS (
        SELECT 1 FROM vendas_detalhadas
        WHERE cliente_id = p_cliente_uuid
          AND venda_id = v_venda_id
    ) THEN
        v_inserted := TRUE;
    END IF;
    
    -- Upsert com todos os campos extraídos
    INSERT INTO vendas_detalhadas (
        cliente_id,
        venda_id,
        -- Campos principais (mantidos para compatibilidade)
        data,
        total,
        situacao,
        cliente_venda_id,
        cliente_venda_nome,
        -- Campos do Cliente
        cliente_uuid,
        cliente_tipo_pessoa,
        cliente_documento,
        -- Campos do Evento Financeiro
        evento_financeiro_id,
        -- Campos de Notificação
        notificacao_id_referencia,
        notificacao_enviado_para,
        notificacao_enviado_em,
        notificacao_aberto_em,
        notificacao_status,
        -- Campos da Natureza Operação
        natureza_operacao_uuid,
        natureza_operacao_tipo_operacao,
        natureza_operacao_template_operacao,
        natureza_operacao_label,
        natureza_operacao_mudanca_financeira,
        natureza_operacao_mudanca_estoque,
        -- Campos da Venda
        venda_status,
        venda_id_legado,
        venda_tipo_negociacao,
        venda_numero,
        venda_id_categoria,
        venda_data_compromisso,
        venda_id_cliente,
        venda_versao,
        venda_id_natureza_operacao,
        venda_id_centro_custo,
        venda_introducao,
        venda_observacoes,
        -- Composição de Valor
        composicao_valor_bruto,
        composicao_desconto,
        composicao_frete,
        composicao_impostos,
        composicao_impostos_deduzidos,
        composicao_seguro,
        composicao_despesas_incidentais,
        composicao_valor_liquido,
        -- Configuração de Desconto
        configuracao_desconto_tipo,
        configuracao_desconto_taxa,
        -- Total de Itens
        total_itens_contagem_produtos,
        total_itens_contagem_servicos,
        total_itens_contagem_nao_conciliados,
        -- Situação
        situacao_nome,
        situacao_descricao,
        situacao_ativado,
        -- Tipo de Pendência
        tipo_pendencia_nome,
        tipo_pendencia_descricao,
        -- Condição de Pagamento
        condicao_pagamento_tipo,
        condicao_pagamento_id_conta_financeira,
        condicao_pagamento_pagamento_a_vista,
        condicao_pagamento_observacoes,
        condicao_pagamento_opcao_condicao_pagamento,
        condicao_pagamento_nsu,
        condicao_pagamento_cartao_tipo_bandeira,
        condicao_pagamento_cartao_codigo_transacao,
        condicao_pagamento_cartao_id_adquirente,
        -- Campos do Vendedor
        vendedor_id,
        vendedor_nome,
        vendedor_id_legado,
        -- Backup completo
        dados_originais
    )
    VALUES (
        p_cliente_uuid,
        v_venda_id,
        -- Campos principais
        CASE 
            WHEN v_venda_obj->>'data' IS NOT NULL THEN (v_venda_obj->>'data')::DATE
            WHEN v_venda_obj->>'data_compromisso' IS NOT NULL THEN (v_venda_obj->>'data_compromisso')::DATE
            WHEN v_dados_originais->>'data' IS NOT NULL THEN (v_dados_originais->>'data')::DATE
            WHEN v_dados_originais->>'data_emissao' IS NOT NULL THEN (v_dados_originais->>'data_emissao')::DATE
            ELSE NULL
        END,
        CASE 
            WHEN v_venda_obj->'composicao_valor'->>'valor_liquido' IS NOT NULL THEN (v_venda_obj->'composicao_valor'->>'valor_liquido')::NUMERIC
            WHEN v_venda_obj->>'total' IS NOT NULL AND v_venda_obj->>'total' != 'null' THEN (v_venda_obj->>'total')::NUMERIC
            WHEN v_dados_originais->>'total' IS NOT NULL AND v_dados_originais->>'total' != 'null' THEN (v_dados_originais->>'total')::NUMERIC
            ELSE NULL
        END,
        COALESCE(v_venda_obj->'situacao'->>'nome', v_dados_originais->'situacao'->>'nome'),
        COALESCE(v_venda_obj->>'id_cliente', v_cliente_obj->>'uuid', v_cliente_obj->>'id', v_dados_originais->'cliente'->>'uuid', v_dados_originais->'cliente'->>'id'),
        COALESCE(v_cliente_obj->>'nome', v_dados_originais->'cliente'->>'nome'),
        -- Campos do Cliente
        v_cliente_obj->>'uuid',
        v_cliente_obj->>'tipo_pessoa',
        v_cliente_obj->>'documento',
        -- Campos do Evento Financeiro
        v_dados_originais->'evento_financeiro'->>'id',
        -- Campos de Notificação
        v_dados_originais->'notificacao'->>'id_referencia',
        v_dados_originais->'notificacao'->>'enviado_para',
        CASE WHEN v_dados_originais->'notificacao'->>'enviado_em' IS NOT NULL THEN (v_dados_originais->'notificacao'->>'enviado_em')::TIMESTAMP WITH TIME ZONE ELSE NULL END,
        CASE WHEN v_dados_originais->'notificacao'->>'aberto_em' IS NOT NULL THEN (v_dados_originais->'notificacao'->>'aberto_em')::TIMESTAMP WITH TIME ZONE ELSE NULL END,
        v_dados_originais->'notificacao'->>'status',
        -- Campos da Natureza Operação
        v_dados_originais->'natureza_operacao'->>'uuid',
        v_dados_originais->'natureza_operacao'->>'tipo_operacao',
        v_dados_originais->'natureza_operacao'->>'template_operacao',
        v_dados_originais->'natureza_operacao'->>'label',
        CASE 
            WHEN v_dados_originais->'natureza_operacao'->>'mudanca_financeira' = 'true' THEN TRUE
            WHEN v_dados_originais->'natureza_operacao'->>'mudanca_financeira' = 'false' THEN FALSE
            WHEN v_dados_originais->'natureza_operacao'->'mudanca_financeira' IS NOT NULL 
                 AND jsonb_typeof(v_dados_originais->'natureza_operacao'->'mudanca_financeira') = 'boolean'
                 THEN (v_dados_originais->'natureza_operacao'->'mudanca_financeira')::boolean
            ELSE NULL
        END,
        v_dados_originais->'natureza_operacao'->>'mudanca_estoque',
        -- Campos da Venda
        v_venda_obj->>'status',
        v_venda_obj->>'id_legado',
        v_venda_obj->>'tipo_negociacao',
        CASE WHEN v_venda_obj->>'numero' IS NOT NULL THEN (v_venda_obj->>'numero')::INTEGER ELSE NULL END,
        v_venda_obj->>'id_categoria',
        CASE WHEN v_venda_obj->>'data_compromisso' IS NOT NULL THEN (v_venda_obj->>'data_compromisso')::DATE ELSE NULL END,
        v_venda_obj->>'id_cliente',
        CASE WHEN v_venda_obj->>'versao' IS NOT NULL THEN (v_venda_obj->>'versao')::INTEGER ELSE NULL END,
        v_venda_obj->>'id_natureza_operacao',
        v_venda_obj->>'id_centro_custo',
        v_venda_obj->>'introducao',
        v_venda_obj->>'observacoes',
        -- Composição de Valor
        CASE WHEN v_venda_obj->'composicao_valor'->>'valor_bruto' IS NOT NULL THEN (v_venda_obj->'composicao_valor'->>'valor_bruto')::NUMERIC ELSE NULL END,
        CASE WHEN v_venda_obj->'composicao_valor'->>'desconto' IS NOT NULL THEN (v_venda_obj->'composicao_valor'->>'desconto')::NUMERIC ELSE NULL END,
        CASE WHEN v_venda_obj->'composicao_valor'->>'frete' IS NOT NULL THEN (v_venda_obj->'composicao_valor'->>'frete')::NUMERIC ELSE NULL END,
        CASE WHEN v_venda_obj->'composicao_valor'->>'impostos' IS NOT NULL THEN (v_venda_obj->'composicao_valor'->>'impostos')::NUMERIC ELSE NULL END,
        CASE WHEN v_venda_obj->'composicao_valor'->>'impostos_deduzidos' IS NOT NULL THEN (v_venda_obj->'composicao_valor'->>'impostos_deduzidos')::NUMERIC ELSE NULL END,
        CASE WHEN v_venda_obj->'composicao_valor'->>'seguro' IS NOT NULL THEN (v_venda_obj->'composicao_valor'->>'seguro')::NUMERIC ELSE NULL END,
        CASE WHEN v_venda_obj->'composicao_valor'->>'despesas_incidentais' IS NOT NULL THEN (v_venda_obj->'composicao_valor'->>'despesas_incidentais')::NUMERIC ELSE NULL END,
        CASE WHEN v_venda_obj->'composicao_valor'->>'valor_liquido' IS NOT NULL THEN (v_venda_obj->'composicao_valor'->>'valor_liquido')::NUMERIC ELSE NULL END,
        -- Configuração de Desconto
        v_venda_obj->'configuracao_de_desconto'->>'tipo_desconto',
        CASE WHEN v_venda_obj->'configuracao_de_desconto'->>'taxa_desconto' IS NOT NULL THEN (v_venda_obj->'configuracao_de_desconto'->>'taxa_desconto')::NUMERIC ELSE NULL END,
        -- Total de Itens
        CASE WHEN v_venda_obj->'total_itens'->>'contagem_produtos' IS NOT NULL THEN (v_venda_obj->'total_itens'->>'contagem_produtos')::INTEGER ELSE NULL END,
        CASE WHEN v_venda_obj->'total_itens'->>'contagem_servicos' IS NOT NULL THEN (v_venda_obj->'total_itens'->>'contagem_servicos')::INTEGER ELSE NULL END,
        CASE WHEN v_venda_obj->'total_itens'->>'contagem_nao_conciliados' IS NOT NULL THEN (v_venda_obj->'total_itens'->>'contagem_nao_conciliados')::INTEGER ELSE NULL END,
        -- Situação
        v_venda_obj->'situacao'->>'nome',
        v_venda_obj->'situacao'->>'descricao',
        CASE 
            WHEN v_venda_obj->'situacao'->>'ativado' = 'true' THEN TRUE
            WHEN v_venda_obj->'situacao'->>'ativado' = 'false' THEN FALSE
            WHEN v_venda_obj->'situacao'->'ativado' IS NOT NULL 
                 AND jsonb_typeof(v_venda_obj->'situacao'->'ativado') = 'boolean'
                 THEN (v_venda_obj->'situacao'->'ativado')::boolean
            ELSE NULL
        END,
        -- Tipo de Pendência
        v_venda_obj->'tipo_pendencia'->>'nome',
        v_venda_obj->'tipo_pendencia'->>'descricao',
        -- Condição de Pagamento
        v_venda_obj->'condicao_pagamento'->>'tipo_pagamento',
        v_venda_obj->'condicao_pagamento'->>'id_conta_financeira',
        CASE 
            WHEN v_venda_obj->'condicao_pagamento'->>'pagamento_a_vista' = 'true' THEN TRUE
            WHEN v_venda_obj->'condicao_pagamento'->>'pagamento_a_vista' = 'false' THEN FALSE
            WHEN v_venda_obj->'condicao_pagamento'->'pagamento_a_vista' IS NOT NULL 
                 AND jsonb_typeof(v_venda_obj->'condicao_pagamento'->'pagamento_a_vista') = 'boolean'
                 THEN (v_venda_obj->'condicao_pagamento'->'pagamento_a_vista')::boolean
            ELSE NULL
        END,
        v_venda_obj->'condicao_pagamento'->>'observacoes_pagamento',
        v_venda_obj->'condicao_pagamento'->>'opcao_condicao_pagamento',
        v_venda_obj->'condicao_pagamento'->>'nsu',
        v_venda_obj->'condicao_pagamento'->'pagamento_cartao'->>'tipo_bandeira',
        v_venda_obj->'condicao_pagamento'->'pagamento_cartao'->>'codigo_transacao',
        v_venda_obj->'condicao_pagamento'->'pagamento_cartao'->>'id_adquirente',
        -- Campos do Vendedor
        v_dados_originais->'vendedor'->>'id',
        v_dados_originais->'vendedor'->>'nome',
        v_dados_originais->'vendedor'->>'id_legado',
        -- Backup completo
        COALESCE(v_dados_originais, p_dados, '{}'::jsonb)
    )
    ON CONFLICT (cliente_id, venda_id)
    DO UPDATE SET
        data = EXCLUDED.data,
        total = EXCLUDED.total,
        situacao = EXCLUDED.situacao,
        cliente_venda_id = EXCLUDED.cliente_venda_id,
        cliente_venda_nome = EXCLUDED.cliente_venda_nome,
        cliente_uuid = EXCLUDED.cliente_uuid,
        cliente_tipo_pessoa = EXCLUDED.cliente_tipo_pessoa,
        cliente_documento = EXCLUDED.cliente_documento,
        evento_financeiro_id = EXCLUDED.evento_financeiro_id,
        notificacao_id_referencia = EXCLUDED.notificacao_id_referencia,
        notificacao_enviado_para = EXCLUDED.notificacao_enviado_para,
        notificacao_enviado_em = EXCLUDED.notificacao_enviado_em,
        notificacao_aberto_em = EXCLUDED.notificacao_aberto_em,
        notificacao_status = EXCLUDED.notificacao_status,
        natureza_operacao_uuid = EXCLUDED.natureza_operacao_uuid,
        natureza_operacao_tipo_operacao = EXCLUDED.natureza_operacao_tipo_operacao,
        natureza_operacao_template_operacao = EXCLUDED.natureza_operacao_template_operacao,
        natureza_operacao_label = EXCLUDED.natureza_operacao_label,
        natureza_operacao_mudanca_financeira = EXCLUDED.natureza_operacao_mudanca_financeira,
        natureza_operacao_mudanca_estoque = EXCLUDED.natureza_operacao_mudanca_estoque,
        venda_status = EXCLUDED.venda_status,
        venda_id_legado = EXCLUDED.venda_id_legado,
        venda_tipo_negociacao = EXCLUDED.venda_tipo_negociacao,
        venda_numero = EXCLUDED.venda_numero,
        venda_id_categoria = EXCLUDED.venda_id_categoria,
        venda_data_compromisso = EXCLUDED.venda_data_compromisso,
        venda_id_cliente = EXCLUDED.venda_id_cliente,
        venda_versao = EXCLUDED.venda_versao,
        venda_id_natureza_operacao = EXCLUDED.venda_id_natureza_operacao,
        venda_id_centro_custo = EXCLUDED.venda_id_centro_custo,
        venda_introducao = EXCLUDED.venda_introducao,
        venda_observacoes = EXCLUDED.venda_observacoes,
        composicao_valor_bruto = EXCLUDED.composicao_valor_bruto,
        composicao_desconto = EXCLUDED.composicao_desconto,
        composicao_frete = EXCLUDED.composicao_frete,
        composicao_impostos = EXCLUDED.composicao_impostos,
        composicao_impostos_deduzidos = EXCLUDED.composicao_impostos_deduzidos,
        composicao_seguro = EXCLUDED.composicao_seguro,
        composicao_despesas_incidentais = EXCLUDED.composicao_despesas_incidentais,
        composicao_valor_liquido = EXCLUDED.composicao_valor_liquido,
        configuracao_desconto_tipo = EXCLUDED.configuracao_desconto_tipo,
        configuracao_desconto_taxa = EXCLUDED.configuracao_desconto_taxa,
        total_itens_contagem_produtos = EXCLUDED.total_itens_contagem_produtos,
        total_itens_contagem_servicos = EXCLUDED.total_itens_contagem_servicos,
        total_itens_contagem_nao_conciliados = EXCLUDED.total_itens_contagem_nao_conciliados,
        situacao_nome = EXCLUDED.situacao_nome,
        situacao_descricao = EXCLUDED.situacao_descricao,
        situacao_ativado = EXCLUDED.situacao_ativado,
        tipo_pendencia_nome = EXCLUDED.tipo_pendencia_nome,
        tipo_pendencia_descricao = EXCLUDED.tipo_pendencia_descricao,
        condicao_pagamento_tipo = EXCLUDED.condicao_pagamento_tipo,
        condicao_pagamento_id_conta_financeira = EXCLUDED.condicao_pagamento_id_conta_financeira,
        condicao_pagamento_pagamento_a_vista = EXCLUDED.condicao_pagamento_pagamento_a_vista,
        condicao_pagamento_observacoes = EXCLUDED.condicao_pagamento_observacoes,
        condicao_pagamento_opcao_condicao_pagamento = EXCLUDED.condicao_pagamento_opcao_condicao_pagamento,
        condicao_pagamento_nsu = EXCLUDED.condicao_pagamento_nsu,
        condicao_pagamento_cartao_tipo_bandeira = EXCLUDED.condicao_pagamento_cartao_tipo_bandeira,
        condicao_pagamento_cartao_codigo_transacao = EXCLUDED.condicao_pagamento_cartao_codigo_transacao,
        condicao_pagamento_cartao_id_adquirente = EXCLUDED.condicao_pagamento_cartao_id_adquirente,
        vendedor_id = EXCLUDED.vendedor_id,
        vendedor_nome = EXCLUDED.vendedor_nome,
        vendedor_id_legado = EXCLUDED.vendedor_id_legado,
        dados_originais = EXCLUDED.dados_originais,
        updated_at = NOW();
    
    -- Retornar resultado
    RETURN json_build_object(
        'success', true,
        'venda_id', v_venda_id,
        'inserido', v_inserted,
        'message', format('Venda %s %s com sucesso', v_venda_id, CASE WHEN v_inserted THEN 'inserida' ELSE 'atualizada' END)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_upsert_vendas_detalhadas IS 'Insere ou atualiza vendas detalhadas na tabela vendas_detalhadas. Recebe objeto JSONB com dados da venda detalhada.';

-- ============================================
-- RPC: Marcar Venda como Detalhada
-- Marca venda como tendo sido detalhada (atualiza flag itens_detalhados na tabela vendas)
-- ============================================
DROP FUNCTION IF EXISTS rpc_marcar_venda_detalhada(UUID, TEXT);
CREATE OR REPLACE FUNCTION rpc_marcar_venda_detalhada(
    p_cliente_uuid UUID,
    p_venda_id TEXT
)
RETURNS JSON AS $$
BEGIN
    UPDATE vendas
    SET itens_detalhados = TRUE
    WHERE cliente_id = p_cliente_uuid
      AND venda_id = p_venda_id;
    
    RETURN json_build_object(
        'success', true,
        'message', 'Venda marcada como detalhada'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_marcar_venda_detalhada IS 'Marca uma venda como tendo sido detalhada. Atualiza flag itens_detalhados na tabela vendas.';

