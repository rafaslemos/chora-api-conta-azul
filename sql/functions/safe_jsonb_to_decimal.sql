-- ============================================================================
-- Função Auxiliar: Converter JSONB para DECIMAL de forma segura
-- ============================================================================
-- Esta função auxiliar converte valores JSONB (número ou string) para DECIMAL
-- tratando erros e valores inválidos
-- ============================================================================

CREATE OR REPLACE FUNCTION public.safe_jsonb_to_decimal(
    p_value JSONB
)
RETURNS DECIMAL AS $$
DECLARE
    v_result DECIMAL;
    v_text_value TEXT;
BEGIN
    -- Se for NULL, retornar NULL
    IF p_value IS NULL OR p_value = 'null'::jsonb THEN
        RETURN NULL;
    END IF;
    
    -- Verificar o tipo do JSONB
    CASE jsonb_typeof(p_value)
        WHEN 'number' THEN
            -- Se for número diretamente, converter
            v_result := (p_value #>> '{}')::DECIMAL;
        WHEN 'string' THEN
            -- Se for string, extrair e converter
            v_text_value := TRIM(p_value #>> '{}');
            -- Verificar se string está vazia ou contém apenas espaços
            IF v_text_value = '' OR v_text_value = 'null' OR v_text_value = 'NULL' THEN
                RETURN NULL;
            END IF;
            -- Tentar converter para DECIMAL
            BEGIN
                v_result := v_text_value::DECIMAL;
            EXCEPTION WHEN OTHERS THEN
                -- Se falhar, retornar NULL
                RETURN NULL;
            END;
        ELSE
            -- Para outros tipos (boolean, object, array, null), retornar NULL
            RETURN NULL;
    END CASE;
    
    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    -- Em caso de qualquer erro, retornar NULL
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.safe_jsonb_to_decimal IS 'Converte valor JSONB (número ou string) para DECIMAL de forma segura, retornando NULL em caso de erro ou valor inválido';
