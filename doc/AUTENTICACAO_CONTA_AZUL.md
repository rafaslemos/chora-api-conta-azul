# Processo de Autenticação Conta Azul

## Visão Geral

O processo de autenticação utiliza OAuth 2.0 Authorization Code Flow, garantindo segurança ao manter o Client Secret apenas no servidor (Edge Function). O Client ID agora é obtido do banco de dados, permitindo configuração centralizada.

## Fluxo Completo

```mermaid
sequenceDiagram
    participant User as Usuário
    participant Frontend as Frontend (React)
    participant ConfigService as configService
    participant DB as Banco de Dados
    participant CA as Conta Azul OAuth
    participant EdgeFn as Edge Function
    participant CA_API as API Conta Azul

    User->>Frontend: Clica em "Adicionar Credencial"
    Frontend->>Frontend: Solicita nome da credencial
    User->>Frontend: Informa nome (ex: "Matriz SP")
    
    Frontend->>ConfigService: getContaAzulClientId()
    ConfigService->>DB: RPC: app_core.get_conta_azul_client_id()
    DB-->>ConfigService: Client ID (ou null)
    ConfigService-->>Frontend: Client ID (com fallback para env/valor padrão)
    
    Frontend->>Frontend: Gera CSRF token (UUID)
    Frontend->>Frontend: Codifica state (CSRF + tenantId + credentialName)
    Frontend->>Frontend: Salva state no localStorage
    
    Frontend->>CA: Redireciona para OAuth<br/>GET /login?client_id=...&redirect_uri=...&state=...
    CA->>User: Exibe tela de login
    User->>CA: Informa credenciais Conta Azul
    CA->>CA: Valida credenciais
    CA->>Frontend: Redireciona para callback<br/>GET /auth/conta-azul/callback?code=...&state=...
    
    Frontend->>Frontend: ContaAzulCallback processa
    Frontend->>Frontend: Valida state (CSRF)
    Frontend->>Frontend: Decodifica state (extrai tenantId + credentialName)
    
    Frontend->>EdgeFn: POST /exchange-conta-azul-token<br/>{code, redirect_uri, tenant_id, credential_name}
    
    EdgeFn->>DB: RPC: app_core.get_conta_azul_client_id()
    DB-->>EdgeFn: Client ID
    EdgeFn->>DB: RPC: app_core.get_conta_azul_client_secret()
    DB-->>EdgeFn: Client Secret (descriptografado)
    
    Note over EdgeFn: Fallback para env vars se não encontrar no banco
    
    EdgeFn->>CA_API: POST /oauth2/token<br/>Authorization: Basic (client_id:secret)<br/>{code, grant_type, redirect_uri}
    CA_API-->>EdgeFn: {access_token, refresh_token, expires_in}
    
    EdgeFn->>DB: RPC: app_core.create_tenant_credential()<br/>(tokens são criptografados automaticamente)
    DB-->>EdgeFn: {credential_id, credential_name}
    
    EdgeFn->>DB: RPC: app_core.create_audit_log()<br/>(registra criação da credencial)
    
    EdgeFn-->>Frontend: {success: true, credential_id, credential_name}
    
    Frontend->>Frontend: Exibe mensagem de sucesso
    Frontend->>Frontend: Redireciona para /credentials
```

## Componentes Envolvidos

### 1. Frontend - Inicialização (`services/contaAzulAuthService.ts`)

**Método:** `initiateAuth(tenantId, credentialName)`

**O que faz:**
1. Busca Client ID do banco via `getContaAzulClientId()` (com fallback)
2. Gera token CSRF (UUID)
3. Codifica state: `{csrf, tenantId, credentialName}` → Base64
4. Salva state no `localStorage` para validação posterior
5. Redireciona para Conta Azul OAuth com parâmetros:
   - `client_id`: Client ID obtido do banco
   - `redirect_uri`: URL de callback (normalizada, sem hash)
   - `state`: State codificado
   - `scope`: `openid profile aws.cognito.signin.user.admin`

