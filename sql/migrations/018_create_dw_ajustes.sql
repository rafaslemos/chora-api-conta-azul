-- ============================================================================
-- Migration 018: Ajustes do Data Warehouse
-- ============================================================================
-- Este script aplica melhorias identificadas na análise da estrutura do DW
-- Inclui constraints CHECK, funções de verificação de integridade e atualização de estatísticas
-- Adaptado para usar tenant_id ao invés de cliente_id
-- ============================================================================

-- ============================================
-- 1. CONSTRAINTS CHECK PARA INTEGRIDADE (MÉDIA PRIORIDADE)
-- ============================================
-- O que são: Regras de validação que garantem dados válidos
-- Por que são importantes: Previnem dados inválidos antes que entrem no DW
-- Benefício esperado: Dados sempre válidos, erros claros, confiança nos relatórios
--
-- Exemplo prático:
-- Sem constraint: Pode inserir valor_total = -100 (inválido)
-- Com constraint CHECK (valor_total >= 0): PostgreSQL rejeita e retorna erro claro
-- ============================================

-- Validar valores monetários não negativos
DO $$
BEGIN
    -- fato_contas_financeiras
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.fato_contas_financeiras'::regclass 
        AND conname = 'chk_valor_rateio_nao_negativo'
    ) THEN
        ALTER TABLE dw.fato_contas_financeiras
        ADD CONSTRAINT chk_valor_rateio_nao_negativo 
        CHECK (valor_rateio >= 0);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.fato_contas_financeiras'::regclass 
        AND conname = 'chk_valor_total_parcela_nao_negativo'
    ) THEN
        ALTER TABLE dw.fato_contas_financeiras
        ADD CONSTRAINT chk_valor_total_parcela_nao_negativo 
        CHECK (valor_total_parcela >= 0);
    END IF;
    
    -- fato_vendas
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.fato_vendas'::regclass 
        AND conname = 'chk_valor_total_nao_negativo'
    ) THEN
        ALTER TABLE dw.fato_vendas
        ADD CONSTRAINT chk_valor_total_nao_negativo 
        CHECK (valor_total >= 0);
    END IF;
    
    -- fato_vendas_itens
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.fato_vendas_itens'::regclass 
        AND conname = 'chk_valor_total_item_nao_negativo'
    ) THEN
        ALTER TABLE dw.fato_vendas_itens
        ADD CONSTRAINT chk_valor_total_item_nao_negativo 
        CHECK (valor_total >= 0);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.fato_vendas_itens'::regclass 
        AND conname = 'chk_quantidade_positiva'
    ) THEN
        ALTER TABLE dw.fato_vendas_itens
        ADD CONSTRAINT chk_quantidade_positiva 
        CHECK (quantidade > 0);
    END IF;
    
    -- dim_categoria
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.dim_categoria'::regclass 
        AND conname = 'chk_nivel_maximo_valido'
    ) THEN
        ALTER TABLE dw.dim_categoria
        ADD CONSTRAINT chk_nivel_maximo_valido 
        CHECK (nivel_maximo IS NULL OR (nivel_maximo >= 1 AND nivel_maximo <= 5));
    END IF;
    
    -- dim_categoria_dre
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.dim_categoria_dre'::regclass 
        AND conname = 'chk_nivel_maximo_dre_valido'
    ) THEN
        ALTER TABLE dw.dim_categoria_dre
        ADD CONSTRAINT chk_nivel_maximo_dre_valido 
        CHECK (nivel_maximo IS NULL OR (nivel_maximo >= 1 AND nivel_maximo <= 5));
    END IF;
    
    -- dim_conta_financeira
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.dim_conta_financeira'::regclass 
        AND conname = 'chk_tipo_conta_valido'
    ) THEN
        ALTER TABLE dw.dim_conta_financeira
        ADD CONSTRAINT chk_tipo_conta_valido 
        CHECK (tipo IS NULL OR tipo IN (
            'APLICACAO', 
            'CAIXINHA', 
            'CONTA_CORRENTE', 
            'CARTAO_CREDITO',
            'INVESTIMENTO',
            'OUTROS', 
            'MEIOS_RECEBIMENTO', 
            'POUPANCA', 
            'COBRANCAS_CONTA_AZUL', 
            'RECEBA_FACIL_CARTAO'
        ));
    END IF;
    
    -- dim_pessoa
    -- Nota: A API retorna valores com acentos ("Física", "Jurídica", "Estrangeira")
    -- mas podem ser armazenados sem acentos. Aceitar ambos os formatos.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.dim_pessoa'::regclass 
        AND conname = 'chk_tipo_pessoa_valido'
    ) THEN
        ALTER TABLE dw.dim_pessoa
        ADD CONSTRAINT chk_tipo_pessoa_valido 
        CHECK (tipo_pessoa IS NULL OR tipo_pessoa IN (
            'FISICA', 'JURIDICA', 'ESTRANGEIRA',  -- Formato sem acentos
            'Física', 'Jurídica', 'Estrangeira'   -- Formato com acentos (da API)
        ));
    END IF;
    
    -- Nota: A API retorna perfis com primeira letra maiúscula ("Cliente", "Fornecedor", "Transportadora")
    -- mas podem ser armazenados em maiúsculas. Aceitar ambos os formatos.
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'dw.dim_pessoa'::regclass 
        AND conname = 'chk_tipo_perfil_valido'
    ) THEN
        ALTER TABLE dw.dim_pessoa
        ADD CONSTRAINT chk_tipo_perfil_valido 
        CHECK (tipo_perfil IS NULL OR tipo_perfil IN (
            'CLIENTE', 'FORNECEDOR', 'TRANSPORTADORA',  -- Formato maiúsculas
            'Cliente', 'Fornecedor', 'Transportadora'   -- Formato da API (primeira letra maiúscula)
        ));
    END IF;
