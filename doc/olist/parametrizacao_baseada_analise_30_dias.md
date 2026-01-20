# Parametrização Baseada em Análise dos 30 Dias

## Visão Geral

Após a carga inicial dos últimos 30 dias e detalhamento dos pedidos (Fluxos 1 e 2), o sistema deve permitir que o cliente configure regras de mapeamento para criação de vendas no ContaAzul. Este documento descreve o processo de **parametrização** que será implementado.

---

## Fluxo Completo

### Etapa 1: Carga Inicial (Fluxo 1)
- Busca pedidos dos últimos 30 dias da API Tiny
- Armazena pedidos básicos em `pedidos_tiny` com status `PENDENTE_DETALHAMENTO`

### Etapa 2: Detalhamento (Fluxo 2)
- Coleta detalhes completos de cada pedido
- Armazena em `pedidos_tiny_detalhes` com arrays em JSONB
- Status atualizado para `DETALHADO`

### Etapa 3: Análise e Parametrização
- Sistema analisa os dados coletados
- **Sugere regras automaticamente** baseado nos padrões encontrados
- **Cliente aprova/ajusta manualmente** as regras sugeridas
- Cliente configura mapeamento final

### Etapa 4: Criação de Vendas (Fluxo 3 - Futuro)
- Usa regras parametrizadas + dados em JSONB
- Cria vendas no ContaAzul com base nas regras configuradas

---

## Análise Automática dos Dados

### Dados Coletados para Análise

O sistema deve analisar os dados em `pedidos_tiny_detalhes` para identificar padrões:

#### 1. Marketplaces Encontrados

**Query:**
```sql
SELECT 
  ecommerce_nome,
  COUNT(*) as total_pedidos,
  SUM(total_pedido) as total_faturado
FROM pedidos_tiny_detalhes
WHERE tenant_id = :tenant_id
  AND ecommerce_nome IS NOT NULL
GROUP BY ecommerce_nome
ORDER BY total_pedidos DESC;
```

**Exemplo de Resultado:**
```
Shopee: 450 pedidos, R$ 45.000,00
wBuy: 120 pedidos, R$ 12.000,00
```

**Sugestão:** Criar regra de mapeamento por marketplace

---

#### 2. Tipos de Pagamento

**Query:**
```sql
SELECT 
  DISTINCT parcela->>'forma_pagamento' as forma_pagamento,
  COUNT(*) as total_ocorrencias
FROM pedidos_tiny_detalhes,
  jsonb_array_elements(parcelas) as parcela
WHERE tenant_id = :tenant_id
  AND parcela->>'forma_pagamento' IS NOT NULL
GROUP BY parcela->>'forma_pagamento'
ORDER BY total_ocorrencias DESC;
```

**Exemplo de Resultado:**
```
pix: 200 ocorrências
contareceber: 150 ocorrências
credito: 100 ocorrências
```

**Sugestão:** Criar regra de mapeamento por forma de pagamento

---

#### 3. Produtos/SKUs Mais Vendidos

**Query:**
```sql
SELECT 
  item->>'codigo' as sku,
  item->>'descricao' as descricao,
  SUM((item->>'quantidade')::numeric) as total_vendido,
  SUM((item->>'valor_unitario')::numeric * (item->>'quantidade')::numeric) as valor_total
FROM pedidos_tiny_detalhes,
  jsonb_array_elements(itens) as item
WHERE tenant_id = :tenant_id
GROUP BY item->>'codigo', item->>'descricao'
ORDER BY total_vendido DESC
LIMIT 20;
```

**Exemplo de Resultado:**
```
SKU "4000038-3": 150 unidades, R$ 10.276,50
SKU "30001-3": 120 unidades, R$ 8.200,80
```

**Sugestão:** Criar regras de mapeamento por SKU/código de produto

---

#### 4. Padrões de Taxas de Marketplace

**Query:**
```sql
SELECT 
  ecommerce_nome,
  COUNT(*) as total_pedidos,
  AVG(total_pedido) as ticket_medio,
  AVG(
    CASE 
      WHEN jsonb_array_length(pagamentos_integrados) > 0
      THEN (
        SELECT SUM((pi->>'valor')::numeric)
        FROM jsonb_array_elements(pagamentos_integrados) pi
      ) / NULLIF(total_pedido, 0) * 100
      ELSE 0
    END
  ) as taxa_media_percentual
FROM pedidos_tiny_detalhes
WHERE tenant_id = :tenant_id
  AND ecommerce_nome IS NOT NULL
  AND jsonb_array_length(pagamentos_integrados) > 0
GROUP BY ecommerce_nome;
```

**Exemplo de Resultado:**
```
Shopee: 450 pedidos, ticket médio R$ 100,00, taxa média 8.5%
wBuy: 120 pedidos, ticket médio R$ 100,00, taxa média 10.2%
```

**Sugestão:** Criar regra de mapeamento de taxas por marketplace

---

#### 5. Padrão de Frete

**Query:**
```sql
SELECT 
  forma_frete,
  COUNT(*) as total_pedidos,
  AVG(valor_frete) as frete_medio
FROM pedidos_tiny_detalhes
WHERE tenant_id = :tenant_id
  AND forma_frete IS NOT NULL
GROUP BY forma_frete;
```

**Sugestão:** Criar regra de mapeamento de frete

---

## Sugestões Automáticas de Regras

### Algoritmo de Sugestão

1. **Marketplaces (Prioridade Alta)**
   - Se encontrar 3+ marketplaces diferentes → Sugerir regra por marketplace
   - Se marketplace único mas com muitos pedidos → Sugerir regra específica

