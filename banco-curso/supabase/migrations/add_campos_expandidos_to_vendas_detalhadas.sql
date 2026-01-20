-- Migração: Adicionar campos expandidos à tabela vendas_detalhadas
-- Data: 2025-01-XX
-- Descrição: Adiciona todas as colunas expandidas para armazenar campos detalhados das vendas
--            extraídos do JSONB dados_originais

-- ============================================
-- Campos do Cliente (venda.cliente)
-- ============================================
ALTER TABLE vendas_detalhadas 
ADD COLUMN IF NOT EXISTS cliente_uuid TEXT,
ADD COLUMN IF NOT EXISTS cliente_tipo_pessoa TEXT,
ADD COLUMN IF NOT EXISTS cliente_documento TEXT;

-- ============================================
-- Campos do Evento Financeiro (venda.evento_financeiro)
-- ============================================
ALTER TABLE vendas_detalhadas 
ADD COLUMN IF NOT EXISTS evento_financeiro_id TEXT;

-- ============================================
-- Campos de Notificação (venda.notificacao) - Opcional
-- ============================================
ALTER TABLE vendas_detalhadas 
ADD COLUMN IF NOT EXISTS notificacao_id_referencia TEXT,
ADD COLUMN IF NOT EXISTS notificacao_enviado_para TEXT,
ADD COLUMN IF NOT EXISTS notificacao_enviado_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notificacao_aberto_em TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notificacao_status TEXT;

-- ============================================
-- Campos da Natureza Operação (venda.natureza_operacao)
-- ============================================
ALTER TABLE vendas_detalhadas 
ADD COLUMN IF NOT EXISTS natureza_operacao_uuid TEXT,
ADD COLUMN IF NOT EXISTS natureza_operacao_tipo_operacao TEXT,
ADD COLUMN IF NOT EXISTS natureza_operacao_template_operacao TEXT,
ADD COLUMN IF NOT EXISTS natureza_operacao_label TEXT,
ADD COLUMN IF NOT EXISTS natureza_operacao_mudanca_financeira BOOLEAN,
ADD COLUMN IF NOT EXISTS natureza_operacao_mudanca_estoque TEXT;

-- ============================================
-- Campos da Venda (venda.*)
-- ============================================
ALTER TABLE vendas_detalhadas 
ADD COLUMN IF NOT EXISTS venda_status TEXT,
ADD COLUMN IF NOT EXISTS venda_id_legado TEXT,
ADD COLUMN IF NOT EXISTS venda_tipo_negociacao TEXT,
ADD COLUMN IF NOT EXISTS venda_numero INTEGER,
ADD COLUMN IF NOT EXISTS venda_id_categoria TEXT,
ADD COLUMN IF NOT EXISTS venda_data_compromisso DATE,
ADD COLUMN IF NOT EXISTS venda_id_cliente TEXT,
ADD COLUMN IF NOT EXISTS venda_versao INTEGER,
ADD COLUMN IF NOT EXISTS venda_id_natureza_operacao TEXT,
ADD COLUMN IF NOT EXISTS venda_id_centro_custo TEXT,
ADD COLUMN IF NOT EXISTS venda_introducao TEXT,
ADD COLUMN IF NOT EXISTS venda_observacoes TEXT;

-- ============================================
-- Composição de Valor (venda.composicao_valor)
-- ============================================
ALTER TABLE vendas_detalhadas 
ADD COLUMN IF NOT EXISTS composicao_valor_bruto NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS composicao_desconto NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS composicao_frete NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS composicao_impostos NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS composicao_impostos_deduzidos NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS composicao_seguro NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS composicao_despesas_incidentais NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS composicao_valor_liquido NUMERIC(15,2);

-- ============================================
-- Configuração de Desconto (venda.configuracao_de_desconto)
-- ============================================
ALTER TABLE vendas_detalhadas 
ADD COLUMN IF NOT EXISTS configuracao_desconto_tipo TEXT,
ADD COLUMN IF NOT EXISTS configuracao_desconto_taxa NUMERIC(10,2);

-- ============================================
-- Total de Itens (venda.total_itens)
-- ============================================
ALTER TABLE vendas_detalhadas 
ADD COLUMN IF NOT EXISTS total_itens_contagem_produtos INTEGER,
ADD COLUMN IF NOT EXISTS total_itens_contagem_servicos INTEGER,
ADD COLUMN IF NOT EXISTS total_itens_contagem_nao_conciliados INTEGER;

