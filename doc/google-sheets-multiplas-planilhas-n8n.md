# Gerenciando Múltiplas Planilhas para Múltiplos Tenants no n8n

## Desafio

Quando temos múltiplos tenants, cada um pode ter uma ou mais planilhas do Google Sheets para monitorar. Precisamos de uma solução escalável que:
- ✅ Suporte múltiplas planilhas
- ✅ Suporte múltiplos tenants
- ✅ Seja fácil de gerenciar
- ✅ Seja eficiente em recursos
- ✅ Permita ativar/desativar integrações individualmente

## Abordagens Possíveis

### Opção 1: Um Workflow por Integração (Não Recomendado)

**Como funciona:**
- Cada planilha tem seu próprio workflow no n8n
- Workflow criado automaticamente quando integração é configurada
- Workflow deletado quando integração é removida

**Estrutura:**
```
Workflow: "Google Sheets - Tenant A - Planilha 1"
Workflow: "Google Sheets - Tenant A - Planilha 2"
Workflow: "Google Sheets - Tenant B - Planilha 1"
...
```

**Vantagens:**
- ✅ Isolamento total entre integrações
- ✅ Fácil ativar/desativar individualmente
- ✅ Fácil debugar (ver logs específicos)
- ✅ Falha em uma não afeta outras

**Desvantagens:**
- ❌ **Não escalável** - 100 tenants = 100+ workflows
- ❌ **Difícil de gerenciar** - muitos workflows no n8n
- ❌ **Custo** - pode ter limites no n8n
- ❌ **Complexidade** - criar/deletar workflows dinamicamente

**Quando usar:** Apenas se tiver poucos tenants (< 10)

---

### Opção 2: Workflow Único que Consulta o Banco (RECOMENDADO)

**Como funciona:**
- **Um único workflow** no n8n
- Workflow consulta banco de dados para buscar todas as integrações ativas
- Itera sobre cada integração e processa sua planilha
- Usa variáveis dinâmicas para cada planilha

**Estrutura do Workflow:**
```
Schedule Trigger (5 min)
    ↓
HTTP Request → Buscar integrações ativas (Supabase)
    ↓
Split In Batches (1 integração por vez)
    ↓
Google Sheets Read (usando sheet_id dinâmico)
    ↓
Filter (novas linhas)
    ↓
Split In Batches (1 linha por vez)
    ↓
HTTP Request → Edge Function
```

**Vantagens:**
- ✅ **Altamente escalável** - 1 workflow para N integrações
- ✅ **Fácil de gerenciar** - apenas 1 workflow
- ✅ **Centralizado** - todas as integrações em um lugar
- ✅ **Eficiente** - processa todas as planilhas em sequência
- ✅ **Fácil ativar/desativar** - apenas mudar `active` no banco

**Desvantagens:**
- ⚠️ Se uma planilha falhar, pode afetar as próximas (mas pode tratar)
- ⚠️ Mais complexo de configurar inicialmente

**Quando usar:** **RECOMENDADO para produção** - suporta qualquer número de tenants

---

### Opção 3: Workflow por Tenant (Híbrido)

**Como funciona:**
- Um workflow por tenant (não por planilha)
- Cada workflow processa todas as planilhas daquele tenant
- Workflows criados quando tenant é criado

**Estrutura:**
```
Workflow: "Google Sheets - Tenant A"
  - Processa Planilha 1
  - Processa Planilha 2
  - Processa Planilha 3

Workflow: "Google Sheets - Tenant B"
  - Processa Planilha 1
```

**Vantagens:**
- ✅ Isolamento por tenant
- ✅ Escalável (1 workflow por tenant, não por planilha)
- ✅ Fácil gerenciar por tenant

**Desvantagens:**
- ⚠️ Ainda pode ter muitos workflows se muitos tenants
- ⚠️ Precisa criar/deletar workflows dinamicamente

**Quando usar:** Se quiser isolamento por tenant mas ainda ter escalabilidade

---

## Implementação Recomendada: Opção 2

### Arquitetura Detalhada

