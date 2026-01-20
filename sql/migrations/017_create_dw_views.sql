-- ============================================================================
-- Migration 017: Criar Views do Data Warehouse
-- ============================================================================
-- Views para análise e relatórios do Data Warehouse
-- Adaptado para usar tenant_id ao invés de cliente_id
-- ============================================================================

-- View de Fluxo de Caixa
CREATE OR REPLACE VIEW dw.vw_fluxo_caixa AS
SELECT 
    c.data,
    c.ano,
    c.mes,
    c.trimestre,
    c.ano_mes,
    c.ano_trimestre,
    f.tenant_id,
    f.tipo, -- TRUE=PAGAR, FALSE=RECEBER
    SUM(f.valor_pago) AS total_pago,
    SUM(f.valor_nao_pago) AS total_nao_pago,
    SUM(f.valor_total_parcela) AS total_parcela,
    COUNT(*) AS quantidade_parcelas
FROM dw.fato_contas_financeiras f
INNER JOIN dw.dim_calendario c ON f.data_id = c.data_id
WHERE f.data_vencimento IS NOT NULL
GROUP BY c.data, c.ano, c.mes, c.trimestre, c.ano_mes, c.ano_trimestre, f.tenant_id, f.tipo
ORDER BY c.data DESC, f.tipo;

COMMENT ON VIEW dw.vw_fluxo_caixa IS 'View de fluxo de caixa agregado por data de vencimento. Separado por tipo (PAGAR/RECEBER).';

-- View de DRE
CREATE OR REPLACE VIEW dw.vw_dre AS
SELECT 
    cd.tenant_id,
    cd.nivel_1_desc,
    cd.nivel_2_desc,
    cd.nivel_3_desc,
    cd.nivel_4_desc,
    cd.nivel_5_desc,
    cd.descricao AS categoria_dre_desc,
    c.ano,
    c.mes,
    c.trimestre,
    c.ano_mes,
    c.ano_trimestre,
    f.tipo, -- TRUE=PAGAR (despesa), FALSE=RECEBER (receita)
    SUM(CASE WHEN f.tipo = FALSE THEN f.valor_rateio ELSE 0 END) AS receitas,
    SUM(CASE WHEN f.tipo = TRUE THEN f.valor_rateio ELSE 0 END) AS despesas,
    SUM(CASE WHEN f.tipo = FALSE THEN f.valor_rateio ELSE -f.valor_rateio END) AS resultado
FROM dw.fato_contas_financeiras f
INNER JOIN dw.dim_calendario c ON f.data_id = c.data_id
LEFT JOIN dw.dim_categoria_dre cd ON f.categoria_dre_id = cd.categoria_dre_id
GROUP BY cd.tenant_id, cd.nivel_1_desc, cd.nivel_2_desc, cd.nivel_3_desc, cd.nivel_4_desc, cd.nivel_5_desc, 
         cd.descricao, c.ano, c.mes, c.trimestre, c.ano_mes, c.ano_trimestre, f.tipo
ORDER BY cd.nivel_1_desc, cd.nivel_2_desc, cd.nivel_3_desc, c.ano DESC, c.mes DESC;

COMMENT ON VIEW dw.vw_dre IS 'View de DRE (Demonstração do Resultado do Exercício) agregado por categoria DRE com hierarquia nivelada. Usa JOIN direto através da FK categoria_dre_id em fato_contas_financeiras.';

-- View de Performance de Vendedores
CREATE OR REPLACE VIEW dw.vw_performance_vendedores AS
SELECT 
    v.tenant_id,
    vd.nome AS vendedor_nome,
    c.ano,
    c.mes,
    c.trimestre,
    c.ano_mes,
    COUNT(DISTINCT v.venda_id) AS quantidade_vendas,
    SUM(v.valor_total) AS valor_total_vendas,
    SUM(vi.valor_total) AS valor_total_itens,
    SUM(vi.quantidade) AS quantidade_total_itens,
    AVG(v.valor_total) AS ticket_medio
