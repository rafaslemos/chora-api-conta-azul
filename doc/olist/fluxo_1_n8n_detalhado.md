# Fluxo 1 - Pesquisar Pedidos Tiny - Guia Completo n8n

## Visão Geral

Este documento detalha passo a passo a implementação do Fluxo 1 no n8n para pesquisar pedidos da API Tiny, incluindo todas as validações, tratamento de erros e rastreamento.

---

## Como Chamar RPCs do Supabase no n8n

### Método: HTTP Request Node

No n8n, para chamar uma RPC (Remote Procedure Call) do Supabase, você usa o node **HTTP Request** com as seguintes configurações:

#### Configuração Padrão para RPCs

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/[nome_da_funcao]`

**Exemplo:**
- `https://lfuzyaqqdygnlnslhrmw.supabase.co/rest/v1/rpc/create_sync_job`
- `https://lfuzyaqqdygnlnslhrmw.supabase.co/rest/v1/rpc/insert_pedidos_tiny_batch`

**Authentication:** Generic Credential Type → HTTP Header Auth

**Headers Obrigatórios:**
- **apikey:** `{{ $env.SUPABASE_ANON_KEY }}` (anon key do Supabase)
- **Authorization:** `Bearer {{ $env.SUPABASE_ANON_KEY }}` (anon key com prefixo Bearer)
- **Content-Type:** `application/json`

**Headers Opcionais:**
- **Prefer:** `return=representation` (se quiser receber os dados inseridos de volta)

**Body (JSON):**
```json
{
  "p_parametro_1": "valor_1",
  "p_parametro_2": 123,
  "p_parametro_3": ["array", "de", "valores"]
}
```

#### Exemplo Completo: Chamar `create_sync_job`

**1. Criar HTTP Request Node:**

- **Method:** POST
- **URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/create_sync_job`

**2. Configurar Authentication:**
- Selecione: **Generic Credential Type**
- Tipo: **HTTP Header Auth**
- **Name:** `apikey`
- **Value:** `{{ $env.SUPABASE_ANON_KEY }}`

**3. Adicionar Headers Adicionais:**
- **Name:** `Authorization`
- **Value:** `Bearer {{ $env.SUPABASE_ANON_KEY }}`
- **Name:** `Content-Type`
- **Value:** `application/json`

**4. Configurar Body:**
- **Send Body:** `true`
- **Body Content Type:** `JSON`
- **JSON Body:**
```json
{
  "p_tenant_id": "{{ $json.tenant_id }}",
  "p_type": "PEDIDOS_PESQUISA",
  "p_details": "Iniciando pesquisa de pedidos Tiny"
}
```

**5. Resposta Esperada:**

A função `create_sync_job` retorna `UUID`, então a resposta será:

**Formato da Resposta:**
```json
"550e8400-e29b-41d4-a716-446655440000"
```

**Nota:** O Supabase retorna valores UUID como string JSON. No n8n, isso será acessível como:
- `{{ $json }}` (valor direto)
- Ou dentro de um array: `{{ $json[0] }}` se retornar array

**6. Usar o Resultado:**

**Opção A: Usar diretamente no próximo node**
- Acessar: `{{ $('HTTP Request - Criar Sync Job').item.json }}`
- Ou: `{{ $json }}` se estiver no mesmo item

**Opção B: Salvar em variável com Set Node**
- Adicionar Set node após o HTTP Request
- **Fields to Set:**
  - **Name:** `sync_job_id`
  - **Value:** `{{ $json }}`
- Depois acessar: `{{ $json.sync_job_id }}`

**Opção C: Usar Function para normalizar**
```javascript
// Se a resposta vier como array ou string
const response = $input.item.json;
const syncJobId = Array.isArray(response) ? response[0] : response;

return [{
  json: {
    ...$('Node Anterior').item.json,
    sync_job_id: syncJobId
  }
}];
```

#### Diferença entre RPC e Edge Function

| Tipo | URL | Uso |
|------|-----|-----|
| **RPC** | `/rest/v1/rpc/nome_funcao` | Funções PostgreSQL no banco |
| **Edge Function** | `/functions/v1/nome-funcao` | Funções Deno/TypeScript no Supabase |

#### Variáveis de Ambiente Necessárias

Configure no n8n:
- `SUPABASE_ANON_KEY`: Anon key do Supabase (obrigatória)
- `SUPABASE_URL`: URL do projeto (opcional, pode hardcodar)

**Onde encontrar a Anon Key:**
- Dashboard Supabase → Settings → API → `anon` `public` key

#### Exemplo Visual: Configuração no n8n

**Passo 1: Criar HTTP Request Node**

1. Adicione um node "HTTP Request" ao workflow
2. Configure:
   - **Method:** `POST`
   - **URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/create_sync_job`
     - Exemplo: `https://lfuzyaqqdygnlnslhrmw.supabase.co/rest/v1/rpc/create_sync_job`

**Passo 2: Configurar Authentication**

Na aba "Authentication":
- Selecione: **Generic Credential Type**
- Escolha: **HTTP Header Auth**
- Configure:
  - **Name:** `apikey`
  - **Value:** `{{ $env.SUPABASE_ANON_KEY }}`

**Passo 3: Configurar Headers Adicionais**

Na aba "Options" → "Headers" (ou "Send Headers"):
- Adicione:
  - **Name:** `Authorization`
  - **Value:** `Bearer {{ $env.SUPABASE_ANON_KEY }}`
  - **Name:** `Content-Type`
  - **Value:** `application/json`

**Passo 4: Configurar Body**

Na aba "Body":
- **Send Body:** `true`
- **Body Content Type:** `JSON`
- **JSON Body:**
```json
{
  "p_tenant_id": "{{ $json.tenant_id }}",
  "p_type": "PEDIDOS_PESQUISA",
  "p_details": "Iniciando pesquisa de pedidos Tiny"
}
```

**Passo 5: Testar**

Execute o node e verifique a resposta:
- Se sucesso: retorna UUID (string direta ou em objeto)
- Se erro: retorna mensagem de erro do PostgreSQL

#### Nota sobre Retorno de RPCs

- **Funções que retornam UUID/TEXT/INTEGER:** Retornam o valor diretamente (ex: `"uuid-aqui"` ou `123`)
- **Funções que retornam JSONB/TABLE:** Retornam objeto JSON (ex: `{ "campo": "valor" }`)
- **Funções que retornam VOID:** Retornam array vazio `[]` ou `null`

---

## Estrutura do Fluxo

```
Start → Buscar Tenants → Split Batches → Obter Token → Criar Sync Job → Criar Execution → 
Calcular Período → Buscar Página 1 → Validar Resposta → Paginar → Validar Pedidos → 
Inserir Pedidos → Atualizar Execution → Atualizar Credential → Atualizar Sync Job → 
Criar Audit Log → Error Handler
```

---

## Node 1: Start

**Tipo:** Manual Trigger ou Schedule Trigger

**Configuração:**
- Se usar Schedule: configurar para executar diariamente (ex: 02:00 AM)
- Se usar Manual: deixar como está

