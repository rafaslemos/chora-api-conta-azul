# Checklist Prático - Setup Completo

Guia passo a passo para configurar o ambiente do zero até o primeiro login.

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

1. Abra terminal na raiz do projeto
2. Instale Supabase CLI (se não tiver):
   ```bash
   npm install -g supabase
   ```
3. Faça login:
   ```bash
   supabase login
   ```
4. Vincule ao projeto (use o Project Reference do Dashboard - parte da URL antes de `.supabase.co`):
   ```bash
   supabase link --project-ref SEU_PROJECT_REF
   ```
5. Deploy da Edge Function de setup:
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