**Arquivo:** `services/contaAzulAuthService.ts` (linhas 96-132)

### 2. Frontend - Callback (`pages/ContaAzulCallback.tsx`)

**O que faz:**
1. Captura parâmetros OAuth da URL (`code`, `state`, `error`)
2. Valida state CSRF (compara com `localStorage`)
3. Decodifica state para extrair `tenantId` e `credentialName`
4. Chama Edge Function para trocar code por tokens
5. Exibe resultado (sucesso/erro) e redireciona

**Arquivo:** `pages/ContaAzulCallback.tsx` (linhas 35-185)

### 3. Edge Function - Troca de Tokens (`supabase/functions/exchange-conta-azul-token/index.ts`)

**O que faz:**
1. Valida parâmetros recebidos (`code`, `redirect_uri`, `tenant_id`, `credential_name`)
2. **Valida tenant:** Verifica se tenant existe e está ativo (`status = 'ACTIVE'`)
3. Busca Client ID e Client Secret do banco:
   - `app_core.get_conta_azul_client_id()` → Client ID (público)
   - `app_core.get_conta_azul_client_secret()` → Client Secret (criptografado, descriptografado automaticamente)
4. Fallback para variáveis de ambiente se não encontrar no banco
5. Troca authorization code por tokens na API Conta Azul:
   - `POST https://auth.contaazul.com/oauth2/token`
   - Authorization: Basic (client_id:client_secret)
6. Salva credenciais no banco via RPC:
   - `app_core.create_tenant_credential()`
   - Tokens são criptografados automaticamente
   - **Reativa credencial automaticamente:** Se credencial já existia e estava inativa, é reativada (`is_active = true`, `revoked_at = NULL`)
7. Cria log de auditoria
8. Retorna sucesso (sem expor tokens)

**Arquivo:** `supabase/functions/exchange-conta-azul-token/index.ts`

### 4. Edge Function - Obter Token Válido (`supabase/functions/get-valid-token/index.ts`)

**O que faz:**
1. Recebe `credential_id` na requisição
2. Busca credencial descriptografada via RPC `app_core.get_tenant_credential_decrypted()`
3. Busca Client ID/Secret do banco (com fallback para env vars)
4. **Sempre renova o token** (independente de estar válido) para evitar problemas de estourar 1h
5. Se refresh token for inválido:
   - Marca credencial como inativa (`is_active = false`)
   - Retorna flag `needs_reauth: true`
   - Inclui `credential_id` e `credential_name` na resposta
   - Cria log de auditoria
6. Se renovação bem-sucedida:
   - Atualiza tokens no banco
   - Retorna novo access_token com 1h de validade

**Arquivo:** `supabase/functions/get-valid-token/index.ts`

### 5. Edge Function - Webhook de Revogação (`supabase/functions/conta-azul-webhook/index.ts`)

**O que faz:**
1. Recebe webhook da Conta Azul quando token é revogado
2. Valida webhook secret (se configurado)
3. Identifica credencial via `credential_id` ou `tenant_id`
4. Chama função RPC `app_core.revoke_tenant_credential()` para revogar
5. Atualiza `revoked_at` e `is_active = false`
6. Cria log de auditoria
7. Retorna sucesso (idempotente se já estava revogada)

**Arquivo:** `supabase/functions/conta-azul-webhook/index.ts`

## Como Renovar e Usar o Access Token

### Passo a Passo

Após salvar os tokens inicialmente via `exchange-conta-azul-token`, você pode renovar o access token usando o refresh token através da Edge Function `get-valid-token`.

#### 1. Chamar a Edge Function para Renovar Token

**Endpoint:** `POST https://seu-projeto.supabase.co/functions/v1/get-valid-token`

**Headers:**
```json
{
  "Authorization": "Bearer SEU_SERVICE_ROLE_KEY",
  "Content-Type": "application/json"
}
```

**Body:**
```json
{
  "credential_id": "uuid-da-credencial"
}
```

