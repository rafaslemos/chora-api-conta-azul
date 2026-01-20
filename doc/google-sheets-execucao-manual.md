# Google Sheets - Execução Manual (Sob Demanda)

## Visão Geral

Ao invés de ter um workflow automático que executa periodicamente, o cliente pode executar manualmente quando necessário. Isso oferece mais controle e pode ser mais eficiente em alguns casos.

## Abordagens Possíveis

### Opção 1: Botão no Frontend → Executar Workflow n8n (Recomendado)

**Como funciona:**
- Cliente acessa página de integrações
- Vê lista de suas planilhas configuradas
- Clica em botão "Sincronizar Agora"
- Frontend chama API do n8n para executar workflow
- Workflow processa planilha e retorna resultado
- Frontend mostra status (sucesso/erro)

**Fluxo:**
```
Frontend (Botão "Sincronizar")
    ↓
API n8n (Execute Workflow)
    ↓
n8n Workflow (Processar Planilha)
    ↓
Edge Function (Criar Vendas)
    ↓
Retorna Resultado para Frontend
```

---

### Opção 2: Botão no Frontend → Executar Diretamente Edge Function

**Como funciona:**
- Cliente clica em "Sincronizar Agora"
- Frontend chama Edge Function diretamente
- Edge Function lê planilha via Google Sheets API
- Processa e cria vendas
- Retorna resultado

**Fluxo:**
```
Frontend (Botão "Sincronizar")
    ↓
Edge Function (Ler Planilha + Processar)
    ↓
Google Sheets API (Ler dados)
    ↓
Conta Azul API (Criar Vendas)
    ↓
Retorna Resultado para Frontend
```

**Nota:** Requer Opção B (OAuth Próprio) para acessar Google Sheets diretamente.

---

### Opção 3: Híbrido - Manual + Agendamento Opcional

**Como funciona:**
- Cliente pode executar manualmente quando quiser
- **OU** pode ativar agendamento automático (opcional)
- Melhor dos dois mundos

**Fluxo:**
```
Cliente escolhe:
  ├─ Executar Agora (Manual)
  └─ Ativar Agendamento (Automático a cada X minutos)
```

---

## Implementação Detalhada: Opção 1 (Recomendada)

### Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│ Frontend - Página de Integrações                       │
│ ┌─────────────────────────────────────────────────┐   │
│ │ Planilha: Vendas Janeiro                        │   │
│ │ Status: ✅ Ativa                                 │   │
│ │ Última sincronização: 15/01/2024 10:30          │   │
│ │ [🔄 Sincronizar Agora]                          │   │
│ └─────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ (Clique no botão)
                     │