2. **Produtos (Prioridade Média)**
   - Se SKUs top 5 representam > 50% das vendas → Sugerir regras por SKU
   - Caso contrário → Sugerir regra genérica

3. **Taxas (Prioridade Alta se aplicável)**
   - Se > 70% dos pedidos têm `pagamentos_integrados` → Sugerir regra de taxas
   - Calcular taxa média por marketplace

4. **Forma de Pagamento (Prioridade Baixa)**
   - Se múltiplas formas diferentes → Sugerir regras opcionais

### Formato de Sugestão

```json
{
  "sugestoes": [
    {
      "tipo": "MARKETPLACE",
      "prioridade": "ALTA",
      "descricao": "Mapear vendas por marketplace",
      "regras": [
        {
          "condicao": {
            "campo": "ecommerce_nome",
            "operador": "EQUALS",
            "valor": "Shopee"
          },
          "sugestao_conta": "Receita Shopee",
          "observacao": "450 pedidos (R$ 45.000,00)"
        },
        {
          "condicao": {
            "campo": "ecommerce_nome",
            "operador": "EQUALS",
            "valor": "wBuy"
          },
          "sugestao_conta": "Receita wBuy",
          "observacao": "120 pedidos (R$ 12.000,00)"
        }
      ]
    },
    {
      "tipo": "TAXAS_MARKETPLACE",
      "prioridade": "ALTA",
      "descricao": "Mapear taxas de marketplace",
      "regras": [
        {
          "condicao": {
            "campo": "ecommerce_nome",
            "operador": "EQUALS",
            "valor": "Shopee"
          },
          "sugestao_conta": "Taxas Shopee",
          "taxa_media": 8.5,
          "observacao": "Taxa média de 8.5% em 450 pedidos"
        }
      ]
    },
    {
      "tipo": "PRODUTO",
      "prioridade": "MEDIA",
      "descricao": "Mapear produtos principais",
      "regras": [
        {
          "condicao": {
            "campo": "SKU",
            "operador": "EQUALS",
            "valor": "4000038-3"
          },
          "sugestao_conta": "Receita Produto X",
          "observacao": "150 unidades vendidas"
        }
      ]
    }
  ]
}
```

---

## Interface de Parametrização (Futuro)

### Tela de Análise e Sugestões

**1. Dashboard de Análise**
- Resumo dos dados coletados (30 dias)
- Gráficos:
  - Vendas por marketplace
  - Top 10 produtos
  - Distribuição de formas de pagamento
  - Taxa média por marketplace

**2. Painel de Sugestões**
- Lista de sugestões automáticas agrupadas por prioridade
- Botões: "Aprovar", "Ajustar", "Rejeitar"
- Opção de editar regras antes de aprovar

**3. Configuração Manual**
- Criar novas regras manualmente
- Editar regras existentes
- Testar regras com pedidos de exemplo
- Visualizar preview do que será enviado ao ContaAzul

**4. Validação**
- Validar todas as regras antes de salvar
- Verificar se todas as contas do ContaAzul existem
- Simular criação de vendas com pedidos reais

---

## Estrutura de Regras de Mapeamento

### Tipos de Regras

1. **Por Marketplace** (`condition_field: 'MARKETPLACE'`)
   - Mapear receita de vendas por marketplace
   - Mapear taxas por marketplace

2. **Por Produto/SKU** (`condition_field: 'SKU'` ou `'PRODUCT_NAME'`)
   - Mapear receita por produto
   - Regras específicas para produtos de alta venda

3. **Por Forma de Pagamento**
   - Mapear contas a receber por forma de pagamento
   - Diferentes prazos de recebimento

4. **Por Marcador/Tag**
   - Mapear por tags do pedido (ex: "1ª venda")

5. **Taxas e Despesas**
   - Taxas de marketplace → Conta de despesa
   - Frete → Conta de despesa/receita

### Exemplo de Regra

```json
{
  "name": "Receita Shopee",
  "condition_field": "MARKETPLACE",
  "condition_value": "Shopee",
  "target_account": "1.01.01.001 - Receita Shopee",
  "priority": 10,
  "is_active": true,
  "applies_to": "RECEITA"
}
```

---

## Processo de Aprovação

### Fluxo Sugerido

1. **Sistema analisa dados** → Gera sugestões
2. **Cliente visualiza sugestões** → Analisa e decide
3. **Cliente aprova/ajusta/rejeita** cada sugestão
4. **Sistema valida regras** → Verifica contas no ContaAzul
5. **Cliente confirma** → Regras são salvas em `mapping_rules`
6. **Sistema está pronto** → Fluxo 3 pode ser executado

---

## Benefícios

1. **Reduz trabalho manual:** Sistema sugere baseado em dados reais
2. **Aumenta precisão:** Análise de 30 dias de dados reais
3. **Flexibilidade:** Cliente pode ajustar antes de aprovar
4. **Rastreabilidade:** Todas as regras são salvas e podem ser revisadas
5. **Evolução:** Regras podem ser ajustadas ao longo do tempo

---

## Próximos Passos

1. Implementar queries de análise (este documento)
2. Criar endpoint/query para gerar sugestões
3. Criar interface de visualização de sugestões (frontend)
4. Implementar fluxo de aprovação/ajuste
5. Integrar com tabela `mapping_rules` existente
6. Validar regras antes de salvar

---

## Notas Importantes

- **Análise deve ser executada apenas após coleta completa dos 30 dias**
- **Sugestões são apenas sugestões** - cliente sempre tem controle final
- **Regras podem ser ajustadas a qualquer momento**
- **Histórico de mudanças** deve ser mantido para auditoria
- **Validação é obrigatória** antes de usar regras no Fluxo 3
