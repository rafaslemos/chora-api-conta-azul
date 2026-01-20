# Fluxo 2 - Detalhamento de Pedidos Tiny - Guia Completo n8n

## Visão Geral

Este documento detalha passo a passo a implementação do **Fluxo 2** no n8n para coletar os detalhes completos dos pedidos da API Tiny (`pedido.obter.php`), incluindo validação de respostas, tratamento de erros, normalização de dados e armazenamento em JSONB.

**IMPORTANTE:** Este fluxo processa pedidos com status `PENDENTE_DETALHAMENTO` na tabela `pedidos_tiny` e atualiza o status para `DETALHADO` após processamento bem-sucedido.

---

## Como Chamar RPCs do Supabase no n8n

Para chamar RPCs (Remote Procedure Calls) do Supabase no n8n, use o node **HTTP Request** com as seguintes configurações:

### Configuração Padrão para RPCs

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/[nome_da_funcao]`

**Exemplo:**
- `https://lfuzyaqqdygnlnslhrmw.supabase.co/rest/v1/rpc/get_tenants_ativos_com_olist`
- `https://lfuzyaqqdygnlnslhrmw.supabase.co/rest/v1/rpc/get_pedidos_pendentes_detalhamento`
- `https://lfuzyaqqdygnlnslhrmw.supabase.co/rest/v1/rpc/insert_pedido_detalhado_jsonb`

**Authentication:** Generic Credential Type → HTTP Header Auth

**Headers Obrigatórios:**
- **apikey:** `{{ $env.SUPABASE_ANON_KEY }}` (anon key do Supabase)
- **Authorization:** `Bearer {{ $env.SUPABASE_ANON_KEY }}` (anon key com prefixo Bearer)
- **Content-Type:** `application/json`

**Body (JSON):**
```json
{
  "p_parametro_1": "valor_1",
  "p_parametro_2": 123,
  "p_parametro_3": ["array", "de", "valores"]
}
```

---

## Estrutura do Fluxo

```
Start → Buscar Tenants → Verificar se há Tenants → Extrair Tenants do Body → Split Batches → Obter Token → Criar Sync Job → Criar Execution → 
Buscar Pedidos Pendentes → Verificar se há Pedidos → Extrair Pedidos do Body → Split Pedidos → 
Validar e Buscar Detalhes → Validar Resposta API → Normalizar Dados → Inserir Detalhes → 
Atualizar Execution → Atualizar Credential → Atualizar Sync Job → Criar Audit Log → Error Handler
```

---

## Node 1: Start

**Tipo:** Manual Trigger ou Schedule Trigger

**Configuração:**
- Se usar Schedule: configurar para executar periodicamente (ex: a cada 2 horas)
- Se usar Manual: deixar como está

**Saída:** Nenhuma (apenas inicia o fluxo)

---

