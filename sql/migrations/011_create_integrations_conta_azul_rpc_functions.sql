-- ============================================================================
-- Migration 011: Criar Funções RPC de Coleta Conta Azul Adaptadas
-- ============================================================================
-- Adapta funções RPC para usar tenant_id, credential_id e novos schemas
-- ============================================================================

-- ============================================
-- RPC: Buscar Controle de Carga
-- Busca status de carga para um tenant, plataforma, entidade e credencial
-- ============================================
DROP FUNCTION IF EXISTS integrations.rpc_get_controle_carga(UUID, TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION integrations.rpc_get_controle_carga(
    p_tenant_id UUID,
    p_platform TEXT,
    p_entidade_tipo TEXT,
    p_credential_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_controle RECORD;
BEGIN
    -- Buscar controle de carga
    SELECT 
        id,
        tenant_id,
        credential_id,
        platform,
        entidade_tipo,
        carga_full_realizada,
        ultima_carga_full,
        ultima_carga_incremental,
        ultima_data_processada,
        created_at,
        updated_at
    INTO v_controle
    FROM integrations.controle_carga
    WHERE tenant_id = p_tenant_id 
      AND platform = p_platform
      AND entidade_tipo = p_entidade_tipo
      AND (p_credential_id IS NULL OR credential_id = p_credential_id);
    
    -- Se não encontrou, retornar controle padrão (carga FULL não realizada)
    IF v_controle.id IS NULL THEN
        RETURN json_build_object(
            'success', true,
            'controle', json_build_object(
                'tenant_id', p_tenant_id,
                'credential_id', p_credential_id,
                'platform', p_platform,
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
            'tenant_id', v_controle.tenant_id,
            'credential_id', v_controle.credential_id,
            'platform', v_controle.platform,
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
DROP FUNCTION IF EXISTS integrations.rpc_update_controle_carga_full(UUID, TEXT, TEXT, UUID);
CREATE OR REPLACE FUNCTION integrations.rpc_update_controle_carga_full(
    p_tenant_id UUID,
    p_platform TEXT,
    p_entidade_tipo TEXT,
    p_credential_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Tentar atualizar registro existente
    UPDATE integrations.controle_carga
    SET
        carga_full_realizada = TRUE,
        ultima_carga_full = NOW(),
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id 
      AND platform = p_platform
      AND entidade_tipo = p_entidade_tipo
      AND (p_credential_id IS NULL OR credential_id = p_credential_id)
    RETURNING id INTO v_id;
    
    -- Se não encontrou, criar novo registro
    IF v_id IS NULL THEN
        INSERT INTO integrations.controle_carga (
            tenant_id,
            credential_id,
            platform,
            entidade_tipo,
            carga_full_realizada,
            ultima_carga_full
        )
        VALUES (
            p_tenant_id,
            p_credential_id,
            p_platform,
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
DROP FUNCTION IF EXISTS integrations.rpc_update_controle_carga_incremental(UUID, TEXT, TEXT, TIMESTAMPTZ, UUID);
CREATE OR REPLACE FUNCTION integrations.rpc_update_controle_carga_incremental(
    p_tenant_id UUID,
    p_platform TEXT,
    p_entidade_tipo TEXT,
    p_ultima_data TIMESTAMPTZ,
    p_credential_id UUID DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Tentar atualizar registro existente
    UPDATE integrations.controle_carga
    SET
        ultima_carga_incremental = NOW(),
        ultima_data_processada = COALESCE(p_ultima_data, NOW()),
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id 
      AND platform = p_platform
      AND entidade_tipo = p_entidade_tipo
      AND (p_credential_id IS NULL OR credential_id = p_credential_id)
    RETURNING id INTO v_id;
    
    -- Se não encontrou, criar novo registro
    IF v_id IS NULL THEN
        INSERT INTO integrations.controle_carga (
            tenant_id,
            credential_id,
            platform,
            entidade_tipo,
            carga_full_realizada,
            ultima_carga_incremental,
            ultima_data_processada
        )
        VALUES (
            p_tenant_id,
            p_credential_id,
            p_platform,
            p_entidade_tipo,
            FALSE,
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
-- RPC: Listar Todos os Tenants com Credenciais Conta Azul
-- Retorna lista de todos os tenants com credenciais Conta Azul ativas
-- ============================================
DROP FUNCTION IF EXISTS integrations.rpc_list_all_tenants_conta_azul();
CREATE OR REPLACE FUNCTION integrations.rpc_list_all_tenants_conta_azul()
RETURNS JSON AS $$
DECLARE
    v_tenants JSON;
BEGIN
    -- Buscar todos os tenants com credenciais Conta Azul ativas
    SELECT json_agg(
        json_build_object(
            'tenant_id', t.id,
            'tenant_name', t.name,
            'tenant_cnpj', t.cnpj,
            'credential_id', tc.id,
            'credential_name', tc.credential_name,
            'is_active', tc.is_active,
            'last_authenticated_at', tc.last_authenticated_at,
            'created_at', t.created_at
        ) ORDER BY t.created_at DESC
    )
    INTO v_tenants
    FROM app_core.tenants t
    INNER JOIN app_core.tenant_credentials tc ON tc.tenant_id = t.id
    WHERE tc.platform = 'CONTA_AZUL'
      AND tc.revoked_at IS NULL
      AND tc.is_active = TRUE;
    
    -- Se não encontrou tenants, retornar array vazio
    IF v_tenants IS NULL THEN
        v_tenants := '[]'::JSON;
    END IF;
    
    -- Retornar lista de tenants
    RETURN json_build_object(
        'success', true,
        'tenants', v_tenants,
        'total', json_array_length(v_tenants)
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'tenants', '[]'::JSON,
            'total', 0
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Upsert Categorias
-- Insere ou atualiza categorias coletadas da API
-- ============================================
DROP FUNCTION IF EXISTS integrations_conta_azul.rpc_upsert_categorias(UUID, UUID, JSONB);
CREATE OR REPLACE FUNCTION integrations_conta_azul.rpc_upsert_categorias(
    p_tenant_id UUID,
    p_credential_id UUID,
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
        
        -- Se não tem id, usar hash do JSON como fallback
        IF v_categoria_id IS NULL THEN
            v_categoria_id := md5(v_categoria::TEXT);
        END IF;
        
        -- Verificar se já existe antes do upsert
        IF EXISTS (SELECT 1 FROM integrations_conta_azul.categorias 
                   WHERE tenant_id = p_tenant_id 
                     AND categoria_id = v_categoria_id 
                     AND credential_id = p_credential_id) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert categoria
        INSERT INTO integrations_conta_azul.categorias (
            tenant_id,
            credential_id,
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
            p_tenant_id,
            p_credential_id,
            v_categoria_id,
            CASE 
                WHEN v_categoria->>'versao' IS NULL OR v_categoria->>'versao' = 'null' THEN NULL
                ELSE (v_categoria->>'versao')::INTEGER
            END,
            COALESCE(v_categoria->>'nome', 'Sem nome'),
            NULLIF(v_categoria->>'categoria_pai', ''),
            v_categoria->>'tipo',
            NULLIF(v_categoria->>'entrada_dre', 'null'),
            COALESCE((v_categoria->>'considera_custo_dre')::BOOLEAN, FALSE),
            v_categoria,
            NOW()
        )
        ON CONFLICT (tenant_id, categoria_id, credential_id)
        DO UPDATE SET
            versao = EXCLUDED.versao,
            nome = EXCLUDED.nome,
            categoria_pai = EXCLUDED.categoria_pai,
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
-- RPC: Upsert Pessoas
-- Insere ou atualiza pessoas coletadas da API
-- ============================================
DROP FUNCTION IF EXISTS integrations_conta_azul.rpc_upsert_pessoas(UUID, UUID, JSONB);
CREATE OR REPLACE FUNCTION integrations_conta_azul.rpc_upsert_pessoas(
    p_tenant_id UUID,
    p_credential_id UUID,
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
        IF EXISTS (SELECT 1 FROM integrations_conta_azul.pessoas 
                   WHERE tenant_id = p_tenant_id 
                     AND pessoa_id = v_pessoa_id 
                     AND credential_id = p_credential_id) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert pessoa
        INSERT INTO integrations_conta_azul.pessoas (
            tenant_id,
            credential_id,
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
            p_tenant_id,
            p_credential_id,
            v_pessoa_id,
            CASE WHEN v_pessoa->>'id_legado' IS NULL OR v_pessoa->>'id_legado' = 'null' THEN NULL ELSE (v_pessoa->>'id_legado')::INTEGER END,
            NULLIF(v_pessoa->>'uuid_legado', 'null'),
            COALESCE(v_pessoa->>'nome', 'Sem nome'),
            NULLIF(v_pessoa->>'documento', 'null'),
            NULLIF(v_pessoa->>'email', 'null'),
            NULLIF(v_pessoa->>'telefone', 'null'),
            NULLIF(v_pessoa->>'tipo_pessoa', 'null'),
            COALESCE((v_pessoa->>'ativo')::BOOLEAN, TRUE),
            NULLIF(v_pessoa->>'codigo', 'null'),
            v_perfis,
            CASE WHEN v_pessoa->>'data_alteracao' IS NULL OR v_pessoa->>'data_alteracao' = 'null' THEN NULL ELSE (v_pessoa->>'data_alteracao')::TIMESTAMPTZ END,
            CASE WHEN v_pessoa->>'data_criacao' IS NULL OR v_pessoa->>'data_criacao' = 'null' THEN NULL ELSE (v_pessoa->>'data_criacao')::TIMESTAMPTZ END,
            NULLIF(v_pessoa->>'observacoes_gerais', 'null'),
            v_pessoa,
            NOW()
        )
        ON CONFLICT (tenant_id, pessoa_id, credential_id)
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
        'message', format('Processadas %s pessoas', v_count)
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
-- RPC: Upsert Contas a Pagar
-- Insere ou atualiza contas a pagar coletadas da API
-- ============================================
DROP FUNCTION IF EXISTS integrations_conta_azul.rpc_upsert_contas_pagar(UUID, UUID, JSONB);
CREATE OR REPLACE FUNCTION integrations_conta_azul.rpc_upsert_contas_pagar(
    p_tenant_id UUID,
    p_credential_id UUID,
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
        IF EXISTS (SELECT 1 FROM integrations_conta_azul.contas_pagar 
                   WHERE tenant_id = p_tenant_id 
                     AND conta_pagar_id = v_conta_pagar_id 
                     AND credential_id = p_credential_id) THEN
            v_updated := v_updated + 1;
        ELSE
            v_inserted := v_inserted + 1;
        END IF;
        
        -- Upsert conta a pagar
        INSERT INTO integrations_conta_azul.contas_pagar (
            tenant_id,
            credential_id,
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
            p_tenant_id,
            p_credential_id,
            v_conta_pagar_id,
            NULLIF(v_conta_pagar->>'descricao', 'null'),
            CASE WHEN v_conta_pagar->>'data_vencimento' IS NULL OR v_conta_pagar->>'data_vencimento' = 'null' THEN NULL ELSE (v_conta_pagar->>'data_vencimento')::DATE END,
            NULLIF(v_conta_pagar->>'status', 'null'),
            NULLIF(v_conta_pagar->>'status_traduzido', 'null'),
            CASE WHEN v_conta_pagar->>'total' IS NULL OR v_conta_pagar->>'total' = 'null' THEN NULL ELSE (v_conta_pagar->>'total')::NUMERIC(15,2) END,
            CASE WHEN v_conta_pagar->>'nao_pago' IS NULL OR v_conta_pagar->>'nao_pago' = 'null' THEN NULL ELSE (v_conta_pagar->>'nao_pago')::NUMERIC(15,2) END,
            CASE WHEN v_conta_pagar->>'pago' IS NULL OR v_conta_pagar->>'pago' = 'null' THEN NULL ELSE (v_conta_pagar->>'pago')::NUMERIC(15,2) END,
            CASE WHEN v_conta_pagar->>'data_criacao' IS NULL OR v_conta_pagar->>'data_criacao' = 'null' THEN NULL ELSE (v_conta_pagar->>'data_criacao')::TIMESTAMPTZ END,
            CASE WHEN v_conta_pagar->>'data_alteracao' IS NULL OR v_conta_pagar->>'data_alteracao' = 'null' THEN NULL ELSE (v_conta_pagar->>'data_alteracao')::TIMESTAMPTZ END,
            CASE WHEN v_fornecedor IS NULL OR v_fornecedor = 'null'::jsonb THEN NULL ELSE v_fornecedor->>'id' END,
            CASE WHEN v_fornecedor IS NULL OR v_fornecedor = 'null'::jsonb THEN NULL ELSE v_fornecedor->>'nome' END,
            v_conta_pagar,
            NOW()
        )
        ON CONFLICT (tenant_id, conta_pagar_id, credential_id)
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
            detalhado = CASE 
                WHEN (integrations_conta_azul.contas_pagar.descricao IS DISTINCT FROM EXCLUDED.descricao
                      OR integrations_conta_azul.contas_pagar.total IS DISTINCT FROM EXCLUDED.total
                      OR integrations_conta_azul.contas_pagar.data_vencimento IS DISTINCT FROM EXCLUDED.data_vencimento
                      OR integrations_conta_azul.contas_pagar.status IS DISTINCT FROM EXCLUDED.status
                      OR integrations_conta_azul.contas_pagar.fornecedor_id IS DISTINCT FROM EXCLUDED.fornecedor_id)
                THEN FALSE
                ELSE integrations_conta_azul.contas_pagar.detalhado
            END,
            data_detalhamento = CASE 
                WHEN (integrations_conta_azul.contas_pagar.descricao IS DISTINCT FROM EXCLUDED.descricao
                      OR integrations_conta_azul.contas_pagar.total IS DISTINCT FROM EXCLUDED.total
                      OR integrations_conta_azul.contas_pagar.data_vencimento IS DISTINCT FROM EXCLUDED.data_vencimento
                      OR integrations_conta_azul.contas_pagar.status IS DISTINCT FROM EXCLUDED.status
                      OR integrations_conta_azul.contas_pagar.fornecedor_id IS DISTINCT FROM EXCLUDED.fornecedor_id)
                      AND integrations_conta_azul.contas_pagar.detalhado = TRUE
                THEN NULL
                ELSE integrations_conta_azul.contas_pagar.data_detalhamento
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

-- Comentários
COMMENT ON FUNCTION integrations.rpc_get_controle_carga IS 'Busca status de carga para um tenant, plataforma, entidade e credencial';
COMMENT ON FUNCTION integrations.rpc_update_controle_carga_full IS 'Marca carga FULL como realizada';
COMMENT ON FUNCTION integrations.rpc_update_controle_carga_incremental IS 'Atualiza última carga incremental e data processada';
COMMENT ON FUNCTION integrations.rpc_list_all_tenants_conta_azul IS 'Lista todos os tenants com credenciais Conta Azul ativas';
COMMENT ON FUNCTION integrations_conta_azul.rpc_upsert_categorias IS 'Insere ou atualiza categorias coletadas da API';
COMMENT ON FUNCTION integrations_conta_azul.rpc_upsert_pessoas IS 'Insere ou atualiza pessoas coletadas da API';
COMMENT ON FUNCTION integrations_conta_azul.rpc_upsert_contas_pagar IS 'Insere ou atualiza contas a pagar coletadas da API';