**Saída:** Nenhuma (apenas inicia o fluxo)

---

## Node 2: Supabase - Buscar Tenants Ativos

**Tipo:** Supabase Node

**Operação:** Select

**Tabela:** `tenants` (com JOIN implícito via query)

**Query SQL:**
```sql
SELECT 
  t.id as tenant_id,
  t.partner_id,
  tc.config->>'plan' as plan_code
FROM tenants t
INNER JOIN tenant_credentials tc ON tc.tenant_id = t.id
WHERE t.status = 'ACTIVE'
  AND tc.platform = 'OLIST'
  AND tc.is_active = true
ORDER BY t.created_at ASC
```

**Configurações:**
- **Return All:** `true`
- **Options → Query:** Usar a query acima

**Saída Esperada:**
```json
[
  {
    "tenant_id": "uuid-1",
    "partner_id": "uuid-partner-1",
    "plan_code": "CRESCER"
  },
  {
    "tenant_id": "uuid-2",
    "partner_id": "uuid-partner-2",
    "plan_code": "EVOLUIR"
  }
]
```

**Tratamento de Erro:**
- Se não retornar tenants: fluxo termina normalmente (nada a processar)
- Se erro de conexão: Error Trigger captura e registra

---

## Node 3: Split In Batches

**Tipo:** Split In Batches

**Configurações:**
- **Batch Size:** `1` (processa um tenant por vez)
- **Options → Reset:** `false`

**Função:** Itera sobre cada tenant retornado, processando um de cada vez

**Saída:** Um item por vez (cada tenant)

---

## Node 4: HTTP Request - Obter Token via Edge Function

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://[SEU_PROJETO].supabase.co/functions/v1/get-tiny-token`

**Authentication:** Bearer Token
- **Token:** `{{ $env.SUPABASE_ANON_KEY }}` (ou Service Role Key se necessário)

**Headers:**
```
Content-Type: application/json
x-api-key: {{ $env.SYSTEM_API_KEY }} (opcional, se configurado)
```

**Body (JSON):**
```json
{
  "tenant_id": "{{ $json.tenant_id }}",
  "platform": "OLIST"
}
```

**Options:**
- **Timeout:** `10000` (10 segundos)
- **Response Format:** JSON
- **Ignore SSL Issues:** `false` (em produção)

**Saída Esperada (Sucesso):**
```json
{
  "success": true,
  "token": "token_descriptografado_aqui",
  "tenant_id": "uuid-1",
  "partner_id": "uuid-partner-1",
  "primeira_execucao": true,
  "data_ultima_execucao": null,
  "limite_por_minuto": 30,
  "plan_code": "CRESCER"
}
```

**Saída Esperada (Erro):**
```json
{
  "success": false,
  "error": "Credencial não encontrada..."
}
```

**Tratamento de Erro:**
- Se `success: false`: usar IF node para pular este tenant
- Se timeout: Error Trigger captura
- Se token vazio: marcar credencial como inativa e pular

**Node Adicional: IF - Validar Token**

Após este node, adicionar um IF para validar:

**Condition:** `{{ $json.success }} === true`

**True:** Continuar fluxo
**False:** 
- Marcar credencial como inativa (UPDATE tenant_credentials SET is_active = false)
- Criar audit log de erro
- Pular para próximo tenant (usar Continue On Fail)

---

## Node 5: Supabase - Criar Sync Job

**Tipo:** HTTP Request (ou Supabase Node se disponível)

### Opção 1: HTTP Request (Recomendado)

**Método:** POST

**URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/create_sync_job`

**Authentication:** Generic Credential Type → HTTP Header Auth

**Headers:**
- **apikey:** `{{ $env.SUPABASE_ANON_KEY }}`
- **Authorization:** `Bearer {{ $env.SUPABASE_ANON_KEY }}`
- **Content-Type:** `application/json`
- **Prefer:** `return=representation` (retorna os dados inseridos)

**Body (JSON):**
```json
{
  "p_tenant_id": "{{ $json.tenant_id }}",
  "p_type": "PEDIDOS_PESQUISA",
  "p_details": "Iniciando pesquisa de pedidos Tiny"
}
```

**Configurações Adicionais:**
- **Timeout:** `10000` (10 segundos)
- **Response Format:** JSON

### Opção 2: Supabase Node (se disponível no n8n)

**Operação:** RPC (Remote Procedure Call)

**Function Name:** `create_sync_job`

**Parameters:**
```
p_tenant_id: {{ $json.tenant_id }}
p_type: PEDIDOS_PESQUISA
p_details: Iniciando pesquisa de pedidos Tiny
```

**Nota:** Se o n8n não tiver node Supabase nativo, use a Opção 1 (HTTP Request).

**Saída Esperada:**
```json
"uuid-sync-job-1"
```

**Nota:** RPCs que retornam valores simples (UUID, TEXT, INTEGER) retornam diretamente o valor, não um objeto JSON.

**Guardar ID:** 
Para usar depois, salvar em variável ou acessar via:
- `{{ $json }}` (retorna o UUID diretamente)
- Ou usar Set node para renomear: `sync_job_id: {{ $json }}`

**Tratamento de Erro:**
- Se falhar: continuar mesmo assim (não crítico)
- Usar Continue On Fail: `true`

---

## Node 6: Supabase - Criar Platform Execution

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/create_platform_execution`

**Authentication:** Generic Credential Type → HTTP Header Auth

**Headers:**
- **apikey:** `{{ $env.SUPABASE_ANON_KEY }}`
- **Authorization:** `Bearer {{ $env.SUPABASE_ANON_KEY }}`
- **Content-Type:** `application/json`

**Body (JSON):**
```json
{
  "p_tenant_id": "{{ $json.tenant_id }}",
  "p_platform": "TINY",
  "p_execution_type": "PEDIDOS_PESQUISA",
  "p_execution_date": "{{ (() => { const now = new Date(); return now.toISOString().split('T')[0]; })() }}",
  "p_is_initial_load": {{ $json.primeira_execucao || false }}
}
```

**Saída Esperada:**
```json
"uuid-execution-1"
```

**Nota:** A função retorna UUID diretamente (string), não um objeto JSON.

**Guardar ID:** 
Para usar depois, salvar em variável ou acessar via:
- `{{ $json }}` (retorna o UUID diretamente)
- Ou usar Set node para renomear: `execution_id: {{ $json }}`

**Tratamento de Erro:**
- Se falhar: continuar mesmo assim (não crítico)
- Usar Continue On Fail: `true`

**Nota sobre Idempotência:**
- Se já existir uma execução para o mesmo tenant, platform, type e date, a função atualiza o registro existente e retorna o ID
- Isso garante que não haverá duplicatas mesmo se o fluxo for executado múltiplas vezes no mesmo dia

---

## Node 7: Function - Calcular Período

**Tipo:** Code (JavaScript)

**Mode:** Run Once for All Items

