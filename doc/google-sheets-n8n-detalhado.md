# Autenticação Google Sheets - Opção A (n8n) - Detalhamento Completo

## Visão Geral

Esta opção utiliza o n8n para gerenciar toda a autenticação e acesso ao Google Sheets. O n8n já possui integração nativa com Google Sheets, incluindo OAuth 2.0, o que simplifica significativamente a implementação.

## 1. Como Funciona

### Arquitetura Simplificada

```
┌─────────────────┐
│  Google Sheets  │
└────────┬────────┘
         │
         │ (n8n gerencia OAuth)
         │
┌────────▼────────┐
│  n8n Workflow   │
│  - Trigger      │
│  - Google Sheets│
│  - Processar   │
└────────┬────────┘
         │
         │ (Webhook POST)
         │
┌────────▼──────────────────┐
│  Supabase Edge Function    │
│  process-sheets-row         │
│  - Recebe dados da linha    │
│  - Transforma em venda     │
│  - Cria na Conta Azul       │
└────────────────────────────┘
```

### Vantagens Principais

- ✅ **Zero código de autenticação** - n8n cuida de tudo
- ✅ **OAuth gerenciado automaticamente** - renovação de tokens transparente
- ✅ **Interface visual** - configurar workflow no n8n é mais fácil
- ✅ **Menos código para manter** - menos pontos de falha
- ✅ **Reutiliza infraestrutura existente** - n8n já está configurado

## 2. Configuração no n8n

### Passo 1: Criar Credencial Google Sheets no n8n

1. Acessar n8n (ex: `https://automacoes.choraapi.com.br/`)
2. Ir em **Settings** → **Credentials**
3. Clicar em **Add Credential**
4. Selecionar **Google Sheets OAuth2 API**
5. Configurar:
   - **Credential Name**: "Google Sheets - BPO"
   - Clicar em **Connect my account**
   - Autorizar acesso no Google
   - Salvar credencial

**Nota:** O n8n gerencia automaticamente:
- OAuth 2.0 flow
- Renovação de tokens
- Escopos necessários
- Armazenamento seguro

### Passo 2: Criar Workflow no n8n

**Nome do Workflow:** `Google Sheets - Monitorar Vendas`

**Estrutura do Workflow:**

```
┌─────────────────────┐
│ 1. Schedule Trigger  │ (Polling a cada X minutos)
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ 2. Google Sheets    │ (Ler planilha)
│    Read Rows        │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ 3. Filter           │ (Verificar se é nova linha)
│    New Rows Only    │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│ 4. Split In Batches │ (Processar uma por vez)
└──────────┬──────────┘
           │
┌──────────▼──────────────────────┐
│ 5. HTTP Request                 │
│    POST /process-sheets-row     │
│    (Edge Function)              │
└─────────────────────────────────┘
```

### Passo 3: Configuração Detalhada dos Nós

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

**Descrição:** Executa a cada 5 minutos para verificar novas linhas.

**Alternativas:**
- **Cron:** `*/5 * * * *` (a cada 5 minutos)
- **Webhook:** Se Google Sheets suportar webhooks (mais eficiente)

#### Nó 2: Google Sheets - Read Rows

**Tipo:** Google Sheets

**Configuração:**
- **Operation:** Read Rows
- **Credential:** "Google Sheets - BPO" (criada no Passo 1)
- **Spreadsheet ID:** `{{ $env.SHEET_ID }}` (variável de ambiente ou fixo)
- **Sheet Name:** `Vendas` (ou range específico)
- **Range:** `A2:Z1000` (ajustar conforme necessário)
- **Options:**
  - **Use First Row as Headers:** ✅ Sim
  - **Return All:** ✅ Sim

**Output Example:**
```json
{
  "rows": [
    {
      "Cliente": "João Silva",
      "Numero": "1001",
      "Data": "2024-01-15",
      "Valor": "150.00",
      "Categoria": "Vendas Online"
    }
  ]
}
```

#### Nó 3: Filter - New Rows Only

**Tipo:** IF

**Condição:** Verificar se linha já foi processada

**Lógica:**
```javascript
// Verificar se row_number > last_processed_row
// Ou usar hash da linha para verificar duplicatas
```

**Implementação no n8n:**
- Usar **Code Node** para comparar com `last_processed_row` salvo
- Ou usar **Function Node** para calcular hash da linha