END $$;

-- ============================================
-- 2. FUNÇÃO DE VERIFICAÇÃO DE INTEGRIDADE (BAIXA PRIORIDADE)
-- ============================================
-- O que são: Funções que verificam se os dados estão consistentes após ETL
-- Por que são importantes: Identificam problemas rapidamente, garantem qualidade
-- Benefício esperado: Detecção rápida de problemas, relatórios confiáveis
--
-- Exemplo de uso:
-- SELECT * FROM dw.verificar_integridade_dw();
-- Retorna: tabela, problema, quantidade de registros afetados
-- ============================================

CREATE OR REPLACE FUNCTION dw.verificar_integridade_dw(p_tenant_id UUID DEFAULT NULL)
RETURNS TABLE(
    tabela TEXT,
    problema TEXT,
    quantidade BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    -- Fatos sem dimensão calendário
    SELECT 
        'fato_contas_financeiras'::TEXT,
        'Registros sem data_id (data não encontrada no calendário)'::TEXT,
        COUNT(*)::BIGINT
    FROM dw.fato_contas_financeiras
    WHERE data_id IS NULL
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    
    UNION ALL
    
    -- Vendas sem dimensão calendário
    SELECT 
        'fato_vendas'::TEXT,
        'Registros sem data_id'::TEXT,
        COUNT(*)::BIGINT
    FROM dw.fato_vendas
    WHERE data_id IS NULL
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    
    UNION ALL
    
    -- Contas financeiras sem categoria (mas categoria_id não é obrigatório)
    SELECT 
        'fato_contas_financeiras'::TEXT,
        'Registros sem categoria_id (categoria não encontrada)'::TEXT,
        COUNT(*)::BIGINT
    FROM dw.fato_contas_financeiras
    WHERE categoria_id IS NULL
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    
    UNION ALL
    
    -- Vendas sem vendedor (mas vendedor_id não é obrigatório)
    SELECT 
        'fato_vendas'::TEXT,
        'Registros sem vendedor_id'::TEXT,
        COUNT(*)::BIGINT
    FROM dw.fato_vendas
    WHERE vendedor_id IS NULL
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
    
    UNION ALL
    
    -- Saldos sem conta financeira
    SELECT 
        'fato_saldos_contas'::TEXT,
        'Registros sem conta_financeira_id'::TEXT,
        COUNT(*)::BIGINT
    FROM dw.fato_saldos_contas
    WHERE conta_financeira_id IS NULL
      AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id);
END;
$$;

COMMENT ON FUNCTION dw.verificar_integridade_dw(UUID) IS 'Verifica integridade referencial do DW. Retorna problemas encontrados com quantidade de registros afetados. Se p_tenant_id for NULL, verifica todos os tenants.';

-- ============================================
-- 3. FUNÇÃO DE ATUALIZAÇÃO DE ESTATÍSTICAS (BAIXA PRIORIDADE)
-- ============================================
-- O que são: Atualiza estatísticas do PostgreSQL sobre distribuição de dados
-- Por que são importantes: PostgreSQL escolhe melhor plano de execução de queries
-- Benefício esperado: Queries mais rápidas, performance consistente
--
-- Exemplo prático:
-- Tabela tem 1000 registros, mas estatísticas dizem 100
-- PostgreSQL pode escolher plano ruim (scan completo quando poderia usar índice)
-- Após ANALYZE: Estatísticas atualizadas, plano otimizado escolhido
--
-- Quando executar: Após cada ETL completo (carregar_dw_completo)
-- ============================================

CREATE OR REPLACE FUNCTION dw.atualizar_estatisticas_dw()
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    ANALYZE dw.dim_calendario;
    ANALYZE dw.dim_categoria;
    ANALYZE dw.dim_categoria_dre;
    ANALYZE dw.dim_centro_custo;
    ANALYZE dw.dim_pessoa;
    ANALYZE dw.dim_conta_financeira;
    ANALYZE dw.dim_vendedor;
    ANALYZE dw.fato_contas_financeiras;
    ANALYZE dw.fato_vendas;
    ANALYZE dw.fato_vendas_itens;
    ANALYZE dw.fato_contratos;
    ANALYZE dw.fato_saldos_contas;
    ANALYZE dw.mascara_totalizadores_dre;
END;
$$;

COMMENT ON FUNCTION dw.atualizar_estatisticas_dw() IS 'Atualiza estatísticas do PostgreSQL para todas as tabelas do DW. Deve ser executado após cada ETL para otimizar performance de queries.';

-- ============================================
-- 4. MELHORAR DOCUMENTAÇÃO DAS VIEWS (BAIXA PRIORIDADE)
-- ============================================

COMMENT ON VIEW dw.vw_fluxo_caixa IS 'View de fluxo de caixa agregado por data de vencimento. Separado por tipo (PAGAR/RECEBER). Agrupa valores pagos e não pagos por data de vencimento.';

-- View vw_dre foi removida - ver seção 0 acima para detalhes

COMMENT ON VIEW dw.vw_performance_vendedores IS 'View de performance de vendedores com métricas agregadas de vendas e itens. Inclui quantidade de vendas, valor total, ticket médio e quantidade de itens vendidos por período.';

COMMENT ON VIEW dw.vw_analise_categorias IS 'View de análise de categorias financeiras com hierarquia nivelada e totais agregados por período. Permite análise de receitas e despesas por categoria com drill-down por níveis hierárquicos.';


