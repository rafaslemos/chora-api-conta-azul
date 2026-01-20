# Renovação de Tokens Conta Azul no n8n

Este documento descreve como os workflows do n8n devem obter e usar tokens válidos da Conta Azul, com renovação automática quando necessário.

## Visão Geral

Os tokens de acesso da Conta Azul têm tempo de expiração limitado. Para garantir que os workflows do n8n sempre usem tokens válidos, é necessário chamar o endpoint `get-valid-token` antes de fazer requisições à API da Conta Azul.

O endpoint verifica automaticamente se o token está expirado e, se necessário, renova usando o refresh_token antes de retornar o token válido.

## Deploy da Edge Function

Antes de usar o endpoint, é necessário fazer o deploy da Edge Function no Supabase.

### Pré-requisitos

1. Supabase CLI instalado: `npm install -g supabase`
2. Autenticado no Supabase: `supabase login`
3. Projeto vinculado: `supabase link --project-ref [seu-project-ref]`

### Passo a Passo

1. **Navegar até a pasta da função:**
   ```bash
   cd supabase/functions/get-valid-token
   ```

2. **Fazer deploy da função:**
   ```bash
   supabase functions deploy get-valid-token
   ```

   Ou a partir da raiz do projeto:
   ```bash
   supabase functions deploy get-valid-token --project-ref [seu-project-ref]
   ```

3. **Configurar variáveis de ambiente no Supabase (OPCIONAL):**

   Acesse o Dashboard do Supabase → Edge Functions → get-valid-token → Settings → Secrets

   Configure as seguintes variáveis (opcionais):
   - `SYSTEM_API_KEY`: API Key customizada do sistema para autenticação adicional (opcional)
     - **Nota:** Se não configurar, a função funcionará sem validação de `x-api-key` (útil para desenvolvimento)
     - **Recomendado para produção:** Configure uma chave segura
   - `CA_CLIENT_ID`: Client ID da Conta Azul (opcional, já tem fallback)
   - `CA_CLIENT_SECRET`: Client Secret da Conta Azul (opcional, já tem fallback)

   **Importante:** 
   - As variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são automaticamente fornecidas pelo Supabase
   - Se você **não configurar** `SYSTEM_API_KEY`, não precisa enviar o header `x-api-key` no n8n
   - Se você **configurar** `SYSTEM_API_KEY`, deve enviar o header `x-api-key` com o mesmo valor

4. **Testar o deploy:**

   Você pode testar usando curl:
   ```bash
   curl -X POST https://[SEU-PROJETO].supabase.co/functions/v1/get-valid-token \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer [SUPABASE_ANON_KEY]" \
     -H "x-api-key: [SYSTEM_API_KEY]" \
     -d '{"tenant_id": "uuid-do-tenant", "platform": "CONTA_AZUL"}'
   ```
   
   **Nota:** O header `x-api-key` é opcional - apenas necessário se você configurou `SYSTEM_API_KEY` no Supabase

### Verificar se a função está deployada

Se receber erro 404 "Requested function was not found", significa que a função não foi deployada. Verifique:

1. Se o deploy foi concluído com sucesso
2. Se o nome da função está correto (`get-valid-token`)
3. Se está usando a URL correta do projeto Supabase

## Endpoint

**URL:** `https://[SEU-PROJETO].supabase.co/functions/v1/get-valid-token`

**Método:** `POST`

**Autenticação:** 
- **Obrigatório:** Header `Authorization: Bearer [anon-key]` OU `apikey: [anon-key]` com a **anon key** do Supabase (necessário para acessar Edge Functions)
- **Opcional:** Header `x-api-key` com a API Key customizada do sistema (apenas se você configurou `SYSTEM_API_KEY` no Supabase)

## Requisição

### Headers Obrigatórios

⚠️ **IMPORTANTE:** O Supabase requer autenticação com a anon key para permitir acesso às Edge Functions. Sem este header, você receberá erro "Missing authorization header" ou "Invalid JWT" (401).

**Opção 1 (Recomendada):** Usar `Authorization: Bearer`
```
Content-Type: application/json
Authorization: Bearer [SUPABASE_ANON_KEY]
x-api-key: [SYSTEM_API_KEY]
```

