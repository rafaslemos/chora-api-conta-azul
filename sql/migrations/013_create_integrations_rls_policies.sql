-- ============================================================================
-- Migration 013: Criar Políticas RLS para Schemas integrations e integrations_conta_azul
-- ============================================================================
-- Cria políticas RLS para todas as tabelas dos schemas integrations e 
-- integrations_conta_azul, garantindo isolamento por tenant
-- ============================================================================

-- ============================================
-- SCHEMA: integrations
-- ============================================

-- Habilitar RLS em todas as tabelas do schema integrations
ALTER TABLE integrations.controle_carga ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations.config_periodicidade ENABLE ROW LEVEL SECURITY;

-- Políticas para integrations.controle_carga
DROP POLICY IF EXISTS "Users can view controle_carga for their tenants" ON integrations.controle_carga;
CREATE POLICY "Users can view controle_carga for their tenants"
    ON integrations.controle_carga
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM app_core.profiles 
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert controle_carga for their tenants" ON integrations.controle_carga;
CREATE POLICY "Users can insert controle_carga for their tenants"
    ON integrations.controle_carga
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM app_core.profiles 
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update controle_carga for their tenants" ON integrations.controle_carga;
CREATE POLICY "Users can update controle_carga for their tenants"
    ON integrations.controle_carga
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM app_core.profiles 
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete controle_carga for their tenants" ON integrations.controle_carga;
CREATE POLICY "Users can delete controle_carga for their tenants"
    ON integrations.controle_carga
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM app_core.profiles 
            WHERE user_id = auth.uid()
        )
    );