**Exemplo com cURL:**
```bash
curl -X POST \
  'https://seu-projeto.supabase.co/functions/v1/get-valid-token' \
  -H 'Authorization: Bearer SEU_SERVICE_ROLE_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "credential_id": "123e4567-e89b-12d3-a456-426614174000"
  }'
```

#### 2. Resposta de Sucesso

Quando o refresh token é válido e a renovação é bem-sucedida:

```json
{
  "success": true,
  "credential_id": "123e4567-e89b-12d3-a456-426614174000",
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_at": "2026-01-27T15:30:00.000Z",
  "expires_in": 3600
}
```

**Campos importantes:**
- `access_token`: Token de acesso válido por 1 hora
- `expires_at`: Data/hora de expiração em ISO 8601
- `expires_in`: Tempo de validade em segundos (geralmente 3600 = 1 hora)

#### 3. Usar o Access Token

Use o `access_token` retornado para fazer requisições à API da Conta Azul:

```bash
curl -X GET \
  'https://api.contaazul.com/v1/sales' \
  -H 'Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...'
```

#### 4. Quando Reautenticar

Se o refresh token expirou ou foi revogado, a resposta será:

```json
{
  "success": false,
  "needs_reauth": true,
  "credential_id": "123e4567-e89b-12d3-a456-426614174000",
  "credential_name": "Matriz SP",
  "error": "Credencial precisa ser reautenticada. Acesse a aplicação web para reautenticar.",
  "details": "Refresh token inválido ou expirado (status: 401)"
}
```

**O que acontece:**
- A credencial é marcada como inativa (`is_active = false`)
- Um log de auditoria é criado automaticamente
- Você precisa iniciar o fluxo OAuth novamente via `exchange-conta-azul-token`

**Nota:** A Edge Function sempre renova o token quando solicitado (independente de estar válido), garantindo que você sempre receba um token com tempo máximo de validade (1 hora).

### 4. Banco de Dados - Armazenamento

**Tabela:** `app_core.tenant_credentials`

**Campos importantes:**
- `tenant_id`: ID do cliente
- `credential_name`: Nome amigável (ex: "Matriz SP")
- `access_token`: Token de acesso (criptografado)
- `refresh_token`: Token de refresh (criptografado)
- `token_expires_at`: Data de expiração
- `is_active`: Se a credencial está ativa
- `revoked_at`: Data em que a credencial foi revogada (NULL = ativa)
- `last_authenticated_at`: Última autenticação bem-sucedida

**Segurança:**
- Tokens são criptografados automaticamente via função RPC
- RLS garante isolamento por tenant
- Apenas parceiros podem ver credenciais de seus tenants

## Configurações Necessárias

### 1. Client ID e Client Secret

**Onde são salvos:**
- **Banco de dados:** `app_core.app_config` (salvos automaticamente durante setup)
  - `conta_azul_client_id` (não criptografado - público)
  - `conta_azul_client_secret` (criptografado)

**Como são obtidos:**
- **Frontend:** Via `configService.getContaAzulClientId()` → RPC `app_core.get_conta_azul_client_id()`
- **Edge Function:** Via RPC `app_core.get_conta_azul_client_id()` e `app_core.get_conta_azul_client_secret()`

**Fallback:**
- Se não encontrar no banco, usa variáveis de ambiente:
  - Frontend: `VITE_CONTA_AZUL_CLIENT_ID` ou valor padrão
  - Edge Function: `CA_CLIENT_ID`/`CA_CLIENT_SECRET` ou `CONTA_AZUL_CLIENT_ID`/`CONTA_AZUL_CLIENT_SECRET` (ambas as convenções são aceitas)

### 2. Redirect URI

**Formato:**
- **Produção:** `https://seu-dominio.com/auth/conta-azul/callback`
- **Desenvolvimento:** `http://localhost:5173/auth/conta-azul/callback`

**⚠️ IMPORTANTE:**
- Deve estar cadastrado EXATAMENTE IGUAL no app da Conta Azul
- NÃO usar hash (`#`) na URL
- URL é normalizada (remove trailing slash) para garantir consistência