**Exemplo de código:**
```javascript
// No Code Node
const lastProcessed = $input.first().json.last_processed_row || 0;
const currentRow = $input.first().json.row_number;

return currentRow > lastProcessed;
```

#### Nó 4: Split In Batches

**Tipo:** Split In Batches

**Configuração:**
- **Batch Size:** 1 (processar uma linha por vez)
- **Options:**
  - **Reset:** Não

**Motivo:** Processar uma linha por vez evita sobrecarga na API da Conta Azul.

#### Nó 5: HTTP Request - Chamar Edge Function

**Tipo:** HTTP Request

**Configuração:**
- **Method:** POST
- **URL:** `https://seu-projeto.supabase.co/functions/v1/process-sheets-row`
- **Authentication:** Bearer Token
- **Token:** `{{ $env.SUPABASE_ANON_KEY }}`
- **Headers:**
  - `Content-Type: application/json`
  - `x-api-key: {{ $env.SYSTEM_API_KEY }}`
- **Body (JSON):**
```json
{
  "integration_id": "{{ $env.INTEGRATION_ID }}",
  "row_data": "{{ $json }}",
  "row_number": "{{ $json.row_number }}",
  "sheet_id": "{{ $env.SHEET_ID }}"
}
```

**Variáveis de Ambiente no n8n:**
- `SHEET_ID`: ID da planilha do Google Sheets
- `INTEGRATION_ID`: ID da integração no banco de dados
- `SUPABASE_ANON_KEY`: Chave anônima do Supabase
- `SYSTEM_API_KEY`: Chave de API do sistema

### Passo 4: Configurar Variáveis de Ambiente no n8n

1. No n8n, ir em **Settings** → **Variables**
2. Adicionar variáveis:
   - `SHEET_ID`: ID da planilha (extraído da URL)
   - `INTEGRATION_ID`: UUID da integração (vem do banco)
   - `SUPABASE_ANON_KEY`: Chave do Supabase
   - `SYSTEM_API_KEY`: Chave de API

**Alternativa:** Usar **Environment Variables** do n8n (se disponível na versão).

## 3. Estrutura de Dados

### Dados que o n8n Envia para Edge Function

```typescript
interface SheetsRowPayload {
  integration_id: string;      // UUID da integração
  row_data: {                  // Dados da linha da planilha
    [columnName: string]: string | number;
  };
  row_number: number;          // Número da linha na planilha
  sheet_id: string;            // ID da planilha
  timestamp: string;            // Quando foi detectada
}
```

### Exemplo de Payload

```json
{
  "integration_id": "123e4567-e89b-12d3-a456-426614174000",
  "row_data": {
    "Cliente": "João Silva",
    "Numero": "1001",
    "Data": "2024-01-15",
    "Valor": "150.00",
    "Categoria": "Vendas Online",
    "Centro Custo": "Marketing",
    "Conta Financeira": "Conta Corrente"
  },
  "row_number": 5,
  "sheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## 4. Edge Function - Receber e Processar

**`supabase/functions/process-sheets-row/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Validar autenticação
    const apiKey = req.headers.get('x-api-key');
    if (apiKey !== Deno.env.get('SYSTEM_API_KEY')) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 2. Extrair dados do payload
    const payload = await req.json();
    const { integration_id, row_data, row_number, sheet_id } = payload;

    // 3. Buscar configuração da integração
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: integration, error: integrationError } = await supabase
      .from('sheets_integrations')
      .select('*, tenant_id')
      .eq('id', integration_id)
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: 'Integração não encontrada' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // 4. Buscar mapeamentos de campos
    const { data: mappings } = await supabase
      .from('sheets_field_mappings')
      .select('*')
      .eq('integration_id', integration_id);

    // 5. Transformar linha em payload de venda (usar sheetsMappingService)
    // ... (implementação detalhada em outro documento)

    // 6. Criar venda na Conta Azul (usar contaAzulApiService)
    // ... (implementação detalhada em outro documento)

    // 7. Atualizar last_processed_row
    await supabase
      .from('sheets_integrations')
      .update({ last_processed_row: row_number })
      .eq('id', integration_id);

    // 8. Registrar job de sincronização
    await supabase
      .from('sync_jobs')
      .insert({
        tenant_id: integration.tenant_id,
        type: 'SHEETS_SALE_SYNC',
        status: 'SUCCESS',
        items_processed: 1,
        details: JSON.stringify({ integration_id, row_number }),
      });

    return new Response(
      JSON.stringify({ success: true, row_number }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Erro ao processar linha:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});