## Node 2: HTTP Request - Buscar Tenants Ativos com Pedidos Pendentes

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/get_tenants_ativos_com_olist`

**Authentication:** Generic Credential Type → HTTP Header Auth

**Headers:**
- **apikey:** `{{ $env.SUPABASE_ANON_KEY }}`
- **Authorization:** `Bearer {{ $env.SUPABASE_ANON_KEY }}`
- **Content-Type:** `application/json`

**Body (JSON):**
```json
{}
```

**Nota:** Esta função RPC não requer parâmetros, mas o body JSON deve estar presente (mesmo que vazio). A função retorna apenas tenants ativos com credenciais Olist ativas que possuem pedidos com status `PENDENTE_DETALHAMENTO` na tabela `pedidos_tiny`.

**Options:**
- **Timeout:** `10000` (10 segundos)
- **Response Format:** JSON
- **Ignore SSL Issues:** `false`

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

**Saída Esperada (sem tenants com pedidos pendentes):**
```json
[]
```

**Tratamento de Erro:**
- Se erro de conexão: Error Trigger captura e registra
- Continue On Fail: `false` (erro deve interromper o fluxo)
- **Importante:** Se retornar array vazio `[]`, significa que não há tenants com pedidos pendentes para processar. O Node 3 (IF) irá verificar isso e encerrar o fluxo normalmente.

---

## Node 3: IF - Verificar se há Tenants com Pedidos Pendentes

**Tipo:** IF

**Configurações:**
- **Condition:** Verificar se o array de tenants no `body` da resposta HTTP não está vazio

**Condição:**
```
{{ $json.body && Array.isArray($json.body) && $json.body.length > 0 }}
```

ou alternativamente (mais simples):

```
{{ $json.body?.length > 0 }}
```

**Explicação:**
- O HTTP Request no n8n retorna um objeto com `body`, `headers` e `statusCode`
- O array de tenants está dentro de `$json.body`
- Verificamos se `body` existe, é um array e tem pelo menos um elemento

**True (há tenants):** Continuar para Node 4 (Function - Extrair Tenants do Body)

**False (array vazio ou sem body):** Encerrar fluxo normalmente
- **Ação:** Conectar a um node de Stop ou simplesmente não conectar a nada
- **Nota:** Como a função `get_tenants_ativos_com_olist` agora retorna apenas tenants com pedidos pendentes, se `body` estiver vazio `[]` significa que não há tenants com pedidos pendentes para processar

**Saída Esperada (True):**
- Continua com o objeto HTTP completo (que contém `body` com array de tenants)

**Saída Esperada (False):**
- Objeto HTTP com `body: []` - fluxo encerra sem processar nada

**Exemplo de Output quando há tenants:**
```json
{
  "body": [
    {
      "tenant_id": "uuid-1",
      "partner_id": "uuid-partner-1",
      "plan_code": "CRESCER"
    }
  ],
  "headers": {...},
  "statusCode": 200
}
```

**Exemplo de Output quando não há tenants:**
```json
{
  "body": [],
  "headers": {...},
  "statusCode": 200
}
```

**Nota:** Esta validação garante que o fluxo só continue se houver tenants com pedidos pendentes para detalhamento, evitando processamento desnecessário.

---

## Node 4: Function - Extrair Tenants do Body

**Tipo:** Code (JavaScript)

**Mode:** Run Once for All Items

**Código:**
```javascript
// Extrair array de tenants do body da resposta HTTP
const response = $input.item.json;
const tenants = response.body || [];

// Se não houver tenants, retornar array vazio
if (!Array.isArray(tenants) || tenants.length === 0) {
  return [];
}

// Criar um item para cada tenant
return tenants.map(tenant => ({
  json: tenant
}));
```

**Função:** Converte a resposta HTTP encapsulada (`{ body: [...], headers, statusCode }`) em items individuais que o Split In Batches pode processar corretamente.

**Saída Esperada:**
Múltiplos items, um para cada tenant:
```json
[
  {
    "json": {
      "tenant_id": "uuid-1",
      "partner_id": "uuid-partner-1",
      "plan_code": "CRESCER"
    }
  },
  {
    "json": {
      "tenant_id": "uuid-2",
      "partner_id": "uuid-partner-2",
      "plan_code": "EVOLUIR"
    }
  }
]
```

**Nota:** Este node é necessário porque o HTTP Request retorna a resposta completa com `body`, `headers` e `statusCode`. O Split In Batches precisa de items individuais, não do objeto HTTP completo.

---

## Node 5: Split In Batches

**Tipo:** Split In Batches

**Configurações:**
- **Batch Size:** `1` (processa um tenant por vez)
- **Options → Reset:** `false`

**Função:** Itera sobre cada tenant retornado, processando um de cada vez

**Saída:** Um item por vez (cada tenant)

---

## Node 6: HTTP Request - Obter Token via Edge Function

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://[SEU_PROJETO].supabase.co/functions/v1/get-tiny-token`

**Authentication:** Bearer Token
- **Token:** `{{ $env.SUPABASE_ANON_KEY }}`

**Headers:**
```
Content-Type: application/json
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
- **Ignore SSL Issues:** `false`

**Saída Esperada (Sucesso):**
```json
{
  "success": true,
  "token": "token_descriptografado_aqui",
  "tenant_id": "uuid-1",
  "partner_id": "uuid-partner-1",
  "primeira_execucao": false,
  "data_ultima_execucao": "2025-01-15",
  "limite_por_minuto": 30,
  "plan_code": "CRESCER"
}
```

**Tratamento de Erro:**
- Se `success: false`: usar IF node para pular este tenant
- Se timeout: Error Trigger captura

**Node Adicional: IF - Validar Token**

Após este node, adicionar um IF para validar:

**Condition:** `{{ $json.success }} === true`

**True:** Continuar fluxo
**False:** Pular para próximo tenant

---

## Node 7: HTTP Request - Criar Sync Job

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/create_sync_job`

