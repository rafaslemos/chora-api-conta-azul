-- ============================================================================
-- Função Auxiliar: Converter JSONB para DATE de forma segura
-- ============================================================================
-- Esta função auxiliar converte strings JSONB de data para DATE
-- suportando múltiplos formatos comuns
-- ============================================================================

CREATE OR REPLACE FUNCTION public.safe_jsonb_to_date(
    p_value JSONB,
    p_format TEXT DEFAULT 'DD/MM/YYYY'
)
RETURNS DATE AS $$
DECLARE
    v_result DATE;
    v_text_value TEXT;
BEGIN
    -- Se for NULL, retornar NULL
    IF p_value IS NULL OR p_value = 'null'::jsonb THEN
        RETURN NULL;
    END IF;
    
    -- Se não for string, retornar NULL
    IF jsonb_typeof(p_value) != 'string' THEN
        RETURN NULL;
    END IF;
    
    -- Extrair valor como texto
    v_text_value := TRIM(p_value #>> '{}');
    
    -- Verificar se string está vazia
    IF v_text_value = '' OR v_text_value = 'null' OR v_text_value = 'NULL' THEN
        RETURN NULL;
    END IF;
    
    -- Tentar converter com o formato especificado (padrão: DD/MM/YYYY)
    BEGIN
        v_result := to_date(v_text_value, p_format);
    EXCEPTION WHEN OTHERS THEN
        -- Se falhar com formato padrão, tentar formato alternativo YYYY-MM-DD
        BEGIN
            IF p_format = 'DD/MM/YYYY' THEN
                v_result := to_date(v_text_value, 'YYYY-MM-DD');
            ELSE
                -- Se já tentou formato alternativo ou outro formato, retornar NULL
                RETURN NULL;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Se ambos os formatos falharem, retornar NULL
            RETURN NULL;
        END;
    END;
    
    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    -- Em caso de qualquer erro, retornar NULL
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.safe_jsonb_to_date IS 'Converte string JSONB de data para DATE de forma segura, suportando formatos DD/MM/YYYY e YYYY-MM-DD, retornando NULL em caso de erro';
