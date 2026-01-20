# Padrões JSONB - Detalhamento de Pedidos

## Visão Geral

Este documento define os padrões de formatação dos dados armazenados em JSONB na tabela `pedidos_tiny_detalhes` para garantir consistência e facilitar a criação de vendas no ContaAzul.

---

## Padrão Adotado

### ✅ **Preservar Formato Original da API**

**Decisão:** Manter os dados em JSONB no formato **exato** como recebidos da API Tiny, com exceções mínimas apenas para normalização estrutural.

---

## Estrutura JSONB

### 1. `itens` (JSONB)

**Estrutura na API:**
```json
{
  "itens": [
    {
      "item": {
        "id_produto": "927547263",
        "codigo": "4000038-3",
        "descricao": "CAMISOLA EM LIGANETE...",
        "unidade": "UN",
        "quantidade": "1",
        "valor_unitario": "68.51"
      }
    }
  ]
}
```

**Estrutura Armazenada em JSONB:**
```json
[
  {
    "id_produto": "927547263",
    "codigo": "4000038-3",
    "descricao": "CAMISOLA EM LIGANETE...",
    "unidade": "UN",
    "quantidade": "1",
    "valor_unitario": "68.51"
  }
]
```

**Normalização:**
- ✅ Remover wrapper `item` (extrair apenas objeto interno)
- ✅ **Preservar valores como string** (quantidade, valor_unitario mantidos como string)
- ✅ Manter estrutura original dos campos

**Justificativa:**
- Facilita iteração direta sobre os itens
- Preserva precisão dos valores monetários como string
- Formato mais simples para queries e manipulação

---

### 2. `parcelas` (JSONB) - **FONTE DE DATAS DE RECEBIMENTO**

**Estrutura na API:**
```json
{
  "parcelas": [
    {
      "parcela": {
        "dias": "0",
        "data": "11/11/2025",
        "valor": "68.51",
        "obs": "",
        "forma_pagamento": "contareceber",
        "meio_pagamento": null
      }
    }
  ]
}
```

**Estrutura Armazenada em JSONB:**
```json
[
  {
    "dias": "0",
    "data": "11/11/2025",
    "valor": "68.51",
    "obs": "",
    "forma_pagamento": "contareceber",
    "meio_pagamento": null
  }
]
```

**Normalização:**
- ✅ Remover wrapper `parcela` (extrair apenas objeto interno)
- ✅ **Preservar data no formato DD/MM/YYYY** (formato original)
- ✅ **Preservar valores como string** (dias, valor como string)
- ✅ Preservar null em `meio_pagamento`

**Justificativa:**
- Datas em DD/MM/YYYY são mais legíveis e mantêm compatibilidade com formato brasileiro
- Facilita uso direto nas queries e na criação de contas a receber
- Strings preservam precisão e formato original

---

### 3. `pagamentos_integrados` (JSONB) - **SEM DATAS**

**Estrutura na API:**
```json
{
  "pagamentos_integrados": [
    {
      "pagamento_integrado": {
        "valor": 173.8,
        "tipo_pagamento": 99,
        "cnpj_intermediador": "38372267000182",
        "codigo_autorizacao": "",
        "codigo_bandeira": 99
      }
    }
  ]
}
```

**Estrutura Armazenada em JSONB:**
```json
[
  {
    "valor": 173.8,
    "tipo_pagamento": 99,
    "cnpj_intermediador": "38372267000182",
    "codigo_autorizacao": "",
    "codigo_bandeira": 99
  }
]
```

**Normalização:**
- ✅ Remover wrapper `pagamento_integrado` (extrair apenas objeto interno)
- ✅ **Preservar tipos originais** (número como número, string como string)
- ✅ **IMPORTANTE: NÃO tem campo de data** - datas de recebimento estão em `parcelas[]`

**Justificativa:**
- Preserva tipos numéricos quando aplicável (valores monetários podem ser número ou string dependendo da API)
- Formato mais limpo sem wrapper desnecessário

---

### 4. `marcadores` (JSONB)

**Estrutura na API:**
```json
{
  "marcadores": [
    {
      "marcador": {
        "id": "165854",
        "descricao": "1ª venda",
        "cor": "#808080"
      }
    }
  ]
}
```

**Estrutura Armazenada em JSONB:**
```json
[
  {
    "id": "165854",
    "descricao": "1ª venda",
    "cor": "#808080"
  }
]
```

**Normalização:**
- ✅ Remover wrapper `marcador` (extrair apenas objeto interno)
- ✅ Preservar todos os campos como string

**Justificativa:**
- Simplifica acesso aos marcadores
- Formato direto para uso em queries e filtros

---

## Arrays Vazios

### Comportamento

- **Arrays vazios `[]` são válidos e serão armazenados como `[]` em JSONB**
- Não converter para `NULL`
- Não inserir valores padrão

**Exemplos:**
- `pagamentos_integrados: []` → armazenar como `[]`
- `parcelas: []` → armazenar como `[]`
- `marcadores: []` → armazenar como `[]`

**Tratamento na Função RPC:**
```sql
-- Arrays vazios são preservados como []
v_itens := COALESCE(v_itens, '[]'::jsonb);
v_parcelas := COALESCE(v_parcelas, '[]'::jsonb);
-- etc.
```

---

## Resumo de Decisões

| Campo JSONB | Formato Data | Formato Valores | Normalização |
|-------------|--------------|-----------------|--------------|
| `itens` | N/A | String (quantidade, valor_unitario) | Remover wrapper `item` |
| `parcelas` | **DD/MM/YYYY** (original) | String (dias, valor) | Remover wrapper `parcela` |
| `pagamentos_integrados` | **NÃO TEM DATAS** | Número/String (preservar original) | Remover wrapper `pagamento_integrado` |
| `marcadores` | N/A | String | Remover wrapper `marcador` |

---

## Queries Úteis

### Buscar pedidos com pagamentos integrados
```sql
SELECT * FROM pedidos_tiny_detalhes
WHERE jsonb_array_length(pagamentos_integrados) > 0;
```

### Extrair total de taxas
```sql
SELECT 
  id,
  (
    SELECT SUM((value->>'valor')::numeric)
    FROM jsonb_array_elements(pagamentos_integrados)
    WHERE value->>'valor' IS NOT NULL
  ) as total_taxas
FROM pedidos_tiny_detalhes;
```

### Buscar parcelas com data específica
```sql
SELECT 
  id,
  jsonb_array_elements(parcelas) as parcela
FROM pedidos_tiny_detalhes
WHERE jsonb_array_elements(parcelas)->>'data' = '11/11/2025';
```

### Contar itens por pedido
```sql
SELECT 
  id,
  jsonb_array_length(itens) as total_itens
FROM pedidos_tiny_detalhes;
```

---

## Benefícios do Padrão Adotado

1. **Compatibilidade:** Mantém formato original da API, reduzindo risco de perda de dados
2. **Simplicidade:** Estrutura mais simples sem wrappers desnecessários
3. **Legibilidade:** Datas em formato DD/MM/YYYY são mais legíveis em contexto brasileiro
4. **Flexibilidade:** Fácil de converter para outros formatos quando necessário
5. **Precisão:** Strings preservam precisão de valores monetários

---

## Notas Importantes

- **Datas de recebimento:** Sempre usar campo `data` de `parcelas[]`, nunca `pagamentos_integrados[]`
- **Valores monetários:** Podem vir como string ou número - preservar formato original
- **Arrays vazios:** São válidos e devem ser tratados como `[]`, não `NULL`