┌────────────────────▼────────────────────────────────────┐
│ Frontend chama n8nService.executeWorkflow()            │
│ POST /api/v1/workflows/{id}/execute                    │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ n8n Workflow executa:                                   │
│ 1. Google Sheets Read (sheet_id específico)            │
│ 2. Filter (novas linhas)                               │
│ 3. Split In Batches (1 linha por vez)                  │
│ 4. HTTP Request → Edge Function                        │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ Edge Function processa e cria vendas                   │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│ Retorna resultado para n8n                             │
│ n8n retorna para Frontend                              │
│ Frontend mostra: "✅ 5 vendas criadas com sucesso!"    │
└─────────────────────────────────────────────────────────┘
```

### 1. Modificar Workflow n8n para Execução Manual

**Mudanças necessárias:**

#### Antes (Automático):
```
Schedule Trigger → Google Sheets Read → ...
```

#### Depois (Manual):
```
Webhook Trigger → Google Sheets Read → ...
```

**Configuração do Webhook:**

**Nó 1: Webhook Trigger**

**Tipo:** Webhook

**Configuração:**
- **HTTP Method:** POST
- **Path:** `sheets-sync/:integration_id`
- **Response Mode:** Response Node
- **Options:**
  - **Response Data:** All Entries
  - **Response Code:** 200

**Parâmetros recebidos:**
```json
{
  "integration_id": "123e4567-e89b-12d3-a456-426614174000",
  "tenant_id": "tenant-1",
  "triggered_by": "user-123"
}
```

**Nó 2: HTTP Request - Buscar Configuração da Integração**

**Tipo:** HTTP Request

**Configuração:**
- **Method:** GET
- **URL:** `{{ $env.SUPABASE_URL }}/rest/v1/sheets_integrations?id=eq.{{ $json.body.integration_id }}`
- **Headers:**
  - `apikey`: `{{ $env.SUPABASE_ANON_KEY }}`
  - `Authorization`: `Bearer {{ $env.SUPABASE_ANON_KEY }}`

**Output:**
```json
{
  "id": "integration-id",
  "sheet_id": "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms",
  "range": "A2:Z1000",
  "sheet_name": "Vendas",
  "last_processed_row": 5
}
```

**Nó 3: Google Sheets Read**

**Tipo:** Google Sheets

**Configuração:**
- **Spreadsheet ID:** `={{ $json.sheet_id }}`
- **Sheet Name:** `={{ $json.sheet_name }}`
- **Range:** `={{ $json.range }}`

**Nó 4-7:** Mesmos nós do workflow automático (Filter, Split, HTTP Request)

**Nó 8: Responder ao Frontend**

**Tipo:** Respond to Webhook

**Configuração:**
- **Response Code:** 200
- **Response Body:**
```json
{
  "success": true,
  "integration_id": "={{ $json.integration_id }}",
  "rows_processed": 5,
  "sales_created": 5,
  "errors": []
}
```

---

### 2. Frontend - Página de Integrações

**`pages/SheetsIntegration.tsx`** (modificar)

```typescript
import React, { useState, useEffect } from 'react';
import { sheetsIntegrationService } from '../services/sheetsIntegrationService';
import { n8nService } from '../services/n8nService';
import Button from '../components/ui/Button';