**Authentication:** Generic Credential Type → HTTP Header Auth

**Headers:**
- **apikey:** `{{ $env.SUPABASE_ANON_KEY }}`
- **Authorization:** `Bearer {{ $env.SUPABASE_ANON_KEY }}`
- **Content-Type:** `application/json`

**Body (JSON):**
```json
{
  "p_tenant_id": "{{ $json.tenant_id }}",
  "p_type": "PEDIDOS_DETALHAMENTO",
  "p_details": "Iniciando detalhamento de pedidos Tiny"
}
```

**Saída Esperada:**
```json
"uuid-sync-job-1"
```

**Nota:** RPCs que retornam UUID retornam diretamente o valor (string), não um objeto JSON.

**Tratamento de Erro:**
- Continue On Fail: `true` (não crítico)

---

## Node 8: HTTP Request - Criar Platform Execution

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
  "p_execution_type": "PEDIDOS_DETALHAMENTO",
  "p_execution_date": "{{ (() => { const now = new Date(); return now.toISOString().split('T')[0]; })() }}",
  "p_is_initial_load": false
}
```

**Saída Esperada:**
```json
"uuid-execution-1"
```

**Tratamento de Erro:**
- Continue On Fail: `true` (não crítico)

---

## Node 9: HTTP Request - Buscar Pedidos Pendentes

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/get_pedidos_pendentes_detalhamento`

**Authentication:** Generic Credential Type → HTTP Header Auth

**Headers:**
- **apikey:** `{{ $env.SUPABASE_ANON_KEY }}`
- **Authorization:** `Bearer {{ $env.SUPABASE_ANON_KEY }}`
- **Content-Type:** `application/json`

**Body (JSON):**
```json
{
  "p_tenant_id": "{{ $json.tenant_id }}",
  "p_limit": 100,
  "p_offset": 0
}
```

**Saída Esperada:**
```json
[
  {
    "id": "uuid-pedido-1",
    "tenant_id": "uuid-1",
    "partner_id": "uuid-partner-1",
    "id_pedido_tiny": "934633167",
    "numero": "6021",
    "data_pedido": "2025-11-11",
    "status_pedido_tiny": "cancelado",
    "valor_total": 68.51,
    "status": "PENDENTE_DETALHAMENTO",
    "created_at": "2025-01-15T10:00:00Z"
  },
  ...
]
```

**Tratamento de Erro:**
- Se não retornar pedidos: fluxo termina normalmente (nada a processar)
- Se erro de conexão: Error Trigger captura

---

## Node 10: IF - Verificar se há Pedidos Pendentes

**Tipo:** IF

**Condition:** `{{ Array.isArray($json.body) && $json.body.length > 0 }}`

**True:** Continuar para processamento
**False:** Pular para atualização de status (não há pedidos para processar)

---

## Node 11: Function - Extrair Pedidos do Body

**Tipo:** Code (JavaScript)

**Mode:** Run Once for All Items

**Código:**
```javascript
// Extrair array de pedidos do body da resposta HTTP
const response = $input.item.json;
const pedidos = response.body || [];

// Se não houver pedidos, retornar array vazio
if (!Array.isArray(pedidos) || pedidos.length === 0) {
  return [];
}

// Criar um item para cada pedido
return pedidos.map(pedido => ({
  json: pedido
}));
```

**Função:** Converte a resposta HTTP encapsulada (`{ body: [...], headers, statusCode }`) em items individuais que o Split In Batches pode processar corretamente.

**Saída Esperada:**
Múltiplos items, um para cada pedido:
```json
[
  {
    "json": {
      "id": "efeafad9-7b2e-4ee9-968f-374c78e63bd2",
      "tenant_id": "97292c62-d1cf-481f-a4ab-22271b339e2e",
      "partner_id": "db58de87-5115-4f11-9e17-c493c7bf29fc",
      "id_pedido_tiny": "935566310",
      "numero": "6835",
      "data_pedido": "2025-12-10",
      "status_pedido_tiny": "aprovado",
      "valor_total": 84.02,
      "status": "PENDENTE_DETALHAMENTO",
      "created_at": "2025-12-11T16:58:10.693119+00:00"
    }
  },
  {
    "json": {
      "id": "1a904ca0-8fc6-48a2-8924-a41a3d8f62a6",
      ...
    }
  },
  ...
]
```

