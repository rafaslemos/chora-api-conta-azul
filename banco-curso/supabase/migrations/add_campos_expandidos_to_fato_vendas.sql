-- Migração: Adicionar campos expandidos à tabela dw.fato_vendas
-- Data: 2025-01-XX
-- Descrição: Adiciona campos detalhados de vendas extraídos de vendas_detalhadas
--            para permitir análises mais ricas no Power BI

-- ============================================
-- Campos da Venda
-- ============================================
ALTER TABLE dw.fato_vendas 
ADD COLUMN IF NOT EXISTS venda_status TEXT,
ADD COLUMN IF NOT EXISTS venda_tipo_negociacao TEXT,
ADD COLUMN IF NOT EXISTS venda_numero INTEGER,
ADD COLUMN IF NOT EXISTS venda_versao INTEGER;

-- ============================================
-- Composição de Valor (Medidas)
-- ============================================
ALTER TABLE dw.fato_vendas 
ADD COLUMN IF NOT EXISTS valor_bruto NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_desconto NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_frete NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_impostos NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_impostos_deduzidos NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_seguro NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_despesas_incidentais NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC(15,2);

-- ============================================
-- Contagem de Itens
-- ============================================
ALTER TABLE dw.fato_vendas 
ADD COLUMN IF NOT EXISTS contagem_produtos INTEGER,
ADD COLUMN IF NOT EXISTS contagem_servicos INTEGER,
ADD COLUMN IF NOT EXISTS contagem_nao_conciliados INTEGER;

-- ============================================
-- Dimensões Adicionais (FKs)
-- ============================================
ALTER TABLE dw.fato_vendas 
ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES dw.dim_categoria(categoria_id),
ADD COLUMN IF NOT EXISTS centro_custo_id UUID REFERENCES dw.dim_centro_custo(centro_custo_id),
ADD COLUMN IF NOT EXISTS conta_financeira_id UUID REFERENCES dw.dim_conta_financeira(conta_financeira_id);

-- ============================================
-- Condição de Pagamento
-- ============================================
ALTER TABLE dw.fato_vendas 
ADD COLUMN IF NOT EXISTS condicao_pagamento_tipo TEXT,
ADD COLUMN IF NOT EXISTS condicao_pagamento_pagamento_a_vista BOOLEAN,
ADD COLUMN IF NOT EXISTS condicao_pagamento_opcao TEXT;

-- ============================================
-- Situação e Pendência
-- ============================================
ALTER TABLE dw.fato_vendas 
ADD COLUMN IF NOT EXISTS situacao_descricao TEXT,
ADD COLUMN IF NOT EXISTS situacao_ativado BOOLEAN,
ADD COLUMN IF NOT EXISTS tipo_pendencia_nome TEXT,
ADD COLUMN IF NOT EXISTS tipo_pendencia_descricao TEXT;

-- ============================================
-- Configuração de Desconto
-- ============================================
ALTER TABLE dw.fato_vendas 
ADD COLUMN IF NOT EXISTS desconto_tipo TEXT,
ADD COLUMN IF NOT EXISTS desconto_taxa NUMERIC(10,2);

-- ============================================
-- Índices para campos frequentemente consultados
-- ============================================
CREATE INDEX IF NOT EXISTS idx_fato_vendas_venda_status ON dw.fato_vendas(venda_status);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_venda_tipo_negociacao ON dw.fato_vendas(venda_tipo_negociacao);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_venda_numero ON dw.fato_vendas(venda_numero);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_categoria_id ON dw.fato_vendas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_centro_custo_id ON dw.fato_vendas(centro_custo_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_conta_financeira_id ON dw.fato_vendas(conta_financeira_id);
CREATE INDEX IF NOT EXISTS idx_fato_vendas_condicao_pagamento_tipo ON dw.fato_vendas(condicao_pagamento_tipo);

-- ============================================
-- Comentários dos novos campos
-- ============================================
COMMENT ON COLUMN dw.fato_vendas.venda_status IS 'Status da venda. Extraído de vendas_detalhadas.venda_status';
COMMENT ON COLUMN dw.fato_vendas.venda_tipo_negociacao IS 'Tipo de negociação. Extraído de vendas_detalhadas.venda_tipo_negociacao';
COMMENT ON COLUMN dw.fato_vendas.venda_numero IS 'Número da venda. Extraído de vendas_detalhadas.venda_numero';
COMMENT ON COLUMN dw.fato_vendas.valor_liquido IS 'Valor líquido da venda. Extraído de vendas_detalhadas.composicao_valor_liquido';
COMMENT ON COLUMN dw.fato_vendas.valor_bruto IS 'Valor bruto da venda. Extraído de vendas_detalhadas.composicao_valor_bruto';
COMMENT ON COLUMN dw.fato_vendas.categoria_id IS 'Referência à categoria da venda (dim_categoria)';
COMMENT ON COLUMN dw.fato_vendas.centro_custo_id IS 'Referência ao centro de custo da venda (dim_centro_custo)';
COMMENT ON COLUMN dw.fato_vendas.conta_financeira_id IS 'Referência à conta financeira da condição de pagamento (dim_conta_financeira)';
COMMENT ON COLUMN dw.fato_vendas.contagem_produtos IS 'Quantidade de produtos na venda. Extraído de vendas_detalhadas.total_itens_contagem_produtos';
COMMENT ON COLUMN dw.fato_vendas.contagem_servicos IS 'Quantidade de serviços na venda. Extraído de vendas_detalhadas.total_itens_contagem_servicos';

