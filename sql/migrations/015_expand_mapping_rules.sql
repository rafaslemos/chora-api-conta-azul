-- ============================================================================
-- Migração 015: Expandir tabela mapping_rules com novos campos
-- ============================================================================
-- Adiciona campos para suportar diferentes tipos de lançamento e configurações
-- Adiciona triggers para validar conteúdo de campos JSONB (segurança)
-- ============================================================================

-- Adicionar novos campos à tabela mapping_rules
ALTER TABLE public.mapping_rules
ADD COLUMN IF NOT EXISTS lancamento_type TEXT CHECK (lancamento_type IN ('RECEITA', 'DESPESA', 'TAXA', 'FRETE')),
ADD COLUMN IF NOT EXISTS conta_padrao BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS config JSONB DEFAULT '{}'::jsonb;

-- Comentários
COMMENT ON COLUMN public.mapping_rules.lancamento_type IS 'Tipo de lançamento: RECEITA, DESPESA, TAXA ou FRETE';
COMMENT ON COLUMN public.mapping_rules.conta_padrao IS 'Se true, usa como fallback quando nenhuma regra específica aplicar';
COMMENT ON COLUMN public.mapping_rules.config IS 'Configurações adicionais em JSONB (ex: percentual de taxa, condições especiais)';

-- ⚠️ SEGURANÇA: Função para validar que config JSONB não contém tokens ou credenciais
CREATE OR REPLACE FUNCTION public.validate_mapping_rule_config(p_config JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    v_key TEXT;
    v_value TEXT;
    v_sensitive_fields TEXT[] := ARRAY[
        'access_token', 'refresh_token', 'api_key', 'api_secret', 
        'token', 'password', 'secret', 'authorization', 'x-api-key'
    ];
BEGIN
    -- Se config for null ou vazio, é válido
    IF p_config IS NULL OR p_config = '{}'::jsonb THEN
        RETURN TRUE;
    END IF;

    -- Verificar cada chave no JSONB
    FOR v_key IN SELECT jsonb_object_keys(p_config) LOOP
        -- Verificar se a chave contém campos sensíveis
        FOREACH v_value IN ARRAY v_sensitive_fields LOOP
            IF LOWER(v_key) LIKE '%' || LOWER(v_value) || '%' THEN
                RAISE EXCEPTION 'Campo sensível detectado no config: %', v_key;
            END IF;
        END LOOP;

        -- Verificar se o valor contém tokens (strings que parecem tokens)
        v_value := p_config->>v_key;
        IF v_value IS NOT NULL AND (
            LENGTH(v_value) > 50 AND v_value ~ '^[A-Za-z0-9_-]+$' OR
            v_value ILIKE '%token%' OR
            v_value ILIKE '%bearer%' OR
            v_value ILIKE '%authorization%'
        ) THEN
            RAISE EXCEPTION 'Valor suspeito detectado no config para chave: %', v_key;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION public.validate_mapping_rule_config(JSONB) IS 'Valida que config JSONB não contém tokens ou credenciais';

-- ⚠️ SEGURANÇA: Trigger para validar config antes de inserir/atualizar
CREATE OR REPLACE FUNCTION public.check_mapping_rule_config()
RETURNS TRIGGER AS $$
BEGIN
    -- Validar config se não for null ou vazio
    IF NEW.config IS NOT NULL AND NEW.config != '{}'::jsonb THEN
        PERFORM public.validate_mapping_rule_config(NEW.config);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.check_mapping_rule_config() IS 'Trigger para validar config antes de inserir/atualizar mapping_rules';

-- Criar trigger
DROP TRIGGER IF EXISTS validate_mapping_rule_config_trigger ON public.mapping_rules;
CREATE TRIGGER validate_mapping_rule_config_trigger
    BEFORE INSERT OR UPDATE ON public.mapping_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.check_mapping_rule_config();

-- ⚠️ SEGURANÇA: Validar tamanho máximo de campos de texto
ALTER TABLE public.mapping_rules
ADD CONSTRAINT mapping_rules_name_length CHECK (LENGTH(name) <= 100),
ADD CONSTRAINT mapping_rules_condition_value_length CHECK (LENGTH(condition_value) <= 255),
ADD CONSTRAINT mapping_rules_target_account_length CHECK (LENGTH(target_account) <= 100);

-- ⚠️ SEGURANÇA: Validar range de prioridade
ALTER TABLE public.mapping_rules
ADD CONSTRAINT mapping_rules_priority_range CHECK (priority >= 0 AND priority <= 9999);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_mapping_rules_lancamento_type ON public.mapping_rules(tenant_id, lancamento_type);
CREATE INDEX IF NOT EXISTS idx_mapping_rules_conta_padrao ON public.mapping_rules(tenant_id, conta_padrao) WHERE conta_padrao = TRUE;
CREATE INDEX IF NOT EXISTS idx_mapping_rules_config_gin ON public.mapping_rules USING GIN (config);

-- Atualizar updated_at quando config mudar
CREATE OR REPLACE FUNCTION public.update_mapping_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_mapping_rules_updated_at_trigger ON public.mapping_rules;
CREATE TRIGGER update_mapping_rules_updated_at_trigger
    BEFORE UPDATE ON public.mapping_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.update_mapping_rules_updated_at();