```
┌─────────────────────────────────────────────────────────┐
│ 1. Schedule Trigger (executa a cada 5 minutos)          │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 2. HTTP Request - Buscar Integrações Ativas            │
│    GET /rest/v1/sheets_integrations?active=eq.true      │
│    Headers: Authorization, apikey                       │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 3. Split In Batches (1 integração por vez)              │
│    Processa cada integração sequencialmente              │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 4. Google Sheets Read                                    │
│    Spreadsheet ID: {{ $json.sheet_id }}                 │
│    Range: {{ $json.range }}                             │
│    Sheet Name: {{ $json.sheet_name }}                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 5. Filter - Verificar Novas Linhas                      │
│    Compara row_number com last_processed_row            │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 6. Split In Batches (1 linha por vez)                   │
│    Processa cada linha sequencialmente                  │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 7. HTTP Request - Edge Function                         │
│    POST /functions/v1/process-sheets-row                │
│    Body: { integration_id, row_data, ... }             │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 8. Atualizar last_processed_row (opcional)              │
│    PATCH /rest/v1/sheets_integrations                   │
└─────────────────────────────────────────────────────────┘
```

### Configuração Detalhada dos Nós

#### Nó 1: Schedule Trigger

**Tipo:** Schedule Trigger

**Configuração:**
```json
{
  "rule": {
    "interval": [
      {
        "field": "minutes",
        "minutesInterval": 5
      }
    ]
  }
}
```

**Descrição:** Executa a cada 5 minutos para verificar todas as planilhas.

---

#### Nó 2: HTTP Request - Buscar Integrações Ativas

**Tipo:** HTTP Request

**Configuração:**
- **Method:** GET
- **URL:** `{{ $env.SUPABASE_URL }}/rest/v1/sheets_integrations?active=eq.true&select=*`
- **Authentication:** Generic Credential Type
- **Generic Auth Type:** HTTP Header Auth
- **Headers:**
  - `apikey`: `{{ $env.SUPABASE_ANON_KEY }}`
  - `Authorization`: `Bearer {{ $env.SUPABASE_ANON_KEY }}`
  - `Prefer`: `return=representation`

**Output Example:**
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "tenant_id": "tenant-1",
    "sheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheet_url": "https://docs.google.com/spreadsheets/d/...",
    "range": "A2:Z1000",
    "sheet_name": "Vendas",
    "last_processed_row": 5,
    "active": true,
    "config": {
      "n8n_workflow_id": null
    }
  },
  {
    "id": "456e7890-e89b-12d3-a456-426614174001",
    "tenant_id": "tenant-2",
    "sheet_id": "2CxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    ...
  }
]
```

---

#### Nó 3: Split In Batches - Processar uma Integração por Vez

**Tipo:** Split In Batches

**Configuração:**
- **Batch Size:** 1
- **Options:**
  - **Reset:** Não

**Motivo:** Processar uma integração por vez evita sobrecarga e facilita debug.

---

#### Nó 4: Google Sheets Read

**Tipo:** Google Sheets

**Configuração:**
- **Operation:** Read Rows
- **Credential:** "Google Sheets - BPO" (criada uma vez)
- **Spreadsheet ID:** `={{ $json.sheet_id }}`
- **Sheet Name:** `={{ $json.sheet_name || 'Sheet1' }}`
- **Range:** `={{ $json.range || 'A2:Z1000' }}`
- **Options:**
  - **Use First Row as Headers:** ✅ Sim
  - **Return All:** ✅ Sim

**Nota Importante:** 
- A credencial Google Sheets no n8n precisa ter acesso a **todas as planilhas** dos tenants
- Isso significa que o usuário que autorizou precisa ter acesso compartilhado a todas as planilhas
- **Alternativa:** Usar Service Account do Google (mais complexo, mas mais seguro)

---

#### Nó 5: Code - Adicionar row_number e Filtrar Novas Linhas

**Tipo:** Code

**Código:**
```javascript
// Adicionar row_number a cada linha
const integration = $input.first().json.integration;
const rows = $input.all();

const processedRows = rows.map((item, index) => {
  const row = item.json;
  return {
    ...row,
    row_number: index + 2, // +2 porque começa na linha 2 (linha 1 é header)
    integration_id: integration.id,
    sheet_id: integration.sheet_id,
    tenant_id: integration.tenant_id,
    last_processed_row: integration.last_processed_row || 0
  };
});

// Filtrar apenas linhas novas
const newRows = processedRows.filter(row => {
  return row.row_number > row.last_processed_row;
});

