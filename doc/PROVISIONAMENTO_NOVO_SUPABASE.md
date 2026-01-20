# Provisionamento do Novo Projeto Supabase

## ⚠️ OBRIGATÓRIO: Este é um projeto Supabase NOVO, separado do atual

Este documento descreve todos os passos necessários para provisionar e configurar o novo projeto Supabase para o app exclusivo ContaAzul.

## Automatizado vs Manual

### ✅ AUTOMATIZADO (quando `db_password` fornecido)

Quando você fornece a senha do PostgreSQL (`db_password`) no setup automático via app, as seguintes operações são executadas automaticamente:

- ✅ Execução de todas as migrations SQL (001-024)
- ✅ Criação de schemas (`app_core`, `integrations`, `integrations_conta_azul`, `dw`)
- ✅ Criação de todas as tabelas (app_core, dw, integrations)
- ✅ Criação de funções RPC
- ✅ Criação de políticas RLS
- ✅ Criação de tabelas e funções ETL do Data Warehouse
- ✅ Criação de views do Data Warehouse
- ✅ Ajustes e melhorias do DW (constraints CHECK, verificações de integridade)
- ✅ Criação da tabela `app_core.app_config` para configurações globais
- ✅ Salvamento automático de Client ID e Client Secret no banco de dados
- ✅ Validação de credenciais Supabase

### ❌ MANUAL (sempre necessário)

As seguintes configurações precisam ser feitas manualmente no Supabase Dashboard:

1. **Exposed Schemas**: Dashboard > Settings > API > Exposed Schemas
   - Marcar: `app_core` (obrigatório)
   - Opcional: `dw`
   - **Por quê?** Sem API pública disponível

2. **Edge Functions Secrets** (OPCIONAL - apenas como fallback):
   - Dashboard > Settings > Edge Functions > Secrets
   - Configurar: `CA_CLIENT_ID`, `CA_CLIENT_SECRET`, `SYSTEM_API_KEY`
   - **Nota**: As configurações já são salvas automaticamente no banco de dados durante o setup.
   - As Edge Functions podem ler do banco OU das variáveis de ambiente (fallback).
   - Você pode configurar os secrets apenas se quiser manter o fallback durante a transição.

3. **Deploy Edge Functions**: Via CLI
   ```bash
   supabase functions deploy setup-database
   supabase functions deploy exchange-conta-azul-token
   # ... outras functions
   ```
   - **Por quê?** Requer autenticação CLI e acesso ao projeto

## Setup Automático via App (Recomendado)

O app possui uma funcionalidade de setup automático que facilita a configuração inicial do banco de dados. Esta é a forma mais simples de começar.

### Como Usar

