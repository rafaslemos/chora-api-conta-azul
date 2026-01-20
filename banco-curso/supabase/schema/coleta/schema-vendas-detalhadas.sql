-- Schema do Supabase para Tabela de Vendas Detalhadas
-- Armazena dados completos de vendas coletados da API Conta Azul
-- Retornados pelo endpoint GET /v1/venda/{id}

-- ============================================
-- TABELA: vendas_detalhadas
-- Armazena dados completos de vendas (retornados pelo GET /v1/venda/{id})
-- Uma linha por venda detalhada
-- ============================================
CREATE TABLE IF NOT EXISTS vendas_detalhadas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    venda_id TEXT NOT NULL, -- ID da venda na API (referência a vendas.venda_id)
    
    -- ============================================
    -- Campos principais extraídos (manter compatibilidade)
    -- ============================================
    data DATE, -- Data da venda (data de emissão)
    total NUMERIC(15,2), -- Valor total da venda
    situacao TEXT, -- Situação da venda (mantido para compatibilidade, equivalente a situacao_nome)
    cliente_venda_id TEXT, -- ID do cliente (extraído do objeto cliente)
    cliente_venda_nome TEXT, -- Nome do cliente (extraído do objeto cliente)
    
    -- ============================================
    -- Campos do Cliente (venda.cliente)
    -- ============================================
    cliente_uuid TEXT, -- UUID do cliente (cliente.uuid)
    cliente_tipo_pessoa TEXT, -- Tipo de pessoa do cliente (cliente.tipo_pessoa)
    cliente_documento TEXT, -- Documento do cliente (cliente.documento)
    
    -- ============================================
    -- Campos do Evento Financeiro (venda.evento_financeiro)
    -- ============================================
    evento_financeiro_id TEXT, -- ID do evento financeiro (evento_financeiro.id)
    
    -- ============================================
    -- Campos de Notificação (venda.notificacao) - Opcional
    -- ============================================
    notificacao_id_referencia TEXT, -- ID de referência da notificação (notificacao.id_referencia)
    notificacao_enviado_para TEXT, -- Email para onde foi enviado (notificacao.enviado_para)
    notificacao_enviado_em TIMESTAMP WITH TIME ZONE, -- Data/hora de envio (notificacao.enviado_em)
    notificacao_aberto_em TIMESTAMP WITH TIME ZONE, -- Data/hora de abertura (notificacao.aberto_em)
    notificacao_status TEXT, -- Status da notificação (notificacao.status)
    
    -- ============================================
    -- Campos da Natureza Operação (venda.natureza_operacao)
    -- ============================================
    natureza_operacao_uuid TEXT, -- UUID da natureza de operação (natureza_operacao.uuid)
    natureza_operacao_tipo_operacao TEXT, -- Tipo de operação (natureza_operacao.tipo_operacao)
    natureza_operacao_template_operacao TEXT, -- Template da operação (natureza_operacao.template_operacao)
    natureza_operacao_label TEXT, -- Label da natureza de operação (natureza_operacao.label)
    natureza_operacao_mudanca_financeira BOOLEAN, -- Indica se há mudança financeira (natureza_operacao.mudanca_financeira)
    natureza_operacao_mudanca_estoque TEXT, -- Mudança de estoque (natureza_operacao.mudanca_estoque)
    
    -- ============================================
    -- Campos da Venda (venda.*)
    -- ============================================
    venda_status TEXT, -- Status da venda (venda.status)
    venda_id_legado TEXT, -- ID legado da venda (venda.id_legado)
    venda_tipo_negociacao TEXT, -- Tipo de negociação (venda.tipo_negociacao)
    venda_numero INTEGER, -- Número da venda (venda.numero)
    venda_id_categoria TEXT, -- ID da categoria (venda.id_categoria)
    venda_data_compromisso DATE, -- Data de compromisso (venda.data_compromisso)
    venda_id_cliente TEXT, -- ID do cliente na venda (venda.id_cliente) - equivalente a cliente_venda_id
    venda_versao INTEGER, -- Versão da venda (venda.versao)
    venda_id_natureza_operacao TEXT, -- ID da natureza de operação (venda.id_natureza_operacao)
    venda_id_centro_custo TEXT, -- ID do centro de custo (venda.id_centro_custo)
    venda_introducao TEXT, -- Introdução da venda (venda.introducao)
    venda_observacoes TEXT, -- Observações da venda (venda.observacoes)
    
    -- ============================================
    -- Composição de Valor (venda.composicao_valor)
    -- ============================================
    composicao_valor_bruto NUMERIC(15,2), -- Valor bruto (composicao_valor.valor_bruto)
    composicao_desconto NUMERIC(15,2), -- Valor do desconto (composicao_valor.desconto)
    composicao_frete NUMERIC(15,2), -- Valor do frete (composicao_valor.frete)
    composicao_impostos NUMERIC(15,2), -- Valor dos impostos (composicao_valor.impostos)
    composicao_impostos_deduzidos NUMERIC(15,2), -- Impostos deduzidos (composicao_valor.impostos_deduzidos)
    composicao_seguro NUMERIC(15,2), -- Valor do seguro (composicao_valor.seguro)
    composicao_despesas_incidentais NUMERIC(15,2), -- Despesas incidentais (composicao_valor.despesas_incidentais)
    composicao_valor_liquido NUMERIC(15,2), -- Valor líquido (composicao_valor.valor_liquido)
    
    -- ============================================
    -- Configuração de Desconto (venda.configuracao_de_desconto)
    -- ============================================
    configuracao_desconto_tipo TEXT, -- Tipo de desconto (configuracao_de_desconto.tipo_desconto)
    configuracao_desconto_taxa NUMERIC(10,2), -- Taxa de desconto (configuracao_de_desconto.taxa_desconto)
    
    -- ============================================
    -- Total de Itens (venda.total_itens)
    -- ============================================
    total_itens_contagem_produtos INTEGER, -- Contagem de produtos (total_itens.contagem_produtos)
    total_itens_contagem_servicos INTEGER, -- Contagem de serviços (total_itens.contagem_servicos)
    total_itens_contagem_nao_conciliados INTEGER, -- Contagem de não conciliados (total_itens.contagem_nao_conciliados)
    
    -- ============================================
    -- Situação (venda.situacao)
    -- ============================================
    situacao_nome TEXT, -- Nome da situação (situacao.nome) - equivalente a situacao (mantido para compatibilidade)
    situacao_descricao TEXT, -- Descrição da situação (situacao.descricao)
    situacao_ativado BOOLEAN, -- Se a situação está ativada (situacao.ativado)
    
    -- ============================================
    -- Tipo de Pendência (venda.tipo_pendencia)
    -- ============================================
    tipo_pendencia_nome TEXT, -- Nome do tipo de pendência (tipo_pendencia.nome)
    tipo_pendencia_descricao TEXT, -- Descrição do tipo de pendência (tipo_pendencia.descricao)
    
    -- ============================================
    -- Condição de Pagamento (venda.condicao_pagamento)
    -- ============================================
    condicao_pagamento_tipo TEXT, -- Tipo de pagamento (condicao_pagamento.tipo_pagamento)
    condicao_pagamento_id_conta_financeira TEXT, -- ID da conta financeira (condicao_pagamento.id_conta_financeira)
    condicao_pagamento_pagamento_a_vista BOOLEAN, -- Se é pagamento à vista (condicao_pagamento.pagamento_a_vista)
    condicao_pagamento_observacoes TEXT, -- Observações do pagamento (condicao_pagamento.observacoes_pagamento)
    condicao_pagamento_opcao_condicao_pagamento TEXT, -- Opção de condição de pagamento (condicao_pagamento.opcao_condicao_pagamento)
    condicao_pagamento_nsu TEXT, -- NSU do pagamento (condicao_pagamento.nsu)
    condicao_pagamento_cartao_tipo_bandeira TEXT, -- Tipo de bandeira do cartão (condicao_pagamento.pagamento_cartao.tipo_bandeira)
    condicao_pagamento_cartao_codigo_transacao TEXT, -- Código da transação (condicao_pagamento.pagamento_cartao.codigo_transacao)
    condicao_pagamento_cartao_id_adquirente TEXT, -- ID do adquirente (condicao_pagamento.pagamento_cartao.id_adquirente)
    -- Nota: parcelas (condicao_pagamento.parcelas) permanece apenas no JSONB, pois é um array
    
    -- ============================================
    -- Campos do Vendedor (venda.vendedor)
    -- ============================================
    vendedor_id TEXT, -- ID do vendedor (vendedor.id)
    vendedor_nome TEXT, -- Nome do vendedor (vendedor.nome)
    vendedor_id_legado TEXT, -- ID legado do vendedor (vendedor.id_legado)
    
    -- ============================================
    -- Backup completo
    -- ============================================
    dados_originais JSONB NOT NULL, -- Dados completos retornados pelo endpoint GET /v1/venda/{id}
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(cliente_id, venda_id) -- Uma linha por venda detalhada
);

