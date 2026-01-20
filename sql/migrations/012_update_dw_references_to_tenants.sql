-- ============================================================================
-- Migration 012: Atualizar Referências no DW de clientes para tenants
-- ============================================================================
-- Atualiza todas as FOREIGN KEY e referências de clientes(id) para 
-- app_core.tenants(id) no schema dw
-- ============================================================================

-- ============================================
-- DIM_CATEGORIA: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.dim_categoria
DROP CONSTRAINT IF EXISTS dim_categoria_cliente_id_fkey;

ALTER TABLE dw.dim_categoria
ADD CONSTRAINT dim_categoria_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- Renomear coluna cliente_id para tenant_id (opcional, mantendo compatibilidade)
-- ALTER TABLE dw.dim_categoria RENAME COLUMN cliente_id TO tenant_id;
-- ALTER TABLE dw.dim_categoria RENAME CONSTRAINT dim_categoria_cliente_id_fkey TO dim_categoria_tenant_id_fkey;

-- ============================================
-- DIM_CATEGORIA_DRE: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.dim_categoria_dre
DROP CONSTRAINT IF EXISTS dim_categoria_dre_cliente_id_fkey;

ALTER TABLE dw.dim_categoria_dre
ADD CONSTRAINT dim_categoria_dre_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- MASCARA_TOTALIZADORES_DRE: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.mascara_totalizadores_dre
DROP CONSTRAINT IF EXISTS mascara_totalizadores_dre_cliente_id_fkey;

ALTER TABLE dw.mascara_totalizadores_dre
ADD CONSTRAINT mascara_totalizadores_dre_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- DIM_CENTRO_CUSTO: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.dim_centro_custo
DROP CONSTRAINT IF EXISTS dim_centro_custo_cliente_id_fkey;

ALTER TABLE dw.dim_centro_custo
ADD CONSTRAINT dim_centro_custo_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- DIM_PESSOA: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.dim_pessoa
DROP CONSTRAINT IF EXISTS dim_pessoa_cliente_id_fkey;

ALTER TABLE dw.dim_pessoa
ADD CONSTRAINT dim_pessoa_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- DIM_CONTA_FINANCEIRA: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.dim_conta_financeira
DROP CONSTRAINT IF EXISTS dim_conta_financeira_cliente_id_fkey;

ALTER TABLE dw.dim_conta_financeira
ADD CONSTRAINT dim_conta_financeira_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- DIM_VENDEDOR: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.dim_vendedor
DROP CONSTRAINT IF EXISTS dim_vendedor_cliente_id_fkey;

ALTER TABLE dw.dim_vendedor
ADD CONSTRAINT dim_vendedor_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- FATO_CONTAS_FINANCEIRAS: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.fato_contas_financeiras
DROP CONSTRAINT IF EXISTS fato_contas_financeiras_cliente_id_fkey;

ALTER TABLE dw.fato_contas_financeiras
ADD CONSTRAINT fato_contas_financeiras_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- FATO_VENDAS: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.fato_vendas
DROP CONSTRAINT IF EXISTS fato_vendas_cliente_id_fkey;

ALTER TABLE dw.fato_vendas
ADD CONSTRAINT fato_vendas_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- FATO_VENDAS_ITENS: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.fato_vendas_itens
DROP CONSTRAINT IF EXISTS fato_vendas_itens_cliente_id_fkey;

ALTER TABLE dw.fato_vendas_itens
ADD CONSTRAINT fato_vendas_itens_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- FATO_CONTRATOS: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.fato_contratos
DROP CONSTRAINT IF EXISTS fato_contratos_cliente_id_fkey;

ALTER TABLE dw.fato_contratos
ADD CONSTRAINT fato_contratos_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- FATO_SALDOS_CONTAS: Atualizar FK cliente_id
-- ============================================
ALTER TABLE dw.fato_saldos_contas
DROP CONSTRAINT IF EXISTS fato_saldos_contas_cliente_id_fkey;

ALTER TABLE dw.fato_saldos_contas
ADD CONSTRAINT fato_saldos_contas_tenant_id_fkey
FOREIGN KEY (cliente_id) REFERENCES app_core.tenants(id) ON DELETE CASCADE;

-- ============================================
-- Comentários atualizados
-- ============================================
COMMENT ON COLUMN dw.dim_categoria.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.dim_categoria_dre.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.mascara_totalizadores_dre.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.dim_centro_custo.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.dim_pessoa.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.dim_conta_financeira.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.dim_vendedor.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.fato_contas_financeiras.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.fato_vendas.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.fato_vendas_itens.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.fato_contratos.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
COMMENT ON COLUMN dw.fato_saldos_contas.cliente_id IS 'ID do tenant (referência a app_core.tenants)';