const SheetsIntegration: React.FC = () => {
  const [integrations, setIntegrations] = useState([]);
  const [syncing, setSyncing] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, any>>({});

  useEffect(() => {
    loadIntegrations();
  }, [tenantId]);

  const loadIntegrations = async () => {
    const data = await sheetsIntegrationService.list(tenantId);
    setIntegrations(data);
  };

  const handleSync = async (integrationId: string) => {
    setSyncing(prev => ({ ...prev, [integrationId]: true }));
    
    try {
      // Buscar workflow_id da integração
      const integration = integrations.find(i => i.id === integrationId);
      const workflowId = integration?.config?.n8n_workflow_id;
      
      if (!workflowId) {
        throw new Error('Workflow não configurado para esta integração');
      }

      // Executar workflow no n8n
      const result = await n8nService.executeWorkflow(workflowId, {
        integration_id: integrationId,
        tenant_id: tenantId,
        triggered_by: userId, // ID do usuário logado
      });

      // Atualizar resultado
      setResults(prev => ({
        ...prev,
        [integrationId]: result,
      }));

      // Recarregar integrações para atualizar last_processed_row
      await loadIntegrations();

      // Mostrar notificação de sucesso
      showNotification('success', `✅ ${result.sales_created} vendas criadas com sucesso!`);

    } catch (error) {
      console.error('Erro ao sincronizar:', error);
      setResults(prev => ({
        ...prev,
        [integrationId]: { error: error.message },
      }));
      showNotification('error', `Erro ao sincronizar: ${error.message}`);
    } finally {
      setSyncing(prev => ({ ...prev, [integrationId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Integrações Google Sheets</h1>

      <div className="grid gap-4">
        {integrations.map(integration => (
          <div key={integration.id} className="bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold">{integration.name}</h3>
                <p className="text-sm text-gray-500">
                  Planilha: {integration.sheet_url}
                </p>
                <p className="text-sm text-gray-500">
                  Última sincronização: {
                    integration.last_processed_row 
                      ? `Linha ${integration.last_processed_row}`
                      : 'Nunca'
                  }
                </p>
                {results[integration.id] && (
                  <div className="mt-2">
                    {results[integration.id].error ? (
                      <p className="text-red-600 text-sm">
                        ❌ {results[integration.id].error}
                      </p>
                    ) : (
                      <p className="text-green-600 text-sm">
                        ✅ {results[integration.id].sales_created} vendas criadas
                      </p>
                    )}
                  </div>
                )}
              </div>
              <Button
                onClick={() => handleSync(integration.id)}
                disabled={syncing[integration.id]}
                className="ml-4"
              >
                {syncing[integration.id] ? (
                  <>
                    <RefreshCw className="animate-spin mr-2" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2" />
                    Sincronizar Agora
                  </>
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

### 3. Serviço n8n - Executar Workflow

**`services/n8nService.ts`** (já existe, apenas usar)

```typescript
// Já existe o método executeWorkflow
const result = await n8nService.executeWorkflow(workflowId, {
  integration_id: integrationId,
  tenant_id: tenantId,
  triggered_by: userId,
});
```

**Mas precisamos criar webhook URL:**

**`lib/n8n.ts`** (adicionar método)

```typescript
/**
 * Obtém URL do webhook para executar workflow
 */
export const getN8nWebhookUrl = (workflowId: string, path: string): string => {
  const webhookUrl = n8nWebhookUrl || n8nUrl;
  if (!webhookUrl) {
    throw new Error('n8n webhook URL não configurado');
  }
  
  // Formato: https://n8n.com/webhook/{workflow-id}/{path}
  return `${webhookUrl}/webhook/${workflowId}/${path}`;
};

/**
 * Dispara webhook do n8n (execução manual)
 */
export const triggerN8nWebhook = async (
  workflowId: string,
  path: string,
  data: Record<string, any>
): Promise<any> => {
  const webhookUrl = getN8nWebhookUrl(workflowId, path);
  
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Erro ao disparar webhook: ${response.statusText}`);
  }

  return response.json();
};
```

---

## Implementação Detalhada: Opção 2 (Direto Edge Function)

### Vantagens

- ✅ Não precisa do n8n
- ✅ Mais rápido (menos camadas)
- ✅ Mais controle

### Desvantagens

- ❌ Requer OAuth próprio (Opção B)
- ❌ Mais código para manter
- ❌ Precisa gerenciar tokens do Google

### Edge Function: `sync-sheets-manual`

**`supabase/functions/sync-sheets-manual/index.ts`**

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Validar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 2. Extrair dados
    const { integration_id } = await req.json();
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 3. Buscar integração
    const { data: integration, error } = await supabase
      .from('sheets_integrations')
      .select('*, tenant_id')
      .eq('id', integration_id)
      .single();

    if (error || !integration) {
      return new Response(
        JSON.stringify({ error: 'Integração não encontrada' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // 4. Buscar token do Google Sheets (descriptografado)
    const { data: googleCred } = await supabase.rpc(
      'get_tenant_credential_decrypted',
      {
        p_tenant_id: integration.tenant_id,
        p_platform: 'GOOGLE_SHEETS',
      }
    );

    if (!googleCred || googleCred.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Credenciais do Google Sheets não encontradas' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // 5. Ler planilha via Google Sheets API
    const sheetData = await readGoogleSheet(
      googleCred[0].access_token,
      integration.sheet_id,
      integration.range
    );

    // 6. Buscar mapeamentos
    const { data: mappings } = await supabase
      .from('sheets_field_mappings')
      .select('*')
      .eq('integration_id', integration_id);

    // 7. Processar cada linha
    const results = [];
    let lastProcessedRow = integration.last_processed_row || 0;

    for (let i = 0; i < sheetData.values.length; i++) {
      const rowNumber = i + 2; // +2 porque começa na linha 2
      
      if (rowNumber <= lastProcessedRow) {
        continue; // Já processada
      }

      const rowData = sheetData.values[i];
      
      // Transformar linha em payload de venda
      const saleData = transformRowToSale(rowData, mappings);
      
      // Criar venda na Conta Azul
      const saleResult = await createSaleInContaAzul(
        integration.tenant_id,
        saleData
      );

      results.push({
        row_number: rowNumber,
        success: saleResult.success,
        sale_id: saleResult.sale_id,
        error: saleResult.error,
      });

      lastProcessedRow = rowNumber;
    }

    // 8. Atualizar last_processed_row
    await supabase
      .from('sheets_integrations')
      .update({ last_processed_row: lastProcessedRow })
      .eq('id', integration_id);

    // 9. Registrar em sync_jobs
    await supabase
      .from('sync_jobs')
      .insert({
        tenant_id: integration.tenant_id,
        type: 'SHEETS_SALE_SYNC',
        status: 'SUCCESS',
        items_processed: results.length,
        details: JSON.stringify({ integration_id, results }),
      });

    return new Response(
      JSON.stringify({
        success: true,
        rows_processed: results.length,
        sales_created: results.filter(r => r.success).length,
        errors: results.filter(r => !r.success),
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});

// Função auxiliar para ler Google Sheet
async function readGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  range: string
) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ao ler planilha: ${response.status}`);
  }

  return await response.json();
}
```

---

## Opção 3: Híbrido (Manual + Automático Opcional)

### Como Funciona

Cliente pode escolher:
1. **Executar manualmente** quando quiser
2. **Ativar agendamento** para execução automática

### Interface

```typescript
<div className="flex items-center gap-4">
  <Button onClick={handleSync}>
    🔄 Sincronizar Agora
  </Button>
  
  <Toggle
    label="Agendamento Automático"
    checked={integration.config.auto_sync}
    onChange={handleToggleAutoSync}
  />
  
  {integration.config.auto_sync && (
    <Select
      value={integration.config.sync_interval}
      onChange={handleChangeInterval}
    >
      <option value="5">A cada 5 minutos</option>
      <option value="15">A cada 15 minutos</option>
      <option value="30">A cada 30 minutos</option>
      <option value="60">A cada 1 hora</option>
    </Select>
  )}
</div>
```

### Workflow n8n Híbrido

```
┌─────────────────────┐
│ Webhook Trigger      │ (Manual)
└──────────┬──────────┘
           │
           ├─────────────────┐
           │                 │
┌──────────▼──────────┐     │
│ Schedule Trigger     │     │ (Automático - se ativado)
└──────────┬──────────┘     │
           │                 │
           └────────┬────────┘
                    │
         ┌──────────▼──────────┐
         │ Verificar se auto   │
         │ sync está ativo     │
         └──────────┬──────────┘
                    │
         ┌──────────▼──────────┐
         │ Google Sheets Read  │
         └─────────────────────┘
```

---

## Comparação das Abordagens

| Aspecto | Manual (Opção 1) | Manual (Opção 2) | Híbrido (Opção 3) |
|---------|------------------|------------------|-------------------|
| **Complexidade** | ⚠️ Média | ⚠️ Média | ⚠️ Alta |
| **Dependência n8n** | ✅ Sim | ❌ Não | ✅ Sim |
| **Velocidade** | ⚠️ Média | ✅ Rápida | ⚠️ Média |
| **Controle do Cliente** | ✅ Total | ✅ Total | ✅ Total |
| **Flexibilidade** | ✅ Alta | ✅ Alta | ✅✅ Muito Alta |
| **Recomendação** | ✅ **SIM** | ⚠️ Se não usar n8n | ✅✅ **MELHOR** |

---

## Recomendação Final

**Opção 3 (Híbrido)** é a melhor escolha porque:

1. ✅ **Flexibilidade máxima** - cliente escolhe quando executar
2. ✅ **Automação opcional** - pode ativar se quiser
3. ✅ **Melhor UX** - atende diferentes necessidades
4. ✅ **Escalável** - funciona para todos os casos

**Implementação:**
- Workflow n8n com **Webhook Trigger** (manual)
- **Schedule Trigger opcional** (se `auto_sync = true`)
- Frontend com botão "Sincronizar Agora" + toggle "Agendamento Automático"

---

## Próximos Passos

1. ✅ Modificar workflow n8n para aceitar webhook
2. ✅ Adicionar botão "Sincronizar Agora" no frontend
3. ✅ Implementar chamada ao webhook do n8n
4. ✅ Adicionar toggle "Agendamento Automático" (opcional)
5. ✅ Testar execução manual
6. ✅ Testar execução automática (se ativado)