**Código:**
```javascript
const hoje = new Date();
const ontem = new Date(hoje);
ontem.setDate(hoje.getDate() - 1);

// Buscar dados diretamente do Node 4 (HTTP Request - Token)
// IMPORTANTE: O nome do node deve corresponder exatamente ao nome configurado no n8n
const tokenNode = $('HTTP Request - Obter Token via Edge Function');
const tokenData = tokenNode.item.json;

// Validar se os dados existem e se a requisição foi bem-sucedida
if (!tokenData) {
  throw new Error('Dados do token não encontrados');
}

if (tokenData.success === false) {
  throw new Error(`Erro ao obter token: ${tokenData.error || 'Erro desconhecido'}`);
}

// Extrair dados do token
const primeiraExecucao = tokenData.primeira_execucao ?? true;
const dataUltimaExecucao = tokenData.data_ultima_execucao;

// Buscar IDs dos RPCs (podem retornar UUID como string simples ou objeto)
let syncJobId = null;
let executionId = null;

try {
  const syncJobNode = $('Supabase - Criar Sync Job');
  const syncJobData = syncJobNode.item.json;
  // RPCs podem retornar UUID como string simples ou objeto HTTP completo
  if (typeof syncJobData === 'string') {
    syncJobId = syncJobData;
  } else if (syncJobData?.data) {
    // Se vier como objeto HTTP completo, extrair do campo data
    syncJobId = syncJobData.data;
  } else {
    syncJobId = syncJobData?.id || syncJobData || null;
  }
} catch (e) {
  // Se não encontrar, continua sem o ID (não crítico)
  console.warn('Sync Job ID não encontrado:', e.message);
}

try {
  const executionNode = $('Supabase - Criar Platform Execution');
  const executionData = executionNode.item.json;
  // RPCs podem retornar UUID como string simples ou objeto HTTP completo
  if (typeof executionData === 'string') {
    executionId = executionData;
  } else if (executionData?.data) {
    // Se vier como objeto HTTP completo, extrair do campo data
    executionId = executionData.data;
  } else {
    executionId = executionData?.id || executionData || null;
  }
} catch (e) {
  // Se não encontrar, continua sem o ID (não crítico)
  console.warn('Execution ID não encontrado:', e.message);
}

// Calcular período
let dataInicial;
let dataFinal = new Date(ontem);

if (primeiraExecucao) {
  // Carga inicial: últimos 30 dias a partir de ontem
  dataInicial = new Date(ontem);
  dataInicial.setDate(ontem.getDate() - 29); // 30 dias contando o dia anterior
} else {
  // Atualização diária: apenas o dia anterior
  dataInicial = new Date(ontem);
  
  // Validação: se data_ultima_execucao for muito antiga (mais de 90 dias), limitar
  if (dataUltimaExecucao) {
    const ultimaExec = new Date(dataUltimaExecucao);
    const diasSemExecutar = Math.floor((ontem - ultimaExec) / (1000 * 60 * 60 * 24));
    
    if (diasSemExecutar > 90) {
      // Limitar a 90 dias para evitar sobrecarga
      dataInicial = new Date(ontem);
      dataInicial.setDate(ontem.getDate() - 89);
    }
  }
}

// Função para formatar data DD/MM/YYYY
function formatarData(data) {
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

// Retornar dados consolidados
return [{
  json: {
    tenant_id: tokenData.tenant_id,
    partner_id: tokenData.partner_id,
    token: tokenData.token,
    limite_por_minuto: tokenData.limite_por_minuto || 0,
    primeira_execucao: primeiraExecucao,
    dataInicial: formatarData(dataInicial),
    dataFinal: formatarData(dataFinal),
    sync_job_id: syncJobId,
    execution_id: executionId,
    page: 1  // Página inicial para facilitar configuração do loop
  }
}];
```

**Saída Esperada:**
```json
{
  "tenant_id": "uuid-1",
  "partner_id": "uuid-partner-1",
  "token": "token_aqui",
  "limite_por_minuto": 30,
  "primeira_execucao": true,
  "dataInicial": "01/12/2024",
  "dataFinal": "30/12/2024",
  "sync_job_id": "uuid-sync-job-1",
  "execution_id": "uuid-execution-1",
  "page": 1
}
```

---

## Node 8: HTTP Request - Buscar Página 1 (Tiny)

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://api.tiny.com.br/api2/pedidos.pesquisa.php`

**Authentication:** None

**Headers:**
```
Content-Type: application/x-www-form-urlencoded
```

**Body (Form-Data ou URL Encoded):**
```
token={{ $json.token }}
formato=JSON
dataInicial={{ $json.dataInicial }}
dataFinal={{ $json.dataFinal }}
pagina=1
```

**Options:**
- **Timeout:** `30000` (30 segundos)
- **Response Format:** JSON
- **Ignore SSL Issues:** `false`

**Saída Esperada (Sucesso):**
```json
{
  "retorno": {
    "status": "OK",
    "numero_paginas": "5",
    "pedidos": [
      {
        "pedido": {
          "id": "12345",
          "numero": "PED-001",
          "data_pedido": "30/12/2024",
          "situacao": "faturado",
          "valor": "1500.00"
        }
      },
      ...
    ]
  }
}
```

**Saída Esperada (Erro):**
```json
{
  "retorno": {
    "status": "Erro",
    "erros": [
      {
        "erro": "Token inválido"
      }
    ]
  }
}
```

**Tratamento de Erro:**
- Validar `retorno.status === "OK"`
- Se erro: marcar credencial como inativa e pular tenant
- Se timeout: Error Trigger captura

---

## Node 9: Function - Validar Resposta

**Tipo:** Code (JavaScript)

**Mode:** Run Once for All Items

**Código:**
```javascript
const response = $input.item.json;
// A resposta do HTTP Request vem em body.retorno
const retorno = response.body?.retorno || response.retorno || {};

// Validar status da resposta
if (retorno.status !== 'OK') {
  const erros = retorno.erros || [];
  const mensagemErro = erros.map(e => e.erro || e).join(', ');
  
  return [{
    json: {
      ...$('Function - Calcular Período').item.json,
      erro: true,
      mensagem_erro: `API Tiny retornou erro: ${mensagemErro}`,
      numero_paginas: 0,
      pedidos: []
    }
  }];
}

// Validar número de páginas
const numeroPaginas = parseInt(retorno.numero_paginas) || 0;

if (numeroPaginas <= 0) {
  // Não há pedidos, mas não é erro
  return [{
    json: {
      ...$('Function - Calcular Período').item.json,
      erro: false,
      numero_paginas: 0,
      pedidos: retorno.pedidos || [],
      mensagem: "Nenhum pedido encontrado no período"
    }
  }];
}

// Validar estrutura de pedidos
const pedidos = retorno.pedidos || [];

// Retornar dados validados
return [{
  json: {
    ...$('Function - Calcular Período').item.json,
    erro: false,
    numero_paginas: numeroPaginas,
    pedidos: pedidos,
    pedidos_pagina_1: pedidos // Guardar pedidos da página 1
  }
}];
```

**Saída Esperada:**
```json
{
  "tenant_id": "uuid-1",
  "token": "token_aqui",
  "dataInicial": "01/12/2024",
  "dataFinal": "30/12/2024",
  "erro": false,
  "numero_paginas": 5,
  "pedidos": [...],
  "pedidos_pagina_1": [...]
}
```