1. **Criar o Novo Projeto Supabase**:
   - Acesse [Supabase Dashboard](https://app.supabase.com/)
   - Crie um novo projeto (veja "Passo 1" abaixo)
   - Anote as credenciais: `SUPABASE_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY`

2. **Acessar a Página de Setup**:
   - Ao abrir o app pela primeira vez, você será redirecionado automaticamente para `/setup`
   - Ou acesse manualmente: `http://localhost:5173/#/setup`

3. **Preencher o Formulário**:
   - **Supabase URL**: URL do projeto (ex: `https://xxxxx.supabase.co`)
   - **Supabase Anon Key**: Chave pública do projeto
   - **Service Role Key**: Chave de serviço (usada apenas uma vez para setup)
   - **Database Password** (opcional): Senha do PostgreSQL
     - Se fornecido, as migrations SQL serão executadas automaticamente
     - Se não fornecido, você receberá as migrations SQL para executar manualmente
   - **Conta Azul Client ID**: Client ID da sua aplicação Conta Azul
   - **Conta Azul Client Secret**: Client Secret da sua aplicação Conta Azul
   - **System API Key**: Chave gerada automaticamente (ou personalize)

4. **Executar Setup**:
   - Clique em "Executar Setup"
   - O app irá:
     - Validar as credenciais do Supabase
     - Executar todas as migrations SQL (se senha fornecida)
     - Retornar instruções para próximos passos manuais

5. **Configurações Manuais Necessárias**:
   - **Exposed Schemas**: Configure `app_core` e `dw` em Settings > API > Exposed Schemas
   - **Edge Functions Secrets** (OPCIONAL): As configurações já foram salvas automaticamente no banco de dados.
     - Você pode configurar os secrets apenas como fallback durante a transição
   - **Deploy das Edge Functions**: Faça deploy das Edge Functions necessárias

6. **Após Setup**:
   - Você será redirecionado para a página de login
   - A configuração do Supabase será salva no `localStorage` do navegador

### Vantagens do Setup Automático

- ✅ Validação automática das credenciais
- ✅ Execução automática das migrations SQL (se senha fornecida)
- ✅ Interface amigável para configuração inicial
- ✅ Geração automática de `SYSTEM_API_KEY`
- ✅ Instruções claras para próximos passos

### Limitações

- ⚠️ **Exposed Schemas**: Ainda precisam ser configurados manualmente
- ⚠️ **Edge Functions Secrets**: Opcionais (configurações são salvas automaticamente no banco)
- ⚠️ **Deploy Edge Functions**: Precisa ser feito manualmente ou via CLI
- ⚠️ **Database Password**: Se não fornecido, migrations precisam ser executadas manualmente

---

## Setup Manual (Alternativa)

Se preferir configurar manualmente ou o setup automático não funcionar, siga os passos abaixo.

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

## Passo 3: Configurar Variáveis de Ambiente no Supabase (OPCIONAL)

**⚠️ NOTA**: Se você usou o setup automático via app, as configurações (Client ID e Client Secret) já foram salvas automaticamente no banco de dados. Você pode pular este passo ou configurá-las apenas como fallback durante a transição.

Se preferir configurar manualmente ou manter fallback:

Vá em **Settings > Edge Functions > Secrets** e configure:

```
CA_CLIENT_ID=4ja4m506f6f6s4t02g1q6hace7
CA_CLIENT_SECRET=cad4070fd552ffeibjrafju6nenchlf5v9qv0emcf8belpi7nu7
SYSTEM_API_KEY=<gerar-uma-chave-secreta-aleatoria>
```

**⚠️ IMPORTANTE**: 
- `CA_CLIENT_SECRET` deve ser a chave secreta real da Conta Azul (opcional - já salvo no banco durante setup)
- `SYSTEM_API_KEY` deve ser uma string aleatória longa e segura (use um gerador de senha)
- Nunca exponha essas variáveis no código frontend
- As Edge Functions podem ler do banco OU das variáveis de ambiente (fallback)

## Passo 4: Configurar Exposed Schemas

### O que são Exposed Schemas?

**Exposed Schemas** são schemas do PostgreSQL que ficam acessíveis via API REST do Supabase. Quando você marca um schema como "exposto", o Supabase gera automaticamente endpoints REST para todas as tabelas desse schema.

**Por que configurar?**

- `app_core`: **DEVE** estar exposto - necessário para o frontend acessar `profiles`, `tenants`, `tenant_credentials` via API REST
- `dw`: **OPCIONAL** - expor apenas se quiser acesso direto às views do Data Warehouse via REST API
- `integrations` e `integrations_conta_azul`: **NÃO devem** ser expostos por segurança (dados sensíveis de integrações)

**Onde configurar?**

Vá em **Settings > API > Exposed Schemas** no Supabase Dashboard e configure:

- ✅ Marque: `app_core` (obrigatório para autenticação e tenants)
- ⚪ Opcionalmente marque: `dw` (se você quiser expor tabelas do DW via API REST)
- ❌ **NÃO** marque: `integrations` e `integrations_conta_azul` (schemas internos, não devem ser expostos por segurança)

Isso garante que apenas os schemas necessários sejam acessíveis via API REST.

## Passo 5: Aplicar Schema SQL

### Via Setup Automático (Recomendado)

Se você usou o setup automático via app e forneceu a senha do PostgreSQL (`db_password`), todas as migrations SQL (001-024) foram executadas automaticamente, incluindo:
- Todas as tabelas e funções do sistema
- Tabela `app_core.app_config` para configurações globais
- Salvamento automático de Client ID e Client Secret no banco

Você pode pular este passo e ir direto para o Passo 6.

### Via Execução Manual (Alternativa)

Se preferir executar manualmente ou não forneceu a senha no setup automático:

1. Acesse **SQL Editor** no Supabase Dashboard
2. Execute os scripts SQL na seguinte ordem (001-024):

   - `001_create_schemas.sql` - Criar schemas dedicados
   - `002_create_app_core_tables.sql` - Criar tabelas app_core
   - ... (migrations intermediárias)
   - `023_create_app_config_table.sql` - Criar tabela de configurações globais
   - `024_create_app_config_rpc_functions.sql` - Criar funções RPC para configurações
   - `003_create_dw_tables.sql` - Criar tabelas dw
   - `004_create_rpc_functions.sql` - Criar funções RPC
   - `005_create_rls_policies.sql` - Criar políticas RLS
   - `006_create_integrations_schemas.sql` - Criar schema integrations_conta_azul
   - `007_create_integrations_shared_tables.sql` - Criar tabelas compartilhadas de integrações
   - `008_create_integrations_conta_azul_entities.sql` - Criar tabelas de entidades Conta Azul
   - `009_create_integrations_conta_azul_financial.sql` - Criar tabelas financeiras Conta Azul
   - `010_create_integrations_conta_azul_sales.sql` - Criar tabelas de vendas Conta Azul
   - `011_create_integrations_conta_azul_rpc_functions.sql` - Criar funções RPC de integração
   - `012_update_dw_references_to_tenants.sql` - Atualizar referências no DW
   - `013_create_integrations_rls_policies.sql` - Criar políticas RLS de integrações
   - `014_create_dw_dim_calendario.sql` - Criar dimensão calendário
   - `015_create_dw_etl_dimensoes.sql` - Criar funções ETL de dimensões
   - `016_create_dw_etl_fatos.sql` - Criar funções ETL de fatos
   - `017_create_dw_views.sql` - Criar views do DW
   - `018_create_dw_ajustes.sql` - Ajustes do DW (constraints, verificações)
   - `019_add_additional_migrations.sql` - Migrations adicionais (campos expandidos)
   - `020_create_view_contas_unificadas.sql` - View de contas financeiras unificadas

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
supabase functions deploy setup-database  # Edge Function de setup automático
supabase functions deploy exchange-conta-azul-token
supabase functions deploy get-conta-azul-accounts
supabase functions deploy get-conta-azul-categories
supabase functions deploy get-valid-token
supabase functions deploy dw-api
```

**⚠️ IMPORTANTE**: A Edge Function `setup-database` deve ser deployada ANTES de ser usada pela primeira vez. Se você usar o setup automático via app, certifique-se de fazer o deploy desta função primeiro.

## Passo 6.1: Funcionalidades do Data Warehouse

Após executar as migrations, o banco de dados terá as seguintes funcionalidades do Data Warehouse disponíveis:

### Tabela dim_calendario

A tabela `dw.dim_calendario` armazena informações temporais para análises. Para preenchê-la:

```sql
SELECT dw.carregar_dim_calendario();
```

Isso preenche o calendário com datas de 2020 a 2030.

### Funções ETL de Dimensões

Funções para carregar dimensões do DW a partir dos dados coletados:

- `dw.carregar_dim_categoria(p_tenant_id)` - Carrega dimensão de categorias com hierarquia
- `dw.carregar_dim_categoria_dre(p_tenant_id)` - Carrega dimensão DRE
- `dw.carregar_dim_centro_custo(p_tenant_id)` - Carrega dimensão centro de custo
- `dw.carregar_dim_pessoa(p_tenant_id)` - Carrega dimensão pessoa (clientes/fornecedores)
- `dw.carregar_dim_conta_financeira(p_tenant_id)` - Carrega dimensão conta financeira
- `dw.carregar_dim_vendedor(p_tenant_id)` - Carrega dimensão vendedor

**Uso**: Se `p_tenant_id` for `NULL`, carrega dados de todos os tenants. Caso contrário, carrega apenas do tenant especificado.

### Funções ETL de Fatos

Funções para carregar fatos do DW:

- `dw.carregar_fato_contas_financeiras(p_tenant_id)` - Carrega fato unificado de contas a pagar e receber
- `dw.carregar_fato_vendas(p_tenant_id)` - Carrega fato de vendas
- `dw.carregar_fato_vendas_itens(p_tenant_id)` - Carrega fato de itens de vendas
- `dw.carregar_fato_contratos(p_tenant_id)` - Carrega fato de contratos
- `dw.carregar_fato_saldos_contas(p_tenant_id)` - Carrega fato de saldos de contas financeiras
- `dw.carregar_dw_completo(p_tenant_id)` - Executa todo o processo ETL em ordem (dimensões primeiro, depois fatos)

**Uso**: Execute `dw.carregar_dw_completo(NULL)` para carregar todos os dados do DW de uma vez.

### Views do Data Warehouse

Views pré-configuradas para análises:

- `dw.vw_fluxo_caixa` - Fluxo de caixa agregado por data de vencimento
- `dw.vw_dre` - DRE (Demonstração do Resultado do Exercício) agregado por categoria DRE
- `dw.vw_performance_vendedores` - Performance de vendedores com métricas agregadas
- `dw.vw_analise_categorias` - Análise de categorias com hierarquia nivelada
- `dw.vw_categoria_dre_com_totalizador` - Categorias DRE com totalizadores identificados

### View Unificada de Contas Financeiras

- `integrations_conta_azul.vw_contas_financeiras_unificadas` - View que une contas a pagar e receber detalhadas em uma única consulta

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
- [ ] Variáveis de ambiente configuradas (Edge Functions secrets - opcional, apenas como fallback)
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