```

## 5. Configuração no Frontend

### Armazenar Configuração da Integração

**`pages/SheetsIntegrationWizard.tsx`** (Passo Final)

```typescript
const saveIntegration = async () => {
  // 1. Criar integração no banco
  const integration = await sheetsIntegrationService.create({
    tenant_id: tenantId,
    sheet_url: sheetUrl,
    sheet_id: extractSheetId(sheetUrl),
    range: selectedRange,
    active: true,
    config: {
      n8n_workflow_id: null, // Será preenchido depois
      n8n_webhook_url: null,
    },
  });

  // 2. Salvar mapeamentos
  for (const mapping of fieldMappings) {
    await sheetsIntegrationService.saveFieldMapping({
      integration_id: integration.id,
      ...mapping,
    });
  }

  // 3. Criar workflow no n8n (opcional - pode ser feito manualmente)
  // OU fornecer instruções para criar manualmente

  // 4. Atualizar integração com workflow_id
  const n8nWorkflow = await createN8nWorkflow(integration.id);
  await sheetsIntegrationService.update(integration.id, {
    config: {
      ...integration.config,
      n8n_workflow_id: n8nWorkflow.id,
      n8n_webhook_url: n8nWorkflow.webhookUrl,
    },
  });
};
```

### Criar Workflow no n8n via API (Opcional)

**`services/n8nSheetsService.ts`** (novo)

```typescript
import { n8nService } from './n8nService';