**Nota:** Este node é necessário porque o HTTP Request retorna a resposta completa com `body`, `headers` e `statusCode`. O Split In Batches precisa de items individuais, não do objeto HTTP completo.

---

## Node 12: Split In Batches - Processar Pedidos

**Tipo:** Split In Batches

**Configurações:**
- **Batch Size:** `1` (processa um pedido por vez para respeitar rate limit)
- **Options → Reset:** `false`

**Função:** Itera sobre cada pedido retornado, processando sequencialmente

**Saída:** Um pedido por vez

---

## Node 13: Function - Preparar Dados para API

**Tipo:** Code (JavaScript)

**Mode:** Run Once for All Items

**Código:**
```javascript
// Buscar dados do tenant e token dos nodes anteriores
const tokenNode = $('HTTP Request - Obter Token via Edge Function');
const tokenData = tokenNode.item.json;

if (!tokenData || !tokenData.success) {
  throw new Error('Token não disponível');
}

// Buscar dados do pedido atual
// Fallback: se vier encapsulado em body, extrair; caso contrário, usar diretamente
let pedido = $input.item.json;
if (pedido && pedido.body && Array.isArray(pedido.body) && pedido.body.length > 0) {
  // Se ainda vier encapsulado (fallback), pegar o primeiro pedido
  pedido = pedido.body[0];
}

// Buscar IDs de execução (podem retornar UUID como string ou objeto HTTP completo)
let syncJobId = null;
let executionId = null;

try {
  const syncJobNode = $('Supabase - Criar Sync Job');
  const syncJobData = syncJobNode.item.json;
  
  // Extrair UUID de diferentes formatos possíveis
  if (typeof syncJobData === 'string') {
    syncJobId = syncJobData;
  } else if (syncJobData?.data) {
    // Formato: { data: "uuid", headers: {...}, statusCode: 200 }
    syncJobId = typeof syncJobData.data === 'string' ? syncJobData.data : (syncJobData.data?.id || syncJobData.data || null);
  } else if (syncJobData?.id) {
    // Formato: { id: "uuid" }
    syncJobId = syncJobData.id;
  } else if (syncJobData) {
    // Tentar usar diretamente se for um valor simples
    syncJobId = syncJobData;
  }
} catch (e) {
  console.warn('Sync Job ID não encontrado:', e.message);
}

try {
  const executionNode = $('Supabase - Criar Platform Execution');
  const executionData = executionNode.item.json;
  
  // Extrair UUID de diferentes formatos possíveis
  if (typeof executionData === 'string') {
    executionId = executionData;
  } else if (executionData?.data) {
    // Formato: { data: "uuid", headers: {...}, statusCode: 200 }
    executionId = typeof executionData.data === 'string' ? executionData.data : (executionData.data?.id || executionData.data || null);
  } else if (executionData?.id) {
    // Formato: { id: "uuid" }
    executionId = executionData.id;
  } else if (executionData) {
    // Tentar usar diretamente se for um valor simples
    executionId = executionData;
  }
} catch (e) {
  console.warn('Execution ID não encontrado:', e.message);
}

// Calcular delay baseado no limite do plano
const limitePorMinuto = tokenData.limite_por_minuto || 30;
const delayMs = limitePorMinuto > 0 ? Math.ceil(60000 / limitePorMinuto) : 2000;

return [{
  json: {
    // Dados do pedido
    pedido_tiny_id: pedido.id,
    id_pedido_tiny: pedido.id_pedido_tiny,
    tenant_id: pedido.tenant_id,
    partner_id: pedido.partner_id,
    
    // Token e limite
    token: tokenData.token,
    limite_por_minuto: limitePorMinuto,
    delay_ms: delayMs,
    
    // IDs de execução
    sync_job_id: syncJobId,
    execution_id: executionId
  }
}];
```

**Saída Esperada:**
```json
{
  "pedido_tiny_id": "uuid-pedido-1",
  "id_pedido_tiny": "934633167",
  "tenant_id": "uuid-1",
  "partner_id": "uuid-partner-1",
  "token": "token_aqui",
  "limite_por_minuto": 30,
  "delay_ms": 2000,
  "sync_job_id": "uuid-sync-job-1",
  "execution_id": "uuid-execution-1"
}
```

---

## Node 14: Wait - Rate Limiting

**Tipo:** Wait

**Configuração:**
- **Amount:** `{{ $json.delay_ms }}`
- **Unit:** `milliseconds`

**Função:** Aguarda o delay calculado para respeitar o rate limit do plano