FROM dw.fato_vendas v
INNER JOIN dw.dim_calendario c ON v.data_id = c.data_id
LEFT JOIN dw.dim_vendedor vd ON v.vendedor_id = vd.vendedor_id
LEFT JOIN dw.fato_vendas_itens vi ON v.tenant_id = vi.tenant_id AND v.venda_id = vi.venda_id
GROUP BY v.tenant_id, vd.nome, c.ano, c.mes, c.trimestre, c.ano_mes
ORDER BY c.ano DESC, c.mes DESC, valor_total_vendas DESC;

COMMENT ON VIEW dw.vw_performance_vendedores IS 'View de performance de vendedores com métricas agregadas de vendas e itens.';

-- View de Análise de Categorias
CREATE OR REPLACE VIEW dw.vw_analise_categorias AS
SELECT 
    cat.tenant_id,
    cat.nivel_1_desc,
    cat.nivel_2_desc,
    cat.nivel_3_desc,
    cat.nivel_4_desc,
    cat.nivel_5_desc,
    cat.nome AS categoria_nome,
    cat.tipo AS categoria_tipo,
    c.ano,
    c.mes,
    c.trimestre,
    c.ano_mes,
    f.tipo AS conta_tipo, -- TRUE=PAGAR, FALSE=RECEBER
    SUM(f.valor_rateio) AS total_rateio,
    SUM(f.valor_total_parcela) AS total_parcela,
    COUNT(DISTINCT f.parcela_id) AS quantidade_parcelas,
    COUNT(*) AS quantidade_rateios
FROM dw.fato_contas_financeiras f
INNER JOIN dw.dim_calendario c ON f.data_id = c.data_id
LEFT JOIN dw.dim_categoria cat ON f.categoria_id = cat.categoria_id
GROUP BY cat.tenant_id, cat.nivel_1_desc, cat.nivel_2_desc, cat.nivel_3_desc, cat.nivel_4_desc, cat.nivel_5_desc,
         cat.nome, cat.tipo, c.ano, c.mes, c.trimestre, c.ano_mes, f.tipo
ORDER BY cat.nivel_1_desc, cat.nivel_2_desc, cat.nivel_3_desc, c.ano DESC, c.mes DESC;

COMMENT ON VIEW dw.vw_analise_categorias IS 'View de análise de categorias com hierarquia nivelada e totais agregados por período.';

-- View de Categoria DRE com Totalizador
-- Usa join por tenant_id + categoria_dre_api_id para identificar apenas categorias que são realmente totalizadoras
-- Também inclui join por posicao para identificar categorias que compartilham posição com totalizadores
CREATE OR REPLACE VIEW dw.vw_categoria_dre_com_totalizador AS
SELECT 
    dcd.*,
    mt_exato.mascara_id AS totalizador_mascara_id,
    mt_exato.descricao AS totalizador_descricao,
    mt_exato.categoria_dre_api_id AS totalizador_api_id,
    mt_exato.codigo AS totalizador_codigo,
    CASE WHEN mt_exato.mascara_id IS NOT NULL THEN TRUE ELSE FALSE END AS eh_totalizador,
    CASE WHEN mt_posicao.mascara_id IS NOT NULL AND mt_exato.mascara_id IS NULL THEN TRUE ELSE FALSE END AS compartilha_posicao_com_totalizador,
    mt_posicao.descricao AS totalizador_da_posicao_descricao
FROM dw.dim_categoria_dre dcd
-- Join exato: apenas categorias que são realmente totalizadoras
LEFT JOIN dw.mascara_totalizadores_dre mt_exato ON 
    mt_exato.tenant_id = dcd.tenant_id 
    AND mt_exato.categoria_dre_api_id = dcd.categoria_dre_api_id
-- Join por posição: categorias que compartilham posição com totalizadores (mas podem não ser totalizadoras)
LEFT JOIN dw.mascara_totalizadores_dre mt_posicao ON 
    mt_posicao.tenant_id = dcd.tenant_id 
    AND mt_posicao.posicao = dcd.posicao
    AND mt_posicao.categoria_dre_api_id != dcd.categoria_dre_api_id; -- Diferente do join exato

COMMENT ON VIEW dw.vw_categoria_dre_com_totalizador IS 'View que faz join entre dim_categoria_dre e mascara_totalizadores_dre. Usa join exato (tenant_id + categoria_dre_api_id) para identificar categorias que são realmente totalizadoras. Também inclui join por posição para identificar categorias que compartilham posição com totalizadores.';
