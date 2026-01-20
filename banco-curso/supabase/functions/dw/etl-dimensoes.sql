-- Funções ETL para carregar dimensões do Data Warehouse
-- Estas funções populam as dimensões a partir das tabelas de coleta

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
-- FUNÇÃO: carregar_dim_calendario
-- Preenche a dimensão calendário com datas de 2020 a 2030
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_dim_calendario()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    data_atual DATE;
    data_fim DATE;
    registros_inseridos INTEGER := 0;
BEGIN
    -- Limpar dados existentes (opcional - comentar se não quiser limpar)
    -- TRUNCATE TABLE dw.dim_calendario;
    
    data_atual := '2020-01-01'::DATE;
    data_fim := '2030-12-31'::DATE;
    
    WHILE data_atual <= data_fim LOOP
        INSERT INTO dw.dim_calendario (
            data,
            ano,
            mes,
            dia,
            trimestre,
            semestre,
            dia_semana,
            mes_nome,
            trimestre_nome,
            semestre_nome,
            dia_semana_nome,
            ano_mes,
            ano_trimestre,
            ano_semestre
        )
        VALUES (
            data_atual,
            EXTRACT(YEAR FROM data_atual)::INTEGER,
            EXTRACT(MONTH FROM data_atual)::INTEGER,
            EXTRACT(DAY FROM data_atual)::INTEGER,
            EXTRACT(QUARTER FROM data_atual)::INTEGER,
            CASE WHEN EXTRACT(QUARTER FROM data_atual) <= 2 THEN 1 ELSE 2 END,
            EXTRACT(DOW FROM data_atual) + 1, -- PostgreSQL DOW: 0=Domingo, ajustar para 1=Domingo
            TO_CHAR(data_atual, 'TMMonth'), -- Nome do mês
            'T' || EXTRACT(QUARTER FROM data_atual)::TEXT || 'º Trimestre',
            CASE WHEN EXTRACT(QUARTER FROM data_atual) <= 2 THEN '1º Semestre' ELSE '2º Semestre' END,
            CASE EXTRACT(DOW FROM data_atual)
                WHEN 0 THEN 'Domingo'
                WHEN 1 THEN 'Segunda-feira'
                WHEN 2 THEN 'Terça-feira'
                WHEN 3 THEN 'Quarta-feira'
                WHEN 4 THEN 'Quinta-feira'
                WHEN 5 THEN 'Sexta-feira'
                WHEN 6 THEN 'Sábado'
            END,
            TO_CHAR(data_atual, 'YYYY-MM'),
            TO_CHAR(data_atual, 'YYYY') || '-Q' || EXTRACT(QUARTER FROM data_atual)::TEXT,
            TO_CHAR(data_atual, 'YYYY') || '-S' || CASE WHEN EXTRACT(QUARTER FROM data_atual) <= 2 THEN '1' ELSE '2' END
        )
        ON CONFLICT (data) DO NOTHING;
        
        registros_inseridos := registros_inseridos + 1;
        data_atual := data_atual + INTERVAL '1 day';
    END LOOP;
    
    RETURN registros_inseridos;
END;
$$;

COMMENT ON FUNCTION dw.carregar_dim_calendario() IS 'Preenche a dimensão calendário com datas de 2020 a 2030';