---

## Node 15: HTTP Request - Buscar Detalhes do Pedido (Tiny API)

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://api.tiny.com.br/api2/pedido.obter.php`

**Authentication:** None

**Headers:**
```
Content-Type: application/x-www-form-urlencoded
```

**Body (Form-Data ou URL Encoded):**
```
token={{ $json.token }}
formato=JSON
id={{ $json.id_pedido_tiny }}
```

**Options:**
- **Timeout:** `30000` (30 segundos)
- **Response Format:** JSON
- **Continue On Fail:** `true` (para não parar o fluxo se um pedido falhar)

**Saída Esperada (Sucesso):**
```json
{
  "retorno": {
    "status_processamento": "3",
    "status": "OK",
    "pedido": {
      "id": "934633167",
      "numero": "6021",
      "cliente": { ... },
      "itens": [ ... ],
      "parcelas": [ ... ],
      "pagamentos_integrados": [ ... ],
      "marcadores": [ ... ],
      ...
    }
  }
}
```

**Saída Esperada (Erro - DESCONSIDERAR):**
```json
{
  "retorno": {
    "status_processamento": 1,
    "status": "Erro",
    "codigo_erro": 6,
    "erros": [
      {
        "erro": "API Bloqueada - Excedido o número de acessos a API"
      }
    ]
  }
}
```

**Tratamento de Erro:**
- Continue On Fail: `true`
- Erros serão validados no próximo node

---

## Node 16: Function - Validar Resposta da API

**Tipo:** Code (JavaScript)

**Mode:** Run Once for All Items

**Código:**
```javascript
// Buscar dados do pedido do node anterior
const dadosPedido = $('Function - Preparar Dados para API').item.json;

// Extrair resposta da API
const response = $input.item.json;
const retorno = response.body?.retorno || response.retorno || {};

// VALIDAÇÃO CRÍTICA: Verificar status da API
// Se status !== "OK" OU status_processamento !== "3", IGNORAR o pedido
if (retorno.status !== "OK" || retorno.status_processamento !== "3") {
  // IGNORAR este pedido - não processar
  const erros = retorno.erros || [];
  const mensagemErro = erros.map(e => e.erro || e).join(', ') || 'Erro desconhecido na API';
  
  return [{
    json: {
      ...dadosPedido,
      erro: true,
      erro_api: true,
      mensagem_erro: `API Tiny retornou erro: ${mensagemErro}`,
      codigo_erro: retorno.codigo_erro || null,
      pedido_detalhes: null,
      deve_processar: false
    }
  }];
}

// Validar que existe objeto pedido
if (!retorno.pedido) {
  return [{
    json: {
      ...dadosPedido,
      erro: true,
      erro_api: false,
      mensagem_erro: 'Resposta da API não contém objeto pedido',
      pedido_detalhes: null,
      deve_processar: false
    }
  }];
}

// Validar campos obrigatórios do pedido
const pedido = retorno.pedido;
if (!pedido.id || !pedido.numero) {
  return [{
    json: {
      ...dadosPedido,
      erro: true,
      erro_api: false,
      mensagem_erro: 'Pedido não contém campos obrigatórios (id ou numero)',
      pedido_detalhes: null,
      deve_processar: false
    }
  }];
}

// Resposta válida - retornar dados para processamento
return [{
  json: {
    ...dadosPedido,
    erro: false,
    erro_api: false,
    mensagem_erro: null,
    pedido_detalhes: pedido,
    deve_processar: true
  }
}];
```

**Saída Esperada (Sucesso):**
```json
{
  "pedido_tiny_id": "uuid-pedido-1",
  "id_pedido_tiny": "934633167",
  "tenant_id": "uuid-1",
  "token": "token_aqui",
  "erro": false,
  "erro_api": false,
  "mensagem_erro": null,
  "pedido_detalhes": { /* objeto pedido completo */ },
  "deve_processar": true
}
```

**Saída Esperada (Erro):**
```json
{
  "pedido_tiny_id": "uuid-pedido-1",
  "erro": true,
  "erro_api": true,
  "mensagem_erro": "API Tiny retornou erro: API Bloqueada...",
  "codigo_erro": 6,
  "pedido_detalhes": null,
  "deve_processar": false
}
```

---

## Node 17: IF - Verificar se Deve Processar

**Tipo:** IF

**Condition:** `{{ $json.deve_processar === true && $json.erro === false }}`