**Configuração:**
- Variável de ambiente: `VITE_CONTA_AZUL_REDIRECT_URI`
- Fallback: `${window.location.origin}/auth/conta-azul/callback`

## Segurança

### Proteções Implementadas

1. **CSRF Protection:**
   - State token gerado com UUID
   - Validado no callback antes de trocar tokens

2. **Client Secret Seguro:**
   - Nunca exposto no frontend
   - Armazenado criptografado no banco
   - Apenas Edge Function (server-side) acessa

3. **Tokens Criptografados:**
   - Access tokens e refresh tokens são criptografados no banco
   - Criptografia automática via função RPC

4. **Isolamento por Tenant:**
   - RLS garante que parceiros vejam apenas suas credenciais
   - Validação de tenant_id antes de salvar

5. **Auditoria:**
   - Log de todas as criações de credenciais
   - Log de falhas de refresh token
   - Log de revogações via webhook
   - Rastreabilidade completa

6. **Validação de Tenant:**
   - Tenant é validado antes de criar credencial
   - Apenas tenants ativos (`status = 'ACTIVE'`) podem criar credenciais
   - Previne criação de credenciais para tenants inválidos

## Como Verificar Criptografia no Banco

### Entendendo a Criptografia Automática

Todos os tokens (`access_token`, `refresh_token`, `api_key`, `api_secret`) são **criptografados automaticamente** quando salvos no banco de dados através das funções RPC:

- `app_core.create_tenant_credential()` - criptografa ao criar
- `app_core.update_tenant_credential()` - criptografa ao atualizar

A criptografia usa **AES** com chave obtida via `app_core.get_encryption_key()` e o resultado é codificado em **base64** antes de ser salvo na tabela `app_core.tenant_credentials`.

### Verificação no Banco de Dados

#### 1. Verificar que Tokens Estão Criptografados

Execute esta query para verificar que os tokens não estão em texto plano:

```sql
-- Verificar formato dos tokens salvos (devem estar em base64, não texto plano)
SELECT 
    id,
    credential_name,
    -- access_token deve ser uma string base64 (não começa com "eyJ" que é JWT em texto plano)
    CASE 
        WHEN access_token IS NULL THEN 'NULL'
        WHEN access_token LIKE 'eyJ%' THEN '⚠️ PROVAVELMENTE NÃO CRIPTOGRAFADO (JWT em texto plano)'
        WHEN access_token ~ '^[A-Za-z0-9+/=]+$' THEN '✅ CRIPTOGRAFADO (base64)'
        ELSE '❓ FORMATO DESCONHECIDO'
    END as access_token_status,
    -- refresh_token deve ser uma string base64
    CASE 
        WHEN refresh_token IS NULL THEN 'NULL'
        WHEN refresh_token LIKE 'eyJ%' THEN '⚠️ PROVAVELMENTE NÃO CRIPTOGRAFADO (JWT em texto plano)'
        WHEN refresh_token ~ '^[A-Za-z0-9+/=]+$' THEN '✅ CRIPTOGRAFADO (base64)'
        ELSE '❓ FORMATO DESCONHECIDO'
    END as refresh_token_status,
    token_expires_at,
    is_active
FROM app_core.tenant_credentials
WHERE platform = 'CONTA_AZUL'
ORDER BY created_at DESC;
```

**Resultado esperado:**
- `access_token_status` e `refresh_token_status` devem mostrar `✅ CRIPTOGRAFADO (base64)`
- Se aparecer `⚠️ PROVAVELMENTE NÃO CRIPTOGRAFADO`, os dados não foram salvos via RPC ou houve algum problema

#### 2. Verificar Descriptografia Funciona

Para verificar que a descriptografia funciona corretamente, use a função RPC `get_tenant_credential_decrypted`:

```sql
-- ⚠️ ATENÇÃO: Esta função requer permissões de ADMIN ou Service Role
-- Não execute em produção sem necessidade

-- Obter credencial descriptografada (apenas para verificação)
SELECT * FROM app_core.get_tenant_credential_decrypted(
    '123e4567-e89b-12d3-a456-426614174000'::uuid  -- substitua pelo credential_id real
);
```

