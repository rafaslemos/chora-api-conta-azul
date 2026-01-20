-- ============================================================================
-- Migração 016: Criar tabela tenant_conta_azul_config
-- ============================================================================
-- Tabela para armazenar configurações específicas do Conta Azul por tenant
-- Inclui contas padrão e configurações gerais
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenant_conta_azul_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    conta_receita_padrao TEXT, -- ID da conta padrão para receitas
    conta_despesa_padrao TEXT, -- ID da conta padrão para despesas
    conta_taxa_padrao TEXT, -- ID da conta padrão para taxas
    conta_frete_padrao TEXT, -- ID da conta padrão para frete
    criar_clientes_automaticamente BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}'::jsonb, -- ⚠️ SEGURANÇA: Validar que não contém tokens ou credenciais
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(tenant_id)
);

COMMENT ON TABLE public.tenant_conta_azul_config IS 'Configurações específicas do Conta Azul por tenant';
COMMENT ON COLUMN public.tenant_conta_azul_config.conta_receita_padrao IS 'ID da conta padrão para receitas';
COMMENT ON COLUMN public.tenant_conta_azul_config.conta_despesa_padrao IS 'ID da conta padrão para despesas';
COMMENT ON COLUMN public.tenant_conta_azul_config.conta_taxa_padrao IS 'ID da conta padrão para taxas';
COMMENT ON COLUMN public.tenant_conta_azul_config.conta_frete_padrao IS 'ID da conta padrão para frete';
COMMENT ON COLUMN public.tenant_conta_azul_config.config IS 'Configurações adicionais em JSONB (validado para não conter tokens)';

-- ⚠️ SEGURANÇA: Validar formato UUID dos IDs de conta
ALTER TABLE public.tenant_conta_azul_config
ADD CONSTRAINT tenant_conta_azul_config_conta_receita_uuid CHECK (
    conta_receita_padrao IS NULL OR conta_receita_padrao ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
ADD CONSTRAINT tenant_conta_azul_config_conta_despesa_uuid CHECK (
    conta_despesa_padrao IS NULL OR conta_despesa_padrao ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
ADD CONSTRAINT tenant_conta_azul_config_conta_taxa_uuid CHECK (
    conta_taxa_padrao IS NULL OR conta_taxa_padrao ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
),
ADD CONSTRAINT tenant_conta_azul_config_conta_frete_uuid CHECK (
    conta_frete_padrao IS NULL OR conta_frete_padrao ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

-- ⚠️ SEGURANÇA: Trigger para validar config JSONB (reutilizar função existente)
CREATE OR REPLACE FUNCTION public.check_tenant_conta_azul_config()
RETURNS TRIGGER AS $$
BEGIN
    -- Validar config se não for null ou vazio
    IF NEW.config IS NOT NULL AND NEW.config != '{}'::jsonb THEN
        PERFORM public.validate_mapping_rule_config(NEW.config);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.check_tenant_conta_azul_config() IS 'Trigger para validar config antes de inserir/atualizar tenant_conta_azul_config';

-- Criar trigger
DROP TRIGGER IF EXISTS validate_tenant_conta_azul_config_trigger ON public.tenant_conta_azul_config;
CREATE TRIGGER validate_tenant_conta_azul_config_trigger
    BEFORE INSERT OR UPDATE ON public.tenant_conta_azul_config
    FOR EACH ROW
    EXECUTE FUNCTION public.check_tenant_conta_azul_config();

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_tenant_conta_azul_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tenant_conta_azul_config_updated_at_trigger ON public.tenant_conta_azul_config;
CREATE TRIGGER update_tenant_conta_azul_config_updated_at_trigger
    BEFORE UPDATE ON public.tenant_conta_azul_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_tenant_conta_azul_config_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_tenant_conta_azul_config_tenant_id ON public.tenant_conta_azul_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_conta_azul_config_config_gin ON public.tenant_conta_azul_config USING GIN (config);

-- Habilitar RLS
ALTER TABLE public.tenant_conta_azul_config ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (similar às outras tabelas)
DROP POLICY IF EXISTS "Partners can view own tenant conta azul config" ON public.tenant_conta_azul_config;
CREATE POLICY "Partners can view own tenant conta azul config"
    ON public.tenant_conta_azul_config FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_conta_azul_config.tenant_id AND t.partner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Partners can create own tenant conta azul config" ON public.tenant_conta_azul_config;
CREATE POLICY "Partners can create own tenant conta azul config"
    ON public.tenant_conta_azul_config FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_conta_azul_config.tenant_id AND t.partner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Partners can update own tenant conta azul config" ON public.tenant_conta_azul_config;
CREATE POLICY "Partners can update own tenant conta azul config"
    ON public.tenant_conta_azul_config FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_conta_azul_config.tenant_id AND t.partner_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Partners can delete own tenant conta azul config" ON public.tenant_conta_azul_config;
CREATE POLICY "Partners can delete own tenant conta azul config"
    ON public.tenant_conta_azul_config FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenants t
            WHERE t.id = tenant_conta_azul_config.tenant_id AND t.partner_id = auth.uid()
        )
    );
