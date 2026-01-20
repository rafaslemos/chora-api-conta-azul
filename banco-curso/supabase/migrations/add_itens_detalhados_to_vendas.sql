-- Migration: Adicionar coluna itens_detalhados na tabela vendas
-- Esta migration adiciona a coluna itens_detalhados para controlar se os itens de uma venda já foram detalhados

-- Adicionar coluna itens_detalhados
ALTER TABLE vendas
ADD COLUMN IF NOT EXISTS itens_detalhados BOOLEAN DEFAULT FALSE;

-- Criar índice para otimizar busca de vendas sem itens detalhados
CREATE INDEX IF NOT EXISTS idx_vendas_itens_detalhados ON vendas(itens_detalhados) WHERE itens_detalhados = FALSE;

-- Criar índice composto para otimizar busca por cliente e status de detalhamento
CREATE INDEX IF NOT EXISTS idx_vendas_cliente_itens_detalhados ON vendas(cliente_id, itens_detalhados) WHERE itens_detalhados = FALSE;

-- Comentário na coluna
COMMENT ON COLUMN vendas.itens_detalhados IS 'Indica se os itens da venda já foram detalhados (busca de itens via GET /v1/venda/{id_venda}/itens). Resetado para FALSE quando dados básicos da venda mudam na coleta incremental.';