**True:** Continuar para normalização e inserção
**False:** Pular para próximo pedido (pedido ignorado devido a erro da API)

---

## Node 18: Function - Normalizar Dados para JSONB

**Tipo:** Code (JavaScript)

**Mode:** Run Once for All Items

**Código:**
```javascript
const dados = $input.item.json;
const pedido = dados.pedido_detalhes;

// A função RPC insert_pedido_detalhado_jsonb espera receber o objeto pedido completo
// Ela fará a extração e normalização internamente
// Mas precisamos garantir que o formato está correto

// Verificar se itens, parcelas, etc. estão no formato correto
// A API retorna: itens: [{item: {...}}], parcelas: [{parcela: {...}}]
// A função RPC já extrai os objetos internos, então podemos passar direto

const dadosParaInsercao = {
  pedido: pedido  // Objeto completo do pedido
};

return [{
  json: {
    ...dados,
    dados_normalizados: dadosParaInsercao
  }
}];
```

**Saída Esperada:**
```json
{
  "pedido_tiny_id": "uuid-pedido-1",
  "tenant_id": "uuid-1",
  "dados_normalizados": {
    "pedido": { /* objeto pedido completo */ }
  }
}
```

---

## Node 19: HTTP Request - Inserir Detalhes do Pedido (RPC)

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/insert_pedido_detalhado_jsonb`

**Authentication:** Generic Credential Type → HTTP Header Auth

**Headers:**
- **apikey:** `{{ $env.SUPABASE_ANON_KEY }}`
- **Authorization:** `Bearer {{ $env.SUPABASE_ANON_KEY }}`
- **Content-Type:** `application/json`

**Body (JSON):**
```json
{
  "p_pedido_tiny_id": "{{ $json.pedido_tiny_id }}",
  "p_detalhes_jsonb": {{ JSON.stringify($json.dados_normalizados) }}
}
```

**Saída Esperada:**
```json
"uuid-detalhes-id"
```

**Tratamento de Erro:**
- Continue On Fail: `true`
- Se falhar: marcar pedido com erro e continuar próximo

---

## Node 20: Function - Mesclar Resultados

**Tipo:** Code (JavaScript)

**Mode:** Run Once for All Items

**Código:**
```javascript
// Buscar dados anteriores
const dadosAnteriores = $('Function - Normalizar Dados para JSONB').item.json;

// Resultado da inserção
let detalhesId = null;
try {
  const insercaoData = $input.item.json;
  detalhesId = typeof insercaoData === 'string' ? insercaoData : (insercaoData?.id || insercaoData || null);
} catch (e) {
  // Se houve erro na inserção, detalhesId permanece null
}

// Verificar se houve erro na inserção
const teveErro = !detalhesId;

return [{
  json: {
    ...dadosAnteriores,
    detalhes_id: detalhesId,
    inserido_com_sucesso: !teveErro,
    erro_insercao: teveErro
  }
}];
```

**Saída Esperada:**
```json
{
  "pedido_tiny_id": "uuid-pedido-1",
  "tenant_id": "uuid-1",
  "detalhes_id": "uuid-detalhes-1",
  "inserido_com_sucesso": true,
  "erro_insercao": false
}
```

---

## Node 21: Function - Consolidar Resultados do Batch

**Tipo:** Code (JavaScript)

**Mode:** Run Once for All Items

**Objetivo:** Após processar todos os pedidos do batch, consolidar resultados

**Código:**
```javascript
// Coletar todos os items processados
const allItems = $input.all();

// Estatísticas
let totalProcessados = 0;
let totalInseridos = 0;
let totalErrosAPI = 0;
let totalErrosInsercao = 0;
const errosDetalhados = [];

// Buscar dados do tenant do primeiro item
const primeiroItem = allItems[0]?.json || {};
const tenantId = primeiroItem.tenant_id;
const syncJobId = primeiroItem.sync_job_id;
const executionId = primeiroItem.execution_id;

// Processar cada item
allItems.forEach((item, index) => {
  const dados = item.json;
  totalProcessados++;
  
  if (dados.erro_api) {
    totalErrosAPI++;
    errosDetalhados.push({
      pedido_id: dados.id_pedido_tiny,
      tipo: 'erro_api',
      mensagem: dados.mensagem_erro
    });
  } else if (dados.erro_insercao || !dados.inserido_com_sucesso) {
    totalErrosInsercao++;
    errosDetalhados.push({
      pedido_id: dados.id_pedido_tiny,
      tipo: 'erro_insercao',
      mensagem: dados.mensagem_erro || 'Erro ao inserir detalhes'
    });
  } else {
    totalInseridos++;
  }
});