**O que verificar:**
- `access_token` e `refresh_token` devem retornar tokens JWT válidos (começam com `eyJ`)
- Se retornar NULL ou erro, a criptografia/descriptografia pode estar com problema

#### 3. Verificar Chave de Criptografia

A chave de criptografia é obtida via `app_core.get_encryption_key()`:

```sql
-- Verificar se a chave de criptografia está configurada
SELECT app_core.get_encryption_key() as encryption_key_source;

-- Verificar configuração no PostgreSQL (se configurada via GUC)
SHOW app.settings.encryption_key;
```

**Nota:** Em produção, a chave deve vir do Supabase Vault ou variável de ambiente `app.settings.encryption_key`. A chave padrão (`default_key_change_in_production`) **NÃO deve ser usada em produção**.

#### 4. Verificar Criptografia de Configurações Globais

As configurações em `app_core.app_config` também podem estar criptografadas:

```sql
-- Verificar quais configurações estão criptografadas
SELECT 
    config_key,
    CASE 
        WHEN is_encrypted THEN '✅ CRIPTOGRAFADO'
        ELSE '❌ NÃO CRIPTOGRAFADO'
    END as encryption_status,
    -- Valor não descriptografado (será base64 se criptografado)
    LEFT(config_value, 50) || '...' as value_preview
FROM app_core.app_config
WHERE config_key IN ('conta_azul_client_secret', 'system_api_key')
ORDER BY config_key;
```

**Resultado esperado:**
- `conta_azul_client_secret` deve estar com `is_encrypted = true`
- `system_api_key` deve estar com `is_encrypted = true` (se configurado)

### Resumo da Criptografia

**Onde ocorre:**
- ✅ `tenant_credentials.access_token` - criptografado via RPC
- ✅ `tenant_credentials.refresh_token` - criptografado via RPC
- ✅ `tenant_credentials.api_key` - criptografado via RPC (se usado)
- ✅ `tenant_credentials.api_secret` - criptografado via RPC (se usado)
- ✅ `app_config.conta_azul_client_secret` - criptografado via `set_app_config()`
- ✅ `app_config.system_api_key` - criptografado via `set_app_config()`

**Como funciona:**
1. Ao salvar via RPC (`create_tenant_credential` ou `update_tenant_credential`), os tokens são criptografados automaticamente
2. A função `encrypt_token()` usa AES com a chave obtida via `get_encryption_key()`
3. O resultado é codificado em base64 antes de salvar
4. Para usar os tokens, chame `get_tenant_credential_decrypted()` que descriptografa automaticamente
5. **Nunca** acesse diretamente `tenant_credentials.access_token` - sempre use a função RPC de descriptografia

**Segurança:**
- Tokens nunca são expostos em texto plano no banco
- Apenas funções RPC com `SECURITY DEFINER` podem descriptografar
- RLS garante isolamento por tenant mesmo após descriptografia

## Múltiplas Credenciais por Tenant

O sistema suporta múltiplas credenciais Conta Azul por tenant, cada uma com um nome amigável:

- **Exemplo:** Um tenant pode ter:
  - "Matriz SP" (credencial principal)
  - "Filial RJ" (credencial secundária)
  - "Filial MG" (credencial terciária)

**Validação:**
- Nome deve ser único por tenant (constraint no banco)
- Nome é obrigatório ao criar credencial

## Fluxo de Erros

### Erros Comuns

1. **Client ID não encontrado:**
   - Frontend: Usa fallback (env var ou valor padrão)
   - Edge Function: Retorna erro 500 se não encontrar no banco nem env vars

2. **State inválido:**
   - Callback valida state antes de processar
   - Retorna erro de segurança se state não corresponder

3. **Nome duplicado:**
   - Edge Function detecta constraint violation
   - Retorna erro específico: "Já existe uma credencial com o nome..."

4. **Erro na API Conta Azul:**
   - Edge Function captura erro da API
   - Retorna erro genérico (não expõe detalhes sensíveis)