return newRows.map(row => ({ json: row }));
```

**Output:** Apenas linhas que ainda não foram processadas.

---

#### Nó 6: Split In Batches - Processar uma Linha por Vez

**Tipo:** Split In Batches

**Configuração:**
- **Batch Size:** 1
- **Options:**
  - **Reset:** Não

**Motivo:** Processar uma linha por vez evita sobrecarga na API da Conta Azul.

---

#### Nó 7: HTTP Request - Chamar Edge Function

**Tipo:** HTTP Request

**Configuração:**
- **Method:** POST
- **URL:** `={{ $env.SUPABASE_URL }}/functions/v1/process-sheets-row`
- **Authentication:** Generic Credential Type
- **Generic Auth Type:** HTTP Header Auth
- **Headers:**
  - `x-api-key`: `={{ $env.SYSTEM_API_KEY }}`
  - `Authorization`: `Bearer {{ $env.SUPABASE_ANON_KEY }}`
  - `Content-Type`: `application/json`
- **Body (JSON):**
```json
{
  "integration_id": "={{ $json.integration_id }}",
  "row_data": "={{ $json }}",
  "row_number": "={{ $json.row_number }}",
  "sheet_id": "={{ $json.sheet_id }}",
  "tenant_id": "={{ $json.tenant_id }}"
}
```

---

#### Nó 8: HTTP Request - Atualizar last_processed_row (Opcional)

**Tipo:** HTTP Request

**Configuração:**
- **Method:** PATCH
- **URL:** `={{ $env.SUPABASE_URL }}/rest/v1/sheets_integrations?id=eq.{{ $json.integration_id }}`
- **Headers:**
  - `apikey`: `={{ $env.SUPABASE_ANON_KEY }}`
  - `Authorization`: `Bearer {{ $env.SUPABASE_ANON_KEY }}`
  - `Prefer`: `return=minimal`
- **Body (JSON):**
```json
{
  "last_processed_row": "={{ $json.row_number }}"
}
```

**Nota:** Este nó pode ser opcional se a Edge Function já atualizar o `last_processed_row`.

---

### Variáveis de Ambiente no n8n

Configurar no n8n (Settings → Variables):

```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon
SYSTEM_API_KEY=sua-api-key
```

---

## Estrutura de Banco de Dados

### Tabela: `sheets_integrations`

```sql
CREATE TABLE sheets_integrations (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  sheet_id TEXT NOT NULL,
  sheet_url TEXT NOT NULL,
  sheet_name TEXT DEFAULT 'Sheet1',
  range TEXT DEFAULT 'A2:Z1000',
  last_processed_row INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para buscar integrações ativas rapidamente
CREATE INDEX idx_sheets_integrations_active 
ON sheets_integrations(active) 
WHERE active = TRUE;
```

### Exemplo de Dados

```json
[
  {
    "id": "integration-1",
    "tenant_id": "tenant-a",
    "sheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheet_url": "https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheet_name": "Vendas",
    "range": "A2:Z1000",
    "last_processed_row": 5,
    "active": true
  },
  {
    "id": "integration-2",
    "tenant_id": "tenant-b",
    "sheet_id": "2CxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheet_url": "https://docs.google.com/spreadsheets/d/2CxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
    "sheet_name": "Vendas",
    "range": "A2:Z1000",
    "last_processed_row": 10,
    "active": true
  }
]
```

---

## Fluxo Completo Visual

```
┌─────────────────────────────────────────────────────────┐
│ 1. Schedule Trigger (a cada 5 minutos)                 │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 2. Buscar todas as integrações ativas do banco          │
│    Retorna: [integration-1, integration-2, ...]        │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 3. Para cada integração (Split In Batches)              │
│    ├─ integration-1 (Tenant A - Planilha 1)            │
│    ├─ integration-2 (Tenant B - Planilha 1)             │
│    └─ integration-3 (Tenant A - Planilha 2)            │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 4. Para cada integração:                                │
│    - Ler planilha usando sheet_id                       │
│    - Filtrar linhas novas (row_number > last_processed) │
│    - Processar cada linha                               │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 5. Para cada linha nova:                                │
│    - Chamar Edge Function                                │
│    - Criar venda na Conta Azul                          │
│    - Atualizar last_processed_row                       │
└─────────────────────────────────────────────────────────┘
```

---

## Gerenciamento de Integrações

### Ativar/Desativar Integração

**No Frontend:**
```typescript
// Desativar integração
await sheetsIntegrationService.update(integrationId, {
  active: false
});

// Workflow automaticamente para de processar esta integração
// (não aparece mais na query de integrações ativas)
```

**No Banco:**
```sql
-- Desativar
UPDATE sheets_integrations 
SET active = FALSE 
WHERE id = 'integration-id';

-- Ativar
UPDATE sheets_integrations 
SET active = TRUE 
WHERE id = 'integration-id';
```

### Adicionar Nova Integração

1. Usuário configura integração no wizard
2. Sistema salva em `sheets_integrations` com `active = TRUE`
3. **Próxima execução do workflow** (dentro de 5 minutos) já processa automaticamente
4. **Não precisa criar workflow no n8n** - tudo é dinâmico!

### Remover Integração

1. Usuário remove integração no frontend
2. Sistema atualiza `active = FALSE` ou deleta registro
3. **Próxima execução do workflow** não processa mais
4. **Não precisa deletar workflow no n8n**

---

## Tratamento de Erros

### Erro ao Ler Planilha

**Cenário:** Planilha não encontrada ou sem permissão

**Tratamento no n8n:**
```javascript
// No Code Node após Google Sheets Read
try {
  const rows = $input.all();
  return rows;
} catch (error) {
  // Log erro mas continua com próxima integração
  console.error('Erro ao ler planilha:', error);
  return []; // Retorna vazio para continuar
}
```

**Ação:** Marcar integração como inativa ou notificar admin

### Erro na Edge Function

**Cenário:** Edge Function retorna erro

**Tratamento:**
- Workflow continua com próxima linha/integração
- Erro é registrado em `sync_jobs`
- Admin pode ver erros no dashboard

---

## Otimizações

### 1. Cache de Integrações

**Problema:** Buscar integrações do banco a cada execução pode ser lento

**Solução:** Cachear lista de integrações por 1-2 minutos

```javascript
// No Code Node
const cacheKey = 'active_integrations';
const cache = $getWorkflowStaticData('global');
const now = Date.now();

if (cache[cacheKey] && (now - cache[cacheKey].timestamp < 120000)) {
  // Usar cache (menos de 2 minutos)
  return cache[cacheKey].data;
} else {
  // Buscar do banco e atualizar cache
  const integrations = await fetchIntegrations();
  cache[cacheKey] = {
    data: integrations,
    timestamp: now
  };
  return integrations;
}
```

### 2. Processamento Paralelo (Avançado)

**Problema:** Processar integrações sequencialmente pode ser lento

**Solução:** Processar múltiplas integrações em paralelo (cuidado com rate limits)

```javascript
// Processar em lotes de 3 integrações por vez
// Usar "Wait" node para controlar concorrência
```

### 3. Priorização

**Problema:** Algumas integrações são mais importantes

**Solução:** Adicionar campo `priority` e ordenar

```sql
SELECT * FROM sheets_integrations 
WHERE active = TRUE 
ORDER BY priority DESC, created_at ASC;
```

---

## Monitoramento

### Métricas Importantes

1. **Número de integrações ativas**
2. **Tempo de processamento por integração**
3. **Taxa de sucesso/erro**
4. **Linhas processadas por minuto**

### Dashboard no n8n

- Ver execuções do workflow
- Ver quantas integrações foram processadas
- Ver erros por integração

### Logs no Banco

- Tabela `sync_jobs` registra cada processamento
- Pode criar dashboard no frontend mostrando status

---

## Comparação das Abordagens

| Aspecto | Opção 1 (1 por integração) | Opção 2 (1 único) | Opção 3 (1 por tenant) |
|---------|---------------------------|-------------------|------------------------|
| **Escalabilidade** | ❌ Baixa | ✅ Alta | ⚠️ Média |
| **Complexidade** | ⚠️ Média | ⚠️ Média | ⚠️ Média |
| **Gerenciamento** | ❌ Difícil | ✅ Fácil | ⚠️ Médio |
| **Isolamento** | ✅ Total | ⚠️ Parcial | ✅ Por tenant |
| **Recursos n8n** | ❌ Muitos | ✅ Poucos | ⚠️ Médio |
| **Recomendação** | ❌ Não | ✅ **SIM** | ⚠️ Se necessário isolamento |

---

## Conclusão

**Recomendação:** **Opção 2 (Workflow Único que Consulta o Banco)**

**Por quê:**
- ✅ Altamente escalável (1 workflow para N integrações)
- ✅ Fácil de gerenciar (ativar/desativar apenas mudando `active` no banco)
- ✅ Eficiente em recursos do n8n
- ✅ Centralizado - todas as integrações em um lugar
- ✅ Não precisa criar/deletar workflows dinamicamente

**Implementação:**
1. Criar **um único workflow** no n8n
2. Workflow consulta banco para buscar integrações ativas
3. Itera sobre cada integração e processa
4. Adicionar/remover integrações é apenas salvar no banco

**Resultado:** Sistema escalável que suporta qualquer número de tenants e planilhas! 🚀