---

## Node 10: IF - Verificar se há Erro

**Tipo:** IF

**Condition:** `{{ $json.erro }} === true`

**True:** 
- Ir para Error Handler (marcar credencial inativa, atualizar execution com erro)
**False:** 
- Continuar para paginação

---

## Node 11: IF - Verificar se há Páginas

**Tipo:** IF

**Condition:** `{{ $json.numero_paginas }} > 1`

**True:** 
- Ir para Function - Paginar Resultados
**False:** 
- Pular paginação (já tem todos os pedidos na página 1)

---

## Node 12: Function - Gerar Items para Páginas

**Tipo:** Code (JavaScript)

**Mode:** Run Once for All Items

**Objetivo:** Este node gera múltiplos items (um para cada página) que serão processados em um loop com HTTP Request nodes. Isso é necessário porque o Function node do n8n não suporta requisições HTTP diretas para APIs externas.

**Como Funciona:**
1. Recebe os dados da página 1 (já buscada no Node 8)
2. Se houver apenas 1 página, retorna os dados consolidados imediatamente
3. Se houver múltiplas páginas:
   - Cria um item base (página 1) com todos os dados, incluindo `pedidos_pagina_1`
   - Cria items adicionais (páginas 2+) **SEM** os campos `pedidos` ou `pedidos_pagina_1` para otimizar memória
   - Cada item adicional contém apenas os metadados necessários (token, datas, etc.) para fazer a requisição HTTP no Node 14

**Otimização:** Os items das páginas 2+ não contêm os campos `pedidos` ou `pedidos_pagina_1` para evitar duplicação desnecessária de dados. Esses pedidos serão obtidos via HTTP Request no Node 14.

**Código:**
```javascript
const dados = $input.item.json;
const totalPaginas = dados.numero_paginas;

// Se não há páginas adicionais, retornar apenas os dados originais consolidados
if (totalPaginas <= 1) {
  return [{
    json: {
      ...dados,
      pedidos_totais: dados.pedidos || dados.pedidos_pagina_1 || [],
      total_paginas_processadas: 1,
      paginas_com_erro: [],
      total_requisicoes: 1
    }
  }];
}

// Gerar um item para cada página (2 até totalPaginas)
const items = [];

// Primeiro item: dados originais com flag indicando que é o item base (página 1)
// Este item contém os pedidos da página 1 que já foram buscados
items.push({
  json: {
    ...dados,
    is_base_item: true,
    pagina_atual: 1
    // Mantém pedidos_pagina_1 e pedidos aqui (já foram buscados)
  }
});

// OTIMIZAÇÃO: Remover campos de pedidos dos dados usando destructuring
// Isso garante que os items das páginas 2+ não contenham dados desnecessários
// Os pedidos das páginas 2+ serão buscados via HTTP Request no Node 14
const { pedidos, pedidos_pagina_1, ...dadosSemPedidos } = dados;

// Gerar items para páginas 2 até totalPaginas
// Cada item contém apenas os metadados necessários (token, datas, etc.)
// NÃO contém pedidos (serão buscados via HTTP Request)
for (let p = 2; p <= totalPaginas; p++) {
  items.push({
    json: {
      ...dadosSemPedidos,  // Dados SEM pedidos (otimizado para reduzir memória)
      is_base_item: false,
      pagina_atual: p
      // NÃO contém: pedidos, pedidos_pagina_1
      // Contém: tenant_id, partner_id, token, dataInicial, dataFinal, limite_por_minuto, etc.
    }
  });
}

return items;
```

**Saída Esperada:**
Múltiplos items, um para cada página:
```json
[
  {
    "tenant_id": "uuid-1",
    "partner_id": "uuid-partner-1",
    "token": "token_aqui",
    "dataInicial": "01/12/2024",
    "dataFinal": "30/12/2024",
    "limite_por_minuto": 30,
    "is_base_item": true,
    "pagina_atual": 1,
    "numero_paginas": 8,
    "pedidos_pagina_1": [...],  // ← Pedidos da página 1 (já buscados)
    "pedidos": [...]            // ← Mesmos pedidos (legado)
  },
  {
    "tenant_id": "uuid-1",
    "partner_id": "uuid-partner-1",
    "token": "token_aqui",
    "dataInicial": "01/12/2024",
    "dataFinal": "30/12/2024",
    "limite_por_minuto": 30,
    "is_base_item": false,
    "pagina_atual": 2,
    "numero_paginas": 8
    // ← OTIMIZADO: NÃO contém pedidos ou pedidos_pagina_1
    // ← Serão buscados via HTTP Request no Node 14
  },
  {
    "tenant_id": "uuid-1",
    "partner_id": "uuid-partner-1",
    "token": "token_aqui",
    "dataInicial": "01/12/2024",
    "dataFinal": "30/12/2024",
    "limite_por_minuto": 30,
    "is_base_item": false,
    "pagina_atual": 3,
    "numero_paginas": 8
    // ← OTIMIZADO: NÃO contém pedidos ou pedidos_pagina_1
  }
  // ... mais items para páginas 4, 5, 6, 7, 8 (todos sem pedidos)
]
```

**Nota Importante sobre Otimização:**
- **Item base (página 1):** Contém `pedidos_pagina_1` porque já foi buscado no Node 8
- **Items das páginas 2+:** **NÃO contêm** `pedidos` ou `pedidos_pagina_1` para otimizar o uso de memória
- **Benefício:** Se houver 8 páginas com 50 pedidos cada, economizamos ~350 objetos JSON desnecessários nos items das páginas 2-8
- **Os pedidos das páginas 2+ serão obtidos via HTTP Request no Node 14** e consolidados no Node 15

---

## Explicação Detalhada do Fluxo de Paginação (Nodes 12-15)

### Visão Geral do Fluxo

```
Node 9 (Validar Resposta)
  ↓
Node 11 (IF - Verificar se há Páginas)
  ↓ (se numero_paginas > 1)
Node 12 (Function - Gerar Items para Páginas)
  ↓ (gera múltiplos items: 1 base + N-1 páginas)
Node 13 (IF - Separar Item Base das Páginas)
  ├─ TRUE (is_base_item = true) → Node 15 (Consolidar Pedidos)
  └─ FALSE (is_base_item = false) → Node 14 (HTTP Request - Buscar Página)
                                      ↓
                                    Node 15 (Consolidar Pedidos)
```

### Passo a Passo Detalhado

**1. Node 12 - Geração de Items:**
- **Entrada:** 1 item com dados da página 1 (já buscada)
- **Processamento:** 
  - Se `numero_paginas = 1`: retorna item consolidado imediatamente
  - Se `numero_paginas > 1`: gera N items (1 base + N-1 páginas)
- **Saída:** Múltiplos items
  - Item 1: `is_base_item = true`, contém `pedidos_pagina_1`
  - Items 2-N: `is_base_item = false`, **NÃO contêm pedidos** (otimizado)