export const n8nSheetsService = {
  /**
   * Cria workflow no n8n para monitorar planilha
   */
  async createSheetsWorkflow(integrationId: string, sheetId: string) {
    // Definir estrutura do workflow
    const workflow = {
      name: `Google Sheets - Integração ${integrationId}`,
      active: true,
      tags: ['BPO-Automatizado', 'Google-Sheets'],
      nodes: [
        // Schedule Trigger
        {
          parameters: {
            rule: {
              interval: [{ field: 'minutes', minutesInterval: 5 }],
            },
          },
          type: 'n8n-nodes-base.scheduleTrigger',
          typeVersion: 1,
          position: [250, 300],
        },
        // Google Sheets Read
        {
          parameters: {
            operation: 'read',
            spreadsheetId: sheetId,
            options: {
              useFirstRowAsHeaders: true,
            },
          },
          type: 'n8n-nodes-base.googleSheets',
          typeVersion: 4,
          position: [450, 300],
        },
        // HTTP Request (Edge Function)
        {
          parameters: {
            method: 'POST',
            url: `${process.env.VITE_SUPABASE_URL}/functions/v1/process-sheets-row`,
            authentication: 'genericCredentialType',
            genericAuthType: 'httpHeaderAuth',
            sendHeaders: true,
            headerParameters: {
              parameters: [
                {
                  name: 'x-api-key',
                  value: process.env.VITE_SYSTEM_API_KEY,
                },
              ],
            },
            sendBody: true,
            bodyParameters: {
              parameters: [
                {
                  name: 'integration_id',
                  value: integrationId,
                },
                {
                  name: 'row_data',
                  value: '={{ $json }}',
                },
              ],
            },
          },
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 4.1,
          position: [650, 300],
        },
      ],
      connections: {
        'Schedule Trigger': {
          main: [[{ node: 'Google Sheets', type: 'main', index: 0 }]],
        },
        'Google Sheets': {
          main: [[{ node: 'HTTP Request', type: 'main', index: 0 }]],
        },
      },
    };

    // Criar workflow via API do n8n
    const response = await fetch(`${n8nService.getUrl()}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': process.env.VITE_N8N_API_KEY!,
      },
      body: JSON.stringify(workflow),
    });

    if (!response.ok) {
      throw new Error(`Erro ao criar workflow: ${response.statusText}`);
    }

    return await response.json();
  },
};
```

## 6. Fluxo Completo Visual

```
┌─────────────────────────────────────────────────────────┐
│ 1. Usuário configura integração no wizard               │
│    - Informa URL da planilha                           │
│    - Mapeia campos                                      │
│    - Sistema salva em sheets_integrations              │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 2. Sistema cria workflow no n8n (ou instruções)       │
│    - Workflow monitora planilha a cada 5 minutos       │
│    - n8n gerencia OAuth do Google automaticamente      │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 3. n8n detecta nova linha na planilha                  │
│    - Lê dados da linha                                 │
│    - Identifica que é nova (row_number > last_processed)│
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 4. n8n chama Edge Function via HTTP Request            │
│    POST /process-sheets-row                            │
│    Body: { integration_id, row_data, row_number }      │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 5. Edge Function processa:                             │
│    - Busca configuração e mapeamentos                  │
│    - Consulta categorias/centros de custo/contas       │
│    - Transforma linha em payload de venda             │
│    - Cria venda na Conta Azul                         │
│    - Atualiza last_processed_row                       │
│    - Registra em sync_jobs                             │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ 6. Retorna sucesso para n8n                            │
│    n8n pode processar próxima linha                    │
└─────────────────────────────────────────────────────────┘
```

## 7. Vantagens da Opção A

### Técnicas

- ✅ **Zero código de OAuth** - n8n cuida de tudo
- ✅ **Renovação automática de tokens** - transparente
- ✅ **Interface visual** - fácil de configurar e debugar
- ✅ **Menos código para manter** - menos pontos de falha
- ✅ **Reutiliza infraestrutura** - n8n já está configurado

### Operacionais

- ✅ **Fácil de debugar** - ver execuções no n8n
- ✅ **Fácil de modificar** - alterar workflow sem código
- ✅ **Logs visuais** - ver o que aconteceu em cada nó
- ✅ **Retry automático** - n8n tem retry built-in
- ✅ **Monitoramento** - dashboard do n8n mostra execuções

## 8. Desvantagens da Opção A

- ❌ **Dependência do n8n** - se n8n cair, integração para
- ❌ **Menos controle** - não controlamos OAuth diretamente
- ❌ **Custo do n8n** - pode ter custos adicionais
- ❌ **Limitações do n8n** - dependemos das funcionalidades disponíveis
- ❌ **Debugging mais complexo** - precisa acessar n8n para ver logs

## 9. Comparação: Opção A vs Opção B

| Aspecto | Opção A (n8n) | Opção B (OAuth Próprio) |
|---------|---------------|-------------------------|
| **Complexidade de Implementação** | ⭐⭐ Baixa | ⭐⭐⭐ Média |
| **Código Necessário** | Mínimo | Significativo |
| **Configuração OAuth** | Automática (n8n) | Manual (Google Cloud) |
| **Renovação de Tokens** | Automática (n8n) | Manual (nosso código) |
| **Dependências Externas** | n8n | Google Cloud Console |
| **Controle sobre Autenticação** | Limitado | Total |
| **Facilidade de Debug** | ⭐⭐⭐ Alta (interface visual) | ⭐⭐ Média (logs) |
| **Manutenção** | n8n cuida | Nossa responsabilidade |
| **Custo** | Pode ter custo n8n | Apenas infraestrutura |
| **Escalabilidade** | Limitada pelo n8n | Total controle |
| **Recomendação MVP** | ✅ **SIM** | ❌ Não (mais complexo) |
| **Recomendação Produção** | ✅ Sim (se n8n atende) | ✅ Sim (se precisa controle) |

## 10. Quando Usar Cada Opção

### Use Opção A (n8n) se:

- ✅ Quer implementar rápido (MVP)
- ✅ Já tem n8n configurado e funcionando
- ✅ Não precisa de controle total sobre OAuth
- ✅ Prefere interface visual para configurar
- ✅ Quer menos código para manter

### Use Opção B (OAuth Próprio) se:

- ✅ Precisa de acesso direto às planilhas (sem n8n)
- ✅ Quer controle total sobre autenticação
- ✅ Precisa de funcionalidades específicas que n8n não oferece
- ✅ Quer reduzir dependências externas
- ✅ Tem recursos para manter código de OAuth

## 11. Recomendação Final

**Para MVP:** **Opção A (n8n)** é a melhor escolha porque:
- Implementação mais rápida
- Menos código para escrever e manter
- n8n já está configurado no sistema
- Interface visual facilita configuração e debug

**Para Produção Avançada:** Avaliar migrar para **Opção B** se:
- Precisar de funcionalidades específicas
- Quiser reduzir dependência do n8n
- Precisar de maior controle sobre o processo

## 12. Próximos Passos para Implementação

1. ✅ Configurar credencial Google Sheets no n8n
2. ✅ Criar workflow no n8n (manualmente ou via API)
3. ✅ Criar Edge Function `process-sheets-row`
4. ✅ Implementar `sheetsMappingService` para transformar dados
5. ✅ Implementar `contaAzulApiService` para criar vendas
6. ✅ Testar fluxo completo end-to-end
7. ✅ Configurar monitoramento e alertas

## 13. Exemplo de Workflow n8n Completo (JSON)

```json
{
  "name": "Google Sheets - Monitorar Vendas",
  "active": true,
  "tags": ["BPO-Automatizado", "Google-Sheets"],
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [
            {
              "field": "minutes",
              "minutesInterval": 5
            }
          ]
        }
      },
      "id": "schedule-trigger",
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "operation": "read",
        "documentId": {
          "__rl": true,
          "value": "={{ $env.SHEET_ID }}",
          "mode": "id"
        },
        "sheetName": {
          "__rl": true,
          "value": "Vendas",
          "mode": "name"
        },
        "options": {
          "useFirstRowAsHeaders": true
        }
      },
      "id": "google-sheets",
      "name": "Google Sheets",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4,
      "position": [450, 300],
      "credentials": {
        "googleSheetsOAuth2Api": {
          "id": "1",
          "name": "Google Sheets - BPO"
        }
      }
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict"
          },
          "conditions": [
            {
              "id": "new-row-check",
              "leftValue": "={{ $json.row_number }}",
              "rightValue": "={{ $env.LAST_PROCESSED_ROW || 0 }}",
              "operator": {
                "type": "number",
                "operation": "larger"
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "id": "filter",
      "name": "Filter New Rows",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [650, 300]
    },
    {
      "parameters": {
        "batchSize": 1,
        "options": {}
      },
      "id": "split",
      "name": "Split In Batches",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [850, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $env.SUPABASE_URL }}/functions/v1/process-sheets-row",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "x-api-key",
              "value": "={{ $env.SYSTEM_API_KEY }}"
            },
            {
              "name": "Authorization",
              "value": "Bearer {{ $env.SUPABASE_ANON_KEY }}"
            }
          ]
        },
        "sendBody": true,
        "contentType": "json",
        "body": "={{ JSON.stringify({ integration_id: $env.INTEGRATION_ID, row_data: $json, row_number: $json.row_number, sheet_id: $env.SHEET_ID }) }}",
        "options": {}
      },
      "id": "http-request",
      "name": "Call Edge Function",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [1050, 300]
    }
  ],
  "connections": {
    "Schedule Trigger": {
      "main": [
        [
          {
            "node": "Google Sheets",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Google Sheets": {
      "main": [
        [
          {
            "node": "Filter New Rows",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Filter New Rows": {
      "main": [
        [
          {
            "node": "Split In Batches",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Split In Batches": {
      "main": [
        [
          {
            "node": "Call Edge Function",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "settings": {
    "executionOrder": "v1"
  }
}
```

## 14. Troubleshooting

### Problema: Workflow não detecta novas linhas

**Solução:**
- Verificar se `last_processed_row` está sendo atualizado
- Verificar se filtro está correto
- Adicionar log no n8n para debug

### Problema: Erro de autenticação no Google Sheets

**Solução:**
- Verificar credencial no n8n
- Reautorizar acesso no Google
- Verificar escopos necessários

### Problema: Edge Function retorna erro

**Solução:**
- Verificar logs da Edge Function no Supabase
- Verificar se `integration_id` está correto
- Verificar se mapeamentos estão salvos

### Problema: Venda não é criada na Conta Azul

**Solução:**
- Verificar logs em `sync_jobs`
- Verificar se token da Conta Azul está válido
- Verificar se payload está correto

## 15. Conclusão

A **Opção A (n8n)** é a melhor escolha para MVP porque:
- ✅ Implementação mais rápida
- ✅ Menos código para manter
- ✅ Interface visual facilita configuração
- ✅ n8n já está configurado no sistema

Para produção, pode-se manter n8n ou migrar para Opção B conforme necessidade de controle e funcionalidades específicas.

