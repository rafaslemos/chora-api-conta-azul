-- ============================================================================
-- Migration 020: Criar View de Contas Financeiras Unificadas
-- ============================================================================
-- View unificada que combina contas a pagar e receber detalhadas
-- Adaptado para usar tenant_id ao invés de cliente_id e schemas corretos
-- ============================================================================

-- ============================================
-- VIEW: vw_contas_financeiras_unificadas
-- Unifica contas_pagar_detalhadas e contas_receber_detalhadas
-- ============================================
CREATE OR REPLACE VIEW integrations_conta_azul.vw_contas_financeiras_unificadas AS
SELECT 
    -- Identificação
    id,
    tenant_id,
    conta_id, -- conta_pagar_id ou conta_receber_id
    parcela_id,
    tipo, -- 'PAGAR' ou 'RECEBER'
    
    -- Dados do rateio
    categoria_id,
    categoria_nome,
    centro_custo_id,
    centro_custo_nome,
    
    -- Valores
    valor_rateio,
    valor_total_parcela,
    valor_pago,
    valor_nao_pago,
    
    -- Dados da parcela
    data_vencimento,
    status,
    status_traduzido,
    
    -- Dados da pessoa (fornecedor ou cliente)
    pessoa_id, -- fornecedor_id ou cliente_conta_id
    pessoa_nome, -- fornecedor_nome ou cliente_conta_nome
    
    -- Dados do evento financeiro
    evento_id,
    evento_tipo,
    data_competencia,
    
    -- Timestamps
    created_at,
    updated_at
    
FROM (
    -- Contas a Pagar
    SELECT 
        id,
        tenant_id,
        conta_pagar_id AS conta_id,
        parcela_id,
        'PAGAR' AS tipo,
        categoria_id,
        categoria_nome,
        centro_custo_id,
        centro_custo_nome,
        valor_rateio,
        valor_total_parcela,
        valor_pago,
        valor_nao_pago,
        data_vencimento,
        status,
        status_traduzido,
        fornecedor_id AS pessoa_id,
        fornecedor_nome AS pessoa_nome,
        evento_id,
        evento_tipo,
        data_competencia,
        created_at,
        updated_at
    FROM integrations_conta_azul.contas_pagar_detalhadas
    
    UNION ALL
    
    -- Contas a Receber
    SELECT 
        id,
        tenant_id,
        conta_receber_id AS conta_id,
        parcela_id,
        'RECEBER' AS tipo,
        categoria_id,
        categoria_nome,
        centro_custo_id,
        centro_custo_nome,
        valor_rateio,
        valor_total_parcela,
        valor_pago,
        valor_nao_pago,
        data_vencimento,
        status,
        status_traduzido,
        cliente_conta_id AS pessoa_id,
        cliente_conta_nome AS pessoa_nome,
        evento_id,
        evento_tipo,
        data_competencia,
        created_at,
        updated_at
    FROM integrations_conta_azul.contas_receber_detalhadas
) AS contas_unificadas;

-- Comentário na view
COMMENT ON VIEW integrations_conta_azul.vw_contas_financeiras_unificadas IS 'View unificada que combina contas a pagar e receber detalhadas. A coluna tipo indica se é PAGAR ou RECEBER, e pessoa_id/pessoa_nome referenciam fornecedor (PAGAR) ou cliente (RECEBER).';

-- Conceder permissões na view
GRANT SELECT ON integrations_conta_azul.vw_contas_financeiras_unificadas TO authenticated;
GRANT SELECT ON integrations_conta_azul.vw_contas_financeiras_unificadas TO anon;