**2. Node 13 - Roteamento:**
- **Item base (página 1):** Vai direto para Node 15 (já tem os pedidos)
- **Items das páginas 2+:** Vão para Node 14 (precisam buscar pedidos)

**3. Node 14 - Buscar Páginas:**
- **Entrada:** Items das páginas 2+ (sem pedidos, apenas metadados)
- **Processamento:** Faz requisição HTTP para Tiny API para cada página
- **Saída:** Items com resposta da API (pedidos da página específica)

**4. Node 15 - Consolidar:**
- **Entrada:** 
  - Item base (página 1) com `pedidos_pagina_1`
  - Items das páginas 2+ com respostas do HTTP Request
- **Processamento:** 
  - Extrai pedidos do item base
  - Extrai pedidos de cada item de página
  - Consolida tudo em `pedidos_totais`
  - Rastreia erros por página
- **Saída:** 1 item com todos os pedidos consolidados

### Exemplo Prático (8 páginas)

**Node 12 gera:**
- Item 1: `{ is_base_item: true, pagina_atual: 1, pedidos_pagina_1: [50 pedidos] }`
- Item 2: `{ is_base_item: false, pagina_atual: 2 }` ← **SEM pedidos**
- Item 3: `{ is_base_item: false, pagina_atual: 3 }` ← **SEM pedidos**
- ... até Item 8

**Node 13 roteia:**
- Item 1 → Node 15 (direto)
- Items 2-8 → Node 14

**Node 14 busca:**
- Item 2 → HTTP Request página 2 → `{ body: { retorno: { pedidos: [50 pedidos] } } }`
- Item 3 → HTTP Request página 3 → `{ body: { retorno: { pedidos: [50 pedidos] } } }`
- ... até Item 8

**Node 15 consolida:**
- Extrai 50 pedidos do Item 1 (`pedidos_pagina_1`)
- Extrai 50 pedidos do Item 2 (`body.retorno.pedidos`)
- Extrai 50 pedidos do Item 3 (`body.retorno.pedidos`)
- ... até Item 8
- **Resultado:** `pedidos_totais: [400 pedidos]` (8 páginas × 50 pedidos)

### Por que essa Otimização?

**Sem otimização (antigo):**
- Item 2: `{ pedidos_pagina_1: [50 pedidos], pagina_atual: 2 }` ← **Desnecessário!**
- Item 3: `{ pedidos_pagina_1: [50 pedidos], pagina_atual: 3 }` ← **Desnecessário!**
- **Problema:** 50 pedidos repetidos em 7 items = 350 objetos JSON desnecessários

**Com otimização (atual):**
- Item 2: `{ pagina_atual: 2 }` ← **Apenas metadados**
- Item 3: `{ pagina_atual: 3 }` ← **Apenas metadados**
- **Benefício:** Reduz uso de memória e tráfego de dados no n8n

---

## Node 13: IF - Separar Item Base das Páginas

**Tipo:** IF

**Condition:** `{{ $json.is_base_item }} === true`

**True:** 
- Ir para Node 15 (Function - Consolidar Pedidos) - item base vai direto para consolidação

**False:** 
- Ir para Node 14 (HTTP Request - Buscar Página) - páginas precisam ser buscadas

---

## Node 14: HTTP Request - Buscar Página

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://api.tiny.com.br/api2/pedidos.pesquisa.php`

**Authentication:** None

**Headers:**
```
Content-Type: application/x-www-form-urlencoded
```

**Body (Form-Data ou URL Encoded):**
```
token={{ $json.token }}
formato=JSON
dataInicial={{ $json.dataInicial }}
dataFinal={{ $json.dataFinal }}
pagina={{ $json.pagina_atual }}
```

**Options:**
- **Timeout:** `30000` (30 segundos)
- **Response Format:** JSON
- **Continue On Fail:** `true` (para não parar o fluxo se uma página falhar)

**Rate Limiting:**
- **IMPORTANTE:** Para respeitar o rate limit, configure o n8n para processar os items com delay
- **Opção 1:** No n8n, configure o workflow para processar items com delay entre execuções
- **Opção 2:** Adicione um **Wait** node antes deste node com delay: `{{ Math.ceil(60000 / $json.limite_por_minuto) }}` ms
- **Opção 3:** Use o modo "Process items sequentially" no n8n e adicione delay no código do Node 12
- Delay calculado: `{{ Math.ceil(60000 / $json.limite_por_minuto) }}` ms (ex: 60 req/min = 1000ms de delay)

**Saída Esperada (Sucesso):**
```json
{
  "body": {
    "retorno": {
      "status": "OK",
      "pagina": "2",
      "numero_paginas": 8,
      "pedidos": [...]
    }
  }
}
```

**Tratamento de Erro:**
- Se falhar, o item continua com erro marcado
- O Node 15 irá consolidar e tratar os erros

**Conexão:**
- Após este node, conectar ao **Node 15: Function - Consolidar Pedidos**
- O Node 15 irá processar todos os items (base + páginas buscadas) juntos

---

## Node 15: Function - Consolidar Pedidos

**Tipo:** Code (JavaScript)

**Mode:** Run Once for All Items

**Código:**
```javascript
// Separar item base dos items de páginas
const allItems = $input.all();
const baseItem = allItems.find(item => item.json.is_base_item === true);
const pageItems = allItems.filter(item => item.json.is_base_item !== true);

// Tratamento especial: quando há apenas 1 página, o item pode não ter is_base_item
// Nesse caso, usar o primeiro item como base (já contém todos os pedidos)
let dados;
if (!baseItem) {
  // Verificar se é caso de página única (sem is_base_item)
  if (allItems.length === 1 && (allItems[0].json.numero_paginas === 1 || allItems[0].json.numero_paginas === undefined)) {
    dados = allItems[0].json;
  } else {
    throw new Error('Item base não encontrado');
  }
} else {
  dados = baseItem.json;
}

const limitePorMinuto = dados.limite_por_minuto || 30;
const delayMs = limitePorMinuto > 0 ? Math.ceil(60000 / limitePorMinuto) : 2000;

// Array para armazenar todos os pedidos (começar com página 1)
const pedidosTotais = [...(dados.pedidos_pagina_1 || dados.pedidos || [])];
const paginasComErro = [];
let totalRequisicoes = 1; // Já fez a página 1

// Processar cada item de página (apenas se houver páginas adicionais)
// Se baseItem não foi encontrado e é página única, pageItems estará vazio (correto)
for (const pageItem of pageItems) {
  const paginaAtual = pageItem.json.body?.retorno?.pagina || pageItem.json.pagina_atual || 'desconhecida';
  
  try {
    // Extrair resposta do HTTP Request
    const response = pageItem.json.body || pageItem.json;
    const retorno = response.retorno || {};
    
    if (retorno.status === 'OK' && retorno.pedidos) {
      pedidosTotais.push(...retorno.pedidos);
      totalRequisicoes++;
    } else {
      const erros = retorno.erros || [];
      const mensagemErro = erros.map(e => e.erro || e).join(', ') || 'Erro desconhecido';
      paginasComErro.push({
        pagina: paginaAtual,
        erro: mensagemErro
      });
    }
  } catch (error) {
    paginasComErro.push({
      pagina: paginaAtual,
      erro: error.message || String(error)
    });
  }
}

// Retornar dados consolidados
return [{
  json: {
    // Campos essenciais para próximos nós
    tenant_id: dados.tenant_id,
    partner_id: dados.partner_id,
    execution_id: dados.execution_id,
    sync_job_id: dados.sync_job_id,
    primeira_execucao: dados.primeira_execucao,
    erro: dados.erro || false,
    mensagem_erro: dados.mensagem_erro || null,
    
    // Dados consolidados
    pedidos_totais: pedidosTotais,
    total_paginas_processadas: dados.numero_paginas || 1,
    paginas_com_erro: paginasComErro,
    total_requisicoes: totalRequisicoes
  }
}];
```