**Opção 2:** Usar `apikey`
```
Content-Type: application/json
apikey: [SUPABASE_ANON_KEY]
x-api-key: [SYSTEM_API_KEY]
```

**Explicação dos headers:**
- `Authorization: Bearer [anon-key]` OU `apikey: [anon-key]`: **Anon Key do Supabase** (obrigatório) - Permite acesso à Edge Function
- `x-api-key`: **API Key customizada** (opcional) - Apenas necessário se você configurou `SYSTEM_API_KEY` no Supabase
- `Content-Type`: `application/json` (obrigatório)

**Nota sobre `x-api-key`:**
- Se você **não configurou** `SYSTEM_API_KEY` no Supabase, pode **omitir** este header
- Se você **configurou** `SYSTEM_API_KEY` no Supabase, deve enviar este header com o mesmo valor

**Onde encontrar a Anon Key:**
- Dashboard do Supabase → Settings → API → `anon` `public` key

### Body

```json
{
  "tenant_id": "uuid-do-tenant",
  "platform": "CONTA_AZUL"
}
```

### Parâmetros

- `tenant_id` (obrigatório): UUID do tenant/cliente
- `platform` (obrigatório): Deve ser `"CONTA_AZUL"`

## Resposta

### Sucesso (200)

```json
{
  "success": true,
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2025-12-08T20:00:00.000Z"
}
```

### Erros

#### 401 - Não Autorizado
```json
{
  "success": false,
  "error": "Não autorizado. API Key inválida."
}
```

#### 400 - Parâmetros Inválidos
```json
{
  "success": false,
  "error": "tenant_id e platform são obrigatórios"
}
```

#### 400 - Refresh Token Expirado
```json
{
  "success": false,
  "error": "Refresh token não encontrado. É necessário reautenticar."
}
```

#### 404 - Credencial Não Encontrada
```json
{
  "success": false,
  "error": "Credencial não encontrada"
}
```

## Exemplo de Uso no n8n

### 1. Node HTTP Request - Obter Token Válido

**Configuração do Node:**

- **Method:** `POST`
- **URL:** `https://[SEU-PROJETO].supabase.co/functions/v1/get-valid-token`
- **Authentication:** `None` (vamos adicionar headers manualmente)
- **Send Headers:** `true`
- **Headers:**
  - **Name:** `Content-Type`
    - **Value:** `application/json`
  - **Name:** `Authorization` ⚠️ **OBRIGATÓRIO**
    - **Value:** `Bearer {{ $env.SUPABASE_ANON_KEY }}` (anon key do Supabase com prefixo "Bearer ")
    - **Alternativa:** Pode usar `apikey` em vez de `Authorization: Bearer`
  - **Name:** `x-api-key`
    - **Value:** `{{ $env.SYSTEM_API_KEY }}` (ou valor direto da API key)
- **Send Body:** `true`
- **Body Content Type:** `JSON`
- **Body (JSON):**
```json
{
  "tenant_id": "{{ $json.tenant_id }}",
  "platform": "CONTA_AZUL"
}
```

**⚠️ IMPORTANTE:**
- **NÃO** use Query Parameters
- **NÃO** use Authentication genérica
- Use **Body JSON** com os parâmetros
- **OBRIGATÓRIO:** Use header `Authorization: Bearer [anon-key]` OU `apikey: [anon-key]`
- **Opcional:** Use header `x-api-key` apenas se configurou `SYSTEM_API_KEY` no Supabase

#### Configuração Passo a Passo no n8n

1. **Criar novo node HTTP Request**

2. **Configurar Method e URL:**
   - **Method:** `POST`
   - **URL:** `https://[SEU-PROJETO].supabase.co/functions/v1/get-valid-token`
   - Exemplo: `https://lfuzyaqqdygnlnslhrmw.supabase.co/functions/v1/get-valid-token`

3. **Configurar Authentication:**
   - **Authentication:** `None` (não usar genericCredentialType)