return [{
  json: {
    tenant_id: tenantId,
    sync_job_id: syncJobId,
    execution_id: executionId,
    total_processados: totalProcessados,
    total_inseridos: totalInseridos,
    total_erros_api: totalErrosAPI,
    total_erros_insercao: totalErrosInsercao,
    erros_detalhados: errosDetalhados,
    sucesso: totalErrosAPI === 0 && totalErrosInsercao === 0
  }
}];
```

**Saída Esperada:**
```json
{
  "tenant_id": "uuid-1",
  "sync_job_id": "uuid-sync-job-1",
  "execution_id": "uuid-execution-1",
  "total_processados": 50,
  "total_inseridos": 48,
  "total_erros_api": 2,
  "total_erros_insercao": 0,
  "erros_detalhados": [...],
  "sucesso": false
}
```

---

## Node 22: HTTP Request - Atualizar Platform Execution

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/update_platform_execution`

**Authentication:** Generic Credential Type → HTTP Header Auth

**Headers:**
- **apikey:** `{{ $env.SUPABASE_ANON_KEY }}`
- **Authorization:** `Bearer {{ $env.SUPABASE_ANON_KEY }}`
- **Content-Type:** `application/json`

**Body (JSON):**
```json
{
  "p_id": "{{ $json.execution_id }}",
  "p_status": "{{ $json.sucesso ? 'SUCCESS' : ($json.total_inseridos > 0 ? 'PARTIAL' : 'ERROR') }}",
  "p_total_items": {{ $json.total_inseridos }},
  "p_total_requests": {{ $json.total_processados }},
  "p_successful_requests": {{ $json.total_inseridos }},
  "p_failed_requests": {{ $json.total_erros_api + $json.total_erros_insercao }},
  "p_error_message": {{ $json.sucesso ? 'null' : JSON.stringify(`Erros: ${$json.total_erros_api} API, ${$json.total_erros_insercao} inserção`) }},
  "p_execution_details": {{ JSON.stringify({ erros: $json.erros_detalhados }) }}
}
```

**Tratamento de Erro:**
- Continue On Fail: `true` (não crítico)

---

## Node 23: HTTP Request - Atualizar Tenant Credential Execution

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/update_tenant_credential_execution`

**Authentication:** Generic Credential Type → HTTP Header Auth

**Headers:**
- **apikey:** `{{ $env.SUPABASE_ANON_KEY }}`
- **Authorization:** `Bearer {{ $env.SUPABASE_ANON_KEY }}`
- **Content-Type:** `application/json`

**Body (JSON):**
```json
{
  "p_tenant_id": "{{ $json.tenant_id }}",
  "p_platform": "OLIST",
  "p_primeira_execucao": false,
  "p_data_ultima_execucao": "{{ (() => { const now = new Date(); return now.toISOString().split('T')[0]; })() }}"
}
```

**Tratamento de Erro:**
- Continue On Fail: `true` (não crítico)

---

## Node 24: HTTP Request - Atualizar Sync Job

**Tipo:** HTTP Request

**Método:** POST

**URL:** `https://[SEU_PROJETO].supabase.co/rest/v1/rpc/update_sync_job`

**Authentication:** Generic Credential Type → HTTP Header Auth

**Headers:**
- **apikey:** `{{ $env.SUPABASE_ANON_KEY }}`
- **Authorization:** `Bearer {{ $env.SUPABASE_ANON_KEY }}`
- **Content-Type:** `application/json`

**Body (JSON):**
```json
{
  "p_id": "{{ $json.sync_job_id }}",
  "p_status": "{{ $json.sucesso ? 'SUCCESS' : ($json.total_inseridos > 0 ? 'PARTIAL' : 'ERROR') }}",
  "p_items_processed": {{ $json.total_inseridos }},
  "p_finished_at": "{{ (() => { const now = new Date(); return now.toISOString(); })() }}",
  "p_error_message": {{ $json.sucesso ? 'null' : JSON.stringify(`Erros: ${$json.total_erros_api} API, ${$json.total_erros_insercao} inserção`) }},
  "p_details": {{ JSON.stringify({ total_processados: $json.total_processados, total_inseridos: $json.total_inseridos }) }}
}
```