**Saída Esperada:**
```json
{
  "tenant_id": "uuid-1",
  "pedidos_totais": [...], // Todos os pedidos de todas as páginas
  "total_paginas_processadas": 8,
  "paginas_com_erro": [],
  "total_requisicoes": 8,
  "delay_aplicado_ms": 1000
}
```

---

## Node 16: Function - Validar e Normalizar Pedidos

**Tipo:** Code (JavaScript)

**Mode:** Run Once for All Items

**Código:**
```javascript
const dados = $input.item.json;
const pedidosBrutos = dados.pedidos_totais || [];
const tenantId = dados.tenant_id;
const partnerId = dados.partner_id;

// Array para pedidos válidos
const pedidosValidados = [];
const pedidosInvalidos = [];

// Função para converter data DD/MM/YYYY para YYYY-MM-DD
function converterData(dataStr) {
  if (!dataStr) return null;
  
  // Tentar diferentes formatos
  const formatos = [
    /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
    /^(\d{4})-(\d{2})-(\d{2})$/,   // YYYY-MM-DD
  ];
  
  for (const formato of formatos) {
    const match = dataStr.match(formato);
    if (match) {
      if (formato === formatos[0]) {
        // DD/MM/YYYY -> YYYY-MM-DD
        return `${match[3]}-${match[2]}-${match[1]}`;
      } else {
        // Já está em YYYY-MM-DD
        return dataStr;
      }
    }
  }
  
  return null; // Formato não reconhecido
}

// Função para normalizar status para valores aceitos pelo CHECK constraint
function normalizarStatus(status) {
  if (!status) return null;
  
  const statusMap = {
    'Entregue': 'entregue',
    'Cancelado': 'cancelado',
    'Faturado': 'faturado',
    'Aberto': 'aberto',
    'Aprovado': 'aprovado',
    'Preparando Envio': 'preparando_envio',
    'Pronto Envio': 'pronto_envio',
    'Enviado': 'enviado',
    'Não Entregue': 'nao_entregue'
  };
  
  const statusLower = status.toLowerCase().trim();
  
  // Tentar mapeamento direto primeiro
  if (statusMap[status]) {
    return statusMap[status];
  }
  
  // Tentar mapeamento por lowercase
  for (const [key, value] of Object.entries(statusMap)) {
    if (key.toLowerCase() === statusLower) {
      return value;
    }
  }
  
  // Se não encontrar, retornar null (será ignorado)
  return null;
}

// Validar e normalizar cada pedido
pedidosBrutos.forEach((item, index) => {
  try {
    const pedido = item.pedido || item;
    
    // Validar campos obrigatórios
    if (!pedido.id || !pedido.numero) {
      pedidosInvalidos.push({
        indice: index,
        motivo: 'Campos obrigatórios ausentes (id ou numero)',
        dados: pedido
      });
      return;
    }
    
    // Normalizar dados
    const pedidoNormalizado = {
      tenant_id: tenantId,
      partner_id: partnerId,
      id_pedido_tiny: String(pedido.id),
      numero: String(pedido.numero || ''),
      data_pedido: converterData(pedido.data_pedido),
      status_pedido_tiny: normalizarStatus(pedido.situacao),
      valor_total: pedido.valor ? parseFloat(String(pedido.valor).replace(',', '.')) : null
    };
    
    // Validar conversão de data
    if (pedido.data_pedido && !pedidoNormalizado.data_pedido) {
      pedidosInvalidos.push({
        indice: index,
        motivo: `Formato de data inválido: ${pedido.data_pedido}`,
        dados: pedido
      });
      return;
    }
    
    // Validar valor_total se presente
    if (pedidoNormalizado.valor_total !== null && isNaN(pedidoNormalizado.valor_total)) {
      pedidosInvalidos.push({
        indice: index,
        motivo: `Valor inválido: ${pedido.valor}`,
        dados: pedido
      });
      return;
    }
    
    pedidosValidados.push(pedidoNormalizado);
  } catch (error) {
    pedidosInvalidos.push({
      indice: index,
      motivo: `Erro ao processar: ${error.message}`,
      dados: item
    });
  }
});

// Retornar dados validados
return [{
  json: {
    // Campos essenciais para próximos nós
    tenant_id: tenantId,
    partner_id: partnerId,
    execution_id: dados.execution_id,
    sync_job_id: dados.sync_job_id,
    primeira_execucao: dados.primeira_execucao,
    
    // Dados validados
    pedidos_validados: pedidosValidados,
    pedidos_invalidos: pedidosInvalidos,
    total_validos: pedidosValidados.length,
    total_invalidos: pedidosInvalidos.length,
    
    // Metadados de execução (para Node 19 e 21)
    total_paginas_processadas: dados.total_paginas_processadas,
    total_requisicoes: dados.total_requisicoes,
    paginas_com_erro: dados.paginas_com_erro || [],
    
    // Campos de erro (se existirem)
    erro: dados.erro || false,
    mensagem_erro: dados.mensagem_erro || null
  }
}];
```

**Saída Esperada:**
```json
{
  "tenant_id": "uuid-1",
  "pedidos_validados": [
    {
      "tenant_id": "uuid-1",
      "partner_id": "uuid-partner-1",
      "id_pedido_tiny": "12345",
      "numero": "PED-001",
      "data_pedido": "2024-12-30",
      "status_pedido_tiny": "faturado",
      "valor_total": 1500.00
    },
    ...
  ],
  "pedidos_invalidos": [],
  "total_validos": 150,
  "total_invalidos": 0
}
```

---

## Node 17: IF - Verificar se há Pedidos Válidos

**Tipo:** IF

**Condition:** `{{ $json.total_validos }} > 0`

**True:** 
- Ir para inserir pedidos
**False:** 
- Pular inserção (mas ainda atualizar execution como sucesso)

---

