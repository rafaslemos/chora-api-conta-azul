# Provisionamento do Novo Projeto Supabase

## ⚠️ OBRIGATÓRIO: Este é um projeto Supabase NOVO, separado do atual

Este documento descreve todos os passos necessários para provisionar e configurar o novo projeto Supabase para o app exclusivo ContaAzul.

## Passo 1: Criar o Novo Projeto

1. Acesse [Supabase Dashboard](https://app.supabase.com/)
2. Clique em "New Project"
3. Configure:
   - **Name**: `contaazul-api` (ou outro nome de sua preferência)
   - **Database Password**: Salve em local seguro
   - **Region**: Escolha a região mais próxima dos usuários
   - **Pricing Plan**: Escolha conforme necessidade
4. Aguarde a criação do projeto (pode levar alguns minutos)

## Passo 2: Obter Credenciais

Após a criação do projeto, vá em **Settings > API** e copie:

- **Project URL** → `VITE_SUPABASE_URL`
- **anon/public key** → `VITE_SUPABASE_ANON_KEY`
- **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (manter segredo!)

## Passo 3: Configurar Variáveis de Ambiente no Supabase

Vá em **Settings > Edge Functions > Secrets** e configure:

```
CA_CLIENT_ID=4ja4m506f6f6s4t02g1q6hace7
CA_CLIENT_SECRET=cad4070fd552ffeibjrafju6nenchlf5v9qv0emcf8belpi7nu7
SYSTEM_API_KEY=<gerar-uma-chave-secreta-aleatoria>
```

**⚠️ IMPORTANTE**: 
- `CA_CLIENT_SECRET` deve ser a chave secreta real da Conta Azul
- `SYSTEM_API_KEY` deve ser uma string aleatória longa e segura (use um gerador de senha)
- Nunca exponha essas variáveis no código frontend

## Passo 4: Configurar Exposed Schemas

Vá em **Settings > API > Exposed Schemas** e configure:

- Marque: `app_core` (obrigatório para autenticação e tenants)
- Marque: `dw` (se você quiser expor tabelas do DW via API REST, opcional)
- **NÃO** marque: `integrations` (não deve ser exposto via API pública)

Isso garante que apenas os schemas necessários sejam acessíveis via API REST.

## Passo 5: Aplicar Schema SQL

1. Acesse **SQL Editor** no Supabase Dashboard
2. Execute os scripts SQL na seguinte ordem:

   a. **Criar schemas**: Execute `sql/migrations/001_create_schemas.sql`
   
   b. **Criar tabelas app_core**: Execute `sql/migrations/002_create_app_core_tables.sql`
   
   c. **Criar tabelas dw**: Execute `sql/migrations/003_create_dw_tables.sql`
   
   d. **Criar funções RPC**: Execute `sql/migrations/004_create_rpc_functions.sql`
   
   e. **Criar políticas RLS**: Execute `sql/migrations/005_create_rls_policies.sql`

3. Verifique se todas as tabelas foram criadas em **Table Editor**

## Passo 6: Deploy das Edge Functions

Execute no terminal (na raiz do projeto):

```bash
# Instalar Supabase CLI (se ainda não tiver)
npm install -g supabase

# Login no Supabase
supabase login

# Linkar ao projeto (usar o Project Reference ID do Dashboard)
supabase link --project-ref <seu-project-ref>

# Deploy das Edge Functions
supabase functions deploy exchange-conta-azul-token
supabase functions deploy get-conta-azul-accounts
supabase functions deploy get-conta-azul-categories
supabase functions deploy get-valid-token
supabase functions deploy dw-api
```

## Passo 7: Configurar Authentication

Vá em **Authentication > URL Configuration** e configure:

- **Site URL**: URL do seu app em produção (ou `http://localhost:5173` para desenvolvimento)
- **Redirect URLs**: Adicione:
  - `http://localhost:5173/auth/conta-azul/callback` (desenvolvimento)
  - `https://seu-dominio.com/auth/conta-azul/callback` (produção)

Vá em **Authentication > Email Templates** e personalize se necessário.

## Passo 8: Atualizar .env do App

Crie/atualize o arquivo `.env.local` na raiz do projeto:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key-aqui
VITE_CONTA_AZUL_REDIRECT_URI=http://localhost:5173/auth/conta-azul/callback
```

**⚠️ NUNCA** commite o `.env.local` no git! Adicione ao `.gitignore`.

## Passo 9: Configurar OAuth Redirect URI na Conta Azul

1. Acesse o portal de desenvolvedor da Conta Azul
2. Vá nas configurações do seu app
3. Adicione a URL de redirect:
   - Desenvolvimento: `http://localhost:5173/auth/conta-azul/callback`
   - Produção: `https://seu-dominio.com/auth/conta-azul/callback`

## Passo 10: Verificar Tudo

Execute uma verificação final:

- [ ] Projeto Supabase criado e ativo
- [ ] Variáveis de ambiente configuradas (Edge Functions secrets)
- [ ] Exposed schemas configurados
- [ ] Todos os scripts SQL executados sem erros
- [ ] Todas as Edge Functions deployadas com sucesso
- [ ] URLs de redirect configuradas (Supabase Auth + Conta Azul)
- [ ] `.env.local` configurado no app
- [ ] Testar login básico no app

## Troubleshooting

### Edge Functions não encontram variáveis de ambiente
- Verifique se configurou os secrets em **Settings > Edge Functions > Secrets**
- Certifique-se de fazer deploy novamente após adicionar secrets

### Erro de RLS ao acessar tabelas
- Verifique se as políticas RLS foram criadas corretamente
- Teste com um usuário autenticado
- Verifique se `app_core` está nos exposed schemas

### OAuth redirect não funciona
- Verifique se a URL no `.env.local` corresponde exatamente à configurada na Conta Azul
- Certifique-se de que a URL não tem trailing slash (exceto raiz)
- Verifique se o projeto Supabase está ativo

## Próximos Passos

Após completar este provisionamento, você pode:
1. Testar a autenticação OAuth no app
2. Criar o primeiro tenant via UI
3. Conectar a primeira credencial Conta Azul
4. Testar a API do DW (se configurada)
