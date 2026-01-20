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
        -- Extrair categoria_id (pode ser 'id' ou outro campo dependendo da API)
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
        
        -- Upsert categoria
        INSERT INTO categorias (
            cliente_id,
            categoria_id,
            dados_originais,
            updated_at
        )
        VALUES (
            p_cliente_uuid,
            v_categoria_id,
            v_categoria,
            NOW()
        )
        ON CONFLICT (cliente_id, categoria_id)
        DO UPDATE SET
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

-- Comentários
COMMENT ON FUNCTION rpc_get_token_data_for_refresh IS 'Retorna dados necessários para renovação de token (refresh_token e credenciais). Usado pelos workflows de coleta.';
COMMENT ON FUNCTION rpc_get_controle_carga IS 'Busca status de carga para um cliente e entidade';
COMMENT ON FUNCTION rpc_update_controle_carga_full IS 'Marca carga FULL como realizada para um cliente e entidade';
COMMENT ON FUNCTION rpc_update_controle_carga_incremental IS 'Atualiza última carga incremental e data processada';
COMMENT ON FUNCTION rpc_list_all_clientes IS 'Lista todos os clientes cadastrados (todos estão ativos). Usado pelo orquestrador.';
COMMENT ON FUNCTION rpc_upsert_categorias IS 'Insere ou atualiza categorias coletadas da API. Recebe array JSONB de categorias.';