## Node 18: HTTP Request - Inserir Pedidos (RPC)

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/insert_pedidos_tiny_batch`

**Authentication:** Generic Credential Type → HTTP Header Auth
- **Name:** `apikey`
- **Value:** `{{ $env.SUPABASE_ANON_KEY }}`

**Headers:**
- `Authorization`: `Bearer {{ $env.SUPABASE_ANON_KEY }}`
- `Content-Type`: `application/json`

**Body (JSON):**
```json
{
  "p_pedidos": {{ JSON.stringify($json.pedidos_validados) }}
}
```

**Nota:** O `JSON.stringify()` converte o array JavaScript em formato JSON válido que o PostgreSQL aceita como JSONB array.

**Alternativa (Recomendada):** Para evitar criar o Node 18.5, você pode adicionar um Function Node após este HTTP Request que mescle a resposta com os dados originais. Ou usar um Set Node antes deste node para preservar os dados do Node 16.

**Saída Esperada:**
```json
{
  "inserted": 145,
  "updated": 5,
  "errors": 0,
  "total": 150,
  "error_details": []
}
```

**Nota:** O campo `error_details` contém um array com detalhes dos erros (se houver), incluindo o pedido que falhou, a mensagem de erro e o código SQLSTATE.

**Tratamento de Erro:**
- Se houver erros: continuar mesmo assim (alguns pedidos podem ter sido inseridos)
- Registrar erros no execution_details

---

## Node 18.5: Function - Mesclar Dados

**Tipo:** Code (JavaScript)

**Mode:** Run Once for All Items

**Código:**
```javascript
// Obter dados do Node 16 (antes da inserção)
// IMPORTANTE: Substituir 'Node 16' pelo nome exato do node no seu workflow n8n
// Exemplos de nomes possíveis:
// - $('Node 16')
// - $('Function - Validar e Normalizar Pedidos')
// - $('Function - Validar Pedidos')
const node16 = $('Node 16');
const dadosOriginais = node16 && node16.item ? node16.item.json : {};

// Obter resposta do Node 18 (resultado da inserção)
// A resposta do HTTP Request pode vir em diferentes formatos:
// - $input.item.json.data (string JSON)
// - $input.item.json.body (objeto)
// - $input.item.json (objeto direto)
let resultadoInsercao = null;

if ($input.item.json.data) {
  // Se data existe e é string, fazer parse
  if (typeof $input.item.json.data === 'string') {
    try {
      resultadoInsercao = JSON.parse($input.item.json.data);
    } catch (e) {
      resultadoInsercao = $input.item.json.data;
    }
  } else {
    resultadoInsercao = $input.item.json.data;
  }
} else if ($input.item.json.body) {
  // Se body existe, usar body
  resultadoInsercao = $input.item.json.body;
} else {
  // Caso contrário, usar json direto
  resultadoInsercao = $input.item.json;
}

// Garantir que resultadoInsercao é um objeto
if (!resultadoInsercao || typeof resultadoInsercao !== 'object') {
  resultadoInsercao = {};
}

// Mesclar dados originais com resultado da inserção
return [{
  json: {
    // Dados originais do Node 16 (necessários para nodes seguintes)
    ...dadosOriginais,
    
    // Resultado da inserção do Node 18
    resultado_insercao: resultadoInsercao,
    inserted: resultadoInsercao.inserted || 0,
    updated: resultadoInsercao.updated || 0,
    errors_insercao: resultadoInsercao.errors || 0,
    error_details_insercao: resultadoInsercao.error_details || []
  }
}];
```

**Nota Importante:** 
- Substitua `'Node 16'` pelo nome exato do node no seu workflow n8n
- Se não conseguir acessar pelo nome, você pode usar um Set Node antes do Node 18 para salvar os dados do Node 16 em variáveis, e então recuperá-las aqui
- Alternativamente, modifique o Node 18 para também retornar os dados originais junto com a resposta da RPC (usando um Function Node após o HTTP Request)

**Objetivo:** Mesclar os dados originais do Node 16 com a resposta do Node 18, garantindo que todos os campos necessários estejam disponíveis para os nodes seguintes (19, 20, 21, 22).

**Saída Esperada:**
```json
{
  "tenant_id": "uuid-1",
  "execution_id": "uuid-execution-1",
  "sync_job_id": "uuid-sync-job-1",
  "total_validos": 150,
  "total_paginas_processadas": 9,
  "total_requisicoes": 9,
  "paginas_com_erro": [],
  "pedidos_invalidos": [],
  "erro": false,
  "mensagem_erro": null,
  "inserted": 145,
  "updated": 5,
  "errors_insercao": 0,
  "error_details_insercao": []
}
```

---

## Node 19: HTTP Request - Atualizar Platform Execution

**Nota:** Este node recebe dados do Node 18.5 (Function - Mesclar Dados), que contém tanto os dados originais do Node 16 quanto o resultado da inserção do Node 18.

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/update_platform_execution`

**Authentication:** Generic Credential Type → HTTP Header Auth

**Headers:**
- **apikey:** `{{ $env.SUPABASE_ANON_KEY }}`
- **Authorization:** `Bearer {{ $env.SUPABASE_ANON_KEY }}`
- **Content-Type:** `application/json`

**Function Name:** `update_platform_execution`

**Body (JSON):**
```json
{
  "p_id": "{{ $json.execution_id }}",
  "p_status": "{{ ($json.inserted > 0 || $json.updated > 0) ? 'SUCCESS' : ($json.erro ? 'ERROR' : 'SUCCESS') }}",
  "p_total_pages": {{ $json.total_paginas_processadas || $json.numero_paginas || 0 }},
  "p_total_items": {{ $json.inserted || 0 }},
  "p_total_requests": {{ $json.total_requisicoes || 1 }},
  "p_successful_requests": {{ ($json.total_requisicoes || 1) - ($json.paginas_com_erro?.length || 0) }},
  "p_failed_requests": {{ $json.paginas_com_erro?.length || 0 }},
  "p_error_message": {{ $json.erro ? JSON.stringify($json.mensagem_erro) : 'null' }},
  "p_execution_details": {{ JSON.stringify({ pedidos_invalidos: $json.pedidos_invalidos || [], paginas_com_erro: $json.paginas_com_erro || [], resultado_insercao: { inserted: $json.inserted || 0, updated: $json.updated || 0, errors: $json.errors_insercao || 0 } }) }}
}
```

**Nota:** A função `update_platform_execution` retorna VOID, então não há resposta de dados. O n8n pode retornar um array vazio ou null.

**Tratamento de Erro:**
- Continue On Fail: `true` (não crítico)

---

## Node 20: HTTP Request - Atualizar Tenant Credential Execution

**Nota:** Este node recebe dados do Node 18.5 (Function - Mesclar Dados), que contém os dados originais do Node 16 necessários para atualizar a credencial.

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/update_tenant_credential_execution`

**Authentication:** Generic Credential Type → HTTP Header Auth
- **Name:** `apikey`
- **Value:** `{{ $env.SUPABASE_ANON_KEY }}`

**Headers:**
- `Authorization`: `Bearer {{ $env.SUPABASE_ANON_KEY }}`
- `Content-Type`: `application/json`

**Body (JSON):**
```json
{
  "p_tenant_id": "{{ $json.tenant_id }}",
  "p_platform": "OLIST",
  "p_primeira_execucao": false,
  "p_data_ultima_execucao": "{{ (() => { const now = new Date(); return now.toISOString().split('T')[0]; })() }}"
}
```

**Nota:** A função `update_tenant_credential_execution` retorna VOID, então não há resposta de dados. O n8n pode retornar um array vazio ou null.

**Condição:** Apenas atualizar se não houve erro crítico (verificar `$json.erro` antes de executar)

**Tratamento de Erro:**
- Continue On Fail: `true` (não crítico)

---

## Node 21: HTTP Request - Atualizar Sync Job

**Nota:** Este node recebe dados do Node 18.5 (Function - Mesclar Dados), que contém os dados originais do Node 16 necessários para atualizar o sync_job.

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/update_sync_job`