-- ============================================
-- FUNÇÃO AUXILIAR: construir_hierarquia_categoria
-- Constrói hierarquia nivelada de categoria recursivamente
-- ============================================
-- IMPORTANTE: Se houver erro de "function is not unique", execute primeiro:
-- DO $$ 
-- DECLARE 
--     r RECORD;
-- BEGIN
--     FOR r IN (SELECT oid, proname, pronargs FROM pg_proc WHERE proname = 'construir_hierarquia_categoria' AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dw'))
--     LOOP
--         EXECUTE 'DROP FUNCTION IF EXISTS dw.construir_hierarquia_categoria CASCADE';
--     END LOOP;
-- END $$;
--
-- Remover TODAS as versões da função antiga (pode ter múltiplas assinaturas)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT 'DROP FUNCTION IF EXISTS dw.' || proname || '(' || 
               pg_get_function_identity_arguments(oid) || ') CASCADE' AS drop_cmd
        FROM pg_proc 
        WHERE proname = 'construir_hierarquia_categoria' 
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dw')
    )
    LOOP
        EXECUTE r.drop_cmd;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION dw.construir_hierarquia_categoria(
    p_cliente_id UUID,
    p_categoria_id TEXT,
    p_categorias_visitadas TEXT[] DEFAULT ARRAY[]::TEXT[],
    p_profundidade INTEGER DEFAULT 0
)
RETURNS TABLE(
    nivel_1_desc TEXT,
    nivel_2_desc TEXT,
    nivel_3_desc TEXT,
    nivel_4_desc TEXT,
    nivel_5_desc TEXT,
    nivel_maximo INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_categoria RECORD;
    v_max_profundidade CONSTANT INTEGER := 10; -- Limite máximo de profundidade para evitar loops infinitos
BEGIN
    -- Proteção contra loops infinitos: verificar se já visitamos esta categoria
    IF p_categoria_id = ANY(p_categorias_visitadas) THEN
        RAISE WARNING 'Loop detectado na hierarquia de categorias. Cliente: %, Categoria: %, Caminho: %', 
            p_cliente_id, p_categoria_id, array_to_string(p_categorias_visitadas || ARRAY[p_categoria_id], ' -> ');
        -- Retornar hierarquia parcial até o ponto do loop
        RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Proteção contra profundidade excessiva
    IF p_profundidade >= v_max_profundidade THEN
        RAISE WARNING 'Profundidade máxima (% níveis) atingida na hierarquia. Cliente: %, Categoria: %', 
            v_max_profundidade, p_cliente_id, p_categoria_id;
        RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Buscar categoria atual
    SELECT nome, categoria_pai
    INTO v_categoria
    FROM categorias
    WHERE cliente_id = p_cliente_id
      AND categoria_id = p_categoria_id;
    
    -- Se não encontrou, retornar NULLs
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Se tem pai, buscar recursivamente primeiro (construir hierarquia da raiz até o filho)
    -- categoria_pai agora armazena diretamente o categoria_id (TEXT)
    IF v_categoria.categoria_pai IS NOT NULL THEN
        -- Chamar recursivamente para construir a hierarquia do pai primeiro
        -- O resultado já terá os níveis preenchidos [raiz, filho, ...] até o pai
        DECLARE
            v_hierarquia_pai RECORD;
            v_proximo_nivel INTEGER;
            v_pai_existe BOOLEAN;
        BEGIN
            -- Verificar se o pai existe antes de chamar recursivamente
            SELECT EXISTS(
                SELECT 1 FROM categorias 
                WHERE cliente_id = p_cliente_id 
                  AND categoria_id = v_categoria.categoria_pai
            ) INTO v_pai_existe;
            
            -- Se o pai não existe, tratar como raiz (pode ser categoria órfã)
            IF NOT v_pai_existe THEN
                RETURN QUERY SELECT
                    v_categoria.nome AS nivel_1_desc,
                    NULL::TEXT AS nivel_2_desc,
                    NULL::TEXT AS nivel_3_desc,
                    NULL::TEXT AS nivel_4_desc,
                    NULL::TEXT AS nivel_5_desc,
                    1::INTEGER AS nivel_maximo;
                RETURN;
            END IF;
            
            SELECT * INTO v_hierarquia_pai
            FROM dw.construir_hierarquia_categoria(
                p_cliente_id,
                v_categoria.categoria_pai,
                p_categorias_visitadas || ARRAY[p_categoria_id], -- Adicionar categoria atual ao caminho visitado
                p_profundidade + 1 -- Incrementar profundidade
            );
            
            -- Encontrar o próximo nível disponível (primeiro NULL após o último preenchido)
            -- O pai já tem nivel_1_desc preenchido (sempre), então o próximo é nivel_2_desc
            IF v_hierarquia_pai.nivel_2_desc IS NULL THEN
                v_proximo_nivel := 2;
            ELSIF v_hierarquia_pai.nivel_3_desc IS NULL THEN
                v_proximo_nivel := 3;
            ELSIF v_hierarquia_pai.nivel_4_desc IS NULL THEN
                v_proximo_nivel := 4;
            ELSIF v_hierarquia_pai.nivel_5_desc IS NULL THEN
                v_proximo_nivel := 5;
            ELSE
                v_proximo_nivel := 6;  -- Limite de 5 níveis atingido
            END IF;
            
            -- Retornar hierarquia com o nome atual adicionado no próximo nível
            RETURN QUERY SELECT
                v_hierarquia_pai.nivel_1_desc,
                CASE WHEN v_proximo_nivel = 2 THEN v_categoria.nome ELSE v_hierarquia_pai.nivel_2_desc END,
                CASE WHEN v_proximo_nivel = 3 THEN v_categoria.nome ELSE v_hierarquia_pai.nivel_3_desc END,
                CASE WHEN v_proximo_nivel = 4 THEN v_categoria.nome ELSE v_hierarquia_pai.nivel_4_desc END,
                CASE WHEN v_proximo_nivel = 5 THEN v_categoria.nome ELSE v_hierarquia_pai.nivel_5_desc END,
                CASE 
                    WHEN v_proximo_nivel = 6 THEN 5  -- Limite atingido: retornar 5 (máximo permitido)
                    ELSE v_proximo_nivel  -- nivel_maximo é simplesmente o próximo nível onde adicionamos o nome
                END AS nivel_maximo;
            RETURN;
        END;
    END IF;
    
    -- É raiz (sem pai), retornar hierarquia com apenas este nível
    RETURN QUERY SELECT
        v_categoria.nome AS nivel_1_desc,
        NULL::TEXT AS nivel_2_desc,
        NULL::TEXT AS nivel_3_desc,
        NULL::TEXT AS nivel_4_desc,
        NULL::TEXT AS nivel_5_desc,
        1::INTEGER AS nivel_maximo;
END;
$$;

COMMENT ON FUNCTION dw.construir_hierarquia_categoria(UUID, TEXT, TEXT[], INTEGER) IS 'Constrói hierarquia nivelada de categoria recursivamente. Protegida contra loops infinitos (detecta ciclos) e profundidade excessiva (máximo 10 níveis). Parâmetros: p_cliente_id, p_categoria_id, p_categorias_visitadas (interno), p_profundidade (interno).';

-- ============================================
-- FUNÇÃO: carregar_dim_categoria
-- Carrega dimensão de categorias com hierarquia nivelada
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_dim_categoria(p_cliente_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_categoria RECORD;
    v_hierarquia RECORD;
    v_registros INTEGER := 0;
    v_erros INTEGER := 0;
BEGIN
    -- Validação de entrada
    IF p_cliente_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clientes WHERE id = p_cliente_id) THEN
        RAISE EXCEPTION 'Cliente não encontrado: %', p_cliente_id;
    END IF;
    
    -- Loop através das categorias
    FOR v_categoria IN
        SELECT 
            c.id,
            c.cliente_id,
            c.categoria_id,
            c.nome,
            c.tipo
        FROM categorias c
        WHERE (p_cliente_id IS NULL OR c.cliente_id = p_cliente_id)
        ORDER BY c.cliente_id, c.categoria_id -- Ordenar para processamento consistente
    LOOP
        BEGIN
            -- Construir hierarquia
            SELECT * INTO v_hierarquia
            FROM dw.construir_hierarquia_categoria(
                v_categoria.cliente_id,
                v_categoria.categoria_id
            );
            
            -- Inserir ou atualizar dimensão
            INSERT INTO dw.dim_categoria (
                cliente_id,
                categoria_api_id,
                nome,
                tipo,
                nivel_1_desc,
                nivel_2_desc,
                nivel_3_desc,
                nivel_4_desc,
                nivel_5_desc,
                nivel_maximo
            )
            VALUES (
                v_categoria.cliente_id,
                v_categoria.categoria_id,
                v_categoria.nome,
                v_categoria.tipo,
                v_hierarquia.nivel_1_desc,
                v_hierarquia.nivel_2_desc,
                v_hierarquia.nivel_3_desc,
                v_hierarquia.nivel_4_desc,
                v_hierarquia.nivel_5_desc,
                v_hierarquia.nivel_maximo
            )
            ON CONFLICT (cliente_id, categoria_api_id)
            DO UPDATE SET
                nome = EXCLUDED.nome,
                tipo = EXCLUDED.tipo,
                nivel_1_desc = EXCLUDED.nivel_1_desc,
                nivel_2_desc = EXCLUDED.nivel_2_desc,
                nivel_3_desc = EXCLUDED.nivel_3_desc,
                nivel_4_desc = EXCLUDED.nivel_4_desc,
                nivel_5_desc = EXCLUDED.nivel_5_desc,
                nivel_maximo = EXCLUDED.nivel_maximo,
                updated_at = NOW();
            
            v_registros := v_registros + 1;
        EXCEPTION
            WHEN OTHERS THEN
                v_erros := v_erros + 1;
                RAISE WARNING 'Erro ao processar categoria % (cliente: %): %', 
                    v_categoria.categoria_id, v_categoria.cliente_id, SQLERRM;
        END;
    END LOOP;
    
    IF v_erros > 0 THEN
        RAISE WARNING 'Processamento concluído com % erros de % categorias processadas', v_erros, v_registros + v_erros;
    END IF;
    
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_dim_categoria(UUID) IS 'Carrega dimensão de categorias com hierarquia nivelada. Se p_cliente_id for NULL, carrega todos os clientes.';

-- ============================================
-- FUNÇÃO AUXILIAR: construir_hierarquia_categoria_dre
-- Constrói hierarquia nivelada de categoria DRE recursivamente
-- ============================================
-- Remover TODAS as versões da função antiga (pode ter múltiplas assinaturas)
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (
        SELECT 'DROP FUNCTION IF EXISTS dw.' || proname || '(' || 
               pg_get_function_identity_arguments(oid) || ') CASCADE' AS drop_cmd
        FROM pg_proc 
        WHERE proname = 'construir_hierarquia_categoria_dre' 
          AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dw')
    )
    LOOP
        EXECUTE r.drop_cmd;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION dw.construir_hierarquia_categoria_dre(
    p_cliente_id UUID,
    p_categoria_dre_id TEXT,
    p_nivel INTEGER DEFAULT 1,
    p_niveis TEXT[] DEFAULT ARRAY[]::TEXT[],
    p_categorias_visitadas TEXT[] DEFAULT ARRAY[]::TEXT[]
)
RETURNS TABLE(
    nivel_1_desc TEXT,
    nivel_2_desc TEXT,
    nivel_3_desc TEXT,
    nivel_4_desc TEXT,
    nivel_5_desc TEXT,
    nivel_maximo INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_categoria RECORD;
    v_niveis TEXT[];
    v_max_profundidade CONSTANT INTEGER := 10; -- Limite máximo de profundidade
BEGIN
    -- Proteção contra loops infinitos: verificar se já visitamos esta categoria
    IF p_categoria_dre_id = ANY(p_categorias_visitadas) THEN
        RAISE WARNING 'Loop detectado na hierarquia de categorias DRE. Cliente: %, Categoria: %, Caminho: %', 
            p_cliente_id, p_categoria_dre_id, array_to_string(p_categorias_visitadas || ARRAY[p_categoria_dre_id], ' -> ');
        RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Proteção contra profundidade excessiva
    IF p_nivel >= v_max_profundidade THEN
        RAISE WARNING 'Profundidade máxima (% níveis) atingida na hierarquia DRE. Cliente: %, Categoria: %', 
            v_max_profundidade, p_cliente_id, p_categoria_dre_id;
        RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Buscar categoria atual
    SELECT descricao, categoria_dre_pai_id
    INTO v_categoria
    FROM categorias_dre
    WHERE cliente_id = p_cliente_id
      AND categoria_dre_id = p_categoria_dre_id;
    
    -- Se não encontrou, retornar NULLs
    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0::INTEGER;
        RETURN;
    END IF;
    
    -- Adicionar descrição atual aos níveis
    v_niveis := ARRAY[v_categoria.descricao] || p_niveis;
    
    -- Se tem pai, buscar recursivamente
    IF v_categoria.categoria_dre_pai_id IS NOT NULL THEN
        RETURN QUERY
        SELECT * FROM dw.construir_hierarquia_categoria_dre(
            p_cliente_id,
            v_categoria.categoria_dre_pai_id,
            p_nivel + 1,
            v_niveis,
            p_categorias_visitadas || ARRAY[p_categoria_dre_id] -- Adicionar categoria atual ao caminho visitado
        );
    ELSE
        -- É raiz, retornar hierarquia
        RETURN QUERY SELECT
            COALESCE(v_niveis[1], NULL)::TEXT AS nivel_1_desc,
            COALESCE(v_niveis[2], NULL)::TEXT AS nivel_2_desc,
            COALESCE(v_niveis[3], NULL)::TEXT AS nivel_3_desc,
            COALESCE(v_niveis[4], NULL)::TEXT AS nivel_4_desc,
            COALESCE(v_niveis[5], NULL)::TEXT AS nivel_5_desc,
            LEAST(array_length(v_niveis, 1), 5)::INTEGER AS nivel_maximo;
    END IF;
END;
$$;

COMMENT ON FUNCTION dw.construir_hierarquia_categoria_dre(UUID, TEXT, INTEGER, TEXT[], TEXT[]) IS 'Constrói hierarquia nivelada de categoria DRE recursivamente. Protegida contra loops infinitos (detecta ciclos) e profundidade excessiva (máximo 10 níveis). Parâmetros: p_cliente_id, p_categoria_dre_id, p_nivel (interno), p_niveis (interno), p_categorias_visitadas (interno).';

-- ============================================
-- FUNÇÃO: carregar_dim_categoria_dre
-- Carrega dimensão de categorias DRE com hierarquia nivelada
-- Expande categorias financeiras associadas como nível adicional
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_dim_categoria_dre(p_cliente_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_categoria RECORD;
    v_hierarquia RECORD;
    v_categoria_financeira JSONB;
    v_registros INTEGER := 0;
    v_erros INTEGER := 0;
    v_nivel_proximo INTEGER;
    v_nome_cf TEXT;
BEGIN
    -- Validação de entrada
    IF p_cliente_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clientes WHERE id = p_cliente_id) THEN
        RAISE EXCEPTION 'Cliente não encontrado: %', p_cliente_id;
    END IF;
    
    FOR v_categoria IN
        SELECT 
            cd.id,
            cd.cliente_id,
            cd.categoria_dre_id,
            cd.descricao,
            cd.codigo,
            cd.posicao,
            cd.dados_originais
        FROM categorias_dre cd
        WHERE (p_cliente_id IS NULL OR cd.cliente_id = p_cliente_id)
        ORDER BY cd.cliente_id, cd.categoria_dre_id -- Ordenar para processamento consistente
    LOOP
        BEGIN
            -- Construir hierarquia da categoria DRE
            SELECT * INTO v_hierarquia
            FROM dw.construir_hierarquia_categoria_dre(
                v_categoria.cliente_id,
                v_categoria.categoria_dre_id
            );
            
            -- Inserir ou atualizar registro da categoria DRE (sem expansão)
            INSERT INTO dw.dim_categoria_dre (
                cliente_id,
                categoria_dre_api_id,
                descricao,
                codigo,
                posicao,
                categoria_financeira_id,
                nivel_1_desc,
                nivel_2_desc,
                nivel_3_desc,
                nivel_4_desc,
                nivel_5_desc,
                nivel_maximo
            )
            VALUES (
                v_categoria.cliente_id,
                v_categoria.categoria_dre_id,
                v_categoria.descricao,
                v_categoria.codigo,
                v_categoria.posicao,
                NULL, -- Registro da categoria DRE (sem expansão)
                v_hierarquia.nivel_1_desc,
                v_hierarquia.nivel_2_desc,
                v_hierarquia.nivel_3_desc,
                v_hierarquia.nivel_4_desc,
                v_hierarquia.nivel_5_desc,
                v_hierarquia.nivel_maximo
            )
            ON CONFLICT (cliente_id, categoria_dre_api_id, categoria_financeira_id)
            DO UPDATE SET
                descricao = EXCLUDED.descricao,
                codigo = EXCLUDED.codigo,
                posicao = EXCLUDED.posicao,
                nivel_1_desc = EXCLUDED.nivel_1_desc,
                nivel_2_desc = EXCLUDED.nivel_2_desc,
                nivel_3_desc = EXCLUDED.nivel_3_desc,
                nivel_4_desc = EXCLUDED.nivel_4_desc,
                nivel_5_desc = EXCLUDED.nivel_5_desc,
                nivel_maximo = EXCLUDED.nivel_maximo,
                updated_at = NOW();
            
            v_registros := v_registros + 1;
            
            -- Expandir categorias financeiras (apenas se ainda há espaço na hierarquia)
            IF v_hierarquia.nivel_maximo < 5 AND 
               v_categoria.dados_originais ? 'categorias_financeiras' AND
               jsonb_typeof(v_categoria.dados_originais->'categorias_financeiras') = 'array' THEN
                
                -- Processar cada categoria financeira
                FOR v_categoria_financeira IN
                    SELECT value
                    FROM jsonb_array_elements(v_categoria.dados_originais->'categorias_financeiras')
                    WHERE (value->>'ativo')::boolean = true  -- Apenas categorias ativas
                LOOP
                    -- Calcular próximo nível
                    v_nivel_proximo := v_hierarquia.nivel_maximo + 1;
                    v_nome_cf := v_categoria_financeira->>'nome';
                    
                    -- Inserir ou atualizar registro expandido
                    -- O nome da categoria financeira vai no próximo nível disponível
                    INSERT INTO dw.dim_categoria_dre (
                        cliente_id,
                        categoria_dre_api_id,
                        descricao,
                        codigo,
                        posicao,
                        categoria_financeira_id,
                        nivel_1_desc,
                        nivel_2_desc,
                        nivel_3_desc,
                        nivel_4_desc,
                        nivel_5_desc,
                        nivel_maximo
                    )
                    VALUES (
                        v_categoria.cliente_id,
                        v_categoria.categoria_dre_id,
                        v_categoria.descricao,
                        v_categoria.codigo,
                        v_categoria.posicao, -- Manter mesma posição da categoria DRE base
                        v_categoria_financeira->>'id', -- ID da categoria financeira
                        v_hierarquia.nivel_1_desc,
                        CASE WHEN v_nivel_proximo = 2 THEN v_nome_cf ELSE v_hierarquia.nivel_2_desc END,
                        CASE WHEN v_nivel_proximo = 3 THEN v_nome_cf ELSE v_hierarquia.nivel_3_desc END,
                        CASE WHEN v_nivel_proximo = 4 THEN v_nome_cf ELSE v_hierarquia.nivel_4_desc END,
                        CASE WHEN v_nivel_proximo = 5 THEN v_nome_cf ELSE v_hierarquia.nivel_5_desc END,
                        v_nivel_proximo
                    )
                    ON CONFLICT (cliente_id, categoria_dre_api_id, categoria_financeira_id)
                    DO UPDATE SET
                        descricao = EXCLUDED.descricao,
                        codigo = EXCLUDED.codigo,
                        posicao = EXCLUDED.posicao,
                        nivel_1_desc = EXCLUDED.nivel_1_desc,
                        nivel_2_desc = EXCLUDED.nivel_2_desc,
                        nivel_3_desc = EXCLUDED.nivel_3_desc,
                        nivel_4_desc = EXCLUDED.nivel_4_desc,
                        nivel_5_desc = EXCLUDED.nivel_5_desc,
                        nivel_maximo = EXCLUDED.nivel_maximo,
                        updated_at = NOW();
                    
                    v_registros := v_registros + 1;
                END LOOP;
            END IF;
            
        EXCEPTION
            WHEN OTHERS THEN
                v_erros := v_erros + 1;
                RAISE WARNING 'Erro ao processar categoria DRE % (cliente: %): %', 
                    v_categoria.categoria_dre_id, v_categoria.cliente_id, SQLERRM;
        END;
    END LOOP;
    
    IF v_erros > 0 THEN
        RAISE WARNING 'Processamento concluído com % erros de % categorias DRE processadas', v_erros, v_registros + v_erros;
    END IF;
    
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_dim_categoria_dre(UUID) IS 'Carrega dimensão de categorias DRE com hierarquia nivelada. Expande categorias financeiras associadas como nível adicional na hierarquia. Se p_cliente_id for NULL, carrega todos os clientes.';

-- ============================================
-- FUNÇÃO: carregar_mascara_totalizadores_dre
-- Identifica e popula tabela máscara com totalizadores DRE
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_mascara_totalizadores_dre(p_cliente_id UUID DEFAULT NULL)
RETURNS TABLE(
    total_inseridos INTEGER,
    total_atualizados INTEGER,
    detalhes JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_inseridos INTEGER := 0;
    v_atualizados INTEGER := 0;
    v_detalhes JSONB;
    v_antes INTEGER;
    v_depois INTEGER;
BEGIN
    -- Validação de entrada
    IF p_cliente_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clientes WHERE id = p_cliente_id) THEN
        RAISE EXCEPTION 'Cliente não encontrado: %', p_cliente_id;
    END IF;
    
    -- Contar registros antes
    SELECT COUNT(*) INTO v_antes
    FROM dw.mascara_totalizadores_dre
    WHERE (p_cliente_id IS NULL OR cliente_id = p_cliente_id);
    
    -- Inserir ou atualizar totalizadores identificados
    WITH totalizadores AS (
        SELECT DISTINCT
            cd.cliente_id,
            cd.posicao,
            cd.categoria_dre_id,
            cd.descricao,
            cd.codigo
        FROM categorias_dre cd
        WHERE cd.categoria_dre_pai_id IS NULL
          AND cd.codigo IS NULL
          AND (cd.dados_originais->'subitens')::jsonb = '[]'::jsonb
          AND (cd.dados_originais->'categorias_financeiras')::jsonb = '[]'::jsonb
          AND (p_cliente_id IS NULL OR cd.cliente_id = p_cliente_id)
    )
    INSERT INTO dw.mascara_totalizadores_dre (
        cliente_id,
        posicao,
        categoria_dre_api_id,
        descricao,
        codigo
    )
    SELECT 
        t.cliente_id,
        t.posicao,
        t.categoria_dre_id,
        t.descricao,
        t.codigo
    FROM totalizadores t
    ON CONFLICT (cliente_id, posicao)
    DO UPDATE SET
        categoria_dre_api_id = EXCLUDED.categoria_dre_api_id,
        descricao = EXCLUDED.descricao,
        codigo = EXCLUDED.codigo,
        updated_at = NOW();
    
    -- Contar registros depois
    SELECT COUNT(*) INTO v_depois
    FROM dw.mascara_totalizadores_dre
    WHERE (p_cliente_id IS NULL OR cliente_id = p_cliente_id);
    
    -- Calcular inseridos e atualizados
    v_inseridos := v_depois - v_antes;
    v_atualizados := GREATEST(0, (SELECT COUNT(*) 
                                  FROM dw.mascara_totalizadores_dre
                                  WHERE (p_cliente_id IS NULL OR cliente_id = p_cliente_id)
                                    AND updated_at > created_at
                                    AND updated_at > NOW() - INTERVAL '1 minute'));
    
    -- Atualizar FK categoria_dre_id na máscara (após popular dim_categoria_dre)
    UPDATE dw.mascara_totalizadores_dre mt
    SET categoria_dre_id = dcd.categoria_dre_id
    FROM dw.dim_categoria_dre dcd
    WHERE dcd.cliente_id = mt.cliente_id
      AND dcd.categoria_dre_api_id = mt.categoria_dre_api_id
      AND dcd.categoria_financeira_id IS NULL -- Apenas registros base, não expandidos
      AND mt.categoria_dre_id IS NULL -- Apenas atualizar se ainda não tem FK
      AND (p_cliente_id IS NULL OR mt.cliente_id = p_cliente_id);
    
    -- Coletar detalhes dos totalizadores
    SELECT jsonb_agg(
        jsonb_build_object(
            'cliente_id', cliente_id,
            'posicao', posicao,
            'categoria_dre_api_id', categoria_dre_api_id,
            'descricao', descricao,
            'codigo', codigo
        )
        ORDER BY cliente_id, posicao
    ) INTO v_detalhes
    FROM dw.mascara_totalizadores_dre
    WHERE (p_cliente_id IS NULL OR cliente_id = p_cliente_id);
    
    RETURN QUERY SELECT v_inseridos, v_atualizados, v_detalhes;
END;
$$;

COMMENT ON FUNCTION dw.carregar_mascara_totalizadores_dre(UUID) IS 'Identifica e popula tabela máscara com totalizadores DRE. Totalizadores são categorias raiz (sem pai) com codigo NULL, subitens vazios e categorias_financeiras vazias. Se p_cliente_id for NULL, processa todos os clientes.';

-- ============================================
-- FUNÇÃO: carregar_dim_centro_custo
-- Carrega dimensão de centros de custo
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_dim_centro_custo(p_cliente_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_registros INTEGER;
BEGIN
    -- Validação de entrada
    IF p_cliente_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clientes WHERE id = p_cliente_id) THEN
        RAISE EXCEPTION 'Cliente não encontrado: %', p_cliente_id;
    END IF;
    
    INSERT INTO dw.dim_centro_custo (
        cliente_id,
        centro_custo_api_id,
        nome,
        codigo,
        ativo
    )
    SELECT 
        cc.cliente_id,
        cc.centro_custo_id,
        cc.nome,
        cc.codigo,
        cc.ativo
    FROM centro_custos cc
    WHERE (p_cliente_id IS NULL OR cc.cliente_id = p_cliente_id)
    ON CONFLICT (cliente_id, centro_custo_api_id)
    DO UPDATE SET
        nome = EXCLUDED.nome,
        codigo = EXCLUDED.codigo,
        ativo = EXCLUDED.ativo,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_registros = ROW_COUNT;
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_dim_centro_custo(UUID) IS 'Carrega dimensão de centros de custo. Se p_cliente_id for NULL, carrega todos os clientes.';

-- ============================================
-- FUNÇÃO: carregar_dim_pessoa
-- Carrega dimensão de pessoas (clientes/fornecedores)
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_dim_pessoa(p_cliente_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_pessoa RECORD;
    v_registros INTEGER := 0;
    v_erros INTEGER := 0;
    v_tipo_perfil TEXT;
    v_endereco JSONB;
    v_cidade TEXT;
    v_uf TEXT;
    v_pais TEXT;
BEGIN
    -- Validação de entrada
    IF p_cliente_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clientes WHERE id = p_cliente_id) THEN
        RAISE EXCEPTION 'Cliente não encontrado: %', p_cliente_id;
    END IF;
    
    FOR v_pessoa IN
        SELECT 
            p.id,
            p.cliente_id,
            p.pessoa_id,
            p.nome,
            p.documento,
            p.tipo_pessoa,
            p.perfis,
            p.dados_originais
        FROM pessoas p
        WHERE (p_cliente_id IS NULL OR p.cliente_id = p_cliente_id)
        ORDER BY p.cliente_id, p.pessoa_id -- Ordenar para processamento consistente
    LOOP
        BEGIN
        -- Extrair primeiro perfil do array
        v_tipo_perfil := CASE 
            WHEN v_pessoa.perfis IS NOT NULL AND array_length(v_pessoa.perfis, 1) > 0 
            THEN v_pessoa.perfis[1]
            ELSE NULL
        END;
        
        -- Extrair endereço do JSONB (se disponível)
        IF v_pessoa.dados_originais ? 'enderecos' AND jsonb_array_length(v_pessoa.dados_originais->'enderecos') > 0 THEN
            v_endereco := v_pessoa.dados_originais->'enderecos'->0;
            v_cidade := v_endereco->>'cidade';
            v_uf := v_endereco->>'estado';
            v_pais := v_endereco->>'pais';
        ELSE
            v_cidade := NULL;
            v_uf := NULL;
            v_pais := NULL;
        END IF;
        
        INSERT INTO dw.dim_pessoa (
            cliente_id,
            pessoa_api_id,
            nome,
            documento,
            tipo_pessoa,
            tipo_perfil,
            cidade,
            uf,
            pais
        )
        VALUES (
            v_pessoa.cliente_id,
            v_pessoa.pessoa_id,
            v_pessoa.nome,
            v_pessoa.documento,
            v_pessoa.tipo_pessoa,
            v_tipo_perfil,
            v_cidade,
            v_uf,
            v_pais
        )
        ON CONFLICT (cliente_id, pessoa_api_id)
        DO UPDATE SET
            nome = EXCLUDED.nome,
            documento = EXCLUDED.documento,
            tipo_pessoa = EXCLUDED.tipo_pessoa,
            tipo_perfil = EXCLUDED.tipo_perfil,
            cidade = EXCLUDED.cidade,
            uf = EXCLUDED.uf,
            pais = EXCLUDED.pais,
            updated_at = NOW();
        
            v_registros := v_registros + 1;
        EXCEPTION
            WHEN OTHERS THEN
                v_erros := v_erros + 1;
                RAISE WARNING 'Erro ao processar pessoa % (cliente: %): %', 
                    v_pessoa.pessoa_id, v_pessoa.cliente_id, SQLERRM;
        END;
    END LOOP;
    
    IF v_erros > 0 THEN
        RAISE WARNING 'Processamento concluído com % erros de % pessoas processadas', v_erros, v_registros + v_erros;
    END IF;
    
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_dim_pessoa(UUID) IS 'Carrega dimensão de pessoas. Se p_cliente_id for NULL, carrega todos os clientes.';

-- ============================================
-- FUNÇÃO: carregar_dim_conta_financeira
-- Carrega dimensão de contas financeiras
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_dim_conta_financeira(p_cliente_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_registros INTEGER;
BEGIN
    -- Validação de entrada
    IF p_cliente_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clientes WHERE id = p_cliente_id) THEN
        RAISE EXCEPTION 'Cliente não encontrado: %', p_cliente_id;
    END IF;
    
    INSERT INTO dw.dim_conta_financeira (
        cliente_id,
        conta_financeira_api_id,
        nome,
        tipo,
        ativa
    )
    SELECT 
        cf.cliente_id,
        cf.conta_financeira_id,
        cf.nome,
        cf.tipo,
        cf.ativo
    FROM contas_financeiras cf
    WHERE (p_cliente_id IS NULL OR cf.cliente_id = p_cliente_id)
    ON CONFLICT (cliente_id, conta_financeira_api_id)
    DO UPDATE SET
        nome = EXCLUDED.nome,
        tipo = EXCLUDED.tipo,
        ativa = EXCLUDED.ativa,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_registros = ROW_COUNT;
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_dim_conta_financeira(UUID) IS 'Carrega dimensão de contas financeiras. Se p_cliente_id for NULL, carrega todos os clientes.';

-- ============================================
-- FUNÇÃO: carregar_dim_vendedor
-- Carrega dimensão de vendedores
-- ============================================
CREATE OR REPLACE FUNCTION dw.carregar_dim_vendedor(p_cliente_id UUID DEFAULT NULL)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_registros INTEGER;
BEGIN
    -- Validação de entrada
    IF p_cliente_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clientes WHERE id = p_cliente_id) THEN
        RAISE EXCEPTION 'Cliente não encontrado: %', p_cliente_id;
    END IF;
    
    INSERT INTO dw.dim_vendedor (
        cliente_id,
        vendedor_api_id,
        nome,
        ativo
    )
    SELECT 
        v.cliente_id,
        v.vendedor_id,
        v.nome,
        TRUE -- Assumir ativo se não houver flag na tabela origem
    FROM vendedores v
    WHERE (p_cliente_id IS NULL OR v.cliente_id = p_cliente_id)
    ON CONFLICT (cliente_id, vendedor_api_id)
    DO UPDATE SET
        nome = EXCLUDED.nome,
        ativo = EXCLUDED.ativo,
        updated_at = NOW();
    
    GET DIAGNOSTICS v_registros = ROW_COUNT;
    RETURN v_registros;
END;
$$;

COMMENT ON FUNCTION dw.carregar_dim_vendedor(UUID) IS 'Carrega dimensão de vendedores. Se p_cliente_id for NULL, carrega todos os clientes.';

