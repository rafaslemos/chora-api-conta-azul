-- Funções RPC para Sistema de Coleta de Dados Conta Azul
-- Funções para renovação de token e controle de carga

-- ============================================
-- RPC: Obter Dados para Renovação de Token (Sempre)
-- Retorna refresh_token e credenciais OAuth para renovação
-- Usado pelos workflows de coleta para garantir token válido
-- O n8n fará a requisição HTTP e depois chamará rpc_refresh_token_simple
-- ============================================
DROP FUNCTION IF EXISTS rpc_get_token_data_for_refresh(UUID);
CREATE OR REPLACE FUNCTION rpc_get_token_data_for_refresh(
    p_cliente_uuid UUID
)
RETURNS JSON AS $$
DECLARE
    v_token RECORD;
    v_credenciais RECORD;
    v_decrypted_refresh_token TEXT;
    v_decrypted_client_secret TEXT;
BEGIN
    -- Buscar token atual do cliente
    SELECT id, refresh_token, expires_at
    INTO v_token
    FROM tokens_oauth
    WHERE cliente_id = p_cliente_uuid;
    
    -- Se não encontrou token, retornar erro
    IF v_token.id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Token não encontrado para este cliente'
        );
    END IF;
    
    -- Descriptografar refresh_token
    v_decrypted_refresh_token := decrypt_token(v_token.refresh_token);
    
    -- Buscar credenciais OAuth do cliente
    SELECT cd.client_id, cd.client_secret
    INTO v_credenciais
    FROM credenciais_dev cd
    INNER JOIN clientes c ON c.credenciais_dev_id = cd.id
    WHERE c.id = p_cliente_uuid;
    
    -- Se não encontrou credenciais, retornar erro
    IF v_credenciais.client_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Credenciais não encontradas para este cliente'
        );
    END IF;
    
    -- Descriptografar client_secret
    v_decrypted_client_secret := decrypt_token(v_credenciais.client_secret);
    
    -- Retornar dados necessários para renovação
    RETURN json_build_object(
        'success', true,
        'cliente_id', p_cliente_uuid,
        'refresh_token', v_decrypted_refresh_token,
        'client_id', v_credenciais.client_id,
        'client_secret', v_decrypted_client_secret,
        'expires_at', v_token.expires_at
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Buscar Controle de Carga
-- Busca status de carga para um cliente e entidade
-- ============================================
DROP FUNCTION IF EXISTS rpc_get_controle_carga(UUID, TEXT);
CREATE OR REPLACE FUNCTION rpc_get_controle_carga(
    p_cliente_uuid UUID,
    p_entidade_tipo TEXT
)
RETURNS JSON AS $$
DECLARE
    v_controle RECORD;
BEGIN
    -- Buscar controle de carga
    SELECT 
        id,
        cliente_id,
        entidade_tipo,
        carga_full_realizada,
        ultima_carga_full,
        ultima_carga_incremental,
        ultima_data_processada,
        created_at,
        updated_at
    INTO v_controle
    FROM controle_carga
    WHERE cliente_id = p_cliente_uuid 
      AND entidade_tipo = p_entidade_tipo;
    
    -- Se não encontrou, retornar controle padrão (carga FULL não realizada)
    IF v_controle.id IS NULL THEN
        RETURN json_build_object(
            'success', true,
            'controle', json_build_object(
                'cliente_id', p_cliente_uuid,
                'entidade_tipo', p_entidade_tipo,
                'carga_full_realizada', false,
                'ultima_carga_full', NULL,
                'ultima_carga_incremental', NULL,
                'ultima_data_processada', NULL
            )
        );
    END IF;
    
    -- Retornar controle encontrado
    RETURN json_build_object(
        'success', true,
        'controle', json_build_object(
            'id', v_controle.id,
            'cliente_id', v_controle.cliente_id,
            'entidade_tipo', v_controle.entidade_tipo,
            'carga_full_realizada', v_controle.carga_full_realizada,
            'ultima_carga_full', v_controle.ultima_carga_full,
            'ultima_carga_incremental', v_controle.ultima_carga_incremental,
            'ultima_data_processada', v_controle.ultima_data_processada,
            'created_at', v_controle.created_at,
            'updated_at', v_controle.updated_at
        )
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Atualizar Controle de Carga FULL
-- Marca carga FULL como realizada
-- ============================================
DROP FUNCTION IF EXISTS rpc_update_controle_carga_full(UUID, TEXT);
CREATE OR REPLACE FUNCTION rpc_update_controle_carga_full(
    p_cliente_uuid UUID,
    p_entidade_tipo TEXT
)
RETURNS JSON AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Tentar atualizar registro existente
    UPDATE controle_carga
    SET
        carga_full_realizada = TRUE,
        ultima_carga_full = NOW(),
        updated_at = NOW()
    WHERE cliente_id = p_cliente_uuid 
      AND entidade_tipo = p_entidade_tipo
    RETURNING id INTO v_id;
    
    -- Se não encontrou, criar novo registro
    IF v_id IS NULL THEN
        INSERT INTO controle_carga (
            cliente_id,
            entidade_tipo,
            carga_full_realizada,
            ultima_carga_full
        )
        VALUES (
            p_cliente_uuid,
            p_entidade_tipo,
            TRUE,
            NOW()
        )
        RETURNING id INTO v_id;
    END IF;
    
    -- Retornar sucesso
    RETURN json_build_object(
        'success', true,
        'id', v_id,
        'message', 'Controle de carga FULL atualizado com sucesso'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Atualizar Controle de Carga Incremental
-- Atualiza última carga incremental e data processada
-- ============================================
DROP FUNCTION IF EXISTS rpc_update_controle_carga_incremental(
    UUID, 
    TEXT, 
    TIMESTAMP WITH TIME ZONE
);
CREATE OR REPLACE FUNCTION rpc_update_controle_carga_incremental(
    p_cliente_uuid UUID,
    p_entidade_tipo TEXT,
    p_ultima_data TIMESTAMP WITH TIME ZONE
)
RETURNS JSON AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Tentar atualizar registro existente
    UPDATE controle_carga
    SET
        ultima_carga_incremental = NOW(),
        ultima_data_processada = COALESCE(p_ultima_data, NOW()),
        updated_at = NOW()
    WHERE cliente_id = p_cliente_uuid 
      AND entidade_tipo = p_entidade_tipo
    RETURNING id INTO v_id;
    
    -- Se não encontrou, criar novo registro
    IF v_id IS NULL THEN
        INSERT INTO controle_carga (
            cliente_id,
            entidade_tipo,
            carga_full_realizada,
            ultima_carga_incremental,
            ultima_data_processada
        )
        VALUES (
            p_cliente_uuid,
            p_entidade_tipo,
            FALSE, -- Ainda não fez carga FULL
            NOW(),
            COALESCE(p_ultima_data, NOW())
        )
        RETURNING id INTO v_id;
    END IF;
    
    -- Retornar sucesso
    RETURN json_build_object(
        'success', true,
        'id', v_id,
        'message', 'Controle de carga incremental atualizado com sucesso'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Listar Todos os Clientes
-- Retorna lista de todos os clientes cadastrados (todos estão ativos)
-- Usado pelo orquestrador para processar coletas
-- ============================================
DROP FUNCTION IF EXISTS rpc_list_all_clientes();
CREATE OR REPLACE FUNCTION rpc_list_all_clientes()
RETURNS JSON AS $$
DECLARE
    v_clientes JSON;
BEGIN
    -- Buscar todos os clientes usando ORDER BY dentro do json_agg
    SELECT json_agg(
        json_build_object(
            'id', id,
            'nome', nome,
            'nome_responsavel', nome_responsavel,
            'email', email,
            'credenciais_dev_id', credenciais_dev_id,
            'created_at', created_at
        ) ORDER BY created_at DESC
    )
    INTO v_clientes
    FROM clientes;
    
    -- Se não encontrou clientes, retornar array vazio
    IF v_clientes IS NULL THEN
        v_clientes := '[]'::JSON;
    END IF;
    
    -- Retornar lista de clientes
    RETURN json_build_object(
        'success', true,
        'clientes', v_clientes,
        'total', json_array_length(v_clientes)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'clientes', '[]'::JSON,
            'total', 0
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Upsert Categorias
-- Insere ou atualiza categorias coletadas da API
-- ============================================
DROP FUNCTION IF EXISTS rpc_upsert_categorias(UUID, JSONB);
CREATE OR REPLACE FUNCTION rpc_upsert_categorias(
    p_cliente_uuid UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_categoria JSONB;
    v_categoria_id TEXT;
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
    
    -- Processar cada categoria no array
    FOR v_categoria IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        -- Extrair categoria_id (campo 'id' da API)
        v_categoria_id := v_categoria->>'id';
        
        -- Se não tem id, tentar outros campos comuns
        IF v_categoria_id IS NULL THEN
            v_categoria_id := v_categoria->>'categoriaId';
        END IF;
        
        -- Se ainda não tem id, usar hash do JSON como fallback
        IF v_categoria_id IS NULL THEN
            v_categoria_id := md5(v_categoria::TEXT);
        END IF;
        
        -- Verificar se já existe antes do upsert
        IF EXISTS (SELECT 1 FROM categorias WHERE cliente_id = p_cliente_uuid AND categoria_id = v_categoria_id) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert categoria com colunas específicas
        INSERT INTO categorias (
            cliente_id,
            categoria_id,
            versao,
            nome,
            categoria_pai,
            tipo,
            entrada_dre,
            considera_custo_dre,
            dados_originais,
            updated_at
        )
        VALUES (
            p_cliente_uuid,
            v_categoria_id,
            CASE 
                WHEN v_categoria->>'versao' IS NULL OR v_categoria->>'versao' = 'null' THEN NULL
                ELSE (v_categoria->>'versao')::INTEGER
            END,
            COALESCE(v_categoria->>'nome', 'Sem nome'),
            CASE 
                WHEN v_categoria->>'categoria_pai' IS NULL OR v_categoria->>'categoria_pai' = '' OR v_categoria->>'categoria_pai' = 'null' THEN NULL
                ELSE v_categoria->>'categoria_pai'
            END, -- Armazenar diretamente o categoria_id da API
            v_categoria->>'tipo',
            NULLIF(v_categoria->>'entrada_dre', 'null'),
            COALESCE(
                CASE 
                    WHEN v_categoria->>'considera_custo_dre' IS NULL OR v_categoria->>'considera_custo_dre' = 'null' THEN NULL
                    ELSE (v_categoria->>'considera_custo_dre')::BOOLEAN
                END,
                FALSE
            ),
            v_categoria,
            NOW()
        )
        ON CONFLICT (cliente_id, categoria_id)
        DO UPDATE SET
            versao = EXCLUDED.versao,
            nome = EXCLUDED.nome,
            categoria_pai = EXCLUDED.categoria_pai, -- Atualizar categoria_pai se mudou
            tipo = EXCLUDED.tipo,
            entrada_dre = EXCLUDED.entrada_dre,
            considera_custo_dre = EXCLUDED.considera_custo_dre,
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
        'message', format('Processadas %s categorias', v_count)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Upsert Produtos
-- Insere ou atualiza produtos coletados da API
-- ============================================
DROP FUNCTION IF EXISTS rpc_upsert_produtos(UUID, JSONB);
CREATE OR REPLACE FUNCTION rpc_upsert_produtos(
    p_cliente_uuid UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_produto JSONB;
    v_produto_id TEXT;
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
    
    -- Processar cada produto no array
    FOR v_produto IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        -- Extrair produto_id (campo 'id' da API)
        v_produto_id := v_produto->>'id';
        
        -- Se não tem id, usar hash do JSON como fallback
        IF v_produto_id IS NULL THEN
            v_produto_id := md5(v_produto::TEXT);
        END IF;
        
        -- Verificar se já existe antes do upsert
        IF EXISTS (SELECT 1 FROM produtos WHERE cliente_id = p_cliente_uuid AND produto_id = v_produto_id) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert produto com colunas específicas
        -- Extrair valores do JSON tratando NULL adequadamente
        INSERT INTO produtos (
            cliente_id,
            produto_id,
            codigo,
            nome,
            ean,
            sku,
            status,
            tipo,
            custo_medio,
            estoque_minimo,
            estoque_maximo,
            saldo,
            valor_venda,
            id_legado,
            integracao_ecommerce_ativada,
            movido,
            nivel_estoque,
            ultima_atualizacao,
            dados_originais,
            updated_at
        )
        VALUES (
            p_cliente_uuid,
            v_produto_id,
            NULLIF(v_produto->>'codigo', 'null'),
            COALESCE(v_produto->>'nome', 'Sem nome'),
            NULLIF(v_produto->>'ean', 'null'),
            NULLIF(v_produto->>'sku', 'null'),
            NULLIF(v_produto->>'status', 'null'),
            NULLIF(v_produto->>'tipo', 'null'),
            CASE 
                WHEN v_produto->>'custo_medio' IS NULL OR v_produto->>'custo_medio' = 'null' THEN NULL
                ELSE (v_produto->>'custo_medio')::NUMERIC
            END,
            CASE 
                WHEN v_produto->>'estoque_minimo' IS NULL OR v_produto->>'estoque_minimo' = 'null' THEN NULL
                ELSE (v_produto->>'estoque_minimo')::NUMERIC
            END,
            CASE 
                WHEN v_produto->>'estoque_maximo' IS NULL OR v_produto->>'estoque_maximo' = 'null' THEN NULL
                ELSE (v_produto->>'estoque_maximo')::NUMERIC
            END,
            CASE 
                WHEN v_produto->>'saldo' IS NULL OR v_produto->>'saldo' = 'null' THEN NULL
                ELSE (v_produto->>'saldo')::NUMERIC
            END,
            CASE 
                WHEN v_produto->>'valor_venda' IS NULL OR v_produto->>'valor_venda' = 'null' THEN NULL
                ELSE (v_produto->>'valor_venda')::NUMERIC
            END,
            CASE 
                WHEN v_produto->>'id_legado' IS NULL OR v_produto->>'id_legado' = 'null' THEN NULL
                ELSE (v_produto->>'id_legado')::INTEGER
            END,
            COALESCE(
                CASE 
                    WHEN v_produto->>'integracao_ecommerce_ativada' IS NULL OR v_produto->>'integracao_ecommerce_ativada' = 'null' THEN NULL
                    ELSE (v_produto->>'integracao_ecommerce_ativada')::BOOLEAN
                END,
                FALSE
            ),
            COALESCE(
                CASE 
                    WHEN v_produto->>'movido' IS NULL OR v_produto->>'movido' = 'null' THEN NULL
                    ELSE (v_produto->>'movido')::BOOLEAN
                END,
                FALSE
            ),
            NULLIF(v_produto->>'nivel_estoque', 'null'),
            CASE 
                WHEN v_produto->>'ultima_atualizacao' IS NULL OR v_produto->>'ultima_atualizacao' = 'null' THEN NULL
                ELSE (v_produto->>'ultima_atualizacao')::TIMESTAMP WITH TIME ZONE
            END,
            v_produto,
            NOW()
        )
        ON CONFLICT (cliente_id, produto_id)
        DO UPDATE SET
            codigo = EXCLUDED.codigo,
            nome = EXCLUDED.nome,
            ean = EXCLUDED.ean,
            sku = EXCLUDED.sku,
            status = EXCLUDED.status,
            tipo = EXCLUDED.tipo,
            custo_medio = EXCLUDED.custo_medio,
            estoque_minimo = EXCLUDED.estoque_minimo,
            estoque_maximo = EXCLUDED.estoque_maximo,
            saldo = EXCLUDED.saldo,
            valor_venda = EXCLUDED.valor_venda,
            id_legado = EXCLUDED.id_legado,
            integracao_ecommerce_ativada = EXCLUDED.integracao_ecommerce_ativada,
            movido = EXCLUDED.movido,
            nivel_estoque = EXCLUDED.nivel_estoque,
            ultima_atualizacao = EXCLUDED.ultima_atualizacao,
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
        'message', format('Processados %s produtos', v_count)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Upsert Serviços
-- Insere ou atualiza serviços coletados da API
-- ============================================
DROP FUNCTION IF EXISTS rpc_upsert_servicos(UUID, JSONB);
CREATE OR REPLACE FUNCTION rpc_upsert_servicos(
    p_cliente_uuid UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_servico JSONB;
    v_servico_id TEXT;
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
    
    -- Processar cada serviço no array
    FOR v_servico IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        -- Extrair servico_id (campo 'id' da API)
        v_servico_id := v_servico->>'id';
        
        -- Se não tem id, usar hash do JSON como fallback
        IF v_servico_id IS NULL THEN
            v_servico_id := md5(v_servico::TEXT);
        END IF;
        
        -- Verificar se já existe antes do upsert
        IF EXISTS (SELECT 1 FROM servicos WHERE cliente_id = p_cliente_uuid AND servico_id = v_servico_id) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert serviço com colunas específicas
        -- Extrair valores do JSON tratando NULL adequadamente
        INSERT INTO servicos (
            cliente_id,
            servico_id,
            codigo,
            descricao,
            codigo_cnae,
            codigo_municipio_servico,
            custo,
            preco,
            status,
            tipo_servico,
            id_servico,
            id_externo,
            lei_116,
            dados_originais,
            updated_at
        )
        VALUES (
            p_cliente_uuid,
            v_servico_id,
            NULLIF(v_servico->>'codigo', 'null'),
            COALESCE(v_servico->>'descricao', 'Sem descrição'),
            NULLIF(v_servico->>'codigo_cnae', 'null'),
            NULLIF(v_servico->>'codigo_municipio_servico', 'null'),
            CASE 
                WHEN v_servico->>'custo' IS NULL OR v_servico->>'custo' = 'null' THEN NULL
                ELSE (v_servico->>'custo')::NUMERIC
            END,
            CASE 
                WHEN v_servico->>'preco' IS NULL OR v_servico->>'preco' = 'null' THEN NULL
                ELSE (v_servico->>'preco')::NUMERIC
            END,
            NULLIF(v_servico->>'status', 'null'),
            NULLIF(v_servico->>'tipo_servico', 'null'),
            CASE 
                WHEN v_servico->>'id_servico' IS NULL OR v_servico->>'id_servico' = 'null' THEN NULL
                ELSE (v_servico->>'id_servico')::INTEGER
            END,
            NULLIF(v_servico->>'id_externo', 'null'),
            NULLIF(v_servico->>'lei_116', 'null'),
            v_servico,
            NOW()
        )
        ON CONFLICT (cliente_id, servico_id)
        DO UPDATE SET
            codigo = EXCLUDED.codigo,
            descricao = EXCLUDED.descricao,
            codigo_cnae = EXCLUDED.codigo_cnae,
            codigo_municipio_servico = EXCLUDED.codigo_municipio_servico,
            custo = EXCLUDED.custo,
            preco = EXCLUDED.preco,
            status = EXCLUDED.status,
            tipo_servico = EXCLUDED.tipo_servico,
            id_servico = EXCLUDED.id_servico,
            id_externo = EXCLUDED.id_externo,
            lei_116 = EXCLUDED.lei_116,
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
        'message', format('Processados %s serviços', v_count)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Função Auxiliar: Processar Item DRE (Recursiva)
-- Processa um item DRE e seus subitens recursivamente
-- ============================================
DROP FUNCTION IF EXISTS processar_item_dre(UUID, JSONB, TEXT);
CREATE OR REPLACE FUNCTION processar_item_dre(
    p_cliente_uuid UUID,
    p_item JSONB,
    p_pai_id TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_item_id TEXT;
    v_subitem JSONB;
    v_count INTEGER := 0;
    v_inserted INTEGER := 0;
    v_updated INTEGER := 0;
BEGIN
    -- Extrair categoria_dre_id (campo 'id' da API)
    v_item_id := p_item->>'id';
    
    -- Se não tem id, usar hash do JSON como fallback
    IF v_item_id IS NULL THEN
        v_item_id := md5(p_item::TEXT);
    END IF;
    
    -- Verificar se já existe antes do upsert
    IF EXISTS (SELECT 1 FROM categorias_dre WHERE cliente_id = p_cliente_uuid AND categoria_dre_id = v_item_id) THEN
        v_updated := 1;
    ELSE
        v_inserted := 1;
    END IF;
    
    -- Upsert categoria DRE com colunas específicas
    INSERT INTO categorias_dre (
        cliente_id,
        categoria_dre_id,
        descricao,
        codigo,
        posicao,
        indica_totalizador,
        representa_soma_custo_medio,
        categoria_dre_pai_id,
        dados_originais,
        updated_at
    )
    VALUES (
        p_cliente_uuid,
        v_item_id,
        COALESCE(p_item->>'descricao', 'Sem descrição'),
        NULLIF(p_item->>'codigo', 'null'),
        CASE 
            WHEN p_item->>'posicao' IS NULL OR p_item->>'posicao' = 'null' THEN NULL
            ELSE (p_item->>'posicao')::INTEGER
        END,
        COALESCE((p_item->>'indica_totalizador')::BOOLEAN, FALSE),
        COALESCE((p_item->>'representa_soma_custo_medio')::BOOLEAN, FALSE),
        p_pai_id,
        p_item,
        NOW()
    )
    ON CONFLICT (cliente_id, categoria_dre_id)
    DO UPDATE SET
        descricao = EXCLUDED.descricao,
        codigo = EXCLUDED.codigo,
        posicao = EXCLUDED.posicao,
        indica_totalizador = EXCLUDED.indica_totalizador,
        representa_soma_custo_medio = EXCLUDED.representa_soma_custo_medio,
        categoria_dre_pai_id = EXCLUDED.categoria_dre_pai_id,
        dados_originais = EXCLUDED.dados_originais,
        updated_at = NOW();
    
    v_count := 1;
    
    -- Processar subitens recursivamente (se existirem)
    IF p_item ? 'subitens' AND jsonb_typeof(p_item->'subitens') = 'array' THEN
        FOR v_subitem IN SELECT * FROM jsonb_array_elements(p_item->'subitens')
        LOOP
            -- Chamada recursiva com o ID do item atual como pai
            v_count := v_count + processar_item_dre(p_cliente_uuid, v_subitem, v_item_id);
        END LOOP;
    END IF;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RPC: Upsert Categorias DRE
-- Insere ou atualiza categorias DRE coletadas da API
-- Processa hierarquia recursivamente (achata itens e subitens)
-- ============================================
DROP FUNCTION IF EXISTS rpc_upsert_categorias_dre(UUID, JSONB);
CREATE OR REPLACE FUNCTION rpc_upsert_categorias_dre(
    p_cliente_uuid UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_categoria_dre JSONB;
    v_count INTEGER := 0;
    v_inserted INTEGER := 0;
    v_updated INTEGER := 0;
    v_item_count INTEGER;
    v_item_id TEXT;
BEGIN
    -- Verificar se p_dados é um array
    IF jsonb_typeof(p_dados) != 'array' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'p_dados deve ser um array JSONB'
        );
    END IF;
    
    -- Processar cada categoria DRE no array (itens raiz)
    FOR v_categoria_dre IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        -- Processar item raiz (sem pai) e contar quantos itens foram processados
        v_item_count := processar_item_dre(p_cliente_uuid, v_categoria_dre, NULL);
        v_count := v_count + v_item_count;
        
        -- Contar inseridos e atualizados verificando o item raiz
        v_item_id := v_categoria_dre->>'id';
        IF v_item_id IS NULL THEN
            v_item_id := md5(v_categoria_dre::TEXT);
        END IF;
        
        IF EXISTS (SELECT 1 FROM categorias_dre WHERE cliente_id = p_cliente_uuid AND categoria_dre_id = v_item_id) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
    END LOOP;
    
    -- Retornar resultado
    RETURN json_build_object(
        'success', true,
        'total_processado', v_count,
        'inseridos', v_inserted,
        'atualizados', v_updated,
        'message', format('Processadas %s categorias DRE', v_count)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Upsert Centro de Custos
-- Insere ou atualiza centros de custo coletados da API
-- ============================================
DROP FUNCTION IF EXISTS rpc_upsert_centro_custos(UUID, JSONB);
CREATE OR REPLACE FUNCTION rpc_upsert_centro_custos(
    p_cliente_uuid UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_centro_custo JSONB;
    v_centro_custo_id TEXT;
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
    
    -- Processar cada centro de custo no array
    FOR v_centro_custo IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        -- Extrair centro_custo_id (campo 'id' da API)
        v_centro_custo_id := v_centro_custo->>'id';
        
        -- Se não tem id, usar hash do JSON como fallback
        IF v_centro_custo_id IS NULL THEN
            v_centro_custo_id := md5(v_centro_custo::TEXT);
        END IF;
        
        -- Verificar se já existe antes do upsert
        IF EXISTS (SELECT 1 FROM centro_custos WHERE cliente_id = p_cliente_uuid AND centro_custo_id = v_centro_custo_id) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert centro de custo com colunas específicas
        -- Extrair valores do JSON tratando NULL adequadamente
        INSERT INTO centro_custos (
            cliente_id,
            centro_custo_id,
            codigo,
            nome,
            ativo,
            dados_originais,
            updated_at
        )
        VALUES (
            p_cliente_uuid,
            v_centro_custo_id,
            NULLIF(v_centro_custo->>'codigo', 'null'),
            COALESCE(v_centro_custo->>'nome', 'Sem nome'),
            COALESCE(
                CASE 
                    WHEN v_centro_custo->>'ativo' IS NULL OR v_centro_custo->>'ativo' = 'null' THEN NULL
                    ELSE (v_centro_custo->>'ativo')::BOOLEAN
                END,
                TRUE
            ),
            v_centro_custo,
            NOW()
        )
        ON CONFLICT (cliente_id, centro_custo_id)
        DO UPDATE SET
            codigo = EXCLUDED.codigo,
            nome = EXCLUDED.nome,
            ativo = EXCLUDED.ativo,
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
        'message', format('Processados %s centros de custo', v_count)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON FUNCTION rpc_get_token_data_for_refresh IS 'Retorna dados necessários para renovação de token (refresh_token e credenciais). Usado pelos workflows de coleta.';
COMMENT ON FUNCTION rpc_get_controle_carga IS 'Busca status de carga para um cliente e entidade';
COMMENT ON FUNCTION rpc_update_controle_carga_full IS 'Marca carga FULL como realizada para um cliente e entidade';
COMMENT ON FUNCTION rpc_update_controle_carga_incremental IS 'Atualiza última carga incremental e data processada';
COMMENT ON FUNCTION rpc_list_all_clientes IS 'Lista todos os clientes cadastrados (todos estão ativos). Usado pelo orquestrador.';
COMMENT ON FUNCTION rpc_upsert_categorias IS 'Insere ou atualiza categorias coletadas da API. Recebe array JSONB de categorias. Extrai campos específicos (versao, nome, categoria_pai, tipo, entrada_dre, considera_custo_dre) e mantém dados_originais como backup.';
COMMENT ON FUNCTION rpc_upsert_produtos IS 'Insere ou atualiza produtos coletados da API. Recebe array JSONB de produtos. Extrai campos específicos (codigo, nome, ean, sku, status, tipo, custo_medio, estoque_minimo, estoque_maximo, saldo, valor_venda, id_legado, integracao_ecommerce_ativada, movido, nivel_estoque, ultima_atualizacao) e mantém dados_originais como backup.';
COMMENT ON FUNCTION rpc_upsert_servicos IS 'Insere ou atualiza serviços coletados da API. Recebe array JSONB de serviços. Extrai campos específicos (codigo, descricao, codigo_cnae, codigo_municipio_servico, custo, preco, status, tipo_servico, id_servico, id_externo, lei_116) e mantém dados_originais como backup.';
COMMENT ON FUNCTION rpc_upsert_categorias_dre IS 'Insere ou atualiza categorias DRE coletadas da API. Recebe array JSONB de categorias DRE (estrutura hierárquica). Processa recursivamente itens e subitens, achata a hierarquia em registros separados. Extrai campos específicos (descricao, codigo, posicao, indica_totalizador, representa_soma_custo_medio, categoria_dre_pai_id) e mantém dados_originais com estrutura completa (incluindo subitens e categorias_financeiras).';
COMMENT ON FUNCTION rpc_upsert_centro_custos IS 'Insere ou atualiza centros de custo coletados da API. Recebe array JSONB de centros de custo. Extrai campos específicos (codigo, nome, ativo) e mantém dados_originais como backup.';

-- ============================================
-- RPC: Upsert Vendedores
-- Insere ou atualiza vendedores coletados da API
-- ============================================
DROP FUNCTION IF EXISTS rpc_upsert_vendedores(UUID, JSONB);
CREATE OR REPLACE FUNCTION rpc_upsert_vendedores(
    p_cliente_uuid UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_vendedor JSONB;
    v_vendedor_id TEXT;
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
    
    -- Processar cada vendedor no array
    FOR v_vendedor IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        -- Extrair vendedor_id (campo 'id' da API)
        v_vendedor_id := v_vendedor->>'id';
        
        -- Se não tem id, usar hash do JSON como fallback
        IF v_vendedor_id IS NULL THEN
            v_vendedor_id := md5(v_vendedor::TEXT);
        END IF;
        
        -- Verificar se já existe antes do upsert
        IF EXISTS (SELECT 1 FROM vendedores WHERE cliente_id = p_cliente_uuid AND vendedor_id = v_vendedor_id) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert vendedor com colunas específicas
        -- Extrair valores do JSON tratando NULL adequadamente
        INSERT INTO vendedores (
            cliente_id,
            vendedor_id,
            nome,
            id_legado,
            dados_originais,
            updated_at
        )
        VALUES (
            p_cliente_uuid,
            v_vendedor_id,
            COALESCE(v_vendedor->>'nome', 'Sem nome'),
            CASE 
                WHEN v_vendedor->>'id_legado' IS NULL OR v_vendedor->>'id_legado' = 'null' THEN NULL
                ELSE (v_vendedor->>'id_legado')::INTEGER
            END,
            v_vendedor,
            NOW()
        )
        ON CONFLICT (cliente_id, vendedor_id)
        DO UPDATE SET
            nome = EXCLUDED.nome,
            id_legado = EXCLUDED.id_legado,
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
        'message', format('Processados %s vendedores: %s inseridos, %s atualizados', v_count, v_inserted, v_updated)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_upsert_vendedores IS 'Insere ou atualiza vendedores coletados da API. Recebe array JSONB de vendedores. Extrai campos específicos (nome, id_legado) e mantém dados_originais como backup.';

-- ============================================
-- RPC: Upsert Pessoas
-- Insere ou atualiza pessoas (clientes/fornecedores) coletadas da API
-- ============================================
DROP FUNCTION IF EXISTS rpc_upsert_pessoas(UUID, JSONB);
CREATE OR REPLACE FUNCTION rpc_upsert_pessoas(
    p_cliente_uuid UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_pessoa JSONB;
    v_pessoa_id TEXT;
    v_perfis TEXT[];
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
    
    -- Processar cada pessoa no array
    FOR v_pessoa IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        -- Extrair pessoa_id (campo 'id' da API)
        v_pessoa_id := v_pessoa->>'id';
        
        -- Se não tem id, usar hash do JSON como fallback
        IF v_pessoa_id IS NULL THEN
            v_pessoa_id := md5(v_pessoa::TEXT);
        END IF;
        
        -- Processar perfis (array de strings)
        IF v_pessoa->'perfis' IS NOT NULL AND jsonb_typeof(v_pessoa->'perfis') = 'array' THEN
            SELECT ARRAY(
                SELECT jsonb_array_elements_text(v_pessoa->'perfis')
            ) INTO v_perfis;
        ELSE
            v_perfis := NULL;
        END IF;
        
        -- Verificar se já existe antes do upsert
        IF EXISTS (SELECT 1 FROM pessoas WHERE cliente_id = p_cliente_uuid AND pessoa_id = v_pessoa_id) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert pessoa com colunas específicas
        -- Extrair valores do JSON tratando NULL adequadamente
        INSERT INTO pessoas (
            cliente_id,
            pessoa_id,
            id_legado,
            uuid_legado,
            nome,
            documento,
            email,
            telefone,
            tipo_pessoa,
            ativo,
            codigo,
            perfis,
            data_alteracao,
            data_criacao,
            observacoes_gerais,
            dados_originais,
            updated_at
        )
        VALUES (
            p_cliente_uuid,
            v_pessoa_id,
            CASE 
                WHEN v_pessoa->>'id_legado' IS NULL OR v_pessoa->>'id_legado' = 'null' THEN NULL
                ELSE (v_pessoa->>'id_legado')::INTEGER
            END,
            NULLIF(v_pessoa->>'uuid_legado', 'null'),
            COALESCE(v_pessoa->>'nome', 'Sem nome'),
            NULLIF(v_pessoa->>'documento', 'null'),
            NULLIF(v_pessoa->>'email', 'null'),
            NULLIF(v_pessoa->>'telefone', 'null'),
            NULLIF(v_pessoa->>'tipo_pessoa', 'null'),
            COALESCE(
                CASE 
                    WHEN v_pessoa->>'ativo' IS NULL OR v_pessoa->>'ativo' = 'null' THEN NULL
                    ELSE (v_pessoa->>'ativo')::BOOLEAN
                END,
                TRUE
            ),
            NULLIF(v_pessoa->>'codigo', 'null'),
            v_perfis,
            CASE 
                WHEN v_pessoa->>'data_alteracao' IS NULL OR v_pessoa->>'data_alteracao' = 'null' THEN NULL
                ELSE (v_pessoa->>'data_alteracao')::TIMESTAMP WITH TIME ZONE
            END,
            CASE 
                WHEN v_pessoa->>'data_criacao' IS NULL OR v_pessoa->>'data_criacao' = 'null' THEN NULL
                ELSE (v_pessoa->>'data_criacao')::TIMESTAMP WITH TIME ZONE
            END,
            NULLIF(v_pessoa->>'observacoes_gerais', 'null'),
            v_pessoa,
            NOW()
        )
        ON CONFLICT (cliente_id, pessoa_id)
        DO UPDATE SET
            id_legado = EXCLUDED.id_legado,
            uuid_legado = EXCLUDED.uuid_legado,
            nome = EXCLUDED.nome,
            documento = EXCLUDED.documento,
            email = EXCLUDED.email,
            telefone = EXCLUDED.telefone,
            tipo_pessoa = EXCLUDED.tipo_pessoa,
            ativo = EXCLUDED.ativo,
            codigo = EXCLUDED.codigo,
            perfis = EXCLUDED.perfis,
            data_alteracao = EXCLUDED.data_alteracao,
            data_criacao = EXCLUDED.data_criacao,
            observacoes_gerais = EXCLUDED.observacoes_gerais,
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
        'message', format('Processados %s pessoas', v_count)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_upsert_pessoas IS 'Insere ou atualiza pessoas (clientes/fornecedores) coletadas da API. Recebe array JSONB de pessoas. Extrai campos específicos (id_legado, uuid_legado, nome, documento, email, telefone, tipo_pessoa, ativo, codigo, perfis, data_alteracao, data_criacao, observacoes_gerais) e mantém dados_originais como backup.';

-- ============================================
-- RPC: Upsert Contas a Pagar
-- Insere ou atualiza contas a pagar coletadas da API
-- ============================================
DROP FUNCTION IF EXISTS rpc_upsert_contas_pagar(UUID, JSONB);
CREATE OR REPLACE FUNCTION rpc_upsert_contas_pagar(
    p_cliente_uuid UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_conta_pagar JSONB;
    v_conta_pagar_id TEXT;
    v_fornecedor JSONB;
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
    
    -- Processar cada conta a pagar no array
    FOR v_conta_pagar IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        -- Extrair conta_pagar_id (campo 'id' da API)
        v_conta_pagar_id := v_conta_pagar->>'id';
        
        -- Se não tem id, usar hash do JSON como fallback
        IF v_conta_pagar_id IS NULL THEN
            v_conta_pagar_id := md5(v_conta_pagar::TEXT);
        END IF;
        
        -- Extrair dados do fornecedor (objeto aninhado)
        v_fornecedor := v_conta_pagar->'fornecedor';
        
        -- Verificar se já existe antes do upsert
        IF EXISTS (SELECT 1 FROM contas_pagar WHERE cliente_id = p_cliente_uuid AND conta_pagar_id = v_conta_pagar_id) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert conta a pagar com colunas específicas
        -- Extrair valores do JSON tratando NULL adequadamente
        INSERT INTO contas_pagar (
            cliente_id,
            conta_pagar_id,
            descricao,
            data_vencimento,
            status,
            status_traduzido,
            total,
            nao_pago,
            pago,
            data_criacao,
            data_alteracao,
            fornecedor_id,
            fornecedor_nome,
            dados_originais,
            updated_at
        )
        VALUES (
            p_cliente_uuid,
            v_conta_pagar_id,
            NULLIF(v_conta_pagar->>'descricao', 'null'),
            CASE 
                WHEN v_conta_pagar->>'data_vencimento' IS NULL OR v_conta_pagar->>'data_vencimento' = 'null' THEN NULL
                ELSE (v_conta_pagar->>'data_vencimento')::DATE
            END,
            NULLIF(v_conta_pagar->>'status', 'null'),
            NULLIF(v_conta_pagar->>'status_traduzido', 'null'),
            CASE 
                WHEN v_conta_pagar->>'total' IS NULL OR v_conta_pagar->>'total' = 'null' THEN NULL
                ELSE (v_conta_pagar->>'total')::NUMERIC(15,2)
            END,
            CASE 
                WHEN v_conta_pagar->>'nao_pago' IS NULL OR v_conta_pagar->>'nao_pago' = 'null' THEN NULL
                ELSE (v_conta_pagar->>'nao_pago')::NUMERIC(15,2)
            END,
            CASE 
                WHEN v_conta_pagar->>'pago' IS NULL OR v_conta_pagar->>'pago' = 'null' THEN NULL
                ELSE (v_conta_pagar->>'pago')::NUMERIC(15,2)
            END,
            CASE 
                WHEN v_conta_pagar->>'data_criacao' IS NULL OR v_conta_pagar->>'data_criacao' = 'null' THEN NULL
                ELSE (v_conta_pagar->>'data_criacao')::TIMESTAMP WITH TIME ZONE
            END,
            CASE 
                WHEN v_conta_pagar->>'data_alteracao' IS NULL OR v_conta_pagar->>'data_alteracao' = 'null' THEN NULL
                ELSE (v_conta_pagar->>'data_alteracao')::TIMESTAMP WITH TIME ZONE
            END,
            CASE 
                WHEN v_fornecedor IS NULL OR v_fornecedor = 'null'::jsonb THEN NULL
                ELSE v_fornecedor->>'id'
            END,
            CASE 
                WHEN v_fornecedor IS NULL OR v_fornecedor = 'null'::jsonb THEN NULL
                ELSE v_fornecedor->>'nome'
            END,
            v_conta_pagar,
            NOW()
        )
        ON CONFLICT (cliente_id, conta_pagar_id)
        DO UPDATE SET
            descricao = EXCLUDED.descricao,
            data_vencimento = EXCLUDED.data_vencimento,
            status = EXCLUDED.status,
            status_traduzido = EXCLUDED.status_traduzido,
            total = EXCLUDED.total,
            nao_pago = EXCLUDED.nao_pago,
            pago = EXCLUDED.pago,
            data_criacao = EXCLUDED.data_criacao,
            data_alteracao = EXCLUDED.data_alteracao,
            fornecedor_id = EXCLUDED.fornecedor_id,
            fornecedor_nome = EXCLUDED.fornecedor_nome,
            dados_originais = EXCLUDED.dados_originais,
            -- Resetar detalhado se dados básicos mudaram (coleta incremental)
            detalhado = CASE 
                WHEN (contas_pagar.descricao IS DISTINCT FROM EXCLUDED.descricao
                      OR contas_pagar.total IS DISTINCT FROM EXCLUDED.total
                      OR contas_pagar.data_vencimento IS DISTINCT FROM EXCLUDED.data_vencimento
                      OR contas_pagar.status IS DISTINCT FROM EXCLUDED.status
                      OR contas_pagar.status_traduzido IS DISTINCT FROM EXCLUDED.status_traduzido
                      OR contas_pagar.nao_pago IS DISTINCT FROM EXCLUDED.nao_pago
                      OR contas_pagar.pago IS DISTINCT FROM EXCLUDED.pago
                      OR contas_pagar.fornecedor_id IS DISTINCT FROM EXCLUDED.fornecedor_id
                      OR contas_pagar.fornecedor_nome IS DISTINCT FROM EXCLUDED.fornecedor_nome)
                THEN FALSE  -- Resetar se dados básicos mudaram
                ELSE contas_pagar.detalhado  -- Preservar se não mudou
            END,
            data_detalhamento = CASE 
                WHEN (contas_pagar.descricao IS DISTINCT FROM EXCLUDED.descricao
                      OR contas_pagar.total IS DISTINCT FROM EXCLUDED.total
                      OR contas_pagar.data_vencimento IS DISTINCT FROM EXCLUDED.data_vencimento
                      OR contas_pagar.status IS DISTINCT FROM EXCLUDED.status
                      OR contas_pagar.status_traduzido IS DISTINCT FROM EXCLUDED.status_traduzido
                      OR contas_pagar.nao_pago IS DISTINCT FROM EXCLUDED.nao_pago
                      OR contas_pagar.pago IS DISTINCT FROM EXCLUDED.pago
                      OR contas_pagar.fornecedor_id IS DISTINCT FROM EXCLUDED.fornecedor_id
                      OR contas_pagar.fornecedor_nome IS DISTINCT FROM EXCLUDED.fornecedor_nome)
                      AND contas_pagar.detalhado = TRUE
                THEN NULL  -- Limpar data se resetou detalhado
                ELSE contas_pagar.data_detalhamento  -- Preservar
            END,
            updated_at = NOW();
        
        v_count := v_count + 1;
    END LOOP;
    
    -- Retornar resultado
    RETURN json_build_object(
        'success', true,
        'total_processado', v_count,
        'inseridos', v_inserted,
        'atualizados', v_updated,
        'message', format('Processadas %s contas a pagar', v_count)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_upsert_contas_pagar IS 'Insere ou atualiza contas a pagar coletadas da API. Recebe array JSONB de contas a pagar. Extrai campos específicos (descricao, data_vencimento, status, status_traduzido, total, nao_pago, pago, data_criacao, data_alteracao, fornecedor_id, fornecedor_nome) e mantém dados_originais como backup.';

-- ============================================
-- RPC: Upsert Contas a Receber
-- Insere ou atualiza contas a receber coletadas da API
-- ============================================
DROP FUNCTION IF EXISTS rpc_upsert_contas_receber(UUID, JSONB);
CREATE OR REPLACE FUNCTION rpc_upsert_contas_receber(
    p_cliente_uuid UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_conta_receber JSONB;
    v_conta_receber_id TEXT;
    v_cliente JSONB;
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
    
    -- Processar cada conta a receber no array
    FOR v_conta_receber IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        -- Extrair conta_receber_id (campo 'id' da API)
        v_conta_receber_id := v_conta_receber->>'id';
        
        -- Se não tem id, usar hash do JSON como fallback
        IF v_conta_receber_id IS NULL THEN
            v_conta_receber_id := md5(v_conta_receber::TEXT);
        END IF;
        
        -- Extrair dados do cliente (objeto aninhado)
        v_cliente := v_conta_receber->'cliente';
        
        -- Verificar se já existe antes do upsert
        IF EXISTS (SELECT 1 FROM contas_receber WHERE cliente_id = p_cliente_uuid AND conta_receber_id = v_conta_receber_id) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert conta a receber com colunas específicas
        -- Extrair valores do JSON tratando NULL adequadamente
        INSERT INTO contas_receber (
            cliente_id,
            conta_receber_id,
            descricao,
            data_vencimento,
            status,
            status_traduzido,
            total,
            nao_pago,
            pago,
            data_criacao,
            data_alteracao,
            cliente_conta_id,
            cliente_conta_nome,
            dados_originais,
            updated_at
        )
        VALUES (
            p_cliente_uuid,
            v_conta_receber_id,
            NULLIF(v_conta_receber->>'descricao', 'null'),
            CASE 
                WHEN v_conta_receber->>'data_vencimento' IS NULL OR v_conta_receber->>'data_vencimento' = 'null' THEN NULL
                ELSE (v_conta_receber->>'data_vencimento')::DATE
            END,
            NULLIF(v_conta_receber->>'status', 'null'),
            NULLIF(v_conta_receber->>'status_traduzido', 'null'),
            CASE 
                WHEN v_conta_receber->>'total' IS NULL OR v_conta_receber->>'total' = 'null' THEN NULL
                ELSE (v_conta_receber->>'total')::NUMERIC(15,2)
            END,
            CASE 
                WHEN v_conta_receber->>'nao_pago' IS NULL OR v_conta_receber->>'nao_pago' = 'null' THEN NULL
                ELSE (v_conta_receber->>'nao_pago')::NUMERIC(15,2)
            END,
            CASE 
                WHEN v_conta_receber->>'pago' IS NULL OR v_conta_receber->>'pago' = 'null' THEN NULL
                ELSE (v_conta_receber->>'pago')::NUMERIC(15,2)
            END,
            CASE 
                WHEN v_conta_receber->>'data_criacao' IS NULL OR v_conta_receber->>'data_criacao' = 'null' THEN NULL
                ELSE (v_conta_receber->>'data_criacao')::TIMESTAMP WITH TIME ZONE
            END,
            CASE 
                WHEN v_conta_receber->>'data_alteracao' IS NULL OR v_conta_receber->>'data_alteracao' = 'null' THEN NULL
                ELSE (v_conta_receber->>'data_alteracao')::TIMESTAMP WITH TIME ZONE
            END,
            CASE 
                WHEN v_cliente IS NULL OR v_cliente = 'null'::jsonb THEN NULL
                ELSE v_cliente->>'id'
            END,
            CASE 
                WHEN v_cliente IS NULL OR v_cliente = 'null'::jsonb THEN NULL
                ELSE v_cliente->>'nome'
            END,
            v_conta_receber,
            NOW()
        )
        ON CONFLICT (cliente_id, conta_receber_id)
        DO UPDATE SET
            descricao = EXCLUDED.descricao,
            data_vencimento = EXCLUDED.data_vencimento,
            status = EXCLUDED.status,
            status_traduzido = EXCLUDED.status_traduzido,
            total = EXCLUDED.total,
            nao_pago = EXCLUDED.nao_pago,
            pago = EXCLUDED.pago,
            data_criacao = EXCLUDED.data_criacao,
            data_alteracao = EXCLUDED.data_alteracao,
            cliente_conta_id = EXCLUDED.cliente_conta_id,
            cliente_conta_nome = EXCLUDED.cliente_conta_nome,
            dados_originais = EXCLUDED.dados_originais,
            -- Resetar detalhado se dados básicos mudaram (coleta incremental)
            detalhado = CASE 
                WHEN (contas_receber.descricao IS DISTINCT FROM EXCLUDED.descricao
                      OR contas_receber.total IS DISTINCT FROM EXCLUDED.total
                      OR contas_receber.data_vencimento IS DISTINCT FROM EXCLUDED.data_vencimento
                      OR contas_receber.status IS DISTINCT FROM EXCLUDED.status
                      OR contas_receber.status_traduzido IS DISTINCT FROM EXCLUDED.status_traduzido
                      OR contas_receber.nao_pago IS DISTINCT FROM EXCLUDED.nao_pago
                      OR contas_receber.pago IS DISTINCT FROM EXCLUDED.pago
                      OR contas_receber.cliente_conta_id IS DISTINCT FROM EXCLUDED.cliente_conta_id
                      OR contas_receber.cliente_conta_nome IS DISTINCT FROM EXCLUDED.cliente_conta_nome)
                THEN FALSE  -- Resetar se dados básicos mudaram
                ELSE contas_receber.detalhado  -- Preservar se não mudou
            END,
            data_detalhamento = CASE 
                WHEN (contas_receber.descricao IS DISTINCT FROM EXCLUDED.descricao
                      OR contas_receber.total IS DISTINCT FROM EXCLUDED.total
                      OR contas_receber.data_vencimento IS DISTINCT FROM EXCLUDED.data_vencimento
                      OR contas_receber.status IS DISTINCT FROM EXCLUDED.status
                      OR contas_receber.status_traduzido IS DISTINCT FROM EXCLUDED.status_traduzido
                      OR contas_receber.nao_pago IS DISTINCT FROM EXCLUDED.nao_pago
                      OR contas_receber.pago IS DISTINCT FROM EXCLUDED.pago
                      OR contas_receber.cliente_conta_id IS DISTINCT FROM EXCLUDED.cliente_conta_id
                      OR contas_receber.cliente_conta_nome IS DISTINCT FROM EXCLUDED.cliente_conta_nome)
                      AND contas_receber.detalhado = TRUE
                THEN NULL  -- Limpar data se resetou detalhado
                ELSE contas_receber.data_detalhamento  -- Preservar
            END,
            updated_at = NOW();
        
        v_count := v_count + 1;
    END LOOP;
    
    -- Retornar resultado
    RETURN json_build_object(
        'success', true,
        'total_processado', v_count,
        'inseridos', v_inserted,
        'atualizados', v_updated,
        'message', format('Processadas %s contas a receber', v_count)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_upsert_contas_receber IS 'Insere ou atualiza contas a receber coletadas da API. Recebe array JSONB de contas a receber. Extrai campos específicos (descricao, data_vencimento, status, status_traduzido, total, nao_pago, pago, data_criacao, data_alteracao, cliente_conta_id, cliente_conta_nome) e mantém dados_originais como backup.';

-- ============================================
-- RPC: Listar Parcelas Não Detalhadas
-- Lista parcelas que ainda não foram detalhadas (busca de rateio)
-- ============================================
DROP FUNCTION IF EXISTS rpc_list_parcelas_nao_detalhadas(UUID, TEXT, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION rpc_list_parcelas_nao_detalhadas(
    p_cliente_uuid UUID,
    p_entidade_tipo TEXT,
    p_limit INTEGER DEFAULT 50,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSON AS $$
DECLARE
    v_parcelas JSON;
    v_total INTEGER;
BEGIN
    -- Validar entidade_tipo
    IF p_entidade_tipo NOT IN ('contas_pagar', 'contas_receber', 'vendas', 'contratos') THEN
        RETURN json_build_object(
            'success', false,
            'error', format('Entidade tipo inválida: %s. Deve ser: contas_pagar, contas_receber, vendas ou contratos', p_entidade_tipo)
        );
    END IF;
    
    -- Buscar parcelas não detalhadas conforme entidade_tipo
    IF p_entidade_tipo = 'contas_pagar' THEN
        -- Contar total: parcelas com detalhado = FALSE ou NULL
        SELECT COUNT(*) INTO v_total
        FROM contas_pagar cp
        WHERE cp.cliente_id = p_cliente_uuid
          AND (cp.detalhado IS NULL OR cp.detalhado = FALSE);
        
        -- Buscar parcelas
        SELECT json_agg(
            json_build_object(
                'id', cp.id,
                'conta_pagar_id', cp.conta_pagar_id,
                'descricao', cp.descricao,
                'data_vencimento', cp.data_vencimento,
                'total', cp.total
            ) ORDER BY cp.created_at DESC
        )
        INTO v_parcelas
        FROM contas_pagar cp
        WHERE cp.cliente_id = p_cliente_uuid
          AND (cp.detalhado IS NULL OR cp.detalhado = FALSE)
        ORDER BY cp.created_at DESC
        LIMIT p_limit OFFSET p_offset;
        
    ELSIF p_entidade_tipo = 'contas_receber' THEN
        -- Contar total: parcelas com detalhado = FALSE ou NULL
        SELECT COUNT(*) INTO v_total
        FROM contas_receber cr
        WHERE cr.cliente_id = p_cliente_uuid
          AND (cr.detalhado IS NULL OR cr.detalhado = FALSE);
        
        -- Buscar parcelas
        SELECT json_agg(
            json_build_object(
                'id', cr.id,
                'conta_receber_id', cr.conta_receber_id,
                'descricao', cr.descricao,
                'data_vencimento', cr.data_vencimento,
                'total', cr.total
            ) ORDER BY cr.created_at DESC
        )
        INTO v_parcelas
        FROM contas_receber cr
        WHERE cr.cliente_id = p_cliente_uuid
          AND (cr.detalhado IS NULL OR cr.detalhado = FALSE)
        ORDER BY cr.created_at DESC
        LIMIT p_limit OFFSET p_offset;
    ELSIF p_entidade_tipo = 'vendas' THEN
        -- TODO: Implementar quando schema de vendas for criado
        RETURN json_build_object(
            'success', false,
            'error', 'Schema de vendas ainda não implementado'
        );
    ELSIF p_entidade_tipo = 'contratos' THEN
        -- Contar total: contratos (todos, pois não temos campo detalhado ainda)
        SELECT COUNT(*) INTO v_total
        FROM contratos c
        WHERE c.cliente_id = p_cliente_uuid;
        
        -- Buscar contratos como parcelas
        SELECT json_agg(
            json_build_object(
                'id', c.id,
                'contrato_id', c.contrato_id,
                'numero', c.numero,
                'data_inicio', c.data_inicio,
                'proximo_vencimento', c.proximo_vencimento,
                'status', c.status
            ) ORDER BY c.created_at DESC
        )
        INTO v_parcelas
        FROM contratos c
        WHERE c.cliente_id = p_cliente_uuid
        ORDER BY c.created_at DESC
        LIMIT p_limit OFFSET p_offset;
    END IF;
    
    -- Se não encontrou parcelas, retornar array vazio
    IF v_parcelas IS NULL THEN
        v_parcelas := '[]'::JSON;
    END IF;
    
    -- Retornar resultado
    RETURN json_build_object(
        'success', true,
        'parcelas', v_parcelas,
        'total', v_total,
        'limit', p_limit,
        'offset', p_offset
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Atualizar Detalhes de Parcela
-- Atualiza dados detalhados de uma parcela (rateio, categoria, centro de custo)
-- ============================================
DROP FUNCTION IF EXISTS rpc_update_detalhes_parcela(UUID, TEXT, TEXT, JSONB, JSONB);
CREATE OR REPLACE FUNCTION rpc_update_detalhes_parcela(
    p_cliente_uuid UUID,
    p_parcela_id TEXT,
    p_entidade_tipo TEXT,
    p_detalhes_parcela JSONB,
    p_rateio JSONB
)
RETURNS JSON AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Validar entidade_tipo
    IF p_entidade_tipo NOT IN ('contas_pagar', 'contas_receber', 'vendas', 'contratos') THEN
        RETURN json_build_object(
            'success', false,
            'error', format('Entidade tipo inválida: %s. Deve ser: contas_pagar, contas_receber, vendas ou contratos', p_entidade_tipo)
        );
    END IF;
    
    -- Inserir ou atualizar em parcelas_detalhes
    INSERT INTO parcelas_detalhes (
        cliente_id,
        entidade_tipo,
        parcela_id,
        detalhado,
        data_detalhamento,
        detalhes_parcela,
        rateio,
        updated_at
    )
    VALUES (
        p_cliente_uuid,
        p_entidade_tipo,
        p_parcela_id,
        TRUE,
        NOW(),
        p_detalhes_parcela,
        p_rateio,
        NOW()
    )
    ON CONFLICT (cliente_id, entidade_tipo, parcela_id)
    DO UPDATE SET
        detalhado = TRUE,
        data_detalhamento = NOW(),
        detalhes_parcela = EXCLUDED.detalhes_parcela,
        rateio = EXCLUDED.rateio,
        updated_at = NOW()
    RETURNING id INTO v_id;
    
    IF v_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Erro ao inserir/atualizar detalhes da parcela'
        );
    END IF;
    
    -- Atualizar campo detalhado na tabela contas_pagar (se for contas_pagar)
    IF p_entidade_tipo = 'contas_pagar' THEN
        -- Verificar se parcela existe
        IF NOT EXISTS (
            SELECT 1 FROM contas_pagar
            WHERE cliente_id = p_cliente_uuid 
              AND conta_pagar_id = p_parcela_id
        ) THEN
            RETURN json_build_object(
                'success', false,
                'error', format('Parcela não encontrada em contas_pagar: %s', p_parcela_id)
            );
        END IF;
        
        -- Atualizar campos de controle em contas_pagar
        UPDATE contas_pagar
        SET
            detalhado = TRUE,
            data_detalhamento = NOW(),
            updated_at = NOW()
        WHERE cliente_id = p_cliente_uuid 
          AND conta_pagar_id = p_parcela_id;
    ELSIF p_entidade_tipo = 'contas_receber' THEN
        -- Validação: verificar se parcela existe
        IF NOT EXISTS (
            SELECT 1 FROM contas_receber
            WHERE cliente_id = p_cliente_uuid 
              AND conta_receber_id = p_parcela_id
        ) THEN
            RETURN json_build_object(
                'success', false,
                'error', format('Parcela não encontrada em contas_receber: %s', p_parcela_id)
            );
        END IF;
    ELSIF p_entidade_tipo = 'vendas' THEN
        -- Validação: verificar se parcela existe
        IF NOT EXISTS (
            SELECT 1 FROM vendas
            WHERE cliente_id = p_cliente_uuid 
              AND venda_id = p_parcela_id
        ) THEN
            RETURN json_build_object(
                'success', false,
                'error', format('Parcela não encontrada em vendas: %s', p_parcela_id)
            );
        END IF;
    ELSIF p_entidade_tipo = 'contratos' THEN
        -- Validação: verificar se parcela existe
        IF NOT EXISTS (
            SELECT 1 FROM contratos
            WHERE cliente_id = p_cliente_uuid 
              AND contrato_id = p_parcela_id
        ) THEN
            RETURN json_build_object(
                'success', false,
                'error', format('Parcela não encontrada em contratos: %s', p_parcela_id)
            );
        END IF;
    END IF;
    
    -- Retornar sucesso
    RETURN json_build_object(
        'success', true,
        'id', v_id,
        'message', 'Detalhes da parcela atualizados com sucesso'
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_list_parcelas_nao_detalhadas IS 'Lista parcelas que ainda não foram detalhadas (busca de rateio, categoria e centro de custo). Retorna lista paginada de parcelas pendentes de detalhamento para uma entidade específica.';
COMMENT ON FUNCTION rpc_update_detalhes_parcela IS 'Atualiza dados detalhados de uma parcela (rateio, categoria, centro de custo) obtidos via GET /v1/financeiro/eventos-financeiros/parcelas/{id}. Marca parcela como detalhada e armazena dados completos.';

-- ============================================
-- RPC: Upsert Contas Financeiras
-- Insere ou atualiza contas financeiras coletadas da API
-- ============================================
DROP FUNCTION IF EXISTS rpc_upsert_contas_financeiras(UUID, JSONB);
CREATE OR REPLACE FUNCTION rpc_upsert_contas_financeiras(
    p_cliente_uuid UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_conta_financeira JSONB;
    v_conta_financeira_id TEXT;
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
    
    -- Processar cada conta financeira no array
    FOR v_conta_financeira IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        -- Extrair conta_financeira_id (campo 'id' da API)
        v_conta_financeira_id := v_conta_financeira->>'id';
        
        -- Se não tem id, usar hash do JSON como fallback
        IF v_conta_financeira_id IS NULL THEN
            v_conta_financeira_id := md5(v_conta_financeira::TEXT);
        END IF;
        
        -- Verificar se já existe antes do upsert
        IF EXISTS (SELECT 1 FROM contas_financeiras WHERE cliente_id = p_cliente_uuid AND conta_financeira_id = v_conta_financeira_id) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert conta financeira com colunas específicas
        -- Extrair valores do JSON tratando NULL adequadamente
        INSERT INTO contas_financeiras (
            cliente_id,
            conta_financeira_id,
            nome,
            tipo,
            banco,
            codigo_banco,
            ativo,
            conta_padrao,
            possui_config_boleto_bancario,
            agencia,
            numero,
            dados_originais,
            updated_at
        )
        VALUES (
            p_cliente_uuid,
            v_conta_financeira_id,
            NULLIF(v_conta_financeira->>'nome', 'null'),
            NULLIF(v_conta_financeira->>'tipo', 'null'),
            NULLIF(v_conta_financeira->>'banco', 'null'),
            CASE 
                WHEN v_conta_financeira->>'codigo_banco' IS NULL OR v_conta_financeira->>'codigo_banco' = 'null' THEN NULL
                ELSE (v_conta_financeira->>'codigo_banco')::INTEGER
            END,
            CASE 
                WHEN v_conta_financeira->>'ativo' IS NULL OR v_conta_financeira->>'ativo' = 'null' THEN NULL
                ELSE (v_conta_financeira->>'ativo')::BOOLEAN
            END,
            CASE 
                WHEN v_conta_financeira->>'conta_padrao' IS NULL OR v_conta_financeira->>'conta_padrao' = 'null' THEN NULL
                ELSE (v_conta_financeira->>'conta_padrao')::BOOLEAN
            END,
            CASE 
                WHEN v_conta_financeira->>'possui_config_boleto_bancario' IS NULL OR v_conta_financeira->>'possui_config_boleto_bancario' = 'null' THEN NULL
                ELSE (v_conta_financeira->>'possui_config_boleto_bancario')::BOOLEAN
            END,
            NULLIF(v_conta_financeira->>'agencia', 'null'),
            NULLIF(v_conta_financeira->>'numero', 'null'),
            v_conta_financeira,
            NOW()
        )
        ON CONFLICT (cliente_id, conta_financeira_id)
        DO UPDATE SET
            nome = EXCLUDED.nome,
            tipo = EXCLUDED.tipo,
            banco = EXCLUDED.banco,
            codigo_banco = EXCLUDED.codigo_banco,
            ativo = EXCLUDED.ativo,
            conta_padrao = EXCLUDED.conta_padrao,
            possui_config_boleto_bancario = EXCLUDED.possui_config_boleto_bancario,
            agencia = EXCLUDED.agencia,
            numero = EXCLUDED.numero,
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
        'message', format('Processadas %s contas financeiras', v_count)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_upsert_contas_financeiras IS 'Insere ou atualiza contas financeiras coletadas da API. Recebe array JSONB de contas financeiras. Extrai campos específicos (nome, tipo, banco, codigo_banco, ativo, conta_padrao, possui_config_boleto_bancario, agencia, numero) e mantém dados_originais como backup.';

-- ============================================
-- RPC: Upsert Saldos de Contas
-- Insere saldos de contas financeiras coletados da API (histórico temporal)
-- ============================================
DROP FUNCTION IF EXISTS rpc_upsert_saldos_contas(UUID, JSONB);
CREATE OR REPLACE FUNCTION rpc_upsert_saldos_contas(
    p_cliente_uuid UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_saldo JSONB;
    v_conta_financeira_id TEXT;
    v_data_coleta TIMESTAMP WITH TIME ZONE;
    v_count INTEGER := 0;
    v_inserted INTEGER := 0;
BEGIN
    -- Verificar se p_dados é um array
    IF jsonb_typeof(p_dados) != 'array' THEN
        RETURN json_build_object(
            'success', false,
            'error', 'p_dados deve ser um array JSONB'
        );
    END IF;
    
    -- Processar cada saldo no array
    FOR v_saldo IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        -- Extrair conta_financeira_id (campo obrigatório)
        v_conta_financeira_id := v_saldo->>'conta_financeira_id';
        
        -- Se não tem conta_financeira_id, pular este registro
        IF v_conta_financeira_id IS NULL THEN
            CONTINUE;
        END IF;
        
        -- Calcular data_coleta (usar data do JSON ou NOW())
        v_data_coleta := CASE 
            WHEN v_saldo->>'data_coleta' IS NULL OR v_saldo->>'data_coleta' = 'null' THEN NOW()
            ELSE (v_saldo->>'data_coleta')::TIMESTAMP WITH TIME ZONE
        END;
        
        -- Verificar se já existe coleta no mesmo dia para esta conta
        -- Comparação por data (DATE), ignorando hora
        IF EXISTS (
            SELECT 1 FROM saldos_contas 
            WHERE cliente_id = p_cliente_uuid 
              AND conta_financeira_id = v_conta_financeira_id
              AND DATE(data_coleta) = DATE(v_data_coleta)
        ) THEN
            CONTINUE; -- Pular inserção se já existe coleta no mesmo dia
        END IF;
        
        -- Inserir novo registro de saldo (histórico temporal - sempre INSERT, nunca UPDATE)
        INSERT INTO saldos_contas (
            cliente_id,
            conta_financeira_id,
            saldo_atual,
            data_coleta,
            dados_originais,
            updated_at
        )
        VALUES (
            p_cliente_uuid,
            v_conta_financeira_id,
            CASE 
                WHEN v_saldo->>'saldo_atual' IS NULL OR v_saldo->>'saldo_atual' = 'null' THEN NULL
                ELSE (v_saldo->>'saldo_atual')::NUMERIC(15,2)
            END,
            v_data_coleta,
            v_saldo,
            NOW()
        );
        
        v_inserted := v_inserted + 1;
        v_count := v_count + 1;
    END LOOP;
    
    -- Retornar resultado
    RETURN json_build_object(
        'success', true,
        'total_processado', v_count,
        'inseridos', v_inserted,
        'message', format('Processados %s saldos de contas', v_count)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_upsert_saldos_contas IS 'Insere saldos de contas financeiras coletados da API. Recebe array JSONB de saldos. Cada coleta cria um novo registro para rastreamento histórico temporal. Verifica duplicação por data de coleta (mesmo dia) antes de inserir, evitando duplicatas quando executado múltiplas vezes no mesmo dia. Campos: conta_financeira_id (obrigatório), saldo_atual, data_coleta (opcional, padrão NOW()). Mantém dados_originais como backup.';

-- ============================================
-- RPC: Listar Contas Financeiras
-- Lista todas as contas financeiras de um cliente para buscar saldos
-- ============================================
DROP FUNCTION IF EXISTS rpc_list_contas_financeiras(UUID);
CREATE OR REPLACE FUNCTION rpc_list_contas_financeiras(
    p_cliente_uuid UUID
)
RETURNS JSON AS $$
DECLARE
    v_contas JSON;
    v_total INTEGER;
BEGIN
    -- Contar total de contas financeiras
    SELECT COUNT(*) INTO v_total
    FROM contas_financeiras cf
    WHERE cf.cliente_id = p_cliente_uuid;
    
    -- Buscar todas as contas financeiras (ordenadas por nome)
    SELECT json_agg(
        json_build_object(
            'id', sub.id,
            'conta_financeira_id', sub.conta_financeira_id,
            'nome', sub.nome,
            'tipo', sub.tipo,
            'banco', sub.banco,
            'ativo', sub.ativo
        )
    )
    INTO v_contas
    FROM (
        SELECT 
            cf.id,
            cf.conta_financeira_id,
            cf.nome,
            cf.tipo,
            cf.banco,
            cf.ativo
        FROM contas_financeiras cf
        WHERE cf.cliente_id = p_cliente_uuid
        ORDER BY cf.nome ASC
    ) sub;
    
    -- Se não encontrou contas, retornar array vazio
    IF v_contas IS NULL THEN
        v_contas := '[]'::JSON;
    END IF;
    
    -- Retornar resultado
    RETURN json_build_object(
        'success', true,
        'contas', v_contas,
        'total', v_total
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_list_contas_financeiras IS 'Lista todas as contas financeiras de um cliente. Retorna array JSON com id, conta_financeira_id, nome, tipo, banco e ativo. Usado pelo workflow de saldos para buscar saldo de cada conta.';

-- ============================================
-- RPC: Upsert Vendas
-- Insere ou atualiza vendas coletadas da API
-- ============================================
DROP FUNCTION IF EXISTS rpc_upsert_vendas(UUID, JSONB);
CREATE OR REPLACE FUNCTION rpc_upsert_vendas(
    p_cliente_uuid UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_venda JSONB;
    v_venda_id TEXT;
    v_cliente JSONB;
    v_situacao JSONB;
    v_vendedor JSONB;
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
    
    -- Processar cada venda no array
    FOR v_venda IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        -- Extrair venda_id (campo 'id' da API)
        v_venda_id := v_venda->>'id';
        
        -- Se não tem id, usar hash do JSON como fallback
        IF v_venda_id IS NULL THEN
            v_venda_id := md5(v_venda::TEXT);
        END IF;
        
        -- Extrair dados do cliente (objeto aninhado)
        v_cliente := v_venda->'cliente';
        
        -- Extrair dados da situação (objeto aninhado)
        v_situacao := v_venda->'situacao';
        
        -- Extrair dados do vendedor (objeto aninhado, se disponível)
        v_vendedor := v_venda->'vendedor';
        
        -- Verificar se já existe antes do upsert
        IF EXISTS (SELECT 1 FROM vendas WHERE cliente_id = p_cliente_uuid AND venda_id = v_venda_id) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert venda com colunas específicas
        INSERT INTO vendas (
            cliente_id,
            venda_id,
            numero,
            data,
            data_inicio,
            total,
            tipo,
            itens,
            situacao,
            condicao_pagamento,
            id_legado,
            cliente_venda_id,
            cliente_venda_nome,
            vendedor_id,
            vendedor_nome,
            data_criacao,
            data_alteracao,
            versao,
            dados_originais,
            updated_at
        )
        VALUES (
            p_cliente_uuid,
            v_venda_id,
            CASE 
                WHEN v_venda->>'numero' IS NULL OR v_venda->>'numero' = 'null' THEN NULL
                ELSE (v_venda->>'numero')::INTEGER
            END,
            CASE 
                WHEN v_venda->>'data' IS NULL OR v_venda->>'data' = 'null' THEN NULL
                ELSE (v_venda->>'data')::DATE
            END,
            CASE 
                WHEN v_venda->>'data_inicio' IS NULL OR v_venda->>'data_inicio' = 'null' THEN 
                    CASE 
                        WHEN v_venda->>'data' IS NULL OR v_venda->>'data' = 'null' THEN NULL
                        ELSE (v_venda->>'data')::DATE
                    END
                ELSE (v_venda->>'data_inicio')::DATE
            END,
            CASE 
                WHEN v_venda->>'total' IS NULL OR v_venda->>'total' = 'null' THEN NULL
                ELSE (v_venda->>'total')::NUMERIC(15,2)
            END,
            NULLIF(v_venda->>'tipo', 'null'),
            NULLIF(v_venda->>'itens', 'null'),
            CASE 
                WHEN v_situacao IS NULL OR v_situacao = 'null'::jsonb THEN NULL
                ELSE v_situacao->>'nome'
            END,
            CASE 
                WHEN v_venda->>'condicao_pagamento' IS NULL OR v_venda->>'condicao_pagamento' = 'null' THEN NULL
                ELSE (v_venda->>'condicao_pagamento')::BOOLEAN
            END,
            CASE 
                WHEN v_venda->>'id_legado' IS NULL OR v_venda->>'id_legado' = 'null' THEN NULL
                ELSE (v_venda->>'id_legado')::INTEGER
            END,
            CASE 
                WHEN v_cliente IS NULL OR v_cliente = 'null'::jsonb THEN NULL
                ELSE v_cliente->>'id'
            END,
            CASE 
                WHEN v_cliente IS NULL OR v_cliente = 'null'::jsonb THEN NULL
                ELSE v_cliente->>'nome'
            END,
            CASE 
                WHEN v_vendedor IS NULL OR v_vendedor = 'null'::jsonb THEN NULL
                ELSE v_vendedor->>'id'
            END,
            CASE 
                WHEN v_vendedor IS NULL OR v_vendedor = 'null'::jsonb THEN NULL
                ELSE v_vendedor->>'nome'
            END,
            CASE 
                WHEN v_venda->>'criado_em' IS NULL OR v_venda->>'criado_em' = 'null' THEN NULL
                ELSE (v_venda->>'criado_em')::TIMESTAMP WITH TIME ZONE
            END,
            CASE 
                WHEN v_venda->>'data_alteracao' IS NULL OR v_venda->>'data_alteracao' = 'null' THEN NULL
                ELSE (v_venda->>'data_alteracao')::TIMESTAMP WITH TIME ZONE
            END,
            CASE 
                WHEN v_venda->>'versao' IS NULL OR v_venda->>'versao' = 'null' THEN NULL
                ELSE (v_venda->>'versao')::INTEGER
            END,
            v_venda,
            NOW()
        )
        ON CONFLICT (cliente_id, venda_id)
        DO UPDATE SET
            numero = EXCLUDED.numero,
            data = EXCLUDED.data,
            data_inicio = EXCLUDED.data_inicio,
            total = EXCLUDED.total,
            tipo = EXCLUDED.tipo,
            itens = EXCLUDED.itens,
            situacao = EXCLUDED.situacao,
            condicao_pagamento = EXCLUDED.condicao_pagamento,
            id_legado = EXCLUDED.id_legado,
            cliente_venda_id = EXCLUDED.cliente_venda_id,
            cliente_venda_nome = EXCLUDED.cliente_venda_nome,
            vendedor_id = EXCLUDED.vendedor_id,
            vendedor_nome = EXCLUDED.vendedor_nome,
            data_criacao = EXCLUDED.data_criacao,
            data_alteracao = EXCLUDED.data_alteracao,
            versao = EXCLUDED.versao,
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
        'message', format('Processadas %s vendas', v_count)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_upsert_vendas IS 'Insere ou atualiza vendas coletadas da API. Recebe array JSONB de vendas. Extrai campos específicos (numero, data, data_inicio, total, tipo, itens, situacao, condicao_pagamento, id_legado, cliente_venda_id, cliente_venda_nome, vendedor_id, vendedor_nome, data_criacao, data_alteracao, versao) e mantém dados_originais como backup.';

-- ============================================
-- RPC: Upsert Contratos
-- Insere ou atualiza contratos coletados da API Conta Azul
-- ============================================
DROP FUNCTION IF EXISTS rpc_upsert_contratos(UUID, JSONB);
CREATE OR REPLACE FUNCTION rpc_upsert_contratos(
    p_cliente_uuid UUID,
    p_dados JSONB
)
RETURNS JSON AS $$
DECLARE
    v_contrato JSONB;
    v_contrato_id TEXT;
    v_cliente JSONB;
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
    
    -- Processar cada contrato no array
    FOR v_contrato IN SELECT * FROM jsonb_array_elements(p_dados)
    LOOP
        -- Extrair contrato_id (campo 'id' da API)
        v_contrato_id := v_contrato->>'id';
        
        -- Se não tem id, usar hash do JSON como fallback
        IF v_contrato_id IS NULL THEN
            v_contrato_id := md5(v_contrato::TEXT);
        END IF;
        
        -- Extrair dados do cliente (objeto aninhado)
        v_cliente := v_contrato->'cliente';
        
        -- Verificar se já existe antes do upsert
        IF EXISTS (SELECT 1 FROM contratos WHERE cliente_id = p_cliente_uuid AND contrato_id = v_contrato_id) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert contrato com colunas específicas
        INSERT INTO contratos (
            cliente_id,
            contrato_id,
            numero,
            data_inicio,
            status,
            proximo_vencimento,
            cliente_contrato_id,
            cliente_contrato_nome,
            data_criacao,
            data_alteracao,
            versao,
            dados_originais,
            updated_at
        )
        VALUES (
            p_cliente_uuid,
            v_contrato_id,
            CASE 
                WHEN v_contrato->>'numero' IS NULL OR v_contrato->>'numero' = 'null' THEN NULL
                ELSE (v_contrato->>'numero')::INTEGER
            END,
            CASE 
                WHEN v_contrato->>'data_inicio' IS NULL OR v_contrato->>'data_inicio' = 'null' THEN NULL
                ELSE (v_contrato->>'data_inicio')::DATE
            END,
            NULLIF(v_contrato->>'status', 'null'),
            CASE 
                WHEN v_contrato->>'proximo_vencimento' IS NULL OR v_contrato->>'proximo_vencimento' = 'null' THEN NULL
                ELSE (v_contrato->>'proximo_vencimento')::DATE
            END,
            CASE 
                WHEN v_cliente IS NULL OR v_cliente = 'null'::jsonb THEN NULL
                ELSE v_cliente->>'id'
            END,
            CASE 
                WHEN v_cliente IS NULL OR v_cliente = 'null'::jsonb THEN NULL
                ELSE v_cliente->>'nome'
            END,
            CASE 
                WHEN v_contrato->>'criado_em' IS NULL OR v_contrato->>'criado_em' = 'null' THEN NULL
                ELSE (v_contrato->>'criado_em')::TIMESTAMP WITH TIME ZONE
            END,
            CASE 
                WHEN v_contrato->>'data_alteracao' IS NULL OR v_contrato->>'data_alteracao' = 'null' THEN NULL
                ELSE (v_contrato->>'data_alteracao')::TIMESTAMP WITH TIME ZONE
            END,
            CASE 
                WHEN v_contrato->>'versao' IS NULL OR v_contrato->>'versao' = 'null' THEN NULL
                ELSE (v_contrato->>'versao')::INTEGER
            END,
            v_contrato,
            NOW()
        )
        ON CONFLICT (cliente_id, contrato_id)
        DO UPDATE SET
            numero = EXCLUDED.numero,
            data_inicio = EXCLUDED.data_inicio,
            status = EXCLUDED.status,
            proximo_vencimento = EXCLUDED.proximo_vencimento,
            cliente_contrato_id = EXCLUDED.cliente_contrato_id,
            cliente_contrato_nome = EXCLUDED.cliente_contrato_nome,
            data_criacao = EXCLUDED.data_criacao,
            data_alteracao = EXCLUDED.data_alteracao,
            versao = EXCLUDED.versao,
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
        'message', format('Processados %s contratos', v_count)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION rpc_upsert_contratos IS 'Insere ou atualiza contratos coletados da API. Recebe array JSONB de contratos. Extrai campos específicos (numero, data_inicio, status, proximo_vencimento, cliente_contrato_id, cliente_contrato_nome, data_criacao, data_alteracao, versao) e mantém dados_originais como backup.';