-- Índices para vendas_detalhadas
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_cliente_id ON vendas_detalhadas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_id ON vendas_detalhadas(venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_cliente_venda ON vendas_detalhadas(cliente_id, venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_data ON vendas_detalhadas(data DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_created_at ON vendas_detalhadas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_cliente_venda_id ON vendas_detalhadas(cliente_venda_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_situacao ON vendas_detalhadas(situacao);

-- Índices para campos frequentemente consultados
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_status ON vendas_detalhadas(venda_status);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_tipo_negociacao ON vendas_detalhadas(venda_tipo_negociacao);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_numero ON vendas_detalhadas(venda_numero);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_venda_data_compromisso ON vendas_detalhadas(venda_data_compromisso DESC);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_evento_financeiro_id ON vendas_detalhadas(evento_financeiro_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_natureza_operacao_uuid ON vendas_detalhadas(natureza_operacao_uuid);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_vendedor_id ON vendas_detalhadas(vendedor_id);
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_cliente_uuid ON vendas_detalhadas(cliente_uuid);

-- Índice GIN para busca em dados_originais (JSONB)
CREATE INDEX IF NOT EXISTS idx_vendas_detalhadas_dados_originais ON vendas_detalhadas USING GIN (dados_originais);

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS update_vendas_detalhadas_updated_at ON vendas_detalhadas;
CREATE TRIGGER update_vendas_detalhadas_updated_at
    BEFORE UPDATE ON vendas_detalhadas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Comentários
COMMENT ON TABLE vendas_detalhadas IS 'Armazena dados completos de vendas coletados da API Conta Azul via GET /v1/venda/{id}. Uma linha por venda detalhada. Todos os campos são extraídos do JSONB dados_originais para facilitar consultas e relatórios.';

-- Comentários dos campos principais
COMMENT ON COLUMN vendas_detalhadas.venda_id IS 'ID da venda na API (referência a vendas.venda_id)';
COMMENT ON COLUMN vendas_detalhadas.data IS 'Data da venda (data de emissão). Extraído de dados_originais->data ou dados_originais->data_emissao';
COMMENT ON COLUMN vendas_detalhadas.total IS 'Valor total da venda. Extraído de dados_originais->total';
COMMENT ON COLUMN vendas_detalhadas.situacao IS 'Situação da venda (mantido para compatibilidade). Equivalente a situacao_nome. Extraído de dados_originais->venda->situacao->nome';
COMMENT ON COLUMN vendas_detalhadas.cliente_venda_id IS 'ID do cliente (extraído de dados_originais->cliente->id ou dados_originais->venda->id_cliente)';
COMMENT ON COLUMN vendas_detalhadas.cliente_venda_nome IS 'Nome do cliente (extraído de dados_originais->cliente->nome)';
COMMENT ON COLUMN vendas_detalhadas.dados_originais IS 'Dados completos retornados pelo endpoint GET /v1/venda/{id} em formato JSONB. Mantido como backup completo para casos especiais e arrays complexos (ex: parcelas)';

-- Comentários dos campos do cliente
COMMENT ON COLUMN vendas_detalhadas.cliente_uuid IS 'UUID do cliente. Extraído de dados_originais->cliente->uuid';
COMMENT ON COLUMN vendas_detalhadas.cliente_tipo_pessoa IS 'Tipo de pessoa do cliente (Física/Jurídica). Extraído de dados_originais->cliente->tipo_pessoa';
COMMENT ON COLUMN vendas_detalhadas.cliente_documento IS 'Documento do cliente (CPF/CNPJ). Extraído de dados_originais->cliente->documento';

-- Comentários dos campos do evento financeiro
COMMENT ON COLUMN vendas_detalhadas.evento_financeiro_id IS 'ID do evento financeiro. Extraído de dados_originais->evento_financeiro->id';

-- Comentários dos campos da venda
COMMENT ON COLUMN vendas_detalhadas.venda_status IS 'Status da venda. Extraído de dados_originais->venda->status';
COMMENT ON COLUMN vendas_detalhadas.venda_tipo_negociacao IS 'Tipo de negociação. Extraído de dados_originais->venda->tipo_negociacao';
COMMENT ON COLUMN vendas_detalhadas.venda_numero IS 'Número da venda. Extraído de dados_originais->venda->numero';
COMMENT ON COLUMN vendas_detalhadas.composicao_valor_liquido IS 'Valor líquido da venda. Extraído de dados_originais->venda->composicao_valor->valor_liquido';

