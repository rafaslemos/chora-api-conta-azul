-- ============================================================================
-- Migration 014: Criar Tabela dim_calendario e Função carregar_dim_calendario
-- ============================================================================
-- Cria a dimensão calendário para análise temporal e função para preenchê-la
-- Adaptado para usar tenant_id ao invés de cliente_id
-- ============================================================================

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