**Authentication:** Generic Credential Type → HTTP Header Auth
- **Name:** `apikey`
- **Value:** `{{ $env.SUPABASE_ANON_KEY }}`

**Headers:**
- `Authorization`: `Bearer {{ $env.SUPABASE_ANON_KEY }}`
- `Content-Type`: `application/json`

**Body (JSON):**
```json
{
  "p_id": "{{ $json.sync_job_id }}",
  "p_status": "{{ $json.erro ? 'ERROR' : 'SUCCESS' }}",
  "p_items_processed": {{ $json.inserted || 0 }},
  "p_finished_at": "{{ (() => { const now = new Date(); return now.toISOString(); })() }}",
  "p_error_message": {{ $json.erro ? JSON.stringify($json.mensagem_erro) : 'null' }},
  "p_details": {{ JSON.stringify({ total_paginas: $json.total_paginas_processadas || 0, total_pedidos: $json.inserted || 0 }) }}
}
```

**Nota:** A função `update_sync_job` retorna VOID, então não há resposta de dados. O n8n pode retornar um array vazio ou null.

**Tratamento de Erro:**
- Continue On Fail: `true` (não crítico)

---

## Node 22: HTTP Request - Criar Audit Log

**Nota:** Este node recebe dados do Node 18.5 (Function - Mesclar Dados), que contém os dados originais do Node 16 necessários para criar o log de auditoria.

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/create_audit_log`

**Authentication:** Generic Credential Type → HTTP Header Auth

**Headers:**
- **apikey:** `{{ $env.SUPABASE_ANON_KEY }}`
- **Authorization:** `Bearer {{ $env.SUPABASE_ANON_KEY }}`
- **Content-Type:** `application/json`

**Body (JSON):**
```json
{
  "p_tenant_id": "{{ $json.tenant_id }}",
  "p_user_id": null,
  "p_action": "PEDIDOS_PESQUISA_EXECUTADA",
  "p_entity_type": "SYNC_JOB",
  "p_entity_id": "{{ $json.sync_job_id }}",
  "p_status": "{{ $json.erro ? 'ERROR' : 'SUCCESS' }}",
  "p_details": {{ JSON.stringify({ total_pedidos: $json.inserted || 0, total_paginas: $json.total_paginas_processadas || 0 }) }}
}
```

**Saída Esperada:**
```json
"uuid-audit-log-id"
```

**Nota:** A função retorna UUID do log criado.

**Tratamento de Erro:**
- Continue On Fail: `true` (não crítico)

---

## Node 23: Error Handler (Opcional mas Recomendado)

**Tipo:** Error Trigger

**Configuração:**
- Conectar após cada node crítico
- Ou usar um Error Trigger global no final

**Ações no Error Handler:**

1. **Marcar Credencial como Inativa** (se erro de token)
2. **Atualizar Execution com Status ERROR**
3. **Atualizar Sync Job com Status ERROR**
4. **Criar Audit Log de Erro**
5. **Notificar** (futuro: email/webhook)

**Código do Error Handler:**
```javascript
const error = $input.error;
const executionId = $('Supabase - Criar Platform Execution')?.item?.json?.id;
const syncJobId = $('Supabase - Criar Sync Job')?.item?.json?.id;
const tenantId = $('Supabase - Buscar Tenants Ativos')?.item?.json?.tenant_id;

// Atualizar execution se existir
if (executionId) {
  // Chamar RPC update_platform_execution com status ERROR
}

// Atualizar sync_job se existir
if (syncJobId) {
  // UPDATE sync_jobs SET status='ERROR', error_message=...
}

// Criar audit log
// ...

return [];
```

---

## Configurações Importantes do Fluxo

### Error Workflow
- **Continue On Fail:** Habilitar em nodes não críticos
- **Error Workflow:** Configurar para capturar erros globais

### Rate Limiting
- **Delay entre requisições:** Calculado automaticamente baseado no plano
- **Timeout:** 30 segundos por requisição
- **Retry:** Não implementar retry automático (deixar para manual)

### Performance
- **Batch Size:** 1 tenant por vez (já configurado)
- **Timeout do Fluxo:** Configurar timeout global (ex: 1 hora)

---

## Validações Implementadas

1. ✅ Token válido antes de usar
2. ✅ Resposta da API Tiny válida
3. ✅ numero_paginas > 0
4. ✅ Campos obrigatórios presentes
5. ✅ Formato de data válido
6. ✅ Período máximo (90 dias)
7. ✅ Rate limiting aplicado
8. ✅ Tratamento de erros por página
9. ✅ Continuidade após erro de tenant

---

## Exemplo de Execução Completa

### Cenário 1: Carga Inicial Bem-Sucedida

```
1. Buscar Tenants → 2 tenants encontrados
2. Tenant 1:
   - Token obtido ✓
   - Sync Job criado ✓
   - Execution criada ✓
   - Período: 30 dias (01/12 a 30/12)
   - Páginas: 5
   - Pedidos: 150 válidos
   - Inseridos: 150 ✓
   - Execution atualizada: SUCCESS ✓
   - Credential atualizada ✓
3. Tenant 2:
   - (mesmo processo)
```

### Cenário 2: Erro de Token

```
1. Buscar Tenants → 2 tenants encontrados
2. Tenant 1:
   - Token obtido ✗ (token inválido)
   - IF valida token → FALSE
   - Marcar credencial inativa ✓
   - Criar audit log de erro ✓
   - Pular para próximo tenant ✓
3. Tenant 2:
   - (processar normalmente)
```

### Cenário 3: Erro na Paginação

```
1. Tenant processando:
   - Página 1: ✓
   - Página 2: ✓
   - Página 3: ✗ (erro de rede)
   - Página 4: ✓ (continua mesmo com erro na 3)
   - Página 5: ✓
   - Resultado: 4 de 5 páginas processadas
   - Execution: PARTIAL ✓
   - Pedidos inseridos: 120 de 150 ✓
```

---

## Próximos Passos

1. Implementar este fluxo no n8n
2. Testar com tenant de exemplo
3. Validar todos os cenários de erro
4. Configurar schedule para execução diária
5. Monitorar execuções na tabela `platform_executions`

---

## Notas Importantes

- **Formato de Data:** A API Tiny pode retornar em DD/MM/YYYY, sempre validar e converter
- **Rate Limiting:** Respeitar sempre o limite do plano para evitar bloqueios
- **Idempotência:** O unique constraint `(tenant_id, id_pedido_tiny)` garante que não haverá duplicatas
- **Continuidade:** Erros em um tenant não devem impedir processamento de outros
- **Logs:** Sempre criar logs de auditoria para rastreabilidade