4. **Configurar Headers:**
   - Ativar **Send Headers**
   - Adicionar headers (2 obrigatórios + 1 opcional):
     - **Header 1:**
       - **Name:** `Content-Type`
       - **Value:** `application/json`
     - **Header 2:** ⚠️ **OBRIGATÓRIO** (escolha uma das opções abaixo)
       
       **Opção A (Recomendada):**
       - **Name:** `Authorization`
       - **Value:** `Bearer sua-supabase-anon-key-aqui` (ou `Bearer {{ $env.SUPABASE_ANON_KEY }}`)
       - **Nota:** Inclua a palavra "Bearer" seguida de um espaço antes da anon key
       
       **Opção B (Alternativa):**
       - **Name:** `apikey`
       - **Value:** `sua-supabase-anon-key-aqui` (ou `{{ $env.SUPABASE_ANON_KEY }}`)
       
       **Importante:** Esta é a anon key do Supabase, não a API key customizada
     - **Header 3:** (Opcional - apenas se configurou SYSTEM_API_KEY no Supabase)
       - **Name:** `x-api-key`
       - **Value:** `sua-api-key-aqui` (ou `{{ $env.SYSTEM_API_KEY }}` se configurado)
       - **Nota:** Esta é a API key customizada. Se não configurou SYSTEM_API_KEY no Supabase, pode omitir este header

5. **Configurar Body:**
   - Ativar **Send Body**
   - **Body Content Type:** `JSON`
   - **Specify Body:** `Using JSON`
   - **JSON Body:**
   ```json
   {
     "tenant_id": "97292c62-d1cf-481f-a4ab-22271b339e2e",
     "platform": "CONTA_AZUL"
   }
   ```
   
   Ou usando expressões do n8n:
   ```json
   {
     "tenant_id": "{{ $json.tenant_id }}",
     "platform": "CONTA_AZUL"
   }
   ```

6. **NÃO configurar:**
   - ❌ Query Parameters
   - ❌ Authentication genérica
   - ❌ Send Query (deve estar desabilitado)

### 2. Node Set - Extrair Token

Após obter a resposta, extrair o token:

- **Keep Only Set Fields:** Desabilitado
- **Fields to Set:**
  - **Name:** `access_token`
  - **Value:** `{{ $json.access_token }}`

### 3. Node HTTP Request - Usar Token na API Conta Azul

**Configuração do Node:**

- **Method:** `GET` (ou POST, PUT, DELETE conforme necessário)
- **URL:** `https://api.contaazul.com/v1/[endpoint]`
- **Authentication:** Generic Credential Type
- **Headers:**
  - `Authorization`: `Bearer {{ $json.access_token }}`
  - `Content-Type`: `application/json`

## Fluxo Completo Recomendado

```
┌─────────────────┐
│  Trigger Node   │
│  (Webhook/Cron) │
└────────┬─────────┘
         │
         ▼
┌─────────────────────────┐
│  HTTP Request           │
│  get-valid-token        │
│  (obter token válido)   │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│  IF Node                │
│  Verificar success      │
└────────┬────────────────┘
         │
    ┌────┴────┐
    │         │
   Sim       Não
    │         │
    ▼         ▼
┌─────────┐ ┌──────────────────┐
│ Set     │ │ Error Handler    │
│ Token   │ │ (Log erro)       │
└────┬────┘ └──────────────────┘
     │
     ▼
┌─────────────────────────┐
│  HTTP Request           │
│  API Conta Azul         │
│  (usar token)           │
└─────────────────────────┘
```

## Tratamento de Erros

### Token Expirado e Refresh Token Válido

O endpoint renova automaticamente e retorna o novo token. Não é necessário tratamento especial.

### Refresh Token Também Expirado

Quando o refresh_token também está expirado:

1. O endpoint retorna erro 400
2. A credencial é marcada como inativa automaticamente
3. O workflow deve:
   - Registrar o erro
   - Notificar o administrador
   - Interromper o processamento
   - O usuário precisará reautenticar no sistema

### Exemplo de Tratamento de Erro no n8n

Adicione um node **IF** após a chamada `get-valid-token`:

**Condição:**
```
{{ $json.success }} === false
```

**Branch True (Erro):**
- Node **Set** para salvar mensagem de erro
- Node **Send Email** ou **Slack** para notificar
- Node **Stop and Error** para interromper workflow