5. **Refresh Token Inválido:**
   - `get-valid-token` retorna `needs_reauth: true`
   - Inclui `credential_id` e `credential_name` na resposta
   - Credencial é marcada como inativa automaticamente
   - Frontend pode detectar e mostrar aviso de reautenticação

6. **Tenant Inválido:**
   - `exchange-conta-azul-token` valida tenant antes de criar credencial
   - Retorna erro 404 se tenant não encontrado
   - Retorna erro 403 se tenant está inativo ou suspenso

## Melhorias Recentes

### ✅ Client ID do Banco de Dados

**Antes:**
- Client ID hardcoded no frontend
- Client Secret em variáveis de ambiente (Edge Functions)

**Agora:**
- Client ID buscado do banco via `configService`
- Client Secret buscado do banco via Edge Function
- Fallback para env vars durante transição
- Configuração centralizada e atualizável sem redeploy

### ✅ Cache de Client ID

- Client ID é cacheado no frontend (5 minutos TTL)
- Evita múltiplas queries desnecessárias
- Cache pode ser limpo manualmente se necessário

## Melhorias Implementadas

### ✅ Refresh Token Sempre Renovado

**Comportamento:**
- Token sempre é renovado quando solicitado (independente de estar válido)
- Evita problemas de token próximo de expirar durante uso
- Client ID/Secret obtidos do banco de dados (com fallback para env vars)

**Benefícios:**
- Sempre retorna token com tempo máximo de validade (1h)
- Configuração centralizada no banco de dados
- Não precisa verificar expiração antes de renovar

### ✅ Tratamento de Reautenticação

**Quando refresh token é inválido:**
- Credencial é marcada como inativa (`is_active = false`)
- Resposta inclui flag `needs_reauth: true`
- Inclui `credential_id` e `credential_name` para facilitar identificação
- Mensagem clara: "Credencial precisa ser reautenticada"
- Log de auditoria criado automaticamente

**Quando credencial é reautenticada:**
- Credencial é automaticamente reativada (`is_active = true`)
- Campo `revoked_at` é limpo (NULL)
- `last_authenticated_at` é atualizado
- Não precisa intervenção manual

### ✅ Validação de Tenant

**Implementação:**
- Tenant é validado antes de criar credencial
- Verifica se tenant existe na tabela `app_core.tenants`
- Verifica se tenant está ativo (`status = 'ACTIVE'`)
- Retorna erro 404 se tenant não encontrado
- Retorna erro 403 se tenant está inativo ou suspenso

**Benefícios:**
- Segurança: Previne criação de credenciais para tenants inválidos
- Código mais limpo: Remove código morto
- Melhor tratamento de erros

### ✅ Webhook de Revogação

**Funcionalidade:**
- Recebe webhooks da Conta Azul quando tokens são revogados
- Valida webhook secret (se configurado)
- Identifica credencial via `credential_id` ou `tenant_id`
- Chama função RPC `app_core.revoke_tenant_credential()` para revogar
- Atualiza `revoked_at` e `is_active = false`
- Cria log de auditoria
- Idempotente (não erro se já estava revogada)

**Configuração:**
- Edge Function: `conta-azul-webhook`
- Variável de ambiente opcional: `WEBHOOK_SECRET`
- Header de autenticação: `x-webhook-secret`

## Funções RPC Disponíveis

### `app_core.revoke_tenant_credential(p_credential_id UUID, p_reason TEXT)`

Revoga uma credencial, marcando-a como revogada e inativa.

**Parâmetros:**
- `p_credential_id`: ID da credencial a ser revogada
- `p_reason`: Motivo da revogação (opcional)

**Retorna:**
- Dados da credencial revogada (id, tenant_id, platform, credential_name, is_active, revoked_at, updated_at)

**Comportamento:**
- Marca `revoked_at = NOW()` e `is_active = FALSE`
- Atualiza status de conexão do tenant (verifica se há outras credenciais ativas)
- Cria log de auditoria automaticamente
