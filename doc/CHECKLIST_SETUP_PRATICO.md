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

## FASE 2: Deploy da Edge Function de Setup

Antes de executar o setup pelo app, a Edge Function precisa estar deployada.

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
npx supabase functions deploy setup-database
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
3. Deploy da Edge Function de setup:
   ```bash
   supabase functions deploy setup-database
   ```

**Saída esperada:** Mensagem "Function deployed successfully"

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

```bash
supabase functions deploy exchange-conta-azul-token
supabase functions deploy get-conta-azul-accounts
supabase functions deploy get-conta-azul-categories
supabase functions deploy get-valid-token
supabase functions deploy dw-api
```

> **Nota:** Se não instalou o CLI globalmente, use `npx supabase functions deploy ...`

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
| Fase 2 - Deploy setup-database | 5 min |
| Fase 3 - Credenciais Conta Azul | 5 min |
| Fase 4 - Executar Setup | 2 min |
| Fase 5 - Configs manuais | 5 min |
| Fase 6 - Validação | 5 min |
| **Total** | **~30 minutos** |

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

### Edge Function não encontrada
- Verifique se fez deploy da função `setup-database` antes de executar o setup

### Erro de conexão com banco
- Verifique se a senha do PostgreSQL está correta
- Verifique se a URL do Supabase está correta (sem trailing slash)

### Erro "app_core não encontrado"
- Verifique se expôs o schema `app_core` em Settings > API > Exposed Schemas

### OAuth não funciona
- Verifique se a Redirect URI está configurada exatamente igual no portal da Conta Azul
- URL não pode ter hash (`#`) nem trailing slash extra

### Forçar nova verificação do banco
- Execute no console do navegador: `localStorage.removeItem('db_setup_verified')`
- Recarregue a página

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

### 1.2 Deploy da Edge Function

A Edge Function `setup-database` precisa estar deployada **antes** de usar o app.

**Opções:**
- Rodar `supabase functions deploy setup-database` de qualquer máquina com o CLI
- Usar GitHub Actions (se configurado)
- Pedir para alguém com o CLI fazer o deploy

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