-- Políticas para integrations.config_periodicidade
DROP POLICY IF EXISTS "Users can view config_periodicidade for their tenants" ON integrations.config_periodicidade;
CREATE POLICY "Users can view config_periodicidade for their tenants"
    ON integrations.config_periodicidade
    FOR SELECT
    USING (
        tenant_id IN (
            SELECT tenant_id FROM app_core.profiles 
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can insert config_periodicidade for their tenants" ON integrations.config_periodicidade;
CREATE POLICY "Users can insert config_periodicidade for their tenants"
    ON integrations.config_periodicidade
    FOR INSERT
    WITH CHECK (
        tenant_id IN (
            SELECT tenant_id FROM app_core.profiles 
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update config_periodicidade for their tenants" ON integrations.config_periodicidade;
CREATE POLICY "Users can update config_periodicidade for their tenants"
    ON integrations.config_periodicidade
    FOR UPDATE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM app_core.profiles 
            WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete config_periodicidade for their tenants" ON integrations.config_periodicidade;
CREATE POLICY "Users can delete config_periodicidade for their tenants"
    ON integrations.config_periodicidade
    FOR DELETE
    USING (
        tenant_id IN (
            SELECT tenant_id FROM app_core.profiles 
            WHERE user_id = auth.uid()
        )
    );

-- ============================================
-- SCHEMA: integrations_conta_azul
-- ============================================

-- Habilitar RLS em todas as tabelas do schema integrations_conta_azul
ALTER TABLE integrations_conta_azul.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.categorias_dre ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.centro_custos ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.pessoas ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.servicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.contas_financeiras ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.contas_pagar_detalhadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.contas_receber_detalhadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.parcelas_detalhes ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.saldos_contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.vendas_detalhadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_conta_azul.vendas_itens ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para verificar acesso ao tenant
CREATE OR REPLACE FUNCTION integrations_conta_azul.user_has_tenant_access(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM app_core.profiles 
        WHERE user_id = auth.uid() 
        AND tenant_id = p_tenant_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas genéricas para todas as tabelas de entidades
-- Usando uma função auxiliar para simplificar

-- Categorias
DROP POLICY IF EXISTS "Users can view categorias for their tenants" ON integrations_conta_azul.categorias;
CREATE POLICY "Users can view categorias for their tenants"
    ON integrations_conta_azul.categorias FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert categorias for their tenants" ON integrations_conta_azul.categorias;
CREATE POLICY "Users can insert categorias for their tenants"
    ON integrations_conta_azul.categorias FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update categorias for their tenants" ON integrations_conta_azul.categorias;
CREATE POLICY "Users can update categorias for their tenants"
    ON integrations_conta_azul.categorias FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete categorias for their tenants" ON integrations_conta_azul.categorias;
CREATE POLICY "Users can delete categorias for their tenants"
    ON integrations_conta_azul.categorias FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Categorias DRE
DROP POLICY IF EXISTS "Users can view categorias_dre for their tenants" ON integrations_conta_azul.categorias_dre;
CREATE POLICY "Users can view categorias_dre for their tenants"
    ON integrations_conta_azul.categorias_dre FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert categorias_dre for their tenants" ON integrations_conta_azul.categorias_dre;
CREATE POLICY "Users can insert categorias_dre for their tenants"
    ON integrations_conta_azul.categorias_dre FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update categorias_dre for their tenants" ON integrations_conta_azul.categorias_dre;
CREATE POLICY "Users can update categorias_dre for their tenants"
    ON integrations_conta_azul.categorias_dre FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete categorias_dre for their tenants" ON integrations_conta_azul.categorias_dre;
CREATE POLICY "Users can delete categorias_dre for their tenants"
    ON integrations_conta_azul.categorias_dre FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Centro Custos
DROP POLICY IF EXISTS "Users can view centro_custos for their tenants" ON integrations_conta_azul.centro_custos;
CREATE POLICY "Users can view centro_custos for their tenants"
    ON integrations_conta_azul.centro_custos FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert centro_custos for their tenants" ON integrations_conta_azul.centro_custos;
CREATE POLICY "Users can insert centro_custos for their tenants"
    ON integrations_conta_azul.centro_custos FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update centro_custos for their tenants" ON integrations_conta_azul.centro_custos;
CREATE POLICY "Users can update centro_custos for their tenants"
    ON integrations_conta_azul.centro_custos FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete centro_custos for their tenants" ON integrations_conta_azul.centro_custos;
CREATE POLICY "Users can delete centro_custos for their tenants"
    ON integrations_conta_azul.centro_custos FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Pessoas
DROP POLICY IF EXISTS "Users can view pessoas for their tenants" ON integrations_conta_azul.pessoas;
CREATE POLICY "Users can view pessoas for their tenants"
    ON integrations_conta_azul.pessoas FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert pessoas for their tenants" ON integrations_conta_azul.pessoas;
CREATE POLICY "Users can insert pessoas for their tenants"
    ON integrations_conta_azul.pessoas FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update pessoas for their tenants" ON integrations_conta_azul.pessoas;
CREATE POLICY "Users can update pessoas for their tenants"
    ON integrations_conta_azul.pessoas FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete pessoas for their tenants" ON integrations_conta_azul.pessoas;
CREATE POLICY "Users can delete pessoas for their tenants"
    ON integrations_conta_azul.pessoas FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Produtos
DROP POLICY IF EXISTS "Users can view produtos for their tenants" ON integrations_conta_azul.produtos;
CREATE POLICY "Users can view produtos for their tenants"
    ON integrations_conta_azul.produtos FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert produtos for their tenants" ON integrations_conta_azul.produtos;
CREATE POLICY "Users can insert produtos for their tenants"
    ON integrations_conta_azul.produtos FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update produtos for their tenants" ON integrations_conta_azul.produtos;
CREATE POLICY "Users can update produtos for their tenants"
    ON integrations_conta_azul.produtos FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete produtos for their tenants" ON integrations_conta_azul.produtos;
CREATE POLICY "Users can delete produtos for their tenants"
    ON integrations_conta_azul.produtos FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Serviços
DROP POLICY IF EXISTS "Users can view servicos for their tenants" ON integrations_conta_azul.servicos;
CREATE POLICY "Users can view servicos for their tenants"
    ON integrations_conta_azul.servicos FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert servicos for their tenants" ON integrations_conta_azul.servicos;
CREATE POLICY "Users can insert servicos for their tenants"
    ON integrations_conta_azul.servicos FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update servicos for their tenants" ON integrations_conta_azul.servicos;
CREATE POLICY "Users can update servicos for their tenants"
    ON integrations_conta_azul.servicos FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete servicos for their tenants" ON integrations_conta_azul.servicos;
CREATE POLICY "Users can delete servicos for their tenants"
    ON integrations_conta_azul.servicos FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Vendedores
DROP POLICY IF EXISTS "Users can view vendedores for their tenants" ON integrations_conta_azul.vendedores;
CREATE POLICY "Users can view vendedores for their tenants"
    ON integrations_conta_azul.vendedores FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert vendedores for their tenants" ON integrations_conta_azul.vendedores;
CREATE POLICY "Users can insert vendedores for their tenants"
    ON integrations_conta_azul.vendedores FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update vendedores for their tenants" ON integrations_conta_azul.vendedores;
CREATE POLICY "Users can update vendedores for their tenants"
    ON integrations_conta_azul.vendedores FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete vendedores for their tenants" ON integrations_conta_azul.vendedores;
CREATE POLICY "Users can delete vendedores for their tenants"
    ON integrations_conta_azul.vendedores FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Contas Financeiras
DROP POLICY IF EXISTS "Users can view contas_financeiras for their tenants" ON integrations_conta_azul.contas_financeiras;
CREATE POLICY "Users can view contas_financeiras for their tenants"
    ON integrations_conta_azul.contas_financeiras FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert contas_financeiras for their tenants" ON integrations_conta_azul.contas_financeiras;
CREATE POLICY "Users can insert contas_financeiras for their tenants"
    ON integrations_conta_azul.contas_financeiras FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update contas_financeiras for their tenants" ON integrations_conta_azul.contas_financeiras;
CREATE POLICY "Users can update contas_financeiras for their tenants"
    ON integrations_conta_azul.contas_financeiras FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete contas_financeiras for their tenants" ON integrations_conta_azul.contas_financeiras;
CREATE POLICY "Users can delete contas_financeiras for their tenants"
    ON integrations_conta_azul.contas_financeiras FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Contas a Pagar
DROP POLICY IF EXISTS "Users can view contas_pagar for their tenants" ON integrations_conta_azul.contas_pagar;
CREATE POLICY "Users can view contas_pagar for their tenants"
    ON integrations_conta_azul.contas_pagar FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert contas_pagar for their tenants" ON integrations_conta_azul.contas_pagar;
CREATE POLICY "Users can insert contas_pagar for their tenants"
    ON integrations_conta_azul.contas_pagar FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update contas_pagar for their tenants" ON integrations_conta_azul.contas_pagar;
CREATE POLICY "Users can update contas_pagar for their tenants"
    ON integrations_conta_azul.contas_pagar FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete contas_pagar for their tenants" ON integrations_conta_azul.contas_pagar;
CREATE POLICY "Users can delete contas_pagar for their tenants"
    ON integrations_conta_azul.contas_pagar FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Contas a Receber
DROP POLICY IF EXISTS "Users can view contas_receber for their tenants" ON integrations_conta_azul.contas_receber;
CREATE POLICY "Users can view contas_receber for their tenants"
    ON integrations_conta_azul.contas_receber FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert contas_receber for their tenants" ON integrations_conta_azul.contas_receber;
CREATE POLICY "Users can insert contas_receber for their tenants"
    ON integrations_conta_azul.contas_receber FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update contas_receber for their tenants" ON integrations_conta_azul.contas_receber;
CREATE POLICY "Users can update contas_receber for their tenants"
    ON integrations_conta_azul.contas_receber FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete contas_receber for their tenants" ON integrations_conta_azul.contas_receber;
CREATE POLICY "Users can delete contas_receber for their tenants"
    ON integrations_conta_azul.contas_receber FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Contas a Pagar Detalhadas
DROP POLICY IF EXISTS "Users can view contas_pagar_detalhadas for their tenants" ON integrations_conta_azul.contas_pagar_detalhadas;
CREATE POLICY "Users can view contas_pagar_detalhadas for their tenants"
    ON integrations_conta_azul.contas_pagar_detalhadas FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert contas_pagar_detalhadas for their tenants" ON integrations_conta_azul.contas_pagar_detalhadas;
CREATE POLICY "Users can insert contas_pagar_detalhadas for their tenants"
    ON integrations_conta_azul.contas_pagar_detalhadas FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update contas_pagar_detalhadas for their tenants" ON integrations_conta_azul.contas_pagar_detalhadas;
CREATE POLICY "Users can update contas_pagar_detalhadas for their tenants"
    ON integrations_conta_azul.contas_pagar_detalhadas FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete contas_pagar_detalhadas for their tenants" ON integrations_conta_azul.contas_pagar_detalhadas;
CREATE POLICY "Users can delete contas_pagar_detalhadas for their tenants"
    ON integrations_conta_azul.contas_pagar_detalhadas FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Contas a Receber Detalhadas
DROP POLICY IF EXISTS "Users can view contas_receber_detalhadas for their tenants" ON integrations_conta_azul.contas_receber_detalhadas;
CREATE POLICY "Users can view contas_receber_detalhadas for their tenants"
    ON integrations_conta_azul.contas_receber_detalhadas FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert contas_receber_detalhadas for their tenants" ON integrations_conta_azul.contas_receber_detalhadas;
CREATE POLICY "Users can insert contas_receber_detalhadas for their tenants"
    ON integrations_conta_azul.contas_receber_detalhadas FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update contas_receber_detalhadas for their tenants" ON integrations_conta_azul.contas_receber_detalhadas;
CREATE POLICY "Users can update contas_receber_detalhadas for their tenants"
    ON integrations_conta_azul.contas_receber_detalhadas FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete contas_receber_detalhadas for their tenants" ON integrations_conta_azul.contas_receber_detalhadas;
CREATE POLICY "Users can delete contas_receber_detalhadas for their tenants"
    ON integrations_conta_azul.contas_receber_detalhadas FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Parcelas Detalhes
DROP POLICY IF EXISTS "Users can view parcelas_detalhes for their tenants" ON integrations_conta_azul.parcelas_detalhes;
CREATE POLICY "Users can view parcelas_detalhes for their tenants"
    ON integrations_conta_azul.parcelas_detalhes FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert parcelas_detalhes for their tenants" ON integrations_conta_azul.parcelas_detalhes;
CREATE POLICY "Users can insert parcelas_detalhes for their tenants"
    ON integrations_conta_azul.parcelas_detalhes FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update parcelas_detalhes for their tenants" ON integrations_conta_azul.parcelas_detalhes;
CREATE POLICY "Users can update parcelas_detalhes for their tenants"
    ON integrations_conta_azul.parcelas_detalhes FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete parcelas_detalhes for their tenants" ON integrations_conta_azul.parcelas_detalhes;
CREATE POLICY "Users can delete parcelas_detalhes for their tenants"
    ON integrations_conta_azul.parcelas_detalhes FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Contratos
DROP POLICY IF EXISTS "Users can view contratos for their tenants" ON integrations_conta_azul.contratos;
CREATE POLICY "Users can view contratos for their tenants"
    ON integrations_conta_azul.contratos FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert contratos for their tenants" ON integrations_conta_azul.contratos;
CREATE POLICY "Users can insert contratos for their tenants"
    ON integrations_conta_azul.contratos FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update contratos for their tenants" ON integrations_conta_azul.contratos;
CREATE POLICY "Users can update contratos for their tenants"
    ON integrations_conta_azul.contratos FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete contratos for their tenants" ON integrations_conta_azul.contratos;
CREATE POLICY "Users can delete contratos for their tenants"
    ON integrations_conta_azul.contratos FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Saldos Contas
DROP POLICY IF EXISTS "Users can view saldos_contas for their tenants" ON integrations_conta_azul.saldos_contas;
CREATE POLICY "Users can view saldos_contas for their tenants"
    ON integrations_conta_azul.saldos_contas FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert saldos_contas for their tenants" ON integrations_conta_azul.saldos_contas;
CREATE POLICY "Users can insert saldos_contas for their tenants"
    ON integrations_conta_azul.saldos_contas FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update saldos_contas for their tenants" ON integrations_conta_azul.saldos_contas;
CREATE POLICY "Users can update saldos_contas for their tenants"
    ON integrations_conta_azul.saldos_contas FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete saldos_contas for their tenants" ON integrations_conta_azul.saldos_contas;
CREATE POLICY "Users can delete saldos_contas for their tenants"
    ON integrations_conta_azul.saldos_contas FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Vendas
DROP POLICY IF EXISTS "Users can view vendas for their tenants" ON integrations_conta_azul.vendas;
CREATE POLICY "Users can view vendas for their tenants"
    ON integrations_conta_azul.vendas FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert vendas for their tenants" ON integrations_conta_azul.vendas;
CREATE POLICY "Users can insert vendas for their tenants"
    ON integrations_conta_azul.vendas FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update vendas for their tenants" ON integrations_conta_azul.vendas;
CREATE POLICY "Users can update vendas for their tenants"
    ON integrations_conta_azul.vendas FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete vendas for their tenants" ON integrations_conta_azul.vendas;
CREATE POLICY "Users can delete vendas for their tenants"
    ON integrations_conta_azul.vendas FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Vendas Detalhadas
DROP POLICY IF EXISTS "Users can view vendas_detalhadas for their tenants" ON integrations_conta_azul.vendas_detalhadas;
CREATE POLICY "Users can view vendas_detalhadas for their tenants"
    ON integrations_conta_azul.vendas_detalhadas FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert vendas_detalhadas for their tenants" ON integrations_conta_azul.vendas_detalhadas;
CREATE POLICY "Users can insert vendas_detalhadas for their tenants"
    ON integrations_conta_azul.vendas_detalhadas FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update vendas_detalhadas for their tenants" ON integrations_conta_azul.vendas_detalhadas;
CREATE POLICY "Users can update vendas_detalhadas for their tenants"
    ON integrations_conta_azul.vendas_detalhadas FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete vendas_detalhadas for their tenants" ON integrations_conta_azul.vendas_detalhadas;
CREATE POLICY "Users can delete vendas_detalhadas for their tenants"
    ON integrations_conta_azul.vendas_detalhadas FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

-- Vendas Itens
DROP POLICY IF EXISTS "Users can view vendas_itens for their tenants" ON integrations_conta_azul.vendas_itens;
CREATE POLICY "Users can view vendas_itens for their tenants"
    ON integrations_conta_azul.vendas_itens FOR SELECT
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can insert vendas_itens for their tenants" ON integrations_conta_azul.vendas_itens;
CREATE POLICY "Users can insert vendas_itens for their tenants"
    ON integrations_conta_azul.vendas_itens FOR INSERT
    WITH CHECK (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can update vendas_itens for their tenants" ON integrations_conta_azul.vendas_itens;
CREATE POLICY "Users can update vendas_itens for their tenants"
    ON integrations_conta_azul.vendas_itens FOR UPDATE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));

DROP POLICY IF EXISTS "Users can delete vendas_itens for their tenants" ON integrations_conta_azul.vendas_itens;
CREATE POLICY "Users can delete vendas_itens for their tenants"
    ON integrations_conta_azul.vendas_itens FOR DELETE
    USING (integrations_conta_azul.user_has_tenant_access(tenant_id));