**Tratamento de Erro:**
- Continue On Fail: `true` (não crítico)

---

## Node 25: HTTP Request - Criar Audit Log

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
  "p_action": "PEDIDOS_DETALHAMENTO_EXECUTADO",
  "p_entity_type": "SYNC_JOB",
  "p_entity_id": "{{ $json.sync_job_id }}",
  "p_status": "{{ $json.sucesso ? 'SUCCESS' : ($json.total_inseridos > 0 ? 'PARTIAL' : 'ERROR') }}",
  "p_details": {{ JSON.stringify({ total_processados: $json.total_processados, total_inseridos: $json.total_inseridos, erros: $json.total_erros_api + $json.total_erros_insercao }) }}
}
```

**Tratamento de Erro:**
- Continue On Fail: `true` (não crítico)

---

## Validações Implementadas

1. ✅ Token válido antes de usar
2. ✅ Resposta da API Tiny válida (`status === "OK"` E `status_processamento === "3"`)
3. ✅ Campos obrigatórios presentes (`pedido.id`, `pedido.numero`)
4. ✅ Rate limiting aplicado (delay calculado baseado no plano)
5. ✅ Tratamento de erros por pedido (continua processamento mesmo com erros)
6. ✅ Continuidade após erro de tenant
7. ✅ Pedidos com erro da API são ignorados (não inseridos)

---

## Considerações Importantes

### Rate Limiting
- Processar um pedido por vez (sequencial)
- Delay calculado: `Math.ceil(60000 / limite_por_minuto)` ms
- Aguardar entre requisições para respeitar limite do plano

### Tratamento de Erros da API
- **CRÍTICO:** Se `status !== "OK"` ou `status_processamento !== "3"`, **IGNORAR** o pedido completamente
- Não inserir nada no banco para pedidos com erro
- Registrar erro no log mas continuar processamento

### Arrays Vazios
- Arrays vazios `[]` são válidos e serão armazenados como `[]` em JSONB
- A função RPC trata arrays vazios corretamente

### Normalização
- Datas em colunas individuais: convertidas de DD/MM/YYYY para YYYY-MM-DD
- Datas em JSONB: preservadas no formato original (DD/MM/YYYY) para facilitar uso
- Valores monetários: convertidos para DECIMAL nas colunas individuais
- Valores em JSONB: preservados como string (formato original da API)

---

## Exemplo de Execução Completa

### Cenário 1: Detalhamento Bem-Sucedido

```
1. Buscar Tenants → 1 tenant encontrado
2. Obter Token ✓
3. Criar Sync Job ✓
4. Criar Execution ✓
5. Buscar Pedidos Pendentes → 50 pedidos encontrados
6. Processar 50 pedidos sequencialmente:
   - Pedido 1: API OK → Inserido ✓
   - Pedido 2: API OK → Inserido ✓
   - ...
   - Pedido 50: API OK → Inserido ✓
7. Resultado: 50/50 inseridos
8. Execution atualizada: SUCCESS ✓
9. Sync Job atualizada: SUCCESS ✓
```

### Cenário 2: Erros Parciais

```
1. Buscar Tenants → 1 tenant encontrado
2. Buscar Pedidos Pendentes → 50 pedidos encontrados
3. Processar 50 pedidos:
   - Pedido 1-48: API OK → Inseridos ✓
   - Pedido 49: API Erro (rate limit) → IGNORADO
   - Pedido 50: API OK → Inserido ✓
4. Resultado: 49/50 inseridos (1 ignorado)
5. Execution atualizada: PARTIAL ✓
6. Sync Job atualizada: PARTIAL ✓
```

---

## Próximos Passos

1. Implementar este fluxo no n8n
2. Testar com tenant de exemplo
3. Validar todos os cenários de erro
4. Configurar schedule para execução periódica
5. Monitorar execuções na tabela `platform_executions`

---

## Notas Importantes

- **Formato de Data:** Datas em JSONB preservam formato original (DD/MM/YYYY) para facilitar uso posterior
- **Rate Limiting:** Sempre respeitar o limite do plano para evitar bloqueios
- **Idempotência:** O unique constraint `(pedido_tiny_id)` garante que não haverá duplicatas
- **Continuidade:** Erros em um pedido não devem impedir processamento de outros
- **Logs:** Sempre criar logs de auditoria para rastreabilidade