**Branch False (Sucesso):**
- Continuar com o uso do token

## Variáveis de Ambiente Necessárias

No n8n, configure as seguintes variáveis de ambiente:

- `SUPABASE_ANON_KEY`: **Anon Key do Supabase** (obrigatório) - Encontre em: Dashboard → Settings → API → `anon` `public` key
- `SYSTEM_API_KEY`: API Key customizada do sistema para autenticação no endpoint (opcional, mas recomendado)
- `SUPABASE_PROJECT_URL`: URL do projeto Supabase (opcional, pode ser hardcoded)

## Boas Práticas

1. **Sempre chamar `get-valid-token` antes de usar o token**
   - Não assuma que o token está válido
   - O endpoint é rápido e eficiente

2. **Cache do token dentro do mesmo workflow**
   - Se você precisa fazer múltiplas requisições à API Conta Azul no mesmo workflow
   - Chame `get-valid-token` uma vez no início
   - Reutilize o token nas requisições subsequentes

3. **Tratamento de erros robusto**
   - Sempre verifique `success === true` antes de usar o token
   - Implemente notificações para erros de renovação

4. **Logs e monitoramento**
   - Registre quando tokens são renovados
   - Monitore falhas de renovação

## Exemplo Completo de Workflow

```json
{
  "nodes": [
    {
      "name": "Obter Token Válido",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "POST",
        "url": "https://[PROJETO].supabase.co/functions/v1/get-valid-token",
        "authentication": "none",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "application/json"
            },
            {
              "name": "Authorization",
              "value": "Bearer {{ $env.SUPABASE_ANON_KEY }}"
            },
            {
              "name": "x-api-key",
              "value": "={{ $env.SYSTEM_API_KEY }}"
            }
          ]
        },
        "sendBody": true,
        "bodyContentType": "json",
        "jsonBody": "={{ JSON.stringify({ tenant_id: $json.tenant_id, platform: 'CONTA_AZUL' }) }}"
      }
    },
    {
      "name": "Verificar Sucesso",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "boolean": [
            {
              "value1": "={{ $json.success }}",
              "value2": true
            }
          ]
        }
      }
    },
    {
      "name": "Usar Token na API",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "https://api.contaazul.com/v1/lancamentos",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Authorization",
              "value": "Bearer {{ $('Obter Token Válido').item.json.access_token }}"
            }
          ]
        }
      }
    }
  ]
}
```

## Troubleshooting

### Erro: "Requested function was not found" (404)

**Causa:** A Edge Function não foi deployada no Supabase.

**Solução:**
1. Faça o deploy da função usando Supabase CLI:
   ```bash
   supabase functions deploy get-valid-token
   ```
2. Verifique se o nome da função está correto
3. Verifique se está usando a URL correta do projeto Supabase

### Erro: "Missing authorization header" ou "Invalid JWT" (401)

**Causa:** Falta o header de autenticação com a anon key do Supabase.

**Solução:**
1. Adicione o header `Authorization: Bearer [anon-key]` OU `apikey: [anon-key]`
2. Se usar `Authorization`, **não esqueça** de incluir "Bearer " (com espaço) antes da anon key
3. Encontre a anon key em: Dashboard do Supabase → Settings → API → `anon` `public` key
4. Configure a variável de ambiente `SUPABASE_ANON_KEY` no n8n
5. Verifique se o header está sendo enviado corretamente:
   - Deve ser `Authorization` com valor `Bearer [anon-key]` OU
   - Deve ser `apikey` com valor `[anon-key]`
   - **NÃO** é o header `x-api-key` (esse é diferente)

### Erro: "Refresh token não encontrado. É necessário reautenticar."

**Causa:** O token de acesso expirou e não há `refresh_token` salvo no banco de dados para renovar automaticamente.

**Solução:**
1. Acesse a aplicação web e configure as credenciais da Conta Azul novamente
2. Durante a autenticação OAuth, o sistema salvará tanto o `access_token` quanto o `refresh_token`
3. Após reautenticar, o n8n poderá renovar tokens automaticamente quando necessário

