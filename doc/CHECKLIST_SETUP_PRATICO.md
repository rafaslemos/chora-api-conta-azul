# Checklist Prático - Setup Completo

Guia passo a passo para configurar o ambiente do zero até o primeiro login.

Este guia cobre dois cenários:
- **Desenvolvimento Local** (rodar na sua máquina)
- **Deploy via Vercel** (sem precisar rodar localmente)

---

## Escolha seu cenário

| Cenário | Quando usar |
|---------|-------------|
| [Setup Local](#setup-local-desenvolvimento) | Desenvolvimento, debug, testes |
| [Setup Vercel](#setup-via-vercel-produção) | Deploy rápido, sem rodar local |

---

# Setup Local (Desenvolvimento)

---

## FASE 1: Criar Projeto Supabase

1. Acesse [app.supabase.com](https://app.supabase.com/) e faça login
2. Clique em **New Project**
3. Preencha:
   - **Name**: `contaazul-api` (ou outro nome)
   - **Database Password**: Anote em local seguro (será usado no setup)
   - **Region**: South America (São Paulo) ou mais próxima
4. Aguarde criação (2-5 minutos)
5. Vá em **Settings > API** e copie:
   - `Project URL` (ex: `https://xxxxx.supabase.co`)
   - `anon public` key
   - `service_role` key (manter em segredo)

**Saída esperada:** 3 valores anotados (URL, anon key, service role key) + senha do banco

---

## FASE 2: Deploy das Edge Functions de Setup

Antes de executar o setup pelo app, as Edge Functions precisam estar deployadas.

> **Arquitetura:** O setup usa 4 funções modulares executadas em 3 fases:
> - [`setup-config`](../supabase/functions/setup-config/index.ts) - Orquestrador principal (~300 linhas)
> - [`run-migrations`](../supabase/functions/run-migrations/index.ts) - **Fase 1**: Estrutura base (schemas, app_core)
> - [`run-migrations-integrations`](../supabase/functions/run-migrations-integrations/index.ts) - **Fase 2**: Tabelas de integração
> - [`run-migrations-dw`](../supabase/functions/run-migrations-dw/index.ts) - **Fase 3**: Data Warehouse

### 2.1 Instalar Supabase CLI

> **Nota:** O comando `npm install -g supabase` **não é mais suportado**. Use uma das opções abaixo.

#### Windows (Scoop - recomendado)

```powershell
# Instalar Scoop (se não tiver)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression

# Instalar Supabase CLI
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

#### Windows (Alternativa - npx sem instalar)

Se não quiser instalar globalmente, use `npx` antes de cada comando:
```bash
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase functions deploy setup-config --no-verify-jwt
npx supabase functions deploy run-migrations --no-verify-jwt
npx supabase functions deploy run-migrations-integrations --no-verify-jwt
npx supabase functions deploy run-migrations-dw --no-verify-jwt
```

#### macOS (Homebrew)

```bash
brew install supabase/tap/supabase
```

#### Linux

```bash
# Via Homebrew
brew install supabase/tap/supabase

# Ou download direto
# https://github.com/supabase/cli/releases
```

### 2.2 Login e Deploy

1. Faça login:
   ```bash
   supabase login
   ```
2. Vincule ao projeto (use o Project Reference do Dashboard - parte da URL antes de `.supabase.co`):
   ```bash
   supabase link --project-ref SEU_PROJECT_REF
   ```
3. Deploy de TODAS as Edge Functions de setup (4 funções):
   ```bash
   # Orquestrador principal
   supabase functions deploy setup-config --no-verify-jwt
   
   # Fase 1: Estrutura base
   supabase functions deploy run-migrations --no-verify-jwt
   
   # Fase 2: Integrations (entidades Conta Azul, financeiro, vendas)
   supabase functions deploy run-migrations-integrations --no-verify-jwt
   
   # Fase 3: Data Warehouse (dimensões, fatos, calendário)
   supabase functions deploy run-migrations-dw --no-verify-jwt
   ```

### 2.3 Desativar Verify JWT (OBRIGATÓRIO)

No Supabase Dashboard:
1. Vá em **Edge Functions**
2. Para CADA uma das 4 funções abaixo:
   - `setup-config`
   - `run-migrations`
   - `run-migrations-integrations`
   - `run-migrations-dw`
3. Clique na função e desative **"Verify JWT"**

> **Por que?** Essas funções são chamadas antes do usuário estar autenticado, então não podem exigir JWT.

**Saída esperada:** 4 funções deployadas com "Verify JWT" desativado

---

## FASE 3: Obter Credenciais da Conta Azul

1. Acesse o [Portal de Desenvolvedores Conta Azul](https://developers.contaazul.com/)
2. Vá em sua aplicação (ou crie uma nova)
3. Copie:
   - `Client ID`
   - `Client Secret`
4. Configure a **Redirect URI** no portal:
   - Desenvolvimento: `http://localhost:5173/auth/conta-azul/callback`
   - Produção: `https://seu-dominio.com/auth/conta-azul/callback`

**Saída esperada:** Client ID e Client Secret anotados + Redirect URI configurada

---

## FASE 4: Executar Setup no App

1. Inicie o app:
   ```bash
   npm run dev
   ```
2. Acesse `http://localhost:5173` (será redirecionado para `/setup`)
3. Preencha o formulário:

| Campo | Valor | Obrigatório |
|-------|-------|-------------|
| Supabase URL | `https://xxxxx.supabase.co` | Sim |
| Supabase Anon Key | Chave `anon public` | Sim |
| Service Role Key | Chave `service_role` | Sim |
| Database Password | Senha do PostgreSQL | **Recomendado** |
| Conta Azul Client ID | Client ID do portal | Sim |
| Conta Azul Client Secret | Client Secret do portal | Sim |
| System API Key | Gerada automaticamente | Sim (copie antes de enviar) |

4. Clique em **Executar Setup**
5. Aguarde processamento (pode levar 30-60 segundos com todas as migrations)

**Saída esperada:** Mensagem verde "Setup concluído com sucesso!"

---

## FASE 5: Configurações Manuais Pós-Setup

### 5.1 Expor Schema (OBRIGATÓRIO)

1. Vá em **Settings > API > Exposed Schemas** no Supabase Dashboard
2. Marque: `app_core` (obrigatório)
3. Opcionalmente marque: `dw`
4. **NÃO** marque: `integrations` e `integrations_conta_azul`
5. Salve

### 5.2 Deploy das Demais Edge Functions

> **Documentação completa:** [`supabase/functions/README.md`](../supabase/functions/README.md)

```bash
# Funções de autenticação Conta Azul
supabase functions deploy exchange-conta-azul-token
supabase functions deploy get-conta-azul-token
supabase functions deploy get-valid-token

# Funções de dados Conta Azul
supabase functions deploy get-conta-azul-accounts
supabase functions deploy get-conta-azul-categories
supabase functions deploy validate-conta-azul-account

# Funções de integração
supabase functions deploy conta-azul-webhook
supabase functions deploy dw-api
```

> **Nota:** Se não instalou o CLI globalmente, use `npx supabase functions deploy ...`

#### Lista completa de Edge Functions

**Funções de Setup (executadas em sequência pelo setup-config):**

| Função | Fase | Descrição | Código |
|--------|------|-----------|--------|
| `setup-config` | - | Orquestrador principal | [index.ts](../supabase/functions/setup-config/index.ts) |
| `run-migrations` | 1 | Estrutura base (schemas, app_core, RLS, app_config). Inclui **007_profile_rpc** (`app_core.create_or_update_profile`), usada no cadastro de usuários. | [index.ts](../supabase/functions/run-migrations/index.ts) |
| `run-migrations-integrations` | 2 | Tabelas de integração Conta Azul | [index.ts](../supabase/functions/run-migrations-integrations/index.ts) |
| `run-migrations-dw` | 3 | Data Warehouse (dimensões, fatos) | [index.ts](../supabase/functions/run-migrations-dw/index.ts) |

**Funções de Operação:**

| Função | Descrição | Código |
|--------|-----------|--------|
| `exchange-conta-azul-token` | Troca código OAuth por tokens | [index.ts](../supabase/functions/exchange-conta-azul-token/index.ts) |
| `get-conta-azul-token` | Obtém token válido | [index.ts](../supabase/functions/get-conta-azul-token/index.ts) |
| `get-valid-token` | Renova token se necessário | [index.ts](../supabase/functions/get-valid-token/index.ts) |
| `get-conta-azul-accounts` | Lista contas bancárias | [index.ts](../supabase/functions/get-conta-azul-accounts/index.ts) |
| `get-conta-azul-categories` | Lista categorias | [index.ts](../supabase/functions/get-conta-azul-categories/index.ts) |
| `validate-conta-azul-account` | Valida conta selecionada | [index.ts](../supabase/functions/validate-conta-azul-account/index.ts) |
| `conta-azul-webhook` | Recebe webhooks | [index.ts](../supabase/functions/conta-azul-webhook/index.ts) |
| `dw-api` | API do Data Warehouse | [index.ts](../supabase/functions/dw-api/index.ts) |

### 5.3 (Opcional) Configurar .env.local

Crie arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
VITE_CONTA_AZUL_REDIRECT_URI=http://localhost:5173/auth/conta-azul/callback
```

---

## FASE 6: Validação Final

- [ ] Acessar `/login` e criar conta de usuário
- [ ] Fazer login com sucesso
- [ ] Criar um tenant
- [ ] Conectar credencial Conta Azul (OAuth)
- [ ] Verificar que tokens foram salvos

---

## Resumo das Credenciais Necessárias

| Origem | Dados |
|--------|-------|
| Supabase | URL, Anon Key, Service Role Key, DB Password |
| Conta Azul | Client ID, Client Secret, Redirect URI configurada |

---

## Tempo Estimado

| Fase | Tempo |
|------|-------|
| Fase 1 - Criar Supabase | 5-10 min |
| Fase 2 - Deploy Edge Functions | 3 min |
| Fase 3 - Credenciais Conta Azul | 5 min |
| Fase 4 - Executar Setup | 1-2 min |
| Fase 5 - Configs manuais | 5 min |
| Fase 6 - Validação | 5 min |
| **Total** | **~25 minutos** |

---

## O Que é Salvo e Onde

| Dado | Onde é salvo | Observação |
|------|-------------|------------|
| `supabase_url` | localStorage (navegador) | Usado para recriar cliente Supabase |
| `supabase_anon_key` | localStorage (navegador) | Idem |
| `conta_azul_client_id` | Banco (`app_core.app_config`) | Texto plano |
| `conta_azul_client_secret` | Banco (`app_core.app_config`) | Criptografado |
| `system_api_key` | Banco (`app_core.app_config`) | Criptografado |
| `service_role_key` | **Não salvo** | Usado apenas durante o setup |
| `db_password` | **Não salvo** | Usado apenas para conexão direta |

---

## Troubleshooting

### Erro CORS / "Failed to fetch" no Setup
- **Causa:** As Edge Functions `setup-config` e/ou `run-migrations` não estão deployadas ou têm "Verify JWT" ativado
- **Solução:**
  1. Verifique se ambas as funções estão deployadas no Supabase Dashboard > Edge Functions
  2. Desative "Verify JWT" em cada uma delas
  3. Recarregue a página e tente novamente

### Edge Function não encontrada
- Verifique se fez deploy das funções `setup-config` e `run-migrations` antes de executar o setup
- Use: `supabase functions deploy setup-config --no-verify-jwt`

### Setup trava ou demora muito (> 2 minutos)
- **Causa antiga:** A função `setup-database` tinha ~7000 linhas e causava timeout
- **Solução:** Use as novas funções `setup-config` + `run-migrations` (mais leves)
- Se ainda usar `setup-database`, migre para as novas funções

### Erro de conexão com banco
- Verifique se a senha do PostgreSQL está correta
- Verifique se a URL do Supabase está correta (sem trailing slash)

### Erro "app_core não encontrado"
- Verifique se expôs o schema `app_core` em Settings > API > Exposed Schemas
- **Importante:** Só é possível expor o schema **após** executar as migrations

### OAuth não funciona
- Verifique se a Redirect URI está configurada exatamente igual no portal da Conta Azul
- URL não pode ter hash (`#`) nem trailing slash extra

### Forçar nova verificação do banco
- Execute no console do navegador: `localStorage.removeItem('db_setup_verified')`
- Recarregue a página

### Logs do Setup na UI
- O painel de logs mostra em tempo real o que está acontecendo
- Use o botão "Copiar" para compartilhar os logs em caso de erro

---

# Setup via Vercel (Produção)

Fluxo para deploy direto no Vercel sem precisar rodar o projeto localmente.

---

## VERCEL 1: Preparação

### 1.1 Criar Projeto Supabase

Mesmo processo da Fase 1 do setup local:
1. Acesse [app.supabase.com](https://app.supabase.com/)
2. Crie novo projeto e anote:
   - `Project URL`
   - `anon public` key
   - `service_role` key
   - `Database Password`

### 1.2 Deploy das Edge Functions

As 4 Edge Functions de setup precisam estar deployadas **antes** de usar o app.

**Opções:**
- Rodar os comandos abaixo de qualquer máquina com o CLI:
  ```bash
  supabase functions deploy setup-config --no-verify-jwt
  supabase functions deploy run-migrations --no-verify-jwt
  supabase functions deploy run-migrations-integrations --no-verify-jwt
  supabase functions deploy run-migrations-dw --no-verify-jwt
  ```
- Usar GitHub Actions (se configurado)
- Pedir para alguém com o CLI fazer o deploy

**Importante:** Desative "Verify JWT" nas 4 funções no Supabase Dashboard.

### 1.3 Obter Credenciais Conta Azul

Mesmo processo da Fase 3 do setup local.

---

## VERCEL 2: Configurar e Deploy

### 2.1 Conectar Repositório ao Vercel

1. Acesse [vercel.com](https://vercel.com/) e faça login
2. Clique em **Add New** → **Project**
3. Importe o repositório do GitHub
4. Configure:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### 2.2 Configurar Variáveis de Ambiente

Em **Project Settings → Environment Variables**, adicione:

| Variável | Valor | Obrigatório |
|----------|-------|-------------|
| `VITE_SUPABASE_URL` | `https://xxxxx.supabase.co` | Sim |
| `VITE_SUPABASE_ANON_KEY` | Sua anon key | Sim |
| `VITE_CONTA_AZUL_REDIRECT_URI` | `https://seu-app.vercel.app/auth/conta-azul/callback` | Sim |

### 2.3 Deploy

Clique em **Deploy**. Aguarde o build completar.

---

## VERCEL 3: Executar Setup do Banco

1. Acesse seu app no Vercel (ex: `https://seu-app.vercel.app`)
2. O app vai detectar que o banco não está configurado e redirecionar para `/setup`
3. Preencha o formulário:
   - **Supabase URL**: já configurado, mas confirme
   - **Supabase Anon Key**: já configurado, mas confirme
   - **Service Role Key**: do Supabase Dashboard
   - **Database Password**: do Supabase
   - **Client ID/Secret**: da Conta Azul
   - **System API Key**: gerada automaticamente
4. Clique em **Executar Setup**
5. Aguarde as migrations executarem

**Saída esperada:** Mensagem verde de sucesso

---

## VERCEL 4: Configurações Manuais

### 4.1 Expor Schema no Supabase

Mesmo processo da Fase 5.1 do setup local:
- Marcar `app_core` em **Settings > API > Exposed Schemas**

### 4.2 Deploy das Demais Edge Functions

Mesmo processo da Fase 5.2 do setup local.

### 4.3 Configurar Redirect URI na Conta Azul

No portal da Conta Azul, adicione a URL do Vercel:
- `https://seu-app.vercel.app/auth/conta-azul/callback`

---

## VERCEL 5: Validação

- [ ] Acessar o app no Vercel
- [ ] Criar conta de usuário
- [ ] Fazer login
- [ ] Criar tenant
- [ ] Conectar credencial Conta Azul

---

## Resumo: Vercel vs Local

| Aspecto | Local | Vercel |
|---------|-------|--------|
| Precisa rodar `npm run dev` | Sim | Não |
| Onde configura URL/Key | `.env.local` ou Setup | Vercel + Setup |
| Setup do banco | Via interface local | Via interface no Vercel |
| Edge Functions | Deploy via CLI | Deploy via CLI (de qualquer lugar) |

---

## Importante: Como funciona o cache

Após o setup bem-sucedido, o app salva um flag no `localStorage` para não verificar o banco toda vez.

- **Primeiro acesso**: verifica banco → se não configurado → vai para `/setup`
- **Após setup**: salva cache → próximos acessos vão direto para `/login`
- **Para forçar nova verificação**: `localStorage.removeItem('db_setup_verified')`