-- ============================================
-- Situação (venda.situacao)
-- ============================================
ALTER TABLE vendas_detalhadas 
ADD COLUMN IF NOT EXISTS situacao_nome TEXT,
ADD COLUMN IF NOT EXISTS situacao_descricao TEXT,
ADD COLUMN IF NOT EXISTS situacao_ativado BOOLEAN;

-- ============================================
-- Tipo de Pendência (venda.tipo_pendencia)
-- ============================================
ALTER TABLE vendas_detalhadas 
ADD COLUMN IF NOT EXISTS tipo_pendencia_nome TEXT,
ADD COLUMN IF NOT EXISTS tipo_pendencia_descricao TEXT;

-- ============================================
-- Condição de Pagamento (venda.condicao_pagamento)
-- ============================================
ALTER TABLE vendas_detalhadas 
ADD COLUMN IF NOT EXISTS condicao_pagamento_tipo TEXT,
ADD COLUMN IF NOT EXISTS condicao_pagamento_id_conta_financeira TEXT,
ADD COLUMN IF NOT EXISTS condicao_pagamento_pagamento_a_vista BOOLEAN,
ADD COLUMN IF NOT EXISTS condicao_pagamento_observacoes TEXT,
ADD COLUMN IF NOT EXISTS condicao_pagamento_opcao_condicao_pagamento TEXT,
ADD COLUMN IF NOT EXISTS condicao_pagamento_nsu TEXT,
ADD COLUMN IF NOT EXISTS condicao_pagamento_cartao_tipo_bandeira TEXT,
ADD COLUMN IF NOT EXISTS condicao_pagamento_cartao_codigo_transacao TEXT,
ADD COLUMN IF NOT EXISTS condicao_pagamento_cartao_id_adquirente TEXT;

-- ============================================
-- Campos do Vendedor (venda.vendedor)
-- ============================================
ALTER TABLE vendas_detalhadas 
ADD COLUMN IF NOT EXISTS vendedor_id TEXT,
ADD COLUMN IF NOT EXISTS vendedor_nome TEXT,
ADD COLUMN IF NOT EXISTS vendedor_id_legado TEXT;

-- ============================================
-- Índices para campos frequentemente consultados
-- ============================================
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_status ON vendas_detalhadas(venda_status);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_tipo_negociacao ON vendas_detalhadas(venda_tipo_negociacao);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_numero ON vendas_detalhadas(venda_numero);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_data_compromisso ON vendas_detalhadas(venda_data_compromisso DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_evento_financeiro_id ON vendas_detalhadas(evento_financeiro_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_natureza_operacao_uuid ON vendas_detalhadas(natureza_operacao_uuid);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_vendedor_id ON vendas_detalhadas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_cliente_uuid ON vendas_detalhadas(cliente_uuid);

-- ============================================
-- Comentários dos novos campos
-- ============================================
COMMENT ON COLUMN vendas_detalhadas.cliente_uuid IS 'UUID do cliente. Extraído de dados_originais->cliente->uuid';
COMMENT ON COLUMN vendas_detalhadas.cliente_tipo_pessoa IS 'Tipo de pessoa do cliente (Física/Jurídica). Extraído de dados_originais->cliente->tipo_pessoa';
COMMENT ON COLUMN vendas_detalhadas.cliente_documento IS 'Documento do cliente (CPF/CNPJ). Extraído de dados_originais->cliente->documento';
COMMENT ON COLUMN vendas_detalhadas.evento_financeiro_id IS 'ID do evento financeiro. Extraído de dados_originais->evento_financeiro->id';
COMMENT ON COLUMN vendas_detalhadas.venda_status IS 'Status da venda. Extraído de dados_originais->venda->status';
COMMENT ON COLUMN vendas_detalhadas.venda_tipo_negociacao IS 'Tipo de negociação. Extraído de dados_originais->venda->tipo_negociacao';
COMMENT ON COLUMN vendas_detalhadas.venda_numero IS 'Número da venda. Extraído de dados_originais->venda->numero';
COMMENT ON COLUMN vendas_detalhadas.composicao_valor_liquido IS 'Valor líquido da venda. Extraído de dados_originais->venda->composicao_valor->valor_liquido';