**Verificações:**
- Verifique se o tenant tem credenciais da Conta Azul configuradas
- Verifique se as credenciais estão ativas (`is_active = true`)
- Se o problema persistir, pode ser necessário limpar as credenciais antigas e reautenticar

### Erro: "Credencial não encontrada"

**Causa:** O tenant não tem credenciais da Conta Azul configuradas no banco de dados.

**Solução:**
1. Acesse a aplicação web
2. Navegue até a página de Credenciais
3. Configure as credenciais da Conta Azul para o tenant
4. Complete o fluxo OAuth para salvar os tokens

### Erro: "Credencial está inativa"

**Causa:** As credenciais da Conta Azul foram marcadas como inativas (provavelmente após falha em renovação).

**Solução:**
1. Acesse a aplicação web
2. Reautentique na Conta Azul
3. Isso reativará as credenciais automaticamente

### Erro: "Não autorizado. API Key inválida."

**Causa:** Você configurou `SYSTEM_API_KEY` no Supabase, mas o header `x-api-key` não está sendo enviado ou está incorreto.

**Solução:**
1. **Opção A (Recomendada para desenvolvimento):** Remova a variável `SYSTEM_API_KEY` do Supabase
   - Acesse: Dashboard → Edge Functions → get-valid-token → Settings → Secrets
   - Remova ou deixe vazia a variável `SYSTEM_API_KEY`
   - Não envie o header `x-api-key` no n8n

2. **Opção B (Para produção):** Configure corretamente
   - Verifique se o header `x-api-key` está sendo enviado corretamente no n8n
   - Verifique se a variável de ambiente `SYSTEM_API_KEY` está configurada no Supabase (Edge Function Settings → Secrets)
   - Verifique se está usando a mesma API Key no n8n e no Supabase
   - O valor deve ser exatamente igual em ambos os lugares

### Erro: "Credencial não encontrada para tenant X e plataforma Y"

**Causa:** O tenant não tem credenciais da Conta Azul configuradas no banco de dados.

**Solução:**
1. Verifique se o `tenant_id` está correto no body da requisição
2. Acesse a aplicação web e configure as credenciais da Conta Azul para esse tenant
3. Complete o fluxo OAuth para salvar os tokens no banco

**Verificações:**
- Confirme que o tenant existe na tabela `tenants`
- Confirme que existe um registro na tabela `tenant_credentials` com `platform = 'CONTA_AZUL'` para esse tenant

### Erro: "Refresh token não encontrado. O token expirou e não há refresh_token salvo."

**Causa:** O token de acesso expirou e não há `refresh_token` salvo no banco de dados para renovar automaticamente.

**Possíveis causas:**
1. As credenciais foram criadas sem `refresh_token` (autenticação antiga)
2. O `refresh_token` foi removido ou nunca foi salvo
3. As credenciais precisam ser reautenticadas

**Solução:**
1. Acesse a aplicação web
2. Navegue até a página de Credenciais
3. Reautentique na Conta Azul (isso salvará tanto `access_token` quanto `refresh_token`)
4. Após reautenticar, o n8n poderá renovar tokens automaticamente quando necessário

**Prevenção:**
- Sempre complete o fluxo OAuth completo ao configurar credenciais
- O sistema salva automaticamente o `refresh_token` durante a autenticação OAuth
- Verifique se as credenciais estão ativas (`is_active = true`)

### Erro: "Credencial está inativa. É necessário reautenticar na Conta Azul."

**Causa:** As credenciais foram marcadas como inativas (provavelmente após múltiplas falhas em renovação).

**Solução:**
1. Acesse a aplicação web
2. Reautentique na Conta Azul
3. Isso reativará as credenciais automaticamente (`is_active = true`)

## Segurança

- A API Key deve ser mantida segura e não exposta em logs
- Use variáveis de ambiente do n8n para armazenar a API Key
- O endpoint valida a API Key antes de processar qualquer requisição
- Tokens são retornados apenas para requisições autenticadas

## Suporte

Para questões ou problemas com a renovação de tokens, consulte:
- Documentação da API Conta Azul: https://developers.contaazul.com/
- Logs do Supabase Edge Function
- Logs do workflow n8n

